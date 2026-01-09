# 🚀 如何重新开始项目

## 📍 项目位置

你的项目存储在：
```
/Users/liangchusan/flownana
```

这是一个本地文件夹，即使关闭 Cursor，项目文件仍然在你的电脑上。

---

## 🔄 重新开始工作的步骤

### 方式 1：在 Cursor 中打开项目

1. **打开 Cursor**
2. **打开项目：**
   - 方法 A：File → Open Folder → 选择 `/Users/liangchusan/flownana`
   - 方法 B：在终端执行：`cd /Users/liangchusan/flownana && cursor .`
   - 方法 C：直接拖拽文件夹到 Cursor 窗口

### 方式 2：在终端中操作

1. **打开终端（Terminal）**
2. **进入项目目录：**
   ```bash
   cd /Users/liangchusan/flownana
   ```
3. **查看项目文件：**
   ```bash
   ls
   ```

---

## 💻 本地开发

### 启动开发服务器

1. **打开终端**
2. **进入项目目录：**
   ```bash
   cd /Users/liangchusan/flownana
   ```
3. **启动开发服务器：**
   ```bash
   # 如果需要代理（使用 ClashX）
   export HTTP_PROXY=http://127.0.0.1:7890
   export HTTPS_PROXY=http://127.0.0.1:7890
   npm run dev
   ```
   
   或者使用启动脚本：
   ```bash
   ./start-dev.sh
   ```
4. **访问：** `http://localhost:3000`

---

## 📂 项目结构

```
/Users/liangchusan/flownana/
├── app/                    # Next.js 应用代码
├── components/             # React 组件
├── lib/                   # 工具函数
├── public/                # 静态资源
├── .env                   # 环境变量（本地开发用）
├── package.json           # 项目依赖
├── next.config.js         # Next.js 配置
└── README.md             # 项目说明
```

---

## 🔐 重要文件

### 环境变量文件

- **本地开发：** `.env`（在项目根目录）
- **生产环境：** Vercel → Settings → Environment Variables

### 配置文件

- **Next.js 配置：** `next.config.js`
- **TypeScript 配置：** `tsconfig.json`
- **Tailwind 配置：** `tailwind.config.ts`

---

## 🌐 线上网站

- **生产环境：** `https://www.flownana.com`
- **管理平台：** https://vercel.com
- **代码仓库：** https://github.com/liangchusan/Flownana

---

## 📝 常用命令

### 开发相关

```bash
# 进入项目目录
cd /Users/liangchusan/flownana

# 安装依赖（如果还没有）
npm install

# 启动开发服务器
npm run dev

# 构建生产版本
npm run build

# 启动生产服务器
npm start
```

### Git 相关

```bash
# 查看状态
git status

# 查看提交历史
git log --oneline

# 推送代码到 GitHub
git push origin main

# 拉取最新代码
git pull origin main
```

---

## 🎯 快速开始清单

下次重新开始时：

1. ✅ **打开 Cursor**
2. ✅ **打开项目文件夹：** `/Users/liangchusan/flownana`
3. ✅ **打开终端**（在 Cursor 中按 `` Ctrl+` `` 或 `Cmd+`）
4. ✅ **启动开发服务器：**
   ```bash
   cd /Users/liangchusan/flownana
   npm run dev
   ```
5. ✅ **访问：** `http://localhost:3000`

---

## 💡 提示

### 如果忘记项目位置

在终端执行：
```bash
find ~ -name "flownana" -type d 2>/dev/null
```

### 如果项目文件找不到

检查：
1. 项目是否在 `/Users/liangchusan/flownana`
2. 或者使用 Finder 搜索 "flownana"

### 如果依赖丢失

重新安装：
```bash
cd /Users/liangchusan/flownana
npm install
```

---

## 📞 需要帮助？

如果遇到问题：
1. 检查项目路径是否正确
2. 确认 Node.js 已安装：`node --version`
3. 确认依赖已安装：`npm install`

现在你知道项目在哪里了！下次直接打开这个文件夹就可以继续开发了。


