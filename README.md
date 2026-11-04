# Flownana

AI 图片与视频创作产品，使用 Next.js App Router、React、TypeScript、Prisma 和 Stripe。

开始修改前阅读 [协作规则](./AGENTS.md)、[产品范围](./docs/PRODUCT.md) 和
[当前工程状态](./MEMORY.md)；涉及 UI 时还需阅读 [设计规范](./docs/DESIGN.md)。
完整文档导航见 [docs/README.md](./docs/README.md)。

## 本地开发

```sh
npm install
cp .env.example .env.local
# 在 .env.local 中配置获批准的本地/测试环境变量
npm run dev
```

已有 `.env.local` 时直接编辑，不要覆盖。变量名称以 `.env.example` 为准，真实值不入库。
生成、付款和上传可能调用收费服务；验收使用隔离测试资源，参见
[测试环境与边界](./docs/operations/TEST-ENVIRONMENT.md)。

## 目录导航

| 路径 | 用途 |
| --- | --- |
| `app/` | 页面、布局、API；`app/_components/` 为页面组合 |
| `components/ui/` | 基础组件 |
| `components/blocks/` | Home、工作台、Assets、Agent 等业务组合 |
| `components/auth/`、`pricing/`、`billing/` | 登录、定价与账单交互 |
| `components/creation/`、`generate/` | 图片/视频输入与生成组件 |
| `components/analytics/`、`layout/` | 统计/隐私入口与公共布局 |
| `lib/` | 共享业务逻辑、计费、媒体、统计与 Provider；`agent/`、`image-templates/` 为专属模块 |
| `prisma/` | Schema 与完整迁移历史；旧迁移仍是重建数据库所需材料 |
| `public/` | 当前品牌、字体、模板等运行时资源 |
| `tests/` | Node 测试；`helpers/` 提供隔离数据库和源码加载工具 |
| `scripts/` | 设计检查、Stripe 构建校验、冒烟与运维工具 |
| `docs/` | 当前规范、运维手册、设计验收及历史归档 |
| `output/` | 选定设计稿、必要验收证据及发布恢复材料，不入库、不随网站部署 |

`.next/`、`*.tsbuildinfo` 和 `node_modules/.cache/` 是可再生缓存，可在开发服务停止后删除。
`node_modules/` 保留当前依赖；删除整个目录后须先重新安装。清除 `.next/` 后，
`npm run dev` 会重新生成缓存，`npm run start` 前须先执行 `npm run build`。
`.env*`、`.vercel/` 是本地配置，不要当作无用文件删除。

## 常用检查

```sh
npm run test
npm run lint
npm run design:check
npm run build
```

数据库和真实 Stripe 专项需要独立测试配置，缺少时会明确跳过。
本地冒烟可在 `npm run start` 后执行 `BASE_URL=http://localhost:3000 npm run smoke:prod`；
该命令默认目标是正式站。生产部署、数据库迁移和平台配置操作须另获明确批准。

## 整理约定

- 新文档先进入现有分类，并更新文档导航。产品行为统一维护在 PRODUCT，设计维护在 DESIGN。
- MEMORY 只保留当前工程摘要、部署与风险；旧流水账、废弃方案和被替代的审计从工作目录删除，历史通过 Git 查阅。
- `docs/archive/` 只保留当前 PRODUCT / DESIGN 仍引用的合同、授权边界与设计依据，不堆积旧报告。
- 临时截图与调试输出放 `output/`，完成验证后删除废稿、重复截图和临时构建目录。
  远端同步成功前保留 `output/releases/` 的 Git bundle、发布补丁与 manifest；忽略目录不是远端备份。
- 删除源码前检查 import、动态加载、测试读取和配置引用。`legacy`、旧模型名、旧迁移不等于可以删除。
- 不为整理目录搬动已使用的业务代码，不改变路由、积分、付款、媒体兼容或埋点。
