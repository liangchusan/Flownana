# GA4 六事件实现与验收记录

日期：2026-10-05。正式版本已按用户明确授权发布，测试环境保持独立。
最新状态以本节为准；下方较早的“未部署/未迁移/默认关闭”记录仅为历史验收快照。
本记录不代表 Google Ads 关联或竞价已经完成。

## 正式发布与验收（2026-10-05）

- 正式部署 `dpl_5ReqFC36CmGGfP9zf3BAqexZuA8S` 为 Production READY，已提升并绑定
  `https://www.flownana.com`。从正式变量重新构建，没有直接提升测试产物。
- 测试入口仍为 Preview READY `dpl_CdrS72RGKBgcZZP68TLkBk7iMhzY`，未切换。
- 正式库应用新增分析表迁移 `20261004232658_analytics_reporting`；Prisma 历史 checksum
  与迁移源码一致。两表 RLS/最小权限回读通过；没有复制测试用户、账单或交易，
  没有修改既有 Live Price CHECK。安全 Advisor 对新增表没有提示；现有迁移历史表
  `_prisma_migrations` 有信息级 RLS 无策略提示，不对该内部表增加客户端访问策略。
- Production 使用 `G-2PTWF8DJE2`、开启 GA，独立 Sensitive MP Secret 保留；Test 使用
  `G-RP4MTRCXT0`。正式 GA 后台增强型衡量已关闭并回读，页面由唯一安全来源上报。
- 正式构建回读 Stripe Live 账户与六个 Live Price 通过；正式 Webhook 只读回查为
  `enabled`、`livemode=true`，URL 为 `https://www.flownana.com/api/webhooks/stripe`，
  保留十类账单/订阅事件。没有创建真实付款或改变账单业务数据。
- 隔离 PostgreSQL 全量回归：510 项，508 通过、0 失败、2 个外部真实 Stripe 审计跳过。
  TypeScript、lint quiet、design:check、diff check 通过。正式云端构建与提升后
  `npm run smoke:prod` 通过；页面 200、鉴权/下线接口与 Cron 边界符合断言。
- 正式 `/api/analytics/policy` 返回 200，私有 no-store 缓存与地域/GPC Vary 正确；
  `/api/test-env` 返回 404，生产未暴露测试诊断入口。
- 正式无痕 Chrome 实际允许统计后，`/api/analytics/context` POST 200；实际首页
  `page_view` 与打开套餐的 `pricing_view` 请求均向正式 ID，Google 返回 204。
  载荷只含安全首页 URL/标题、计费周期，广告个性化关闭。204 仅证明传输响应，
  不替代 GA 后台收件。解锁后浏览器控制仍出现旧画面与按钮定位错误，正式实时收件
  及本轮线上撤回暂未完成回读；不能标记为通过。
- 真实新注册、正式付款 `purchase` 与成功生成的同会话后台收件仍需手动验收。
  不向正式 GA 人工补发虚构购买/生成。未关联 Ads、未启用广告主竞价转化。

手动验收：允许统计后刷新并打开 Pricing，在 Flownana 实时查看 page_view/pricing_view；
拒绝/撤回后刷新、换页，不再产生新的 Google collect，请求上下文撤销成功。使用新账号
核对 sign_up；安排批准金额的正式付款并核对 Stripe、权益和唯一 purchase；完成图片/
视频后核对唯一 generation_completed。浏览器插件拦截或拒绝统计会形成采集缺口。

## 早期本地与 Test 完整验收快照

**代码与隔离集成验收通过；完整外部链路验收仍未通过，不能据此上线采集或投放。**
以下区分实际业务事实、Google 网络传输与 GA 后台收件，不把任何一项替代另一项。

| 项目 | 结果 | 证据与剩余边界 |
| --- | --- | --- |
| 环境、页面隐私、旧入口下线 | 通过本地验收 | 正式/Test ID 与域名保护；唯一标签；安全路径和参数；旧业务投递已无发射点；生产未切换 |
| page_view | 本地/真实 SDK/GA 收件通过 | 首屏、刷新、SPA、query 边界正确；实际 Test DebugView 两条页面 |
| pricing_view | 本地/真实 SDK/GA 收件通过 | 两次打开两条；月/年切换零追加；实际 Test DebugView 两条 |
| begin_checkout | 隔离契约/真实 SDK/GA 收件通过，真实结账待验收 | Test DebugView 一条；合法隔离 Checkout 返回对象一次，重复/错误 URL 零；未创建真实 Stripe Session |
| sign_up | 隔离新建事实与 GA 收件通过，真实 OAuth 待验收 | 新建一次、旧登录零、并发去重；Test DebugView/实时已回读一次；OAuth 边界仍替身 |
| purchase | 隔离核验与 GA 收件通过，真实付款对账待验收 | Invoice/Sub/PI 核验、折扣/税/零现金及去重通过；Test 已回读一次；Stripe 对象为替身，没有真实扣款 |
| generation_completed | 隔离业务/持久化与 GA 收件通过，真实 Provider/素材访问待验收 | 图/视频/模板/Agent 八条作品八条报告，重复零追加；Test 已回读一次；未调用真实 Provider/Blob |
| 离线撤回恢复 | 修复后通过 | 实际浏览器断网、刷新、503、重新允许、online 重试；真实 Next API/签名 Cookie 与独立 PostgreSQL 将 pending 改为 revoked；Google SDK 为替身 |
| 同会话联结 | 网络/持久上下文一致通过，GA 报表联结待回读 | 一次真实 SDK 会话下客户端五条请求与三个服务端事实 client/session 全部一致；未以 HTTP 204 替代报表联结 |
| 全量回归与静态检查 | 通过 | 505 项：503 通过、0 失败、2 个真实 Stripe 外部审计跳过；TS、Lint、设计检查、Test 构建通过 |
| 平台/上线准备 | 未执行变更 | Secret 已按环境配置；GA ID/启用开关、共享库迁移、Preview 部署、正式发布和 Ads 关联均未执行 |

本轮实际 GA 后台只读回查：正式/Test 均为美国洛杉矶时区和 USD；正式事件及用户
保留 14 个月；Test 事件 2 个月、用户 14 个月。Test 内部流量过滤器为「测试」，
未启用排除；Google 信号、用户提供的数据收集未启用。没有改动这些设置。

原有正式 Chrome 自建 localhost 测试页已明确取得
`net::ERR_BLOCKED_BY_CLIENT`：被拦截的是 Test Google SDK，标签存在但 SDK 未就绪。
这只解释该浏览器的加载问题；独立 headed Chrome 在重新进入 DebugView 后已实际
看到 11:21 的 page_view 2、pricing_view 2、begin_checkout 1，加上 first_visit/session_start
共七条；保留截图 ga-test-browser-debugview-receipt.png。此前未显示的确切原因未确认，
不能把两种现象归为同一已证实原因。没有禁用用户浏览器保护、绕过自动化识别，
也没有用 MP 补发浏览器事件来伪造通过。

早前已请用户仅对 localhost:3118 临时允许 GA；独立浏览器收件已显示后告知用户
暂时无需改动保护设置。六事件独立收件有证据，同会话网络/上下文一致性通过，
最新完整会话在 GA 报表中的联结尚未回读，保留待验收状态。
Google 官方将浏览器拦截、同意状态与过滤设置列为检查项；DebugView 应看到实际
采集事件，见 [Google 验证与故障排查](https://developers.google.com/analytics/devguides/collection/ga4/troubleshoot)
及 [DebugView 说明](https://support.google.com/analytics/answer/7201382)。

## 已实现范围

| 事件 | 事实与来源 | 已验证边界 |
| --- | --- | --- |
| page_view | 唯一 Google tag，浏览器首屏/刷新/路由 | 初始化迟到仍一次；query 不新增；私人路径泛化，标题/referrer/业务参数清理 |
| sign_up | 后台实际新建账号 | 新建一次，旧登录零次；并发和重试去重，不依据登录态猜测 |
| pricing_view | 实际看见 Pricing 套餐列表 | 每次打开一次；重开新增；月/年切换、重复渲染、隐藏/失败打开不追加 |
| begin_checkout | 后台返回可用 Stripe Checkout 及商品金额 | 点击和失败不报告；金额由 Session 小计减折扣；同一 Checkout 浏览器持久去重 |
| purchase | Webhook/返回页共享 Stripe 再核验入口 | Invoice/Subscription/PaymentIntent 回读，现金/环境/归属核对；Invoice ID 持久去重；折扣后商品美元金额与税分开 |
| generation_completed | 成功终态及输出关联入库 | 普通图片/视频、模板、Agent 共用完成入口；每条作品一次，重复完成/失败零次 |

全部旧业务发射点已在本地停用，包括模板与 Agent；线上尚未切换。
Billing 返回展示沿用已验证的付款信息，但不再从浏览器发送 purchase。
不新增点击、下载、模型、模板选择、登录或失败等细项事件。

正式只允许 `G-2PTWF8DJE2` 和正式域名；本地/Preview 只允许 `G-RP4MTRCXT0`。
没有环境回退。Google signals、广告个性化和广告 consent 保持关闭；后续 Ads
关联、竞价转化与采集策略分别确认，不随本次代码自动启用。

## 同意与投递控制

- `NEXT_PUBLIC_GA_ENABLED=false` 默认关闭。没有新增同意提示 UI，没有假设用户同意。
- 预留 `setAnalyticsConsent`；显式允许、正确环境/域名且启用后才加载标签。
- 撤回时同时设置 `ga-disable-<Measurement ID>`，阻止已加载标签继续发送；存储失败仍拒绝。
- 后台上下文使用真实 tag client/session ID 和签名 HttpOnly Cookie，最长接受 72 小时。
  新注册、Checkout 和生成保留发生时上下文；缺少/过期时记为覆盖缺口，不编造标识或补同意。
  真实 SDK 早期第一次 get 曾返回临时 client_id，与随后首屏请求不同；首次有效读取后
  再用官方 get 确认两个 ID。真实提前读取回归已与首屏请求核对，不解析 Cookie。
- 撤回 API 清理用户/该浏览器的上下文，并撤销尚未投递报告；注销后仍可凭签名 Cookie 撤回。
  修复前离线失败会丢失请求。本轮新增持久撤回标记、初始化/online/60 秒重试；
  只有成功响应且对应当前撤回版本才清除，旧响应不能覆盖新撤回或替用户同意。
  重新允许必须先完成旧撤回。离线期间服务端无法收到撤回；已发请求无法撤销。
- MP Secret 只在服务端；不会写到公共变量、源码或文档。

停用标记按 [Google 官方隐私控制](https://developers.google.com/tag-platform/security/guides/privacy)实现。
真实 Google SDK 已观察撤回后不再发送后续页面请求；离线服务端补偿已通过
浏览器/真实 Next API/独立 PostgreSQL 联合验收，Google SDK 在该故障注入测试中为替身。

## 持久化与失败恢复

新增 `AnalyticsContext`、`AnalyticsReport`，迁移为
`prisma/migrations/20261004232658_analytics_reporting/migration.sql`。
只在临时独立 PostgreSQL 执行；没有修改 Supabase 共享数据库。
两表开启 RLS，拒绝 anon/authenticated/service_role 的 Data API 访问，仅服务端应用角色可用。

真实事实与报告记录同事务落库；并发采用冲突忽略插入，后台 worker 用条件租约领取。
网络投递在 Next.js `after` 中等响应完成后运行，不在业务事务中等待 Google。
已登录的有效上下文同步也可触发待发送报告处理。

Vercel CLI 实际回读当前团队为 Hobby。调度改为每天 UTC 07:00 的补偿 Cron，
不使用会阻止 Hobby 部署的五分钟 Cron，不升级套餐。每天一次限制见
[Vercel 官方说明](https://vercel.com/docs/cron-jobs/usage-and-pricing)；
Cron 只自动触发正式部署，Preview 验收可显式调用受 CRON_SECRET 保护的 worker。

| 状态 | 含义/处理 |
| --- | --- |
| pending | 已存事实，待投递 |
| missing_context | 无有效允许采集的上下文；覆盖缺口，不自动补历史 |
| retry | 明确限流 429，退避后可领取 |
| sending | 有租约的正在发送记录 |
| transmitted | Google 返回 2xx；仅传输确认，不是 GA 收件证明 |
| uncertain | 网络超时、5xx 或 worker 中断；不盲目重发业务事件，先人工核对 |
| expired | 上下文/事件超过 72 小时，不伪造发生时间 |
| invalid | 明确非 429 的 4xx，修正配置/参数后诊断 |
| revoked | 撤回后取消，移除报告上下文，不重发 |

排查先按环境/事件/状态汇总，不输出 Secret 或原始上下文。uncertain 的恢复先
用事实 ID 与 GA/Stripe 核对；确认未收件、授权仍有效且在 72 小时内才考虑将
该条恢复 pending。当前没有面向用户的管理 UI，不能自动批量重发。transaction_id
帮助购买去重，但不承诺跨网络 exactly-once。

## 已运行测试及证据

- 最终全量测试含独立 PostgreSQL：505 项，503 通过，0 失败，2 跳过。
  跳过项为需真实 Stripe Sandbox 的外部审计，未运行真实扣款。
- TypeScript、`npm run lint -- --quiet`、`npm run design:check`、`npm run build` 通过。
  构建使用隔离数据库/Test GA 配置，不是 Production 发布或正式支付配置验收。
- 浏览器实际运行构建产物，桌面 1440×1000、手机 390×844；9 项检查通过，无未捕获异常。
  覆盖未知同意不加载、迟到初始化、刷新、唯一标签、Pricing 周期/重开、query、SPA、撤回和手机展示。
  浏览器的 Google SDK/网络被测试替身替换，因此不是 Google 实际收件。
- 注册/报告并发、签名上下文篡改/过期/资源错误、账号范围、注销后撤回、RLS 权限通过。
- 普通图片/视频、模板四张、Agent 两张实际进入服务/事务，输出关联入库后才产生报告；
  单用户八条成功事实计八条报告，后续会话不覆盖原生成上下文，重复完成不增加。
  没有调用真实模型或 Blob 存储，不代表远程素材访问已经验收。
- 真实 Webhook handler 在验签替身/Stripe 对象故障注入下验证：未验签不报告，
  Stripe 回读失败返回可重试，恢复后不返回网站也产生购买事实；重复通知和返回共享 Invoice 去重。
  独立数据库的现有付款/权益回归通过，外部 Stripe/GA 未据此标为通过。
- worker 并发、响应完成后投递、429 恢复、网络不确定隔离、过期及中断租约通过。

2026-10-05 后续真实连接验证：

- Google strict `/debug/mp/collect` 六事件 HTTP 200、`validationMessages=[]`。
  该接口不校验密钥、不进入报表，不能据此声称 Secret 认证或收件通过。
- 首次真实 SDK 测试发现标签命令使用普通数组，SDK 未处理。已改用
  [Google 官方初始化格式](https://developers.google.com/tag-platform/gtagjs)的 `arguments` 对象。
  相同 SDK 对照结果：普通数组零 client callback/collect，官方格式有 callback/collect。
  新增初始化契约测试后 analytics-policy 7/7 通过，Test build、lint、design:check 再次通过。
- 修复后真实 tag 返回真实 client/session；实际首屏与 SPA 页面、两次 Pricing 打开、
  月年切换不追加曝光、撤回后停止后续请求已观察。请求只去 Test ID，未拦截 Google SDK。
  网络存在 ERR_ABORTED 与 204 响应，不能把全部浏览器请求视为成功收件。
- 实际后台 worker + 独立 PostgreSQL + 真实 Test MP Secret：真实新建用户事实、
  中央成功完成事实、核验入口的隔离 Invoice 各产生一条报告；重复创建/完成/核验不增加。
  三条传输状态均 transmitted、尝试一次。Google OAuth、Stripe 和素材仍为替身，
  没有真实付费或 Provider 调用。
- **GA Test DebugView 实际回读**（约本机 10:45）：`sign_up`、`purchase`、
  `generation_completed` 各一次，总计三条；这是这三个隔离业务事件的实际收件证明。
  购买 payload 商品金额 USD 12、税 USD 2、quantity 1、purchase_type=renewal，
  不将测试 Invoice 当真实扣款。浏览器事件与六事件完整联结验收继续进行。随后实时概览也回读同样三条。
- 真实 Google SDK 下实际客户端 helper 使用隔离 Checkout 返回对象：合法 HTTPS Stripe URL
  发出 begin_checkout 一次，重复与错误 URL 不发；这不是 Stripe 新建真实 Session 验收。
  桌面 headless 与 headed 均观察 page_view 2、pricing_view 2、begin_checkout 1，
  debug 参数为 true、仅 Test ID；月年切换不增加曝光，撤回后后续页面请求零。
  当时 GA 后台暂未显示这三个浏览器事件；后续重新进入 DebugView 已实际核对，
  见本轮结论。未在只得到网络断言时将其判为收件通过。
- 另用完全独立的 Google 官方最小片段作对照，真实 headed Chrome 在 Test 发出
  page_view，Google Golfe2 返回 204，仍暂未显示。此对照没有应用代码、没有模拟 Google
  网络；当时证据不能把收件差异确定为应用错误；后续应用浏览器三事件收件已回读。
  原有登录 Chrome 新开的 localhost 测试页 Google SDK 加载持续未就绪，已清除
  本轮测试同意并关闭自建标签页，保留原 GA 标签页和登录状态。

最终联合验收（11:48 开始）使用一个真实 Google SDK client/session：

- 首屏与 Image 两条 page_view、两次 pricing_view、一次隔离 Checkout helper
  begin_checkout；所有请求仅去 Test，月年切换与重复 Checkout 零追加。
- 实际新建账号、Stripe 回读核验入口和生成持久化完成入口分别产生一个报告；
  三个真实 MP worker 投递各 transmitted 一次，与五条浏览器请求、实际 context
  API 保存的 client/session 完全一致。OAuth、Stripe 对象和 Provider/素材仍为替身。
- 商品 value=12、currency=USD、tax=2、starter_monthly、quantity=1；后台已收件的
  purchase 参数抽屉实际回读 USD/12/税 2。金额是隔离付款对象，未产生真实扣款。
  商品抽屉回读 starter_monthly/quantity=1，price 展示 12000000（发送对象为数值 12）；
  保留 ga-test-purchase-item-debugview.png。普通收入报表尚未核对，不由调试显示
  推断最终商品收入已正确。
- 实际 context API 确认撤回后上下文清空，后续页面无采集。真实 SDK 提前读取
  经过第二次 get 确认后与请求一致；对应初始化/撤回回归共 analytics-policy 9/9。
- 证据：unified-ga-acceptance-confirmed-results.json。最新联合会话在 GA 报表内的
  完整六事件联结尚未实际回读；网络和快照一致不替代归因报表验收。

受控重复运行中有一次真实购买 MP 网络投递失败：持久记录为 uncertain，
errorCode=network_uncertain、attempts=1。安全隔离符合预期，没有自动重发，
该轮联合流程在购买步骤停止；不能宣称所有真实外部投递均通过。
失败证据为 unified-ga-repeat-1-results.json / unified-ga-repeat-summary.json。
需要监控并人工核对，不盲目重试不确定事件。

可重复的核心测试在 `tests/analytics-policy.test.ts` 和 `tests/analytics-reporting.test.ts`。
新增撤回回归包含失败跨刷新、HTTP 503、重新允许等待确认、连续撤回旧响应不清除新标记。
独立数据库测试必须设置 `FLOWNANA_TEST_DATABASE_URL`，未设置会跳过，不能当完整数据库验收。
现有付款/生成回归也使用该隔离变量。不得将其指向正式/共享数据库。

本轮最终日志位于 `/tmp/flownana-ga-full-isolated-tests-final.log`、
`/tmp/flownana-ga-build-final.log`、`/tmp/flownana-ga-tsc-final.log`、
`/tmp/flownana-ga-lint-final.log`、`/tmp/flownana-ga-design-final.log`。
新增浏览器故障证据为 `/tmp/flownana-ga-runtime/chrome-tag-load-diagnostic.json` 和
`offline-withdrawal-browser-results.json`；九项桌面/手机检查再次通过。
浏览器替身结果及桌面/手机截图在 `/tmp/flownana-ga-runtime/`；临时证据可能被系统清理。
早前替身验证结束曾停止临时服务；本轮为真实 Test 收件恢复独立本地数据库与应用，
本轮结束已停止这些服务、关闭自建测试浏览器/标签页，删除临时 Secret 和真实
client/session 上下文文件；Vercel Secret 保留。参数校验、真实浏览器/worker 结果
及 ga-test-realtime-receipt.png、ga-test-debugview-receipt.png 在同一 /tmp 证据目录。
清理前核对独立库 User、AnalyticsContext、AnalyticsReport 均为零，测试标记已移除。

## 后续手动验收顺序

1. 确认正式采集策略；核对正式/测试增强型衡量都关闭不需要的自动业务/历史页面采集。
   正式后台实际回读仍开启；Test 已回读关闭。不能启用新方案后假设页面已无重复/私密网址泄露。
2. 已完成：通过正式 Chrome 连接原有已登录 GA。用户声明已完成披露与最终用户授权，
   并允许点击 Google「我确认」，已在正式/Test 两处确认。创建两份 MP Secret：
   Flownana Production Server 2026-10-05、Flownana Test Server 2026-10-05。
   GA_API_SECRET 以 Secret 类型分别仅写入 Production 和 Preview/Development，
   Vercel env ls 回读范围正确；不将声明或密钥配置当作启用网站采集策略。
3. 已核对 Test 六事件独立收件及同会话网络/快照一致；继续在 GA 报表核对完整会话
   联结、来源/广告归因及四市场数据。HTTP 204 和替身断言不能替代这一项。
4. 新账号/老账号、首屏/刷新/SPA、Pricing 重开/月年、Checkout 失败/成功/重复、
   同意撤回/离线、图片/视频/模板/Agent 分别手测。
5. 真实付款经单独授权再验收：付款后关闭页面、重复通知/返回、折扣/税、零现金、升级/续费。
   Preview 仍保持原结账禁用规则；不能为测试 GA 直接启用共享数据库下的 Sandbox 付款。
6. 共享库迁移与测试部署确认后才能实施；真实收件与 Stripe 对账通过后，再申请生产发布。
   正式 Ads 关联和主竞价转化随后单独设置，Test 不导入正式 Ads。

## 仍需注意

- 原 CUA 连接仍超时，现已通过本机 Chrome WebSocket 操作既有登录 GA。
  两份 MP Secret 已创建并配置，Secret 未输出到聊天、源码或文档；
  平台 GA ID/启用开关未配置，网站默认关闭。Google OAuth 实际注册及 Ads 尚未验收。
- 退款、首购竞价信号、混合多套餐 Invoice、客户余额混合支付和后台长期留存清理不在此次已实现范围；
  GA purchase 不是净收入账本。混合/不明确收款不猜测上报。
- 没有活跃授权会话的续费、超 72 小时任务或付款、旧 profile schema 回退会有覆盖缺口。
- 日补偿是 Hobby 下的恢复保障，闲时限流/中断会增加延迟；pending/uncertain 需监控。
  72h 可回填不保证会话归因：会话归因要求请求在会话开始后 24h 内，且发生时间位于
  原会话期间；与 tag 联结的事件也需关注 48h 处理窗口。见
  [Google MP 用例](https://developers.google.com/analytics/devguides/collection/protocol/ga4/use-cases)与
  [事件发送说明](https://developers.google.com/analytics/devguides/collection/protocol/ga4/sending-events)。
- 新表必须先迁移并核对应用角色，再启用服务端追踪；报告落库是事务依赖，权限/结构异常可能阻断
  对应注册/生成事务。feature 默认关闭时不走新增持久化路径。
- 工作区保留大量本轮之前的未提交改动；本轮未提交、推送或发布，发布批次需再确认范围。


## 后续独立远程测试站验收（2026-10-05）

固定入口 https://flownana-test.vercel.app，READY Preview
`dpl_AKqJrQm2ffyvDmSTf2EXv54ZANz3`。独立 Supabase Test、Blob、Test GA 与
Stripe Sandbox 已配置，正式站未发布。后续状态覆盖前文“未执行 Preview”的历史快照。

- 真实 Google OAuth 登录、新测试账号创建、Stripe Sandbox Starter 年付 USD 96
  付款与返回已完成；Stripe 再核验 paid/Test 后仅发放一次 200 积分。
- 真实 webhook 送达 200；同一 invoice.paid 签名重放返回 duplicate=true，刷新后
  CreditBatch 1 / 200、purchase 报告 1，未重复发权益或追加报告。
- 原 Chrome SDK 未取得上下文；真实 sign_up/purchase 持久状态为 missing_context，
  attempts=0/no_consented_context。购买 value=96、currency=USD；没有发到 GA。
- 独立浏览器从真实远程测试站运行当前部署代码：默认无 Google 标签；显式测试
  允许后只有 Test ID 标签，page_view/pricing_view 实际网络各收到 Google 204。
  Test DebugView 本次回读仍 0，后台收件及真实购买同会话归因保持待验收。
- 测试后撤回成功 200、恢复 denied，Test 用户上下文清空。未新增采集 UI或假设同意。
- Portal 实际 session API 200 并跳转 Test URL，但浏览器空白；实际 Portal 操作待手测。
  未调用真实 AI Provider；Preview Cron 不自动调度。
- 更新后全量回归 507 项，505 通过、0 失败、2 跳过；TS、lint、设计检查与云构建通过。

当前测试部署可用于后续业务与埋点验收；尚不能宣称 Ads 或 GA 完整归因已通过。

## 15:34 地域采集策略与测试站收件验收（最新）

- Preview READY：dpl_CdrS72RGKBgcZZP68TLkBk7iMhzY，固定入口 flownana-test.vercel.app；
  生产仍 dpl_H878BZzhGhujMQJkJKFzTqeh6Yd8，未发布生产/迁移/修改平台变量。
- 地域策略、历史拒绝、GPC、缓存隔离和签名上下文 basis 校验已通过；纯默认
  不写假 granted，拒绝保留；撤回确认前不恢复。完整本地 510/508 pass/2 skip/0 fail，
  TS、Lint、design:check 和云构建通过。
- 线上独立 Chrome 实际 Test SDK 与签名上下文 POST200，页面/套餐曝光请求
  Google204；Test DebugView 本轮确实显示 page_view1、pricing_view1、first_visit1、
  session_start1、non_personalized_ads=1（15:34）。截图
  /tmp/flownana-ga-policy-debugview-receipt.png。
- 线上拒绝后 DELETE200 清除签名 Cookie，刷新零标签；历史 denied 与 GPC
  均零标签。1440×1000 / 390×844 Privacy 设置已截图检查。控制国家 UI 分支
  用接口响应替身，服务端真实国家头拒绝由本地 API/隔离数据库测试验证。
- 用户原已登录 Chrome 当前真实 SDK 请求 ERR_BLOCKED_BY_CLIENT；刷新后标签
  存在但 manager=false，上下文未同步。此浏览器需要对测试站放行 Google 标签；
  没有关闭用户保护，没有把拒绝覆盖为默认同意。
- 没有新付款/升级或真实生成，本轮不能宣称真实购买联结通过。USD96 和 USD200
  的旧购买仍 missing_context，不补报。Ads 关联/主转化、退款对账继续待单独验收。
