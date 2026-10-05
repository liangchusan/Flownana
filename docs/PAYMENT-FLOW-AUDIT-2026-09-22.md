# 支付全流程测试与优化方案

状态：部分问题已在本地实施并回归；浏览器最终付款和完整升级仍未验收，不能发布为全量通过。

## 范围与证据标准

覆盖首次订阅、登录衔接、订阅到账后的提示与创作引导、全部升级方向、取消与
账单管理、续费和积分发放、异常恢复、账户隔离、并发幂等、埋点及响应式交互。
使用当前工作区作为测试对象。真实支付只在 Stripe Test Mode 与隔离本地数据库
执行，不使用真实银行卡，不改变现有客户订阅。产品优化先形成方案，不在审计
过程中擅自修改计费或用户流程。

证据分层：规则单元测试、真实 PostgreSQL + Stripe 故障注入、真实 Stripe 测试
对象/API、浏览器交互。Mock 通过不能替代 Stripe 集成；HTTP 200 不能替代 UI 验收。

## 验收矩阵

| 范围 | 必须覆盖的情况 | 当前证据 |
| --- | --- | --- |
| 首次订阅 | 三套餐 × 月/年付、金额/币种/周期一致、无订阅/过期用户 | 六种真实 Test Mode Checkout 金额/周期通过；Starter 月付浏览器付款返回、积分与引导通过；其余档位待验证 |
| 登录衔接 | 未登录选套餐、登录后继续、登录失效、不同账号切换 | Test Mode 登录后恢复 Starter 月付与原页面已在浏览器验证；失效和跨账号待验证 |
| Checkout | 成功、取消、拒付、3DS、重复点击、换套餐、过期、网络断开/重试 | 真实六套餐 Checkout、API 拒付/3DS、取消地址及请求期禁用已验证；浏览器付款和网络异常待验收 |
| 返回与引导 | 先返回后通知、先通知后返回、延迟、刷新、无 session/伪造 session、恢复创作 | 伪造/缺失 session、服务端核验和取消后草稿已验证；真实付款后的浏览器引导待验收 |
| 升级矩阵 | 六种当前套餐 × 六种目标；月转同档年、升档、年转月禁止、降档禁止、Max 年封顶 | 现有规则测试，待 UI 验证 |
| 升级报价 | 无抵扣、年付剩余月份抵扣、月末/闰年/临界发放、报价变化/失败/重试 | 现有规则及隔离测试，待补充 |
| 升级结算 | 旧订阅取消、新积分、仅消费一次剩余价值、取消失败、已扣款恢复 | 隔离数据库事务及故障注入通过；Starter 月付→Pro 月付真实 Test Mode 浏览器付款、旧订阅取消与新积分通过；年付抵扣付款待验证 |
| 续费/生命周期 | 月付续费、年付每月发放、支付失败/恢复、到期取消、Portal 管理 | 首期未付后补付、签名通知去重、年付第二次月度积分通过；真实续费/Portal 待验证 |
| 并发与安全 | 重复/乱序 webhook、多标签页、跨账号、删号重注册、非法价格 | 部分现有规则及隔离测试 |
| UI | 390/768/1440、长内容、滚动、Esc/焦点、返回保留周期、加载/错误/禁用、草稿 | 定价弹窗三宽度、Esc/焦点、购买禁用、取消返回草稿通过；完整状态矩阵待验收 |
| Analytics | pricing_viewed、checkout_started、purchase_success 的触发和去重 | 成功事件服务端核验、本地交易去重测试通过；真实 GA4 和跨设备去重待验收 |

## 已执行

- 2026-09-22：`npm run test`，408 项，397 passed、11 skipped、0 failed。
  日志 `/tmp/flownana-payment-audit-baseline.log`。11 项数据库测试未设置隔离库，
  因而跳过，不能作为数据库集成已通过的证据。
- 读取本地环境配置，仅检查变量是否存在和 Stripe key 模式；本地配置为 Test
  Mode，没有输出凭据。正在核对 Stripe Price 与准备隔离数据库。

### 隔离数据库与真实 Stripe（已执行）

- 临时 PostgreSQL 18.4，仅本机访问，数据库 `flownana_payment_test`；全部现有
  Prisma migrations 应用成功，不接触业务数据库。
- 开启原先跳过的数据库用例后：474 项，472 passed、2 failed、0 skipped。
  两条失败计数来自同一个子用例及其父套件：
  `tests/generation-routes.test.ts:395` 的历史 Provider 图片引用用例。
  单独复跑仍失败（23 passed、2 failed），尚未判定是实现回归还是测试夹具过期。
  日志 `/tmp/flownana-payment-audit-database.log`、
  `/tmp/flownana-payment-generation-recheck.log`。
- 其中支付事务套件 12 个子用例、结账预约套件 18 个子用例全部通过：真实
  PostgreSQL 事务，Stripe 边界故障注入，覆盖并发请求、重复/乱序通知、旧订阅
  取消失败后重试、换套餐、旧报价过期、跨账号与删号冲突。
- 新增显式 opt-in 的 `tests/stripe-sandbox-audit.test.ts`：六种套餐的真实 Stripe
  Checkout 创建、总额/币种、返回地址、同请求复用、未付款不发积分、关闭 Session；
  另用真实测试支付方式 `pm_card_visa` 建立年付订阅，验证真实 paid invoice 首次
  发 200 积分、重放不重复发放；推进到年度订阅下一个月度发放时点后再次发放
  200 积分，重放仍不重复；取消后不再发放。8 项（含父套件）全部通过，
  日志 `/tmp/flownana-stripe-sandbox-audit.log`。该脚本创建的 Session 已过期，
  订阅已取消、测试 Customer 已删除；未发生真实资金流动。
- 六个 Test Price 全部 active/USD，金额依次为月付 1600/4800/9600 cents，
  年付 9600/28800/57600 cents，周期与目录一致。
- 浏览器实际登录本地隔离账号 `payment-qa-20260922@example.test`，Billing 展示
  0 积分、无订阅；从 Pricing 点击 Starter 年付，三个购买按钮在请求期间均禁用，
  实际到达 Stripe 沙盒 Checkout，显示 US$96/year、US$8/month。
  后续浏览器读取/操作反复超时，尚未完成该 Session 的银行卡填写与支付返回。
  这不影响上面 API 集成结果，但不能把该浏览器链路记为已通过。
- 2026-09-23：新增 opt-in 的 `tests/stripe-payment-recovery-audit.test.ts`。真实 Stripe
  Test Mode 中创建无支付方式的首期 `incomplete` 订阅，确认未付不发积分、再次
  购买被拒；补上测试支付方式后支付原账单，经本地签名 `invoice.paid` 通知发放
  Starter 月付 200 积分，重复通知不重复发放，错误签名返回 400。此处验证的是
  本地路由处理签名事件，不代表 Stripe Dashboard 实际通知投递。另建真实已付款
  Starter 年付订阅，升级 Pro 年付剩余 11 个月抵扣 $88，目标 $288，待付 $200；
  创建的 Checkout 实际折扣和单预约匹配，付款前旧订阅仍 active。3 项（含父套件）
  通过，测试 Session 已过期、订阅已取消、Customer 和本地测试账号已清理。
  日志 `/tmp/flownana-stripe-recovery-audit.log`。真实拒付、已付款升级后旧订阅取消
  和新积分到账仍待测。
- 隔离数据库全量回归：479 项，474 passed、0 failed、2 skipped、3 todo。
  2 项 skipped 为显式 opt-in 的沙盒套件父用例；3 项 todo 为已复现的 PAY-01
  审计断言，当前仍不符合预期。此前唯一额外失败是历史图片引用测试夹具缺少
  `generated` 资产对应的成功 Generation；补足夹具后该套件 25 项全部通过。
  日志 `/tmp/flownana-payment-audit-full-recheck.log`。

## 问题与复现证据

1. **PAY-01 / P1，本地已修复：成功埋点未绑定已验证交易。** `AnalyticsEvents` 原来通过 `checkout=success` / `upgrade=success` 查询参数触发
   `purchase_success`，未读取服务端结算结果；金额来自 URL，普通成功 URL 不携带
   金额。`tests/payment-return-audit.test.ts` 实际执行该组件，复现未登录且无
   Session 仍发成功事件、接受伪造金额、重新挂载重复计数三个问题。原先三个审计
   断言曾列为 TODO，均不满足预期。现改为服务端核验后才传交易数据给账单页，
   查询参数不再触发成功事件；本地同一交易重访去重。4 项埋点断言已通过，
   没有向真实 GA4 发送测试事件。跨浏览器重复仍需 GA4 端核对。
2. **PAY-02 / P1，本地已修复：未确认付款仍显示已收款。** Billing 服务端原来将缺少 session 和所有结算异常统一标记为 pending，但客户端
   标题为 `Payment received — finishing setup`，在未证实付款时仍暗示已经收款。
   已用浏览器复现：全新账号直接访问 `/account/billing?checkout=success`，
   显示该标题，同时下方仍是 0 积分与 No active subscription。现在缺少 Session 显示
   `No payment to verify`；未完成支付显示 `Payment not completed`，已付款但权益未同步
   显示 `Payment received — updating your plan`，无法核验显示中性提示；只有当前周期
   积分发放记录已存在且账单套餐匹配时才显示成功。返回状态单测覆盖四种结果，
   390/768/1440px 浏览器实测缺失 Session 状态。
3. **PAY-03 / 本地已修复：** Checkout 原先取消固定回 `/pricing`，会丢失发起购买的
   页面路径。现在 Pricing 向服务端提供当前站内相对路径；取消后回该页面并重新
   打开弹窗，旧预约仍走 `/pricing` 兼容地址。服务端拒绝外站、API 路径和非法 URL，
   清除旧交易参数。真实 Stripe 沙盒 Checkout 已核对取消 URL；浏览器模拟从
   创作页离开、返回并关闭弹窗，确认原页面与 Prompt 草稿保留。
4. **PAY-04 / P1，本地已修复、待浏览器复核：未付订阅没有可见恢复入口。** Test Mode 首期无支付方式时，订阅是
   `incomplete`，未付没有积分；`getBillingSummary` 只返回 `active`/`trialing`，
   因而账单摘要中无订阅。此时 `createReservedCheckout` 因现存未完成订阅而拒绝
   新购并提示去 Billing 解决，但 Billing 并未展示这笔订阅或付款操作。已用真实
   Stripe 对象加隔离数据库复现。现在 Billing 对 `incomplete`/`past_due`/`unpaid`/
   `paused` 显示待处理状态；对仍开放的本人账单，服务端核对账号、Stripe Customer、
   订阅和发票后返回 Stripe Hosted Invoice 付款链接。真实沙盒首期未付及补付后
   状态在 API 集成测试中通过。浏览器已实测 `incomplete`：Billing 显示待付提示、
   积分为 0、恢复按钮可点击；Pricing 三个套餐 CTA 均指向 Billing 的补付入口。
   点击后进入外部 Stripe 发票页时浏览器连接超时，未完成外部页面付款。
   补查发现 `paused` 原来仍显示必定失败的 Complete payment；现改为 Billing Portal，
   其他待付状态补充 Manage billing 兜底。Billing 返回时对本账号待付订阅重读 Stripe，
   已付发票可在 Webhook 延迟时补齐权益；真实 Test Mode 加隔离库验证不发未付款积分、
   已付后发 200、重复访问只发一次。其余 `past_due`/`unpaid`/`paused` 仍需浏览器验收。
5. **PAY-05 / 本地已修复：已核验成功事件可能在 GA 初始化前漏报。** 新成功事件组件
   原先只在挂载时尝试一次；当 `gtag` 尚未就绪时，`trackEvent` 返回 false，之后
   不会再尝试。新增测试先复现失败，再改为最长 20 秒的有限重试；每次重试先检查
   同一交易的本机记录，上报成功后立即停止，组件卸载时清理定时器。针对性测试
   已通过。真实 GA4 收到事件与跨设备去重仍未验收。

## 优化方案（P1 已在本地实施，剩余项待验收）

| 优先级 | 方案 | 验收要求 |
| --- | --- | --- |
| P1 | purchase_success 由服务端已核验的交易结果驱动，交易 ID 去重；金额/币种来自 Stripe | 伪造 URL、未付款、跨账号均不计成功；刷新不重复；金额与实付一致 |
| P1 | 返回页区分“核验中”“尚未支付”“已付款待到账”“到账成功”“无法确认”；仅有付款凭证才说已付款 | 无 session/拒付不显示收款；延迟能刷新重试；成功显示到账数量与下一步 |
| P1 | Billing 显示 `incomplete`/`past_due` 的应付账单状态和安全恢复入口，并将新购阻止信息直达该入口 | 用户能找到原账单、补付后恢复；未付不发积分；取消/过期后可正常重选套餐 |
| 部分完成 | 安全的站内 returnTo；保存登录前所选套餐与周期 | 取消返回原页、草稿保留、拒绝外部重定向、选择过期/篡改和登录回跳单测通过；登录后浏览器状态仍待验收 |
| 待验证 | Billing/升级确认共享状态文案、金额层级、加载及错误恢复样式 | 桌面/手机、键盘、焦点、二级弹窗返回都符合 DESIGN |

不改套餐价格、积分额度、升级方向、退款政策或 GA4 事件名称。P1 的验收规则
已同步 PRODUCT；未完成的返回路径与全浏览器付款链路仍按下方清单逐项验收。
Stripe Tax 是否适用及税务登记应另行确认，本轮不启用自动税、不修改税务配置。
测试数据依据 [Stripe 官方测试说明](https://docs.stripe.com/testing)。

## 本地实施与回归（2026-09-24）

- PRODUCT 已写入付款返回、未付恢复和 `purchase_success` 的验收规则；未改套餐、
  价格、积分、退款或 GA4 事件名称。
- 服务端完成的 Checkout 才将交易 ID、实付与抵扣传给 Billing 的成功提示和埋点；
  缺失 Session 与核验失败都不显示已付款。订阅状态与已核验目标不一致时暂缓成功。
- 新增待付发票恢复入口，鉴权、账号范围、Stripe 归属、发票和 Test Mode 生产
  限制逐层核对；支付前不发积分，恢复后签名 Webhook 发放一次。
- 隔离库全量 `npm run test`：486 项、484 passed、0 failed、2 skipped（显式
  opt-in 沙盒套件）、0 todo；沙盒恢复/报价/拒付/3DS 另行 opt-in 5/5 passed。
  `npm run lint -- --quiet`、`npm run design:check`、`npm run build`、
  `git diff --check` 通过。没有部署。
- 浏览器实际检查缺失 Session 文案、定价弹窗开关/Esc/焦点返回、390/768/1440px
  无横向溢出；点击 Starter 年付进入 Checkout 的页面控制再次超时，不能视为
  完成浏览器付款。测试环境的 Vercel Test Mode 限制需指定 QA allowlist。
- 用独立 QA 账号临时创建真实沙盒 `incomplete` 订阅，浏览器确认 Billing 待付提示、
  0 积分、补付按钮与 Pricing CTA。点击补付后跳转外部发票时浏览器超时；
  Stripe 状态仍 `incomplete`，已取消测试订阅并删除 Customer 与本地记录。
- 真实 Stripe Test Mode 六套餐 Checkout 复跑 8/8 通过；Starter 年付取消 URL
  指向 `/image?mode=agent#pricing`，旧调用仍为 `/pricing`。浏览器模拟跨页面
  离开和取消返回，原 Prompt 草稿保留；临时测试草稿已清空。
- 真实年付 paid invoice 首次发放 200 积分，推进本地月度发放时间后第二次发放
  200 积分，重复执行不多发；该项属于 Stripe Test Mode 付款加本地 PostgreSQL
  的积分调度集成，不代表 Stripe 自动续费账单或实际 Cron 已执行。
- 恢复/升级 opt-in 脚本补测首期真实测试卡拒付与需要 3DS 的 PaymentIntent
  状态，5/5 通过；只验证 Stripe API 状态，浏览器失败文案和 3DS 操作仍未验收。
- 登录前所选套餐与周期现在保存于当前标签页，十分钟后或格式非法时失效；登录
  回跳原页面并重开 Pricing，需用户再次点击所选套餐才发起 Checkout。登录地址、
  过期、篡改和清除行为单测通过。浏览器已实测未登录选 Pro 月付后回跳地址为
  `/image#pricing`；当前构建只提供 Google 登录，开发服务器因 Watchpack `EMFILE`
  反复重启，未完成登录后的状态验证。
- PAY-05 的延迟 GA 初始化复现测试先失败，修复后通过；成功埋点现在有限重试，
  成功或组件卸载即停止，不因刷新同一浏览器的交易重复上报。

## 尚未完成的验收（按 2026-09-24 最新复核更新）

- Starter 月付及 Pro 月付升级的真实 Test Mode 浏览器付款、成功引导、旧订阅
  取消和积分核对已完成；仍需实际浏览器拒付、3DS、年付抵扣付款与其他升级方向。
- 续费失败/恢复、Portal 取消/恢复与降档、真实 Webhook 通知投递仍需验收；
  本地签名 Webhook 及无 Webhook 时的 Billing 补偿已通过集成测试。
- 390/768/1440 的完整状态矩阵、嵌套 Esc/焦点、离线/慢网/重试、多标签页。
- 登录后套餐选择保留已浏览器验证；`past_due`/`unpaid`/`paused` 的真实浏览器
  视觉/交互和 Stripe Hosted Invoice 外部页面仍待验收。埋点本轮暂缓。

当前结论是“首购和月付升档已完成浏览器 Test Mode 验收，其他支付边界仍需
验收”，不能宣称全流程测试完成。

## 2026-09-24 本地浏览器 Test Mode 付款复核

- 用独立测试身份从 `/image#pricing` 选择 Starter 月付，测试登录后返回原页面，
  月付周期与所选套餐恢复为 `Continue with this plan`；点击后创建真实 Test Mode
  Checkout，金额 USD 16、取消地址 `/image#pricing`。该 Checkout 随后显示
  `complete`/`paid`、新订阅 `active`，本地预约 `fulfilled`。最终测试付款动作
  不由本代理在浏览器执行。
- Billing 浏览器页面显示 Starter 月付、当月 200 积分及 `Start Creating`；刷新后
  仍只有一批 200 积分。点击引导返回 `/image`，侧栏显示 Starter 和 200 credits。
  本地未配置 GA，所以不能把此轮记作真实 GA 收件验收。
- 从已生效 Starter 月付打开 Pricing，当前套餐禁用；Pro 月付升级确认展示原价
  $16/月、新价 $48/月、800 积分/月、今日应付 $48。升级 Checkout 创建时，
  Stripe 核对为 `livemode=false`、`open`/`unpaid`、USD 48，旧订阅仍 `active`。
  最终测试付款在浏览器代理暂停期间完成，本代理未点击付款按钮。随后 Stripe
  核对 `complete`/`paid`、USD 48；新 Pro 月付订阅 `active`，旧 Starter 月付
  `canceled`。隔离库预约 `fulfilled`，Credits 两批共 1000（旧 200 + 新 800）。
  浏览器 Billing 显示升级成功、实付 $48、Pro 月付、1000 积分；刷新后仍是两批
  共 1000，未重复发放。此处验证了月付升档的完整测试付款和返回，年付抵扣的
  完整浏览器付款仍待验收。

## 2026-09-24 待付恢复补强（本地未发布，埋点暂缓）

- 修正返回页四种静态结果：无 Session、未完成支付、已付但权益同步中、无法核验；
  只有当前周期积分发放记录与账单套餐都吻合才显示成功。账单摘要读取失败时
  不再同时展示成功和同步中。返回状态测试 1/1。
- `paused` 显示账单管理操作，不再显示必定失败的补付按钮；其他待付状态提供
  Hosted Invoice 补付与 Billing Portal 兜底。付款后若 Webhook 尚未到达，
  Billing 读取时核对本人 Stripe 订阅与已付发票，再复用幂等积分发放。
- 真实 Stripe Test Mode 与隔离库验证无 Webhook 的已付 Hosted Invoice 可补齐
  Starter 200 积分，重复访问不多发；恢复套件 6/6、账单事务 13/13、全量
  485 passed/2 opt-in skipped、0 failed。TypeScript、lint（0 errors、16 既有
  warnings）、design:check、preview build、diff check 通过。浏览器复核已付
  Pro 月付返回页、缺失 Session 提示；390px 无横向溢出。未提交、未发布。

## 2026-09-24 生产部署状态

- 之后用户批准发布；当前工作区部署为 Vercel 生产
  `dpl_qVT1bE5MxAYsU5QbLffmuGXJUfd5`，CLI 确认 `READY` 和
  `https://www.flownana.com` 别名。此部署包含本审计对应的 Pricing、支付恢复
  与此前工作区已有的埋点代码；本轮未继续优化埋点。
- 发布前全量 485 passed、2 opt-in skipped、0 failed，lint、TypeScript、
  design:check、生产模式本机构建通过。线上 HTTP 冒烟因本机 DNS/连接失败
  尚未完成，不能据此宣称线上页面或真实支付链路验收通过。
