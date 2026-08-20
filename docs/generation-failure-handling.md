# 图片与视频生成失败处理说明

更新时间：2026-08-11

## 目标

图片和视频生成失败时，用户不应看到 KIE、OpenAI、Vercel、API Key、供应商余额或字段名等内部信息。所有失败统一转换成：

1. 发生了什么
2. 用户下一步应该做什么
3. 是否可以直接重试
4. 已扣积分是否已经自动退回

原始供应商错误只写入服务端日志，接口、Toast 和 My Creations 失败卡片只展示 Flownana 的标准文案。

## 错误分类

| 错误代码 | 常见原始场景 | 用户看到的标题 | 建议操作 | 可直接重试 | 积分处理 |
| --- | --- | --- | --- | --- | --- |
| `auth_required` | 登录过期、接口返回 401 | Sign in again | 重新登录后再试 | 是 | 未扣积分 |
| `prompt_required` | 提示词为空 | Add a prompt | 补充提示词 | 否，需要修改 | 未扣积分 |
| `input_image_required` | 图生图/图生视频模型缺少图片 | Upload an image | 上传 JPG、PNG 或 WebP | 否，需要修改 | 未扣积分 |
| `unsupported_file_type` | TIFF、HEIC、伪装文件等 | Image format not supported | 改用 JPG、PNG 或 WebP | 否，需要换图 | 未扣积分或自动退回 |
| `file_too_large` | 图片超过 20 MB | Image is too large | 压缩图片后再试 | 否，需要换图 | 未扣积分或自动退回 |
| `invalid_image` | 图片损坏、尺寸太小、URL 失效 | Image could not be used | 换一张清晰图片 | 否，需要换图 | 未扣积分或自动退回 |
| `invalid_parameters` | 分辨率、比例、时长、声音不支持；必填字段错误 | Settings are not supported | 调整模型参数 | 否，需要修改 | 未扣积分或自动退回 |
| `content_policy` | 色情、裸露、暴力、名人或其他敏感内容 | Request blocked by safety policy | 修改提示词或输入图片 | 否，需要修改 | 自动退回 |
| `insufficient_credits` | Flownana 用户积分不足 | Not enough credits | 充值或选择更低价选项 | 否 | 未扣积分 |
| `credit_conflict` | 并发请求导致余额变化 | Credit balance changed | 刷新后重试 | 是 | 不会重复扣费 |
| `provider_unavailable` | KIE 余额不足、供应商鉴权失败、模型暂时不可用 | Model temporarily unavailable | 换模型或稍后再试 | 是 | 自动退回 |
| `rate_limited` | 供应商 429、请求过多 | Too many requests | 等待一分钟 | 是 | 自动退回或任务继续等待 |
| `timeout` | 图片等待超过 5 分钟；视频任务超过 45 分钟 | Generation took too long | 检查 My Creations 后重试 | 是 | 自动退回 |
| `network_error` | 网络中断、供应商连接失败 | Connection interrupted | 检查网络后重试 | 是 | 未扣积分或自动退回 |
| `media_processing_failed` | 生成结果无法下载、格式异常、无法保存到 Blob | Result could not be saved | 重试；持续发生时联系支持 | 是 | 自动退回 |
| `task_not_found` | 任务已删除、任务 ID 不存在 | Generation not found | 刷新 My Creations | 否 | 不额外扣费 |
| `generation_failed` | 未识别的生成失败 | Generation failed | 重试或更换模型 | 是 | 自动退回 |

## 已覆盖的真实线上错误

| 原始错误 | 现在的分类 |
| --- | --- |
| `Content moderation check failed: sexual` | `content_policy` |
| `Inappropriate content, please try another prompt.` | `content_policy` |
| `File type not supported` | `unsupported_file_type` |
| `resolution is not within the range of allowed options` | `invalid_parameters` |
| `This field is required` | `invalid_parameters` |
| KIE `Credits insufficient ... Please top up` | `provider_unavailable`，不会误导 Flownana 用户充值 |
| 供应商 `Unauthorized` | `provider_unavailable`，不会显示为用户登录失败 |

## 当前视频模型请求修复

| 模型 | 已确认的请求规则 | 本次修复 |
| --- | --- | --- |
| MiniMax H3 | 720P UI 对应 KIE `768P`；图生视频使用 `first_frame_url` | 修复把 720P 直接发送给供应商导致的 `resolution is not within...` |
| Grok Imagine Video 1.5 | 使用 `image_urls`、`480p/720p`、1-15 秒和 `nsfw_checker` | 去掉当前接口未列出的旧 `mode` 字段；单图输入不再发送无效比例 |
| HappyHorse 1.1 | 图生视频使用 `image_urls` 数组，分辨率为 `720p/1080p` | 修复单数图片字段造成的必填/图片格式错误 |

供应商接口变更会优先体现在 `lib/kie-video-request.ts` 的纯函数和
`tests/kie-video-request.test.ts` 的完整请求体测试中。修改模型参数时，应先更新这两处合同，再调整 UI。

## 接口返回格式

图片和视频失败接口统一返回：

```json
{
  "error": "The selected model cannot accept this request right now.",
  "errorCode": "provider_unavailable",
  "errorTitle": "Model temporarily unavailable",
  "errorAction": "Try another model or try again later.",
  "retryable": true,
  "creditsRefunded": true,
  "refundPending": false
}
```

- `error`：面向用户的原因，不包含供应商内部信息。
- `errorCode`：稳定的产品错误分类，用于埋点和 UI。
- `errorTitle`：Toast 和失败卡片标题。
- `errorAction`：用户下一步建议。
- `retryable`：是否适合原样重试。
- `creditsRefunded`：本次已扣积分已经自动退回。
- `refundPending`：自动退款失败，需要人工处理。出现时 UI 会明确提醒用户联系支持。

## 前端交互

- 上传阶段直接拦截非 JPG/PNG/WebP 或超过 20 MB 的图片。
- 用户可修正的错误使用琥珀色卡片，例如提示词违规、图片或参数问题。
- 服务或网络错误使用红色卡片，例如供应商不可用、超时或媒体保存失败。
- 失败卡片展示标题、原因和下一步，不再只显示 `Failed`。
- 内容/参数问题的按钮为 `Edit request`；用户积分不足为 `View plans`；可重试故障为 `Try again`。
- `generation_failed` GA4 事件记录标准 `errorCode`，不再记录不稳定的供应商原文。

## 积分与退款

- 参数校验、登录和用户积分不足发生在扣积分前。
- 图片任务在供应商失败、超时或媒体保存失败后自动退款。
- 视频任务保存扣费快照；供应商失败、超过 45 分钟或媒体保存失败时自动退款。
- 视频自动退款失败时不会清除扣费快照，后续状态查询会继续尝试退款。
- UI 会显示 `Your credits were returned automatically.`；退款失败则明确提示联系支持。

## 主要代码位置

- 统一分类与文案：`lib/generation-errors.ts`
- 图片接口：`app/api/generate/route.ts`
- 视频接口与异步退款：`app/api/veo/generate/route.ts`
- 上传与媒体持久化：`lib/media-storage.ts`
- 图片生成 Toast：`components/generate/generate-form.tsx`
- 视频生成 Toast：`components/creation/video-creation-form.tsx`
- 历史失败卡片：`components/creation/my-creations-tab.tsx`
- 分类测试：`tests/generation-errors.test.ts`

## 发布前人工检查

1. 上传一个 TXT、HEIC 或 TIFF 文件，确认页面提示仅支持 JPG/PNG/WebP。
2. 上传一个超过 20 MB 的图片，确认生成前就被拦截。
3. 不填写提示词，确认提示用户补充提示词。
4. 使用明显敏感提示词生成，确认显示安全策略提示，失败卡片为琥珀色，积分退回。
5. 使用 Grok 不上传图片，确认提示必须上传输入图片。
6. 模拟用户积分不足，确认显示 Flownana 积分不足并提供 `View plans`。
7. 模拟 KIE 余额不足或鉴权错误，确认显示模型暂时不可用，而不是让用户充值或重新登录。
8. 模拟不支持的分辨率，确认显示参数不支持。
9. 模拟供应商超时和网络错误，确认提示可以稍后重试。
10. 模拟 Blob 保存失败，确认任务失败、积分退回且不保存临时供应商 URL。
11. 使用同一张 JPG/PNG/WebP 图片分别提交四个在售视频模型，确认请求均能创建任务，失败时显示对应标准分类。
12. 图生视频手动选择非 Auto 比例，确认供应商请求仍由输入图片决定比例，不出现比例冲突。
