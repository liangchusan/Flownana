# ⚡ 快速部署指南

## 🎯 部署流程（5 步完成）

### 步骤 1️⃣：初始化 Git 并推送到 GitHub（5 分钟）

```bash
# 1. 初始化 Git
cd /Users/liangchusan/flownana
git init
git add .
git commit -m "Initial commit: Nano Banana AI 图像生成平台"

# 2. 在 GitHub 创建新仓库（网页操作）
# 访问 https://github.com/new
# 填写仓库名称，点击 "Create repository"

# 3. 推送代码（替换 YOUR_USERNAME 和 REPO_NAME）
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

### 步骤 2️⃣：注册 Vercel（2 分钟）

1. 访问 https://vercel.com
2. 点击 "Sign Up" → 选择 "Continue with GitHub"
3. 授权并完成注册

### 步骤 3️⃣：部署到 Vercel（5 分钟）

1. 在 Vercel 点击 "Add New Project"
2. 选择你的 GitHub 仓库，点击 "Import"
3. **重要：在部署前添加环境变量**

点击 "Environment Variables"，添加：

```
NEXTAUTH_URL=https://your-project.vercel.app
NEXTAUTH_SECRET=KQfxG5mPS0JVnoc3ZUCdQutrG+eTINwn1cXM1Cr8HC0=
GOOGLE_CLIENT_ID=1066688258748-gvkjh4bnhv62i4eq988kokdts0c9kind.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
NANO_BANANA_API_KEY=0b480ce64ee7db3a80a2cc70b5face27
```

4. 点击 "Deploy"，等待完成

### 步骤 4️⃣：更新配置（3 分钟）

部署完成后，Vercel 会给你一个域名（如：`nano-banana-app.vercel.app`）

**4.1 更新 NEXTAUTH_URL**
- Vercel → Settings → Environment Variables
- 编辑 `NEXTAUTH_URL`，改为：`https://你的域名.vercel.app`
- 保存

**4.2 配置 Google OAuth**
- 访问 [Google Cloud Console](https://console.cloud.google.com/)
- API 和凭据 → OAuth 2.0 客户端 ID → 编辑
- 添加重定向 URI：`https://你的域名.vercel.app/api/auth/callback/google`
- 保存

**4.3 重新部署**
- Vercel → Deployments → 最新部署 → ... → Redeploy

### 步骤 5️⃣：测试（2 分钟）

1. 访问你的网站
2. 测试登录功能
3. 测试图像生成功能

---

## ✅ 完成！

你的网站现在已经上线，任何人都可以访问了！

---

## 📝 需要准备的信息

在开始前，确保你有：

- ✅ GitHub 账号
- ✅ Google Cloud Console 中的 OAuth 凭据
- ✅ 所有环境变量的值（已在上面列出）

---

## 🆘 遇到问题？

查看详细步骤：`DEPLOY_STEPS.md`

