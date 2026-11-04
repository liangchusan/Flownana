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
- [旧 Checkout 归属索引切换](./operations/CHECKOUT-HISTORY-CUTOVER.md)：本地完成，生产切换尚未执行
- [注册赠送发布与验证](./operations/SIGNUP-BONUS-RELEASE.md)
- [登录弹窗设计验收](./design/login-dialog-qa-20261102.md)

运维文档中的部署和资源信息均为各自记录日期的快照，操作前重新核对。

## 历史归档

`archive/` 中的审计、提案、研究和旧 UI 方案按原文件名保存，只供追溯；
“待开发”“已上线”等均是当时状态，不能覆盖当前 PRODUCT、DESIGN 或 MEMORY。
例如独立 Google popup 已撤回，早期模型、套餐和 Analytics 方案已有后续版本。

- [完整工程历史](./archive/ENGINEERING-HISTORY.md)：整理前 3,321 行 MEMORY 原文，完整保留。
  原文中的路径按整理前仓库根目录理解；搬迁后的文档同名可在本索引分类中定位。
- [注册归因诊断](./archive/SIGNUP-ATTRIBUTION-DIAGNOSIS-2026-10-27.md)与
  [浏览器复核](./archive/SIGNUP-ATTRIBUTION-BROWSER-AUDIT-2026-10-27.md)
- [旧支付审计](./archive/PAYMENT-FLOW-AUDIT-2026-09-22.md)、
  [性能调查](./archive/PERFORMANCE-INVESTIGATION-2026-09-14.md)与
  [风险复核](./archive/RISK_REVIEW_2026-08-31.md)
- [原 GA4/Ads 方案](./archive/GA4-ADS-MEASUREMENT-PLAN.md)、
  [GA4 实施验证](./archive/GA4-IMPLEMENTATION-VALIDATION-2026-10-05.md)、
  [Ads 就绪审计](./archive/ADS-READINESS-AUDIT-2026-10-10.md)、
  [GA/Ads 审计](./archive/GA-ADS-AUDIT-2026-10-12.md)、
  [增强型转化提案](./archive/ENHANCED-CONVERSIONS-PROPOSAL-2026-10-12.md)与
  [衡量改进方案](./archive/ADS-MEASUREMENT-IMPROVEMENT-PLAN-2026-10-12.md)
- [早期图片模型审计](./archive/IMAGE-MODEL-AUDIT.md)、
  [模板研究](./archive/IMAGE-TEMPLATES-RESEARCH.md)、
  [模板交接](./archive/TEMPLATE-INTERACTION-HANDOFF.md)、
  [封面提示词](./archive/template-cover-prompts.json)与
  [封面预览](./archive/template-covers-preview.html)
- [Runway 视觉迁移](./archive/UI-MIGRATION-PLAN.md)与
  [已撤回的 Google popup 方案](./archive/GOOGLE-POPUP-LOGIN-PLAN.md)

历史截图移至 `output/archive/design-qa-20260902/`。
`output/releases/` 的生产补丁和 manifest、`output/diagnostics/` 与 `output/playwright/`
中的验收证据仍在原位；它们是本地材料，受 Git 和部署忽略规则保护，不随克隆自动恢复。
