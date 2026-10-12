# 2026-10-10 投放前检查

## 后续修复与真实验收进度

以下原始检查是付款前快照；本节为用户批准修复后的更新，优先用于判断当前进度。
Max 年付成本按用户要求暂不处理，不改变价格/积分，也不把该项误报为已解决。

- **本地已修复、未发布**：/image、/video 保留安全广告参数；Terms 与音乐下线、
  年付和积分规则一致；依赖补丁后生产 audit 为 0 critical、0 high、3 moderate。
  余下三项来自同一代理日志依赖链，当前格式化调用未发现用户可控 format；未强升主版本。
- **真实支付通过**：用户自行完成 Starter 月付 $16；Stripe 已收款，Checkout paid，
  active 月付订阅，200 积分只发一次，刷新仍正确；核心 Webhook 投递与处理已对上。
- **真实生成通过**：GPT Image 2 成功一张，扣 2 分，余额 198；PNG 已保存 Blob，
  数据库有单条 output 关联；用户确认前台余额一致、Assets 刷新仍在、下载打开成功。
- **服务端测量通过**：purchase 一条，USD 16、tax 0、starter_monthly、正确发票键；
  generation_completed 一条，均 transmitted/attempts=1；GA4 正式属性实时报告也实见
  begin_checkout、purchase、generation_completed 各 1，purchase 关键事件 1。
- **本地验证**：435 测试中 421 passed、14 skipped、0 failed；Lint 0 errors /
  17 warnings；design:check、构建/类型、diff check 通过，390/1440px 条款页面检查。
  MP3/M4A/WAV/静音视频及 sharp 合法转换通过，畸形 MP4 stsd 边界受限子进程拒绝。
- **仍未验收**：GA 交易参数/金额明细、Google Ads 转化设置/广告用途，
  以及表格中未覆盖的付款不回站、取消、升级、续费等。没有生产发布或开启广告。

## 原始审计快照

结论：基础站点已上线且匿名链路可用；目前不建议开启正式付费获客，也不具备以付费转化自动竞价或放量的验收证据。先处理测量、成本和下述验收缺口，再进行有预算上限的小流量试投。

本轮为检查，不构成改价、修改同意策略、开启广告、真实付款或生产发布授权。没有修改应用逻辑、平台配置或业务数据。检查覆盖产品规范、关键代码、自动测试、正式 HTTP、Vercel、Stripe Live 和依赖公告；不是全仓逐行安全审计、压力测试或全模型真实生成验收。

## 1. 当前证据

| 项目 | 本轮结果 | 能证明的范围 |
| --- | --- | --- |
| 自动测试 | 434 项，420 passed、0 failed、14 skipped | 当前工作区纯逻辑及已运行用例 |
| 类型检查 | `npx --no-install tsc --noEmit` 通过 | 类型一致性 |
| Lint | 0 errors、17 warnings | 静态检查，警告包括图片优化 |
| 设计检查 | `npm run design:check` 通过 | 设计规则静态扫描，不是设备视觉验收 |
| 正式冒烟 | `npm run smoke:prod` 全部通过 | 首页、工作台、历史路由、演示视频、匿名 API 保护、音乐下线、视频 options |
| 其他公开入口 | Contact、Privacy、Terms 200；test-env 404；analytics Cron 匿名 401 | 公开入口及部分保护边界 |
| 登录 Provider | 正式 `/api/auth/providers` 仅 Google | 测试登录未暴露，不证明 OAuth 完整成功 |
| 广告入口 HTTP | `/`、`/image`、`/video` 在 AdsBot UA 下 200 | 本机出口和该 UA 可访问，不证明 Google 真实爬虫或所有目标国家可访问 |
| 域名 | apex→www 后测试 UTM 保留 | 该重定向没有丢失测试参数 |
| 正式部署 | `dpl_AEwcbd6w5qL8aDNuHudMqbZYJK3J` READY / production，绑定正式域名 | 当前 Vercel 回读 |
| Stripe | Flownana Live Webhook enabled，正式回调 URL 和订阅/发票事件齐备 | 配置存在，不证明签名、投递、权益处理已实测 |
| Stripe Live charges | `data=[]`、`has_more=false` | 该账户当前没有可供对账的 Live charge 记录 |

14 个跳过项包含隔离 PostgreSQL 的账单、结账预约、生成终态、分析报告、Agent/模板并发，以及两个真实 Stripe 沙盒专项；不能把本轮称为数据库和支付全量通过。没有为了测试重新开启共用主库测试付款。

本轮未重新 build；未改应用源码，线上 READY 不等于本轮重新构建成功。正式 CLI 部署元数据的 SHA 是 `0163ffd`，项目既有记录说明其上传包含未提交隐私改动；不能把该 SHA 单独当成线上完整源码树。本轮未提交或推送。

## 2. 投放前必须解决或验收的事项

### A. 广告测量用途没有打通

`components/analytics/analytics-events.tsx`、`lib/analytics.ts` 和 `lib/analytics-server.ts:97` 始终发送广告用途 denied；Allow analytics 只允许基础分析。此实现符合当前批准范围，不是应擅自改成 granted 的 Bug。

Google 官方明确说明 `ad_user_data=denied` 会限制基于点击 ID 的转化导出及 GA→Ads 竞价用途；`ad_personalization=denied` 关闭个性化广告。由此不能把“GA 有事件”视为“Ads 已获得可用付费优化信号”。这不是禁止购买任何广告流量，而是目前无法验收预期的付费优化闭环。[Google Consent Mode](https://support.google.com/google-ads/answer/13802165?hl=en)

完成条件：先确认投放市场、广告测量/个性化边界和唯一主转化来源；需要改变产品同意行为时先更新 PRODUCT 并确认，再实现及实际核验 Ads 转化诊断。不能通过强制同意绕过当前用户选择。

### B. 非首页落地参数从上报网址中被移除

`lib/analytics-policy.ts:21` 仅在 `/` 保留 UTM、gclid、gbraid、wbraid。实际执行当前函数：

```text
/?utm_source=google&utm_medium=cpc&utm_campaign=audit
→ https://www.flownana.com/?utm_source=google&utm_medium=cpc&utm_campaign=audit
/image?utm_source=google&utm_medium=cpc&utm_campaign=audit
→ https://www.flownana.com/image
/video?utm_source=google&utm_medium=cpc&utm_campaign=audit
→ https://www.flownana.com/video
```

Google tag config 和 page_view 均使用这个清理结果。因此图片/视频广告直接落地工作台时，手工上报来源参数不完整。这里只证明清理和上报输入有问题，没有以真实 GA 报表证明所有归因必然丢失。首页参数另有 100 字符和字符白名单限制，实际投放模板也需验证。

完成条件：明确批准的公开广告落地路径；保持私有路径和敏感参数过滤，验证允许的营销参数在落地、OAuth、Checkout 和回站后可追踪。不要用未验收的 `/image`、`/video` 直接开始归因试验。

### C. 尚无真实付款、交付、GA 与 Ads 对账闭环

本轮 Live charges 为空；当前只能证明 Webhook 配置，不能证明支付后套餐/积分正确到账、付款不回站仍完成处理、重复通知去重，以及 purchase 被 GA/Ads 接收。代码已有服务端付款回读、账户绑定和持久去重，不能代替真实验收。

当前 purchase 包含 new_subscription、upgrade、renewal；`lib/analytics-purchase.ts:44` 不计算账号历史首次付费。重新订阅也可能是 new_subscription。因此不能将全部 purchase 或 new_subscription 自动解释为新增付费客户数；如果投放目标是新客首购，必须单独确定计数及筛选方式。六事件本身无需为了追求事件数量而扩张。

完成条件：经单独授权的真实首购→Stripe 账单→积分/套餐→图片生成与下载→GA 唯一交易→Ads 目标动作。至少覆盖取消付款、付款不回站、刷新返回不重复和拒绝统计仍可购买/生成。续费和升级不能混入首购 CAC。

### D. Max 年付存在高使用量亏损情景

代码：`lib/plans.ts:40` 为 $576/年、每月 2,400 积分；全年 28,800 积分，充分使用时收入为 **$0.02/平台积分**。`lib/generation-pricing.ts:25` 的常规 KIE 视频换算系数为 0.2。

本轮 KIE 官方价格页的多个积分/美元价格对照均对应 $0.005/KIE 积分；按这一标准成本和代码换算，视频生成成本约 **$0.025/平台积分**（具体任务有取整差异）。[KIE 价格页](https://kie.ai/pricing)

因此，在全年每月积分充分消耗于这类视频、无额外上游充值折扣的情景下：收入 $576，供应商成本约 $720，差额 **-$144/年**，尚未算支付费、存储、Agent 理解和广告费。这里只是代码与标准成本的压力情景，不是已发生亏损，也没有核验账户实际充值优惠和每个当前模型的供应商账单。

完成条件：核对上游实际成本、各套餐的模型组合和使用率，确定贡献毛利、最大 CAC、回本期限和止损预算。不能只按年付一次收款金额计算可承受广告费，也不能默认用户不会用满。改价或积分规则另行产品确认。

### E. 依赖告警需要适用性核查

`npm audit --omit=dev --json` 返回 13 个包条目：1 critical、7 high、5 moderate，存在传递依赖重复关联；不是 13 个已确认可利用漏洞。结果保留 `/tmp/flownana-ad-readiness-dependencies.json`。

Next 16.3.3 命中 next/og ImageResponse 公告，但本轮搜索 app/lib/components 没有发现 `next/og` 或 `ImageResponse` 调用；不能报告当前网站存在已证实 RCE。[公告及适用前提](https://github.com/advisories/GHSA-vcvr-r3jv-pc5j)

`music-metadata` 有解析 DoS 公告，且 `lib/media-duration.ts:36` 确实对音频调用 parseBuffer；服务端有登录、归属、格式与大小约束，具体受影响格式是否可达及补丁需进一步验证。没有向正式站发送恶意样本。[EBML 公告](https://github.com/advisories/GHSA-5gfj-9q3v-qfp3)

完成条件：逐项给出受影响/不适用证据，对可达高风险依赖完成修复回归；不执行未经核对的 audit fix 或仅靠严重度决定产品已被攻破。

## 3. 其他风险与运营缺口

- **登录错误**：Vercel 聚合返回 2 次 OAUTH_CALLBACK_ERROR / State cookie was missing，最后显示 10 月 5 日旧部署；另有 url.parse 弃用警告。该聚合 firstSeen 跨更长历史，不能从它计算最近七日登录失败率。最近 30 分钟 error/fatal 分组为空，也不能证明真实用户登录稳定。新旧账号、手机 Safari/Chrome、www/apex 和返回流程需实测。
- **历史日志不足**：七日明细日志请求被平台以 Hobby 保留期限制拒绝。团队基本信息未返回 billing plan；需在账单页核实当前套餐。若正式商业服务确实使用 Hobby，须按平台商用要求处理，不能只依赖免费额度。没有自行升级。[Vercel 官方商用限制](https://vercel.com/docs/limits/fair-use-guidelines)
- **分析恢复能力**：正常请求使用 after 投递，Cron 每日一次、默认每轮取 20 条；大量 retry 积压无法靠一天 20 条及时排空，72 小时上下文/事件过期后会停止补发。uncertain 隔离是为了防重，不是自动恢复成功。需监控 pending/retry/uncertain/missing_context/expired、业务成交与可测量成交差异；本轮未读取主库队列。
- **公开承诺**：正式 Terms 仍声称提供 music/audio 生成，音乐 API 实际 410。Terms 的支付段落未清楚说明取消、续费、现金退款和积分到期；Pricing 源码有年付总额和按月发积分，但不能据此认定所有政策已对消费者清晰披露。应核对实际收银台与公开政策，文案不得擅自改变既有权益。此处不是法律合规结论。
- **支持**：Contact 邮箱入口存在，但未验证邮箱投递与工单响应；没有发邮件。付费流量需要明确付款/生成故障的处理人和停投条件。
- **页面与性能**：robots.txt 404 本身不等于禁止广告爬取；HTTP 200 不等于桌面/手机交互、CWV 或目标市场网络通过。浏览器工具多次超时，后续 Chrome 状态发生用户切换，本轮没有完成 UI 或 GA/Ads 控制台验收。
- **生产与代码版本**：工作区含既有已发布未提交修改；后续部署需固定完整版本，避免用旧 Git commit 覆盖现行隐私交互。报告新增没有触发部署。
- **转化设置未知**：未回读 Google Ads 账户资格、广告主验证/账单状态、GA 关联、自动标记、Primary/Secondary、计数、归因窗、自引荐排除和实际收件；均为未知，不是已配置失败。GA Task Assistant 和增强衡量关闭不应被独立视为投放阻塞。

## 4. 进入小预算试投的验收表

| 场景 | 通过证据 |
| --- | --- |
| 公开广告落地桌面/手机 | 首屏价值和 CTA 清楚；Privacy 不遮挡；Pricing 可首次打开、关闭重开，月/年总额准确 |
| 新旧 Google 账号 | 新用户注册一次、老用户不重复注册；回原页面及选中套餐正确，无 state-cookie 错误 |
| 首购 | 明确预算授权后真实支付；Live 收款、Webhook、套餐与积分、GA transaction_id 和金额逐笔相符 |
| 取消/刷新/未回站 | 未付款不报购买；取消回正确页面；重复返回不重复发积分或报告；未回站仍处理 |
| 图片交付 | 主投模型至少一次实际生成、Blob 持久化、刷新仍在 Assets、下载可打开；generation_completed 一次 |
| 视频广告 | 只有主投视频真实生成、成本与下载验证后，才扩大到视频诉求 |
| 失败与退款 | 在隔离环境验证失败/超时/存储失败退款；正式业务核对可追查，不为验收故意破坏生产 |
| 同意与撤回 | 允许、拒绝、刷新、撤回、GPC；拒绝不影响核心产品；广告用途与批准选择一致 |
| 归因与竞价 | 落地→OAuth→Stripe→返回不被自引荐替代；Ads 关联与唯一主目标有回读证据，测试交易不作为经营成功样本 |
| 成本与运营 | 各套餐贡献毛利、预算上限、最大 CAC/回本期、Provider 余额/配额、故障监控与停投负责人明确 |

先完成以上门槛，再以单一主诉求和受控预算验证真实转化。没有实际流量样本前，不承诺 CAC、转化率或盈利，也不以注册/页面访问替代付款效果。

## 5. 本轮日志

测试 `/tmp/flownana-ad-readiness-test.log`；Lint `/tmp/flownana-ad-readiness-lint.log`；类型 `/tmp/flownana-ad-readiness-types.log`；冒烟 `/tmp/flownana-ad-readiness-smoke.log`；依赖 `/tmp/flownana-ad-readiness-dependencies.json`。临时目录不是长期归档；核心结果已记录在本报告。
