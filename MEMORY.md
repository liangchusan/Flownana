# Flownana 工程记忆

更新：2026-11-06。本文只维护当前实现、部署、未发布工作和风险。
产品及验收以 [PRODUCT](./docs/PRODUCT.md) 为准，UI 以 [DESIGN](./docs/DESIGN.md) 为准；
目录地图见 [README](./README.md)，历史查阅见 [文档导航](./docs/README.md#历史资料)。

## 模型升级（2026-11-06，已批准生产发布、发布中）

- 用户批准开发 GPT Image 2.6 替换 2.5 及 Kling 4.0 首版，并明确要求 2.6 沿用
  2.5 每张 1K/2K/4K：2/3/5 积分。PRODUCT 6.4/7.3、结构化合同及
  [本轮验收记录](./docs/KIE-MODEL-UPGRADE-2026-11-06.md)已同步。
- 本地在售为 4 图片/6 视频：两版 2.6 取代 2.5，Kling 4.0 在视频列表末尾。
  直接图片默认 Nano Banana 2.1 保持，Agent 默认 2.6 Flare；套餐、数据库及 GA4 不变。
  2.6 使用含斜线的四个独立 Provider ID、最多16参考图、PNG；2.5 禁止新生成/报价，
  历史元数据与已受理任务保留，旧草稿/Reprompt/报价必须重选并重新确认。
- 2.6 四模式已通过模型页内嵌 API Reference 补齐合同证据；三个直接 docs/.md
  曾404。实时模型页与 Pricing 均为 Token 计费，搜索旧固定价格不能当作当前成本。
  用户固定价格不事后追扣，实际 Token 成本与毛利仍需真实账单核对。
- Kling 接入 reference-to-video：文字、普通图片/视频参考、720P/1080P、3–30秒。
  10图/5视频、10MB/文件、MP4、视频每段2–30秒且合计≤30秒；关键帧、主体、声音克隆
  未接入。有视频时成本按 D+max(V,D)，重新读取真实时长后比价，非法引用/过期报价
  扣费前拒绝。普通 Composer 与 Agent 报价显示素材编号，不把普通图暗中当首尾帧。
- Agent/内部模板默认改为新模型，已停用模板 HTTP 接口保持停用；Worker 优先解析
  已保存的模型，保证旧2.5接受过的输出不因默认值改变而换到2.6。
  长模型菜单重开时只滚动列表以显示选中模型，保留页面、参数与附件状态。
- 实际验证：全量524项，507通过/17环境依赖跳过/0失败；最终相关14项回归通过。
  tsc、生产build、design:check通过；lint 0错误/15既有警告。
  本地实际视频目录返回六模型和56个Kling规格；图片/视频匿名POST均401。
- 内置浏览器检查390/768/1440px的普通创作与Agent相关入口、菜单重开/刷新、
  2.6报价、Kling参数及编号。Agent使用只读本地模拟账号/会话，调用实际buildQuote，
  验证旧2.5按钮禁用、改选2.6后重报价；不是生产账号/真实Provider验收。
  本地服务器显式隔离业务库并清空Provider Key，未写真实账号数据、生成或收费。
- 用户已明确授权本轮提交、推送及生产部署。发布前源码与已验证快照一致；
  目标为现有 Flownana 项目的 main 自动 Production 发布，无数据库迁移。
  本轮源码文档、截图、日志与模拟代理位于忽略目录 `output/model-integration-20261106/`，
  不随Git克隆恢复；发布结果与冒烟证据将记录到 `output/releases/model-upgrade-20261106/manifest.json`。
  尚需真实生成、账单/Token/毛利、输出尺寸/时长/音轨、失败退款、旧任务、真实上传/Assets
  和真机验收；真实付费测试预算仍需另行授权；生产发布已获授权。

## 当前生产与源码

- 用户已明确批准全部本地改动发布，包含目录整理、邮箱连接器删除、安全整改、
  Agent 限额及支付历史迁移；2026-11-04 已完成上线，随后又明确批准精简后的版本发布。
- 正式站 https://www.flownana.com 使用 GitHub main 自动构建发布，目标 Production / Next.js。
  源码与发布记录推送都会触发新构建；最终部署 ID、commit、构建及根域/www 回读结果
  统一保存到 `output/releases/cleanup-release-20261104/manifest.json`，不将旧暂存 ID 当作实时状态。
- 本次清理源码提交 `1b87309`；人工暂存验收产物 `dpl_E5FHif12TtzMykcSAU31sZCxYEVy`
  的 387 项上传源文件与独立快照逐项 SHA1 一致，构建约 28 秒；编译、TypeScript、
  正式 Stripe 商户和六个 Live Price 校验通过。后续发布记录提交只更新本文。
  与上一正式部署 BF3 的业务代码完全一致，差异仅文档与清理记录，无新数据库操作。
  之前全量业务发布源码为 `db5affe`，记录为 `cf38722`；本地仅 main。
- GitHub 此前 push 500 / 对象 API 502 故障已恢复；本轮普通快进推送成功，
  已将 cbad973 之后积压的提交及本次清理提交 1b87309 同步至远端 main，未强推。
- 本次先暂存 Production 构建，核对源文件及首页 200、账单接口应用层 401 后提升。
  暂存版本上线 smoke:prod 全部通过、短窗口 error/fatal 聚合无记录。GitHub 恢复同步后
  自动发布清理提交及后续记录；保留最新 main 自动构建，并在记录同步后核验该最终版本。
  自动审批拒绝回切旧暂存版本，未执行回退。最终冒烟与日志结果见上述 manifest。
  日志外送接口仍 404，配置未核实；未重跑浏览器或真实收费链路，临时源码目录已清理。
- 上一全量发布的 `output/releases/full-local-release-20261104/` 保留校验清单、
  迁移/测试/构建记录及经验证的增量 Git bundle（从 cbad973 至本次发布记录提交）。
  注册赠送、注册归因和登录弹窗三个旧发布目录中的补丁仍保留，用于重建回滚版本。
  这些目录被 Git/部署忽略，不随克隆恢复，也不等于远端备份。
- 本次回滚使用上一全量正式部署 `dpl_BF3hnpsF5r7jnJSUuzYcsKPR9c9e`。
  更早的隔离登录版本为 `dpl_DQtqt3re751bXRuF5hY2PnbX21aD`；不要回滚到临时维护部署
  `dpl_CcWdZqeVBEDkymiVxFp9XPzNHbAo`。新增表兼容旧代码，不通过删表回滚。

## 当前实现与边界

- Next.js 16 App Router、React 19、TypeScript、Tailwind、NextAuth v4、Prisma 5、
  Supabase、Stripe、Vercel Blob；版本以 package.json / 锁文件为准。
- `/` 为 Home，`/image`、`/video`、`/assets` 共用工作台；`/generate` 恢复模式；
  `/pricing` 跳转首页弹窗。旧 `/home`、`/ai-*` 为 404。音乐仅保留历史音频管理。
- 根 SessionProvider 唯一。公共登录入口先开站内品牌弹窗，Google 按钮才有界准备
  统计上下文并同页 OAuth；手机不挂载装饰图。取消保留草稿，登录成功不自动生成/付款。
  独立 Google popup 已撤回。登录入口验收见 [登录 QA](./docs/design/login-dialog-qa-20261102.md)。
- 注册赠送仅符合七地区及可信 IP 等资格的新账号：10 积分、同 IP 72 小时防重、
  30 天到期；不补发历史账号。2026-10-27 已上线，资格以 PRODUCT/服务端实现为准。
- 归因遵守 Reject/GPC/撤回/地区核验，六个核心 GA4 事件含义保留；失败继续登录，
  不补造历史来源。匿名撤回使用随机服务端浏览器凭证，不以 GA client ID 授权删除。
- 创作、付款、上传、私有草稿与缓存按账号 id + 注册时间隔离，操作携带预期账号。
  登录恢复/Allow 均校验账号版本。不确定请求不直接判失败，不自动重建上游任务。
- 已发布基线仍为 4 个图片、5 个视频模型；本地升级为 4/6（见上节）。
  退役模型保留历史兼容。共享模块定义能力与计价，
  [KIE 合同快照](./docs/KIE-MODEL-CONTRACTS.json)也是测试输入。
- 安全整改已发布：媒体解码/MP4/WAV 工作预算、共享检查租约、头像/上传预约及清理、
  许可/草稿账号绑定。原安全扫描为 failed/partial，不能宣称完整扫描通过。
- Agent 每日尝试上限免费 30 / 付费 300，完整回复仍 10/100，每分钟 6 次。
  成功/失败/停止均计尝试，幂等重放不重复计；UTC 跨日重置，删除会话不返还尝试。
- 私有邮箱连接器已按用户要求完全删除，不恢复或继续连接；网站 support 邮箱、DNS
  与 Contact 链接不受影响。

## 数据库与支付切换（2026-11-04 完成）

- 正式库 Supabase `kbpmirqktzxlpkfeuhtn`：当时 ACTIVE_HEALTHY / PostgreSQL 17.6。
  应用使用最小权限 flownana_app，Data API 关闭；重新启用前复核 RLS、权限及默认 ACL。
- 17:36（北京时间）确认暂停旧 Checkout/升级新建及月积分调度，等待超过 300 秒旧函数
  上限并核对无切换前应用事务；Webhook 处理与重试保留。
- 新建 CheckoutHistoryMigration / LegacyCheckout，启用 RLS，仅 flownana_app 有 DML
  及 Policy；anon/authenticated/service_role 无表权限。登记 20261024090000 迁移，
  核对既有 Live Price 约束并补齐 20261002231000 台账；未改价格、订阅或积分记录。
- 冻结边界 `2026-11-04T09:41:44.711Z`，完成 `09:42:45.565Z`；只读扫描 Live Stripe，
  在事务/游标锁中导入 3 条旧 Checkout，3 条账号版本匹配，唯一已付款项已有积分凭证。
  未发起付款、补发积分或补造归因。完整应用在导入完成后提升，购买/升级已恢复。
- 操作与验收见 [切换手册](./docs/operations/CHECKOUT-HISTORY-CUTOVER.md)。
  全部 18 个 Prisma 迁移必须保留，旧迁移仍是重建数据库的依据。

## 已完成验证

- 发布前隔离 PostgreSQL 17.11 完整重放 18 个迁移；623 项测试：621 通过、
  2 项真实 Stripe 环境跳过、0 失败。四份旧夹具按当前模型、价格和撤回凭证修正，
  不降低生产约束。外部收费调用均使用替身；临时 PostgreSQL 已停止并清理。
- 类型、build、design:check 通过；lint 0 错误 / 15 既有警告。上线 smoke:prod 通过。
- 正式浏览器 1440px 首页/登录、390px 登录/Pricing 正常，关闭重开通过，无横向溢出，
  桌面插画已加载、手机装饰图 DOM 为 0。未完成真实 OAuth、生成或支付。
- 发布时最近 10 分钟 error/fatal 聚合无记录，仅代表该短窗口；日志外送接口 404，
  未核实配置。安全 advisor 仅原 _prisma_migrations 无 Policy 的信息项。

## 本地精简（2026-11-04，整理后的源码已发布）

- 再次检查全部受版本管理文件、源码 import/动态引用、依赖、资源、文档及忽略目录；
  没有发现新的独立无引用源码模块，public 无完全重复文件。
- 删除 .next、TypeScript 增量文件、依赖缓存及已从锁文件移除的 framer-motion / motion-dom /
  motion-utils 安装残留；当前必需依赖保留，锁文件与业务代码未改。
- 删除 13 份旧文档/预览/流水账副本，历史保留于 Git 提交 35087da。
  archive 仅留 PRODUCT / DESIGN 仍引用的六份授权、合同与设计依据。
- 删除旧诊断脚本、重复及过期截图、未选设计稿、被完整发布替代的整理发布目录、
  已被 bundle 覆盖的重复 workspace.patch、Finder 杂项。
  保留选定登录参考稿、必要 QA 截图及发布恢复材料，同步导航、QA 引用与本文。
- 清理本轮已停止的临时测试库、二进制、包缓存、隔离发布/维护/重建目录和重复日志。
  项目内删除约 663 MiB，任务临时目录删除约 1.30 GiB，共约 1.94 GiB（按文件字节累计）。
- .env*、.vercel、数据库迁移、真实运行资源及历史兼容保留；不改产品、UI、埋点或平台配置。
  清缓存后 npm run dev 会重建；npm run start 前须先 npm run build。
- 本轮实际验证：517 项测试，500 通过 / 17 环境依赖跳过 / 0 失败；lint 0 错误 /
  15 既有警告，design:check、文档链接和 diff 检查通过。373 个业务、配置、测试与资源
  文件逐字节未变，Git bundle 验证通过。整理阶段未重建本地 build 或重跑浏览器；
  后续正式云端构建和发布验证见首节，本机 .next 未重新生成。

## 剩余风险与手动验收

- 完整 Google 回调、Pricing 套餐恢复、换号隔离、真实新注册赠送、GA4/Ads 收件与真机
  仍需人工验收；历史浏览器替身/视口检查不替代真实链路。
- 真实 Stripe/Webhook/年度 Cron、Blob 故障并发、Provider 输出/扣费/失败退款及历史任务
  生产结算尚有外部验收缺口；MP4 时长与实际计费差异待真实证据。
- 支付、Blob、数据库不构成单一事务；旧孤儿 Blob、丢失的扣费快照与历史来源不能自动重建。
  上游已受理但响应丢失时仍可能产生成本。
- 2026-11-04 核对 flownana-test 为 INACTIVE，未恢复测试项目。本地测试只用隔离临时库，
  缺少 FLOWNANA_TEST_DATABASE_URL 时专项明确跳过，不用默认业务库替代。
- 真实凭据只存获批准的 .env* / 平台变量，不写入代码或文档；早期 Git 旧凭据已轮换/撤销。
  GitHub 同步已恢复；临时日志和本机忽略目录不能作为远端备份。
