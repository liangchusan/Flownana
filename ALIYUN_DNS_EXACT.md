# 📝 阿里云 DNS 精确配置步骤

## 🎯 需要添加的 DNS 记录

根据 Vercel 的要求，需要添加 **2 条记录**：

### 记录 1：根域名 A 记录
- **用途：** 让 `flownana.com` 指向 Vercel
- **记录类型：** A
- **主机记录：** `@`
- **记录值：** `216.198.79.1`

### 记录 2：www 子域名 CNAME 记录
- **用途：** 让 `www.flownana.com` 指向 Vercel
- **记录类型：** CNAME
- **主机记录：** `www`
- **记录值：** `f9b6a5d8cb713df7.vercel-dns-017.com.`

---

## 🔧 详细配置步骤

### 步骤 1：登录阿里云 DNS 控制台

1. 访问：https://dns.console.aliyun.com/
2. 登录你的阿里云账号

### 步骤 2：进入域名解析

1. 左侧菜单：**"域名"** → **"域名解析"**
2. 或直接访问：https://dns.console.aliyun.com/#/dns/domainList
3. 在域名列表中找到 `flownana.com`
4. 点击 **"解析设置"** 或 **"解析"**

### 步骤 3：添加第一条记录（A 记录）

1. 点击 **"添加记录"** 按钮
2. 填写以下信息：
   - **记录类型：** 选择 `A`
   - **主机记录：** 填写 `@`（表示根域名）
   - **解析线路：** 选择 `默认`
   - **记录值：** 填写 `216.198.79.1`
   - **TTL：** `600`（或保持默认值 `10分钟`）
3. 点击 **"确认"** 保存

### 步骤 4：添加第二条记录（CNAME 记录）

1. 再次点击 **"添加记录"** 按钮
2. 填写以下信息：
   - **记录类型：** 选择 `CNAME`
   - **主机记录：** 填写 `www`
   - **解析线路：** 选择 `默认`
   - **记录值：** 填写 `f9b6a5d8cb713df7.vercel-dns-017.com.`（注意末尾有个点）
   - **TTL：** `600`（或保持默认值 `10分钟`）
3. 点击 **"确认"** 保存

---

## ✅ 配置完成后的检查

### 在阿里云检查：

1. 回到域名解析列表
2. 应该能看到两条记录：
   - `@` A 记录 → `216.198.79.1`
   - `www` CNAME 记录 → `f9b6a5d8cb713df7.vercel-dns-017.com.`

### 在 Vercel 检查：

1. 等待 5-10 分钟（DNS 传播需要时间）
2. 在 Vercel → Settings → Domains
3. 找到 `flownana.com`
4. 点击 **"Refresh"** 刷新状态
5. 状态应该从 "Invalid Configuration" 变为 "Valid Configuration"

---

## ⏱️ DNS 生效时间

- **通常：** 10-30 分钟
- **最长：** 24 小时

### 如何检查 DNS 是否生效：

1. **使用在线工具：**
   - 访问：https://dnschecker.org/
   - 输入 `flownana.com`
   - 选择记录类型 `A`
   - 查看全球 DNS 解析情况
   - 如果大部分地区显示 `216.198.79.1`，说明已生效

2. **直接访问：**
   - 在浏览器访问 `https://flownana.com`
   - 如果能正常打开，说明 DNS 已生效

---

## 🔄 DNS 生效后更新配置

DNS 生效后，需要更新：

1. **Vercel 环境变量：**
   - Settings → Environment Variables
   - 编辑 `NEXTAUTH_URL`
   - 改为：`https://flownana.com`

2. **Google OAuth：**
   - Google Cloud Console → OAuth 2.0 客户端 ID
   - 添加重定向 URI：`https://flownana.com/api/auth/callback/google`

3. **重新部署：**
   - 在 Vercel 中重新部署使配置生效

---

## 📋 配置清单

- [ ] 在阿里云添加 A 记录：`@` → `216.198.79.1`
- [ ] 在阿里云添加 CNAME 记录：`www` → `f9b6a5d8cb713df7.vercel-dns-017.com.`
- [ ] 等待 10-30 分钟
- [ ] 在 Vercel 刷新域名状态
- [ ] 确认状态变为 "Valid Configuration"
- [ ] 更新 `NEXTAUTH_URL` 环境变量
- [ ] 更新 Google OAuth 重定向 URI
- [ ] 重新部署

---

## 🆘 如果遇到问题

### 问题 1：添加记录后还是显示 "Invalid Configuration"

- 等待更长时间（最多 24 小时）
- 确认记录值完全正确（包括末尾的点）
- 在 Vercel 点击 "Refresh" 刷新

### 问题 2：不知道如何填写主机记录

- `@` 表示根域名（`flownana.com`）
- `www` 表示 www 子域名（`www.flownana.com`）

### 问题 3：记录值末尾的点

- CNAME 记录值末尾的点（`.`）是必需的
- 确保填写：`f9b6a5d8cb713df7.vercel-dns-017.com.`（有末尾点）

---

现在去阿里云添加这两条记录吧！完成后告诉我，我会帮你检查配置。


