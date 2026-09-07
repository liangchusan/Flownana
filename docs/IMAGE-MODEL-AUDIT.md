# 图片模型核对（2026-09-05）

状态：用户已批准方案，本地接入和校验修正已实现；Seedream 图生图采用用户
提供的 Kie 价格截图在本地启用。Grok 和 Seedream 两种模式现均已本地启用。
真实账单成本和真实生成未验证，不能视为生产验收完成。

## 接入前模型快照

| 模型 | 当前平台积分/张 | 参数与限制核对 |
| --- | --- | --- |
| GPT Image 2 | 1K 2 / 2K 3 / 4K 5 | input_urls 映射正确；发送的 output_format 未列在当前页面字段中；代码与产品都禁止 4K 1:1、2K/4K Auto，但当前页面没有这两项限制，需确认后同步修改 |
| Nano Banana 2 | 1K 2 / 2K 4 / 4K 5 | image_input、aspect_ratio、resolution、png 对应当前页面；平台仅允许 1 张图是已批准 MVP 限制，上游页面支持 14 张/30 MB |
| Qwen Image 3.0 Pro | 1K 2 / 2K 4 | image_urls、image_size、resolution、png 正确；最多 3 张/10 MB、无 Auto 与页面一致 |

GPT 上游页面现支持最多 16 张/30 MB；平台单图/20 MB 是产品限制，并非请求错误。
GPT 高分辨率页面列出的禁用比例为 5:4、4:5、3:1、1:3、9:21；现有公共比例
列表不包含它们。不能仅凭网页未列禁用就断言高分辨率 Auto 已实测可用。
三个当前模型的用户积分均与 PRODUCT 第 6 节一致，不能据此证明 Kie 成本没变。

## 审计时发现的问题（修正结果见文末）

- `app/api/generate/route.ts` 对全部图片模型统一发送 output_format，后续必须
  改为逐模型白名单。当前实际固定 png；内部 helper 把 jpeg 归一化为 jpg，
  与 Qwen 的 jpeg 枚举不同，虽然当前公开路径不触发，新增 Seedream 时不能复用。
- 前端 Prompt 限 5000 字符，API 仅检查非空，绕过前端可在扣费后才被上游拒绝。
- `lib/media-upload-policy.ts` 图片上传允许 GIF/HEIC/HEIF，而 Nano 和新模型
  官方输入格式为 JPEG/PNG/WebP。图片生成路线目前只调用模型大小限制，缺少
  模型级 MIME 白名单；从共享附件/历史引用进入的素材需要同样校验。
- 比例限制分别写在前端与 API，新增模型容易出现选项与校验不同步；应使用
  共享能力定义，Grok 还需要模式相关 Auto 与“无可选分辨率”的表示。
- 当前图片定价测试主要断言静态价格，未覆盖各模型真实出站请求体及模式切换。
- Qwen 的历史工程说明记录每参考图附加 0.5 Kie 积分、固定用户价格；该附加费
  本次尚未重新核实。确认成本前不把历史记录当当前价，更不静默按输入张数涨价。
- Qwen negative_prompt/seed/prompt_extend、GPT background 和更多比例未开放，
  属于能力覆盖差异，不是现有批准范围内必须补齐的 Bug。

## 新模型与价格缺口

Grok 使用 text-to-image / image-edit（图生图不是 image-to-image 后缀）；
不支持通用 resolution/output_format 请求模板。Seedream 使用
5-pro-text-to-image / 5-pro-image-to-image，quality basic/high 对应 1K/2K。
完整 UI 范围、边界及验收见 PRODUCT 6.1。

Kie 模型页面和 pricing 页的可读取内容未返回当前 SKU 价格。进一步从 Kie
网页公开客户端定位到 `/client/v1/model-pricing/page`，只读价格查询返回
`4030: Not supported in the current region.`；Chrome、内置浏览器控制和原生
浏览器控制也出现超时/长时间阻塞，未能完成视觉验收。
未拿到五个模型按模式/质量/输入附加费拆分的实时价格表；不使用
搜索到的其他经销商价格或 Lite 价格替代 Pro。该缺口必须在新增模型收费启用前
补齐，并检查既有模型的成本变化。没有调用付费生成或部署生产。

## 官方来源

- GPT 参数：https://kie.ai/gpt-image-2
- Nano 参数：https://kie.ai/nano-banana-2
- Qwen 参数：https://kie.ai/qwen-image-3
- Grok 参数：https://kie.ai/grok-imagine-image-2
- Grok 文生图：https://docs.kie.ai/market/grok-imagine-image-2-0/text-to-image
- Grok 图生图：https://docs.kie.ai/market/grok-imagine-image-2-0/image-to-image
- Seedream 参数：https://kie.ai/seedream-5-0-pro
- Seedream 文生图：https://docs.kie.ai/market/seedream/5-pro-text-to-image
- Seedream 图生图：https://docs.kie.ai/market/seedream/5-pro-image-to-image

## 开发后手动测试

五模型文生图/图生图、各质量与比例、最大参考数、超量/超大/不支持格式、
模型切换保留附件、Reprompt、1/4 输出积分和部分失败退款、成功存储及下载、
桌面/移动布局。用真实 Kie 任务记录对照实际成本与输出数量。当前未运行这些测试。

## 本地实现与验证结果

- 五模型出站字段改由 `lib/kie-image-request.ts` 按白名单构造；GPT 不再发送
  未列出的 output_format，Grok 不发送 resolution/output_format，Seedream 采用
  quality basic/high、PNG 和开启安全检查。图片创建/轮询/结算仍共用原流程。
- `lib/image-model-capabilities.ts` 为前后端共用比例、Prompt 长度和 MIME 规则。
  Seedream 官方接口描述限制 3–5000 字符；Grok 编辑页面描述上限 8000，但
  Schema maxLength 为 390000，继续采用更保守的产品 5000 上限。
- 上传附件保留 MIME/大小，切换模型时标记已知不兼容附件，Remove unsupported
  同步过滤；旧素材缺少 MIME/大小时服务端补查，在扣费前验证。
- 新模型空价格配置使 UI 禁用 Generate、API 拒绝请求；不把缺失价格当零积分。
  Grok 草稿、请求、历史和埋点不伪装为 1K；旧模型积分不变。用户补充截图后，
  Seedream 图生图现按下方确认价启用。
- GPT 4K 方图/高分辨率 Auto 尚未完成真实接口验证，因此按批准方案暂保留旧限制。
- 更新价格后 `npm run test`：180 项，176 通过、4 项数据库集成测试跳过。合同测试覆盖
  五模型两种模式和有序参考图；路由 Mock 覆盖成功保存顺序、失败结算、未知价格
  与非法请求不扣费/不调用 Kie。Seedream 图生图路由覆盖实际定价，十张参考图
  的 1K 请求预约 3 积分；单元测试覆盖全部 1–10 张边界及 2K 四输出总价。
  其他路由路径使用仅测试内的合成价格 7，不是产品价格，不写入生产配置。
- TypeScript、Lint（0 错误，24 条警告）、Design Check 和生产构建通过。
- 未完成：390/768/1440 px 真实浏览器视觉验收、真实 Kie 出图与成本核对、隔离
  数据库集成测试。没有启动开发服务器，没有修改数据库或部署生产。

## 用户补充价格：Seedream 图生图

依据用户提供并要求采用的 Kie `seedream/5-pro-image-to-image` 页面截图：
1K 每输出 7 Kie 积分（$0.035），2K 14（$0.07）；参考图首张免费，其余每张
0.5（$0.0025）。不把高档充值赠送 10% 积分当成标准成本折扣。

每输出按总 Kie 成本乘 0.3 四舍五入；1K 为 2–3 平台积分，2K 为 4–6。
最多十张参考图、四个独立输出时，最高预计消耗 24 平台积分。前端总价和
服务端预约扣费使用同一函数，服务端依据已校验输入数组的数量计算。
截图仅确认图生图，不将其作为文生图或 Grok 的价格依据。
本次未实际调用收费 API，实际出图和账单对账仍待人工验收。

## Grok 价格页核实（2026-09-07 落地）

本任务于 2026-09-05 使用 Chrome 原生可访问性读取 https://kie.ai/pricing，
搜索 grok-imagine-image-2，返回两行：Text to Image 与 Image Edit 均为
4 credits per image，Our Price $0.02。按已批准 0.3 系数四舍五入，
两种模式均每输出 1 平台积分；本地现已启用，未部署或调用付费生成。
Seedream 文生图及旧模型最新成本仍未取得完整价格行。

本次验证：181 项测试，177 通过、4 跳过；Lint 0 错误/24 警告；生产构建通过。
Chrome 恢复后价格搜索显示 12 条匹配但持续 Loading，尚未取得 Seedream 明细。

## 完整价格页核查（2026-09-07）

通过隐藏的内置浏览器直接读取 https://kie.ai/pricing 的价格表。以下为 Kie
积分/输出，非 Flownana 积分；未采用充值赠送折扣。前文“待核价/禁用”是历史状态，
由本节结果取代。

| 模型 | 1K | 2K | 4K | 输入图费用 | 平台积分 |
| --- | --- | --- | --- | --- | --- |
| GPT Image 2，文/图生图 | 6 ($0.03) | 10 ($0.05) | 16 ($0.08) | 价格表未列额外输入费 | 2/3/5，不变 |
| Nano Banana 2 | 8 ($0.04) | 12 ($0.06) | 18 ($0.09) | 价格表未列额外输入费 | 2/4/5，不变 |
| Qwen Image 3.0 Pro，文/图生图 | 6.4 ($0.032) | 12 ($0.06) | 不支持 | 每张 0.5 ($0.0025) | 固定 2/4，不变 |
| Seedream 5 Pro，文/图生图 | 7 ($0.035) | 14 ($0.07) | 不支持 | 首张免费，其余每张 0.5 | 文 2/4；图按数量 2–3/4–6 |
| Grok Imagine Image 2.0，文/图生图 | 无分辨率档位：4 ($0.02) | — | — | 价格表两模式均为每输出 4 | 1 |

Seedream 文生图价格现已写入配置；路由合同测试改为所有五模型两种模式都使用
真实价格配置，覆盖成功持久化及失败退款。Qwen 最多三参考图带来的附加成本
仍由平台承担，符合已批准固定售价策略。价格表不是实际账单，真实调用成本待验收。

最终本地验证：181 项测试，177 通过、4 项隔离数据库测试跳过；Lint 0 错误/24 警告；
Design Check 与生产构建通过。未部署，真实生成/账单及响应式视觉验收仍待完成。

2026-09-07 已按用户授权随完整提交 `8509b39` 发布生产；部署
`dpl_21zGdRKAMrCSk2q4NyRGE3YpWQx6` READY，正式域名冒烟通过。
前文“未部署”为当时状态；真实付费出图和实际成本仍未测试。
