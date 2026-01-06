# ClashX 配置指南 - 让 Node.js 走代理

## 问题
ClashX 的"全局代理"只对浏览器和系统应用生效，**对终端/Node.js 进程不生效**。

## 解决方案

### 方案 1：开启 ClashX TUN 模式（推荐）

1. 打开 ClashX
2. 点击菜单栏的 ClashX 图标
3. 选择 **"增强模式"** 或 **"TUN Mode"**（不同版本名称可能不同）
4. 如果提示需要管理员权限，点击"允许"
5. **重启终端**（关闭所有终端窗口，重新打开）
6. **重启开发服务器**：
   ```bash
   cd /Users/liangchusan/flownana
   npm run dev
   ```

### 方案 2：手动设置代理环境变量（如果 TUN 模式不可用）

在启动开发服务器时，手动设置代理：

```bash
cd /Users/liangchusan/flownana
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890
npm run dev
```

**注意**：必须在**同一个终端窗口**里先 `export` 再 `npm run dev`，这样 Node 进程才会继承代理设置。

### 方案 3：创建启动脚本（方便以后使用）

创建一个启动脚本 `start-dev.sh`：

```bash
#!/bin/bash
cd /Users/liangchusan/flownana
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890
npm run dev
```

然后：
```bash
chmod +x start-dev.sh
./start-dev.sh
```

## 验证代理是否生效

启动服务器后，在**另一个终端**运行：

```bash
curl -I --connect-timeout 5 https://accounts.google.com
```

如果返回 `HTTP/2 200` 或 `HTTP/2 302`，说明代理生效。

## 当前状态

✅ 项目代码和配置都正确
✅ 浏览器可以访问 Google
❌ Node.js 进程无法访问 Google（需要 TUN 模式或手动设置代理）

## 建议

**优先尝试方案 1（TUN 模式）**，这是最彻底的解决方案，一次配置，永久生效。

