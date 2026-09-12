# Flownana 工程记忆

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
