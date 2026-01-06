# 🚀 部署步骤 - 一步一步指南

## 📋 部署流程总览

```
本地项目 → GitHub 仓库 → Vercel 部署 → 配置环境变量 → 配置 Google OAuth → 完成！
```

---

## 第一步：准备代码仓库（GitHub）

### 1.1 检查 Git 状态

如果还没有 Git 仓库，需要初始化：

```bash
cd /Users/liangchusan/flownana
git init
git add .
git commit -m "准备部署到生产环境"
```

### 1.2 创建 GitHub 仓库

1. 访问 https://github.com
2. 点击右上角 "+" → "New repository"
3. 填写仓库名称（如：`nano-banana-app`）
4. 选择 **Public**（公开）或 **Private**（私有）
5. **不要**勾选 "Initialize this repository with a README"
6. 点击 "Create repository"

### 1.3 推送代码到 GitHub

GitHub 会显示推送命令，类似这样：

```bash
git remote add origin https://github.com/你的用户名/nano-banana-app.git
git branch -M main
git push -u origin main
```

**执行这些命令**（替换为你的实际仓库地址）

---

## 第二步：注册并登录 Vercel

### 2.1 访问 Vercel

1. 打开 https://vercel.com
2. 点击右上角 "Sign Up"

### 2.2 使用 GitHub 登录（推荐）

- 选择 "Continue with GitHub"
- 授权 Vercel 访问你的 GitHub 账号
- 完成注册

---

## 第三步：部署项目到 Vercel

### 3.1 创建新项目

1. 登录 Vercel 后，点击 "Add New Project"
2. 在 "Import Git Repository" 中找到你的仓库
3. 点击 "Import"

### 3.2 配置项目设置

Vercel 会自动检测 Next.js 项目，保持默认设置即可：

- **Framework Preset**: Next.js（自动检测）
- **Root Directory**: `./`（默认）
- **Build Command**: `npm run build`（自动）
- **Output Directory**: `.next`（自动）
- **Install Command**: `npm install`（自动）

### 3.3 添加环境变量（重要！）

在部署前，点击 "Environment Variables" 添加以下变量：

| 变量名 | 值 | 说明 |
|--------|-----|------|
| `NEXTAUTH_URL` | `https://your-project.vercel.app` | **先填临时值，部署后会更新** |
| `NEXTAUTH_SECRET` | `KQfxG5mPS0JVnoc3ZUCdQutrG+eTINwn1cXM1Cr8HC0=` | 你的密钥 |
| `GOOGLE_CLIENT_ID` | `1066688258748-gvkjh4bnhv62i4eq988kokdts0c9kind.apps.googleusercontent.com` | Google OAuth ID |
| `GOOGLE_CLIENT_SECRET` | `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` | Google OAuth Secret |
| `NANO_BANANA_API_KEY` | `0b480ce64ee7db3a80a2cc70b5face27` | Nano Banana API Key |

**注意：**
- 每个变量都要选择环境：**Production, Preview, Development**（全选）
- 点击 "Add" 添加每个变量

### 3.4 开始部署

1. 点击 "Deploy" 按钮
2. 等待部署完成（通常 2-5 分钟）
3. 部署完成后，Vercel 会显示你的网站地址，类似：`https://nano-banana-app.vercel.app`

---

## 第四步：更新环境变量和 Google OAuth

### 4.1 更新 NEXTAUTH_URL

1. 在 Vercel 项目页面，点击 "Settings"
2. 点击 "Environment Variables"
3. 找到 `NEXTAUTH_URL`，点击编辑
4. 将值更新为你的实际域名（如：`https://nano-banana-app.vercel.app`）
5. 保存

### 4.2 配置 Google OAuth 重定向 URI

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 进入 **API 和凭据** → **OAuth 2.0 客户端 ID**
3. 找到你的 OAuth 客户端，点击编辑
4. 在 "已授权的重定向 URI" 中添加：
   ```
   https://你的域名.vercel.app/api/auth/callback/google
   ```
   例如：`https://nano-banana-app.vercel.app/api/auth/callback/google`
5. 点击 "保存"

### 4.3 重新部署（使环境变量生效）

1. 在 Vercel 项目页面，点击 "Deployments"
2. 找到最新的部署，点击右侧 "..." → "Redeploy"
3. 确认重新部署

---

## 第五步：验证部署

### 5.1 测试网站访问

1. 访问你的 Vercel 域名（如：`https://nano-banana-app.vercel.app`）
2. 确认网站正常加载

### 5.2 测试登录功能

1. 点击 "登录" 按钮
2. 选择 Google 账号登录
3. 确认登录成功并显示用户信息

### 5.3 测试图像生成

1. 访问 `/generate` 页面
2. 输入提示词并生成图像
3. 确认功能正常

---

## ✅ 部署完成检查清单

- [ ] 代码已推送到 GitHub
- [ ] Vercel 项目已创建
- [ ] 所有环境变量已配置
- [ ] `NEXTAUTH_URL` 已更新为生产域名
- [ ] Google OAuth 重定向 URI 已添加
- [ ] 网站可以正常访问
- [ ] 登录功能正常
- [ ] 图像生成功能正常

---

## 🎯 后续优化（可选）

### 自定义域名

1. 在 Vercel 项目设置中，点击 "Domains"
2. 添加你的自定义域名
3. 按照提示配置 DNS 记录

### 自动部署

- Vercel 会自动部署每次推送到 GitHub 的代码
- 无需手动操作

### 监控和分析

- Vercel 提供内置的分析和监控
- 可以在项目设置中查看访问统计

---

## ❓ 常见问题

### Q: 部署后登录失败？

A: 检查：
1. `NEXTAUTH_URL` 是否正确设置为生产域名
2. Google OAuth 重定向 URI 是否已添加
3. 环境变量是否已正确配置

### Q: 如何更新代码？

A: 只需：
1. 在本地修改代码
2. `git add .` 和 `git commit -m "更新"`
3. `git push` 推送到 GitHub
4. Vercel 会自动重新部署

### Q: 如何查看部署日志？

A: 在 Vercel 项目页面，点击 "Deployments" → 选择部署 → 查看 "Build Logs"

---

## 📞 需要帮助？

如果遇到问题，可以：
1. 查看 Vercel 的部署日志
2. 检查浏览器控制台的错误信息
3. 查看终端日志

现在可以开始第一步了！

