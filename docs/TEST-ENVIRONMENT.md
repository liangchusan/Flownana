# Flownana 测试环境

2026-10-05 已部署；本文件只记录资源身份和操作边界，不包含凭据。

| 项目 | 测试资源 |
| --- | --- |
| 入口 | https://flownana-test.vercel.app |
| Vercel | flownana 项目的 Preview，dpl_CdrS72RGKBgcZZP68TLkBk7iMhzY，READY |
| Supabase | flownana-test，heaahlpqqfehojzvozhr，东京，现有 Free 组织 |
| Blob | flownana-test-media，store_7bTCQFi1TafI9fvg，hnd1，仅 Preview |
| GA | Flownana Test / 557281646，G-RP4MTRCXT0 |
| Stripe | 既有 Sandbox acct_1SwJsDRqa49126u8；六个 Test Price |
| Webhook | we_1UN41xRqa49126u8ZWrq9LmT，仅固定测试入口 |

2026-10-05 经用户明确授权，正式站已切换至 Production READY
`dpl_5ReqFC36CmGGfP9zf3BAqexZuA8S`；正式数据库仅新增分析表迁移。
本页测试入口及全部测试资源保持独立，未提升测试产物到正式站。
Google 共享 OAuth 客户端仅新增测试回调 `/api/auth/callback/google`，原正式回调保留。

## 隔离规则

- Preview 的数据库、认证签名、Cron、Webhook、Blob 与 GA ID 按环境配置；
  测试支付必须同时满足 Test Key、STRIPE_TEST_BILLING_ENABLED=true 和独立库校验。
- 15 项 Prisma 迁移仅初始化新 Test 库；该库 CheckoutReservation/Subscription 的
  Live Price CHECK 改为六个 Test Price CHECK。正式迁移文件不增加测试价格。
- 应用连接使用最小权限 flownana_app。后续迁移经 Supabase 授权入口执行；
  Preview DIRECT_URL 不能当数据库管理员连接。不得对正式库执行测试迁移。
- Development 未迁到本次新库，不能拿其变量代替 Preview 测试配置。
- `.vercelignore` 排除真实 `.env*`。部署只使用 Vercel 对应环境变量。
- 固定入口保留 Vercel 保护；Stripe webhook 使用平台自动化 bypass，实际值不
  复制到文档。测试 Stripe endpoint 与 Preview webhook secret 必须成对维护。
- 免费项目与资源按当前 Free/Hobby 额度运行，未升级。测试生成仍可能使用收费
  AI Provider；数据库与积分隔离不会把供应商请求变成免费的模拟请求。

## 已运行与待验收

真实 Google 登录、Sandbox 年付 USD 96、首月 200 积分、Webhook 与重复事件去重
均通过。用户随后已完成 Pro 年付测试升级，后台 USD200 upgrade purchase 为 missing_context；没有真实扣款。

手动打开 Billing，确认当前套餐 active、余额与实际测试权益一致；刷新不应重复发积分。再检查 Manage
subscription：API 已成功创建 Test Portal，但本轮浏览器页面空白，实际操作待确认。
未来新付款只用 Stripe 官方测试卡，必须先看到 Sandbox/Test 模式。

GA 地域策略已部署：US/JP/TW 默认基础统计，其他/未知地区先询问；已有拒绝和
GPC 优先，广告个性化关闭。全站 Privacy 可允许、拒绝和撤回。真实浏览器标签/
签名上下文/撤回与桌面手机 UI 已通过；Test DebugView 本轮实际看到 page_view、
pricing_view 各 1（15:34），不只以 Google 204 为证据。

用户原已登录 Chrome 的 SDK 请求已明确 ERR_BLOCKED_BY_CLIENT，尚无可用 GA
会话/账号上下文。请先对测试站放行 www.googletagmanager.com 的 Google 标签，
刷新后再打开 Pricing；确认 Test DebugView 与签名上下文后再测试新付款。
旧 USD96/200 购买因无上下文没有发送，不补造归因。新购买同会话完整联结仍待验收。

Preview Cron 不自动调度。GA 补偿和年付月积分需用 Preview CRON_SECRET 手动触发
对应接口并验证；测试退款、升级、Portal 取消、真实生成/素材访问尚未端到端验收。
所有生产发布与正式库迁移继续要求明确授权。
