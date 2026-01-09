# 🔧 域名配置修正

## ⚠️ 发现的问题

从你的截图看：
1. ✅ **Vercel 环境变量：** `NEXTAUTH_URL` = `https://flownana.com` （正确）
2. ❌ **Google OAuth 重定向 URI：** `https://flownana.com.vercel.app/api/auth/callback/google` （格式不对）

## 🔍 问题分析

Google OAuth 中的 URI 格式不正确：
- 当前：`https://flownana.com.vercel.app/api/auth/callback/google`
- 这个格式看起来混合了自定义域名和 Vercel 默认域名

## ✅ 正确的配置

### 情况 1：如果你有自定义域名 `flownana.com`

**Vercel 环境变量：**
- `NEXTAUTH_URL` = `https://flownana.com` ✅（你已经设置正确）

**Google OAuth 重定向 URI：**
- 应该是：`https://flownana.com/api/auth/callback/google`
- **不是：** `https://flownana.com.vercel.app/api/auth/callback/google`

### 情况 2：如果你只有 Vercel 默认域名

**Vercel 环境变量：**
- `NEXTAUTH_URL` = `https://flownana.vercel.app`（或类似的格式）

**Google OAuth 重定向 URI：**
- 应该是：`https://flownana.vercel.app/api/auth/callback/google`

---

## 🎯 需要确认

请告诉我：
1. **你的实际域名是什么？**
   - 是自定义域名 `flownana.com`？
   - 还是 Vercel 默认域名（如 `flownana.vercel.app`）？

2. **在浏览器访问你的网站，地址栏显示的完整域名是什么？**

---

## 📝 修正步骤

根据你的实际域名，我会告诉你：
1. Vercel 环境变量的正确值
2. Google OAuth 重定向 URI 的正确值
3. 如何修正配置

告诉我你的实际域名，我立即帮你修正！


