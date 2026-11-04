# 注册广告归因排查 — 2026-10-27

> 历史归档（2026-11-03 整理）：以下是原记录日期的方案或审计快照，不能作为当前状态。当前规则见 [PRODUCT](../PRODUCT.md)，工程状态见 [MEMORY](../../MEMORY.md)。

## 结论与边界

已定位一个可复现的注册测量竞态：允许统计的访客在地区策略或 Google SDK 就绪前
发起登录，会继续成功注册，但没有为注册建立统计上下文。上下文接口失败也会产生
相同结果。已有数据库字段无法把这些技术失败与主动拒绝统计区分开。

这证明当前实现存在漏报风险，不证明两个历史新账号一定遇到了该竞态。历史请求
日志已超出平台保留窗口；不能排除拒绝统计、GPC、脚本拦截或网络失败。

初次只读排查没有修改应用实现、补发事件、注册真实账号或发布生产；用户随后批准
修复，本地修复与验收见末节。PRODUCT 的六事件、同意、
拒绝和不补报旧 missing_context 规则保持；不能用新增追踪绕过这些边界。

## 当前线上与数据库证据

- 实时回读 `www.flownana.com` 的生产部署为 `dpl_BaNLNQ8NH5MMc3dwSjrUc5tyGS7o`，
  READY，提交 `cbad973010566f556eaec00968321544c4daf905`。
- 广告系列 24366672863 的后缀已配置 google / cpc / fn_us_search_image_desktop_test01，
  另带 utm_content 和 utm_term。匿名 HTTP HEAD 核对裸域到 www 的 307 保留了
  source、medium、campaign。未点击付费广告，未修改投放。
- 正式页当前浏览器显示 Analytics on，DOM 中存在正式 Google tag；未见该页控制台
  error/warn。这仅验证当前浏览器状态，不代表历史访客或注册成功后的收件。
- 10-23 太平洋时间 00:00 至排查时，新建账号 2 个，均有 production sign_up 的
  missing_context / no_consented_context 记录。注册所在 UTC 小时分别为
  2026-10-23 17:00 与 2026-10-24 09:00；没有输出邮箱、用户 ID、IP 或 Cookie。
- 当前这两个账号均没有保留的 production AnalyticsContext，相关事件也没有非空
  context；不能据此排除过去存在过且随后被撤回/删除的上下文。
- 对应历史 Vercel runtime logs 查询被平台明确拒绝：Hobby 不保留该时间段日志。
  Observability schema 入口也返回不可用；没有把无法读取记录解读为没有错误。

## 断点

1. `AnalyticsPreferences` 异步请求地区策略，最多等待 5 秒，期间策略为空。
2. `captureAnalyticsContext` 在统计尚未就绪时立即返回 null；若 gtag 函数已存在，
   读取 client_id/session_id 的单轮回调超时为 1500 ms，没有登录专用就绪等待。
3. `signInForCurrentEnvironment` 调用一次同步后就进入 OAuth。线上同步函数不返回
   成功状态，HTTP 错误也不检查；本地安全修复虽已返回布尔值，登录调用方仍未使用。
4. Google 回调只读取签名统计 Cookie；没有有效 Cookie 时，注册事实仍正常创建，
   但统计记录被归为 missing_context。回跳保留 UTM 不会自动生成该 Cookie。
5. 恢复器只处理 pending/retry，不处理 missing_context。后来保存上下文也不补报
   原注册事件。这是现有隐私边界，不能把后来允许统计当作注册当时的授权。

## 隔离复现

使用实际线上提交与当前工作区源码分别运行 9 个情景。数据库、Google 登录边界、
SDK 和 HTTP 传输均为受控替身；未调用真实 GA、OAuth、媒体 Provider 或生产写入。
测试执行实际的统计捕获、上下文 API、Cookie 签名/读取、signIn 回调及注册入队逻辑。

| 情景 | 注册入队结果 |
| --- | --- |
| US 策略允许、SDK 就绪、上下文同步成功 | pending，含上下文 |
| US 访客在地区策略初始化前登录 | missing_context |
| 策略允许但 SDK 尚不存在 | missing_context |
| SDK 回调在 1500 ms 内无结果 | missing_context |
| 上下文 API 返回 503 | missing_context |
| 上下文网络请求失败 | missing_context |
| 服务端拒绝不匹配的地区默认证据 | missing_context |
| 访客明确拒绝统计 | missing_context，登录不被阻止 |
| GPC 优先关闭统计 | missing_context，登录不被阻止 |

两套源码各 9 项符合上述结果；所有情景均保留 callbackUrl 的 UTM。
对“策略稍后就绪”情景另保存有效上下文后，原事件仍为 missing_context。
正常控制组只验证入队 pending，不代表已发送、GA4 收件或 Ads 归因。

另运行现有 analytics-collection-policy、analytics-policy、analytics-recovery 三个
测试文件，19 项通过、0 跳过。没有声称隔离 PostgreSQL 或真实 Google 注册验收通过。

复现脚本和脱敏结果保存在
`output/diagnostics/signup-attribution-2026-10-27/`。脚本默认读取线上提交源码，
传入 working-tree 则读取本地源码；全部外部传输在替身边界内，不依赖真实凭据。

## 初次建议的最小修复范围

- 在允许统计的条件下，登录前有界等待地区策略与 SDK 就绪，检查上下文同步结果，
  并对短暂失败做有界重试；拒绝/GPC 和无法取得许可时继续正常登录。
- 等待、重试和账号切换期间持续复查许可，不复用其他浏览器或账号的上下文。
- 增加不带身份、URL、UTM、Cookie 或凭据的失败原因诊断，区分策略未就绪、SDK
  超时、HTTP/网络失败与无许可。现有一个 no_consented_context 不能支持根因定位。
- 保留后台真实注册事实、去重、环境隔离，以及旧 missing_context 不自动补报。
- 将 UTM 独立存入新账号会新增来源留存规则，涉及新的产品/隐私决策；本轮不扩展。

## 后续手动验收

在获准的新账号与测量测试环境，分别验证首次进入即登录、等待后登录、慢网络、
上下文失败重试、Google 往返、Reject/GPC、老账号登录及所有登录入口。
核对同一新账号仅一个 sign_up、原访问会话能关联、旧账号不新增注册事件；最后
回读 GA4 收件与活动来源。正式收件不能仅凭本地模拟或传输 2xx 判定。

剩余风险：历史两次注册的具体触发原因与广告来源无法从现有证据补回；生产缺口
在部署验收前仍存在。仅增加等待也不能保证被拦截、拒绝或离线访客可被追踪。

## 用户批准后的本地修复

- `lib/analytics-sign-in.ts` 提供最多 6 秒的登录前准备，区分未初始化与无许可，
  等待策略/SDK，最多 3 次同步；成功需上下文 API 回应成功，网络/暂时 HTTP 错误
  可重试，其他 HTTP 拒绝直接结束。全部登录入口通过原公共登录方法使用它。
- SDK 捕获和 HTTP 支持取消；显式拒绝、GPC、待撤回和换号取消原操作，迟到结果
  不触发新的上下文提交。账户请求携带起始范围。6 秒结束后继续登录并清理定时器
  和监听，不保留后台重试。SDK 正常仍两次读取标识，避免初始化临时 ID。
- 失败仅输出固定浏览器原因码，既不输出原始错误/身份/URL/UTM，也不增加 GA 事件。
  不改变注册去重、隐私契约或历史缺失事件；未增加表、迁移或账号来源字段。
- 新增 `tests/analytics-sign-in.test.ts`：17 项模拟时钟回归，覆盖等待、恢复、上限、
  回跳、拒绝/GPC、撤回重授、换号再切回、在途请求取消及账户请求头。
- 实际捕获/API/Cookie 签名/回调/注册入队链路的 9 项隔离模拟全部通过；
  策略/SDK 及时恢复、SDK 初轮超时后恢复及 503 后恢复均成为含上下文的 pending，
  永久失败/拒绝/GPC 保持 missing_context，登录可继续。每个情景再登录一次均未
  新增注册事件；回跳保留 UTM。结果保存在原 output 目录的 signup-fix 文件中。
- 全量测试 499 项：483 通过、16 个隔离数据库/真实 Stripe 审计未启用而跳过，0 失败；
  lint 0 errors/17 原有 warnings，design:check 与生产构建（含 TypeScript）通过。
  先前诊断脚本的局部变量 module 触发 lint，已改名，不改变其基线复现行为。
- 手动验收仍按上节执行；本地模拟不能证明真实 Google 登录、Google 收件或广告归因。
  当前工作区还有之前未发布的安全/支付迁移修改，不能直接把整个工作区作为仅含本修复
  的生产包发布；本次没有生产写入、补报、投放变更或部署。
