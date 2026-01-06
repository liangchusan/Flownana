# Nano Banana - AI 图像生成与编辑平台

一个基于 Next.js 的现代化 AI 图像生成和编辑平台，使用 Nano Banana 技术。

## 功能特性

- 🎨 **文本生成图像** - 使用自然语言描述生成图像
- ✏️ **图像编辑** - 通过文本描述编辑现有图像
- 🔐 **Google OAuth 登录** - 快速安全的身份验证
- 📱 **响应式设计** - 完美适配各种设备
- 🎯 **现代化 UI** - 美观易用的用户界面

## 技术栈

- **框架**: Next.js 14 (App Router)
- **语言**: TypeScript
- **样式**: Tailwind CSS
- **认证**: NextAuth.js
- **图标**: Lucide React
- **动画**: Framer Motion

## 开始使用

### 1. 安装依赖

```bash
npm install
```

### 2. 配置环境变量

复制 `.env.example` 文件为 `.env` 并填写以下配置：

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=your-secret-key-here
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
NANO_BANANA_API_KEY=your-nano-banana-api-key
```

`NANO_BANANA_API_KEY` 可在 [Nano Banana API Key 管理页面](https://kie.ai/api-key) 获取，用于调用 `https://api.kie.ai/api/v1/jobs/createTask` 和 `recordInfo` 接口。

### 3. 设置 Google OAuth

1. 访问 [Google Cloud Console](https://console.cloud.google.com/)
2. 创建新项目或选择现有项目
3. 启用 Google+ API
4. 创建 OAuth 2.0 客户端 ID
5. 添加授权重定向 URI: `http://localhost:3000/api/auth/callback/google`
6. 将客户端 ID 和密钥复制到 `.env` 文件

### 4. 运行开发服务器

```bash
npm run dev
```

打开 [http://localhost:3000](http://localhost:3000) 查看网站。

## 项目结构

```
flownana/
├── app/                    # Next.js App Router
│   ├── api/               # API 路由
│   │   ├── auth/          # NextAuth 认证
│   │   └── generate/      # 图像生成 API
│   ├── generate/          # 图像生成页面
│   ├── layout.tsx         # 根布局
│   ├── page.tsx           # 首页
│   └── globals.css        # 全局样式
├── components/             # React 组件
│   ├── auth/              # 认证相关组件
│   ├── generate/          # 生成相关组件
│   ├── layout/            # 布局组件
│   ├── sections/          # 页面区块组件
│   └── ui/                # UI 基础组件
├── lib/                   # 工具函数
└── public/                # 静态资源
```

## 主要页面

- **首页** (`/`) - Nano Banana 产品介绍和功能展示
- **生成页面** (`/generate`) - AI 图像生成和编辑功能

## API 集成

当前图像生成 API (`/api/generate`) 已集成 Nano Banana 官方接口：

- 创建任务：`POST https://api.kie.ai/api/v1/jobs/createTask`
- 查询任务：`GET https://api.kie.ai/api/v1/jobs/recordInfo?taskId=...`

流程说明：

1. 前端调用 `/api/generate`，传入 `prompt`、`aspectRatio` 等参数
2. 后端使用 `NANO_BANANA_API_KEY` 调用 `createTask` 创建任务并获取 `taskId`
3. 后端在单次请求内轮询 `recordInfo`，直到任务 `state` 为 `success` 或超时
4. 当任务成功时，从 `resultJson.resultUrls[0]` 中取出最终图像 URL 返回前端

如需进一步扩展：

1. 接入 `callBackUrl` 做异步回调处理
2. 为不同用户增加配额 / 积分系统
3. 支持更多模型参数（如输出格式、更多尺寸等）

## 部署

### Vercel 部署

1. 将代码推送到 GitHub
2. 在 Vercel 中导入项目
3. 配置环境变量
4. 部署

### 其他平台

项目可以部署到任何支持 Next.js 的平台，如：
- Netlify
- AWS Amplify
- Railway
- 自托管服务器

## 开发注意事项

- 确保在生产环境中设置强密码的 `NEXTAUTH_SECRET`
- Google OAuth 重定向 URI 需要与部署域名匹配
- 图像生成 API 需要替换为真实的 Nano Banana API 端点

## 许可证

MIT License

## 联系方式

如有问题或建议，请通过 GitHub Issues 联系。

# Deployment ready
