# 网络问题排查指南

## 问题现象
- Google OAuth 登录请求超时（30 秒）
- 错误：`OAuthSignin`
- 网络请求耗时 30.02 秒后失败

## 原因分析
这是网络连接问题，无法正常访问 Google OAuth 服务器。

## 解决方案

### 方案 1：配置代理（如果有代理）

如果你有 HTTP/HTTPS 代理，可以在启动服务器时设置：

```bash
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port
npm run dev
```

或者创建一个启动脚本 `start-with-proxy.sh`：

```bash
#!/bin/bash
export HTTP_PROXY=http://your-proxy:port
export HTTPS_PROXY=http://your-proxy:port
npm run dev
```

### 方案 2：测试网络连接

在终端运行以下命令测试是否能访问 Google：

```bash
# 测试 Google OAuth 服务器
curl -I https://accounts.google.com

# 测试 Google OAuth2 端点
curl -I https://oauth2.googleapis.com/token
```

如果这些命令超时或失败，说明网络确实无法访问 Google 服务。

### 方案 3：暂时跳过登录功能

由于图像生成功能已经不需要登录，你可以：
1. 先专注于测试图像生成功能
2. 登录功能等网络问题解决后再测试

### 方案 4：使用其他 OAuth 提供商

如果 Google OAuth 无法使用，可以考虑：
- GitHub OAuth（通常更稳定）
- 邮箱密码登录
- 其他 OAuth 提供商

## 当前状态

✅ **图像生成功能** - 已集成 Nano Banana API，无需登录即可使用
✅ **项目结构** - 完整，所有文件都已就绪
⚠️ **Google 登录** - 受网络限制，需要代理或网络环境改善

## 建议

1. **优先测试图像生成功能** - 这是核心功能，已经可以正常使用
2. **登录功能可以稍后处理** - 等网络问题解决后再测试
3. **如果必须使用登录** - 考虑配置代理或使用其他 OAuth 提供商


