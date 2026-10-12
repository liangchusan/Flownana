# GA4 / Google Ads 测量复核 — 2026-10-12

## 结论

当前是有真实付款证据的最小测量架构，尚不能称为完整、最优或广告归因已验收。
继续保留 GA4 purchase 导入 Ads 的单一主来源；优先补齐授权覆盖、获客口径、
异常恢复和 Google 收件证据。没有证据支持立即重建 GTM / 服务端 GTM 或并行增加
第二条主要购买转化。以下为审计与建议，不是已批准实施的新产品规格。

本轮只读检查生产数据、部署、公共页面与代码；运行相关本地测试，更新审计文档。
没有更改业务代码、后台开关、数据库记录、广告预算、竞价、支付或生产部署。

## 证据与边界

- 正式域名部署回读：dpl_Cta7ATUAjCQuirZG1xLfd844Btyg，Production / READY。
  CLI 发布含未提交代码，deployment meta 的旧 Git SHA 不代表完整部署树。
- 正式公共 JS 确认运行 Measurement ID 为 G-2PTWF8DJE2；Test ID 也出现在
  环境校验常量中，这本身不是向 Test 属性发数据的证据。无独立 AW 转化发射实现。
- 正式匿名 advertising GET 200，enabled=true / granted=false / verified=false。
  本次 policy GET 为 defaultAnalytics=true / gpc=false，仅代表此次请求地域。
- 生产报告：purchase 1 条、generation_completed 1 条，均 transmitted，attempts=1，
  无 pending/retry/uncertain/invalid/expired 报告、无重复 purchase transaction_id。
- 购买字段：16 USD、tax=0、starter_monthly、quantity=1、price=16、
  purchase_type=new_subscription；稳定交易 ID、client ID、session ID 齐全。
  付款后 3.906 秒传输，付款发生于会话开始后 7.20 分钟。
- 生成报告传输延迟 0.192 秒。仅说明传输，不证明 GA4 / Ads 后台处理或匹配。
- 两条报告均无 advertising evidence，发生于增强功能上线前；当前广告授权记录 0，
  与用户最终 Reject 测试一致。没有新增强购买，旧购买未重放。
- AnalyticsContext / AnalyticsReport RLS 均开启，anon/authenticated 无 SELECT 权限。
- 本对话截图确认：正式 GA4 属性 208428049 的 purchase 导入 Ads；主要 / 购买；
  GA 动态价值、缺省 0 USD、每一次、数据驱动归因、点击 90 天 / 深度观看 3 天。
  原网站“订阅”为次要且已移出账号默认目标；购买保留默认目标。
- 用户确认 Ads 自动标记开启；GA4 用户提供数据收集开启、自动检测关闭。
  这些为截图/用户确认，不冒充本轮助手登录后台回读。
- 当前 CUA 浏览器连接超时，GA 管理端未完成自动读取；不可据此断言全部后台项正确。

## 当前保留的架构

浏览器 Google tag：page_view / pricing_view / begin_checkout。
服务端事实：sign_up / purchase / generation_completed。
Stripe 验签 + 远端回读 -> invoice 级持久去重 -> GA4 Measurement Protocol -> Ads 导入。
服务端使用浏览器真实 client_id / session_id，不伪造会话，不将付款成功 URL 当收款事实。
无上下文时保留 missing_context，不将后来的许可追溯用于旧购买。
邮箱仅在购买前已许可且发送时许可仍有效时规范化并 SHA-256，放入 MP user_data；
不放普通事件参数，不传原邮箱，ad_personalization 始终 DENIED。

Google 当前官方说明支持 GA4 导入路径共享增强数据，无需额外配置 Ads 原生增强入口：
https://support.google.com/analytics/answer/14252663?hl=en
这不代表仅开启平台开关就已收到或成功匹配真实增强数据。

## 优先处理的缺口

### 1. P1：广告授权覆盖不足（代码已证实，影响比例尚无流量数据）

- lib/analytics-preferences.ts:16 仅对需要基础统计同意且无旧选择的访客提示。
  US/JP/TW 默认统计地区没有首次广告授权提醒。
- components/analytics/analytics-preferences.tsx:97：匿名 Allow 仅开基础统计并关闭面板；
  登录后不会自动提示当前账户再 Allow。已有基础同意也不会触发新广告提示。
- 正常新用户因此可能完成登录、结账、付款而始终 ad_user_data=DENIED，无法附带
  邮箱增强数据；点击 ID 转化导出也可能受到限制。
- 这是当前已批准的账户授权边界与低干扰提示共同造成的覆盖限制，不是授权泄露。
  建议在已验证登录完成后或首次结账前给一次非阻断、可拒绝的当前账户授权入口，
  保留 Allow / Reject，不默认允许，不把匿名许可自动绑定其他账号，不反复打扰拒绝者。
  改变提示流程前更新产品规格并确认。
- 实测纯函数：regional default + 未选择 -> 不提示；匿名 Allow 后 -> 不提示。
  正式 JS 同样含此条件。

Consent Mode 广告数据用途说明：
https://support.google.com/analytics/answer/13802165?hl=en

### 2. P1：purchase 不是新增付费人数

- lib/analytics-purchase.ts:44 将新订阅、升级、续费全部报告为 purchase，以 purchase_type 区分。
  new_subscription 是新建订阅，不保证该账号历史首次付款；取消后重新购买也可能属于它。
- 当前每一次 purchase 作为主转化，对优化订单/收入可作为 MVP，但不能将 CPA 解释为
  新客 CAC；后续老客续费、升级被归因时会影响该数值。
- 建议先用 Stripe/业务账本计算唯一首次付费客户数、续费、升级与净现金收入。
  若投放目标明确为新客，再设计后端核验的首次付费信号或可靠筛选；不能只筛
  purchase_type=new_subscription，也不能与全部 purchase 同时设为主要造成双计。
- 续费依赖最新账户上下文，超过 72 小时未访问通常 missing_context，故 GA 也不是完整
  订阅续费账本。该限制符合当前“不伪造标识”的规则，不应为补齐报表绕过同意。

### 3. P1：故障后的反馈恢复较弱，缺少主动发现

- lib/analytics-server.ts:75 正常 after 任务每次最多 5 条，账户 context 同步也可唤起发送；
  vercel.json 的独立 analytics cron 每日一次，默认最多 20 条，不循环清空积压。
- 网络超时、5xx、进程中断进入 uncertain 并隔离，避免未知接收状态下盲目重复发送。
  代码中未发现针对这些终态的主动通知/对账处理流程。
- 本轮队列为空，没有已发生丢单的证据；风险是在低流量或故障期缺少快速恢复与告警。
- 建议设更及时的有界恢复与监控，区分 purchase 的交易去重和其他事件重试规则；
  uncertain 先核对事实，不能统一强制重发。监控 pending 年龄、发送延迟、uncertain、
  invalid、expired、missing_context 及业务应报与可测量应报的差异。
- Google 的会话归因要求请求在原会话开始后 24 小时内发送；72 小时可回填事件不等于
  保留原会话归因。导出广告平台另有最新在线事件 63 天等条件，不能混为一谈。

https://developers.google.com/analytics/devguides/collection/protocol/ga4/use-cases

### 4. P2：营销参数过滤有覆盖边界

- lib/analytics-policy.ts:23–25，仅 /、/image、/video 的安全 page_location 保留白名单参数。
  每值限制 100 字符且只接受 ASCII token。101 字符 gclid、带空格/中文的 UTM 会整项丢弃。
  /pricing、/agent 会移除全部 query。正式 JS 中核验到同样规则。
- 本地复现了这些字段从上报 page_location 消失。未观察 Google SDK 对所有点击 ID 的
  其他读取行为，因此不把它升级成“所有这类点击一定归因失败”。
- HTTP 实测：HTTP 根域名 308 到 HTTPS 保留参数，HTTPS 根域到 www 保留参数；
  www 首页、Image、Video、Pricing 均 200 且地址查询参数保留。HTTP 通过不替代 SDK 收件。
- 建议广告暂使用 /、/image、/video，营销命名用短英文 token；之后将点击 ID 与 UTM
  分别校验合理上限，并验证真实 Google 请求。继续禁止 Prompt、邮箱、session/token 泄漏。

### 5. P2：退款、净收入和投放回本尚无闭环

- 当前没有 GA refund / Ads 转化价值更正流程；产品文档已明确暂不纳入六事件 MVP。
  不可将 purchase 收入或 Ads ROAS 直接称为净收益。
- 财务应扣现金退款、拒付、支付费用、生成及存储成本；权益退积分不是现金退款。
- 先维护 Stripe/业务对账，再在出现退款或规模化价值竞价需要时单独设计调整接口。
  多行/混合账单会在购买验证阶段直接跳过，未来账单模型扩展时需要覆盖诊断，不能
  只靠 AnalyticsReport 的 missing_context 捕获所有潜在测量缺口。

## GA / Ads 后台尚需回读的项目

| 项目 | 建议与验收 |
| --- | --- |
| GA4 网页增强型衡量 | 保持已批准的关闭策略，尤其浏览器历史自动 page_view，避免与手动路由重复；需当前后台复核 |
| 用户提供数据能力 | 已有属性开关/自动检测用户确认；核对 Google tag 的相关能力配置，最终以实际 MP 数据和 Google 处理证据验收，不开启 DOM 自动抓取 |
| 支付与登录引荐 | 检查 checkout.stripe.com / billing.stripe.com 等实际支付来源是否列为不需要的引荐；accounts.google.com 按实际登录回流检查，不屏蔽整个 google.com |
| 币种和时区 | GA 报表 USD；Ads 币种、GA/Ads 时区都要回读。不同币种可以工作，但报表须统一汇率与日期口径，不假定 Ads 已是 USD |
| 数据保留 | 建议按获批保留策略选 14 个月以支持探索/漏斗；不自动延长。标准聚合报表与探索保留不是同一概念 |
| 自定义维度 | 仅现有的 purchase_type、billing_cycle、media_type 按事件范围注册；item_name/price/currency 为标准字段，无需重复注册 |
| 内部/开发流量 | 确认 Test 属性隔离；过滤器先测试状态再启用，避免将唯一真实测试付款证据误删。当前16美元为本人验收单，不代表市场获客 |
| Ads 广告系列目标 | 账号默认购买已确认；实际创建系列时确认继承购买，未被系列专属/自定义目标覆盖 |
| 报表 | Ads 按转化操作看 purchase 次数/价值/费用；GA 看渠道、落地页和用户漏斗；业务看首次付费、续费、净现金和成本 |

第三方支付引荐排除：
https://support.google.com/analytics/answer/10327750?hl=en
数据保留作用范围：
https://support.google.com/analytics/answer/7667196?hl=en

## 哪些增强不是当前必需项

- 不因“最优”开启个性化广告、Customer Match、全部增强型衡量或所有事件主转化。
- 不把 Google signals 关闭直接认定为错误；Google 的 2026 控制规则发生变化，广告数据
  用途与行为报表的 signals 需分别看，不能照旧教程全开。
  https://support.google.com/analytics/answer/17016975?hl=en
- MP 的 user_id 在当前官方正文中为可选但推荐，不能因摘要残留旧的 required 表述就
  断定现有无 user_id 的哈希负载无效；当前方案明确不新增 user_id。需要跨设备身份分析
  时再设计非个人信息的 ID、同意与清除规则。
  https://developers.google.com/analytics/devguides/collection/ga4/uid-data
- GA4 导入是当前点击获客 MVP 的合理路径，但不是所有广告类型覆盖最全的方案。
  官方说明 GA 导入不提供原生 Ads 的 view-through（仅展示未点击后转化）统计；如果后续
  重点投展示/视频，应另评估原生 Ads 测量，不能与导入购买同时作为主要。
  https://support.google.com/google-ads/answer/10632359?hl=en-GB
- BigQuery/经营看板可在希望积累可复算原始数据时启用日导出，先确认云计费、权限与
  保留范围；它是分析基础设施选择，不是解决当前授权覆盖的前置条件。

## 本轮验证与后续手工验收

- 定向本地测试 27 项：26 通过、0 失败、1 跳过（缺独立 PostgreSQL 测试 URL）。
  增强/授权测试的数据库和 Google 传输为隔离替身，不冒充 Google 匹配验收。
- 只读 HTTP 使用明确的 synthetic 点击参数、不执行网页 JS，不向 GA 发送伪造购买。
  无真实广告点击、无新扣款、无旧交易重放；本轮不重新做无关全量构建。
- 手工还需：新访客从广告落地 -> 授权 -> Google 登录 -> Pricing -> Checkout -> 新真实付款
  -> Webhook/报告 -> GA purchase 金额商品 -> Ads 归因。用户真实拒绝路径应保持正常使用
  且不附带邮箱。现有拒绝账户若用于下一次验收，须在新付款前重新自愿 Allow。
- 不要求为了测试额外购买；可等待经授权的下一笔正常订单。自然访问本人付款不能
  证明 Ads 广告点击匹配，更不能人为点击自己的广告制造验收数据。
- 手工后台复核可以现在完成；增强匹配与广告效果需真实流量和平台处理，不能以
  collect 204、队列 transmitted 或“等待转化记录”单独宣布全部通过。

建议顺序：补一次当前账户授权提示 -> 确定首购/订单优化口径 -> 加恢复监控并核对
营销参数 -> 完成后台清单 -> 小规模真实投放验收 -> 再决定加预算或追加测量设施。
