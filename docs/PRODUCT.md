# Flownana 产品文档

状态：当前产品事实来源
最近复核：2026-08-28

本文档定义 Flownana 当前已经确认的产品行为。大型功能在开发前必须先更新
本文档并确认范围；符合既有规则的小功能可以直接开发。本文档只描述当前
状态，不维护流水账式变更记录，历史版本由 Git 保存。

## 1. 产品愿景与目标

Flownana 是一个 0→1 的 AI 媒体生成产品，当前重点是快速上线和验证付费
投放。用户应当能够通过提示词或参考素材，快速获得可长期保存的图片或视频。

当前目标：

- 把图片生成稳定性作为 MVP 第一优先级
- 在不过度增加复杂度的前提下提供有价值的图片和视频创作能力
- 让积分成本、处理状态、失败原因和退款结果清晰可见
- 把生成媒体保存为用户可长期管理的资产
- 保持获客和转化主漏斗可衡量

## 2. 当前范围

当前产品支持：

- 落地页和营销页面
- Google 登录
- 文生图和图生图
- 视频生成及模型特定的参考素材输入
- 图片和视频共用的 Create 工作台
- 生成历史和长期 Assets 资产库
- 积分、订阅、结账、账单和升级
- 结果预览、引用、下载、删除和从最近记录移除
- 核心 GA4 漏斗埋点

音乐生成已经下线。历史音频仍可查看、下载和删除，但不能重新生成。

## 3. 明确不做

- 用户可见的 Project 或 Session 系统
- 自主多步骤媒体编排
- 新音乐生成
- 资产批量操作
- 收藏功能
- 高级媒体编辑工具
- 自动把所有上传参考素材保存为 Asset
- 未单独批准的重型后台系统或大规模架构重构

## 4. 信息架构与路由

- `/`：落地页
- `/home`：登录后的创作入口
- `/ai-image`：图片优先的创作入口
- `/ai-video`：视频优先的创作入口
- `/generate`：通用创作入口；恢复上次的 Image/Video 选择，新用户默认 Video
- `/ai-music`：重定向到 `/ai-image`
- `/pricing`：套餐和结账入口
- `/account/profile`：头像、显示名称、邮箱和删除账号
- `/account/billing`：当前套餐、积分、升级和账单管理
- `/design-system`：内部设计系统预览页，不允许搜索引擎索引

`/ai-image` 和 `/ai-video` 使用同一套响应式创作工作台，显式路由只决定
初始 Composer 类型。

## 5. 创作工作台

### 5.1 导航与布局

- 桌面端使用可折叠的 Create/Assets 侧栏、中央工作区和可选的右侧详情面板。
- 移动端使用导航触发器、抽屉侧栏、单列内容流、底部 Composer 和全屏详情页。
- Create 是操作历史，不是用户可见的 Session 系统。
- New Create 只清空当前草稿，不删除历史记录。
- Create 顶层不提供媒体筛选；筛选只属于 Assets。
- 内容流上方不显示多余的桌面标题栏。

### 5.2 Prompt 与 Result 内容流

- 图片、视频和历史音频按时间顺序显示，最新内容在底部。
- 每个已提交 Prompt 右对齐显示，原始输入素材位于 Prompt 正上方。
- 一个 Prompt 对应一个 Result Block。
- 图片请求可在一个 Result Block 中包含 1–4 个独立计费输出；视频和历史
  音频保持单输出。
- 提交后立即显示生成中 Result Block。
- 活跃结果立即预留符合宽高比的媒体区域，并显示 Flownana 香蕉在深蓝海面
  漂移的动画。
- 响应层级保持轻量、无边框：处理状态、分隔线、行内参数、媒体和操作。
- 首条记录、跨本地日期或间隔至少一小时时显示时间分隔；标签使用
  `Today`、`Yesterday` 或紧凑英文日期与本地时间。
- 活跃任务显示实时 `Processing` 计时；有可靠数据时，完成和失败任务显示
  `Processed in` 或 `Failed after`。
- 多图片输出以最慢一个输出的耗时作为整组耗时。

### 5.3 结果展示

- 生成媒体必须保留原始宽高比，不得为了方形封面裁切或拉伸。
- 桌面单个结果最大约 512px 宽、480px 高。
- 四张 9:16 图片在桌面单行四列、移动端两列展示。
- 视频默认静音，提供播放/暂停、进度、已播放/总时长和声音控制。
- 明确以 Sound Off 生成的视频，其声音控件保持禁用。
- 点击图片、视频或音频打开聚焦预览。

### 5.4 结果操作

- 每个成功输出右上角提供 Download、Reference 和 Delete；桌面 Hover 或
  键盘 Focus 时显示，触控设备始终显示。
- 不提供单独 Expand 操作；点击媒体本身进入预览。
- Reprompt 恢复可用的 Prompt、原始输入、模型、参数和输出数量，替换当前
  草稿但不会自动提交。
- Reference 把生成结果加入当前 Composer 草稿。
- Delete 从 Create 和 Assets 删除选中输出；整组无剩余输出时，Create 显示
  紧凑的已删除占位。
- 已被其他生成任务作为输入引用的媒体必须继续保留。
- More → Remove from recent 隐藏完整 Prompt 和 Result 记录，但成功媒体仍
  保留在 Assets。
- Reprompt、Details 和 More 位于结果下方的同一操作组。

### 5.5 Composer

- 底部 Composer 在模型选择器前提供一个 Image/Video 选择器。
- 有效提交开始后清空 Prompt 和附件，但保留媒体类型和生成参数。
- Image/Video 切换共用同一个附件草稿。
- 删除附件后不能通过切换媒体类型让它重新出现。
- 不兼容附件保持可见并标记为不支持，阻止生成并提供 Remove unsupported；
  切换模型时不得自动删除。
- Generate 操作显示预计消耗的总积分。
- 最多允许五个输出任务同时活跃；多图片请求的每个输出都计入限制。

## 6. 图片生成

每个 Prompt 支持生成 1–4 张图片。

| 模型 | 模式 | 输入 | 分辨率与平台积分 |
| --- | --- | --- | --- |
| GPT Image 2 | 文生图、图生图 | 最多 1 张图片 | 1K：2，2K：3，4K：5 |
| Nano Banana 2 | 文生图、图生图 | 最多 1 张图片 | 1K：2，2K：4，4K：5 |
| Qwen Image 3.0 Pro | 文生图、图生图 | 最多 3 张图片，每张 10 MB | 1K：2，2K：4 |

允许的图片比例为 `Auto`、`9:16`、`16:9`、`1:1`、`3:4`、`4:3`，
并遵守模型限制：

- GPT Image 2 只有 1K 支持 Auto，4K 不支持 1:1。
- Qwen Image 3.0 Pro 不支持 Auto，只提供 1K/2K。
- 其他在售图片模型继续使用现有 20 MB 客户端上传上限。

只有结果已经保存到 Flownana 自有存储后，任务才能被视为成功。存储失败
必须让任务失败并退款，不能静默保存短期 Provider URL。

## 7. 视频生成

视频请求每次生成一个输出。生成前必须显示已批准的模型积分价格。KIE 模型
通常按 KIE API 积分乘以 `0.2`，再将整次请求结果四舍五入为整数 Flownana
积分；单独批准的例外以代码和本文档为准。

| 模型 | 输出选项 | 已批准的参考输入 |
| --- | --- | --- |
| Gemini Omni Video | 720P/1080P/4K；4/6/8/10 秒；16:9 或 9:16 | 最多 7 张图片 |
| Wan 3.0 Video | 480P/720P/1080P；2–30 秒；标准比例；Sound On/Off | 当前 P0 最多 10 张图片、1 个视频和 1 个音频 |
| Seedance 2.0 Mini | 480P/720P；4–15 秒；Auto 和标准比例；Sound On/Off | 最多 9 张图片、3 个视频和 3 个音频 |
| MiniMax H3 | 720P/2K；4–15 秒 | 可选首帧和尾帧 |
| Grok Imagine Video 1.5 | 480P/720P；1–15 秒 | 必须且只能有 1 张图片 |
| HappyHorse 1.1 | 720P/1080P；3–15 秒 | 最多 1 张可选图片 |

用户可见比例只允许 `Auto`、`16:9`、`9:16`、`1:1`、`4:3`、
`3:4`、`21:9`；分辨率只允许 `Auto`、`480P`、`720P`、`1080P`、
`2K`、`4K`。界面只能显示当前模型真正支持的值。

模型特定规则：

- MiniMax、HappyHorse 和 Grok 的图生视频由输入图片决定比例。
- Seedance 和 Wan 把 Auto 映射为各自安全的自适应值。
- Gemini 始终发送其要求的 16:9 或 9:16。
- Wan 带参考视频时，输出最长 15 秒。
- Gemini 的源视频、上传音频和 Character ID 在定价和 Provider ID 方案获批
  前不进入 P0。
- 视频任务等待超过 45 分钟后标记超时并退款。
- 同一视频任务的成功与失败结算必须通过数据库事务争夺唯一终态；并发轮询不得
  重复退款、覆盖已成功任务或产生“成功且已退款”的状态。

## 8. Assets 与媒体生命周期

- Assets 是成功且未删除的生成输出平铺网格。
- 上传的参考素材不会自动加入 Assets。
- 筛选项：All、Images、Videos、Audio。
- 工具：Prompt 搜索和 Newest/Oldest 排序。
- Assets 支持预览、下载、删除和 Reference 回 Create。
- 生成中和失败任务只显示在 Create。
- 生成媒体和任务输入都登记为用户媒体资产，并通过 input/output 关系关联任务。
- 删除未被引用的生成输出时，同时删除自有存储对象和资产记录；仍被任务引用
  的媒体继续保留。
- 历史 Provider 媒体 URL 失效时，可以尝试刷新为新的可访问 URL。
- 新上传必须使用已登录用户的一次性预约：Token 最长有效 10 分钟，每用户每小时
  最多 60 个预约、24 小时预约总量最多 1 GB；单文件上限为图片 20 MB、视频
  50 MB、音频 15 MB，累计有效上传预约最多 5 GB。上传完成后必须登记用户归属，
  未登记的任意远程 URL 不得作为生成输入；每日任务清理已过回调宽限期的孤儿
  Blob 和过期预约。
- 服务端抓取 Provider 输出和代理下载时必须只连接公共 HTTPS 地址，逐跳校验
  DNS 与重定向，并执行内容类型、文件签名、总时限和实际流量上限；图片、视频、
  音频输出上限分别为 40 MB、500 MB、50 MB。

### 8.1 数据库访问边界

- 浏览器不得通过 Supabase Data API、PostgREST 或 GraphQL 直接访问核心业务表；
  所有业务数据访问必须经过 Next.js Server 和 Prisma。
- `User`、`Subscription`、`CreditBatch`、`Generation`、`MediaAsset`、
  `GenerationMedia`、`ProcessedStripeEvent`、`MediaUploadGrant` 和
  `_prisma_migrations` 不向 `anon`、`authenticated` 或 `service_role`
  数据库角色开放直接访问。
- 这些表在 `public` Schema 中必须启用 RLS 作为纵深防御，但在当前 NextAuth
  架构下不为浏览器角色创建用户级 Policy。
- 数据库权限收紧后，Next.js Server 的 Prisma 读写、Stripe Webhook、Cron、
  生成、历史和媒体生命周期行为必须保持不变。
- Prisma Runtime 使用专用 `NOBYPASSRLS` 角色和显式 Server Policy；Migration
  使用独立 Owner/Admin 直连，并且 Runtime 不得访问 `_prisma_migrations`。
- Supabase Data API 必须关闭；Supabase 仅承担 PostgreSQL、Auth、Storage 等
  基础能力。

## 9. 登录与账户

- 生成前必须登录。
- Google 登录完成后返回发起登录的同源页面。
- 未登录或 Session 过期时，生成操作应发起登录，不得展示原始 API 401。
- 创作页把 Session 加载中与未登录状态分开，刷新时不能闪烁为登出内容。
- 只有非生产环境可以启用已批准的测试登录；生产环境必须禁用。

创作工作台侧栏底部：

- Credits 区改为固定的 Upgrade 入口，不再显示套餐徽标或积分数字；免费和付费
  用户都显示该入口。
- 点击 Upgrade 在当前页面打开 Pricing 弹窗，不跳转页面，也不得清空当前
  Prompt、附件、媒体类型或生成参数。
- Upgrade 下方的用户入口只显示头像和用户名；用户名下一行显示
  `{会员状态} · {credits 余额}`，例如 `Starter · 130 credits`。
- 用户入口不显示邮箱和向下箭头；整行都可以点击。
- 桌面侧栏折叠时只显示 Upgrade 图标和用户头像；展开时显示完整信息。
- 移动端侧栏抽屉显示完整 Upgrade 入口和用户信息。

点击用户入口打开个人信息菜单：

- 菜单头部显示头像、用户名和邮箱，邮箱下方不显示解释文字。
- 菜单操作依次为 Account Profile、Plans and Billing、Sign Out。
- Account Profile 进入 `/account/profile`；Plans and Billing 进入
  `/account/billing`；Sign Out 退出后返回落地页。
- 桌面端菜单从用户入口右侧或上方展开，不能超出视口；移动端使用底部 Sheet。

`/account/profile`：

- 页面展示当前头像、显示名称和只读邮箱。
- 邮箱输入框下方不显示说明文字，也不在此页面提供修改邮箱能力。
- 用户可以上传 JPG、PNG 或 WebP 头像，文件最大 5 MB；系统使用居中的正方形
  裁切，不提供手动裁切工具。
- 用户可以移除自定义头像；移除后优先恢复 Google 头像，没有时使用用户名首字母。
- 显示名称去除首尾空格后必须为 1–80 个字符。内容没有变化时 Save disabled；
  保存成功后侧栏和个人信息菜单立即同步。
- Danger Zone 提供 Delete account。用户必须输入 `DELETE` 才能确认。
- 存在活跃生成任务时阻止删除，并提示用户等待任务完成或失败。
- 存在有效订阅时必须先成功取消 Stripe 订阅；取消失败则停止删除账号。
- 删除账号不退款，剩余积分立即失效，并删除账号、生成记录和用户持有的媒体；
  完成后退出登录并返回落地页。
- 用户之后使用同一个 Google 账号登录时，按新用户创建新账号，不恢复旧数据。

## 10. 积分、套餐与结账

生成消耗积分。参数校验、登录和用户积分不足应在扣费前完成。扣费后发生的
Provider、超时和媒体持久化失败必须退款。

| 套餐 | 月付价格 | 年付价格 | 每月积分 | 输出权益 |
| --- | ---: | ---: | ---: | --- |
| Starter | $16 | $96 | 200 | 最高 720P |
| Pro | $48 | $288 | 800 | 最高 1080P |
| Max | $96 | $576 | 2,400 | 最高 1080P |

- Pricing 弹窗同时展示 Starter、Pro 和 Max 三个套餐，并提供 Monthly/Yearly
  切换；每次打开默认选择 Yearly，并明确展示 `Save 50%`。
- Yearly 价格以月均价格为主要数字，同时说明一次性年付总额以及积分按月发放；
  Monthly 展示月付价格。
- 当前套餐必须标记 Current plan。根据下方升级规则，不可购买的套餐或周期按钮
  disabled，并提供不可升级原因，不能让用户进入无效 Checkout。
- 免费用户选择套餐后直接进入 Stripe Checkout；已有订阅用户先看到升级确认，
  确认内容至少包含原套餐、新套餐、付款周期、价格变化和积分变化，再继续结账。
- 关闭 Pricing 弹窗后返回原来的创作状态，不得丢失 Prompt、附件或生成参数。
- 桌面端使用居中弹窗；移动端使用接近全屏、内部可滚动的面板，三个套餐纵向排列。
- 年付相当于十二个月月付价格的五折。
- 年付积分仍按月发放，每批积分在发放 30 天后过期。
- 积分按最早过期优先消耗。
- Checkout 创建前必须验证 Stripe Price 处于启用状态，且币种、金额和周期与
  页面展示一致。
- Query 参数中的套餐名称或价格不能作为付款凭证。
- Webhook 和返回页的购买完成处理必须幂等。
- 当生产部署仍配置 Stripe Test Mode 时，公众用户不得创建或完成测试 Checkout，
  测试 Webhook 也不得向生产业务数据写入订阅或积分。只有
  `STRIPE_TEST_MODE_ALLOWED_EMAILS` 中的专用 QA 账号可以从返回页完成测试结账；
  正式切换完整的 Live Key、Price 和 Webhook 套件后自动恢复公众结账。
- 产品不提供降级操作，用户需要进入 Billing Portal。

允许的升级规则：

- 月付可以升级到同档年付，或任意更高档的月付/年付
- 年付只能升级到更高档年付
- 年付升级到更高档年付时，抵扣尚未发放月份的剩余价值
- Max 年付没有更高升级路径

## 11. 失败处理与退款

用户不得看到 Provider 余额、API Key、内部字段名、原始 Provider 响应或基础
设施凭据。所有生成失败必须说明发生了什么、用户下一步做什么、是否适合重试，
以及积分是否已退回。

| 错误码 | 用户含义 | 是否可直接重试 | 积分处理 |
| --- | --- | --- | --- |
| `auth_required` | 登录状态已过期 | 重新登录后可以 | 未扣费 |
| `prompt_required` | 缺少 Prompt | 修改后可以 | 未扣费 |
| `input_image_required` | 当前模型需要图片 | 添加输入后可以 | 未扣费 |
| `unsupported_file_type` | 文件格式不支持 | 更换文件后可以 | 未扣费或退款 |
| `file_too_large` | 文件超过模型限制 | 更换文件后可以 | 未扣费或退款 |
| `invalid_image` | 图片损坏或不可用 | 更换图片后可以 | 未扣费或退款 |
| `invalid_parameters` | 参数不受支持 | 修改后可以 | 未扣费或退款 |
| `content_policy` | 请求被安全策略拦截 | 修改后可以 | 退款 |
| `insufficient_credits` | Flownana 用户积分不足 | 不可以 | 未扣费 |
| `credit_conflict` | 并发操作改变了余额 | 刷新后可以 | 不重复扣费 |
| `provider_unavailable` | 模型暂时不可用 | 稍后重试或换模型 | 退款 |
| `rate_limited` | 请求过多 | 稍后可以 | 退款或任务继续 |
| `timeout` | 超过允许处理时间 | 检查历史后可以 | 退款 |
| `network_error` | 网络连接中断 | 可以 | 未扣费或退款 |
| `media_processing_failed` | 结果无法安全保存 | 可以 | 退款 |
| `task_not_found` | 任务不存在 | 不可以 | 不额外扣费 |
| `generation_failed` | 未识别生成错误 | 可以 | 退款 |

补充规则：

- 原始 Provider 信息只记录在服务端日志。
- 可修正的内容、输入和参数失败使用警告样式；服务和基础设施失败使用错误样式。
- 操作按钮根据场景显示 Edit request、View plans 或 Try again。
- 自动退款失败时必须明确提示联系支持，并保留继续重试退款所需的状态。
- `generation_failed` 埋点记录稳定错误码，不记录 Provider 原文。

## 12. Analytics 与 GA4

核心漏斗必须包含：

- `landing_page_view`
- `hero_cta_click`
- `ai_image_entry_click`
- `signup_started`
- `signup_completed`
- `pricing_viewed`
- `checkout_started`
- `purchase_success`
- `generation_started`
- `generation_success`
- `generation_failed`
- `result_download_clicked`
- `insufficient_credits_shown`

未经先更新并确认本节，不得新增事件名或改变既有事件含义。重构相关 UI 时，
必须保留现有生成和下载埋点。

侧栏 Upgrade、用户菜单和 Account Profile 暂不定义新的 GA4 事件；打开 Pricing
和发起 Checkout 只沿用现有 `pricing_viewed` 与 `checkout_started`，不新增事件名。

## 13. 验收标准

每次发布根据影响范围验证以下相关基线：

- 未登录用户不能生成
- 登录用户可以成功发起受支持的生成
- 页面预计积分与实际扣费一致
- 成功生成扣除正确积分
- 失败生成按照本文档规则退回积分
- 不向用户泄露原始 Provider 或基础设施错误
- 生成输出按照规则保留在 Create 和 Assets
- 预览、Reference、下载、删除和从最近记录移除正常工作
- 落地页、登录、定价、结账、生成、失败和下载事件可追踪
- 展开侧栏时 Upgrade 独立显示，用户入口显示头像、用户名、会员状态和积分余额，
  不显示邮箱或下箭头；折叠侧栏和移动端状态符合第 9 节规则
- 用户菜单正确显示身份信息与三个账户操作，Account Profile 和 Plans and Billing
  进入正确页面，Sign Out 正常退出
- Pricing 弹窗默认 Yearly、同时展示三个套餐、正确标记当前套餐和禁用无效升级，
  打开和关闭过程中不丢失创作草稿
- Account Profile 可以修改头像和显示名称，只读邮箱下无说明；删除账号遵守活跃
  任务、订阅取消、积分失效、数据删除和重新注册规则
- 改动 UI 在 390px 和 1440px 可用，并覆盖相关空、加载、成功、错误、
  hover、focus 和 disabled 状态
- 落地页、登录、结账、生成和结果主流程没有严重阻断
- Supabase `anon` 和 `authenticated` 角色不能直接读取或修改核心业务表及
  `_prisma_migrations`
- RLS 和 GRANT 收紧后，Next.js Server 通过 Prisma 的正常读写仍然可用
- 匿名 Key、登录 JWT 和 Service Key 均不能通过 Data API 访问核心业务表
- 上传预约配额、用户归属、远程地址校验、字节上限和视频并发终态结算通过验证

## 14. 当前优先级与风险

优先级：

1. 收紧 MVP 范围
2. 稳定图片生成漏斗
3. 保持核心 GA4 测量完整
4. 提升付费投放前的上线准备度

已知产品风险：

- 图片和视频在售，历史音频仍可见但不能重新生成
- Qwen 的 Provider 成本随输入图片数量增加，当前用户价格保持固定
- Stripe 仍是测试模式，公众生产结账默认关闭；正式上线前需要有意配置完整的
  Live Key、Price 和 Webhook 套件
- 历史 Provider 媒体可能在完成回填前过期
- 首页临时演示视频还不是 Flownana 自有资产

## 15. 产品变更流程

### 大功能

核心流程、信息架构、积分/订阅/退款规则、在售模型、数据结构、关键埋点或
设计系统发生变化时：

1. 先修改本文档中的当前状态、范围、边界和验收标准
2. 对未决定的问题明确标注，不得自行补充需求
3. 经用户确认后开发
4. 采用满足规格的最小实现
5. 实现或运行状态变化时更新 `MEMORY.md`
6. 完成自动化和人工验收

### 小功能

符合现有规格的 Bug 修复、局部 UI/文案/可访问性调整、不改变产品行为的
重构和性能优化可以直接开发，无需先修改本文档。若开发过程中出现新的产品
决策，必须暂停扩展范围，回到大功能流程。

本文档始终保持当前状态，历史版本由 Git 保存。
