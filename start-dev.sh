#!/bin/bash

# 设置代理（ClashX 默认端口是 7890，如果不是请修改）
export HTTP_PROXY=http://127.0.0.1:7890
export HTTPS_PROXY=http://127.0.0.1:7890

# 进入项目目录
cd /Users/liangchusan/flownana

# 测试代理是否生效
echo "🔍 测试代理连接..."
if curl -I --connect-timeout 5 https://accounts.google.com > /dev/null 2>&1; then
    echo "✅ 代理连接成功！"
else
    echo "⚠️  代理连接失败，但继续启动服务器..."
fi

# 启动开发服务器
echo "🚀 启动开发服务器..."
npm run dev

