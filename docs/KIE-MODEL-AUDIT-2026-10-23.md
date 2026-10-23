# KIE 模型合同与计价核查（2026-10-23）

用户已授权核对所有在售模型的官方名称、所有参数和价格，并开发上线本对话调整。
本文件以本次公开模型页、对应 API Reference 和独立 Pricing 表为依据；结构化字段与
价格行见 [KIE-MODEL-CONTRACTS.json](./KIE-MODEL-CONTRACTS.json)。能力与价格核对
不等于已经真实出片、完成账单对账或部署；运行证据见 MEMORY 最新记录。

## 名称、Provider 与上下线

| 网站正式名称（与 KIE 一致） | Provider ID / 模式 |
| --- | --- |
| Nano Banana 2.1 | nano-banana-2-1；文字/参考图共用 |
| Grok Imagine Image 2.0 | grok-imagine-image-2-0/text-to-image、image-edit |
| GPT Image 2.5 Flare | gpt-image-2-5-flare-text-to-image、image-to-image |
| GPT Image 2.5 Sunburst | gpt-image-2-5-sunburst-text-to-image、image-to-image |
| Seedance 2.0 Mini | bytedance/seedance-2-mini |
| Gemini Omni 1.1 Flash | google/gemini-omni-flash-1-1 |
| Wan 3.0 Video | wan/3-0-video |
| MiniMax H3 (Hailuo-03) | minimax-h3/text-to-video、image-to-video |
| Grok Imagine Video 1.5 | grok-imagine-video-1-5-preview |

GPT 的 Flare/Sunburst 采用官方 API 模式名，不再使用网站自造的 GPT-Image-2.5 连字符。
Gemini 采用链接对应官方 Flash 名称；Grok 视频模型页名称无 Preview，真实 Provider ID
仍为 preview。MiniMax 采用官方模型页完整名称。历史记录保存的原名称不做数据库改写。

下线 GPT Image 2、Nano Banana 2、Qwen Image 3.0 Pro、Seedream 5.0 Pro、旧 Gemini Omni
Video、HappyHorse 1.1 的新生成；保留历史显示、参考素材、下载及已受理任务轮询/结算。
新 Gemini 使用独立选项 ID。旧草稿/Reprompt/报价保留内容并要求重新选模型、核价和确认。

## 所有上游参数与平台开放范围

所有接入模式都使用 POST /api/v1/jobs/createTask 和 GET /api/v1/jobs/recordInfo。
统一请求外层为 model、input，以及可选 callBackUrl；平台继续轮询，不新增 Webhook。
下列为逐参数核查，不表示所有上游能力都在本次向用户开放。枚举、类型和必填项详见 JSON。

| 模型 | KIE input 全部参数 | 本次处理 |
| --- | --- | --- |
| Nano Banana 2.1 | prompt、image_input、aspect_ratio、resolution、output_format | 发送实际有序参考；最多 10 图；1K/2K/4K；PNG；5000 字；20 MB；比例取产品七项白名单 |
| Grok Image 文生图 | prompt、aspect_ratio | 不传 resolution/output_format；5000 字；产品白名单交集仅 1:1/16:9/9:16 |
| Grok Image 编辑 | prompt、image_urls、aspect_ratio | 最多 5 图/20 MB；增加 Auto；无分辨率档，不虚构 1K |
| GPT Flare/Sunburst，四种模式 | prompt、aspect_ratio、resolution、background；编辑另有 input_urls | 最多 16 图/20 MB，5000 字，1K/2K/4K；background 仅 1K 有效，本次不增加背景工具或发送该参数；特殊比例不在产品白名单 |
| Seedance Mini | prompt、first_frame_url、last_frame_url、reference_image_urls、reference_video_urls、reference_audio_urls、generate_audio、resolution、aspect_ratio、duration、web_search；共享安全字段 nsfw_checker | 纯 1/2 图走首/尾帧；其余走互斥参考数组；9 图/3 视频/3 音频；输出 4–15 秒、480p/720p；声音默认 true；Auto→adaptive；web_search 仅纯文字请求固定 false；安全检查开启 |
| Gemini Omni 1.1 Flash | prompt、image_urls、first_frame_url、last_frame_url、audio_ids、video_list、character_ids、duration、aspect_ratio、seed、resolution | 本轮只文字/普通图片参考，最多 7 图/10 MB；4/6/8/10 字符串秒数、16:9/9:16、720p/1080p/4k。首帧与参考组互斥；360p、视频续接、首尾帧、Audio/Character ID、Seed 均不开放 |
| Wan 3.0 Video | prompt、first_frame_url、last_frame_url、reference_image_urls、reference_video_urls、reference_audio_urls、reference_file_urls、reference_link_urls、resolution、aspect_ratio、duration、audio、seed；安全字段 nsfw_checker | 纯 1/2 图走首尾帧，其余走互斥参考数组；保留平台 10 图/1 视频/1 音频；输出 2–30 秒，带视频最长 15 秒且输入+输出≤30 秒；Auto→adaptive；音频默认 true；不新增链接、文档或 Seed |
| MiniMax H3 文生视频 | prompt、duration、aspect_ratio、resolution | prompt 1–5000（上游≤7000）；输出 4–15 秒；720P 界面档实际发 768P；固定比例六项，Auto 仅作为历史安全回退，不发 adaptive；2K 历史保留但不在产品白名单 |
| MiniMax H3 图生视频 | prompt、duration、first_frame_url、last_frame_url、resolution | 最多 2 图/20 MB；不发 aspect_ratio，跟随输入；不接入 reference-to-video、额外参考图/视频/音频通路 |
| Grok Video 1.5 | prompt、image_urls、aspect_ratio、resolution、duration、nsfw_checker、first_frame_url、last_frame_url、loop_url、keyframes、enable_audio | 保留必须 1 图/20 MB，480p/720p、1–15 秒；prompt≤4096；模型页说明单图时比例字段无效，界面跟图且不发该字段；enable_audio 默认 true，Agent 明确无声则 false；不新增首尾帧/Loop/关键帧/1080p |

上游允许而本轮仍不开放：Nano 的 30 MB/更多比例/20000 字；GPT 的 30 MB/背景/特殊比例；
Seedance GIF、-1 智能时长/搜索；Wan 5 视频/5 音频/100 MB/1 秒参考/智能时长/文档/网页；
MiniMax 参考模式/HEIC/HEIF/30 MB。平台更严格限制属于产品范围，不伪装成上游限制。

### 参考文件合同

- Seedance 图片：边长与宽高比在 (300,6000) px / (0.4,2.5) 内；视频：[300,6000] px，
  比例 [0.4,2.5]、总像素 [409600,927408]、24–60 FPS、2–15 秒，合计≤15 秒。
- Wan 图片：[240,8000] px，比例≤8:1；视频：[240,4096] px，比例≤8:1。
  实际透明图片不接受；含Alpha通道但像素全部不透明的PNG仍可用，不自动合成背景。
  平台保留参考视频/音频单个 2–15 秒、合计≤15 秒和 50/15 MB，更严格于上游部分值。
- MiniMax 首尾图：[256,5760] px、比例 [0.4,2.5]。平台只允许已有 JPEG/PNG/WebP。
- 服务端从账号所属素材的真实字节读取时长与必要几何参数，未知/损坏不能当作兼容。
  不裁剪、拉伸、压缩或转码。客户端反馈和服务端扣费前复核分开验收。

## 当前单价与换算

图片按 Math.round(KIE × 0.3)，每输出先取整，再乘输出数。视频按整次请求的
KIE 成本 ×0.2 四舍五入。充值赠送不参与标准计价。价格表核对为只读查询，未调用付费任务。

| 图片 | KIE / 平台积分每输出 |
| --- | --- |
| Nano Banana 2.1，1K/2K/4K | 4/6/9 → 1/2/3 |
| Grok Image 2.0，文字/编辑 | 4 → 1 |
| GPT Image 2.5 Flare/Sunburst，1K/2K/4K，文字/编辑 | 6/10/16 → 2/3/5 |

| 视频 | KIE 标准成本 |
| --- | --- |
| Seedance Mini，无视频参考 | 480P 3.8/s；720P 8.2/s × 输出秒数 |
| Seedance Mini，有视频参考 | 480P 2.4/s；720P 5/s ×（已核实输入视频合计秒数 + 输出秒数） |
| Wan 3.0，480P/720P/1080P | 8/16/32 每秒 ×（输入视频合计秒数 + 输出秒数） |
| MiniMax H3，768P（界面720P） | 8/s × 输出秒数；当前最多2张图，无第6张起的额外图片费 |
| Grok Video 1.5，480P/720P | 2.4/4.5 每秒 × 输出秒数 |
| Gemini 1.1，720P/1080P，4/6/8/10 秒 | 63/84/105/126 → 13/17/21/25 平台积分 |
| Gemini 1.1，4K，4/6/8/10 秒 | 147/168/189/210 → 29/34/38/42 平台积分 |

发现价格漂移：旧 Seedance 10/22、Wan 30/50/90、MiniMax 18/29、Grok 14.5/25
均与现行表不同。本次修正实际公式和所有报价入口，不改历史已扣积分。Seedance 原先
所有参考模式都用无视频价格，Wan 原先未计输入时长，均需修正。

上游冲突：Nano 页内中文字段 3/5/8 与英文及独立表4/6/9不符，采用后者；Grok 文案第三档
误写第二个720p，独立表仅有480p/720p两行，1080p本轮不启用；Grok API schema曾保留多图
描述但 maxItems=1，平台仍限1图；单图跟图规则以当前模型页说明保守执行。

Grok 480P、1秒按原公式取整为0。用户已确认保留该档位并最低收1积分；Grok视频
报价使用 `Math.max(1, Math.round(KIE成本 × 0.2))`，前端、Agent、服务端共用同一结果。

## 验证与待验收

- 自动化要覆盖官方字段白名单/类型/枚举，所有在售模型名，逐档价格与真实输入时长，
  退役/未知ID扣费前拒绝、历史轮询、报价过期与旧草稿，失败退款与存储后成功。
- UI 检查 Home/Image/Video/Agent 所有入口、首次/再次打开/关闭重开、390/768/1440px。
- 真实 Provider 任务、输出尺寸/时长/音轨、10/16图等上限及 creditsConsumed 账单记录
  与自动化 Mock 分开记录；不将“官方表核对”表述为“实际账单已对账”。
