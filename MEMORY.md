# Flownana 工程记忆

整理日期：2026-11-03。本文只维护当前摘要、未发布范围和风险。
完整历史原文见 [工程历史](./docs/archive/ENGINEERING-HISTORY.md)，文档导航见
[docs/README.md](./docs/README.md)。历史条目的状态只代表记录当时，不能当作实时生产状态。
产品和验收以 [PRODUCT](./docs/PRODUCT.md) 为准，UI 以 [DESIGN](./docs/DESIGN.md) 为准。

## 当前生产状态（2026-11-04 全量发布）

- 用户明确批准全部本地内容上线，包含整理、连接器删除、安全整改、Agent 限额和支付迁移。
  正式部署 dpl_BF3hnpsF5r7jnJSUuzYcsKPR9c9e（READY / Production / Next.js），
  URL 为 flownana-hpaorwowo-liangchusans-projects.vercel.app；根域及 www 均回读到该版本。
  云端构建约 49 秒，正式 Stripe 商户及六个 Live Price 校验通过。
- 全量代码已保存为本地 main 提交 db5affe，发布记录提交 cf38722；387 项上传源文件
  与独立发布包 SHA1 全部一致。GitHub 三次正常快进 push 均返回远端 500，改用 REST
  上传 Git 对象亦返回 502；远端 main 仍为 cbad973，未强推或改写远端历史。
  生产发布不受影响；待 GitHub 写入恢复后同步本地 main。
- 17:36（北京时间）暂停旧 Checkout/升级写入及月积分调度，确认生效后等待超过
  300 秒旧函数上限，回读无切换前应用事务。Webhook 原处理与可重试投递保留。
- 正式库新增 CheckoutHistoryMigration / LegacyCheckout，两表开启 RLS，仅应用角色
  flownana_app 有 DML 和 Policy；anon/authenticated/service_role 无表权限。
  Prisma 已登记 20261024090000_checkout_history_index；既有 Live Price 约束核对无误，
  补齐其缺失的 20261002231000 迁移台账。未改已有价格、订单、订阅或积分记录。
- 固定导入边界为 2026-11-04T09:41:44.711Z，完成时间 09:42:45.565Z。
  经已连接 Live Stripe 只读接口按与导入脚本相同的固定边界/分页/归属逻辑读取，
  在数据库锁与事务中导入 3 条旧 Checkout 并提交游标；3 条账号版本匹配，
  唯一已付款 Checkout 的既有积分凭证存在。未发起付款、补发积分或补造归因。
- 全量应用于导入完成后提升，购买/升级匿名接口恢复 401，调度恢复鉴权，
  npm run smoke:prod 全部通过。旧演示视频及 popup 辅助地址为 404。
- 隔离 PostgreSQL 17.11 重放 18 个迁移通过；623 项测试为 621 通过/2 项真实
  Stripe 环境跳过/0 失败。类型、build、design:check 通过；lint 0 错误/15 既有警告。
  四份旧数据库测试夹具已按当前模型、价格及撤回凭证修正，保持生产约束。
- 正式内置浏览器：1440px 首页/登录、390px 登录/Pricing 均正常；关闭重开通过，
  390px 无横向溢出，手机装饰图 DOM 为 0，桌面插画已加载。未完成 OAuth 或付费操作。
  新部署最近 10 分钟 error/fatal 聚合无记录，仅代表该短窗口；日志外送接口 404，未核实配置。
- 回滚明确使用 dpl_DQtqt3re751bXRuF5hY2PnbX21aD，**不要回滚到临时维护部署**
  dpl_CcWdZqeVBEDkymiVxFp9XPzNHbAo。新增表为兼容性添加，不通过删表回滚。
  证据位于 output/releases/full-local-release-20261104；临时测试 PostgreSQL 已停止。
  同目录保存从 cbad973 起的增量 Git bundle，包含本轮源码与记录，供远端同步恢复。

## 上一生产基线（2026-11-02，历史）

- 品牌登录弹窗已隔离发布，部署 `dpl_DQtqt3re751bXRuF5hY2PnbX21aD`，当时为 READY，
  根域及 www 别名均已核对。回滚基线 `dpl_ANoBboiVLjHgycLqF8yT6iSafDQe`。
  本次目录整理没有重新查询线上，也没有部署。
- 原基线提交 `cbad973010566f556eaec00968321544c4daf905`，叠加注册赠送、注册归因、
  登录弹窗三个独立发布补丁；HEAD 和混合工作区均不能代表完整线上源码。
- 重建证据必须保留：`output/releases/signup-bonus-20261027/` →
  `output/releases/signup-attribution-20261027/` → `output/releases/login-dialog-20261102/`。
  这些本地目录现在被 Git/部署忽略；发布补丁尚未统一保存进 Git，不能删除。
- 根 SessionProvider 保持唯一；所有公共登录入口先打开站内 LoginDialog，Google 按钮
  才执行统计准备与同页 OAuth。手机不挂载装饰图；取消不清空草稿，成功不自动生成或付款。
  独立浏览器 popup 方案已撤回，辅助路由已移除。
- 登录弹窗发布时：工作区 517 项，500 通过/17 跳过；隔离包 506 项，491 通过/15 跳过。
  build、类型、design:check 通过，lint 0 错误/17 既有警告；上线 smoke 通过。
  设计与入口验收见 [登录 QA](./docs/design/login-dialog-qa-20261102.md)。
- 注册赠送：仅符合七地区/可信 IP 等资格的新账号赠送 10 积分，同 IP 72 小时防重，
  30 天到期；专用服务端 HMAC secret 和 signup_bonus 迁移已于 2026-10-27 隔离上线。
  不补发历史账号。完整规则仍以 PRODUCT 和实际服务端实现为准。
- 注册归因：Google 发起前有界准备统计上下文；Reject/GPC/撤回/地区重新核验，
  禁止偏好 Cookie 不代表许可，失败继续登录，不补造历史来源；六个 GA4 核心事件含义保留。
- 2026-10-23 模型版本已发布：4 个图片、5 个视频模型；退役模型只保留历史兼容。
  当前能力与计价由共享模块定义，审计依据见 `docs/KIE-MODEL-CONTRACTS.json`。

## 本轮已发布的整改（2026-11-04）

- 2026-10-24 安全整改：媒体解码/MP4/WAV 解析预算、共享检查租约、头像/上传预约与
  清理、匿名撤回凭证、账号绑定的许可与草稿恢复。扫描为 failed/partial，不能宣称完整扫描。
- Checkout 历史兼容迁移：新增 `CheckoutHistoryMigration` / `LegacyCheckout`、
  `20261024090000_checkout_history_index` 及离线导入脚本。
  已按排空旧写入、冻结扫描边界、完整导入后发布的顺序完成生产切换。
  详见 [切换手册](./docs/operations/CHECKOUT-HISTORY-CUTOVER.md)。
- Agent 每日尝试安全上限：免费 30 / 付费 300，完整回复仍 10/100、每分钟 6 次；
  成功/失败/停止均计尝试，幂等重放不重复计，UTC 跨日重置，不返还已删除对话的尝试。
- 上述安全、预算和迁移现已完整发布；真实集成及真机仍有人工验收缺口。

## 当前实现导航

- Next.js 16 App Router、React 19、TypeScript、Tailwind、NextAuth v4、Prisma 5 / Supabase、
  Stripe、Vercel Blob；准确依赖以 `package.json` / 锁文件为准。
- 页面和 API 在 `app/`，基础组件在 `components/ui/`，业务组合在 `components/blocks/`。
  详细目录地图与命令见 [README](./README.md)。
- `/` 为 Home，`/image`、`/video`、`/assets` 为统一工作台；`/generate` 恢复模式，
  `/pricing` 只跳转首页弹窗；旧 `/home`、`/ai-*` 为 404。音乐生成关闭，历史音频保留。
- 创作、付款、上传、私有草稿和缓存按账号 id + 注册时间隔离；操作携带预期账号。
  不确定请求不直接判失败，不自动重复创建上游任务；持久化、结算、退款和清理由记录恢复。
- Prisma 迁移历史必须完整保留。生产使用最小权限 `flownana_app`，Data API 关闭；
  重新启用前必须复核 RLS、权限和历史默认 ACL。
- `.env.example` 只放变量名；真实凭据在获批准的 `.env*` / 平台变量中，不入代码或文档。
  不删除 `.env*`、`.vercel/`、当前资源、迁移、历史模型/任务兼容和运维脚本。
- 测试资源与生产分离，详见 [测试环境](./docs/operations/TEST-ENVIRONMENT.md)。
  `FLOWNANA_TEST_DATABASE_URL` 只接受隔离临时测试库；缺少配置时数据库专项跳过。
  不用默认业务库代替测试库，不把真实 Provider 调用当作免费模拟。

## 2026-11-03 目录整理（仅本地）

- 新增根 README 和 docs 导航；规范、运维、设计验收与历史归档分开。
  原 MEMORY 3,321 行完整保存到 `docs/archive/ENGINEERING-HISTORY.md`，本文改为当前摘要。
- 18 份旧方案/审计/研究材料归档，4 份运维文档集中到 `docs/operations/`；
  最新登录 QA 移到 `docs/design/`，4 张旧根目录截图移到 `output/archive/design-qa-20260902/`。
  同步现存文档链接；历史 MEMORY 保留原文，路径按整理前仓库根目录理解。
- 删除经全仓 import/动态加载/测试引用检查无调用的 11 个组件：5 个旧营销区块、
  LoginPrompt、DowngradeModal、ImageModal、VideoModal、Select、Switch。
  删除无引用的旧 grid/logo 占位图、public/.gitkeep，以及已不展示的首页演示视频。
  冒烟检查改为当前品牌 Logo、登录插画和 Google 按钮资源。
- 删除硬编码旧机器路径和代理的 `start-dev.sh`、无执行作用的 `.gitignore.check`、
  临时 `.playwright-cli/` 快照及源码目录的 .DS_Store；移除零引用的 framer-motion 依赖。
- `output/`、浏览器产物加入 Git 忽略；本地证据/历史文档从网站部署包排除。
  发布重建补丁、当前验收证据、邮箱连接器和全部数据库迁移保留。
- Cursor 旧 Stone/Zinc 视觉规则改为当前 PRODUCT / DESIGN 的引用入口，避免维护过时副本。
- 不变更产品逻辑、UI 呈现、路由、价格、数据库、GA4 事件或平台配置；
  PRODUCT / DESIGN 只同步搬迁后的文档路径，无新产品决策。未部署、提交或推送。
- 本轮实际验证：整理前后均 517 项，500 通过/17 环境依赖跳过/0 失败；
  lint 0 错误/15 既有警告，design:check、build（含 TypeScript）、shell 语法及 diff 检查通过。
  build/运行时禁用真实数据库、Google/Stripe/Blob/Provider 凭据及 GA；本地冒烟全部通过。
- 内置浏览器复核 1440px 首页、视频工作台与登录弹窗，390px 首页、图片/视频与登录弹窗；
  关闭重开正常，390px scrollWidth 为 390，手机装饰图 DOM 为 0，无破图。
  没有完成真实 OAuth、生成或付款。测试标签、视口覆盖和临时服务已清理。
- 全部本地 Markdown 链接检查通过（原文工程历史按原路径约定保留）；原始 MEMORY 与
  移动截图字节校验通过，三个生产发布补丁保留，既有业务代码/测试/迁移差异逐项保持。
  删除/移动前的本地恢复副本和本轮日志位于 `/tmp/flownana-cleanup-20261103` 及
  `/tmp/flownana-cleanup-*.log`，临时目录不能作为长期备份。

## 2026-11-03 取消并删除私有邮箱连接器（仅本地）

- 用户明确不再连接邮箱，授权删除独立私有邮箱连接器。
  已删除整个 `integrations/flownana-mail-mcp/`，包括源码、独立依赖/锁文件、测试、
  专属示例配置和部署文件；空的 `integrations/` 一并移除。
- 删除根 README、文档导航中的连接器入口及 `.vercelignore` 的专属排除项。
  历史归档保留当时记录，不能再据此恢复或继续连接器开发。
- 网站应用、根依赖和测试均无该目录引用；网站 `support@flownana.com` 联系方式保留。
  未修改邮箱账号、DNS、邮件内容、网站业务/埋点或云端配置，未部署生产。
- 本轮实际验证：根项目 517 项测试，500 通过/17 环境依赖跳过/0 失败；
  连接器目录不存在、导航/配置无残留、文档本地链接与 diff 检查通过。
  本轮无应用 UI 或业务代码改动，无新增必需手测；未重跑构建或真实邮箱连接。

## 2026-11-04 全量发布授权与验证（切换前）

- 用户明确选择发布全部本地改动，包含目录整理、邮箱连接器删除、安全整改、
  Agent 每日尝试预算及 Checkout 历史迁移；覆盖此前仅整理的发布范围。
- 本地/远端只有 main，均从 cbad973 起；无其他 worktree、stash 或暂存提交。
  当前生产仍为 dpl_DQtqt3re751bXRuF5hY2PnbX21aD，411 项源文件已从基线及三个
  发布补丁重建并逐项 SHA1 校验，HEAD 不能单独代表该线上版本。
- 本轮补跑真实临时 PostgreSQL 17.11：18 个迁移完整通过；完整测试 623 项，
  621 通过/2 项真实 Stripe 环境依赖跳过/0 失败。全部外部收费调用使用替身。
  发现并修正四份旧测试的退役模型、过期价格、默认 1 积分及撤回凭证夹具；
  不降低生产数据库约束，不改变已确认产品逻辑。
- 本地生产 build（含类型）通过；全量发布包已在云端完成 Production 构建，
  正式 Stripe 商户和六个 Live Price 校验通过。正式域名尚未切换。
- 正式库健康，待新增 CheckoutHistoryMigration / LegacyCheckout；已有 Live Price
  约束与本地迁移一致，但缺少 20261002231000 的 Prisma 台账，切换时一并补齐。
  安全 advisor 仅原 _prisma_migrations 无 Policy 的信息项。
- 执行顺序：临时构建只暂停 Checkout/升级新建及月积分调度；确认生效并排空旧请求后，
  应用迁移、按固定边界分页导入实际 Live Checkout，验证 RLS/归属/游标后发布完整应用。
  保留 Webhook 投递与重试，不发起真实付款或补造归因。
- 本轮证据在 output/releases/full-local-release-20261104；测试库与构建目录只在
  /private/tmp。后续以本节追加的实际发布结果为准，历史未发布标记仅代表当时状态。

## 剩余风险与人工验收

- 完整 Google 回调、Pricing 套餐回跳、换号隔离、真实新注册赠送、GA4/Ads 收件及真机
  仍需人工验收，历史浏览器替身和视口检查不替代这些验证。
- 真实 Stripe/Webhook/年度 Cron、Blob 故障并发、真实 Provider 输出/扣费/退款和历史任务
  生产结算尚有外部验收缺口；MP4 时长与 Provider 实际计费差异仍待真实证据。
- 外部支付、Blob、数据库不可形成单一事务；旧孤儿 Blob、丢失的扣费快照及历史来源
  不能自动重建。上游已受理但响应丢失时仍可能产生成本。
- 早期 Git 中的旧凭据已轮换或撤销；不因本次整理重写历史或触碰当前配置。
- 本轮应用源码已统一保存 main 提交，部署前继续核对线上基线与授权范围。
  `output/releases/` 的旧重建补丁及验收证据仍仅在本机，忽略规则不构成备份。
- 2026-11-04 只读核对 flownana-test 为 INACTIVE，未恢复测试项目；本轮外部收费集成
  未在该测试站重新验收，不能把本地替身或上线冒烟当作真实支付/生成验收。
