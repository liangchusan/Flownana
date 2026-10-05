# Flownana 工程记忆

## 2026-10-05 地域基础统计已部署测试站（覆盖此前默认关闭状态）

- 用户确认按地域基础采集策略行动。已先同步 PRODUCT 和 DESIGN：US/JP/TW 默认
  基础统计，其他/未知地区先询问；历史拒绝和 GPC 优先，广告授权三项继续 denied。
- 新无缓存 /api/analytics/policy 读取 Vercel 国家头；全站 Privacy 入口复用 Modal，
  同等 Allow/Reject，并支持原有持久撤回重试。初始地域尚未返回时不加载标签。
- 上下文 JSON 新增可选 collectionBasis，不新增数据库字段或迁移。服务端对
  regional_default 校验允许地域，对 GPC 拒绝新上下文；撤回仍能读取被 GPC
  禁用的旧签名以清除后台记录。不补发历史 missing_context，不改业务事实/金额。
- 实际隔离本地 PostgreSQL 测试 510 项：508 通过、0 失败、2 个外部审计跳过；
  tsc、lint --quiet、design:check 与 Preview 云构建通过。固定测试入口已指向
  READY dpl_CdrS72RGKBgcZZP68TLkBk7iMhzY /
  flownana-59xo0w655-liangchusans-projects.vercel.app。生产仍为
  dpl_H878BZzhGhujMQJkJKFzTqeh6Yd8；没有生产发布、环境变量变更、DDL、提交/推送。
  deployment files 仅 .env.example，没有真实 .env 文件。
- 实际线上独立 Chrome 验收：地域接口 private/no-store；历史拒绝与刷新零标签；
  GPC 即便旧 granted 仍零标签且 Allow 禁用；允许后唯一 Test SDK、真实会话及
  HttpOnly 签名上下文 POST 200；page_view/pricing_view 发 Google 各 204；撤回
  DELETE 200、签名 Cookie 清除且刷新零标签。桌面 1440×1000、手机 390×844 的
  Privacy 设置已截图检查。控制地域分支另用响应替身验证默认开启不伪写 granted、
  先询问分支零标签；服务端地域拒绝在本地真实 API/PG 测试验证。
- Test DebugView 在 15:34 实际显示 page_view 1、pricing_view 1、first_visit 1、
  session_start 1，non_personalized_ads=1；保留本轮收件截图。不再只用 204 推断收件。
  Test 内部流量过滤器回读为测试状态，未改 GA 过滤/广告配置。
- 用户原已登录 Chrome 刷新后有 Privacy 与 granted，但真实监听 SDK 请求明确
  net::ERR_BLOCKED_BY_CLIENT、google_tag_manager=false、上下文 POST=0；当前 Test
  用户上下文仍 0。已告知仅对测试站放行 Google 标签后再验收新业务，未改浏览器
  保护、未重付或升级套餐。旧 USD96/200 purchase 保持 missing_context，未补报。
- 线上初次验收遇到 networkidle 等待保护握手与页面延迟、曝光等待不足；调整
  验收为 DOM 就绪/实际可见/SDK 就绪后通过，没有据这些等待失败修改业务语义。
  本轮没有执行新付款/真实生成；购买同会话完整收件、退款与 Ads 竞价仍待单独验收。


## 2026-10-05 默认统计策略讨论与测试授权

- 用户提出默认同意。已核对 Google EU UCP（EEA/英国/瑞士）、加州 CCPA、
  日本 PPC Cookie/第三方数据 Q&A、韩国 PIPC 行为信息政策、台湾个资法；
  不能将“不面向欧盟”或“不显示弹窗”当全球合法同意。PRODUCT 记录默认开启
  基础统计的调整方向与待确认地域/拒绝入口/广告用途边界；没有全站改默认。
- 按本次用户授权，仅当前 flownana-test.vercel.app 测试浏览器 localStorage
  改为 granted，pending=false，触发既有事件并取消 Test ga-disable。
  实际出现唯一 G-RP4MTRCXT0 标签、gtag=function，但 google_tag_manager 尚未
  就绪，无本轮真实收件证明。浏览器 API 没有给出明确的加载失败错误，不能
  将早前 ERR_BLOCKED_BY_CLIENT 直接当本轮已确认原因。后续继续定位 SDK。
- 未覆盖其他访客的旧拒绝，没有补报历史付款、修改广告授权、部署代码或
  更改生产站。当前测试浏览器允许保留供用户测试；正式政策未发布。

## 2026-10-05 测试站升级未进入 GA 的只读诊断

- 用户反馈测试站升级后 GA Test 实时仍为零。实际回读 Test 库：13:42:31
  （Asia/Shanghai）的 USD 200 upgrade purchase 已持久化，但 status=missing_context、
  attempts=0、errorCode=no_consented_context、context=null、transmittedAt=null。
  早前 USD 96 首购也为 missing_context；不是已发送后的报表延迟。
- 用户当前 Test /image 标签页实际 localStorage consent=denied、pending=false，
  无 Google tag、gtag 未定义；符合既定默认不采集策略。上轮验收撤回后保持
  denied，网站尚无允许统计入口，所以直接升级不会取得 GA 会话。
- 已向用户请求仅当前测试浏览器临时允许以验证页面/套餐曝光；正式策略仍待
  确认，没有擅自开启或补发历史报告，无代码、部署或数据库写入变更。
  已说明测试无需再次付款；后续需先证明 SDK 与后台上下文正常，再验收新业务。

## 2026-10-05 独立测试站已部署（覆盖此前只读状态）

- 用户批准测试站、GA 和测试支付，选择现有 Free 组织；实际 $0/月报价确认后
  建立 flownana-test / heaahlpqqfehojzvozhr（东京、ACTIVE_HEALTHY）。没有复制
  正式数据或升级套餐。仅新测试库初始化全部 15 项 Prisma 迁移与校验和；
  RLS、Data API 撤权和 flownana_app 最小权限保留，应用角色仅有运行所需权限。
  Preview DATABASE_URL/DIRECT_URL 都使用测试应用角色；后续 DDL 继续经授权
  Supabase 迁移执行，不能直接用 Preview DIRECT_URL 当管理员迁移连接。
- 固定入口 https://flownana-test.vercel.app 已绑定本次 READY Preview：
  dpl_AKqJrQm2ffyvDmSTf2EXv54ZANz3 /
  flownana-41h7p4rwd-liangchusans-projects.vercel.app。生产仍为
  dpl_H878BZzhGhujMQJkJKFzTqeh6Yd8，正式三域名均未切换；Production 环境变量
  ID/值/类型全部前后回读一致。没有生产部署、正式库迁移、提交或推送。
- 专用 Blob flownana-test-media / store_7bTCQFi1TafI9fvg（hnd1）仅连 Preview；
  原 Blob 与 NEXTAUTH_SECRET 的 Production/Development 原值保留。
  Preview 使用新 DB、NEXTAUTH_SECRET、CRON_SECRET、Webhook Secret；GA Test
  ID G-RP4MTRCXT0 和现有 Test MP Secret、六个既有 Test Price。免登录测试账号关闭。
  Development 本次没有改成新测试库，不能误认为 Development 已同步隔离。
- Preview 支付显式 opt-in，并校验 Test 密钥、独立 DB ref 与连接；拒绝正式库、
  Live 事件、伪造 pooler/host。测试库两项价格 CHECK 只允许六个 Sandbox Price；
  正式迁移文件及正式库的 Live 允许列表不改。新沙盒 Webhook
  we_1UN41xRqa49126u8ZWrq9LmT 仅指向固定测试入口；保留 Vercel 保护，Webhook
  通过平台已有自动化 bypass 接收（真实值仅存平台变量/endpoint，不记录在文档）。
- 共享 Google OAuth 客户端只新增测试 callback，三项原 redirect URI 和 origin
  不变；真实 Google 登录完成，在独立 Test 库创建账号。真实 Stripe Sandbox
  Starter 年付 USD 96 用官方测试卡支付，session/Invoice 均 livemode=false、paid，
  返回 Billing 为 active、余额 200、下一次发积分 2026-11-05。没有真实扣款。
  Stripe 实际 Webhook POST 200；重放同一真实 invoice.paid 的签名 payload 返回
  duplicate=true，刷新 Billing 后 CreditBatch 仍 1/200、purchase 报告仍 1。
- Portal API 实际 200 并跳到 Stripe Test Portal，当前浏览器页面空白；只证明
  session 创建，Portal 页面操作/取消订阅仍待手测，未宣称端到端通过。
- GA 功能开关在 Preview 为 true，但访客默认拒绝，无同意 UI。真实付款时原
  Chrome 未拿到 SDK 会话：sign_up/purchase 各一条 missing_context，attempts=0，
  no_consented_context；购买参数为 96/USD。没有编造归因或补发无授权事实。
  独立浏览器真实测试站验收：默认 0 标签，显式允许后仅 1 个 Test 标签；
  page_view/pricing_view 各实际请求 Google 并收到 204。Test DebugView 本轮回读
  仍为 0，不能把传输当后台收件；真实购买同会话归因尚未验收。验收后撤回 200，
  测试用户 context=0，原浏览器临时允许已恢复 denied。正式采集策略仍待确认。
- Preview Cron 不自动调度；GA 失败补偿与年付月积分补偿需手动验收/触发，不能
  把测试站日常定时任务视为运行。没有调用付费 AI Provider 或上传真实素材；
  测试积分与 DB 隔离不等于生成供应商免费，生成链路仍待单独授权验收。
- 首次 Preview 意外打包旧 .env/.env.production，发现后添加 .vercelignore 排除
  全部真实 .env*，重新部署；最终 deployment files 回读没有 .env 文件。
  首次部署 dpl_8j8uKqMzG5thHmhHpobVe9qL19e3 已删除，无可访问旧产物。
- 回归实际 507 项：505 通过、0 失败、2 个外部审计跳过；TS、lint --quiet、
  design:check 与云构建通过。已检查测试套餐桌面 1440px / 手机 390px 显示。
  当前部署来自批准的工作区快照（含此前本地改动），不是已提交 Git commit。
  详细测试环境信息与后续操作见 docs/TEST-ENVIRONMENT.md。
- 验收收尾：删除本轮临时数据库口令、平台变量导出、Webhook Secret 与付款对象
  的私有副本，停止本地临时 PostgreSQL；平台所需配置保留。测试站 Billing 页
  保留给用户，测试账号、沙盒订阅与 200 积分保留用于后续测试。

## 2026-10-05 Supabase 测试库费用只读核对

- 实际 list_organizations / list_projects / get_organization 回读：当前可见组织
  liangchusan's Org 为 Free（tier_free），只有一个 ACTIVE_HEALTHY 项目，即现有
  kbpmirqktzxlpkfeuhtn，区域东京。没有创建项目、分支、迁移或变更套餐。
- 官方当前规则：账号作为 Owner/Admin 的所有组织合计最多两个活跃免费项目，
  每个免费项目数据库 500 MB，闲置一周可暂停。当前可见配置适合优先申请第二个
  独立 Free 项目作为测试库；创建前仍需按实际创建报价/额度确认，不把旧分支
  付费报价等同所有独立测试项目均收费。没有对付费资源创建授权。
- 测试项目只初始化必要结构与测试数据，不复制正式用户、账单、订阅或积分；
  网站 Preview 必须显式绑定新测试连接。当前仍未建立该远程测试数据库。

## 2026-10-05 Vercel 测试环境现状只读核对

- 当前团队项目列表只有 flownana；正式入口为 https://www.flownana.com，
  没有单独的 flownana-test 项目。本次六事件方案没有执行 Vercel 部署。
- 现有 flownana 项目有历史 Preview 部署：
  flownana-csn3dbt0y-liangchusans-projects.vercel.app，经 inspect 确认 target=preview、
  readyState=READY。它不是本次 GA 代码的部署，不能视为已配置完整隔离测试站；
  本轮未核对该历史部署的数据库隔离或业务可用性。
- GA 的 Flownana Test 与填入的数据流网址不创建 Vercel 网站。后续可使用同项目
  Preview 建立测试部署，但数据库/外部服务需单独隔离；本轮仅查看，没有创建
  项目、部署、域名、环境变量或数据库迁移。

## 2026-10-05 GA 完整验收结果（本地通过，真实业务上线待验收）

- 本轮发现并修复离线撤回请求丢失：lib/analytics.ts 保存待撤回标记，
  AnalyticsEvents 在初始化、online、页面存活每 60 秒重试；成功响应只清除
  对应当前版本，连续撤回的旧响应不能覆盖新撤回。旧撤回未确认前，
  重新允许也不加载标签/同步上下文；成功撤回不自动同意。无新增同意 UI。
  PRODUCT 第 12 节已同步既有撤回契约的故障恢复与离线边界。
- 实际浏览器 + Next context API + 签名 Cookie + 独立 PostgreSQL 验证：
  断网后浏览器立即 opt-out，待撤回跨刷新保存；503/重新允许仍无标签；
  online 重试 200 后原 pending 报告变 revoked、context 清空。Google SDK
  在该测试为替身；离线时服务端尚未知撤回、已发请求不能撤销。
- 原有登录 Chrome 的本地 Test 页明确报 net::ERR_BLOCKED_BY_CLIENT，
  被拦截的是 googletagmanager SDK；没有改动用户浏览器保护设置。已请用户
  仅允许 localhost:3118 测试页。独立 headed Chrome 仍观察 page_view 2、
  pricing_view 2、begin_checkout 1（隔离返回对象）及 Google 204；重新进入
  Test DebugView 后实际看到 11:21 三事件对应次数，共七条（含两个基础自动事件）。
  保存 ga-test-browser-debugview-receipt.png，已告知用户暂时无需改保护设置。
  此前未显示的原因未确定；不将其等同原 Chrome 拦截，不用 MP 替代浏览器证明。
- GA 后台只读验收：正式/Test 都为洛杉矶时区、USD；正式事件/用户 14 个月，
  Test 事件 2 个月/用户 14 个月；Test 内部流量过滤器「测试」，signals 与
  用户提供的数据收集未启用。未更改这些设置。早前服务端三个隔离业务
  事件的 DebugView/实时收件证据仍成立，实际 OAuth/Stripe/Provider 不据此通过。
- 真实 SDK 初始化时的第一次 get 可能返回临时 client_id，早于实际首屏请求。
  captureAnalyticsContext 改为官方 get 的首次有效读取后再次确认两个 ID；不解析
  Cookie、不编造标识。新增早期临时 ID 回归；真实 SDK 提前读取对照通过。
- 11:48 同一真实 SDK 会话联合验收通过：两个页面、两次套餐曝光、一次隔离
  Checkout helper 请求，与三项持久业务报告的 client/session 完全一致；真实
  MP worker 各 transmitted 一次，重复事实零追加。实际 context API 撤回确认后
  不再采集；OAuth/Stripe/Provider 仍为替身。GA 六事件独立收件已核对，但
  最新同会话在 GA 报表中的完整联结尚未回读，不能据此宣称归因通过。
- 受控重复联合验收出现真实网络失败：purchase 持久状态 uncertain，
  errorCode=network_uncertain、attempts=1；没有自动重发。不是全部投递均成功，
  正式使用需监控/人工核对该状态，不以随后成功样本掩盖失败。
- 最终隔离全量回归 505 项：503 通过、0 失败、2 个真实 Stripe 外部审计跳过；
  TS、lint --quiet、design:check、最新 Test build 通过；九项桌面/手机浏览器
  检查通过，离线补偿联合测试通过。旧发射点调用盘点无旧业务事件。
  原始最终日志为 /tmp/flownana-ga-*-final.log；详细矩阵在
  docs/GA4-IMPLEMENTATION-VALIDATION-2026-10-05.md。
- 没有真实扣款、共享库迁移、平台 GA ID/启用开关改动、Preview/生产发布，
  没有提交/推送或 Ads 关联。默认采集策略仍关闭。代码/隔离验收通过，
  六事件独立 GA 收件及同会话网络/持久上下文一致有证据；GA 报表联结和实际
  OAuth/Stripe/Provider 业务链路尚不能放行。
- 验收清理完成：独立库 User/AnalyticsContext/AnalyticsReport 均为零；停止
  本地 3118 应用与 55438 PostgreSQL，关闭自建标签页/浏览器、撤掉本地测试
  允许标记，删除本轮临时 Secret 与真实 client/session 文件。原 GA 登录和
  已配置 Vercel Secret 保留。购买商品抽屉实际回读 starter_monthly/quantity=1；
  DebugView price 显示 12000000，原投递 price=12；未用该显示替代标准收入报表核对。

## 2026-10-05 GA 六事件开发（本地完成，外部收件待验收）

- 已通过正式 Chrome 的本机 WebSocket 连接原有已登录 GA；用户明确声明
  已完成必要披露与授权，并允许点击 Google「我确认」，已在正式/Test 两处完成。
  正式创建 Flownana Production Server 2026-10-05，Test 创建
  Flownana Test Server 2026-10-05；GA_API_SECRET 已以 Secret 类型写入 Vercel，
  正式仅 Production、Test 仅 Preview/Development，env ls 已回读两个隔离范围。
  Secret 未写入源码/文档/聊天。未配置平台 GA ID/启用开关、迁移共享库或发布。
  该声明不改变用户「采集策略以后确认」的决定；默认采集仍关闭。
- 实际回读 Test / 557281646、流 16040384516、G-RP4MTRCXT0，增强型衡量关闭；
  正式 / 208428049、流 15944150044、G-2PTWF8DJE2，增强型衡量仍开启，
  发布启用前必须按新页面策略核对关闭重复/不必要自动采集。
- Google strict /debug/mp/collect 已对六事件返回 HTTP 200、validationMessages=[]；
  验证接口不校验 Secret、不进入报表，不是认证或真实收件证明。
- 真实 Google SDK 测试发现原初始化 push 普通数组，SDK 不处理命令；已改成
  官方 arguments 对象。相同真实 SDK 对照：数组无 client callback/collect，
  arguments 有真实 client callback/collect；新增初始化契约回归测试通过。
  修复后 Test 构建、lint、design:check 通过，真实 SDK 已取真实 client/session，
  页面/曝光/SPA 和撤回网络边界已观察；headed/headless 都观察两条页面、
  两条曝光、一条隔离 Checkout helper 事件。GA 后台浏览器三事件尚未显示。
  隔离业务事实经实际 worker 投递 Test：sign_up/generation_completed/purchase
  各一条 transmitted，重复创建/完成/核验不增加；OAuth/Stripe/素材仍为替身，
  没有真实扣款。约 10:45 Test DebugView 和实时概览已实际回读上述服务端
  三事件各一次；客户端真实收件/完整六事件联结仍待核对，204 不替代收件。
- 用户批准六事件开发和详细测试：page_view、sign_up、pricing_view、
  begin_checkout、purchase、generation_completed；pricing_view 为实际支付曝光。
  PRODUCT 第 12 节及测量方案已同步。旧模板/Agent/点击/下载等投递本地同批停用，
  线上未切换；没有提交、推送、部署或迁移共享数据库。
- 用户要求采集策略以后确认：默认 NEXT_PUBLIC_GA_ENABLED=false，不新增同意 UI，
  不默认允许；预留 setAnalyticsConsent。显式允许后才加载唯一 Google tag；
  撤回设置 Google 官方 ga-disable 标记并取消待投递，存储失败仍拒绝。
  正式/Test 的 ID 与域名分别校验，无跨环境 fallback；广告 consent 与 signals 关闭。
- 新增 AnalyticsContext、AnalyticsReport，迁移 20261004232658_analytics_reporting。
  HMAC HttpOnly 真实 client/session 上下文、账号创建版本、Checkout/生成快照及
  环境隔离；稳定事实键冲突忽略插入和条件租约去重。缺少/过期上下文记覆盖缺口，
  不是编造会话/补同意。两表 RLS 与服务端角色权限在独立 PostgreSQL 验证。
- 注册由真实新建事实确定；生成所有创建入口保存上下文，中央持久化成功入口报告。
  purchase 由 Invoice/Subscription/PaymentIntent 回读核验现金、环境、归属；
  Webhook/返回共用 Invoice ID；折扣后商品美元金额与税分开，零现金/手动标付不冒充收款。
  Billing 浏览器 purchase 发射已移除，仅保留展示信息。
- 后台网络投递用 Next.js after，响应/事务结束后处理；有效登录上下文同步可带动待发送。
  Vercel CLI 回读当前团队 plan=hobby，故使用每天 UTC 07:00 补偿 Cron，
  没有五分钟 Cron 或套餐升级。429 退避；网络/5xx/中断标 uncertain，先核对再恢复；
  2xx 仅 transmitted，绝不等于 GA 已收件。Preview Cron 需手动调用验收。
- 完整隔离回归：502 项，500 通过，0 失败，2 个真实 Stripe Sandbox 外部审计跳过。
  TypeScript、lint --quiet、design:check、隔离配置 build 通过。
  Chrome 本地构建浏览器 9 项通过，桌面 1440×1000/手机 390×844；SDK/网络替身，
  无真实 GA 收件。普通图/视频、模板四张、Agent 两张的服务/事务与完成去重，
  现金金额/折扣/税、无返回 Webhook/故障重试、注销撤回、租约恢复均做隔离验证。
  临时数据库和浏览器依赖放 /tmp，未加入项目依赖；没有真实模型、Blob 写入或扣款。
- 限制：退款/首购广告信号/混合 Invoice/客户余额混合收款/后台长期清理未实施；
  非活跃授权续费与长任务有覆盖缺口。MP 72h 可回填不保证会话归因，需核对
  24h 会话窗口、48h 联结处理；日补偿可能延迟。离线撤回尚需补偿验收，
  已发请求不可撤销；新表结构/权限异常是开启后注册/生成事务依赖。
- 早前 CUA 多次超时且独立测试浏览器被 Google 拒绝登录；已关闭独立窗口。
  用户开启 Chrome 远程调试后，现有登录会话连接成功。没有导出浏览器密码、
  Cookie 或认证存储，也没有安装第三方 GA 报表插件。
- 本轮真实 Google 验证后已停止 localhost:3118 服务和临时独立 PostgreSQL，
  已删除两份临时 Secret 和真实 tag 上下文文件。Vercel Secret 保留；原有 GA
  标签页/登录保留，自建 localhost 标签页和独立测试浏览器已关闭。
  Test DebugView/实时截图位于 /tmp/flownana-ga-runtime/ga-test-*-receipt.png。
- 详细实现、日志、手动验收及风险见 docs/GA4-IMPLEMENTATION-VALIDATION-2026-10-05.md。
  共享数据库迁移、Preview 平台配置/部署须具体确认；正式发布须明确授权。


## 2026-10-04 GA 后台准备（用户操作，进行中）

- 用户最新确认：基础与业务转化同批加入，业务持续迭代，埋点只保留最必要
  核心；已撤回先仅基础访问、业务以后恢复的过渡方案。PRODUCT 第 12 节
  已替换为六事件候选字典待确认：page_view、sign_up、pricing_view、
  begin_checkout、purchase、generation_completed。四项使用 GA 标准/
  推荐事件，Pricing 曝光和生成成功为必要产品自定义；付款核验/去重、环境隔离和隐私
  保留。旧事件停用与新业务启用同批验收，不发布业务追踪全停的过渡版。
  本轮仅准备文档，没有实施、迁移或部署；未运行代码/GA 收件测试。
- 用户定义支付曝光为进入 Pricing 并实际看到套餐列表，要求调整事件名。
  GA 官方推荐列表无独立支付曝光事件，方案采用 pricing_view；当前为弹窗，
  实际可见才报告，每次打开一次，同次切换月/年不追加曝光。不能使用提交
  付款信息的 add_payment_info 替代，亦不并行发送 view_item_list/旧
  pricing_viewed。PRODUCT 与方案已同步，应用代码及 GA 后台未变更。
- 用户已提供 GA 官方 gtag.js 安装片段，ID 为正式 `G-2PTWF8DJE2`。匿名
  HTTP 检查正式首页 200，但返回 HTML 中无 Google tag ID、gtag.js 或
  ga4-init。测试域名匿名访问跳转到 Vercel 登录保护页，不能检查到应用标签。
  这两项不是实际浏览器执行/收件验收；未回读平台环境变量，缺少变量只是
  待核对原因。工作区已有依赖 NEXT_PUBLIC_GA_MEASUREMENT_ID 的标签入口。
- 当前最小业务连接详细范围已写入 PRODUCT 第 12 节待确认；使用唯一
  Google tag、环境隔离及安全标准页面/业务事件，切换时停用旧业务投递。
  不直接把官方片段复制到已有加载入口旁边；没有
  更改代码、环境变量或生产部署，未运行应用测试。后续手动验证须含 Tag
  Assistant/实时或 DebugView，当前尚未完成“设置数据收集”。
- 用户授权在既有 Flownana GA 资源下开始后台准备；Chrome 控制连接连续超时，
  后续改为用户操作、助手逐步核对截图。未安装第三方 GA 数据插件。
- 截图确认 GA 账号 `146543098`、正式媒体资源 `Flownana` / `208428049`；
  数据流 `flownana` / `15944150044`，衡量 ID `G-2PTWF8DJE2`，流网址为
  `https://flownana.com`。这些是公开配置 ID，不是 API Secret。
- 用户确认将报告时区从中国时间改为 America/Los_Angeles 并保存；USD 已在
  原截图中核实。改后时区尚未截图回读；Ads 时区和币种仍只来自用户确认。
- 数据流截图显示过去 48 小时无数据；增强型衡量已开启，细项待核对；邮件
  隐去开启，查询参数隐去未开启。不能据此宣称标签已部署或实时收件通过。
- 已确认正式/测试测量隔离，市场 US/JP/KR/TW。正式资源保留页面截图核实
  事件/用户数据均为 14 个月，新活动重置开启，用户确认已保存；页面提示
  24 小时后生效。资源选择器截图核实 Test `557281646` 已建立在相同账号；
  Test 流/衡量 ID 已截图核实，时区/币种与保留设置仍待核对。Ads 关联和
  收件验收待完成；现有本地/Preview 测试付款门禁保持。
- 测试流详情截图确认 `Flownana Test Web` / `16040384516`，衡量 ID
  `G-RP4MTRCXT0`，网址 `https://flownana-test.vercel.app`；增强型衡量
  主开关关闭，页面显示未收到数据。独立 ID 已建立不代表网站投递已隔离；
  本轮未安装或部署测试标签，未创建 MP Secret；正式 Ads 关联待基础收件之后。
- 方案和后台核对记录位于 `docs/GA4-ADS-MEASUREMENT-PLAN.md`。本轮仅更新
  文档，没有改应用代码/事件含义、环境变量或部署；未运行应用测试。下一步
  按用户新要求先厘清现有事件与统一 GA 测量体系，随后继续后台准备；付款与归因覆盖仍
  需单独批准埋点实施并验收，不把后台设置当作投放就绪。
- 增强型衡量细项截图确认历史记录页面变化和六类增强事件全部开启。助手已
  给出按需关闭建议，但用户未确认保存，不能宣称设置已生效。
- Git 历史回读：基础 GA 埋点于 2026-05-19 的 `bdc59a6` 首次加入，模板和
  Agent 扩展见 2026-09-11 `6283165`、2026-09-12 `53c134d`。代码提交时点
  不代表线上开始收件；现有手动事件本身也是经 gtag 投递 GA4。当前工作区
  仍有未提交追踪修改；没有做生产实时/DebugView 整体核对。
- 用户确认全新 GA 测量体系及后续完整下线旧埋点方向，已同步 PRODUCT
  第 12 节。新事件字典、付款/首购事实与切换验收标准尚待具体化并确认；
  本轮没有停用旧代码或上线新标签。不把测试流加到正式资源来替代环境隔离。
- 用户要求按 GA 官方引导和固定清单推进，避免后台准备与网站改造交叉跳转；
  清单已写入测量方案。最新任务页截图显示 Ads 关联任务锁定，先前提前
  推进关联的建议已撤回；当前继续“设置数据收集 / 采取行动”，核对官方
  安装说明。基础标签连接与收件须在关联步骤之前完成，不能把创建流当作
  已接入；事件重建仍须详细规格，生产发布仍需授权。没有旁路任务页锁定，
  也不据此推断所有 GA 关联入口均有同一限制。本轮仅文档，无代码测试/部署。

## 2026-10-03 保存卡片已发布（真实付款待验收）

- 用户明确授权“发布”，从当前已验证工作区部署 Production：
  `dpl_H878BZzhGhujMQJkJKFzTqeh6Yd8`，部署地址
  `https://flownana-5pv7p3gu7-liangchusans-projects.vercel.app`。CLI 最终 READY，
  再次 inspect 确认 `https://www.flownana.com` 指向该 Production 部署。生产
  构建成功回读正式 Stripe 账户和六个 Live Price；部署后 `npm run smoke:prod`
  全部通过，当前部署的 error 日志查询暂未返回记录。未更改 Preview 部署、
  测试结账门禁或数据库；未提交/推送 Git。以下开发阶段的验证与风险继续适用。

- 用户确认 `docs/PRODUCT.md` 第 10.2 节并授权开发：Stripe Hosted Checkout
  提供可选保存卡片选项，同账号升级或重新购买时复用已同意保存的卡片；仍需
  用户确认付款，银行要求时完成额外验证。本地和 Preview 继续禁用测试结账。
- `lib/checkout-reservation.ts` 在持久化 Session 参数中增加
  `saved_payment_method_options.payment_method_save=enabled` 和
  `allow_redisplay_filters=[always]`。Stripe 收集保存同意，仅供续费的卡片不强制
  展示；首次订阅由 Checkout 创建 Customer，付款核验后沿用现有绑定流程；
  后续结账使用当前账号 `stripeCustomerId`，不按邮箱跨账号寻找卡片。不存储
  卡号或安全码，不变更价格、积分、续费和 GA4。
- 保留现有 Stripe SDK 与全局 Billing API 版本；使用窄类型扩展描述 SDK 尚未
  声明的附加参数。实际独立“Flownana 沙盒”账户的 `2023-10-16` API 已接受
  两项参数，并回读确认；没有升级全局 API 或改变订阅响应结构。
- 实际服务端结账代码加内存账单边界，在独立 Stripe 沙盒创建首次/已有 Customer
  两个测试 Checkout，回读 `payment_method_save=enabled`、仅 `always` 可展示、
  金额 $16 以及 Customer/邮箱关联正确；重复调用复用同一 Session。沙盒已保存
  测试卡使用虚拟 token，未输入真实卡号、未扣款、未写入共用主库。本次未验证
  用户勾选保存后的真实付款；浏览器观察 Stripe 页面连续超时，保存选项与预填卡
  的实际显示仍待验收。验证结束后两个临时 Checkout 已过期、临时 Customer 已
  删除，并逐一回读确认；无共享数据库写入或付款。
- `tests/checkout-reservations.test.ts` 补充新购/升级/重试参数与 Customer 复用
  断言；这些隔离 PostgreSQL 用例本轮因无测试库而跳过，不能宣称已执行。
  本轮全量测试 408 passed/13 skipped/0 failed；TypeScript、lint quiet、build
  和 diff check 均通过。该检查完成后已按上述部署发布保存卡片代码。
- 再次回读正式账户：可收款/可出款、无待补充事项；仅六个启用 Price，金额和
  月/年周期与产品一致，三个 Product 默认月付 Price 正确。旧四个 Price 已不在
  列表中，用户删除它们不影响当前套餐。Live Webhook enabled，Portal active/
  default 且付款方式更新 enabled；正式 Stripe 订阅为 0。主库 Subscription、
  CheckoutReservation、ProcessedStripeEvent、Customer 关联及 QA 用户均为 0，
  两个只允许 Live Price 的数据库 CHECK 均 validated。
- Vercel 再次 inspect 确认正式域名仍指向 `dpl_ByCcSsQtML5LBgLdkxiEU2Kq6XRD`
  的 Production READY 部署；本轮重新运行 `npm run smoke:prod` 全部通过，验证
  范围为公开页面与匿名接口，未替代真实付款或已登录账单验收。
- 修正文档“生产仍为测试模式”的过期风险描述。实际线上首次付款、Live Webhook
  发放/重复处理、保存卡片后再次支付、发卡行验证和 GA4 仍待手动验收；工作区
  仍含此前已发布但未提交到 Git 的变更。

## 2026-10-02 Stripe 正式模式已发布（真实付款待验收）

- 用户已确认 `docs/PRODUCT.md` 第 10.1 节并授权开发上线：仅 Production 使用
  正式账户，Starter/Pro/Max 的月/年价格与积分规则不变。后来进一步确认收费
  Supabase 分支不创建，本地和 Preview 保留测试密钥/Price，但停止新建测试
  Checkout、升级报价与补付，旧测试返回页、Webhook 和 Cron 不再写入共享主库。
  Production Live Checkout 必须显式开启，关闭新结账时真实付款的 Webhook 与
  年付积分发放仍可处理，Cron 只扫描当前环境配置的年付 Price。
- 全量测试 410 passed/13 skipped/0 failed、lint quiet、design:check、TypeScript、
  build 通过。Preview 部署 `dpl_C7JLSJ2obAmMXgC4sF3d3zVEdLhi` 为 READY，
  稳定地址 `flownana-test.vercel.app` 已重新指向它；Production 的门禁关闭部署
  `dpl_9ntfJtuMWzjJE8qoBXr4wv9rjznm` 为 READY，`www.flownana.com` 已绑定，
  `npm run smoke:prod` 通过。生产构建实际连接 Stripe 回读并确认正式账户和
  六个 Live Price；真实付款仍未执行。
- 主库清理后，将 Production `STRIPE_LIVE_CHECKOUT_ENABLED=true` 仅设于
  Production Config 并回读，最终部署 `dpl_ByCcSsQtML5LBgLdkxiEU2Kq6XRD`
  已 READY、绑定 `https://www.flownana.com`，构建再次核验正式账户和六个
  Live Price，最终 `npm run smoke:prod` 全部通过。最终部署前的本地复核为
  408 passed/13 skipped/0 failed、lint quiet、TypeScript/build/diff check 通过。
  部署后主库再次回读：Subscription、Stripe Customer 关联和 QA 用户均为 0，
  真实用户两批积分与剩余 212 未变化；真实沙盒订阅仍 canceled，沙盒 Webhook
  disabled，Live Webhook enabled。尚未执行真实付款、Portal 或已登录 GA4 验收。
- 旧 Preview 独立部署 URL 可能仍运行历史代码；为防测试账单重新写入共用主库，
  已通过 Supabase Migration `stripe_live_only_billing` 给 `CheckoutReservation`
  和 `Subscription` 加入只接受六个 Live Price ID 的 CHECK 约束；迁移 SQL
  保存于 `prisma/migrations/20261002231000_stripe_live_only_billing/migration.sql`。
  回读两个约束均 validated；用旧沙盒 Starter Price 分别试插两表均被拒绝，
  试插事务未留下行，主库订阅/预约仍为 0。未来轮换 Live Price 必须先更新
  该允许列表，再切换 Vercel Production Price 环境变量。该数据库迁移在最终
  运行时代码部署后应用，无需重新部署才生效。
- 本次从含有此前已发布及本轮已批准变更的工作区直接部署，尚未创建 Git 提交
  或推送；远端 `main` 不能作为当前线上产物的复现来源。未来从 Git 自动部署前
  应先整理并同步该工作区，避免覆盖 Live 门禁与测试禁用代码。
- 正式 Stripe 账户 `acct_1SwJs2RohkvhKuAJ` 已回读 `charges_enabled`、
  `payouts_enabled`、`details_submitted` 均为 true，无待补充事项。创建 Starter
  Product 并在 Starter、现有 Pro、Max Product 下创建六个 Live USD 周期 Price：
  Starter 月/年 `price_1UM5q4RohkvhKuAJ8Ie0xeqr` / `price_1UM5q5RohkvhKuAJlKiHNcAE`
  （$16/$96），Pro `price_1UM5q6RohkvhKuAJsH1qPH5S` /
  `price_1UM5q6RohkvhKuAJhbgmCUHY`（$48/$288），Max
  `price_1UM5q7RohkvhKuAJ4WYA3IsS` / `price_1UM5q8RohkvhKuAJl70A7Jhi`
  （$96/$576）。六个均 active 且回读金额/周期匹配；旧四个错误 Live Price
  已停用，事前确认无 Live 订阅或 Payment Link。
- 创建 Live Billing Portal `bpc_1UM5r0RohkvhKuAJJqOmO3YB`，按测试配置允许
  更新客户/支付信息、看发票及期末取消；创建指向生产回调的 Live Webhook
  `we_1UM5sNRohkvhKuAJOGY0ms90`，订阅既有 10 个事件。签名密钥只写入 Vercel
  Production Sensitive 环境变量，未写入仓库。六个 Live Price ID 也仅写入
  Vercel Production；`STRIPE_LIVE_CHECKOUT_ENABLED=true` 仅写入 Production
  Config 并回读，已随最终 READY 部署生效。
- 用户已在 Vercel 设置 Live API Key；2026-10-02 只读拉取核验 Production
  `STRIPE_SECRET_KEY` 前缀为 `sk_live_`，未输出密钥。其最初被写进覆盖全部三个
  环境的共享变量，导致 Preview/Development 也临时成为 Live Key；现已用
  `.env.local` 中原测试密钥分别覆盖 Preview/Development，并将三环境变量
  拆开设为 Sensitive。Vercel 元数据回读为 Production 一条、Preview 与
  Development 一条；新 Production/Preview 部署已采用各自变量。
- Stripe 连接回读：Flownana 正式账户现有启用 Price 仅 Pro $16/月、$96/年及
  Max $50/月、$300/年，均不符合当前 Starter/Pro/Max 六档产品价格；正式账户
  原无 Webhook endpoint、Billing Portal 配置或订阅；旧 Price 未用于网站。
- 本地 `.env.local`、`.env.production` 的测试密钥属于独立“Flownana 沙盒”
  账户，不是正式账户的 Test Mode。原指向生产域名的沙盒 Webhook
  `we_1THfBXRqa49126u8yR3SNgev` 已禁用。真实生产账号
  `116734473226090685751` 的沙盒 Starter 订阅
  `sub_1U1dKyRqa49126u8PGW9ZaG1` 已在 Stripe 即时取消并回读 canceled；
  独立 QA 沙盒订阅未取消。主库一次事务删除 7 条测试 Subscription、全部测试
  ProcessedStripeEvent 和 QA 用户 `test-user-local`（含其测试积分/媒体关系），
  清空真实用户的测试 Customer 关联；前置条件限制当时只有这两位账号、7 条
  测试订阅、0 条预约。回读主库 Subscription、预约、ProcessedStripeEvent、
  测试 Customer 关联、QA 用户均为 0；真实用户两批积分未改，剩余 212。
- 审计发现 Vercel Preview/Development 的 `DATABASE_URL` 与本地
  `.env.local` 都连接 Production 使用的 Supabase 项目
  `kbpmirqktzxlpkfeuhtn`，目前没有独立分支。即使生产 Webhook 忽略测试事件，
  Preview/本地测试 Checkout 原可写入同库的 `User.stripeCustomerId`、Subscription
  和积分。用户选择停止测试结账而不建立分支；新代码封住测试写入入口，
  仍需手测并监控主库没有测试账单再次出现。
- Supabase 当前组织 `ehldliupgspenpkyrfnh` 的独立分支报价为每小时 USD
  0.01344（30 天约 USD 9.68，其他用量另计）；用户明确表示收费则不创建，
  因此未创建分支，也未建立额外 schema。用户选择停止本地与 Preview 测试结账。
- 切换前的只读审计曾确认旧 Production 使用独立沙盒测试密钥；该结论仅适用
  旧部署。当前 Production 构建已核验 Live Key 归属和六档金额；Preview、
  Development 仍保留测试密钥，但代码禁止测试结账。真实付款、Live Webhook
  投递和购买后的积分/GA4 需上线后手测。

## 2026-09-24 支付恢复与 Pricing 工作区生产发布

- 用户明确要求检查全部本地分支并发布。本机仅有 `main` 一个本地分支、一个
  worktree；本地 `HEAD`、`origin/main` 和 `git ls-remote --heads origin` 均为
  `57a5a9ddb4e8aa5f0711f093be67465f594f5432`，远端仅有 `main`。当前工作区
  仍有已验收但未提交的 Pricing、导航、支付恢复、埋点及文档改动；直接从该
  工作区部署，没有 Git 提交或推送。
- 部署前隔离库全量测试 485 passed、2 opt-in skipped、0 failed；lint quiet、
  design:check、TypeScript、生产模式本机构建和 diff check 通过。Vercel 生产
  部署 `dpl_qVT1bE5MxAYsU5QbLffmuGXJUfd5` 已 `READY`，CLI inspect 确认
  target=production，别名 `https://www.flownana.com`。部署运行错误日志查询
  暂无记录。
- 生产 HTTP 冒烟尚未通过：本机 `npm run smoke:prod` 实际退出码 6，
  `curl` 无法解析 `www.flownana.com`；部署域名、Vercel CLI curl 及浏览器
  访问也在连接阶段超时。不能把 READY/别名等同于线上页面、登录或支付完成
  验收。生产 Stripe 密钥模式、真实 Webhook 投递及支付边界仍需在网络恢复后
  验证。此条部署记录为发布后文档更新，不包含在上述 Vercel 构建产物中。

## 2026-09-24 待付恢复与返回状态补齐（本地，未发布）

- 本轮按用户要求暂不处理埋点。Billing 返回页将缺少 Session、未完成支付、
  已付但权益同步中、无法核验分别显示；只有当前周期发放记录存在且账单套餐
  匹配时才显示成功；账单摘要读取失败时也只显示同步中，避免成功与错误同时
  出现。新增返回状态单测。
- `paused` 订阅不再显示必然返回 409 的 Complete payment，改为 Manage billing；
  其他待付状态保留 Hosted Invoice 补付并增加账单管理兜底。Billing 读取待付
  订阅时重新核对 Stripe 归属和发票，已付且 Webhook 延迟时复用幂等发放逻辑
  补齐权益，未付不发积分。真实 Stripe Test Mode 与隔离数据库新场景通过：
  付款后不投递 Webhook，访问 Billing 发 200 积分，重复访问不多发。
- 定向账单事务 13/13、真实沙盒恢复 6/6、返回状态 1/1、全量回归
  485 passed/2 opt-in skipped、lint 0 errors/16 existing warnings、
  design:check、TypeScript、preview build 通过。浏览器复核缺少 Session 提示与
  已付升级成功页；`past_due`/`unpaid`/`paused` 的真实浏览器界面及外部
  Stripe Hosted Invoice 页面仍待验收。未提交、未发布。

## 2026-09-24 支付返回与待付恢复优化（本地，未发布）

- 本地隔离账号 `payment-qa-handoff-20260924` 的真实 Stripe Test Mode Starter
  月付 Checkout 已完成：$16、订阅 active，浏览器 Billing 显示 200 积分、刷新
  不重复，Start Creating 返回创作页，侧栏同步 Starter/200。测试登录回跳的
  套餐/周期恢复也已在浏览器验证。Pro 月付升级 Checkout 随后完成 $48 Test Mode
  支付，旧 Starter 被取消、新 Pro active；隔离库两批共 1000 积分，浏览器升级
  成功页显示 $48/Pro/1000，刷新不重复。本代理未点击最终浏览器付款按钮。
  此为隔离本地数据库与 Stripe Test Mode，不涉及生产发布。
- 后续复核 PAY-01 时新增 PAY-05：已核验成功事件在 GA 晚于账单页初始化时会
  漏报。新增先失败的复现测试，改为最多 20 秒重试，成功/卸载即停止，重试前
  检查交易 ID 的本机去重记录。真实 GA4 收件仍待验证。
- PRODUCT 已确认本轮付款返回、待付账单可见与 `purchase_success` 验收规则；
  代码将成功事件改为仅由服务端已核验的 Checkout 结果触发，并用本地交易 ID
  去重，金额不再取 URL。缺少 Session/无法确认均不再显示已收款。Billing 对
  `incomplete`/`past_due`/`unpaid`/`paused` 显示待处理状态；恢复入口仅返回
  鉴权、Stripe 归属、未付发票和生产 Test Mode 门禁均通过的 Hosted Invoice URL。
- 真实 Stripe Test Mode 加隔离 PostgreSQL 的未付→恢复脚本 3/3 passed；
  后续补测真实测试卡拒付、3DS PaymentIntent 状态，扩至 5/5 passed；
  账单恢复链接在未付时可得、付款后消失。年付 paid invoice 首次和推进本地
  月度发放时间后的第二次积分各 200，重放不多发（沙盒套件 8/8）。
  Checkout 取消带安全 returnTo 回到
  原站内页面并重开 Pricing，浏览器模拟往返保留 Prompt 草稿。全量测试
  最终 486 项、484 passed、
  0 failed、2 skipped（opt-in 沙盒）、0 todo；六套餐真实 Checkout 复跑通过，
  lint、design:check、build、
  diff check 均通过。没有提交或发布。
- 浏览器实测伪造成功 URL 的中性提示、Pricing 开关/Esc/焦点恢复及
  390/768/1440px 无横向溢出。补测真实沙盒 `incomplete` 订阅，Billing 的
  待付提示/补付按钮、Pricing 三套餐的恢复 CTA 均在浏览器可见；测试订阅和
  Customer 已清理。浏览器进入外部 Stripe Checkout/发票时连接再次超时，
  最终付款、3DS、实际升级及其他待付状态仍未完成。详见
  `docs/PAYMENT-FLOW-AUDIT-2026-09-22.md`。本地 `next dev` 因 Watchpack
  `EMFILE` 自行重启，改用已构建的 `next start` 验收。
- 发现登录前点击套餐会丢失选择；新增当前标签页十分钟有效的套餐/周期意图，
  回跳原页 `#pricing`，由用户再次点击继续，避免登录成功后自动发起 Checkout。
  浏览器验证到未登录选 Pro 月付并进入包含 `/image#pricing` 的登录地址；构建环境
  只提供 Google 登录，`next dev` 因 Watchpack `EMFILE` 无法完成测试账号回跳。
  登录后实际 UI 恢复仍待验收。

## 2026-09-23 支付审计补测（仅测试与方案，未改计费产品代码）

- 新增 opt-in Stripe Test Mode 恢复/升级测试：首期 `incomplete` 未付不发积分，
  测试支付后由本地签名 `invoice.paid` 发 200 积分、重放不重复；年付 Starter→Pro
  剩余 11 个月抵扣 $88、目标 $288、应付 $200，真实 Checkout 金额匹配。3 项
  （含父套件）通过；脚本清理测试 Session、订阅、Customer 与隔离库账号。
  实际拒付、Stripe 实际通知投递及升级付款后状态尚未验收。
- 发现 PAY-04：`incomplete` 订阅未显示在 Billing 摘要，却会阻止新 Checkout，
  用户可能缺少恢复入口。与 PAY-01/02/03 一起记录于
  `docs/PAYMENT-FLOW-AUDIT-2026-09-22.md`，目前仅形成优化方案，未实施。
- 修正历史图片引用测试夹具：`generated` 资产补关联成功 Generation。隔离库
  全量回归 479 项，474 passed、0 failed、2 skipped（沙盒 opt-in）、3 todo
  （PAY-01 待修断言）。浏览器付款返回、登录衔接、完整升级及响应式 UI 仍待测。

## 2026-09-22 支付全流程审计（进行中，未修改产品代码）

- 用户要求完整测试功能/UI/边界并给优化方案。矩阵、证据、问题和待测项记录在
  `docs/PAYMENT-FLOW-AUDIT-2026-09-22.md`；当前目标尚未完成。
- 基线 397 passed/11 skipped。建立临时本机 PostgreSQL 并应用全部迁移后，
  全量 472 passed/2 failed/0 skipped；失败为历史图片引用子用例及父套件，单独
  复现。支付事务 12 项和结账预约 18 项子用例均通过，Stripe 为故障注入边界。
- 新增 opt-in 的真实 Stripe Test Mode 测试：六套餐 Checkout 创建/金额/复用/
  过期及真实年付 paid invoice 发积分、幂等、取消，共 8 项通过。API 测试对象
  已清理；脚本拒绝 Live Key 和非隔离数据库。未发生真实扣款，未部署或提交。
- 新增 3 个明确 TODO 的审计断言，复现成功埋点信任 URL、伪造金额和刷新重复。
  浏览器复现无支付 Session 仍显示 Payment received；均未修复，待整体方案。
- 测试站点 `http://localhost:3110` 使用临时库，专用账号 payment-qa-20260922；
  首次 Starter 年付已创建沙盒 Checkout，但浏览器操作反复超时，尚未实际填卡。
  临时库目录记录于 `/tmp/flownana-payment-pg-path`，服务端口 55439。
  后续继续真实 Checkout/升级/Portal 与完整响应式交互验收，不能声称全绿。

## 2026-09-22 Pricing 正式发布与本机发布权限

- 用户明确批准生产发布。订阅大弹窗、九项产品卖点、套餐定位、强化年付优惠与
  同风格升级确认已部署：`dpl_FwQLZ65Rf6gGc9YKQ1nH9aWMYekV`，Vercel 返回
  `READY`，正式域名为 `https://www.flownana.com`。本次从当前工作区发布，未提交 Git。
- 本地 397 passed、11 skipped、0 failed，build/lint/design:check 通过；云端构建
  通过，发布后 `npm run smoke:prod` 全部通过，含首页视频资源与 API 权限断言。
  登录态真实升级报价、返回套餐时周期保留、嵌套焦点及实际付款仍需手动验收。
- Vercel CLI 已重新登录。应用户要求，在本机 Codex `sandbox_workspace_write`
  增加 Vercel 的 Application Support/com.vercel.cli 和 Caches/com.vercel.cli
  两个目录写入白名单；保留 workspace-write 与原审批策略，配置一般需新会话加载。
  发布使用临时 npm 缓存和 `NO_UPDATE_NOTIFIER=1`。此设置解决目录写入限制，
  不跳过 Vercel 账号过期后的身份验证，也不代表关闭平台自动审批。

## 2026-09-22 Pricing 发布尝试（授权待恢复）

- 用户授权测试通过后发布。重新执行测试为 397 passed、11 skipped、0 failed；
  lint、design:check、diff 检查通过，使用此前已成功构建的同一份功能代码。
- Vercel CLI 部署返回 `Not authorized`，尚未创建成功的生产部署，也未运行发布后
  冒烟。已启动设备登录流程，等待用户恢复 CLI 授权后继续发布；现有线上版本未替换。

## 2026-09-22 Pricing 卖点与升级确认精调（本地未发布）

- 按用户新截图调整套餐名/价格字号、24px 卡片内边距、价格区留白与按钮对齐；
  补充 Starter/Pro/Max 的创作定位，并从既有能力提炼九项带 Lucide 图标的卖点。
  移除分辨率、普通按钮下的重复周期小字、独立积分到期/不退款页脚；Save 50%
  改为品牌蓝实心标签。实际套餐、价格、积分与退款规则未改，不可升级原因保留。
- UpgradeModal 改为相同浅灰画布、浅色细边框卡、蓝色主按钮和固定圆形关闭按钮；
  返回按钮为 Back to plans，保留旧/新套餐、周期、积分、实付与抵扣明细，增加
  加载和错误的无障碍状态。确认按钮继续受报价加载/错误保护。
- PRODUCT/DESIGN 已同步。397 项测试通过、11 项数据库测试跳过；build、lint、
  design:check 和 diff 检查通过。浏览器实测订阅 390/768/1440px、九项权益与
  平板按钮对齐，无横向溢出。升级弹窗使用 /tmp 下真实组件静态渲染的模拟报价
  做桌面/手机视觉检查及加载/错误禁用检查，不代表真实登录/支付流程通过。
- 仍需手测真实账号升级报价、返回订阅弹窗时周期保留、嵌套 Esc/焦点恢复及付款；
  未提交、未部署。临时模拟页面不属于产品代码。

## 2026-09-22 Pricing 统一大弹窗（本地未发布）

- 按用户确认的 ChatGPT 应用内参考，将 Pricing 改为全视口浅色弹窗；价格和购买
  按钮位于权益之前，推荐 Pro 为浅蓝卡片及蓝色按钮，其余卡片保持白色。
  套餐名称、价格、积分、权益、默认年付、升级确认与服务端计费规则未改。
- Header、Footer、账单页与已有创作/用户菜单入口均原地打开同一 Provider 弹窗。
  `/pricing` 不再展示独立页面，仅跳转 `/#pricing` 兼容书签和已有 Checkout 取消地址；
  关闭仅清理 pricing hash，不修改原页面路径、查询参数或创作状态。
- PRODUCT/DESIGN 已同步；pricing_viewed 统一由打开弹窗触发，移除独立页监听，
  checkout_started 保持。新增导航回归覆盖原 children、原 URL 和兼容地址。
- 验证：397 项测试通过、11 项数据库测试跳过、0 失败；build、lint -- --quiet、
  design:check、git diff --check 通过。内置浏览器检查 390/768/1440px 无横向溢出，
  桌面购买按钮对齐、月/年价格、原地开关、Esc、Prompt 保留和焦点恢复、旧地址
  跳转与关闭后 hash 清理；检查时浏览器 error 日志为空。
- 未部署、未提交。登录态当前套餐/禁用原因、嵌套升级确认、真实支付与取消返回、
  附件及活跃任务保留仍需手动验收；本次浏览器验证为未登录状态。

## 2026-09-20 已下线旧 Image/Video 路由与无入口创作 UI（已发布）

- 用户明确取消全部旧 `/ai-image`、`/ai-video`、`/ai-music` 兼容地址：路由页和
  Next.js redirects 已移除，三者现在均返回 404。
- 已删除无路由调用者的旧 TemplatePanel、ResultPanel、My Creations/Explore 结果链路、
  独立 Image/Video Preview 与旧 CreationPreviewDialog；当前 Image、Video、Assets 与
  Agent 工作台不再携带这套过时交互分支。PRODUCT 路由、验收规则与生产冒烟断言已同步。
  `npm run test`（395 passed、11 skipped）、`npm run lint -- --quiet`、`npm run design:check`
  通过；清除 Next 开发缓存中已删除路由的类型索引后，`npm run build` 通过并仅列出
  任何旧 `/ai-*` 路由。Vercel 生产部署
  `dpl_G4rgtWWCfuFijibxwbuumM8HtkRC` 已 READY 并绑定 `https://www.flownana.com`；线上
  `/ai-image`、`/ai-video`、`/ai-music` 的 404 断言已通过。生产冒烟在请求
  `/videos/flownana-home-demo.mp4` 时超时，故后续 API 断言尚未完成；需单独排查该媒体
  资源的线上可达性，不能将本次冒烟称为全绿。

## 2026-09-20 Agent 视频引用缩略图统一（已发布，待手测）

- Agent 从结果点击 `@` 添加视频引用时，不再显示文字占位 `video reference`。Agent
  Composer 现复用 Image/Video Composer 的媒体缩略图：显示视频封面、时长及统一删除
  控件；引用仍按 Agent 的“描述需求后再出方案”流程处理，未改变生成、计费或埋点。
- `@` 预填会保留已有视频任务的 `duration` 元数据，缺失时共享组件从媒体元数据读取。
  新增回归测试；`npm run test`：395 passed、11 skipped、0 failed，`npm run lint -- --quiet`、
  `npm run design:check`、`npm run build` 与 `git diff --check` 通过。待登录态手测 Video 与 Agent 的 `@`
  视频引用在 390/768/1440px 下的封面、时长、删除和发送行为。

## 2026-09-20 Agent Composer 菜单覆盖媒体修复（已发布，待手测）

- Agent 会话内容区此前为 `z-10`、底部 Composer 为 `z-0`，导致 Composer 内即使菜单
  使用 `z-50`，仍被结果图片或视频遮挡。Composer 容器现提升到 `z-20`；模式和 `+`
  素材菜单均可在会话媒体之上显示，不改变菜单行为、生成逻辑或埋点。
- 回归测试覆盖两层容器的层级关系。`npm run test`：394 passed、11 skipped、0 failed；
  `npm run design:check` 与 `git diff --check` 通过。仍需登录态手测 390/768/1440px 的
  Agent 模式菜单和 `+` 菜单，确认其覆盖结果媒体且可正常选择/关闭。

## 2026-09-17 生成设置与引用校验生产发布

- 已提交并推送 `41b4f19 feat: unify generation settings and reference validation`；本地
  `HEAD`、`origin/main` 与 GitHub `main` 已核对一致。远端仅保留 `main`，没有需合并、推送
  或清理的其他分支。
- Vercel 生产部署 `dpl_8DYwpMMTbDjtkW8jF4JhiaDqWGTq` 已 READY，绑定
  `https://www.flownana.com`、根域名和 Vercel 别名。此产物包含统一 Generation Settings、
  Reference Picker/服务端所有权与元数据检查、媒体时长校验、Agent 报价与引用收敛、Toast 与
  共享媒体预览行为，以及对应的产品/设计/测试更新。
- 本地 `npm run test` 为 393 passed、11 skipped、0 failed；`npm run design:check`、
  `npm run lint -- --quiet`、`npm run build` 与 `git diff --check` 通过。生产
  `npm run smoke:prod` 全部通过：首页、Image、Video、Assets、旧路由、演示视频、未登录 API
  边界、Suno 410 和 Veo options 均符合预期。
- 仍需登录态手测：390/768/1440px 下的 Generation Settings、直接上传/Assets 引用限制 Toast、
  上传占位和替换、Agent `@` 引用及超过 10 分钟报价后的真实生成；冒烟不覆盖真实 Provider、
  Stripe 或付费数据库链路。

## 2026-09-17 Composer 引用缩略图与上传占位（已发布，待提交）

- Image/Video Composer 的参考图片和视频统一为 80px 的 1:1 缩略图，移除名称文字；删除
  `X` 改为与结果 Download 一致的深色圆形悬浮控件，桌面 hover/focus 后出现，触控常显。
  横向素材列表使用低对比度细滚动条。视频引用在右下角显示已有元数据的时长；旧草稿
  缺少元数据时，缩略图加载后从浏览器媒体元数据补齐显示。
- 已发布至生产部署 `dpl_XahcmzkESw5YRH8LTPB3qaewKyhw`，状态 READY，绑定
  `https://www.flownana.com`。本地 `npm run design:check`、`npm run lint -- --quiet`、
  `npm run test`（393 passed、11 skipped、0 failed）、`npm run build` 和 `git diff --check`
  通过；生产冒烟的页面、旧路由、视频演示、未登录 API 边界、Suno 410 和 Veo options
  已逐项通过。仍需登录态手测实际文件上传中的占位动画与上传成功替换。

## 2026-09-17 素材选择即时 Toast（已发布，待提交）

- 上传或从 Assets 选择素材遇到类型、数量、大小或时长限制时统一显示 Toast，不再在
  `+` 菜单或 Composer 展示上传中、失败卡、红点和行内限制提示；通过校验的素材仍在后台
  上传/检查后自动加入草稿，生成操作在此期间继续被安全阻止。通过本地校验且开始上传的
  素材在 Composer 中显示 loading 占位；视频占位显示已取得的时长。

## 2026-09-17 引用提前校验与 Toast（本地，待发布）

- 从 Create 结果或 Assets 点击 `@` 添加引用时，按当前模型限制先校验；不支持素材不会
  加入 Composer，而是立即显示 Toast。移除 Composer 中的红色引用状态和 Resolve 提示。
- 首次生产部署被 Agent 结果引用的 TypeScript 类型收窄错误阻断；改用显式 image/video
  判断后再重新验证与部署。
- 生产部署 `dpl_AmE8wVX39JFEetBdswTUsNoZjCE2` 已 READY 并绑定主域名；
  `npm run smoke:prod` 全部通过。线上冒烟未包含登录态点击 `@` 的视觉交互，仍需手测。
- `npm run test`：393 passed、11 skipped、0 failed；`npm run design:check`、
  `npm run lint -- --quiet`、`npm run build` 与 `git diff --check` 通过。仍需登录态
  手测单引用模型连续点击两个结果时的 Toast、草稿不变及 Assets 入口。

## 2026-09-17 Agent 与 Image 结果操作统一（已发布，待提交）

- Agent 的图片和视频结果不再维护独立的悬浮操作按钮，改为直接复用 Image 结果的
  `ResultOverlayActions`：Reference、下载、删除的 36px 按钮、16px 图标、间距、右上角
  定位、阴影及桌面悬浮/移动端常显规则完全一致。视频点击 `@` 会以普通视频参考预填到
  Agent Composer，随后可描述需要保留或改变的内容；视频与图片均支持纯参考消息。
- `npm run test`：393 passed、11 skipped、0 failed；`npm run lint`：0 errors、25 条既有
  warning；`npm run design:check`、`npm run build` 与 `git diff --check` 通过。仍需登录态
  对比 Agent 与 Image 的图片/视频结果悬浮按钮（桌面 hover、键盘 focus、移动端）。生产部署
  `dpl_nAtasbFDcae6EKp3KgsjywE18dJG` 已 READY 并绑定主域名，`npm run smoke:prod` 通过。

## 2026-09-17 Composer 引用缩略图精简（本地，待发布）

- Image/Video Composer 的引用图片和视频改为无外层卡片边框的直接缩略图；删除 `X`
  固定覆盖在右上角。移除左右排序按钮及对应的重排逻辑，引用继续按添加顺序提交。
- `npm run test`：393 passed、11 skipped、0 failed；`npm run design:check`、
  `npm run lint -- --quiet`、`npm run build` 与 `git diff --check` 通过。仍需在登录态
  手测图片与视频引用、多个引用的横向滚动及缩略图右上角删除按钮。

## 2026-09-17 Agent 报价与引用闭环（已发布，待提交）

- Agent 报价不再使用 10 分钟时间有效期；点击 Generate 时服务端继续重新校验会话 revision、
  模型/参数、素材、价格和积分余额，只有需求或可用条件发生变化才要求新方案。
- `@` Reference 预填到底部 Composer 后，即使没有文字也可发送；服务端拒绝真正的空消息。
  旧报价卡同时移除内部 Exact text 与重复参考素材，保持最终 Prompt、参数和积分主操作。
- 移除仍要求用户 Stop reply 的并发提示文案，保持 UI 不展示 Stop reply 的既定体验。
- `npm run test`：393 passed、11 skipped、0 failed；`npm run design:check` 与 `npm run build`
  通过；`npm run lint`：0 errors、25 条既有 warning；`git diff --check` 通过。生产部署
  `dpl_DLVZofxbjZP6moGiy7UDcxurXGYJ` 已 READY 并绑定主域名，`npm run smoke:prod` 通过。
  仍需登录态手测超过 10 分钟的报价、纯引用消息、参数重算和 390/768/1440px 菜单布局。

## 2026-09-16 当前工作区完整检查与生产发布

- 用户确认“再次完整的检查下，没有问题的话就上线”后，从当前工作区发布
  `dpl_Fz8eyMEtkhDByk1RE7eHKvUBAJnx`。状态为 production/READY，已绑定
  `https://www.flownana.com`；Vercel 远端 Next.js 构建与 Prisma Client 生成均通过。
- 发布前完整检查通过：`npm run test` 为 392 passed、11 skipped、0 failed（共 403 个），
  `npm run design:check`、`npm run build` 与 `git diff --check` 均通过；`npm run lint` 为
  0 errors、26 条既有 warnings。测试输出曾记录一条既有 provider disconnected 诊断，未导致
  用例失败。
- 发布后 `npm run smoke:prod` 全部通过：首页、Image、Video、Assets、旧 AI 路由重定向、
  视频静态资源、未登录账单/作品/生成 API 边界、Suno 410 与视频选项接口均符合预期。
- 本次包含 Image/Video 切换 Agent 时改为前往 `/?mode=agent` 且 Home 初始选中 Agent 的修复，
  以及当前工作区内此前已检查的改动。仍需在真实登录态手测该入口和实际生成承接；真实
  Provider、Stripe 与数据库付费链路未在本次线上冒烟中执行。未提交或推送 Git。

## 2026-09-16 Agent Composer 与视频报价精简（本地）

- 回复准备中只显示加载状态，不再显示 Stop reply。Agent Composer 的参考素材默认普通 Reference，移除用途标签/下拉选择；用户通过对话文字表达用途。
- 会话内的参考素材统一显示在文字上方，使用紧凑缩略图；发送成功后清空 Prompt 和所有临时素材，修复选图生成视频后附件残留。
- 图片/视频引用已有生成结果时，最终报价 Prompt 不再拼接原图约束、方向或请求变更。报价参数入口和积分主按钮改为同一行；参数面板以 Agent 内容滚动区的上下边界计算可用空间，避免被底部 Composer 遮挡。
- PRODUCT、DESIGN、AGENT-SPEC 已同步；`npm run test` 392 passed、11 skipped、0 failed，`npm run lint` 0 error、26 条既有 warning，`npm run design:check` 与 `npm run build` 通过。待真实登录态手测后发布。

## 2026-09-16 Agent 历史报价与图片操作精简（本地）

- 已被替代、过期或已提交的报价不再显示状态标题、查看详情、失效提示或不可用按钮，仅保留必要 Prompt 摘要。
- Agent 图片右上角操作补回 `@` Reference；点击会把该图作为参考素材预填到底部 Composer，不发送。暂时移除图片结果下方的 Edit image 和 Make video 操作；Download、Delete、预览与失败重试保持。
- PRODUCT、DESIGN、AGENT-SPEC 已同步；`npm run test` 392 passed、11 skipped、0 failed，`npm run lint` 0 error、26 条既有 warning，`npm run design:check` 与 `npm run build` 通过。待登录态手测后发布。

## 2026-09-16 Agent 报价卡轻量化（本地）

- 有效报价反馈移除需求概括两侧的中文书名号；报价卡不再显示“Ready to generate”标题，外层卡片边框也不再包住 Prompt。Prompt 使用单层柔和输入面，避免框套框。
- Generate 主按钮与 Image/Video Composer 一致，只显示 `N credits` 和 Send 图标。模型参数面板改为按触发器上下可用空间自动选择展开方向，并限制高度在可见区域内；空间充足时优先向下。
- PRODUCT 第 18.6、DESIGN 和 AGENT-SPEC 已同步；`npm run test` 392 passed、11 skipped、0 failed，`npm run lint` 0 error、26 条既有 warning，`npm run design:check` 与 `npm run build` 通过。待真实登录态的桌面/手机菜单位置验收后发布。

## 2026-09-16 Agent Composer 底部提示移除（本地）

- Agent Composer 下方不再展示“剩余回复次数／重置时间／媒体消耗积分”提示，避免与界面内的生成积分信息重复；报价和生成按钮内的积分展示不受影响。
- 待本地设计检查后发布；需在登录态 Agent 空会话和已有会话确认 Composer 底部无残留间距或提示。

## 2026-09-16 Agent 可编辑报价卡与同 Prompt 四图（本地）

- 用户确认 Agent 图片方案默认创建 4 张，共用同一份优化 Prompt、参考素材和参数；不再为每张注入不同方向 Prompt。图片编辑保留默认 1 张，视频仍单输出。
- Agent 形成报价后的反馈改为“已为你准备好「需求概括」生成方案，点击 Generate 即可生成。”；概括来自 Agent 的简短目标摘要，模型与参数留在卡片中，不在反馈重复。
- 当前有效报价卡可直接编辑优化 Prompt，并复用普通生成的模型/参数面板；编辑后服务端重算、保存合法规格与价格，按钮同步显示 `Generate · N credits`，重算完成前禁止生成。没有独立总积分或“修改要求”按钮。
- 新增 Agent `reprice` 服务端动作，确认前仍重验账号、会话 revision、素材、白名单、价格与余额，避免卡内编辑或重复点击造成按旧报价扣费。PRODUCT 第 18.6、DESIGN、AGENT-SPEC 已同步。
- `npm run test` 392 passed、11 skipped、0 failed；`npm run build` 与 `npm run design:check` 通过；`npm run lint` 0 error、26 条既有 warning。未做真实 Provider 调用、未部署；仍需登录态手测新建图片/视频报价、Prompt/模型/参数编辑、变价、过期报价、重复 Generate、积分不足及 390/768/1440px 布局。

## 2026-09-16 Agent 空会话底部菜单锚定修复（本地）

- `/agent` 空会话的 Composer 位于视口底部，但模式选择器和“+”素材菜单此前按向下展开配置，导致模式菜单落到输入框下方并可能超出视口。
- 两个菜单现在始终向上展开；不改变模式切换、草稿、上传或发送行为。`npm run design:check` 与 `npm run lint`（0 errors、26 条已有 warning）通过；本地浏览器已检查桌面和 390px 手机视口，菜单均完整显示在输入框上方。未部署。

## 2026-09-16 Agent 交互与媒体统一生产发布

- 用户明确授权“发布上线吧”。当前工作区通过 Vercel 生产部署
  `dpl_7kFvbB94TkKhv2EKWujxEasA6tyF`，状态 READY，已绑定
  `https://www.flownana.com`、根域名和 Vercel 别名；云端 Next.js 构建与 Prisma Client
  生成通过。
- 发布后 `npm run smoke:prod` 全部通过：首页、Image、Video、Assets、旧 AI 路由重定向、
  视频静态资源、未登录账单/作品/图片/视频 API 边界、Suno 410 与视频选项接口均正常。
- 本次未提交或推送 Git。真实 Agent 成功媒体生成、成功态浏览器预览/播放/下载仍需要有
  合规 KIE 或 Volcengine 凭据的隔离验收；此前本地测试账号已删除，后续应新建账号。

## 2026-09-16 Agent 对话交互与媒体结果统一（本地完成，未发布）

- 用户确认按 ChatGPT 式选择/确认习惯收敛 Agent。快捷单选答案点击后立即作为右侧
  用户消息发送；自由输入仍可覆盖。报价里的多个方向明确标为一次任务的变体说明，
  不是可点选项；只有“Generate”会执行已展示积分的整份报价。
- 当前有效报价默认展开；已过期或被新请求替代的报价收起为摘要，已提交报价也以
  紧凑规格摘要展示，避免在会话中重复完整方案。修改要求继续预填 Composer，等待
  用户自行发送。
- Agent 图片改为保持原始比例，不再以 `aspect-square` 黑底框显示；视频复用普通
  Create 的播放、进度、静音和预览组件。图片/视频继续走共享全屏预览与下载；图片
  的 Edit image / Make video 只预填文本和素材，不自动创建任务或扣费。Agent 成功
  结果增加与普通工作台一致的下载/删除悬停操作及删除确认。
- PRODUCT 第 18.6、DESIGN 和 AGENT-SPEC 已同步。`npm run design:check`、`npm run lint`
  （0 error、26 条已有/`img` 相关 warning）、`npm run test`（392 passed、11 skipped、0 failed）
  和 `npm run build` 均通过。本地模板空会话桌面页已视觉检查；待登录态手测
  390/768/1440px 下追问、报价、图片、视频和删除；未部署、未提交。

## 2026-09-16 Agent 独立账号真实链路验证（本地）

- 使用仅当前本地 `next start` 进程的 Credentials 测试身份创建
  `agent-ui-test-20260916`，初始 1000 测试积分；未触及生产账号或生产部署。
- 真实 OpenRouter Agent 流程已验证：模板首轮提出带 5 项快捷答案的 question；提交
  “限时优惠”后，用户消息、会话 revision 和后续精确文案追问均持久化；补全文案后得到
  4 个方向的 Flare 2K / 16:9 / 12 credits 报价。第二个会话从 1:1 报价修改为 9:16
  新报价，旧 quote revision 小于会话 revision，满足 UI 的 Previous quote 判定。
- 已真实确认四图报价。当前本地没有 KIE 或 Volcengine 凭据（只有不被运行时代码接受的
  Nano Banana 变量），所以 4 个任务均失败并自动退款；账单回到 1000 credits、无活跃
  媒体任务。成功图片/视频、播放器、预览、编辑预填和删除成功态仍需在配置合规媒体
  Provider 凭据的隔离环境手测；不得把失败退款测试表述为成功媒体验证。
- 为单独验证已实现的成功态结果 UI，在同一隔离账号内短暂创建并明确标记 `fixture: true`
  的本地图片和视频记录；真实 Agent 读接口按账号 scope 返回这两种 `success` 输出，图片
  静态资源为 200，视频资源为 `206 Partial Content`、`video/mp4` 且支持 byte range。随后
  通过真实 `/api/creations` 删除接口分别删除两项，记录均变为 `deleted` 且 URL 为空；fixture
  会话已软删除、无待清理 URL。该夹具不涉及 Provider 调用或积分，不能替代真实出图/出视频验收。
- CUA 浏览器服务在登录态页面检查时超时并重置，故没有把浏览器截图、点击播放、全屏预览、
  Edit image / Make video 预填或下载交互记为已通过。静态 fixture 的下载 API 对相对路径返回
  500（生产只应接收受控 Blob URL），也不作为生产下载失败结论；仍需有合规媒体凭据的隔离环境
  完成成功媒体的视觉与交互验收。
- 补充：本地 `next start` 以 production NODE_ENV 启动时，原实现会为显式启用的
  Test Login 使用 secure Cookie，导致 localhost HTTP 浏览器登录后仍为未登录。现在仅在
  `testAuthEnabled` 时关闭 secure Cookie；正式生产未启用该测试 Provider 时不变。`npm run build`、
  `npm run test`（392 passed、11 skipped、0 failed）、`npm run lint`（0 error、26 warnings）及
  `npm run design:check` 均通过。内嵌浏览器仍隔离/拦截该会话，独立 Chrome 自动化连接超时，
  因此浏览器成功态验收仍未完成。
- 本地认证响应已核对为普通 localhost Cookie；用于该诊断的独立测试账号随后删除，
  使测试会话失效。真实成功媒体测试目前被明确阻断：运行时没有 KIE 或 Volcengine
  凭据，Nano Banana 变量不参与 Agent 执行；需要新的隔离 Provider 凭据后再创建新测试账号继续。

## 2026-09-15 全局媒体预览规范统一（已发布生产）

- 预览统一使用原生 Modal 时，媒体预览此前只给 dialog 内容层设置背景，`::backdrop` 保持透明，部分浏览器布局下视口顶部页面内容会露出。
- Create、Assets、Explore 和 Agent 的普通媒体预览统一到 `components/ui/media-preview-modal.tsx`，共享全视口遮罩、右上角关闭、遮罩点击、Esc、媒体尺寸、原始比例、视频 controls/autoPlay/playsInline 和媒体重试；My Creations 保留详情侧栏但同步关闭、遮罩、滚动和媒体尺寸规则。
- PRODUCT/DESIGN 已写入全局预览规范。`npm run design:check`、`npm run lint`、`npm run build` 和 `npm run test` 已通过（测试 392 通过、11 跳过、0 失败；lint 为 26 条 warning，均为现有 img/Hook/导航规则）。
- 用户要求上线后部署 `dpl_GmEdoZ6yAqXESgY2egXKwpcWZ1ac` 为 production/READY，已绑定 `https://www.flownana.com`；`npm run smoke:prod` 全部通过。
- 本地 agent-browser 不可用，未完成截图级视觉验收；仍需登录态在 390/1440px 手测 Image/Video/Assets/Explore/Agent/My Creations 的图片、视频和 Esc/遮罩点击关闭。未提交或推送 Git。

## 2026-09-15 当前工作区改动生产发布

- 用户确认“上线”后，重新完成 Vercel CLI 授权，从当前工作区发布部署
  `dpl_B8s62hQoHrs5Bg28PQTCo3ZUNc8X`，状态为 production/READY，已绑定
  `https://www.flownana.com`。
- Vercel 远端构建成功；`npm run smoke:prod` 全部通过：首页、Image、Video、Assets、旧路由
  重定向、未登录 API 边界及视频选项接口均正常。
- 本次发布包含当前工作区中此前已确认但未发布的改动，包括 Image/Video 切换 Agent 返回 Home、
  Home 生成后进入对应工作台及 Prompt 区移除自动参数提示。仍需登录态人工验证 Agent 入口、
  生成承接、真实 Provider/Stripe/数据库付费链路；未提交或推送 Git。


## 2026-09-15 Image/Video 切换 Agent 返回 Home 并选中 Agent（本地修复，未发布）

- Image/Video Composer 的 Agent 模式入口不再跳转 `/agent`，改为返回 `/?mode=agent`，由 Home
  承载并初始选中 Agent；Home 内原有 Agent 模式和模板进入独立会话的路径保持不变。
- PRODUCT 已同步，新增导航回归测试；待运行检查和登录态手测，未发布生产。

## 2026-09-15 移除自动参数提示进入 Prompt 区（本地修复，未发布）

- Image/Video 的 `settingsNotice` 原本同时显示在参数面板和 Composer 文本区；引用图片后自动调整比例时，
  因此会在 Prompt 上方出现 “Adjusted ... to match this model and its inputs.”。
- 现在仅在模型/参数面板保留该说明，Prompt 区恢复纯输入，不影响参数自动修正、提交校验或必要的上传/错误反馈。
- DESIGN 已同步；待运行 UI 检查和登录态手测，未发布生产。

## 2026-09-15 Home 生成后进入对应工作台（本地修复，未发布）

- Home 的 Image/Video 普通生成在服务端接受任务或同步返回成功结果时，分别显式进入
  `/image` 或 `/video`；失败、积分不足和状态不确定时保留在 Home 并保留输入反馈。
- 跳转继续使用 Next 集成的原生 History，保留当前页面中的乐观生成记录、草稿和轮询状态；
  处理器不再依赖可能过期的 `composerType` 闭包。
- 现有 Home 提交回调回归覆盖已通过；待登录态手测，未发布生产。

## 2026-09-15 Toast 展示规则调整（已发布生产）

- 全局 Toast 水平居中、垂直起点位于视口约三分之一处；只展示简短正文，不展示标题。
- 默认 3 秒自动消失，移除手动关闭按钮，最多同时保留最近 3 条；弹窗内仍通过 portal
  到最上层原生 dialog，避免被遮挡。
- PRODUCT/DESIGN 已同步；检查通过。用户确认发布后部署 `dpl_CGfguHahMGsTYBA5Co7DzpnWUZ6V` 为
  production/READY，绑定 `https://www.flownana.com`（iad1）；`npm run smoke:prod` 全部通过。

## 2026-09-15 Toast 覆盖原生弹窗（已发布生产）

- 原生 `dialog.showModal()` 位于浏览器 top layer，普通固定层级的全局 Toast 会被上传弹窗遮住。
- AppToastProvider 发现打开的 dialog 后，将 Toast portal 到最上层 dialog 内；无弹窗时仍挂在全局层，
  保持屏幕中央和统一样式。
- PRODUCT/DESIGN 已补充 Toast 必须高于当前弹窗的规则；`npm run design:check`、`npm run build`、
  `npm run lint` 和 `npm run test` 已通过（测试 391 通过、11 跳过、0 失败）。
- 用户确认发布后部署 `dpl_Cri6zRaQvh6316vb8JwtkcHVXpLT` 为 production/READY，
  绑定 `https://www.flownana.com`（iad1）；`npm run smoke:prod` 全部通过。

## 2026-09-15 Assets 不兼容素材正常显示与点击防闪（已发布生产）

- ReferencePicker 不兼容图片/视频恢复正常显示，不置灰、不覆盖；点击时不选中，
  通过 Toast 说明当前模型限制。
- 素材点击改为即时临时选中、后台检查，检查失败时回滚并提示；移除原先 per-card
  checking 遮罩，避免点击时整卡闪烁。固定 All/Images/Videos/Audio 分类保持不变。
- 用户确认发布后部署 `dpl_CkgMm4UTtwi6TEh7YzeVi6FcU8Jc` 为 production/READY，
  绑定 `https://www.flownana.com`（iad1）；`npm run smoke:prod` 全部通过。
- 未提交或推送 Git；仍需登录态手测超限素材 Toast、支持素材无闪烁及检查失败回滚。

## 2026-09-15 移除 Grok 视频无图提示（已发布生产）

- 移除选择 `Grok Imagine Video 1.5` 且无图片时在输入框显示的“Add an image reference to use this model.”；
  同步不再注入设置面板。`imageRequired` 的提交前校验和禁用生成逻辑保持不变。
- `npm run design:check`、`npm run build` 已通过；lint 0 错误、29 条既有警告。
- 用户确认发布后部署 `dpl_4PXPrX3rJZuAE9AvraaeJGtudxZd` 为 production/READY，
  绑定 `https://www.flownana.com`（hnd1）；`npm run smoke:prod` 全部通过。
  未提交或推送 Git；仍需登录态手测 Grok 与其他视频模型切换。

## 2026-09-15 Assets 固定媒体分类与防闪（本地完成，未发布）

- ReferencePicker 顶部筛选固定显示 All、Images、Videos、Audio，不再根据当前模型隐藏类别；
  不支持的媒体仍在对应分类中正常展示，不置灰或覆盖，点击以 Toast 说明限制，不放宽模型校验。
- 点击素材先即时进入临时选中态，元数据检查在后台完成；检查失败时回滚选中并提示，避免
  原先 per-card checking 遮罩造成的点击闪烁。
- PRODUCT 第 21.2 节与 DESIGN 已同步；待运行检查并手测登录态资料库。

## 2026-09-15 Toast 与不兼容素材反馈（已由后续交互修订）

- 全局 AppToastProvider 改为屏幕中央紧凑浮层，统一标题/说明、语义图标、自动消失和手动关闭；
  现有 Toast 调用无需逐页调整。
- ReferencePicker 在资料库网格中保留当前模型不支持的素材并正常显示；点击不会选中，
  而是使用 Toast 展示具体限制原因。上传与服务端校验规则未改变。
- `npm run design:check`、`npm run build` 和 `npm run test` 已通过；lint 0 错误、29 条既有警告。
  尚未发布生产，仍需手测 390/768/1440px 下 Toast 居中和不兼容素材点击反馈。

## 2026-09-15 Assets 选择卡片交互（已发布生产）

- 用户确认将资料库选择窗对齐 ChatGPT 式直接选中交互。ReferencePicker 的图片、
  视频和音频卡片点击即切换临时选中，选中使用品牌蓝描边与勾选；移除预览/放大、
  眼睛按钮、Prompt/名称及卡片内 Select 操作。底部 Add N assets 仍是唯一写入
  Composer 草稿的确认操作。
- 选择将超过当前模型输入限制时，保持已有临时选择并通过 warning toast 显示具体
  限制；媒体元数据检查失败也使用 toast，服务端添加前的所有权、可用性和输入约束
  复核保持不变。PRODUCT 第 21 节与 DESIGN 已同步。
- 待验证：登录账号下分别测试图片、视频、音频多选/取消、模型上限与上限+1、
  已添加素材、检查失败/失效素材，以及 390/768/1440px 下键盘和触控选择；
  未执行真实 Provider 或付费链路。
- 用户明确“好的发布”后重新完成 Vercel CLI 授权并部署当前工作区。部署
  `dpl_AeLGdqLa73usQ2ZuZUVu833jMtSE` 为 production/READY，绑定
  `https://www.flownana.com`（函数区域 hnd1）。`npm run smoke:prod` 全部通过；
  未提交或推送 Git。登录态 Assets 选择与真实 Provider/付费链路仍待人工验收。

## 2026-09-14 Grok切换防跳动修复生产发布

- 用户明确“发布”后从当前工作区部署，未提交或推送Git。
- 部署dpl_HjsgS5R1CUsJkFJbZGBzNvygJePa，production/READY；inspect确认
  www.flownana.com与flownana.com绑定flownana-abi1yacrx-liangchusans-projects.vercel.app。
- 本次发布包含上一条Grok模型提示固定文本区修复；本地build/design:check已通过，
  云端构建成功，npm run smoke:prod全部通过。
- 建议刷新线上，在MiniMax与Grok 1.5之间切换检查外框高度；未执行真实付费生成。

## 2026-09-14 Grok 1.5 模型切换防跳动（本地完成，未发布）

- Grok Imagine Video 1.5 无输入图时会显示“Add an image reference”提示；此前提示
  作为独立行插入，将Composer撑高并推动页面。Image/Video模型提示现改为固定
  80px文本区内的绝对定位状态文字，最多两行；出现或消失不改变外框高度。
- DESIGN已同步；design:check、build通过。浏览器实测切换前后Composer外框均
  175px，Grok提示仍显示，文本区仍为80px。本地3117预览已更新，未发布生产。
- 手测Home与Video页在MiniMax、Grok及其他需要输入素材的模型间切换；较长的
  两行提示会占用部分输入文字可视高度，但文本区可正常滚动。生成逻辑未改。

## 2026-09-14 输入框与下拉界面迭代生产发布

- 用户明确“好的，发布”后，通过npx vercel --prod --yes从当前工作区发布已确认
  的界面迭代：680×360锚定面板、底部向上展开、模型对齐与通用勾选、移除菜单
  数量大小提示、切换闪动优化、三种模式空态输入框等高。未提交或推送Git。
- 部署dpl_2MeRrBFv8NRC5VPPFAKLN1EPB3Q6，production/READY，inspect确认
  www.flownana.com和flownana.com已绑定flownana-lbsg1lv74-liangchusans-projects.vercel.app。
- 当前版本本地build/design:check通过；发布前测试402项，391通过、11数据库相关
  跳过、零失败；lint零错误、30既有警告。云端构建成功，npm run smoke:prod全通过。
- 建议线上手测三种模式切换、等高输入框、上下展开与素材菜单；未触发真实付费
  生成或Stripe交易。慢网预加载未完成时跨路由仍可能出现正常加载状态。

## 2026-09-14 三种模式输入框等高（本地完成，未发布）

- AgentComposer与Image/Video统一80px固定文本区、8px间距和带分隔线的工具栏；
  移除仅Agent可拖动文本区的差异，无障碍名称改用aria-label保留。Agent独立页面
  外框同步手机10px、sm起12px内边距。附件和提示按内容扩展，DESIGN已同步。
- build、design:check通过；桌面实测Image/Video/Agent空态外框均175px，手机
  Video/Agent均171px，手机截图已检查。3117预览已更新，未发布。
- 手测三种模式切换、多行文字内部滚动和附件展开；未改生成逻辑，无新增已知风险。

## 2026-09-14 页面切换闪动修复（本地完成，未发布）

- 浏览器复现首次Home到Video时输入框和结果区出现两块Loading骨架；原因是
  VideoCreationForm/CreationStream动态加载，首页AgentComposer同样延迟加载。
  三个核心组件改为静态导入，AssetsLibrary仍按需加载。
- 进入Agent曾显示Loading page；新会话入口增加完整prefetch，Agent工作区
  侧栏跨路由入口完整prefetch，减少只有loading边界被预取造成的闪动。
- build、design:check、5项workspace-navigation测试通过；lint零错误、30既有警告。
  浏览器修复后首次Video直接出现表单和结果空态，Video到Agent再到Image未观察到
  加载骨架；390px手机Image到Video直接切换。预览3117已更新，未发布。
- 手测刷新后首次切换三种模式、Agent页面往返和带草稿切换。首屏包含更多核心组件；
  慢网或预加载尚未完成时跨路由仍可能出现正常加载状态。未测试登录账号真实生成，
  生成、积分或埋点规则未改。

## 2026-09-14 移除素材菜单底部提示（本地完成，未发布）

- ReferencePicker移除数量/单文件大小说明，仅保留Upload files和Choose from Assets；
  Image/Video/Agent共用，输入限制及错误提示保持。PRODUCT/DESIGN同步。
- design:check、build通过；桌面及390px手机浏览器确认菜单只有两个操作，本地3117已更新。
- 手测刷新后展开“+”菜单即可；未改校验逻辑，无新增已知风险，未发布生产。

## 2026-09-14 恢复通用勾选图标（本地完成，未发布）

- 模型列表恢复与模式菜单一致的16px Lucide Check；Models标题、模型名称与描述
  统一右移12px，保持左对齐，勾选图标与文字间距8px。DESIGN/PRODUCT同步。
- design:check、build通过；浏览器检查桌面文字x均529.09、手机x均57，图标
  均16px；桌面截图已检查。本地3117预览已更新，未发布。
- 建议刷新后手测切换模型的勾选状态；仅样式变更，较长介绍因宽度减少可能多换一行。

## 2026-09-14 模型列表对齐与底部向上展开（本地完成，未发布）

- 模型名称与Models标题左对齐；收紧左侧留白与勾选图标，模型行垂直内边距缩小。
- GenerationSettings使用placement属性，Home向下、Image/Video底部Composer向上，
  距入口12px；移除占位空间，打开面板不移动输入框。680×360外框和内部滚动保持。
- PRODUCT 22.1、DESIGN同步。design:check、build通过；浏览器验证首页向下，
  Image/Video向上（入口y639，面板底y627），展开前后入口位置不变；标题文字与
  模型名称x均517.09。390px手机面板358×360、x16，已检查桌面/手机截图。
- 本地预览3117已更新，未发布生产。手测重点：模型滚动、底部展开及手机参数区
  滚动；本轮仅布局改动，未调用付费生成，极矮视口/手机软键盘仍建议真机验证。

## 2026-09-14 下拉面板尺寸压缩（本地完成，未发布）

- 用户要求整体缩小、高约360px；桌面从768×480改为680×360，模型/参数仍为
  40%/60%，独立滚动。底部Composer预留空间同步缩小，DESIGN同步新尺寸。
- build、design:check通过；浏览器恢复连接，实际测量桌面680×360、小屏390宽时
  358×360。已查看两端布局；手机上下两区需分别滚动查看完整选项。
- 预览 http://localhost:3117/ 已更新。建议手测模型列表与手机参数滚动；未改
  生成/计费逻辑，未发布生产。

## 2026-09-14 下拉面板简洁样式（本地完成，未发布）

- 按用户截图反馈移除整个顶部标题/关闭行与底部说明/积分行；保留非视觉无障碍
  名称、入口/外部点击/Esc关闭，积分仍由生成按钮展示。固定尺寸和独立滚动保持。
- 右侧比例高80→56px，图标缩至12–20px，标签12px；桌面分段按钮高44→32px，
  小屏保留44px触控高度。时长区缩小内边距与字号，仍只选择合法档位。
- PRODUCT 22.1、DESIGN 已同步。npm run build、design:check通过；lint无错误、
  30既有警告。最新构建已启动在 http://localhost:3117/。
- 本轮浏览器连接两次失败（超时及 nodeRepl.fetch request failed），没有声称
  完成新版本桌面/手机视觉验收。需手动刷新预览，检查两行移除、右侧紧凑控件、
  独立滚动与Esc收起；生成/计费逻辑未改。本轮未发布生产。

## 2026-09-14 模型参数面板改为入口下拉（本地完成，未再次发布）

- 用户指出应在选项入口下方展开，不能是居中独立浮窗。GenerationSettings 已
  移除 Modal/遮罩，改为锚定入口下方 12px 的非模态面板；桌面 768×480，宽高
  受视口限制。模型列表、参数区独立滚动，标题/底栏固定，模型切换不撑高外框。
- Home 面板覆盖下方内容且不遮暗页面；底部 Composer 为面板预留空间，使入口
  上移、面板仍位于其下方。点击外部、再次点击入口、Esc/关闭按钮均可收起，
  参数即时保留；键盘离开面板时收起。PRODUCT 22.1 和 DESIGN 已同步。
- npm run build、design:check 通过；lint 0 错误、30 既有警告。内置浏览器检查
  1440/768/390px：桌面面板480高；768视口面板736宽480高、左侧内容713高可滚动；
  手机面板358宽，边界x16到374，无横向溢出。已验证底部入口在面板上方及Esc。
- 手测重点：Home/Image/Video 的展开位置、长模型列表滚动、模型切换时尺寸稳定、
  手机参数区滚动。纯布局修正未改生成与计费逻辑；本轮尚未再次部署生产。

## 2026-09-14 统一素材入口与合并设置生产发布

- 用户明确“发布”后从当前工作区部署（基线 HEAD 2c9af01，加本轮尚未提交的
  代码与文档改动）；未执行 Git 提交或推送。最初 CLI 授权失效，重新登录成功后
  使用已有 Vercel CLI 59.7.0 完成部署；未改变环境变量或数据库结构。
- 部署 dpl_VxJxEUPh6Qbnp2mD9Tbd9tQpAGMh，状态 READY，target production；
  https://flownana-hk3oqi87l-liangchusans-projects.vercel.app 。inspect 确认
  https://www.flownana.com 与 flownana.com 均绑定该部署。
- npm run smoke:prod 全部通过；新增 /api/creations/inspect 未登录 POST 返回401。
  本部署发布后 10 分钟范围内 error 日志查询未返回记录；这只覆盖短观察窗口，
  不代表真实付费生成链路已经验收。
- 仍需人工检查登录后的 Assets 多选、上传失败恢复、模型切换及 Agent 声音，
  真实 Provider 输出尺寸/声音、Stripe/数据库付费链路未在本轮执行。

## 2026-09-14 统一素材入口与合并设置（本地实现，未发布）

- 用户明确“可以，开干”后实现 PRODUCT 21/22。下方同日“需求阶段”条目为此前
  文档记录，本条覆盖其尚未开发状态；不改变生产部署状态，不授权发布。
- Home/Image/Video/Agent 复用 ReferencePicker 与 CreationModeSelector；模式菜单
  固定勾选/图标/文字列。Assets 支持搜索、类型筛选、多选确认、独立预览、去重，
  不新增上传素材库。每个上传单独失败/重试/取消，检查失败保留已上传 URL，
  数量超限整批拒绝，待处理文件阻止生成。账号或组件失效中止旧操作。
- GenerationSettings 合并模型/参数入口与面板，桌面分栏、手机上下排列；图片
  数量 1–4，视频时长以合法档位索引驱动滑块。比例/分辨率白名单统一到服务端
  和 Agent，旧规格不再接受。MiniMax/HappyHorse 有图跟图；Grok 保留比例选择。
- 移除声音控件，按实际能力默认有声；Agent 默认有声，支持开关的模型允许明确
  无声要求。Kie MiniMax H3 官方页确认原生声音且当前接口无开关，修正本地
  hasAudio 标记，未改变供应商请求或积分公式。720P → 768P 映射沿用既有实现。
- 新 /api/creations/inspect 在所有权验证后检查真实媒体字节、格式与时长，Assets
  检查前后核对作品可用性及账号。直接生成及 Agent 扣费事务中检查 generated
  来源仍有有效作品，避免历史引用保留底层文件后绕过删除状态。视频/音频生成前
  再次检查单文件与合计时长；
  Agent 添加阶段只限平台大小与 22 个附件，生成阶段执行模型限制。
  MP4/MOV 读取 mvhd（含无声视频），MP3/WAV 使用 music-metadata；下载有超时与
  字节上限，Agent 顺序读取避免 22 个大文件并发占用内存，无数据库迁移。
- 本地验证：npm run test 402 项，391 通过、11 数据库集成测试跳过；lint 0 错误、
  30 警告（主要现有 img 和导航）；npm run build 与 design:check 通过。新增
  所有权/删除竞态/元数据失败路由测试、大小数量时长边界、无音轨 MP4/MOV、
  WAV、声音及白名单回归。检查为模拟边界+真实源码执行，未付费调用 Provider。
- 内置浏览器检查 390/768/1440px：设置布局无横向溢出、菜单两入口、模式列对齐、
  关闭焦点恢复、Gemini 键盘 4/6/8/10 秒及积分更新。当前浏览器为未登录状态，
  真实 Assets、上传断网/换账号和 Agent 付费确认仍需账号端人工验收。
- 剩余风险：真实供应商声音/输出尺寸和素材组合未生成验证；存量或特殊编码视频
  无有效 movie duration 时会明确拒绝，需用户重新导出；大量参考文件需逐个验证，
  慢网可能超时后重试。本轮未执行生产 Stripe/数据库/Provider 集成或生产部署。

## 2026-09-14 合并模型参数与 Agent 默认有声（需求阶段）

- PRODUCT 第 22 节记录用户的合并面板、选项白名单、时长滑块、移除声音开关
  需求；用户明确白名单和默认有声同步 Agent。PRODUCT 第 18 节、AGENT-SPEC
  的默认无声改为有声，DESIGN 补面板布局。本轮仍仅文档，应用代码未修改。
- 图生视频需按实际接口区分比例可控与跟随输入；分辨率独立。当前 MiniMax/
  HappyHorse 有图不传比例，Grok 会传，与旧产品统一跟图描述有差异。
- 2026-09-14 实时查看 https://kie.ai/minimax-h3：图生视频无比例字段，有分辨率，
  当前列 768P/2K。用户随后明确批准 768P 显示为 720P，直接创作与 Agent 一致。
  复核 lib/kie-video-request.ts 的 getKieVideoResolution 已将 MiniMax 的 720P
  档位映射为 Provider 768P，tests/kie-video-request.test.ts 已有对应测试。
  上轮将标签差异列为待修请求风险不准确，已纠正文档；不需要新增该映射，
  也不需要降采样或改价。本轮未运行测试、未验证真实输出尺寸，仍仅修改文档。
- 剩余人工验收：面板/摘要一致性、模型切换、旧草稿/Reprompt、离散时长、
  真实图生视频尺寸、Agent 默认有声和显式无声、声音报价及实际输出。播放器
  默认静音保持。本轮未执行代码测试、真实付费或部署。

## 2026-09-14 统一素材入口与模式菜单（需求已确认，尚未开发）

- 用户要求先讨论需求、形成产品文档再开发，并确认推荐方案。PRODUCT 第 21 节
  与 DESIGN 对应章节已落文档；本轮仅修改文档，没有改应用代码、测试或部署。
- Home/Image/Video/Agent 共用“+”两项菜单、本地上传与 Assets 选择窗；Assets
  继续仅收录成功生成作品，上传参考文件不自动入库。多选确认、异常反馈、
  Agent 两阶段校验及三模式勾选/图标/文字对齐均作为后续验收要求。
- 当前实现仍为分开的 Composer 与 Agent 附件交互，Agent 独立 Assets 按钮和
  原生模式 select 等尚未统一，不能将文档状态表述为已修复。
- 待开发前核对逐模型输入约束，尤其单文件/合计时长及组合；Seedance 图片配置
  30 MB 与平台上传 20 MB 存在差异，本地上传按平台 20 MB 执行。Assets 引用也需
  验证实际模型输入限制，未知元数据不能默认通过。上游范围变更另行确认。
- 后续人工验收：三模式草稿保留、Assets 多选/取消/搜索、超限与失效、上传
  部分失败/重试、登录及换账号、Agent 实际参考与重新报价、390/768/1440px
  弹窗和模式对齐。未运行代码测试或真实付费链路；本条不改变既有生产状态。

## 2026-09-14 性能修复第一批（已获发布授权，后台事务方案待确认）

- 用户要求“全部修复”。先完成不改变后台生命周期的改动：根 `app/loading.tsx`
  覆盖动态页面服务端等待，骨架适配移动和桌面；视频表单、Assets、历史内容流、
  AgentComposer 和 Pricing 弹窗内容采用 next/dynamic，保留原草稿/活跃操作归属。
- Inter 400–600 与 JetBrains Mono 400 改为本地 WOFF2，保留全部原字体语言子集、
  swap、许可证；只预加载 Inter latin。运行时不再请求 Google Fonts 两个域名。
- 服务端历史附完成时间，只有账号 scope 匹配且新鲜度在 10 秒以内才延后首次
  重复拉取，后续 10 秒轮询保持。过期种子、未来时间戳或换账号立即刷新。
  Agent 列表/会话 GET 按 scope+URL 合并在途请求，消费者独立取消；没有持久化
  私有缓存，事件变更使在途读取失效。侧栏不再因 pathname 变化清空和重读列表。
- 三个 GET（creations、agent、billing/summary）新增 Server-Timing 与随机
  X-Request-Id，结构化日志只记录固定路由、阶段、耗时和状态，不记录用户数据；
  业务 handler 顺序/返回数据、鉴权、GA4、后台锁和同步恢复均保持。
- 用户随后明确要求“发布”。性能提交 `0acaa41` 已推送 main，部署
  `dpl_3QLQCdQn4dUqhLFe85FGWSPwcbiL` READY 并绑定正式域名。
  `regions: ["hnd1"]` 已生效，真实 API 响应 X-Vercel-Id 确认函数在东京执行，
  与数据库同区。三个 GET 的计时头/401 及本地字体内容校验通过；无登录态提速量化。
- 首次生产冒烟发现根 loading 的流式响应使旧地址由 HTTP 308 变成 HTML 跳转/200。
  补充 next.config.js 的三个永久重定向，在渲染前返回原有 308 和目标地址；
  保留页面 fallback，未改变产品路由目标。补丁 `317c114` 已推送并发布为
  `dpl_83fkRJkoF4my8YPo7uFp2CMhqkV5`（READY、hnd1、正式域名已绑定）。
  补丁构建、本地完整冒烟、`npm run smoke:prod` 全部通过；最终 API 响应确认
  hnd1 和计时头，发布后 error/fatal 日志查询无记录（短观察窗口）。
- 验证：389 项测试 378 通过、11 项隔离数据库测试跳过；lint 0 错误/30 条已有
  警告，build、design:check 通过。新增测试覆盖并发读取去重、独立取消、账号
  epoch 隔离、变更后旧响应失效、种子时间边界及并发计时上下文隔离。
- 使用 agent-browser 成功进行本地生产预览检查：Home 1440/390/768px、Assets
  390px、Logo Agent 390px；手机和平板实测无横向溢出，Inter 已加载且外部字体
  请求为零，Home→Video→Assets→Home 保留草稿。未真实登录、付费或扣积分。
  首页 HTML 引用 JS/CSS 本地 gzip 估算从排查时 310,288 降至 296,856 字节（约 4%），
  仅资源体积比较，不是线上交互耗时改进；字体/图片不计入该比较。
- 自动审批拒绝只读快照/移除展示排他锁/响应后恢复补丁，认为需先明确产品
  范围并确认；该补丁未应用，未通过其他方式绕行。PRODUCT 第 20 节已列出待确认
  范围、边界和隔离并发验收。剩余主要风险仍是
  展示读取同步恢复与锁竞争，不能把本批称为全部根因已修复。
- 待人工检查：真实登录后首次/重复跳转、Agent 历史改名删除、多标签换账号、
  Pricing 嵌套弹窗、活跃生成时切换和任务恢复；后台事务方案仍待确认。

## 2026-09-14 线上整体响应慢排查（诊断，未改代码或部署）

- 用户反馈线上已登录时各页面跳转慢。实时核对正式域名部署为
  `dpl_8WdF7zMr5HnVhzTsWgXfTVRtFbvc`（READY），SHA `7ae6294` 与本地 HEAD 一致；
  函数区域 iad1，关联 Supabase 项目为东京 ap-northeast-1，存在跨区域串行数据库往返。
- 工作台页面在返回前等待 session + 历史；历史和 Agent 列表/会话读取同步执行
  任务/退款/媒体清理恢复，再取得 User FOR UPDATE 锁读取，Billing 也使用同一账号锁。
  根目录没有路由 loading.tsx，工作台内 Suspense 在上述 await 之后，不能覆盖等待。
- Supabase 应用角色累计统计：User 行锁最大执行时间 9351.53 ms，普通 Generation
  查询分类平均 0.170 ms；统计自 2026-05-18 重置，包含旧版本，不能视为本次跳转耗时。
  即时连接快照空闲，未证实当前池耗尽。历史/Agent 重复轮询会放大读取与锁竞争。
- 匿名 HTTP 每路由三次采样，首页/Image/Agent TTFB 约 0.89–1.30 秒；仅为本机
  网络基线，不代表已登录浏览器。浏览器工具连续超时，登录态瀑布/主线程仍待复测。
  Image/Video/Assets 同工作台内使用 History API 本地切换，不能全归因于服务端等待。
- 完整证据、资源检查、分批优化建议和手动复测项见
  `docs/PERFORMANCE-INVESTIGATION-2026-09-14.md`。未改产品行为/GA4，未改应用代码、
  数据库或生产配置，未运行代码测试/构建；拆分恢复与账号锁需保留退款和删号安全。

最近生产复核：2026-09-12（Agent 已发布，部署 READY；生产迁移与权限验证完成，详见末尾）。

此前生产复核记录：2026-09-10（Logo 替换已提交并推送为 `f2e6833`；生产部署
`dpl_H8nxw5pTZxYEbiexS6NPyF4BLL6V` 为 READY，正式域名
`https://www.flownana.com` 已绑定，`npm run smoke:prod` 全部通过。）

本文档记录当前代码实现、基础设施、部署状态和工程风险，不承担产品需求定义。

文档边界：

1. `docs/PRODUCT.md` 定义已确认的产品行为、范围、埋点和验收标准。
2. `docs/DESIGN.md` 定义视觉与交互规则。
3. 本文档说明上述产品目前如何实现和运行。
4. 代码与测试是实现证据；若与已确认的产品文档冲突，应先报告，而不是
   静默用代码反向修改产品要求。

## Home 重构与图片模板需求（已确认，未开发）

- PRODUCT 第 17 节已同步最新确认：移除 Home 展示卡片和历史区，完整创作输入
  上移，新增 16 个图片模板；Qwen 问答后用户确认，模板统一 Sunburst，初次默认
  四方向、继续编辑默认一张，提交后去 Image 工作台。普通创作保留原模型选择。
- 当前代码仍是上一轮首页合并及背景改色版本；本条只记录需求阶段状态，不代表
  模板或新 Home 已实现。调研见 `docs/IMAGE-TEMPLATES-RESEARCH.md`。
- 用户授权自行生成模板封面：已用内置 image_gen 准备 16 张独立 PNG，
  保存于 `public/templates/covers/*-v1.png`，总计约 34.6 MB；原图保持不变，
  上线接入时需使用图片优化和懒加载，避免直接加载全部原图。
  提示词与文件映射为 `docs/template-cover-prompts.json`，总览为
  `docs/template-covers-preview.html`。已查看全部输出，主要文字和主体可辨识。
  这批是展示封面，不是 Sunburst 实际调用的验收结果；没有接入 Home 或部署。
  问答视觉选项图和真实调用测试预算仍待落实。

## 2026-09-10 首页合并与账户菜单（本地完成，未发布）

- 根 `/` 迁入原 Home 服务端会话和历史预加载；主体移动到
  `components/blocks/home/home-content.tsx`，删除 `app/home` 路由。旧 `/home`
  返回 404，不重定向；共用导航及 Account Profile 返回首页链接改为 `/`。
- 用户后续确认：首页 Footer 背景与生成区统一使用 `bg-background`，保留文字
  和分隔线；其他页面深色 Footer 不变。
- Home 仅在 Session 确认为 unauthenticated 时显示浅色 Footer；其他页面继续
  使用 Footer 默认深色样式。原营销首页内容移除，Analytics 代码未改。
- 共用个人信息菜单增加 Pricing（复用现有弹窗）、Contact Us（mailto 邮箱）、
  Privacy Policy 和 Terms of Service（新标签页）。菜单增加高度上限和滚动，
  保持 44px 操作高度。法律页保留正文，使用简洁 Logo／返回首页头部，无页脚。
- PRODUCT 和 DESIGN 已同步。已有测试 179 通过、4 跳过，新增两项行为测试通过，
  覆盖未登录/加载/登录状态的页脚显隐及菜单顺序、Pricing 回调、邮件和新标签链接。
  Lint 0 错误/22 警告，Build、Design Check 通过；生产冒烟脚本的 `/home`
  预期更新为 404，尚未对生产运行。
- 本地生产预览 3107 后台浏览器检查首页 390/768/1440px，页脚浅色且无横向溢出；
  隐私政策 390px、服务条款 390/1440px 检查了简洁头部与正文，读取的控制台错误为空。
  本机未找到 agent-browser，改用后台内置浏览器。未在真实登录态浏览器检查账户
  菜单、Pricing 草稿保留和登录切换闪烁；邮件客户端唤起需实机人工验收。
- 未提交、未部署。旧 `/home` 链接将失效；移除营销内容会影响搜索展示和漏斗
  数据对比，属于已确认范围。真实 Google 登录、付费生成和结账未执行。

## 2026-09-10 Logo 替换（已发布）

- 后续尺寸微调（已发布）：用户反馈 Home 和创作侧栏 Logo 偏大，新增
  `compact` 尺寸；按最新确认，共用侧栏、移动顶部和抽屉横版 Logo 宽 96px，
  保持比例后高度约 21.5px；桌面展开侧栏及手机抽屉均为 260px，桌面收起保持
  64px。其余 Logo 尺寸及 favicon 不变。Design Check、定向 ESLint、Build 通过；
  最新 260px 版本后台浏览器检查 Home 390/1440px 及移动抽屉，实测展开/抽屉宽度
  为 260px、无横向溢出；收起 64px 和 Logo 96px 保持上一轮实现。账户组件代码保留姓名/套餐积分省略号，
  本次未登录验证较长账户信息，仍需人工检查。未改业务或埋点。
  用户批准发布后，提交 `95dbde3` 已推送 main；生产部署
  `dpl_8N55Fw9t4SqNZLupcJehvznRKTkh` 为 READY，正式域名已绑定。
  183 项测试中 179 通过、4 跳过；生产冒烟全部通过，线上 `/home` 已输出
  260px 侧栏和 96px Logo 样式，部署最近 15 分钟 error/fatal 日志查询无记录。

- 使用用户提供的两张透明 PNG，裁去周围留白并导出 `public/brand/` 的横版、
  独立图标和字标资源。统一 Logo 组件覆盖 Home、创作侧栏、账户页、营销头尾部；
  深色区域以 CSS 将字标显示为白色，保留彩色图标及原品牌字形。
- 生成等待动画复用独立图标，海面及漂移动效保持；PRODUCT 与 DESIGN 已同步
  品牌描述，未改变业务逻辑、收费或 GA4。
- `app/icon.png` 为 32px，`app/apple-icon.png` 为 180px，使用 Next.js 文件式
  元数据及自动版本 URL；移除旧 SVG 图标与冲突的手工 icon 声明。
  `public/logo.png` 保留为新版 512px 兼容资源。
- Design Check、完整 Lint（0 错误、24 个已有警告）和最终 Build 通过；追加的
  等待动画改动也通过定向 ESLint。后台浏览器检查 Home 390/768/1440px、移动
  抽屉、桌面折叠、落地页桌面/手机及深色页脚，Logo 清晰且未见裁切；手机 Home
  scrollWidth 等于 390，资源加载成功，元数据仅指向新图标，读取的控制台错误为空。
- 本机 next dev 遇到 EMFILE，已停止并改用本地生产构建预览；agent-browser
  Chrome 启动失败后使用后台内置浏览器完成检查。未进行真实付费生成或 Apple
  添加主屏幕实机测试；浏览器已保存的旧 favicon 仍可能需要刷新或重新打开标签。
- 用户随后批准部署：代码提交 `f2e6833` 已推送 main；Git 集成生产部署
  `dpl_H8nxw5pTZxYEbiexS6NPyF4BLL6V` 为 READY（构建约 31 秒），正式域名
  已绑定。发布前测试 183 项：179 通过、4 跳过、0 失败；生产冒烟全部通过。
  正式域名返回的新横版 Logo、独立图标、favicon 和 Apple 图标均与本地字节
  一致，`/home` 包含新 Logo 和带版本的 icon 元数据。部署最近 15 分钟
  error/fatal 日志查询没有记录。本条发布记录的后续提交仅更新文档。

## 当前技术栈

- Next.js 16 App Router（Turbopack production build）
- TypeScript
- React 19
- Tailwind CSS 与 shadcn 风格基础组件
- NextAuth
- Prisma + Supabase PostgreSQL
- Stripe 订阅和积分计费
- KIE 与保留的 Volcengine Provider 集成
- Vercel Blob 长期保存生成媒体和任务输入
- Vercel 托管应用和执行 Cron

环境变量名称统一维护在 `.env.example`。真实密钥不得写入代码、Markdown、
示例或 Git 历史。

## 项目结构

- `app/`：页面、Server Component 和 API Route
- `components/ui/`：可复用基础组件
- `components/blocks/`：业务组合组件
- `components/creation/`、`components/generate/`：创作流程 UI
- `lib/`：共享业务和 Provider 逻辑
- `prisma/`：Schema 与 Migration
- `tests/`：Node Test Runner 的合同和业务逻辑测试
- `scripts/`：检查、冒烟测试和运维脚本

根 `Providers` 是唯一 NextAuth `SessionProvider`；页面级 `SessionBoundary`
不再创建嵌套 Provider（NextAuth v4 的全局刷新回调会导致多个 Provider 不同步）。
`/home`、`/image`、`/video` 和 `/assets` 预加载的历史带独立服务端账号 scope，
只有浏览器账号 id + 注册时间匹配时才能显示。`/generate` 根据上次选择进入
`/image` 或 `/video`，`/ai-music` 重定向到 `/image`。

- 2026-09-01 已批准新的导航与规范路由：Home `/home`、Image `/image`、Video
  `/video`、Assets `/assets`；旧 `/ai-image`、`/ai-video` 保留永久重定向，
  `/generate` 和 `/ai-music` 改用新地址。统一侧栏移除 New Create 和通用 Create
  导航，并同步轻量左右折叠按钮、无底部分割线及居中的无箭头 Upgrade。当前代码
  已实现：Home 和创作工作台共用新侧栏，Image/Video/Assets 使用真实规范地址；
  工作台通过 Next.js 支持的原生 History API 在这三页之间保持同一挂载实例，保留
  Prompt、附件、参数和活跃请求，浏览器前进/后退同步恢复 Composer 和选中状态。
  桌面端与 390 px 移动端已完成本地浏览器检查且无横向溢出。旧地址重定向已用本地
  HTTP 响应验证。测试登录态进一步验证 Upgrade 居中且无尾部箭头、折叠态只显示
  图标、用户套餐和积分、账户菜单、Pricing 弹窗、草稿保留，以及右侧 Details
  展开/收起按钮；移动端抽屉显示完整 Upgrade 和用户信息。使用独立 localhost
  端口重新登录后没有 JWT 解密错误；Home 对 React 开发严格模式主动取消的历史
  请求不再误记为控制台错误。2026-09-01 已通过 Vercel 部署
  `dpl_DyQirtc88k8GfCK7fwXBzu1XoZSZ` 发布到 `https://www.flownana.com`，状态
  READY；`npm run smoke:prod` 全部通过，线上 `/home`、`/image`、`/video`、
  `/assets` 返回 200，旧图片、视频和音乐入口返回 308 并指向规范地址。发布时
  首次无 scope 调用短暂返回 `Not authorized`，确认账号和项目访问正常后显式使用
  `--scope liangchusans-projects` 重试成功。生产错误日志扫描未发现错误。
  2026-09-02 根据 Codex 参考截图再次修正左右栏按钮：不再使用带方向箭头的
  `PanelLeftOpen/Close` 和 `PanelRightOpen/Close`，统一为 16 px、1.5 px 线宽的
  `PanelLeft`/`PanelRight` 分栏轮廓；默认无边框、无填充，使用安静的 Stone 中性
  前景，Hover 才出现轻表面。右上控制在尚未选择 Details 时也保持正常可见，避免
  视觉上像未实现。测试登录态在 1440 x 900 下复核了左栏展开/收起和右栏展开，
  390 x 844 下无横向溢出；对照报告为 `design-qa.md`。2026-09-02 已通过 Vercel
  部署 `dpl_F29WVwLTUapzQ4VSj5dss3BZxCqq` 重新发布生产并进入 READY，别名为
  `https://www.flownana.com`；`npm run smoke:prod` 全部通过。本机 Node 25 下的
  Vercel CLI 部署后错误日志查询触发 CLI 用户加载异常，切换 Node 24 后仍复现，
  因而本次未取得独立的部署后错误日志扫描结果。

## 创建与历史实现

- 一次图片运行可创建 1–4 条 `Generation`，通过
  `Generation.parameters.runId` 分组；`outputIndex`、`outputCount` 也保存在
  JSON 参数中，不增加独立字段。
- `processingDurationMs` 保存在 `Generation.parameters`；多输出取最慢耗时。
- `hiddenFromRecent` 保存在 `Generation.parameters`。移除记录时支持通过
  `runId`、数据库 ID 或 Provider Task ID 定位整组任务。
- 图片和视频表单会立即插入乐观历史项，再通过 `taskId` 与持久化记录合并。
  历史不再迁移没有注册时间的旧 id/email localStorage 缓存。服务端在调用 Provider
  前保存 pending；工作台每 10 秒串行刷新历史，并恢复有 Task ID 的视频轮询。
  完整快照可移除已被删除的记录；100 条截断页保留窗口外记录。服务端状态、
  剩余 URL、hidden/deleted 优先于旧缓存；只保留未匹配的新本地工作。
  生成请求由账号工作台持有，不因 New Create 或切换表单而取消；换账号会中止
  旧账号前端请求并忽略迟到回调。前端与服务端均按图片/视频混合五输出计数。
- 图片/视频共用每用户五个活跃输出的服务端上限，不按 Prompt 组计算。扣积分、
  创建 pending 任务、保存扣费快照和登记输入引用在同一 User 行锁事务内完成；
  一个图片 POST 只预约一个输出，不信任客户端 `outputCount` 增减槽位。
- 成功图片和视频保存可安全展示的参数；视频额外保存 Provider，以兼容历史轮询。
- Reprompt 恢复原始输入 `MediaAsset` 和已保存参数，不能把生成结果误当原始输入。
  关联表对资产去重，因此保存的输入列表全部匹配 input 关联时优先用于恢复顺序
  和重复次数；类型来自关联资产，music 映射 audio。无关联的旧数据继续回退。
  Create 历史及 Details 按类型展示图片、视频和音频。
- Image/Video 切换共用同一个 Composer 附件草稿。

## 媒体持久化与下载

- 新生成图片和视频由服务端下载、验证 Content-Type，再上传 Vercel Blob；
  完成后才保存 `Generation.urls`。
- 结果保存使用五分钟的数据库处理租约，限制同一任务的并发下载/上传。Blob
  使用唯一且不覆盖的路径，上传前先把路径写入任务 JSON；成功落库时移除保存
  意图，失败或响应丢失则保留清理义务。租约过期后旧 Worker 不能发布结果；
  历史读取/新提交/删除会重试清理，单轮 Blob 批量删除有十五秒上限。上传响应
  丢失时保留完整宽限期，不能立即把远端上传视为停止。
- Provider 需要拉取输入时，用户选择的素材会转换为公开 Blob URL。
- `MediaAsset` 保存媒体元数据，`GenerationMedia` 保存有序的 input/output 关系；
  历史音频继续登记。
- `Generation.inputUrls` 仅在迁移期提供兼容。
- Create、Assets 和预览对临时 Blob 失败最多自动重试三次并添加 cache-busting
  参数；历史 KIE URL 失败时可通过 `/api/creations/media-url` 刷新。
- Create、Assets 和 My Creations 共用已登录下载接口
  `/api/creations/download?creationId=...`；接口暂时兼容旧 `id` 参数并验证所有权。
- 公开 Vercel Blob 输出重定向到 CDN `download=1`，旧第三方媒体由服务端代理下载。
- 删除未引用的自有媒体时删除 Blob 与资产记录；仍作为其他任务输入的媒体保留。
- 输出删除与输入引用使用同一 User 锁。先解除数据库引用，再删除 Blob；外部
  删除失败保留 `pendingMediaCleanup`，可重试原目标。活跃任务、未结退款、
  仍在保存或待清理的输出不能硬删除记录，避免丢失后续结算/清理所需信息。
- 模型文件大小限制在扣费前检查。缺少元数据的旧 Provider 素材使用有公网地址、
  文件类型和字节上限保护的下载校验，不再错误地调用 Blob metadata API。
- 浏览器上传使用十分钟一次性 `MediaUploadGrant`，按用户限制预约频率、每日字节和
  累计字节；完成回调和生成时的延迟登记都会锁定预约行，防止并发复用，过期的
  未完成预约不能补登记。每日 Cron 清理超过回调宽限期的孤儿 Blob。
- Provider 输出和历史第三方下载只允许公共 HTTPS/443，逐跳验证 DNS 与重定向，
  并限制 MIME、文件签名、连接/总时限和实际读取字节数。

## 图片 Provider 实现

- 2026-09-10：用户确认 PRODUCT 6.2 后，本地接入 GPT-Image-2.5 Flare 与
  Sunburst 两个独立选项及四个 Provider ID。使用 input_urls，最多 16 张参考图，
  平台限制单图 20 MB、JPEG/PNG/WebP、Prompt 5000 字符；1K/2K/4K 收 2/3/5
  平台积分。27:16、16:27、9:8、8:9 仅限 1K；新模型所有档位支持 Auto/1:1。
  原默认模型及旧模型规则保持。共享配置自动用于表单、服务端校验和历史恢复。
  价格依据 Kie 模型页四种模式均展示 6/10/16 Kie 积分；独立 Pricing 页面后台
  标签超时，恢复浏览器时自动权限审核等待超时，未完成交叉核对及桌面/移动视觉检查。
  本地测试 183 项：179 通过、4 跳过；Lint 0 错误/24 警告、Build、Design Check
  通过。新增合同测试覆盖双版本字段、分辨率比例组合、16 张成功/17 张扣费前拒绝，
  现有路由矩阵覆盖两个新模型的持久化及失败结算。未调用真实付费生成。
  用户随后批准发布：代码提交 a668b9a 已推送 main，生产部署
  dpl_8AVyM1V13qbGwx5nkJ6cGx1nWwrZ 为 READY，www.flownana.com 已绑定。
  npm run smoke:prod 全部通过；本次部署最近 15 分钟 error/fatal 查询无记录。

- 2026-09-07：用户批准的五图片模型接入及价格核查完成，已随 `8509b39` 发布生产。
  Kie Pricing 隐藏内置浏览器读取成功，后续浏览器工作保持后台，不切换用户 Chrome。
  GPT Kie 成本 6/10/16，Nano 8/12/18，Qwen Pro 6.4/12（每参考图额外 0.5）；
  三个旧模型平台积分不变。Grok 文生图/Image Edit 均 4 Kie 积分，每输出收 1。
  Seedream 文生图/图生图基础成本均 1K 7、2K 14；文生图收 2/4，图生图首张
  参考图免费，其余每张加 0.5 Kie 积分，总成本乘 0.3 后对每输出取整。
  五模型请求字段集中在 `lib/kie-image-request.ts`，共享比例/Prompt/MIME 规则
  在 `lib/image-model-capabilities.ts`。Grok 无分辨率选项；Seedream basic/high
  对应 1K/2K，最多十张参考图、Prompt 3–5000 字符。
  共享附件保留 MIME/大小用于兼容检查，旧素材缺失元数据时服务端补查。
  前后端按实际参考图数计费，忽略客户端传入价格。GPT 保守比例限制不变。
  真实出图、账单成本及桌面/移动视觉验收仍未完成；没有调用付费生成。
  最终验证：181 项测试，177 通过/4 跳过；Lint 0 错误/24 警告、Design Check、
  生产构建通过。详细价格证据、验证及风险见 `docs/IMAGE-MODEL-AUDIT.md`。

- GPT Image 2：`gpt-image-2-text-to-image`、`gpt-image-2-image-to-image`。
- Nano Banana 2：`nano-banana-2`。
- Qwen Image 3.0 Pro：`qwen3/pro-text-to-image`、
  `qwen3/pro-image-to-image`，最多三张 10 MB 输入。
- 当前图片创建和轮询使用 KIE `/api/v1/jobs/createTask`、
  `/api/v1/jobs/recordInfo` 和服务端 `KIE_API_KEY`。
- 图片平台积分按已批准 KIE API 积分乘以 `0.3` 并取整，用户可见价格以
  `docs/PRODUCT.md` 为准。
- Qwen 每张输入图额外消耗 0.5 KIE API 积分，当前 Flownana 用户价格固定；
  付费放量前需要继续监控成本。

## 视频 Provider 实现

- 常规 KIE 视频积分为已批准 API 积分乘以 `0.2`，整次请求结果四舍五入；
  明确例外除外。
- Gemini Omni Video 使用 `gemini-omni-video` 和统一 Market Task 流程。
- Wan 3.0 使用 `wan/3-0-video`；纯一/两张图片走首尾帧字段，多模态请求走
  互斥 Reference Array。
- Seedance 2.0 Mini 使用 `bytedance/seedance-2-mini`；纯一/两张图片走首尾帧，
  更多或多模态输入走 `reference_*_urls`。保留的 Volcengine 直连实现仅用于
  历史轮询或未来受控重新上架，使用服务端 `VOLCENGINE_ARK_API_KEY`。
- MiniMax H3 使用 `minimax-h3/text-to-video`、
  `minimax-h3/image-to-video`；UI 720P 映射 Provider `768P`，首尾图映射
  `first_frame_url` 和 `last_frame_url`。
- Grok Imagine Video 1.5 使用 `grok-imagine-video-1-5-preview`，必须有一张图，
  且不再发送旧 `mode` 字段。
- HappyHorse 1.1 使用 `happyhorse-1-1/text-to-video`、
  `happyhorse-1-1/image-to-video`；图生视频发送 `image_urls`。
- 活跃 KIE 请求体集中在 `lib/kie-video-request.ts`；Seedance、MiniMax、Grok、
  HappyHorse 的合同测试位于 `tests/kie-video-request.test.ts`。
- 历史 KIE VEO 3.1 任务仍通过 `/api/v1/veo/record-info` 轮询。已下架的 VEO、
  Kling、旧 Seedance 和旧 HappyHorse 代码只保留历史兼容用途。
- 视频等待超过 45 分钟后标记超时并退款。
- Suno 已下线：`POST /api/suno/generate` 返回 HTTP 410 和 `model_retired`；
  历史音频仍可读取和管理。

## 失败处理实现

- 图片 pending 回复不会触发成功回调或成功埋点；视频轮询暂时断网/网关错误只重试
  查询，不重新提交生成。客户端丢失回复不直接标记任务失败或声称退款，而提示检查
  历史；已接受任务只有带 Generation ID 的服务端终态错误才产生失败反馈。
  未确认预约的本地占位不永久占用前端并发槽位，服务端五输出上限不变。
  退款 pending 的 API 提示和历史卡片均明确联系支持。
- 预约或终态事务的确认丢失、后续结算也无法读取时，生成 POST/视频 GET 返回
  HTTP 503、`status: unknown`，提示先检查历史；不伪造 failed、已退款或退款待处理。
  已确认的输入/余额拒绝及已落库终态保持原契约。故障测试覆盖数据库已保存成功、
  已扣费但确认丢失和 Provider 失败后无法结算，均不自动再次调用 Provider。
- 稳定错误定义位于 `lib/generation-errors.ts`。
- 支持的错误码：`auth_required`、`prompt_required`、
  `input_image_required`、`unsupported_file_type`、`file_too_large`、
  `invalid_image`、`invalid_parameters`、`content_policy`、
  `insufficient_credits`、`credit_conflict`、`provider_unavailable`、
  `rate_limited`、`timeout`、`network_error`、`media_processing_failed`、
  `task_not_found`、`generation_failed`。
- Provider 原文只进入服务端日志；API、Toast 和历史卡片只展示
  `docs/PRODUCT.md` 中的稳定产品文案。
- 图片和视频都保留原始扣费快照；失败时尝试退款，事务失败则保留完整快照及
  pending 提示，可在后续历史读取、提交或视频轮询重试。退款不延长批次有效期。
  畸形条目、重复批次、合计与任务费用不符时不部分退款或清空义务。
- 图片和视频成功/失败结算按 User → Generation 顺序加锁；状态落库、媒体关系登记和积分退款
  在事务内争夺唯一终态，失败结果不能覆盖已成功任务，成功结果不能覆盖已退款任务。
- 进程在 Provider Task ID 返回前中断也有任务记录可恢复；图片五分钟、视频
  四十五分钟仍未完成时，可由历史访问或后续提交触发超时退款，不自动重复创建
  Provider 任务。视频轮询只使用服务端保存的模型，保留已下架模型及旧
  Volcengine/KIE 历史任务兼容，但不重新开放下架模型的生成入口。
- 主要位置：
  - 图片接口：`app/api/generate/route.ts`
  - 视频接口：`app/api/veo/generate/route.ts`
  - 媒体存储：`lib/media-storage.ts`
  - 错误测试：`tests/generation-errors.test.ts`

## 登录与账户实现

- JWT 绑定服务端登录时读取的 `User.createdAt`；每次 Session 读取重新校验账号
  存在且属于同一次注册，并从数据库刷新姓名/头像。账号删除或重新注册后旧 JWT
  失效，缺少绑定的旧版本会话也必须重新登录。普通资料、头像和结账请求不再创建
  用户；只有新登录可以创建账号。资料、头像、账单和删号的 User 查询/写入还保留
  创建时间条件，避免已通过登录校验的旧请求跨到新账号。头像使用唯一 Blob 文件名，
  数据库保存失败时清理本次上传。此修复目前仅在本地。
- NextAuth 登录入口传递当前路径作为 `callbackUrl`，Redirect 只允许同源地址。
- 创作页面把 Session `loading` 与未登录状态分开。
- 非生产环境可通过 `ENABLE_TEST_AUTH=true`、
  `NEXT_PUBLIC_ENABLE_TEST_AUTH=true` 启用 `test-login`；生产环境禁用。
  本地开发默认提供可续期的 1,000 测试积分，Preview 使用
  `TEST_AUTH_CREDITS=0` 进行订阅 QA。
- 侧栏、定价和用户菜单的 Billing Summary 共用 60 秒内存/localStorage 缓存
  和并发请求去重。
- 修改显示名称通过已登录 `PATCH /api/account/profile`，成功后调用 NextAuth
  `update()` 刷新 Session。
- `docs/PRODUCT.md` 已确认新的侧栏 Upgrade、用户菜单、Pricing 弹窗、
  `/account/profile` 和删除账号规则。当前代码已完成这批 UI、头像管理、
  活跃任务删除保护、Stripe 取消后删号及自有 Vercel Blob 媒体清理能力。
- 工作区 Upgrade 使用全局 Pricing 弹窗，默认年付并保留当前 Prompt 和附件；
  用户入口展示会员状态和余额，账户菜单在移动端使用全宽底部面板。
- Pricing、升级确认、删号确认、媒体预览和删除确认复用 `components/ui/modal.tsx`：
  原生 dialog 隔离背景，Tab 双向循环、Escape 仅关闭当前层、关闭后恢复触发焦点，
  嵌套时正确保留页面滚动锁。删号请求处理中仍禁止关闭。Details 在手机为模态层、
  桌面仍为非模态侧栏；切换断点不会把桌面工作区锁住。
- `/account/profile` 支持修改显示名称、上传/移除自定义头像和永久删除账号。
  删除前要求精确输入 `DELETE`；活跃生成、Stripe 取消失败或 Blob 清理失败都会
  阻止数据库账号删除。
- 删号先取得 User 锁再检查任务，并持锁执行取消、媒体清理及数据库删除；新生成
  不能在清理期间预约。取消范围包含本地和 Stripe Customer 下仍非终态的订阅，
  包括 past_due/unpaid/paused；Stripe `resource_missing` 不作为取消成功证明。
  已失败但仍有未结束媒体上传的任务也会阻止删号，直至保存宽限期结束或得到确认。

## 计费实现

- 创建 Checkout Session 前读取并校验 Stripe Price；启用状态、金额、币种和
  周期必须与 `docs/PRODUCT.md` 一致。
- 本地新增 `CheckoutReservation`：User 锁内先提交不可变请求、账号注册时间和
  目标套餐，再调用 Stripe。部分唯一索引限制每账号一个未解决预约；重试复用
  同一优惠券/Session 幂等键，更换目标必须确认旧 Session 过期。创建回复丢失时
  根据 metadata 找回；预约到期后不再用旧幂等键创建新对象，无法确认则保留待对账。
- 本地新增 `UpgradeConsumption`：已支付账单、预约绑定、旧订阅取消、消费记录和
  积分发放共用 User 锁事务。一个旧订阅只能支持一个继任订阅，Webhook/返回页
  乱序或取消失败可重试；已绑定继任订阅仍能正常续费及通过 Portal 换套餐。
  空账本兼容检查会回查已有发放记录与 Stripe metadata；历史重复支付只报冲突，
  不自动退款或调整既有权益。
- 旧版本未绑定 Customer 的 Checkout 也纳入创建/删号前核对。年付补发或新周期
  发积分前，先确认关闭仍可消费旧订阅价值的升级结账（包括历史 Session），避免
  抵扣和旧积分并发发放。Stripe 无法确认时失败关闭，数据库不删除或发放。
- 权益通过 `stripePriceId` 解析，不信任冗余 `planType`。
- 首期积分可由 `checkout.session.completed` 或 `invoice.paid` 发放，二者共用
  Subscription Period 去重键。
- 本地计费加固：返回页、Webhook 和年付 Cron 共用 User 行锁，并在锁内重新读取
  Stripe 订阅。积分发放要求已支付 Invoice 的 Subscription、Customer、订阅项、
  Price、数量和起止周期全部匹配；返回页只能使用该 Checkout 自己的 Invoice。
  取消状态对同一 Stripe Subscription ID 不可逆，周期不能倒退；取消或换周期
  清理旧年付指针。升级的 `invoice.paid` 路径也先完成旧订阅取消，再发积分。
- 新 Checkout 和 Subscription metadata 绑定账号创建时间；Webhook 不再按邮件
  地址猜测归属。无绑定的历史订阅还必须回查原始 Checkout 创建时间，不能仅用
  付款时才创建的 Subscription 时间；旧账号的未支付 Session 不能跨到新注册。
  现有历史 Customer 绑定保持兼容；暂时查不到原始 Session 时允许 Webhook 重试。
- 月付积分通过 `invoice.paid` 发放。
- 2026-09-07 修复 Stripe `2026-01-28.clover` Invoice 结构兼容：Webhook
  从旧的 `invoice.subscription` 或新的
  `invoice.parent.subscription_details.subscription` 解析订阅；付费周期校验也同时
  支持旧 Line Item 字段和新的 `parent.subscription_item_details` / `pricing`
  字段，仍严格匹配 Subscription、Customer、订阅项、Price、数量、非 Proration
  和周期。旧结构继续兼容；修复已部署。
- 年付第 2–12 月由 `/api/cron/monthly-credits` 每日 08:00 UTC 检查；Catch-up
  会补发所有逾期月份，并在一个事务内写入去重记录、积分批次和 `nextCreditAt`。
- 本地修复：年付发放和升级抵扣共用原始周期起点的 UTC 月份锚点，最多十一批
  后续积分，避免月末连续钳制造成第十三批。兼容旧 28 日漂移及本地时区生成的
  临近月边界指针；无法识别的异常指针记录错误并保留，不能静默删除权益。
- Subscription created/updated/deleted/paused/resumed 同步本地状态；付款失败、
  需要操作和 Finalization 失败只刷新订阅，不发积分。
- Checkout 返回页验证 Session 已完成、已支付且属于当前用户，再幂等同步订阅、
  取消升级前旧订阅并发首期积分。
- 升级时无法取消或同步旧订阅必须让 Webhook 失败，以便 Stripe 重试。

## Schema 与 Migration

- `20260831085333_checkout_reservations` 是用户 2026-08-31 批准的本地迁移，新增
  两表、归属外键、Session/继任订阅唯一约束及未关闭预约部分唯一索引。两表启用
  RLS，撤销 PUBLIC/anon/authenticated/service_role 权限，只向 flownana_app
  显式授予 CRUD 与服务器 Policy。已在隔离 PostgreSQL 17.11 空库重放全部十一
  个迁移，并以最小权限应用角色通过实际事务、索引冲突和角色权限测试；未应用生产。
- `Subscription.nextPlan` 已由 `20260407000000_remove_next_plan` 删除。
- 生产 Prisma 历史在 2026-05-19 通过 Supabase Migration
  `baseline_prisma_migration_history` 完成基线。
- `Generation.parameters` 是可空 JSONB 兼容字段，用于可展示设置、分组、计时和
  最近记录可见性。
- `20260623000000_add_generation_user_type_created_at_index` 增加
  `[userId, type, createdAt desc]` 历史索引。
- `20260812090000_add_generation_input_urls` 增加 `Generation.inputUrls`、
  `MediaAsset`、`GenerationMedia` 并回填可恢复的历史输入输出。
- `20260828170000_add_user_avatar_sources` 增加 `User.providerImage` 和
  `User.customAvatarUrl`，用于区分 OAuth 头像和用户上传头像。2026-08-28 已通过
  Supabase Migration `add_user_avatar_sources` 应用并回读验证两个新列和现有头像
  回填；代码仍保留迁移前读取和删号兼容。
- `20260830035253_harden_public_data_api_access` 已于 2026-08-30 应用到生产：
  对八张核心业务/基础设施表启用 RLS，回收 `PUBLIC`、`anon`、
  `authenticated` 的表权限，并撤销 `postgres` 在 `public` Schema 中为这些
  浏览器角色自动授予未来表、序列和函数权限的默认 ACL。当前不创建浏览器
  Policy，也不启用 FORCE RLS；Next.js Server 仍通过 Prisma 访问数据库。
- 生产运行时使用独立 `flownana_app` 登录角色；该角色无 Superuser、CreateDB、
  CreateRole、Inherit 或 BypassRLS，仅通过八张应用表上的
  `flownana_server_all` Policy 和显式 CRUD Grant 工作，且不能读取
  `_prisma_migrations`。Migration 继续由独立 owner/admin 连接执行。
- 2026-08-30 已在临时 PostgreSQL 17 从空库完整重放全部十个 Migration：匿名
  `MediaAsset` 查询被拒绝，`flownana_app` 真实登录连接可通过 Prisma 完成 CRUD，
  且该角色不能读取 `_prisma_migrations`。临时数据库验证后已删除。
- 本地未跟踪的空目录 `prisma/migrations/20260402053151_init` 已清理，不再阻断
  当前工作树的 Prisma Migration 扫描；生产应用安全 Migration 前仍需在非生产
  数据库完整重放迁移并核对 `_prisma_migrations` 历史。

## Analytics 实现

- 只有配置 `NEXT_PUBLIC_GA_MEASUREMENT_ID` 才加载 GA4。
- 事件名和必需漏斗只维护在 `docs/PRODUCT.md`。
- 当前落地页、定价、结账、登录、生成、失败、积分不足、购买完成和下载界面
  都有事件发射点。
- `purchase_success` 加固延后到下一次获批准的 GA 工作。

## 环境变量、域名与 OAuth 运维

- `.env.example` 是环境变量名称的唯一清单；Production、Preview、Development
  分别配置真实值，不能把真实值复制进文档。
- 正式主域名是 `https://www.flownana.com`；根域名跳转策略变化时，必须同步
  检查 `NEXTAUTH_URL`、Google OAuth 来源和回调地址。
- 生产 `NEXTAUTH_URL` 应与用户最终停留的规范域名一致。
- Google OAuth 开发回调为
  `http://localhost:3000/api/auth/callback/google`；当前生产回调为
  `https://www.flownana.com/api/auth/callback/google`。URI 必须完整包含协议、
  精确域名和路径，且不能多出尾部斜杠。
- 遇到 `redirect_uri_mismatch` 时，以浏览器实际发送的 `redirect_uri` 为准，
  对照 Google Cloud Console 配置，并检查 Vercel 环境变量是否已作用于当前部署。
- DNS 由阿里云管理，但 A/CNAME 的目标值必须以 Vercel Domains 当前提示为准，
  不得复用旧文档中的固定 IP 或 CNAME。
- 域名或环境变量改变后需要重新部署，并重新测试规范域名访问、Google 登录和
  生成主流程。

## 验证与发布

- 本地启动：`npm install`、按 `.env.example` 配置本地环境、`npm run dev`。
- 生产发布前运行 `npm run test`、`npm run lint`、`npm run build`。
- UI 改动还需运行 `npm run design:check`，并按 `docs/DESIGN.md` 和
  `docs/PRODUCT.md` 检查规定视口与状态。
- 生产部署必须获得明确批准；标准发布命令为 `npx vercel --prod --yes`。
- 不能把命令成功返回当成发布完成：必须确认 Vercel 最终状态为 `READY`，
  再运行 `npm run smoke:prod`。
- 发布后至少检查主页、图片/视频入口、静态媒体、登录保护 API、Cron 保护和
  视频选项；涉及结账或 Provider 时还需单独做真实集成验证。
- 部署失败先查看当前部署的完整 Build/Function Log；不要依赖旧截图或旧状态文档。
- 推送代码后应 Fetch 远端并核对本地 `HEAD` 与目标远端 SHA，不能只凭 Push
  输出判断同步完成。
- 生产部署始终需要明确批准。

## 当前环境

### Preview

- 稳定测试地址：`https://flownana-test.vercel.app`。
- 最近记录的 Ready 部署：`dpl_3B5MAJjGCiYAy3BpbND4juSgNbUX`。
- Preview Test Auth 使用零合成积分，使订阅 QA 只计算付费套餐积分。
- Stripe 测试模式 Webhook 当前指向生产而不是 Preview。返回页可修复首次购买/
  升级同步，但周期性 Invoice 测试仍依赖生产 Webhook。

### Production

- 2026-09-07 `liangchusan@gmail.com` 的 Starter 月付订阅在 Stripe 成功续费至
  2026-10-07，但新版 Invoice Webhook 结构未被旧代码识别，导致新周期 200 积分
  漏发。已通过现有 User 锁、付费 Invoice 校验和 Subscription Period 去重事务
  补发一批 200 积分，重复调用确认未二次发放；本地订阅周期已同步。此前 200
  积分已使用 90，剩余 110 按发放后 30 天规则于 2026-09-06 到期，不属于异常
  扣减。兼容修复已通过提交 `d7fbf48` 和 Ready 生产部署
  `dpl_75iem2zqw2u6GynTQLf8B1fLCCwo` 发布；正式域名已绑定，完整生产冒烟通过，
  新部署错误日志扫描为空。

- 账户与 Pricing 功能代码在 2026-08-28 通过 Ready 生产部署
  `dpl_3kqAdSfZEqZrrVgKrnnf5piWzGRG` 上线，对应 Git 提交 `e176e77`；后续仅文档
  状态提交也由 Git 集成生成 Ready 部署，不改变运行时代码。
- 生产已应用并回读验证历史索引、`Generation.parameters` 和长期媒体 Migration。
- 生产已应用并回读验证用户 Provider/自定义头像字段；新部署错误日志扫描为空。
- 媒体迁移从 17 条历史 Generation 回填 14 个输出资产和关系，没有可回填的
  历史输入 URL。
- 最近记录的生产冒烟测试通过主页、图片/视频、静态媒体、受保护 API、Cron、
  Suno 下线契约和视频选项。
- 2026-08-30 已应用数据库安全 Migration，Vercel Production
  `DATABASE_URL` 已切换为最小权限 `flownana_app` Pooler 连接；Supabase 项目
  Data API 已全局关闭，控制台确认所有 Schema 均不可通过 PostgREST 查询，
  Auth 和 Storage 保持启用。
- Stripe 仍是测试模式，直到有意配置 Live Key、Price 和 Webhook Secret。
- 生产安全变更已经通过 Ready 部署 `dpl_24GQFYJeDDjzJd5Dmxk3RjonAqgE`
  上线：服务端 Provider 调用只读取 `KIE_API_KEY`，不再兼容
  `NANO_BANANA_API_KEY`；Vercel Production、Preview、Development 已配置新的
  Sensitive `KIE_API_KEY`。最低成本真实生成验证成功后，KIE 控制台中的旧
  `Default` key 已撤销，旧 `NANO_BANANA_API_KEY` Vercel 环境变量也已从三个环境
  删除；最终生产重新部署后，运行时只保留新 key。
- 同一生产安全变更在 Vercel Production 使用 Stripe 测试 key 时，仅允许
  `STRIPE_TEST_MODE_ALLOWED_EMAILS` 中的账号访问测试结账、套餐变更、Checkout
  回填和年度积分发放；测试 Webhook 无条件忽略，不允许 QA 写入。生产 Test Auth
  则无条件关闭。Stripe Live
  模式不受该测试保护逻辑影响。
- 新 key 的首次最低成本生产图片验证已成功从 KIE 取得图片，但 Node 20+ 默认
  `autoSelectFamily` 要求自定义 DNS lookup 在 `all=true` 时返回地址数组，导致安全
  下载器以 `ERR_INVALID_IP_ADDRESS` 失败；该次 2 credits 已自动退回。兼容修复已
  通过提交 `957e620` 和 Ready 部署 `dpl_B9AKHENrNfRsBSXXezMyAKBgyTng` 发布，且不
  放松逐跳公网 DNS 校验、固定 IP 连接、Host/SNI 或 TLS 证书校验。第二次同配置
  生产验证成功，仅实际扣除 2 credits；生成记录、输出媒体关系和 Vercel Blob 均
  已回读验证，Blob HEAD 返回 HTTP 200 和 `image/png`。
- Next.js 16 / React 19、数据库与媒体安全加固已于 2026-08-30 通过 Ready 生产
  部署 `dpl_G9qUDx772o8k3ND5F3GDYEpEvWdm` 首次发布，运行时代码基线提交为
  `7a7a32d`；后续纯发布记录提交只生成等价构建，不改变运行时代码。最终
  `main` SHA 后已复核 `https://www.flownana.com` 为 Ready，完整
  `npm run smoke:prod` 通过，Function 日志未出现 Prisma、RLS 或运行时错误。

## 当前工程风险与 TODO

- 2026-08-31 全仓源代码审计已完成，仍有外部平台验证缺口；六个安全发现已保存
  在本轮 Codex Security 报告中，均已完成本地修复与验证。范围包含年付月份计算、
  旧会话与普通请求重建账号路径、付款周期/订阅状态、服务端生成媒体结算和可靠
  结账/升级防重。本轮本地工作已完成，但不代表生产已应用或全项目风险清零。
- 服务端五输出预约、图片持久化/退款恢复、生成删除/轮询与删号竞态已完成本地修复。
  客户端账号隔离、混合计数、历史恢复与删除反馈已实现；已补修丢失回复/临时轮询
  不等于失败、图片 pending 不等于成功、退款待处理提示和重复/多类型输入恢复。
  结算事务完全不可用时 API 的不确定状态和弹窗键盘/焦点边界也已完成本地修复。
- 客户端隔离调查已实际复现：清除 Billing Summary 缓存后，旧的未完成请求仍会
  回写旧账户缓存；下一次读取可不发请求就取到旧会员/余额。活跃工作台的 Session
  与 RSC 初始历史也需要归属绑定；仅忽略迟到响应不足以防跨 Tab Cookie 切换后的
  错账号写操作。当前已增加纯账号 scope、服务端预期账号检查、账单/历史响应
  归属，账单汇总在账号锁中读取，并重写带版本的按 scope 缓存和请求失效机制。
  生成、上传、资料/头像/删号、媒体操作和付款请求携带捕获的账号并屏蔽迟到回调；
  RSC seed、工作台、报价、详情和历史随账号注册时间隔离。未知账单不按 Free 处理。
  独立候选复核确认嵌套 SessionProvider、表单卸载取消和完整历史快照遗漏删除，
  均已修正并补测试。ResultPanel 当前无路由调用者，补齐 scope 传递接口，不把
  该潜在契约问题误报为 /create 页面正在发生的结果丢失。
  本地浏览器已检查桌面创作、390px 手机创作/账号菜单、768px 定价、1440px
  资料更新和双 Tab 退出清空私有草稿；未使用真实付费生成或真实账号切换。
  首次沙箱 dev 文件监听失败，改为获批的仅本机进程后可用。旧 localhost Cookie
  与测试密钥不匹配时被拒绝；重新测试登录后页面正常。本批 Build 已重跑通过。
- `docs/PRODUCT.md` 第 16 节已获本地开发和隔离测试迁移批准，结账预约及旧订阅
  消费记录已实现并通过本地回归。生产迁移、部署、真实支付仍未批准或执行。
  发布前需先应用迁移，并确保旧版本的结账请求已结束，不能让不使用预约的旧代码
  与新代码并行发起支付。历史扫描每次最多 1000 个 Stripe Session、100 个本地
  历史订阅，截断或读取失败会阻止继续操作；大量历史数据、已重复支付或到期未知
  预约需运营对账。删除账号现在依赖 Stripe 结账可核对，服务不可用时保留账号。
- 待独立外部验证：Blob Token 能否重复上传、删号时非 active/trialing 订阅取消、
  Stripe Checkout/Webhook/年度 Cron 乱序和重放、真实 Provider 与自有 Blob 持久化。
- 当前修复测试：最终完整回归 233/233 通过（新增 19 个结账预约父/子测试，覆盖并发
  首购/升级、先持久化后调用、丢失回复、切换套餐、旧订单、年付发放、删号及
  正常 Portal 续费；另加 3 个结算确认丢失测试和 2 个弹窗契约测试；同时保留
  生成表单真实处理函数、轮询传输错误、
  PostgreSQL 重复输入恢复，以及客户端报价/结账迟到请求、账号边界、
  上传中止、单一 SessionProvider 和工作台请求归属），包含真实 PostgreSQL 事务及实际
  Webhook/返回页/生成/删除 Route 的并发测试，外部 Stripe、Provider 和 Blob 使用
  替身。类型检查、Lint（0 错误、24 个警告）、Design check 和本次最终 Build
  均通过。本地浏览器已检查旧版创建入口 390px 图片、768px
  视频纵向布局、1440px 视频双栏，均无页面横向溢出，主图片工作台可打开。
  独立计费复核发现的 Portal 降档续费误拦及旧版未支付
  Checkout 跨账号路径均先复现、后修正，并补充正常历史付款和重试用例。
  生成独立复核发现的重复视频上传、Blob 上传后提交异常及旧 Provider 素材兼容
  已修正；新增处理租约、提交确认丢失、上传确认丢失/延迟清理和旧 Worker 隔离测试。
  已在整批修复结束后重跑完整测试、类型检查、构建和设计检查；Lint 仍为
  0 错误/24 个既有警告。70,128 个旧日历指针状态验证通过。
  未部署或推送。
- 收尾浏览器检查仅使用本机、隔离库和合成账号/媒体/订阅，禁用真实支付、生成、
  Google 和 Blob 密钥。验证 1440px 定价及嵌套升级错误态、Tab/Shift+Tab/Escape、
  390px 删号确认/媒体预览/删除确认/Details、768px 定价，以及桌面 Details 保持
  侧栏；Assets 预览和删除确认均可取消。未点击支付或真正删除。无渲染错误浮层；
  Dev 严格模式产生一次历史请求 AbortError 日志（取消请求，未影响界面），报价
  因刻意禁用 Stripe 而呈现预期错误。已重置浏览器视口、关闭测试页并停止开发进程。
  最终回归后临时 PostgreSQL 进程也已停止；测试数据和日志保留在临时目录便于复现，
  未删除或修改真实业务数据。
- 2026-08-31 在另一个隔离 PostgreSQL 17.11 空测试库重放现有十个迁移，并以
  `flownana_app` 角色运行真实并发、回滚、去重与年度 Catch-up 测试；Stripe 使用
  替身，不接触远程业务数据。`FLOWNANA_TEST_DATABASE_URL` 只接受临时私有
  Unix Socket 和测试库名，未设置时数据库专项明确跳过；不能误用默认 `.env`。
- 在 Stripe 测试模式和独立测试 Blob 数据上端到端验证删号流程；外部订阅取消、
  Blob 删除与数据库删除无法形成单一事务，中途外部失败仍需运维排查。
- 当前清理仅能保证新记录的路径可重试；本次修复前已丢失扣费快照或完全未登记的
  孤儿 Blob 不能凭空恢复，需要独立对账。Provider 创建请求已被接受但响应丢失时
  可能产生供应商成本；本地不自动再次创建任务，也不声称供应商执行严格一次。
- 2026-08-30 数据库安全 Migration 已消除审计确认的直接泄漏面：九张目标表均
  开启 RLS，`PUBLIC`、`anon`、`authenticated`、`service_role` 均无表权限；
  当前 Supabase REST 请求读取 `MediaAsset`、`GenerationMedia` 和
  `_prisma_migrations` 均返回拒绝。生产 Pooler 上的 `flownana_app` 已通过真实
  Prisma 事务 CRUD 和迁移表拒绝测试，Vercel Production `DATABASE_URL` 也已切换。
- `supabase_admin` 的历史默认 ACL 不受 Prisma Migration owner 管理；全局关闭
  Data API 后不再形成浏览器访问面。若未来重新启用 Data API，必须先用平台管理
  权限审计并清理该默认 ACL，且不得通过 Dashboard 创建未审计的公开业务对象。
- 用 Flownana 自有媒体替换首页临时演示视频。
- 在历史 Provider URL 仍可访问时回填旧生成媒体。
- 付费放量前监控 Qwen 多输入图片成本。
- 上线前分别验证真实 Stripe、Webhook、数据库和 Provider 集成，不能用本地测试
  代替线上验证。
- 早期部署文档曾把真实格式的认证和 API 凭据提交到 Git；生产
  `NEXTAUTH_SECRET`、Google OAuth Client Secret、数据库连接和 KIE key 均已轮换
  或核对为不同于历史值，旧 KIE key 已撤销，旧 Vercel 变量已删除。Google Client
  ID 不是秘密且保持不变。历史凭据副本仍存在于 Git 历史，但当前均已失效；是否
  执行破坏性的历史重写仅作为可选纵深防御评估，不是当前上线阻塞项。

## 持久工程决策

- 保持轻量 Agent 协作，使用 Codex 作为工程 Agent。
- 产品要求只放在 `docs/PRODUCT.md`，设计规则只放在 `docs/DESIGN.md`，
  实现和运维事实放在本文档。
- 大功能先更新产品文档并确认；符合现有规格的小功能直接开发。
- 优先采用满足已确认范围的最小实现。
- Provider Key 只保存在服务端环境变量中，任何代码、客户端、示例和文档都不得
  保存真实凭据。


## 2026-09-07 完整发布记录

- 用户明确批准全部当前改动提交、推送和生产发布。运行时代码提交
  `8509b39392c3cefe7742d9a72155cbe2f36cdf32` 已推送到 GitHub main，并通过 GitHub API
  核对远端 SHA 与本地一致。本次包含已上线但未提交的导航/界面及新图片模型。
- Vercel 部署 `dpl_21zGdRKAMrCSk2q4NyRGE3YpWQx6`，
  `https://flownana-n6bak2v1u-liangchusans-projects.vercel.app`；CLI inspect 确认 READY，
  `www.flownana.com`、`flownana.com` 正式别名指向该部署。
- `npm run smoke:prod` 全部通过：主入口 200，旧入口 308，私有接口未登录 401，
  已下线音乐接口 410，视频选项接口正常。测试未执行真实付费生成/支付。
- 发布前 181 项测试 177 通过、4 项隔离数据库测试跳过；Lint 0 错误/24 警告，
  Design Check 与生产构建通过。新模型真实出图、实际账单成本仍待人工验收。
- Git 直连 GitHub 超时，使用已配置系统代理的单次 `http.proxy` 参数后推送成功，
  未修改持久系统/Git 配置。Vercel CLI 重新登录后发布成功。
- 对本次部署执行最近 15 分钟 error 级别日志查询，返回 No logs found；该结果仅代表
  当前查询窗口没有匹配错误日志，不替代真实生成验证。

## 2026-09-11 Home 模板封面接入（本地）

- 新增 `components/blocks/home/template-gallery.tsx`，在 Home 输入区下方展示全部
  16 张已生成封面、英文名称和用途。2/3/4 列响应式网格，Next Image 优化及懒加载。
- 本批只接入展示，卡片尚无点击操作；第 17 节的完整 Home 输入重构、旧模块移除、
  模板问答/生图/埋点仍待开发，不代表整个模板 PRD 完成。
- Build、Design Check、Home entry 两项测试通过；Lint 0 错误/22 个既有警告。
  浏览器检查 390/768/1440px，16 张封面均加载成功。未执行真实生成或部署。
- 本地 3107 生产预览已重启。人工验收：刷新 Home，滚动查看 16 张封面、名称、
  用途及手机换行。图片首次优化缓存和线上加载表现仍需发布环境验证。

## 2026-09-11 Home 完整输入重构（本地）

- `/` 改为复用 MediaWorkspacePage / MediaCreationWorkspace，删除旧 home-content。
  移除 Featured capabilities、文字案例和 Recent creations；主标题、完整创作输入、
  16 张模板封面、游客公司页脚按顺序排列。历史数据仅用于附件 Assets 和并发状态。
- Home 复用 GenerateForm / VideoCreationForm，包含附件、模型、参数、报价、校验、
  生成和轮询。切换类型留在 `/`；任务被接受后 pushState 进入 Image/Video，输入组件
  保持同一 React 位置，避免卸载任务或重新提交；失败不跳转。
- 修正原 history helper 传入 Next 内部 state 导致 usePathname 不更新的问题；按本地
  Next 文档传 null，交由 Next 保留内部状态。浏览器验证从 Home 进入 Image 和后退，
  页面布局与 URL 同步且草稿仍在。模型能力不在同类型导航时重置为默认值。
- Home 模型/参数/附件菜单改为向下展开并限制高度，修复手机顶部选项被遮挡；
  Image/Video 底部工作台仍向上展开。390/768/1440px 浏览器检查通过。
- 本批最终完整测试 186 项，182 通过、4 项隔离数据库测试跳过；新增 Home 任务接受/
  失败/多输出仅一次跳转合同测试。Build、Design Check 通过，Lint 0 错误/20 警告。
  浏览器未发现 error 日志。未调用真实付费生成、未上传真实素材、未部署。
- 待开发：模板点击面板、Qwen 多轮问答、确认报价、模板生成与编辑/历史元数据和
  漏斗事件；封面卡片目前仍仅展示。待真实验收：登录后 Home 提交 Image/Video、
  附件承接、并发/部分失败与真实积分扣退。3107 本地预览已重启。

- 2026-09-11：按用户要求隐藏 Home 手机/平板顶栏 Logo，保留菜单按钮；
  共用顶栏新增 showLogo 参数，其他工作台保持原样，侧栏与页脚 Logo 保留。


## 2026-09-11 模板问答与模板生图（本地开发版）

- 已替代上文“模板仅展示/待开发”状态：Home 16 张卡片可打开模板面板，支持
  草稿、登录承接、固定候选问题、参考图及角色、生成前方向/张数/比例/分辨率/报价确认。
  问答配置保留原 PRD 的 16 份 instruction；当前每模板最多 3 题，Logo 有 4 张
  原创 SVG 视觉选项，其余主要为文本/文字选项。封面不进入生成参考。
- `lib/image-templates/` 分离 catalog、合同校验、OpenRouter 理解、事务服务及生图 worker；
  `/api/image-template` 校验账号作用域和账号创建时间，支持运行恢复、问答、确认生成、失败重试。
  理解模型固定 `qwen/qwen3-vl-32b-instruct`，无 fallback；每运行仅一次自动解析重试。
  `.env.example` 新增 OPENROUTER_API_KEY，当前本地未配置；缺失时返回受控 503。
- 模板图片固定现有 KIE GPT-Image-2.5 Sunburst。默认 4 张、可选 1–4；按用户锁在同一
  事务内创建整组任务、检查 5 输出上限及 FIFO 扣费。相同运行重复提交返回原任务。
  worker 复用普通图片 Provider/持久化/失败退款，普通路由的 Provider helper 已抽出共用。
- `/image` 展示方向、逐张状态；选中结果继续编辑默认 1 张并锁定方向，多张也不展开新方向。
  失败方向先回到明确报价确认，再付费重试；不自动追加付费请求。
- 新增 ImageTemplateRun 与迁移 `20260911093408_image_template_runs`，保存版本、
  输入、答案、规格、运行 revision、解析重试次数和任务 ID。启用 RLS，应用服务角色政策，
  撤销客户端角色权限。仅隔离 PostgreSQL 17 测试库执行，未修改生产数据库。
- 模板漏斗事件已接入，口径见 PRODUCT 17.7；基于浏览器观察的结果事件可能漏记离线完成，
  不用于账务结算。未改变旧营销 CTA 事件含义。
- 隔离库完整测试 439/439 通过、无跳过，含 16×10 输入合同、真实 SQL 重复请求/原子扣费/
  并发上限/部分失败退款/重试方向及 RLS。合同案例不等同 160 次真实模型视觉测试。
- Home/初始模板面板已做移动端检查，匿名草稿关闭恢复及隔离账号登录检查完成；
  后续浏览器连接连续超时，问答选项/最终确认和失败重试界面的完整响应式复核尚未完成。
- 未调用真实 Qwen/KIE，未验证真实媒体上传与出图质量，未提交、未发布本批代码。
  上线前需要配置 OpenRouter 密钥、批准真实测试预算、完成端到端及视觉验收，再执行生产迁移。
- 最终复验仍为 439/439；Build、Design Check、git diff --check 通过，Lint 0 错误/23 警告。
  3107 已以最终构建重启；3108 隔离预览与临时测试数据库在验证后停止。


## 2026-09-11 模板追加测试与 OpenRouter 配置核查

- 按用户要求再次跑完整隔离库测试：439/439，无跳过；Build、Design Check 通过，
  Lint 0 错误/23 警告。另对本地 3108 执行真实 HTTP 集成检查：匿名/缺少或错误账号
  scope 拒绝、测试账号登录、服务端草稿恢复、缺密钥受控 503、积分不足不创建输出
  且保留 ready 草稿，均通过；临时合成确认运行已删除，无付费 Provider 请求。
- 核查 .env/.env.local/.env.production、当前进程、附件及可检索历史用户消息，
  未找到可用 OpenRouter 密钥；未写入虚假配置或改用其他 Provider。已询问原任务位置。
- 内置浏览器连接超时；agent-browser 在临时 npm 缓存安装成功，但 Chrome 在正常启动、
  放开沙箱启动及工具建议的启动参数下均提前退出。完整问答/确认页视觉复核仍未完成。
  真实 Qwen/Sunburst 验收仍待可用密钥，不能以本轮合同及 HTTP 检查替代。


## 2026-09-11 OpenRouter 密钥已接入（本地）

- 用户重新提供密钥后，已写入被 Git 忽略的 .env.local 服务端 OPENROUTER_API_KEY，
  文件权限 600；未回显、未写入代码或文档、未配置生产平台。
- OpenRouter 鉴权接口返回 200。使用真实固定 Qwen 模型验证 Logo 缺失需求与完整中文需求。
  发现原模板 instruction 的“先提问”干扰信息提取，已明确协议优先级及从 input.prompt 提取
  已有答案；复测缺失需求返回 q1，完整中文需求直接 ready、4 个方向且无虚构必显文字。
- 此结果替代上文“本地缺少密钥”的状态；只证明这两个真实问答场景，不代表全模板视觉质量、
  四图生图或编辑已通过真实验收。生产迁移、生产配置和部署仍未执行。
- 协议修正后普通测试 368 通过、5 项数据库入口跳过（本轮未重启隔离库）；Build 和
  Lint 通过，git diff --check 通过。此前完整隔离库 439/439 为修正前结果。3107 已更新构建。


## 2026-09-11 生产发布准备

- 用户明确选择先发布、在线上验收。生产 OpenRouter Secret 已配置。
- Supabase 生产项目已执行 ImageTemplateRun 新增表迁移，并写入对应 Prisma checksum
  与完成记录；此次迁移不更新现有用户、积分或作品。生产部署尚待 READY 与冒烟确认。
- 用户将在生产验收真实四图生成、继续编辑与部分失败；当前真实模型验证仅覆盖两个问答场景。


## 2026-09-11 模板生产发布完成

- 运行时代码提交 62831652a5e035cc5e2fb7206e499fd36c4307c2，首次 Git push 成功，
  本地 HEAD 与 origin/main 一致。随后重复代理 push 被自动审批拒绝，未继续重试。
- Vercel 部署 dpl_C2XyVYa5HX2FRRNH6MAwtWZz7JyS /
  https://flownana-6ufy2eih7-liangchusans-projects.vercel.app 已确认 READY，
  www.flownana.com 和 flownana.com 别名已绑定。
- 生产 OPENROUTER_API_KEY Secret 已配置；新表 RLS=true，服务端角色有 CRUD，
  anon/authenticated 无读取权限；Prisma 迁移记录 finished=true、applied_steps_count=1。
- npm run smoke:prod 全部通过，额外检查模板 API 未登录返回 401。
  部署最近 15 分钟 error 日志查询返回 No logs found。CLI 查询完成后遇本地更新缓存
  EPERM，未影响已返回的云端 READY/日志查询结果。
- 用户选择线上验收；尚需人工走完整模板问答、真实四图生成、单方向编辑、失败重试与积分。
  本条为发布后本地记录，尚未追加提交到远端。

## 2026-09-11 模板展示精简（本地）

- TemplateGallery 改为桌面 6 列与图内标题，移除模块副标题和卡片用途文字；点击行为及埋点保持。
- 用户提出另开任务讨论交互；本次只调整展示，交互流程尚未重新定义。
- 本次 Build、Design Check、git diff --check 通过；浏览器连接超时，390/768/1440px 真实渲染待人工检查。3107 已重启，未发布此展示修改。
- 新讨论可读取 docs/TEMPLATE-INTERACTION-HANDOFF.md，避免复制冗长历史。


## 2026-09-11 紧凑模板卡片已发布

- 用户明确批准发布本次样式调整。Vercel dpl_3SvcguYGwQ7hMvudeSyQCC419Tbe 已 READY，
  https://flownana-41akjbpza-liangchusans-projects.vercel.app 绑定 www.flownana.com。
- 正式首页 HTTP 200，返回 HTML 已验证六列类名、图内标题和副标题移除；smoke:prod 全部通过。
- 本次从工作区部署，样式与发布后文档尚未追加 Git 提交/推送。未改变模板问答逻辑。
- 浏览器真实截图检查仍待用户在手机与桌面核对；线上 HTML 验证不替代视觉验收。


## 2026-09-11 Agent 会话需求已确认（仅文档，未开发）

- 产品范围见 PRODUCT 第 18 节，设计同步 DESIGN 的 Agent 会话交互章节。
  用户明确本轮先确认需求、不开发；现有模板弹窗实现与生产行为没有在本轮更改。
- 已确认首页 Agent/Image/Video 三模式；Agent 隐藏后置参数；模板点击直接进入
  会话；支持图片和视频、同会话选图生视频、各次付费前确认方案与总积分。
- 会话支持历史、新建、自动标题、重命名、删除与继续交流；删除会话保留 Assets
  作品。模板初次默认四张、编辑一张锁方向；普通 Agent 按需求决定数量。
- Agent 自动确定模型与规格，具体候选和策略尚未确定；旧 Qwen/Sunburst 为现有
  实现背景，不等同未来 Agent 选型。AI SDK 仅为技术建议，未安装或接入。
- 待落实对话额度、游客承接、路由/空会话保存、上下文管理、活跃会话删除、旧模板
  状态兼容与新事件口径；真实图片/视频和多轮质量仍需预算及验收。
- 本轮只修改 PRODUCT、DESIGN、本文件与交接说明；不修改代码、依赖、数据库或
  环境配置，不提交或部署。文档核对不能替代运行测试。


## 2026-09-11 Agent 未决项已形成细化草案（待确认，未开发）

- 新增 docs/AGENT-SPEC.md，PRODUCT 18.5 链接并概括待确认的额度、默认模型、
  路由/登录、上下文/中断、删除、旧模板兼容及 Analytics 口径；不是新增已批准需求。
- 本轮核对现有计价、账号 scope、事件和模板理解代码；未安装 AI SDK，技术建议
  为单 Agent + 有限工具/服务端付费确认，数据库消息恢复，不增 Redis 流恢复依赖。
- 已查官方 AI SDK 文档及 OpenRouter 无鉴权模型列表。当前 Qwen 列表为 text/image
  输入并支持 tools；不能用模型宣传中的视频描述承诺当前通路可理解视频或音频。
- 建议免费 20/付费 100 次每日对话、每分钟 6 次、单账号一个回复；预算与默认
  模型均为待确认值，成本是公开 token 价格的上界推算，不是生产成本实测。
- Agent 媒体继续使用现有执行体系；未审计全部执行路径，具体 Provider 质量、
  套餐权益校验与存储/迁移方案需开发阶段验证。无付费调用、无迁移或部署。
- 本轮仅文档，未运行应用测试/构建；更新交接并进行文档差异检查。


## 2026-09-11 Agent 每日次数与图片默认模型确认（仅文档）

- 用户确认免费每天 10 次、付费每天 100 次，默认图片模型 GPT-Image-2.5 Flare，
  适用于普通 Agent 图片和图片模板；替代此前免费 20 次和 Sunburst 默认的建议。
- PRODUCT 第 18 节、AGENT-SPEC 与交接说明同步。成本预算按此前价格快照重算，
  免费每日最坏 token 预算为 $0.04368，不代表实测成本或支出授权。
- 其余计数/重置细则、视频默认值、生命周期及事件规则仍待确认。仅文档修改，
  未开发或部署，无需本轮手测；真实调用质量与成本仍需验收。


## 2026-09-11 Agent 产品需求收口（已确认，未开发）

- 用户确认剩余规则：完整 Agent 回复计一次（追问计、失败不计），UTC 零点重置，
  超额不自动扣积分；发送/上传前登录并保留草稿；未结生成/退款等待结束才删会话；
  历史通过新消息修正、无消息分支。免费 10/付费 100 次和 Flare 默认图片保持。
- 理解现有 Qwen 先验收、不自动切换；视频默认 Seedance Mini 720P/5 秒/无声/一个。
  单 Agent 调用现有图片/视频能力，服务端管理会话、报价和扣费。
- 四个新增 Agent 事件及草案对应口径获确认，既有生成/下载含义保留。
  PRODUCT 18.5、AGENT-SPEC 和交接已同步，不再重复要求确认这些产品规则。
- 工程建议参数与预算保持区分；未授权开发、付费测试、迁移或生产部署。
  本轮仅文档检查，无需手测；多轮理解质量、真实媒体效果和成本仍待开发后验收。

## 2026-09-12 Agent 首版本地实现（用户已批准开发，未发布）

- 用户明确“可以，我们开发”。本轮开发范围为 PRODUCT 18 的 Agent 独立会话；
  没有生产迁移、部署、提交或推送，没有真实付费 Provider 调用。
- 新入口 `/agent`、`/agent?template=<id>`、`/agent/<uuid>`；首页三模式切换保留
  草稿，模板入口直接转会话。旧 TemplatePanel 不再挂到新入口，旧任务 API 保留。
- `lib/agent/understand.ts` 使用 AI SDK 7.0.97、OpenAI-compatible 3.0.47、Zod 4.6.2，
  Qwen ID 延用 `qwen/qwen3-vl-32b-instruct`。工具只有追问和服务端报价，不提供付费工具。
  3 步、每步 1500 输出 tokens、80 秒超时、100 秒租约；28k 字符上下文保护，不静默
  丢弃原始历史，不实现自动摘要。流错误/截断不计有效回复；记录 Provider 可用用量。
- `lib/agent/service.ts` 在既有 User 行锁下维护额度、会话 revision、报价和任务。
  每日 UTC 免费 10/付费 100，完成才计数，失败/停止不计；每分钟 6 次、账号 1 个理解回复。
  10 分钟报价；重复确认返回原任务；多输出原子扣费，失败沿用逐输出退款。
- 图片默认 Flare/1K，普通默认 1 张，模板默认 4 张、编辑 1 张；视频默认 Seedance Mini
  720P/5s/无声/1 个。Agent 图片复用模板 worker、视频抽出共用服务，旧视频路由保留行为。
- 新表 AgentConversation/AgentTurn/AgentUsage/AgentAttachment；迁移
  `20260911160000_agent_conversations` 已在独立 PostgreSQL 从空库重放，未应用生产。
  四表 RLS + 浏览器角色撤权 + flownana_app 策略。附件关系使用 Cascade 兼容账号注销；
  普通作品删除在 User 锁下先检查会话引用，不能提前删除仍被引用的素材。
- 删除会话保留生成作品；活跃回复/任务/退款先阻止删除。未引用附件清理失败保留
  tombstone cleanupUrls 以便重试。旧草稿自愿承接，旧所选图带入原始约束与方向。
- 回复时 1.5 秒、媒体运行时 3 秒、空闲时 15 秒读取持久化状态；不是 Redis 字节流恢复。
  图片后台 worker 执行，视频状态沿用现有轮询/settlement；未新增常驻任务队列。
- GA4 加四项 Agent 事件，保留生成与下载语义；显式事件/页面配置清理私有会话信息。
  自动 enhanced-measurement 页面采集配置仍需发布前核对，未在此轮操作 GA4 管理端。
- 验证：451 项测试通过，无跳过（独立本地 PostgreSQL）；含额度 10/11、100/101、
  并发首发/确认、部分批次回滚、退款幂等、过期报价、引用保护、跨账号和账号注销。
  真实 AI SDK 使用模拟模型测试工具、追问、错误流及截断。lint 零错误/30 warnings，
  build、design:check 通过。浏览器 390/768/1440px 无横向溢出，验证登录草稿保留、
  首页模式切换与首次发送、会话恢复/改名、报价与视频失败退款；理解响应由临时本地
  fixture 拦截，媒体 key 置空。模拟脚本仅在 /tmp，不属于产品代码。
- 本地 next dev 因 EMFILE 监听限制反复重启，已停止并改用 build + start 验证；
  生产构建关闭测试登录 UI。测试数据库与服务均为本机隔离资源，未接触生产数据。
- 仍需手测：真实 Qwen 多轮与文字保护、16 模板完整出图、选图编辑/转视频、上传与
  视频/音频参考、真实 Blob 存储和失败退款。全站 $10 成本熔断与 $50 验收预算仍是
  未授权建议；没有精确多模态总输入 token 预算熔断，不把缺失用量当作零成本。

- 收尾补充：自然语言引用本会话已有图片由服务端校验所选输出 ID，报价携带所选图、
  原始参考与约束；实际 SDK 模拟测试覆盖选择及非法 ID 拒绝。删除附件清理失败在
  刷新后仍可发现并重试；成功收到人工重试报价后允许用户再次请求新的报价。
  最终 451 项测试、build、lint、design:check 均通过；隔离测试服务已关闭。


## 2026-09-12 Agent 生产发布

- 用户明确授权“可以，我们上线”。生产 Supabase 已执行新增四表迁移
  20260911160000_agent_conversations；Prisma 完成记录与本地 checksum
  aab314446fdac81b199c24435a597f5fd7a171827eb48a07750ee61142dccdbb 一致。
  既有用户、积分、作品未改写。四表 RLS 开启，anon/authenticated 无 SELECT 权限，
  flownana_app 有应用访问权限；security advisor 仅报告既有 _prisma_migrations 无策略 INFO。
- 初次 CLI 账户验证返回 403；用户重新登录后恢复。备用发布接口因不完整文件清单被
  自动审批拒绝，未执行；最终使用完整工作区通过 Vercel CLI 成功发布。
- 部署 dpl_EbJm8qdevd4UcrqAsnnX4HHgwaP7 已 READY，
  https://flownana-r7c7isem4-liangchusans-projects.vercel.app 已绑定 https://www.flownana.com。
  云端构建、TypeScript、Prisma Client 生成通过。此次未提交或推送。
- 真实 Qwen 多轮效果、图片/编辑/视频及素材组合、生产退款和存储仍待手动付费验收；
  GA4 后台自动历史页面采集配置尚未核实，全站每日成本熔断仍未实现。
- 发布后 npm run smoke:prod 全部通过；/agent 与 /agent?template=logo 返回 200，
  无效会话路径返回 404，Agent GET/POST 未登录返回 401；登录 Provider 仅 Google。

## 2026-09-12 Agent 入口小调整（本地）

- 按用户要求移除共用侧栏独立 Agent 标签，保留会话历史和新建会话。
- Agent 上传按钮改为与 Image/Video 一致的圆形 Plus 图标，保留上传和素材选择逻辑。
- PRODUCT 与 DESIGN 已同步；build、lint（0 错误，30 条既有警告）、design:check 通过。
  浏览器检查 390/768/1440px；此次两处调整尚未部署，未重复执行真实上传或生成。

## 2026-09-12 最近会话交互（本地未发布）

- 移除独立 New conversation 行，Recent conversations 右侧小型 SquarePen 图标新建；
  标题按钮支持收起/展开，每行更多按钮提供重命名和删除确认，手机常显、桌面悬停/聚焦显示。
- 首次成功回复通过 Qwen 工具参数概括简短标题；讨论可使用 set_conversation_title，
  报价/追问直接附带标题。服务端只在首轮完成时替换初始标题，手动改名与完成重放受保护。
  不新增数据库结构，不额外记一次对话额度；旧会话不批量重新命名。
- 452 项测试全部通过、无跳过，包含真实隔离 PostgreSQL 的自动标题/手动改名/重复完成；
  build、lint（0 错误，30 条既有 warning）、design:check 通过。
- 浏览器使用临时会话与历史 API fixtures 检查 390/768/1440px、折叠、逐条菜单、重命名
  和删除确认；fixtures 不写入产品代码，未访问真实用户数据。
- 本次未上线；真实 Qwen 标题质量仍需线上验收，模型未返回标题时保留初始提示词标题。

## 2026-09-12 Agent 与最近会话提交发布准备

用户授权“提交上线”。审阅批次包含已批准且此前已上线的 Agent 首版、模板卡片样式，
以及侧栏入口、Plus 上传、最近会话菜单/折叠与自动短标题调整。452 项测试通过；
本批不新增迁移，生产 Agent 四表已在此前发布时完成。提交后核对远端 SHA，再发布并验证。

## 2026-09-12 Agent 最近会话生产发布完成

- 功能代码提交 53c134d，包含 Agent 首版与最近会话 UI 调整。
- Vercel dpl_6MdDviwmDog1mUJH7BeuC7GoJiHX 为 READY，
  https://flownana-h7gnyk8tz-liangchusans-projects.vercel.app 已绑定 https://www.flownana.com。
- 发布后 smoke:prod 全部通过，Agent/Logo 模板入口返回 200，未登录 Agent API 返回 401。
- GitHub 直连超时，代理推送首次被自动审批拒绝；用户明确授权具体远端后，
  53c134d 已成功推送 origin/main。后续文档提交记录此次发布。
- 手动验收：最近会话展开/收起、新建图标、标题更多菜单改名/删除、首次回复短标题、
  Agent Plus 上传。真实模型标题质量和媒体付费链路仍待用户验收；GA4 后台配置仍未核实。

## 2026-09-12 Runway 与 Flownana 品牌 UI 迁移及生产发布

- 用户最终确认 Runway 为视觉基调、Flownana 蓝黄为点缀，替代此前 Mobbin 提案，
  并明确授权依照方案开发。
- docs/UI-MIGRATION-PLAN.md 已整理全站方案：颜色角色与候选 Token、Inter 字体、
  组件/页面规范、响应式与状态验收、迁移步骤和回滚边界；PRODUCT 19 与 DESIGN
  下一版方向已同步。已确认视觉方向与拟定实施细则、当前 Claude 实现明确区分。
- 公开参考预览已核对；CLI 完整参考未导入，未执行 npx。方案中的 UI 蓝黄为候选值，
  不是从 Logo 原图采样的品牌标准色；开发样板需并排校色与实际对比度检查。
- 本地代码已把全局 Token 改为纸白/黑/中性灰，primary 改为黑色主操作；增加
  brand-blue、brand-yellow、link 和正文语义 Token。展示与正文统一 Inter，
  基础按钮改为胶囊，输入/选择器使用蓝色焦点；卡片、徽章、开关、侧栏选中、
  Home 标题/Composer 阴影、模板卡和 /design-system 已适配。Logo 和模板封面未改。
- 386 项测试中 375 通过、11 项需独立 PostgreSQL 而跳过；lint 0 错误、30 条既有
  warning，build 与 design:check 通过。浏览器检查 Home 390/768/1440px、Agent 390px、
  移动抽屉和 /design-system 1440px，无横向溢出；Inter、白底、黑色 primary、
  蓝色 ring 和侧栏 260px 均实测生效，读取的本地页面控制台错误为空。
- 用户明确授权“提交、推送、发布”。功能提交 `34f0bc6` 已创建；Vercel 部署
  `dpl_Cj1MRj9tFFcQwpJieiDYC1dcBosJ` 为 READY，生产地址
  `https://flownana-p72fdretm-liangchusans-projects.vercel.app` 已绑定
  `https://www.flownana.com`。云端 Next.js 构建、TypeScript 与 Prisma Client 生成通过，
  发布后 `npm run smoke:prod` 全部通过。
- 未执行真实登录或付费生成。登录态会话菜单/报价/媒体结果、Pricing 嵌套
  弹窗、真实生成等待/失败/退款状态仍需人工验收；外部 Runway 参考页在设计 QA
  二次截图时网络超时，但此前公开页面和预览内容已读取，本地实现截图已完成。
- GitHub HTTPS 在首次推送时持续连接超时；生产发布不受影响，功能提交及本条发布记录
  需要在连通恢复后完成 `origin/main` SHA 核验。

## 2026-10-05 正式 GA 发布准备（用户已授权）

- 用户明确授权准备并发布 Production。正式库已应用 `20261004232658_analytics_reporting`：新增两张分析表与索引/外键、RLS，仅服务端角色访问；Prisma 迁移历史已记录匹配源码的 SHA256。未复制测试用户/账单、未修改 Live Price CHECK。
- Production 已新增 `NEXT_PUBLIC_GA_MEASUREMENT_ID=G-2PTWF8DJE2`、`NEXT_PUBLIC_GA_ENABLED=true`；正式 MP Secret 已有独立 Sensitive 配置，Live Checkout 开关回读为 true。Preview/Development 保留 Test 配置。
- 本轮隔离 PostgreSQL 全量测试 508 passed / 2 skipped / 0 failed；TypeScript、lint quiet、design:check、diff check 通过。正式部署仍待执行；GA 后台登录浏览器连接恢复后核对增强采集设置。

- Production 构建 `dpl_5ReqFC36CmGGfP9zf3BAqexZuA8S` 已 READY，使用 `--prod --skip-domain`；正式 Stripe 账户和六个 Live Price 的云端回读校验通过，上传文件中仅 `.env.example`。正式域名仍指向旧部署，待后台设置回读后提升。正式 GA 增强型衡量已通过已登录 UI 停用，以保持唯一安全页面采集与最小事件方案。

## 2026-10-05 正式 GA 发布完成与验收边界

- 正式域名 `https://www.flownana.com` 已绑定 Production READY
  `dpl_5ReqFC36CmGGfP9zf3BAqexZuA8S`；提升后 `npm run smoke:prod` 全部通过。
  上一节“部署/提升待执行”为准备时历史状态，本节覆盖。Test 入口仍为 Preview READY
  `dpl_CdrS72RGKBgcZZP68TLkBk7iMhzY`，配置、库、Stripe/GA 未与正式混用。
- 正式 Stripe Webhook 只读回查 enabled、Live，指向正式 `/api/webhooks/stripe`，
  十类账单/订阅事件保留；构建已校验六个 Live Price。未执行真实扣款、未修改付款事实。
- 正式无痕浏览器实测允许统计：POST analytics/context 200、page_view 和 pricing_view
  的 Google collect 204，目标 G-2PTWF8DJE2，安全 URL/标题与 yearly 参数正确，广告
  个性化仍关闭。policy 200、private/no-store/Vary 正确；test-env 404。
- 浏览器解锁后控制仍返回旧画面/定位错误；本轮正式 GA 后台收件与线上撤回暂未回读，
  不能将网络 204 当作后台收件。真实注册、付款、成功生成同会话收件也保留人工验收。
  新表权限/RLS 回读正确；现有 _prisma_migrations 有 RLS 无策略信息级提示，与新增表无关。
- PRODUCT 已同步正式发布授权；方案、测试环境和验收文档已同步最新状态，历史快照
  不作为当前未上线结论。本轮部署当前工作区，未创建 Git 提交/推送；部署后的文档
  更新在本地，未重新部署纯文档记录。

## 2026-10-05 保存已发布代码与旧埋点复核

- 用户明确要求提交、推送本次已发布代码。批次保存当前 Production 运行源码，
  同时包括此前已发布但未提交的 Pricing/导航、付款返回与恢复、Live/Test 支付隔离、
  旧页面/无引用旧组件清理，以及本轮六事件 GA、分析迁移、地域策略和独立测试配置。
  不增加业务范围，不新增发布或真实扣款；正式后台收件等验收边界保持上节记录。
- 本轮静态复核 app/components/lib：旧 landing/signup/pricing/checkout/purchase、
  生成过程、模板、Agent 与下载事件均无 GA 发射点；客户端仅允许 page_view、
  pricing_view、begin_checkout，服务端仅允许 sign_up、purchase、generation_completed。
  generation_failed 仍作为业务错误码使用，不是上报事件；旧 GA 历史数据不删除。
- PRODUCT 中 Pricing 和失败诊断的旧事件表述已同步，历史契约明确标为已切换。
  已运行的回归证据为 508 passed/2 skipped/0 failed、静态检查与正式发布冒烟通过；
  本轮未改变运行代码，提交前另核对 diff 格式、候选文件凭据与远端分歧。
  提交与推送是否完成以最终 Git/远端 SHA 核验为准，不把本条计划当作推送成功证据。

## 2026-10-05 已发布工作区代码提交与推送完成

- 功能提交 `8907b418fb70974d61ae5fc250a9d3772ac1e222` 保存本次已上线工作区，
  共 101 个文件；已推送 GitHub `origin/main`。推送返回 main 更新成功，本地 HEAD、
  origin/main 与 `git ls-remote --heads origin` SHA 相同，远端只有 main。
- 旧业务埋点全站发射点静态复核无残留；仅六事件新方案。保留错误码和旧 GA 历史，
  未向正式 GA 补发虚构事实。修复了新文件末尾空行，未改变运行逻辑。
- 提交前候选文件凭据模式扫描未发现真实密钥，暂存 diff check 通过。没有重新执行
  全量测试或重新发布；运行验证沿用同一已上线源码的 508 passed/2 skipped/0 failed
  与 Production READY/发布后冒烟证据。正式实时收件、撤回、真实注册/付款/生成
  联结仍待手动验收，提交和推送不替代这些验收。
- 本条为功能提交完成后的版本留痕；随后仅提交并推送本条文档，不增加功能范围。
