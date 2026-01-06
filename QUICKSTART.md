# 快速开始指南

## 前置要求

在开始之前，请确保已安装：

1. **Node.js 18+** 和 **npm**
   - 检查安装：`node --version` 和 `npm --version`
   - 如果未安装，请访问 [nodejs.org](https://nodejs.org/) 下载安装

2. **Google Cloud Console 账户**（用于 OAuth 登录）

## 快速启动步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

编辑 `.env` 文件，填入以下信息：

#### 生成 NEXTAUTH_SECRET

```bash
openssl rand -base64 32
```

将生成的密钥复制到 `.env` 文件的 `NEXTAUTH_SECRET` 字段。

#### 设置 Google OAuth

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 **Google+ API**
4. 转到 **凭据** > **创建凭据** > **OAuth 2.0 客户端 ID**
5. 应用类型选择 **Web 应用**
6. 添加授权重定向 URI：
   ```
   http://localhost:3000/api/auth/callback/google
   ```
7. 复制 **客户端 ID** 和 **客户端密钥** 到 `.env` 文件

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 访问网站

打开浏览器访问：http://localhost:3000

## 功能测试

### 测试首页
- 访问 http://localhost:3000
- 查看落地页的各个模块

### 测试登录
- 点击右上角"登录"按钮
- 使用 Google 账户登录

### 测试图像生成
- 登录后访问 http://localhost:3000/generate
- 输入提示词并生成图像
- 注意：当前使用模拟数据，需要集成真实 API

## 常见问题

### Node.js 未找到

**macOS (使用 Homebrew):**
```bash
brew install node
```

**或使用 nvm:**
```bash
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.0/install.sh | bash
nvm install 18
nvm use 18
```

### 端口 3000 已被占用

修改 `package.json` 中的 dev 脚本：
```json
"dev": "next dev -p 3001"
```

### Google OAuth 错误

- 检查 `.env` 文件中的凭据是否正确
- 确认重定向 URI 已正确配置
- 检查 Google Cloud Console 中的 API 是否已启用

## 下一步

- 集成真实的 Nano Banana API（修改 `/app/api/generate/route.ts`）
- 添加数据库支持（如需要保存用户数据）
- 配置图片存储服务（如 AWS S3）

## 需要帮助？

查看详细文档：
- `README.md` - 项目说明
- `SETUP.md` - 详细设置指南



