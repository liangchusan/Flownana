# 🚀 Vercel 部署步骤

## ✅ 已完成
- [x] 代码已推送到 GitHub: https://github.com/liangchusan/Flownana

## 📋 现在开始部署到 Vercel

### 步骤 1：注册/登录 Vercel（2 分钟）

1. **访问：** https://vercel.com
2. **点击右上角 "Sign Up"**
3. **选择 "Continue with GitHub"**（推荐，最简单）
4. **授权 Vercel 访问你的 GitHub 账号**
5. **完成注册**

### 步骤 2：导入项目（1 分钟）

1. **登录后，点击 "Add New Project"**
2. **在 "Import Git Repository" 中找到 `liangchusan/Flownana`**
3. **点击 "Import"**

### 步骤 3：配置项目（重要！）

#### 3.1 项目设置（保持默认）
- Framework Preset: Next.js（自动检测）
- Root Directory: `./`（默认）
- Build Command: `npm run build`（自动）
- Output Directory: `.next`（自动）

#### 3.2 添加环境变量（必须！）

**在点击 "Deploy" 之前，先添加环境变量：**

点击 "Environment Variables"，添加以下 5 个变量：

| 变量名 | 值 | 环境 |
|--------|-----|------|
| `NEXTAUTH_URL` | `https://flownana.vercel.app` | Production, Preview, Development |
| `NEXTAUTH_SECRET` | `KQfxG5mPS0JVnoc3ZUCdQutrG+eTINwn1cXM1Cr8HC0=` | Production, Preview, Development |
| `GOOGLE_CLIENT_ID` | `1066688258748-gvkjh4bnhv62i4eq988kokdts0c9kind.apps.googleusercontent.com` | Production, Preview, Development |
| `GOOGLE_CLIENT_SECRET` | `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` | Production, Preview, Development |
| `NANO_BANANA_API_KEY` | `0b480ce64ee7db3a80a2cc70b5face27` | Production, Preview, Development |

**重要提示：**
- 每个变量都要选择所有环境（Production, Preview, Development）
- `NEXTAUTH_URL` 先填临时值，部署后会更新为实际域名

### 步骤 4：开始部署

1. **点击 "Deploy" 按钮**
2. **等待部署完成**（通常 2-5 分钟）
3. **部署完成后，Vercel 会显示你的网站地址**

### 步骤 5：获取实际域名并更新配置

部署完成后，你会得到一个域名，类似：
- `flownana.vercel.app` 或
- `flownana-liangchusan.vercel.app`

**记录这个域名，下一步需要用到！**

---

## ⚠️ 重要提醒

1. **不要跳过环境变量配置**，否则网站无法正常运行
2. **记住你的 Vercel 域名**，下一步配置 Google OAuth 需要用到
3. **部署完成后告诉我域名**，我会帮你完成后续配置

---

## 🎯 完成后告诉我

部署完成后，告诉我：
- ✅ "已部署到 Vercel"
- 你的 Vercel 域名（如：`flownana.vercel.app`）

然后我们继续配置 Google OAuth 和更新环境变量！


