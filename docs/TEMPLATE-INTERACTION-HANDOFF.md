# 模板与 Agent 会话交接

最近更新：2026-09-12。用户明确批准“可以，我们上线”；首版生产迁移和发布完成，部署 READY。
产品范围以 PRODUCT 第 18 节为准，实现细节见 AGENT-SPEC 第 10 节。
未提交、推送或执行真实付费验收。生产部署详见 MEMORY.md 末尾。

## 已落实

- 首页 Agent / Image / Video 独立切换、各自草稿；Agent 无后置模型参数选择器。
- 首页首次发送后进入持久化会话，模板卡片直接进入带背景的新会话，不弹模板 Modal。
- 会话内理解、追问、方案与积分确认、图片/视频状态、预览、下载、选图修改及转视频。
- 侧栏历史、新建、自动标题、重命名、删除、恢复；账号隔离，删除会话保留 Assets。
- 免费每天 10 次、有效付费每天 100 次；完整回复/追问计一次，失败、确认与恢复不计。
  UTC 零点重置，界面显示当地时间；不自动扣媒体积分续聊。
- Qwen 理解；图片默认 GPT-Image-2.5 Flare，模板初次 4 张、编辑 1 张；视频默认
  Seedance 2.0 Mini、720P、5 秒、无声、1 个。每个付费步骤必须分别点击确认。
- 服务端核价、过期/版本校验、账户锁、任务与扣费原子提交、逐输出退款、人工重试。
- 旧模板任务保持原执行/退款路径；旧草稿可选择带入并重新核价；原始数据保留。
- 四项 Agent 事件及既有生成、下载语义已接入，私有会话内容不进入显式事件参数。

## 验证与下一步

451 项测试全部通过，包含完整迁移重放、真实本地 PostgreSQL 并发/额度/退款/引用/
账号注销、实际 AI SDK 配模拟模型流。lint 零错误（30 条 warning）、build 与
设计检查通过；浏览器覆盖 390/768/1440px、登录草稿、首页模式切换与首次发送、
会话恢复/改名、报价、视频失败退款。浏览器理解模型使用临时本地模拟，非真实质量验收。

下一步是获准后的真实 Qwen、图片、编辑、视频和素材组合验收。建议测试预算仍未授权；
不要把部署成功等同生产 Provider、存储和 Stripe 验收。GA4 后台自动页面采集配置
仍待复核；现有全站日成本熔断仅为建议，尚未实现。

## 主要代码

- `app/agent/[[...id]]/page.tsx`、`app/api/agent/route.ts`
- `components/blocks/agent/`、`components/blocks/media-creation-workspace.tsx`
- `lib/agent/`、`lib/video-generation-service.ts`、`lib/image-templates/worker.ts`
- `prisma/migrations/20260911160000_agent_conversations/migration.sql`
- `tests/agent*.test.ts`

模板卡片先前的紧凑布局与未提交样式改动已保留；本轮没有重新查询历史生产部署。
