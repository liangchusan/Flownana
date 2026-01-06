# 项目启动检查清单

## ✅ 已完成的步骤

1. ✅ 核心 API 文件已创建
   - `/app/api/auth/[...nextauth]/route.ts` - NextAuth 认证
   - `/app/api/generate/route.ts` - 图像生成 API

2. ✅ 项目结构完整
   - 首页、生成页面、组件都已就绪

## 🚀 启动步骤

### 1. 确认依赖已安装

```bash
cd /Users/liangchusan/flownana
npm install
```

### 2. 创建 `.env` 文件

在项目根目录创建 `.env` 文件，内容如下：

```env
NEXTAUTH_URL=http://localhost:3000
NEXTAUTH_SECRET=KQfxG5mPS0JVnoc3ZUCdQutrG+eTINwn1cXM1Cr8HC0=
GOOGLE_CLIENT_ID=1066688258748-gvkjh4bnhv62i4eq988kokdts0c9kind.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=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
NANO_BANANA_API_KEY=0b480ce64ee7db3a80a2cc70b5face27
```

**注意：** `.env` 文件应该在项目根目录 `/Users/liangchusan/flownana/.env`

### 3. 启动开发服务器

```bash
npm run dev
```

### 4. 验证启动成功

启动后，你应该看到：

```
✓ Ready in X seconds
○ Local:        http://localhost:3000
```

### 5. 检查终端输出

启动时，终端应该会显示：

```
NextAuth 配置检查:
- NEXTAUTH_URL: http://localhost:3000
- NEXTAUTH_SECRET: ✅ 已设置
- GOOGLE_CLIENT_ID: ✅ 已设置 (1066688258748-gvkjh...)
- GOOGLE_CLIENT_SECRET: ✅ 已设置
```

如果看到 `❌ 未设置`，说明 `.env` 文件没有正确加载。

### 6. 访问网站

打开浏览器访问：http://localhost:3000

## 🔍 功能测试

### 测试首页
- ✅ 访问 http://localhost:3000
- ✅ 查看落地页的各个模块

### 测试图像生成（无需登录）
- ✅ 访问 http://localhost:3000/generate
- ✅ 输入提示词并生成图像
- ✅ 查看生成的图片

### 测试 Google 登录
- ✅ 点击右上角"登录"按钮
- ✅ 使用 Google 账户登录
- ✅ 登录后显示头像和名字

## ❌ 常见问题

### 问题：端口 3000 已被占用

**解决：** 修改 `package.json` 中的 dev 脚本：
```json
"dev": "next dev -p 3001"
```

### 问题：环境变量未加载

**解决：**
1. 确认 `.env` 文件在项目根目录
2. 确认文件名是 `.env`（不是 `.env.txt`）
3. 重启开发服务器

### 问题：Google 登录报错 `OAuthSignin`

**解决：**
1. 检查 Google Cloud Console 中的重定向 URI 是否包含：
   ```
   http://localhost:3000/api/auth/callback/google
   ```
2. 确认 `.env` 中的 `GOOGLE_CLIENT_ID` 和 `GOOGLE_CLIENT_SECRET` 正确
3. 重启开发服务器

### 问题：图像生成失败

**解决：**
1. 检查 `.env` 中的 `NANO_BANANA_API_KEY` 是否正确
2. 查看终端控制台的错误信息
3. 确认网络连接正常

## 📝 下一步

项目启动成功后，你可以：
- 测试图像生成功能
- 测试 Google 登录功能
- 根据需要调整 UI 和功能


