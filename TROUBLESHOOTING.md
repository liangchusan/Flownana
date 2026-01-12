# 故障排查指南 - 无法生成视频或图片

## 快速诊断

访问 `http://localhost:3000/api/test-env` 查看环境变量和 API 连接状态。

## 可能的原因和解决方案

### 1. 环境变量未配置

**症状：** 生成时提示 "API_KEY environment variable is not configured"

**解决方案：**
- 检查 `.env` 文件是否包含：
  - `NANO_BANANA_API_KEY` (图片生成必需)
  - `KIE_API_KEY` (视频和音频生成，如果没有会回退到 NANO_BANANA_API_KEY)
- 确保 `.env` 文件在项目根目录
- 重启开发服务器：`npm run dev`

### 2. API 密钥无效或过期

**症状：** 生成时提示 "Failed to create generation task" 或 "Unauthorized"

**解决方案：**
- 检查 API 密钥是否正确
- 确认 API 密钥是否已过期
- 联系 API 服务商确认账户状态

### 3. 网络连接问题

**症状：** 生成时提示 "Connection failed" 或超时

**解决方案：**
- 检查网络连接
- 如果在中国大陆，可能需要配置代理：
  - 设置 `HTTP_PROXY` 和 `HTTPS_PROXY` 环境变量
  - 或使用 `global-agent`（已在 `next.config.js` 中配置）
- 测试 API 连接：访问 `http://localhost:3000/api/test-env` 查看 API 测试结果

### 4. API 端点错误

**症状：** 生成时提示 "Failed to create generation task" 或 404 错误

**解决方案：**
- 检查 API 文档确认端点是否正确：
  - 图片：`https://api.kie.ai/api/v1/jobs/createTask`
  - 视频：`https://api.kie.ai/api/v1/veo/generate`
  - 音频：`https://api.kie.ai/api/v1/suno/generate`

### 5. 请求格式错误

**症状：** 生成时提示 "Invalid request" 或 API 返回错误代码

**解决方案：**
- 检查请求参数是否符合 API 文档要求
- 查看浏览器控制台（F12）的详细错误信息
- 查看服务器终端日志

### 6. 错误信息未正确显示

**症状：** 只看到 "Generation failed, please try again" 而没有具体错误

**解决方案：**
- 打开浏览器开发者工具（F12）
- 查看 Console 标签中的错误信息
- 查看 Network 标签中的 API 请求和响应

## 调试步骤

1. **检查环境变量**
   ```bash
   curl http://localhost:3000/api/test-env
   ```

2. **查看服务器日志**
   - 在运行 `npm run dev` 的终端中查看错误信息

3. **检查浏览器控制台**
   - 按 F12 打开开发者工具
   - 查看 Console 和 Network 标签

4. **测试 API 连接**
   - 访问 `http://localhost:3000/api/test-env`
   - 查看 `apiTest` 部分的连接状态

5. **手动测试 API**
   ```bash
   curl -X POST https://api.kie.ai/api/v1/jobs/createTask \
     -H "Content-Type: application/json" \
     -H "Authorization: Bearer YOUR_API_KEY" \
     -d '{"model":"google/nano-banana","input":{"prompt":"test","output_format":"png","image_size":"1:1"}}'
   ```

## 常见错误信息

| 错误信息 | 可能原因 | 解决方案 |
|---------|---------|---------|
| "API_KEY environment variable is not configured" | 环境变量未设置 | 检查 `.env` 文件并重启服务器 |
| "Failed to create generation task" | API 密钥无效或网络问题 | 检查 API 密钥和网络连接 |
| "Generation timeout" | 生成时间超过 60 秒 | 重试或检查 API 服务状态 |
| "Connection failed" | 网络连接问题 | 检查网络或配置代理 |
| "Unauthorized" | API 密钥无效 | 更新 API 密钥 |

## 获取帮助

如果以上方法都无法解决问题，请提供以下信息：
1. 错误信息（从浏览器控制台和服务器日志）
2. 环境变量检查结果（`/api/test-env`）
3. 网络连接状态
4. API 密钥状态

