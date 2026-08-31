# Flownana 工程记忆

最近复核：2026-08-31（本轮本地风险检查、修复与回归已完成；未提交、推送或部署）

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

根 `Providers` 是唯一 NextAuth `SessionProvider`；页面级 `SessionBoundary`
不再创建嵌套 Provider（NextAuth v4 的全局刷新回调会导致多个 Provider 不同步）。
`/home`、`/ai-image` 和 `/ai-video` 预加载的历史带独立服务端账号 scope，
只有浏览器账号 id + 注册时间匹配时才能显示。`/generate` 进入共用创作工作台，
`/ai-music` 重定向到 `/ai-image`。

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
