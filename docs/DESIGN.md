# Flownana 设计系统

状态：MVP 基线
视觉方向：受 Claude 启发，但保持 Flownana 品牌与媒体创作产品特征
参考：[getdesign.md 的 Claude 分析](https://getdesign.md/claude/design-md)

本文档是人类和 AI 开发工具共同遵循的视觉与交互事实来源。参考内容只
用于理解公开可观察的设计规律，不得复制 Claude 的名称、标志或专有资产。
必须保留 Flownana 品牌、以媒体为中心的产品结构和转化漏斗。

## 1. 产品感受

Flownana 应当温暖、可信、安静而有能力，像经过认真设计的创作工作台，
而不是通用 AI 仪表盘。

视觉基线：

- 使用温暖的奶油色画布，避免纯白和冷灰背景
- 使用温暖墨色文字，避免偏蓝黑的 Slate
- 只在最高优先级操作上使用克制的珊瑚色
- 编辑感衬线展示字体搭配易读的人文无衬线字体
- 依靠表面色和留白建立层级，避免厚重阴影
- 生成媒体始终是页面视觉中心

## 2. 规范优先级

当不同来源冲突时，依次遵循：

1. `docs/PRODUCT.md` 中当前产品范围和验收标准
2. 本文档 `docs/DESIGN.md`
3. `MEMORY.md` 中当前实现约束
4. `components/ui/` 中已有基础组件
5. `components/blocks/` 中已有业务组件
6. 最接近的现有页面模式

未经明确批准，不得因为提示词、截图或生成代码而引入一套新的视觉语言。

## 3. Token

实现 Token 位于 `app/globals.css`，并通过 `tailwind.config.ts` 暴露。
UI 代码必须优先使用语义化 Tailwind 类，避免重复写原始颜色值。

### 颜色角色

| 角色 | Tailwind 用法 | 值 | 用途 |
| --- | --- | --- | --- |
| 画布 | `bg-background` | `#faf9f5` | 默认页面和工作台背景 |
| 主文字 | `text-foreground` | `#141413` | 标题和主要文字 |
| 正文 | `text-stone-700` | Stone 700 | 长文本和辅助说明 |
| 弱化文字 | `text-muted-foreground` | `#6c6a64` | 标签、说明和次要文字 |
| 卡片 | `bg-card` | `#efe9de` | 功能和编辑式卡片 |
| 柔和表面 | `bg-surface-soft` | `#f5f0e8` | 区块背景和安静控件 |
| 强调表面 | `bg-surface-strong` | `#e8e0d2` | 选中和强调区域 |
| 细边框 | `border-border` | `#e6dfd8` | 输入框、分隔线和弱轮廓 |
| 主色 | `bg-primary` | `#cc785c` | 每个区域唯一最高优先级 CTA |
| 主色按下 | `bg-primary-active` | `#a9583e` | Hover 和按下状态 |
| 深色表面 | `bg-surface-dark` | `#181715` | 媒体框架、预览和页脚 |
| 深色浮层 | `bg-surface-elevated` | `#252320` | 深色表面中的控件 |
| 危险 | `text-destructive` | `#c64545` | 错误和破坏性操作 |
| 成功 | `text-success` | `#5db872` | 成功或可用状态 |
| 警告 | `text-warning` | `#d4a017` | 警告状态 |

规则：

- 优先使用语义角色；Stone 可作为兼容的局部中性色，禁止 Slate 和 Gray。
- 禁止在 JSX 类名中加入任意 Hex 色；需要新角色时先批准并扩展 Token。
- 珊瑚色只用于主 CTA、焦点环和少量有意义强调，不能作为大面积装饰渐变。
- 纯白只用于媒体对比、主按钮文字，或奶油色会降低清晰度的独立输入和浮层。
- 深色表面用于承载媒体或高对比产品时刻，不是默认页面背景。

### 字体层级

| 角色 | 类 | 用途 |
| --- | --- | --- |
| 超大展示 | `font-display text-5xl md:text-display-xl font-medium` | 仅落地页 Hero |
| 大展示 | `font-display text-4xl md:text-display-lg font-medium` | 主要营销区标题 |
| 中展示 | `font-display text-3xl md:text-display-md font-medium` | 页面和工作台标题 |
| 小展示 | `font-display text-display-sm font-medium` | 卡片和提示标题 |
| UI 标题 | `font-sans text-lg font-medium` | 功能面板和弹窗 |
| 正文 | `font-sans text-base leading-relaxed` | 默认阅读文字 |
| 小正文 | `font-sans text-sm leading-relaxed` | 辅助文字 |
| 标签 | `font-sans text-sm font-medium` | 输入和控件 |
| 说明 | `font-sans text-xs font-medium` | 元数据和细则 |
| 代码 | `font-mono text-sm` | 仅技术内容 |

展示字体使用开源 `Cormorant Garamond`，正文使用 `Inter`。营销和突出页面
标题可以使用展示字体，密集的产品控件必须使用无衬线字体。

### 形状、间距与层次

- 基础间距单位为 4px，优先使用 Tailwind 的 2/3/4/6/8/12/16/24 档位。
- 页面容器：`mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8`。
- 营销区垂直节奏：`py-16 md:py-24`。
- 工作台面板：桌面 24–32px，移动端 16–20px 内边距。
- 标准控件使用 `rounded-ui`（8px）。
- 内容卡片使用 `rounded-ui-lg`（12px）。
- 大型媒体和 Hero 框架使用 `rounded-ui-xl`（16px）。
- 胶囊和圆形图标按钮可以使用 `rounded-full`。
- 默认不使用阴影；Hover 分离用 `shadow-soft`，弹窗或浮层才用 `shadow-float`。

## 4. 核心组件约定

创建交互基础组件前必须先搜索 `components/ui/`。优先扩展已有组件变体，
不要复制标记结构。

### 按钮

- 主按钮：珊瑚背景、白字、8px 圆角、标准高度 40px。
- 次按钮：奶油画布、温暖细边框、墨色文字。
- Ghost：默认透明，Hover 时显示表面变化。
- 破坏性按钮只使用语义危险色。
- 所有变体都必须有 focus、disabled、hover 和 active 状态。
- 每张卡片、面板或一个视口区域只保留一个主操作。

### 输入框和文本域

- 使用温暖画布或白色表面、细边框和 8px 圆角。
- Focus 使用珊瑚色语义焦点环，不得移除焦点提示。
- 标签始终显示在控件上方；Placeholder 只能作为示例，不能替代标签。
- 校验文案必须说明发生了什么以及如何继续。

### 卡片

- 编辑式/营销卡片：`bg-card`，通常无边框、无阴影。
- 功能卡片：`bg-background border border-border`。
- 深色媒体卡片：`bg-surface-dark text-background`。
- 避免嵌套超过两层可见卡片表面。

### 导航和标签页

- 导航保持安静；选中状态使用表面色和文字色，不到处使用亮色实心胶囊。
- 桌面头部高度 64px，移动端控件最小触控区域 44px。
- 标签页同时使用表面和文字颜色变化表达选中状态。

### 生成媒体

- 结果是创建页和历史页的视觉中心。
- 使用不会给媒体偏色的中性或深色框架。
- 始终保留宽高比，不得拉伸生成媒体。
- 操作应贴近结果，但不能遮挡重要内容。

## 5. 页面模板

### 落地页

1. 64px 导航
2. 一个表达核心主张的 Hero 和一个主 CTA
3. 真实产品或生成媒体证明
4. 移动端一列、桌面三列的功能说明
5. 信任内容或案例
6. 按需提供定价和 FAQ
7. 深色页脚

使用编辑感字体和充足留白，禁止默认使用紫色渐变、漂浮玻璃卡片或装饰气泡。

### 创作工作台

1. 全局顶栏
2. 紧凑创作导航
3. 参数/输入区域
4. 包含空、生成中、成功和失败状态的结果区域

移动端面板纵向排列，桌面可拆分多栏。允许功能密度，但必须保持温暖、
安静的整体感受。

### 定价页

- 移动端一列，桌面最多三列。
- 默认卡片使用画布和细边框。
- 推荐套餐可以使用深色表面或克制珊瑚强调，但不能同时满强度使用两者。
- 价格、周期、积分、CTA 和降级限制必须易于扫读。

### 登录、空、加载和错误状态

- 使用与主流程相同的画布、字体、控件和间距 Token。
- Skeleton 几何形状应与最终布局一致。
- 空状态应引导到下一步最有用的操作。
- 错误信息必须直接且可操作；红色只在语义需要时使用。

## 6. 响应式与可访问性底线

- 从移动端开始，在 `sm`、`md` 和 `lg` 逐步增强。
- 禁止 `w-[800px]` 等固定内容宽度，使用 `w-full` 与 `max-w-*`。
- 所有控件必须可用键盘操作并显示 `focus-visible`。
- 正文和控件保持 WCAG AA 对比度。
- 非必要动画尊重 `prefers-reduced-motion`。
- 核心触控操作在空间允许时至少 44px 高。
- 至少检查 390px、768px 和 1440px 三种宽度。

## 7. 动效

- 默认交互：`transition-all duration-300`。
- 布局稳定时可用 `active:scale-[0.98]` 提供按压反馈。
- 与其使用大量环境动画，不如只保留一个有组织的关键动效。
- 动画不得延迟生成反馈，也不得遮挡加载或错误状态。

## 8. AI 实现与验收清单

开发前：

1. 阅读 `AGENTS.md`、`docs/PRODUCT.md`、`MEMORY.md` 和本文档。
2. 找到最接近的现有页面、业务块和基础组件。
3. 明确复用哪些现有组件。
4. 判断是否属于需要先更新产品文档的大功能。

完成前：

1. 运行 `npm run design:check`。
2. 运行 `docs/PRODUCT.md` 针对本次风险要求的验收检查。
3. 至少在 390px 和 1440px 检查改动页面。
4. 检查本次涉及的空、加载、成功、错误、hover、focus 和 disabled 状态。
5. 失败项必须记录页面、状态、视口、原因和修复结果。
6. 产品行为或设计决策变化时更新 `docs/PRODUCT.md`；实现或运行状态变化时
   更新 `MEMORY.md`。

## 9. 禁止的捷径

- 复制 Claude 名称、标志、放射形符号或专有资产
- 已有基础组件可用时重新创建原始按钮、输入框或卡片
- 把 Slate/Gray、紫色 AI 渐变、厚重黑影或玻璃拟态作为默认风格
- 在 JSX 中加入任意颜色、内联 `style={{}}` 或桌面固定大宽度
- 整体复制通用聊天产品；Create 可以使用右对齐提示词和响应层级，但必须
  保持 Flownana 品牌、媒体优先，且不得虚构 Agent 执行过程 UI
- 未检查真实渲染结果就声称视觉工作完成
