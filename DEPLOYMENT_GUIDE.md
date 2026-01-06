# 项目部署指南 - 从本地到线上

## 📋 部署流程大纲

### 一、部署前准备（本地操作）

1. **代码准备**
   - ✅ 确保代码可以正常运行
   - ✅ 检查是否有敏感信息泄露
   - ✅ 准备生产环境配置

2. **环境变量准备**
   - 收集所有需要的环境变量
   - 准备生产环境的 Google OAuth 配置

### 二、选择部署平台

**推荐平台：Vercel**（Next.js 官方推荐，最简单）
- ✅ 自动 HTTPS
- ✅ 全球 CDN
- ✅ 自动部署
- ✅ 免费额度充足

**其他选项：**
- Railway
- Render
- AWS / 阿里云等云服务器

### 三、部署步骤

1. **注册并登录 Vercel**
2. **连接 GitHub/GitLab（推荐）或直接上传**
3. **配置环境变量**
4. **部署项目**
5. **获取线上域名**

### 四、配置 Google OAuth（重要！）

1. 在 Google Cloud Console 添加生产环境重定向 URI
2. 更新环境变量（如果需要）

### 五、验证和测试

1. 测试网站访问
2. 测试登录功能
3. 测试图像生成功能

---

## 🚀 详细步骤

### 步骤 1：准备代码仓库（GitHub）

如果还没有 Git 仓库，需要先创建：

```bash
# 在项目根目录
git init
git add .
git commit -m "Initial commit"
```

然后在 GitHub 创建新仓库并推送代码。

### 步骤 2：注册 Vercel 账号

1. 访问 https://vercel.com
2. 点击 "Sign Up"
3. 使用 GitHub 账号登录（推荐）

### 步骤 3：部署项目到 Vercel

1. 在 Vercel 点击 "Add New Project"
2. 选择你的 GitHub 仓库
3. 配置项目设置
4. 添加环境变量
5. 点击 "Deploy"

### 步骤 4：配置 Google OAuth

部署完成后，Vercel 会给你一个域名（如：`your-project.vercel.app`）

需要在 Google Cloud Console 添加：
```
https://your-project.vercel.app/api/auth/callback/google
```

### 步骤 5：更新环境变量

在 Vercel 项目设置中更新 `NEXTAUTH_URL` 为生产环境域名。

---

## 📝 需要准备的信息清单

### 环境变量清单

```
NEXTAUTH_URL=https://your-domain.vercel.app
NEXTAUTH_SECRET=KQfxG5mPS0JVnoc3ZUCdQutrG+eTINwn1cXM1Cr8HC0=
GOOGLE_CLIENT_ID=1066688258748-gvkjh4bnhv62i4eq988kokdts0c9kind.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
NANO_BANANA_API_KEY=0b480ce64ee7db3a80a2cc70b5face27
```

### Google Cloud Console 需要配置的重定向 URI

**开发环境（已有）：**
- `http://localhost:3000/api/auth/callback/google`

**生产环境（需要添加）：**
- `https://your-domain.vercel.app/api/auth/callback/google`

---

## ⚠️ 注意事项

1. **不要提交 `.env` 文件到 Git**
   - 确保 `.gitignore` 包含 `.env`
   - 环境变量通过 Vercel 界面配置

2. **生产环境不需要代理**
   - Vercel 服务器可以直接访问 Google
   - 不需要配置 `HTTP_PROXY` 和 `HTTPS_PROXY`

3. **域名配置**
   - Vercel 免费版提供 `*.vercel.app` 域名
   - 可以绑定自定义域名（需要配置 DNS）

---

## 🎯 快速开始

如果你准备好了，我们可以立即开始部署！

