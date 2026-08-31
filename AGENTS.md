# AGENTS.md

本仓库是一个 0→1 的 AI 媒体生成产品。修改代码前必须先阅读
`docs/PRODUCT.md` 和 `MEMORY.md`；涉及 UI 时还必须阅读
`docs/DESIGN.md`。

## 目标

- 快速交付
- 严格控制 MVP 范围
- 支持付费投放验证
- 避免不必要的复杂度

## 文档分工与优先级

1. `docs/PRODUCT.md`：已经确认的产品范围、行为、埋点和验收标准。
2. `docs/DESIGN.md`：视觉、组件、布局和交互规范。
3. `MEMORY.md`：当前代码实现、基础设施、部署状态和工程风险。
4. 代码与测试：当前实现证据；若与已确认的产品文档冲突，应先报告，
   不得用现有代码反向修改需求。

## 功能变更流程

### 大功能

满足下列任一条件时视为大功能：

- 改变核心用户流程、信息架构或主要路由
- 改变积分、定价、订阅、退款或媒体生命周期规则
- 新增或下架生成类型、模型或关键输入能力
- 改变数据库结构或需要数据迁移
- 新增、删除或改变核心 GA4 事件含义
- 改变设计系统、主要页面模板或跨页面交互规范

大功能必须先更新 `docs/PRODUCT.md`，明确范围、边界和验收标准，
经用户确认后再开发。

### 小功能

符合现有产品文档和设计规范的局部改进可以直接开发，例如：

- 修复偏离既有规格的 Bug
- 局部文案、样式、可访问性或响应式调整
- 不改变业务行为的性能优化和重构
- 已有页面中的小型便利功能

小功能不要求开发前修改产品文档；如果实现过程中发现需要新的产品
决策、埋点含义或验收规则，应停止扩展范围，先更新产品文档并确认。

## 工作规则

- 不得擅自重新定义需求。
- 优先采用满足已确认范围的最小实现。
- 扩展视频能力前优先保证图片生成链路稳定；音乐生成保持下线。
- 修改落地页、登录、定价、结账、生成或结果流程时，保留
  `docs/PRODUCT.md` 要求的 GA4 埋点。
- 实现、基础设施、部署状态或工程风险变化时更新 `MEMORY.md`。
- 未实际运行的测试不得声称通过。
- 未获得明确批准不得部署生产环境。
- 不得把密钥、Token 或真实凭据写入代码和文档。

## 常用命令

- 安装依赖：`npm install`
- 本地开发：`npm run dev`
- 测试：`npm run test`
- 代码检查：`npm run lint`
- 生产构建：`npm run build`
- 设计检查：`npm run design:check`
- 生产部署后冒烟测试：`npm run smoke:prod`

环境变量名称以 `.env.example` 为准；真实值只存放在获批准的本地或
平台环境变量中。

## UI 与前端约束

- 遵循 `docs/DESIGN.md`，保持温暖、可信、编辑感、克制且以媒体为中心。
- 优先使用语义化 Tailwind Token；Stone/Zinc 可作为局部中性色，禁止
  Slate/Gray 色系漂移。
- 基础组件优先复用 `@/components/ui/`，业务组合放在
  `@/components/blocks/`。
- `@/app/` 页面聚焦数据获取与组件组合，避免堆积长篇页面级 UI 逻辑。
- 禁止 JSX 内联 `style={{}}`；使用 Tailwind 类。
- Mobile-first，避免 `w-[800px]` 等固定大宽度。
- 交互保持 `transition-all duration-300`，并提供清晰的 hover、active、
  focus 和 disabled 状态。
- 图标统一使用 `lucide-react`，常用尺寸为 `w-4 h-4` 或 `w-5 h-5`。
- 每次 UI 改动都运行 `npm run design:check`，并检查移动端和桌面端。

## 任务完成前

1. 总结改动内容。
2. 说明需要手动测试的内容。
3. 说明剩余风险。
4. 若产品行为、流程、埋点或验收标准已变化，确认
   `docs/PRODUCT.md` 已同步。
5. 若实现或运行状态变化，更新 `MEMORY.md`。

<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
