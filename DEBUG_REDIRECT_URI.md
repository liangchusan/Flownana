# 🔍 调试 redirect_uri_mismatch 错误

## 🔍 需要检查的信息

从 Network 标签看，有一个请求：`auth?client_id=1066688258748-g...`

我们需要查看这个请求的详细信息，看看实际发送的重定向 URI 是什么。

---

## 📋 调试步骤

### 步骤 1：查看 Network 请求详情

1. **在浏览器开发者工具中：**
   - 保持 Network 标签打开
   - 找到 `auth?client_id=...` 这个请求
   - **点击这个请求**，查看详细信息

2. **查看请求 URL：**
   - 在 "Headers" 标签中
   - 查看 "Request URL" 或 "Query String Parameters"
   - 找到 `redirect_uri` 参数
   - **告诉我这个值是什么**

3. **或者查看响应：**
   - 在 "Response" 或 "Preview" 标签中
   - 看是否有错误信息

### 步骤 2：检查实际使用的域名

可能的问题：
- Vercel 可能在使用不同的域名
- 或者有 www 前缀的问题

**请检查：**
1. 在浏览器地址栏，访问 `https://flownana.com` 时，实际显示的完整 URL 是什么？
2. 是否有重定向到 `www.flownana.com`？

### 步骤 3：添加所有可能的重定向 URI

在 Google Cloud Console 中，添加所有可能的 URI：

1. **已获授权的重定向 URI：**
   - `http://localhost:3000/api/auth/callback/google`
   - `https://flownana.com/api/auth/callback/google`
   - `https://www.flownana.com/api/auth/callback/google`（如果有 www）
   - `https://flownana.vercel.app/api/auth/callback/google`（Vercel 默认域名）

2. **已获授权的 JavaScript 来源：**
   - `http://localhost:3000`
   - `https://flownana.com`
   - `https://www.flownana.com`（如果有 www）
   - `https://flownana.vercel.app`（Vercel 默认域名）

---

## 🎯 现在请做

1. **查看 Network 请求详情：**
   - 点击 `auth?client_id=...` 请求
   - 查看 `redirect_uri` 参数的值
   - **告诉我这个值是什么**

2. **检查浏览器地址栏：**
   - 访问网站时，实际显示的完整 URL 是什么？
   - 是否有重定向？

3. **添加所有可能的 URI：**
   - 在 Google Cloud Console 中添加上面列出的所有 URI
   - 保存并等待 5-10 分钟

---

## 💡 可能的原因

1. **实际使用的域名和配置的不一致**
   - 比如有 www 前缀
   - 或者使用了 Vercel 默认域名

2. **URI 格式问题**
   - 可能有额外的参数
   - 或者编码问题

3. **Google OAuth 配置未生效**
   - 需要等待更长时间

告诉我 Network 请求中的 `redirect_uri` 值，我会帮你找到问题！


