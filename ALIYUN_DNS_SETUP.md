# 🌐 阿里云 DNS 配置指南

## 📋 当前状态

- ✅ Vercel 默认域名：`flownana.vercel.app`（已可用）
- ⏳ 自定义域名：`flownana.com`（需要配置 DNS）

## 🎯 第一步：先用默认域名测试

在配置自定义域名之前，先用 Vercel 默认域名测试：

1. **访问：** `https://flownana.vercel.app`
2. **确认网站能正常访问**
3. **测试登录和图像生成功能**

如果默认域名工作正常，再配置自定义域名。

---

## 📝 第二步：在 Vercel 获取 DNS 配置信息

1. **在 Vercel 项目页面：**
   - Settings → Domains
   - 找到 `flownana.com`
   - 点击 "Edit" 或查看详情
   - Vercel 会显示需要配置的 DNS 记录

2. **记录 DNS 配置信息：**
   - 通常需要配置：
     - **A 记录** 或 **CNAME 记录**
     - **目标值**（Vercel 提供的 IP 或域名）

---

## 🔧 第三步：在阿里云配置 DNS

### 步骤 1：登录阿里云控制台

1. 访问：https://dns.console.aliyun.com/
2. 登录你的阿里云账号

### 步骤 2：找到域名解析

1. 在左侧菜单找到 **"域名"** → **"域名解析"**
2. 或者直接访问：https://dns.console.aliyun.com/#/dns/domainList

### 步骤 3：选择域名

1. 在域名列表中找到 `flownana.com`
2. 点击 **"解析设置"** 或 **"解析"**

### 步骤 4：添加 DNS 记录

根据 Vercel 提供的配置，添加记录：

#### 如果 Vercel 要求添加 A 记录：

1. 点击 **"添加记录"**
2. 填写：
   - **记录类型：** `A`
   - **主机记录：** `@`（表示根域名，即 `flownana.com`）
   - **解析线路：** `默认`
   - **记录值：** Vercel 提供的 IP 地址（通常是 `76.76.21.21` 或类似）
   - **TTL：** `600`（或默认值）
3. 点击 **"确认"**

#### 如果 Vercel 要求添加 CNAME 记录（更常见）：

1. 点击 **"添加记录"**
2. 填写：
   - **记录类型：** `CNAME`
   - **主机记录：** `@`（表示根域名）
   - **解析线路：** `默认`
   - **记录值：** Vercel 提供的 CNAME 值（通常是 `cname.vercel-dns.com.` 或类似）
   - **TTL：** `600`（或默认值）
3. 点击 **"确认"**

#### 如果还需要 www 子域名：

1. 再添加一条记录：
   - **记录类型：** `CNAME`
   - **主机记录：** `www`
   - **解析线路：** `默认`
   - **记录值：** 与上面相同的 CNAME 值
   - **TTL：** `600`
2. 点击 **"确认"**

---

## ⏱️ 第四步：等待 DNS 生效

1. **DNS 生效时间：**
   - 通常需要 **10-30 分钟**
   - 最长可能需要 **24 小时**

2. **检查 DNS 是否生效：**
   - 可以使用在线工具：https://dnschecker.org/
   - 输入 `flownana.com`，查看全球 DNS 解析情况

---

## ✅ 第五步：在 Vercel 验证域名

1. **DNS 生效后，回到 Vercel：**
   - Settings → Domains
   - 找到 `flownana.com`
   - Vercel 会自动检测 DNS 配置
   - 状态会从 "Pending" 变为 "Valid Configuration"

2. **如果显示错误：**
   - 检查 DNS 记录是否正确
   - 确认 TTL 时间已过
   - 可以点击 "Refresh" 刷新状态

---

## 🔄 第六步：更新配置

DNS 生效后，更新配置：

1. **更新 Vercel 环境变量：**
   - Settings → Environment Variables
   - 编辑 `NEXTAUTH_URL`
   - 改为：`https://flownana.com`

2. **更新 Google OAuth：**
   - Google Cloud Console → OAuth 2.0 客户端 ID
   - 添加重定向 URI：`https://flownana.com/api/auth/callback/google`

3. **重新部署：**
   - 在 Vercel 中重新部署使配置生效

---

## 🆘 常见问题

### Q: 不知道 Vercel 要求什么类型的记录？

A: 在 Vercel → Settings → Domains → 点击 `flownana.com`，会显示具体的配置要求。

### Q: 添加记录后多久生效？

A: 通常 10-30 分钟，最长 24 小时。

### Q: 如何确认 DNS 是否生效？

A: 使用 https://dnschecker.org/ 检查，或直接在浏览器访问 `https://flownana.com`。

---

## 📝 需要的信息

**请告诉我：**

1. **在 Vercel → Settings → Domains → 点击 `flownana.com`，显示了什么配置要求？**
   - 是 A 记录还是 CNAME 记录？
   - 记录值是什么？

2. **或者，先告诉我：**
   - 你现在能否访问 `https://flownana.vercel.app`？
   - 如果能访问，我们可以先用这个域名测试

告诉我这些信息，我会给你更精确的配置步骤！


