# 文档导航

当前规范、运维手册与历史材料分别维护。根目录的 [README](../README.md) 提供源码目录导航。

## 当前规范与实施参考

| 文档 | 用途 |
| --- | --- |
| [PRODUCT](./PRODUCT.md) | 已确认产品范围、行为、埋点和验收标准；优先级最高 |
| [DESIGN](./DESIGN.md) | 当前视觉、组件与交互规范 |
| [MEMORY](../MEMORY.md) | 当前实现摘要、最近记录的部署、未发布工作与风险 |
| [AGENT-SPEC](./AGENT-SPEC.md) | Agent 实施参考；后续产品规则以 PRODUCT 为准 |
| [LOGIN-DIALOG-PLAN](./LOGIN-DIALOG-PLAN.md) | 已实施的品牌登录弹窗范围、入口及验收 |
| [KIE 模型审计](./KIE-MODEL-AUDIT-2026-10-23.md) | 2026-10-23 模型能力与价格核对依据 |
| [KIE 结构化合同](./KIE-MODEL-CONTRACTS.json) | 模型合同/价格快照，也是回归测试输入 |

## 运维与验收

- [测试环境及隔离边界](./operations/TEST-ENVIRONMENT.md)
- [数据库安全上线手册](./operations/DATABASE_SECURITY_ROLLOUT.md)
- [旧 Checkout 归属索引切换](./operations/CHECKOUT-HISTORY-CUTOVER.md)：2026-11-04 已完成生产切换与历史导入
- [注册赠送发布与验证](./operations/SIGNUP-BONUS-RELEASE.md)
- [登录弹窗设计验收](./design/login-dialog-qa-20261102.md)

运维文档中的部署和资源信息均为各自记录日期的快照，操作前重新核对。

## 仍需保留的历史依据

`archive/` 只保留当前 PRODUCT / DESIGN 仍引用的六份材料；它们用于追溯合同、
授权边界与设计依据，不能覆盖当前规范中的后续决定。

- [原 GA4/Ads 方案](./archive/GA4-ADS-MEASUREMENT-PLAN.md)、
  [增强型转化提案](./archive/ENHANCED-CONVERSIONS-PROPOSAL-2026-10-12.md)与
  [衡量改进方案](./archive/ADS-MEASUREMENT-IMPROVEMENT-PLAN-2026-10-12.md)
- [早期图片模型审计](./archive/IMAGE-MODEL-AUDIT.md)与
  [模板研究](./archive/IMAGE-TEMPLATES-RESEARCH.md)
- [Runway 视觉迁移](./archive/UI-MIGRATION-PLAN.md)

## 历史资料

旧流水账、已撤回的 popup 方案、被替代的审计及封面预览已从工作目录删除。
完整版本保存在整理前提交 `35087da`，例如：

```sh
git show 35087da:docs/archive/ENGINEERING-HISTORY.md
git show 35087da:docs/archive/GOOGLE-POPUP-LOGIN-PLAN.md
```

`output/` 仅保留选定的登录参考稿、桌面/手机正式截图、Pricing 叠层截图和必要发布材料。
旧浏览器诊断脚本、重复截图、未选设计稿及临时构建已清除。
这些本地材料不随克隆恢复；GitHub 同步成功前须保留发布补丁与恢复 bundle。
