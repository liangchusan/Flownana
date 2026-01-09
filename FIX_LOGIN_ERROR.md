# 🔧 修复登录错误

## 📊 问题分析

### 问题 1：npm 警告（不影响功能）
- ✅ 这些只是警告，不影响网站运行
- 可以忽略，不影响功能

### 问题 2：登录错误 `redirect_uri_mismatch`（需要修复）
- ❌ 错误：`错误 400: redirect_uri_mismatch`
- **原因：** Google OAuth 重定向 URI 配置不匹配

---

## 🔍 错误原因

`redirect_uri_mismatch` 表示：
- Google OAuth 收到的重定向 URI 与 Google Cloud Console 中配置的不一致
- 可能的原因：
  1. Google Cloud Console 中没有添加 `https://flownana.com/api/auth/callback/google`
  2. 或者添加的格式不对
  3. 或者 Vercel 的 `NEXTAUTH_URL` 环境变量还没有更新为 `https://flownana.com`

---

## ✅ 解决步骤

### 步骤 1：确认 Vercel 环境变量

1. **在 Vercel 项目页面：**
   - Settings → Environment Variables
   - 找到 `NEXTAUTH_URL`
   - **确认值是否为：** `https://flownana.com`
   - 如果不是，更新为 `https://flownana.com`
   - 确保选择了所有环境（Production, Preview, Development）
   - 保存

### 步骤 2：检查 Google OAuth 重定向 URI

1. **访问 Google Cloud Console：**
   - https://console.cloud.google.com/
   - API 和凭据 → OAuth 2.0 客户端 ID
   - 找到你的 OAuth 客户端，点击编辑

2. **检查 "已授权的重定向 URI"：**
   - 应该包含以下 URI（**全部都要有**）：
     - `http://localhost:3000/api/auth/callback/google`（开发环境）
     - `https://flownana.com/api/auth/callback/google`（生产环境）
     - `https://flownana.vercel.app/api/auth/callback/google`（Vercel 默认域名，可选）

3. **如果没有 `https://flownana.com/api/auth/callback/google`：**
   - 点击 "添加 URI"
   - 输入：`https://flownana.com/api/auth/callback/google`
   - **注意：** 必须是 `https://`，不能是 `http://`
   - 点击 "保存"

### 步骤 3：确认 URI 格式正确

**正确的格式：**
- ✅ `https://flownana.com/api/auth/callback/google`
- ✅ `http://localhost:3000/api/auth/callback/google`

**错误的格式：**
- ❌ `https://flownana.com/api/auth/callback/google/`（末尾不能有斜杠）
- ❌ `http://flownana.com/api/auth/callback/google`（生产环境必须是 https）
- ❌ `flownana.com/api/auth/callback/google`（缺少协议）

### 步骤 4：重新部署（如果修改了环境变量）

如果修改了 `NEXTAUTH_URL` 环境变量：
1. 在 Vercel → Deployments
2. 找到最新部署
3. 点击 "..." → "Redeploy"
4. 等待部署完成

---

## 🎯 检查清单

- [ ] Vercel 环境变量 `NEXTAUTH_URL` = `https://flownana.com`
- [ ] Google OAuth 重定向 URI 包含：`https://flownana.com/api/auth/callback/google`
- [ ] URI 格式正确（https，没有末尾斜杠）
- [ ] 如果修改了环境变量，已重新部署

---

## 🧪 测试

配置完成后：
1. **等待 1-2 分钟**（让 Google OAuth 配置生效）
2. **清除浏览器缓存**（可选，但推荐）
3. **访问：** `https://flownana.com`
4. **点击 "登录" → "Sign in with Google"**
5. **确认能成功登录**

---

## 🆘 如果还是不行

请告诉我：
1. Vercel 环境变量 `NEXTAUTH_URL` 的值是什么？
2. Google Cloud Console 中 "已授权的重定向 URI" 列表是什么？（截图或复制列表）
3. 重新部署后是否测试了？

我会继续帮你排查！


