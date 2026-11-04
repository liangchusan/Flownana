# 广告落地与注册归因浏览器复核 — 2026-10-27

> 历史归档（2026-11-03 整理）：以下是原记录日期的方案或审计快照，不能作为当前状态。当前规则见 [PRODUCT](../PRODUCT.md)，工程状态见 [MEMORY](../../MEMORY.md)。

## 结论

初次本机 Chrome 复核发现 5 类额外问题，以下发现部分保留当时的缺陷证据。
用户随后批准全部修复，并明确授权生产部署；已完成隔离范围发布，版本与证据见末节。
没有补发历史事件、真实注册、生产数据或投放设置变更，真实 Google/GA4 收件验收仍保留。

## 环境与证据边界

- Next 16.3.8 本地 production build，VERCEL_ENV=preview；只启用测试 GA ID。
- 上游 Next 绑定 127.0.0.1:3710；隔离代理绑定 127.0.0.1:3711。
  数据库进程变量指向本机无服务端口，未连接业务库；客户端 API 由本地替身接管。
- 测试代码只改写代理响应中的 SDK 地址，实际 React/Next 前端逻辑保持；SDK、OAuth、
  上下文传输为替身，CSP 限制浏览器向站外发起统计连接。不会向正式/测试 GA 写入。
- 浏览器使用默认桌面尺寸及 390×844，手机 viewport 已恢复。测试标签和服务器已清理。
  两次自动化连接超时通过新标签恢复，不将其认定为应用故障。
- 完整后台复现执行实际 Cookie 签名、登录回调、user-sync 和注册入队源码；
  数据库为内存替身、GA secret 未配置，验证的是队列状态，不是 Google 收件。
- 同意与账号状态、真实 Google 往返、GA4/Ads 收件、真实手机触控仍不能由替身证明。

## 发现

### 1. 高优先级：登录回调仍信任旧统计 Cookie，缺少当前许可核对

触发条件：先取得有效签名上下文，再拒绝统计或启用 GPC；撤回 DELETE 返回 503，
然后使用新的 Google 身份注册。另一个条件是 US 地区默认上下文尚未过期，随后在
需明确选择的地区登录，未重新 Allow。

浏览器证据：Privacy 显示 Analytics off / Withdrawal pending、Allow 禁用；后续登录
没有新的上下文 POST，但旧 HttpOnly 测试 Cookie 仍被浏览器带入 OAuth 请求。
后台实际源码的三种复现均得到 `pending` 且带上下文的 `sign_up`，不是预期的缺失上下文。
这证明存在违背当前许可继续入队的风险，没有声称真实事件已被 Google 收到。

根因：`lib/auth-options.ts` signIn 回调直接 `readAnalyticsContext(cookie)`，只校验
签名/ID/期限；没有当前拒绝、撤回待确认、GPC 或最新地区的门禁。浏览器 localStorage
的拒绝和 pending 不能自动成为服务器登录回调可见的状态。单纯跳过新同步不等于旧 Cookie
失效；成功撤回路径的既有测试不能覆盖失败撤回后的新注册。

建议：让登录回调使用可信的当前统计许可证据；拒绝/GPC/撤回未确认期间旧上下文不能
作为新注册的可上报依据，地区默认必须按当前请求复核。不能伪造许可或通过阻断普通登录
解决。补测旧 Cookie + DELETE 故障 + 注册/换号，以及地区变化；保持旧缺失事件不补报。

证据：`browser-withdraw-failed.json`、`withdrawal-pending.jpg`、
`flownana-signup-stale-cookie.cjs` / `flownana-signup-stale-cookie-results.json`。
后者的 passed=3 表示三次缺陷复现符合观察结果，**不表示隐私验收通过**。

### 2. 高优先级：视频页默认“Sign in with Google”按钮点击无响应

匿名打开 Video，Prompt 为空时，按钮显示 enabled，但点击不发起 OAuth、也没有反馈。
桌面和 390px 均复现。输入有效 Prompt 再点立即进入公共登录流程，形成对照。

根因：`components/creation/video-creation-form.tsx` 的 handleGenerate 先判断
promptInvalid / 模型 / 积分等生成条件并 return，随后才判断未登录。
按钮的 disabled 条件却只对已登录用户检查 promptInvalid，因而匿名用户看见一个死按钮。

建议：登录动作与生成校验顺序一致；匿名登录不能以已完成生成输入为前提。验收空/过短/
有效 Prompt、无效旧模型、输入上传中，以及桌面/手机入口，不调用真实生成服务。

证据：`browser-video-mobile-empty-vs-valid.json`、`video-login-empty-desktop.jpg`、
`video-login-empty-mobile.jpg`。手机 document scrollWidth/clientWidth 均 390，无横向溢出。

### 3. 中优先级：统计初始化前的公开页面切换会丢失广告参数

从带测试 UTM 的 Image 落地，地区策略延迟 3 秒时立即点击 Video：URL 变为 `/video`，
全部 query 被删除；策略和 SDK 就绪后，首个 page_view 为 `/video`，不带原 campaign。

根因：`components/blocks/media-creation-workspace.tsx` 的 updateWorkspaceUrl 无条件
清空 search；AnalyticsEvents 到许可就绪后才按当前 window.location 构造初始 config/事件。
登录等待修复只等待上下文，不能恢复已被删除的落地信息。

建议：公开入口之间保留经过现有白名单过滤的归因参数，或在许可规则内明确承接原落地信息；
私有路径仍须清理私人 query。验收 Image/Video/首页/Agent 快速导航、前进后退、刷新和
拒绝/GPC。这里只证明 SDK 投递参数丢失，不能量化实际 GA4 归因损失；已有 GA 会话等
条件可能影响最终结果。

证据：`browser-navigation-before-policy.json`，首个 SDK page_view 的 campaign=false。

### 4. 中优先级：慢 SDK 时双击登录发起两次 OAuth

SDK 延迟 3 秒时双击侧栏 Sign in；两次点击后，在同一毫秒观察到两个 oauth-start，
同时出现两份登录同步请求。公共 auth-sign-in 没有在途登录合并或入口防重复保护。

风险：多余同步及并行 OAuth state/cookie 可能互相覆盖。没有据此声称已经产生重复账号、
重复 sign_up 或真实 OAuth 失败；后台新建事实的去重仍由原事务负责。

建议：全站共用一次在途登录，结束/失败后可重试，并明确处理不同入口的 pricing 回跳。
验收双击、多入口连点、等待中重开套餐、失败再试及返回后的再次登录。

证据：`browser-double-click.json`，两次 click 在 218/219ms，两个 oauth-start 均 3108ms。

### 5. 低优先级：GPC 下 Privacy 的默认开启文案与实际状态矛盾

GPC 已关闭统计、Allow 禁用时，面板仍同时显示默认开启两项衡量及
“Sign in, then Allow to enable ad measurement”。实际首次 GPC 路径没有加载 SDK 或提交
上下文，登录正常；问题是说明与状态不一致，不是该路径已发送数据的证据。

根因：`components/analytics/analytics-preferences.tsx` 的默认文案和广告状态分支没有
优先处理 GPC/待撤回。建议用实际可用权限决定说明，保留简短披露和关闭重开一致性。

## 验证矩阵

| 场景 | 本次观察 | 边界 |
| --- | --- | --- |
| 正常 Image / 侧栏登录 | 同步成功后 OAuth，UTM 保留 | 浏览器替身 |
| 策略延迟后直接登录 | 等待策略/SDK 后同步成功，UTM 保留 | 浏览器观察，前一轮 17 项回归也覆盖 |
| 503 后恢复 | 登录 POST 503，下一次 200 后才 OAuth | 浏览器独立复现 |
| 403 永久拒绝 | 登录只请求一次，不再重试，继续 OAuth | 页面后台同步另有一次；不能混作登录重试 |
| SDK 被拦截 | 点击约 5 秒后继续 OAuth，无上下文 POST | 浏览器 + 固定诊断原因 |
| 上下文每次响应 3.5 秒 | 点击约 6.1 秒后继续；三次登录请求均已取消 | 浏览器；页面后台同步另计一次 |
| 未同意的地区 | 无 SDK/上下文，仍可登录 | 新鲜许可状态 |
| 匿名 Allow → 关闭重开 | Analytics/Ad measurement on，一致 | 浏览器 |
| Reject 成功后登录 | 两项关闭，无后续上下文 POST | 浏览器，不覆盖失败撤回 |
| 首次 GPC | 无 SDK/上下文，Allow 禁用，登录正常 | 文案矛盾另记 |
| 视频空 Prompt / 有效 Prompt | 空输入死按钮，有效输入登录正常 | 桌面 + 390px |
| 图片有效 Prompt | 创作按钮正常登录，保留 UTM | 未调用 Provider |
| Agent 有效输入 | Sign in to send 正常登录，保留回跳 | 未调用 Provider |
| Pricing 选套餐 | 一次 pricing_view，登录回跳保留 UTM 与 #pricing | 未创建 Checkout 或支付 |
| 初始化前 Image → Video | 首个 page_view 丢 UTM | 已确认问题 |
| 慢 SDK 双击 | 两个 OAuth 请求 | 已确认问题 |
| 旧 Cookie + 拒绝/GPC/地区变化 | 三种实际后台复现仍入队 pending | 已确认问题；无真实 GA 发送 |
| 换号/重授/切回、历史不补报 | 现有源码回归通过 | 本轮未完成真实跨账号浏览器验收 |

重跑 5 个专项文件：39 passed / 0 failed / 0 skipped；测试 GA 的本地 production build
成功，新诊断脚本局部 ESLint 和 diff 检查通过。测试通过不代表上述新增场景已被修复。
原工作区安全/支付迁移及独立邮箱连接器均保留，不能将混合工作区直接作为本修复发布包。

## 初次复核时的后续验收建议

先修复上述 1–4，再用隔离测试账号验收旧 Cookie、撤回失败、GPC/地区变化、所有登录入口
与双击，以及初始化前导航。之后使用获准的真实 Google 新账号核对只产生一次 sign_up、
原会话与活动关联；旧账号零新增，真实 GA4 与 Ads 收件单独回读。历史两账号不补造来源。
本轮仅生成检查报告和脱敏测试材料，未修改 PRODUCT 的既定事件/同意行为。

## 批准后的修复验收（本地完成，未发布）

| 原问题 | 最终修复 | 本轮证据 |
| --- | --- | --- |
| 旧 Cookie 在当前无许可时仍入队 | 浏览器同步必要的禁止偏好 Cookie；Google 发起请求在准备未成功时也保存禁止，回调复查禁止/GPC/最新地区 | 实际捕获、签名、OAuth 发起、回调、user-sync/入队源码 5 个情景通过；无许可均 missing_context，允许控制组 pending |
| 视频匿名空输入死按钮 | 登录判断先于全部生成校验，登录后校验保持 | panel/composer 回归覆盖空/过短/有效 Prompt 与输入未完成；桌面和实际 390px 均可空输入登录，积分展示保留 |
| 快速导航丢 UTM | 公开路径共用过滤后的参数承接，覆盖侧栏、Logo、页眉/页脚、Agent 和 Pricing 跳转 | 策略延迟 3 秒后首个 /video page_view 的 campaign=true，私人 query 已移除；Assets URL 无 query |
| 双击并行 OAuth | 所有入口共享在途 Promise，成功跳转间隙保持；准备期间可升级 pricing 回跳，失败/页面返回后可再次登录 | 慢 SDK 的 2 次点击只观察到 1 个 oauth-start；回归覆盖失败重试、BFCache、首次 pageshow 不释放；浏览器返回后可再次登录 |
| GPC 文案矛盾 | GPC/待撤回优先于默认开启及登录后 Allow 说明 | 桌面待撤回与手机 GPC 首次/关闭重开一致，Allow 禁用；390px scrollWidth/clientWidth 都为 390 |

禁止偏好 `flownana_analytics_blocked` 只有限制作用，不能授予统计许可，不含身份/会话/
广告 ID，最长 180 天，HTTPS 使用 Secure、SameSite=Lax、Path=/。旧签名上下文本身仍
需要正确属性/格式/签名/期限；服务端 GPC 和当前地区约束不能被客户端“准备成功”覆盖。
撤回未确认时重新 Allow 不清除禁止；确认完成且最新许可允许后才解除。正常登录不被拒绝，
其他对话新增的注册积分和按钮积分展示保留，本轮没有新增表/迁移或 UTM 账号字段。

额外用真实本地 NextAuth 路由提交故意无效的 CSRF（未进入真实 OAuth），确认原 CSRF
保护继续生效，响应仍设置禁止偏好；未输出令牌/Cookie 值。证据 `nextauth-real-route-denial.json`。

最终验证：全量 **513 项，496 passed / 17 skipped / 0 failed**；跳过项需要隔离数据库或
真实 Stripe 环境。production build（测试 GA/preview 配置，含类型检查）、design:check、
lint 和 diff 检查通过；lint 原有 17 条 warnings，无 errors。复核 React hooks、异步状态、
账号边界、语义控件和移动布局，无额外设计系统变更。没有把内存替身当作真实数据库验收。

本机浏览器 SDK/OAuth/API 仍为隔离替身，测试 GA 不实际发事件；原始复现材料保留，
修复后结果为 `browser-five-fix-*.json`、`flownana-signup-five-fix*.json`；截图为
`fixed-gpc-mobile.jpg`、`fixed-video-mobile.jpg`。实际 Google 新注册、跨账号/地区、
GA4/Ads 来源收件与真实手机触控仍需手测。历史两条缺失上下文的注册不补造、不重放。
测试 viewport、标签和本地服务已清理；该轮本地验收时尚未部署。发布时仍须隔离工作区其他安全、支付
及注册积分迁移，不能把本轮浏览器通过等同于这些并行变更已具备生产切换条件。

## 生产发布（2026-10-27，已完成）

- 基于当时最新生产注册积分版本 `dpl_DfPrASNLkeLa7cdfhx3YmFvHhbmR` 导出独立源码，
  仅合本聊天归因修复，保留已上线积分规则；未带入其他安全/支付/Agent/邮箱改动，
  不执行数据库迁移。发布副本与完整工作区的差异已明确，未直接部署混合工作区。
- 隔离副本 502 项：487 通过、15 环境依赖跳过、0 失败；lint 0 errors/17 原有
  warnings、设计检查和本地构建通过。Vercel生产构建实际使用平台Production Secret，
  Stripe账户/六个Live Price核验及类型检查通过，云端构建28秒。
- 先创建不切正式域名的生产构建，检查受保护路由、Google唯一provider、匿名billing401、
  Pricing安全UTM承接和无效CSRF/禁止Cookie，再 promote。发布后 smoke:prod 全通过。
- 当前生产 `dpl_ANoBboiVLjHgycLqF8yT6iSafDQe`，READY；根域名与www均确认新版本。
  线上桌面/390px无横向溢出，Video空输入按钮enabled、正式Google tag仅一个；未实际
  提交Google登录/注册、生成或付款。新部署近10分钟未见error/fatal，仅限该观察窗口。
- 发布源摘要 `e434b0c62f5f088a930a5dae7c193e94f564498ecb734d83aae1c3c0fed1a83d`；
  重建补丁/清单/验证/截图保存在 `output/releases/signup-attribution-20261027/`。
  Git仍为cbad973基线，未提交/推送本轮改动；线上源码以该隔离发布包为准。
- 回退基线为上述注册积分部署。真实新账号、跨账号/地区、GA4/Ads注册收件仍须手测；
  不补报历史缺失事件，也不将本次匿名冒烟/标签存在当作实际转化归因验收。
