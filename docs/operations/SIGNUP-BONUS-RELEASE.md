# 注册赠送积分：发布与验收

状态：2026-10-27 用户明确要求上线后，生产配置、赠送迁移及本聊天范围发布已完成。
规则以 PRODUCT 第 9.1 节为准：新 Google 账号 10 积分、30 天过期，七地区白名单，
同 IP 首注册固定 72 小时窗口，重复注册不延长，首人不合格也占窗口。

## 本次发布结果

- Production READY：dpl_DfPrASNLkeLa7cdfhx3YmFvHhbmR，已promote至
  [www.flownana.com](https://www.flownana.com)；原生产部署保留用于必要时回滚。
- 从原线上cbad973基线导出隔离副本，只合入本聊天的赠送及未登录按钮展示；其他
  统计、安全、支付历史迁移、Agent预算和邮箱连接器均未发布，也未提交/推送Git。
- 生产项目kbpmirqktzxlpkfeuhtn仅应用本次20261027080705_signup_bonus SQL，并登记
  Prisma checksum；两新表权限/RLS/Server Policy回读正确。赠送随机密钥已以生产
  Secret保存，临时明文删除，deployment env名称已确认包含。未改其他环境和凭据。
- 隔离副本默认测试462通过/15跳过/0失败，赠送专项18通过；构建/类型/design通过，
  lint无errors、17原有warnings。发布后smoke:prod全通过，正式390/1440px按钮展示
  与布局已验证；没有实际Google新注册、积分到账、付费生成或GA4收件验收。
- 源码hash、部署回读、验证结果与可重建补丁在
  `output/releases/signup-bonus-20261027/`；本地源码与整个工作区有意不同。
  runtime SHA256为97db0edbc2835b5766d087a3e5be64599f5fd5a5eeef0457c8580d363f55d65f。
- 以下保留发布操作流程、开发历史验证与剩余手测；历史“尚未执行”不代表本次最新状态。

## 发布前置

1. 确认本次生产发布及迁移获得明确授权。工作区存在其他未发布变更，特别是
   `docs/operations/CHECKOUT-HISTORY-CUTOVER.md` 的支付兼容迁移，不得直接整体误发布。
2. 用 Owner/Admin 迁移连接按序应用 Prisma migrations；本次新增
   `20261027080705_signup_bonus`。先迁移、后运行新代码，新账号创建事务需要新表。
   不通过浏览器或 Supabase Data API 发积分；Runtime 保持 flownana_app、NOBYPASSRLS。
3. 在目标环境安全生成并配置 `SIGNUP_BONUS_IP_HASH_SECRET`，至少 32 字符随机密钥，
   仅服务端；不得写入仓库、工单、终端回显或客户端。Preview/Production 使用独立值。
   缺失/过短时新注册为 0，不在以后登录补发；因此配置成功是上线验收前提。
4. 密钥稳定保留：直接换密钥会把同一 IP 变成新摘要。需要轮换时，先停止赠送并等待
   现有 72 小时窗口结束，再换密钥恢复；不能把直接换密钥声称为无缝安全轮换。
5. 来源只在 VERCEL=1、NODE_ENV=production、VERCEL_ENV=production/preview 时启用。
   读取 `x-vercel-forwarded-for` 及 `x-vercel-ip-country`，不接受其他转发头、Cookie、
   邮箱资料或请求体替代。若以后增加自定义代理，必须重新验证平台头的可信来源。
   官方来源：[Vercel request headers](https://vercel.com/docs/headers/request-headers)。
6. 检查新表 RLS 开启、PUBLIC/anon/authenticated/service_role 无权限，flownana_app
   仅有必要 DML 权限及 Server Policy。检查赠送 CreditBatch 的单账号部分唯一索引。
7. 现有每日受鉴权 monthly-credits Cron 顺带清理过期 IP 窗口。窗口 72 小时后立即失效，
   物理摘要由下一次成功的每日维护删除；维护故障会延后物理清理，不能延长赠送限制。
   清理不删除账户的资格结果或积分账本；账户删除会删除这两者，但不释放活跃 IP 窗口。

## 手动验收

- 用真实 Google 新账号、平台可确认的允许地区出口注册，检查余额 +10、来源
  signup-bonus、到期为发放后 30 天；真实生成扣费及失败退款按既有机制工作。
- 同出口第二个 Google 新账号注册，余额 0，仍可正常登录和购买；第一个账号重登
  不重复赠送。七个允许地区及其他/未知地区需由可信平台证据验证，不能只靠自填头。
- 允许/拒绝统计都执行赠送规则，sign_up 仍仅新建一次且遵循原统计许可；不向 GA
  发送 IP/摘要。不把本地队列测试称为真实 GA4 后台收件。
- 真实 OAuth 回调后返回原页面，草稿保留；浏览器、手机、桌面余额刷新一致。
- 同 IP 三天窗口、删号重注册、并发与回调重试已有隔离数据库覆盖；正式复核余额、
  窗口到期及每日维护清理。查看隐私政策中新账户资格与反滥用说明。

## 验证范围与限制

- 本轮新策略5项及数据库专项13项通过，build（含类型检查）、design:check通过，
  lint为0 errors/17原有warnings；隐私说明390/768/1440px无横向溢出。
- 首次默认全量测试505项为488通过/17跳过；工作区另行变化登录与导航后，末次为
  486通过/2失败/17跳过。失败为pricing-login-intent的window fixture缺事件监听API、
  workspace-navigation的Agent入口源码断言未匹配。不改动其他任务代码，不声称全量通过。
- 新增测试覆盖纯资格策略及隔离 PostgreSQL 的账号/账本/窗口原子提交、并发、
  72 小时和 30 天边界、老账号/测试登录、Google callback 源码、统计许可、权限与清理。
- 本轮额外运行旧 analytics-reporting 数据库套件，有两项既有 fixture 失败：旧撤回
  场景没有当前浏览器撤回凭证；虚构 Stripe price 被现有 Live-only CHECK 拒绝。
  用 HEAD 的 user-sync 替代本轮注册实现后，两项同样失败；不属于本轮新增回归，
  未扩大范围修复旧 fixture，不能声称全部数据库套件通过。
- 共享公网 IP 可误伤家庭/公司/校园；动态 IP、VPN、代理和 IPv6 换址可绕过精确 IP。
  地理定位有误判风险。本轮不新增指纹、手机号验证、地理位置服务或投放规则。
