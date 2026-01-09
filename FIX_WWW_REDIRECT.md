# 🔧 修复 www 重定向问题

## 🔍 问题确认

从 Network 请求看：
- **实际发送的重定向 URI：** `https://www.flownana.com/api/auth/callback/google`（有 www）
- **可能配置的 URI：** `https://flownana.com/api/auth/callback/google`（无 www）

**问题：** 域名自动跳转到 www 版本，但 Google OAuth 中可能没有配置 www 版本。

---

## ✅ 解决步骤

### 步骤 1：确认 Google OAuth 配置

在 Google Cloud Console 中，确认已添加：

**已获授权的重定向 URI：**
- ✅ `http://localhost:3000/api/auth/callback/google`
- ✅ `https://flownana.com/api/auth/callback/google`
- ✅ `https://www.flownana.com/api/auth/callback/google`（**必须有这个！**）

**已获授权的 JavaScript 来源：**
- ✅ `http://localhost:3000`
- ✅ `https://flownana.com`
- ✅ `https://www.flownana.com`（**必须有这个！**）

### 步骤 2：更新 Vercel 环境变量

由于域名会跳转到 www 版本，需要更新 `NEXTAUTH_URL`：

1. **在 Vercel 项目页面：**
   - Settings → Environment Variables
   - 找到 `NEXTAUTH_URL`
   - 点击编辑
   - 将值改为：`https://www.flownana.com`（**使用 www 版本**）
   - 确保选择了所有环境（Production, Preview, Development）
   - 保存

### 步骤 3：重新部署

1. **在 Vercel 项目页面：**
   - 点击 "Deployments" 标签
   - 找到最新部署
   - 点击 "..." → "Redeploy"
   - 等待部署完成

### 步骤 4：等待配置生效

1. **Google OAuth 配置：** 等待 5-10 分钟
2. **Vercel 部署：** 等待 2-5 分钟

### 步骤 5：测试

1. **清除浏览器缓存**（或使用无痕模式）
2. **访问：** `https://www.flownana.com` 或 `https://flownana.com`
3. **点击 "登录" → "Sign in with Google"**
4. **确认能成功登录**

---

## 🎯 现在请做

1. **确认 Google OAuth 中已添加：**
   - `https://www.flownana.com/api/auth/callback/google`
   - `https://www.flownana.com`（JavaScript 来源）

2. **更新 Vercel 环境变量：**
   - `NEXTAUTH_URL` = `https://www.flownana.com`

3. **重新部署并等待生效**

4. **测试登录**

---

## 💡 或者：配置域名不跳转到 www

如果你希望使用 `flownana.com`（无 www），可以：

1. **在 Vercel → Settings → Domains**
2. **配置域名重定向：**
   - 让 `www.flownana.com` 重定向到 `flownana.com`
   - 或者让 `flownana.com` 重定向到 `www.flownana.com`

但最简单的方式是：**使用 www 版本**，因为你的域名已经自动跳转到 www 了。

告诉我配置结果！


