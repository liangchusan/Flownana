# 🚀 重新部署指南

## ✅ 已完成
- [x] 代码已更新（移除了 .env.backup）
- [x] 已创建新提交准备推送

## 📋 现在需要做的

### 方式 1：推送代码触发自动部署（推荐）

在终端执行：

```bash
cd /Users/liangchusan/flownana
git push origin main
```

推送后，Vercel 会自动检测到新提交并重新部署。

### 方式 2：在 Vercel 中手动重新部署

1. 在 Vercel 项目页面
2. 点击顶部 "Deployments" 标签
3. 找到显示错误的部署（9分钟前的那个）
4. 点击右侧的 "..." 菜单
5. 选择 "Redeploy"
6. 确认重新部署

---

## ⚙️ 部署前确认

在 Vercel 项目设置中确认：

1. **Framework Preset：** Next.js（不是 Other）
2. **环境变量：** 所有 5 个变量都已添加
   - NEXTAUTH_URL
   - NEXTAUTH_SECRET（完整值）
   - GOOGLE_CLIENT_ID
   - GOOGLE_CLIENT_SECRET
   - NANO_BANANA_API_KEY

---

## ⏱️ 等待部署

部署通常需要 2-5 分钟，你会看到：
- Building...（构建中）
- Ready（成功）或 Error（失败）

---

## 🎯 部署成功后

告诉我：
- ✅ "部署成功"
- 你的实际域名（Vercel 会显示，如：`flownana.vercel.app` 或 `flownana-liangchusan.vercel.app`）

然后我们继续配置 Google OAuth！


