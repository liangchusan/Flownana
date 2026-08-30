# Flownana 工程记忆

最近复核：2026-08-30

本文档记录当前代码实现、基础设施、部署状态和工程风险，不承担产品需求定义。

文档边界：

1. `docs/PRODUCT.md` 定义已确认的产品行为、范围、埋点和验收标准。
2. `docs/DESIGN.md` 定义视觉与交互规则。
3. 本文档说明上述产品目前如何实现和运行。
4. 代码与测试是实现证据；若与已确认的产品文档冲突，应先报告，而不是
   静默用代码反向修改产品要求。

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

`/home`、`/ai-image` 和 `/ai-video` 使用页面级 `SessionBoundary`，接收
服务端 Session 并预加载首批生成历史。`/generate` 进入共用创作工作台，
`/ai-music` 重定向到 `/ai-image`。

## 创建与历史实现

- 一次图片运行可创建 1–4 条 `Generation`，通过
  `Generation.parameters.runId` 分组；`outputIndex`、`outputCount` 也保存在
  JSON 参数中，不增加独立字段。
- `processingDurationMs` 保存在 `Generation.parameters`；多输出取最慢耗时。
- `hiddenFromRecent` 保存在 `Generation.parameters`。移除记录时支持通过
  `runId`、数据库 ID 或 Provider Task ID 定位整组任务。
- 图片和视频表单会立即插入乐观历史项，再通过 `taskId` 与持久化记录合并。
  图片的本地 pending 占位不写入 localStorage，因为同步接口刷新后无法恢复。
- 活跃任务上限按输出数量计算，不按 Prompt 组计算。
- 成功图片和视频保存可安全展示的参数；视频额外保存 Provider，以兼容历史轮询。
- Reprompt 恢复原始输入 `MediaAsset` 和已保存参数，不能把生成结果误当原始输入。
  `Generation.inputUrls` 只作为旧数据兼容回退。
- Image/Video 切换共用同一个 Composer 附件草稿。

## 媒体持久化与下载

- 新生成图片和视频由服务端下载、验证 Content-Type，再上传 Vercel Blob；
  完成后才保存 `Generation.urls`。
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
- 浏览器上传使用十分钟一次性 `MediaUploadGrant`，按用户限制预约频率、每日字节和
  累计字节；完成回调和生成时的延迟登记都会锁定预约行，防止并发复用，过期的
  未完成预约不能补登记。每日 Cron 清理超过回调宽限期的孤儿 Blob。
- Provider 输出和历史第三方下载只允许公共 HTTPS/443，逐跳验证 DNS 与重定向，
  并限制 MIME、文件签名、连接/总时限和实际读取字节数。

## 图片 Provider 实现

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

- 稳定错误定义位于 `lib/generation-errors.ts`。
- 支持的错误码：`auth_required`、`prompt_required`、
  `input_image_required`、`unsupported_file_type`、`file_too_large`、
  `invalid_image`、`invalid_parameters`、`content_policy`、
  `insufficient_credits`、`credit_conflict`、`provider_unavailable`、
  `rate_limited`、`timeout`、`network_error`、`media_processing_failed`、
  `task_not_found`、`generation_failed`。
- Provider 原文只进入服务端日志；API、Toast 和历史卡片只展示
  `docs/PRODUCT.md` 中的稳定产品文案。
- 图片扣费后失败立即退款；视频保留扣费快照，首次退款失败后可在后续轮询重试。
- 视频成功和失败结算锁定同一 `Generation` 行；状态落库、媒体关系登记和积分退款
  在事务内争夺唯一终态，失败结果不能覆盖已成功任务，成功结果不能覆盖已退款任务。
- 主要位置：
  - 图片接口：`app/api/generate/route.ts`
  - 视频接口：`app/api/veo/generate/route.ts`
  - 媒体存储：`lib/media-storage.ts`
  - 错误测试：`tests/generation-errors.test.ts`

## 登录与账户实现

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
- `/account/profile` 支持修改显示名称、上传/移除自定义头像和永久删除账号。
  删除前要求精确输入 `DELETE`；活跃生成、Stripe 取消失败或 Blob 清理失败都会
  阻止数据库账号删除。

## 计费实现

- 创建 Checkout Session 前读取并校验 Stripe Price；启用状态、金额、币种和
  周期必须与 `docs/PRODUCT.md` 一致。
- 权益通过 `stripePriceId` 解析，不信任冗余 `planType`。
- 首期积分可由 `checkout.session.completed` 或 `invoice.paid` 发放，二者共用
  Subscription Period 去重键。
- 月付积分通过 `invoice.paid` 发放。
- 年付第 2–12 月由 `/api/cron/monthly-credits` 每日 08:00 UTC 检查；Catch-up
  会补发所有逾期月份，并在一个事务内写入去重记录、积分批次和 `nextCreditAt`。
- Subscription created/updated/deleted/paused/resumed 同步本地状态；付款失败、
  需要操作和 Finalization 失败只刷新订阅，不发积分。
- Checkout 返回页验证 Session 已完成、已支付且属于当前用户，再幂等同步订阅、
  取消升级前旧订阅并发首期积分。
- 升级时无法取消或同步旧订阅必须让 Webhook 失败，以便 Stripe 重试。

## Schema 与 Migration

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
- 当前待发布安全变更统一要求服务端 Provider 调用只读取 `KIE_API_KEY`，不再兼容
  `NANO_BANANA_API_KEY`；Vercel Production、Preview、Development 已预置新的
  Sensitive `KIE_API_KEY`，旧变量和旧 key 暂时保留到新部署通过真实生成验证后再撤销。
- 当前待发布安全变更还会在 Vercel Production 使用 Stripe 测试 key 时，仅允许
  `STRIPE_TEST_MODE_ALLOWED_EMAILS` 中的账号访问测试结账、套餐变更、Checkout
  回填、Webhook 写入和年度积分发放；生产 Test Auth 则无条件关闭。Stripe Live
  模式不受该测试保护逻辑影响。
- Next.js 16 / React 19、数据库与媒体安全加固已于 2026-08-30 通过 Ready 生产
  部署 `dpl_G9qUDx772o8k3ND5F3GDYEpEvWdm` 首次发布，运行时代码基线提交为
  `7a7a32d`；后续纯发布记录提交只生成等价构建，不改变运行时代码。最终
  `main` SHA 后已复核 `https://www.flownana.com` 为 Ready，完整
  `npm run smoke:prod` 通过，Function 日志未出现 Prisma、RLS 或运行时错误。

## 当前工程风险与 TODO

- 在 Stripe 测试模式和独立测试 Blob 数据上端到端验证删号流程；外部订阅取消、
  Blob 删除与数据库删除无法形成单一事务，中途外部失败仍需运维排查。
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
  `NEXTAUTH_SECRET`、Google OAuth Client Secret 和数据库连接已核对为不同于
  历史值。Google Client ID 不是秘密且保持不变。KIE 历史凭据轮换已经启动：
  新 key 已写入三个 Vercel 环境，仍需完成新部署真实生成验证、撤销旧 key、删除
  旧 `NANO_BANANA_API_KEY` 环境变量，并评估是否清理 Git 历史。

## 持久工程决策

- 保持轻量 Agent 协作，使用 Codex 作为工程 Agent。
- 产品要求只放在 `docs/PRODUCT.md`，设计规则只放在 `docs/DESIGN.md`，
  实现和运维事实放在本文档。
- 大功能先更新产品文档并确认；符合现有规格的小功能直接开发。
- 优先采用满足已确认范围的最小实现。
- Provider Key 只保存在服务端环境变量中，任何代码、客户端、示例和文档都不得
  保存真实凭据。
