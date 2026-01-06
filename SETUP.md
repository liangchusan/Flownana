# 快速启动指南

## 前置要求

- Node.js 18+ 
- npm 或 yarn
- Google Cloud Console 账户（用于 OAuth）

## 安装步骤

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

创建 `.env` 文件（参考 `.env.example`）：

```bash
cp .env.example .env
```

编辑 `.env` 文件，填入以下信息：

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-random-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

**生成 NEXTAUTH_SECRET：**
```bash
openssl rand -base64 32
```

### 3. 设置 Google OAuth

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 **Google+ API**
4. 转到 **凭据** > **创建凭据** > **OAuth 2.0 客户端 ID**
5. 应用类型选择 **Web 应用**
6. 添加授权重定向 URI：
   - 开发环境：`http://localhost:3000/api/auth/callback/google`
   - 生产环境：`https://yourdomain.com/api/auth/callback/google`
7. 复制 **客户端 ID** 和 **客户端密钥** 到 `.env` 文件

### 4. 启动开发服务器

```bash
npm run dev
```

访问 [http://localhost:3000](http://localhost:3000)

## 项目结构说明

```
flownana/
├── app/                      # Next.js App Router
│   ├── api/                 # API 路由
│   │   ├── auth/           # NextAuth 认证端点
│   │   └── generate/       # 图像生成 API
│   ├── generate/           # 图像生成页面
│   ├── layout.tsx          # 根布局
│   ├── page.tsx           # 首页（落地页）
│   └── globals.css        # 全局样式
├── components/            # React 组件
│   ├── auth/             # 认证相关
│   ├── generate/         # 生成功能
│   ├── layout/           # 布局组件
│   ├── sections/         # 页面区块
│   └── ui/               # UI 基础组件
├── lib/                  # 工具函数
└── types/                # TypeScript 类型定义
```

## 功能说明

### 已实现功能

✅ 落地介绍页（首页）
- 产品介绍
- 功能特性展示
- 使用示例
- 定价信息
- 用户评价
- 常见问题

✅ 图像生成页面
- 文本生成图像
- 图像编辑（图像到图像）
- 图像上传（拖放支持）
- 参数设置（分辨率、宽高比）
- 结果预览和下载

✅ Google OAuth 登录
- Google 账户登录
- 会话管理
- 用户信息显示

### 待集成功能

⚠️ 真实的 Nano Banana API
- 当前使用模拟数据
- 需要替换 `/app/api/generate/route.ts` 中的 API 调用
- 集成真实的图像生成服务

## 开发注意事项

1. **环境变量**：确保 `.env` 文件不被提交到 Git（已在 `.gitignore` 中）
2. **API 集成**：图像生成 API 目前返回模拟数据，需要替换为真实 API
3. **图片存储**：如需保存用户上传的图片，需要配置云存储（如 AWS S3、Cloudinary）
4. **数据库**：如需保存用户数据，可以集成 Prisma + PostgreSQL

## 部署

### Vercel 部署（推荐）

1. 将代码推送到 GitHub
2. 在 [Vercel](https://vercel.com) 导入项目
3. 配置环境变量
4. 部署完成

### 其他平台

项目可以部署到任何支持 Next.js 的平台：
- Netlify
- AWS Amplify  
- Railway
- 自托管服务器（使用 `npm run build` 和 `npm start`）

## 故障排除

### Google OAuth 不工作

- 检查重定向 URI 是否正确配置
- 确认客户端 ID 和密钥正确
- 检查环境变量是否正确加载

### 图像生成失败

- 检查 API 端点是否正确
- 查看浏览器控制台错误信息
- 确认网络连接正常

## 获取帮助

如有问题，请查看：
- [Next.js 文档](https://nextjs.org/docs)
- [NextAuth.js 文档](https://next-auth.js.org)
- [Tailwind CSS 文档](https://tailwindcss.com/docs)



