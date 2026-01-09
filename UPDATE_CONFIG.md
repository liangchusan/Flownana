# 🔄 更新配置使网站完全正常工作

## ✅ 已完成
- [x] DNS 配置完成
- [x] 网站可以访问：`https://flownana.com`

## 📋 现在需要更新配置（3 步）

### 步骤 1：更新 Vercel 环境变量

1. **在 Vercel 项目页面：**
   - 点击 "Settings"（设置）
   - 点击 "Environment Variables"（环境变量）
   - 找到 `NEXTAUTH_URL`
   - 点击编辑（或删除后重新添加）
   - 将值改为：`https://flownana.com`
   - **重要：** 确保选择了所有环境（Production, Preview, Development）
   - 点击 "Save" 保存

### 步骤 2：更新 Google OAuth 重定向 URI

1. **访问 Google Cloud Console：**
   - https://console.cloud.google.com/
   - 进入 **API 和凭据** → **OAuth 2.0 客户端 ID**
   - 找到你的 OAuth 客户端，点击编辑

2. **添加生产环境重定向 URI：**
   - 在 "已授权的重定向 URI" 部分
   - 检查是否已有：`https://flownana.com/api/auth/callback/google`
   - 如果没有，点击 "添加 URI"
   - 输入：`https://flownana.com/api/auth/callback/google`
   - 点击 "保存"

### 步骤 3：重新部署使配置生效

1. **在 Vercel 项目页面：**
   - 点击 "Deployments" 标签
   - 找到最新的部署
   - 点击右侧 "..." 菜单
   - 选择 "Redeploy"
   - 确认重新部署
   - 等待部署完成（通常 2-5 分钟）

---

## ✅ 配置完成后测试

### 测试 1：登录功能

1. **访问：** `https://flownana.com`
2. **点击右上角 "登录" 按钮**
3. **选择 "Sign in with Google"**
4. **确认：**
   - ✅ 能跳转到 Google 登录页面
   - ✅ 登录后能返回网站
   - ✅ 右上角显示你的 Google 头像和名字
   - ✅ "登录" 按钮变成 "退出" 按钮

### 测试 2：图像生成功能

1. **访问：** `https://flownana.com/generate`
2. **输入提示词**（例如：`a beautiful sunset over the ocean`）
3. **点击 "生成图像"**
4. **确认：**
   - ✅ 显示加载状态
   - ✅ 能成功生成图像
   - ✅ 图像能正常显示
   - ✅ 可以下载图像

---

## 🎯 现在请做

1. **更新 Vercel 环境变量** `NEXTAUTH_URL` 为 `https://flownana.com`
2. **更新 Google OAuth 重定向 URI** 为 `https://flownana.com/api/auth/callback/google`
3. **重新部署**
4. **测试登录和图像生成功能**

完成后告诉我测试结果！


