# 🔐 GitHub 推送认证指南

## 问题
推送代码到 GitHub 需要身份验证。

## 解决方案（选择一种）

### 方案 1：使用 Personal Access Token（推荐，最简单）

1. **创建 Token：**
   - 访问：https://github.com/settings/tokens
   - 点击 "Generate new token" → "Generate new token (classic)"
   - Note: 填写 `Flownana Deploy`
   - Expiration: 选择 `90 days` 或 `No expiration`
   - 勾选权限：`repo`（全部权限）
   - 点击 "Generate token"
   - **复制生成的 Token**（只显示一次！）

2. **使用 Token 推送：**
   
   在终端执行（替换 YOUR_TOKEN 为你的实际 Token）：
   ```bash
   cd /Users/liangchusan/flownana
   git remote set-url origin https://YOUR_TOKEN@github.com/liangchusan/Flownana.git
   git push -u origin main
   ```
   
   或者直接在执行时输入：
   ```bash
   git push -u origin main
   ```
   当提示输入用户名时：输入 `liangchusan`
   当提示输入密码时：**粘贴你的 Token**（不是密码！）

### 方案 2：配置 SSH（一次配置，永久使用）

1. **检查是否已有 SSH key：**
   ```bash
   ls -al ~/.ssh
   ```
   
2. **如果没有，生成新的 SSH key：**
   ```bash
   ssh-keygen -t ed25519 -C "your_email@example.com"
   # 按 Enter 使用默认路径
   # 可以设置密码或直接 Enter
   ```

3. **复制公钥：**
   ```bash
   cat ~/.ssh/id_ed25519.pub
   # 复制输出的内容
   ```

4. **添加到 GitHub：**
   - 访问：https://github.com/settings/keys
   - 点击 "New SSH key"
   - Title: `MacBook M4`
   - Key: 粘贴刚才复制的公钥
   - 点击 "Add SSH key"

5. **修改远程地址为 SSH：**
   ```bash
   cd /Users/liangchusan/flownana
   git remote set-url origin git@github.com:liangchusan/Flownana.git
   git push -u origin main
   ```

---

## 🎯 推荐

**如果你想要快速完成，使用方案 1（Personal Access Token）**

**如果你想要长期使用，使用方案 2（SSH）**

---

## ✅ 推送成功后

告诉我 "已推送到 GitHub"，我们继续下一步：部署到 Vercel！


