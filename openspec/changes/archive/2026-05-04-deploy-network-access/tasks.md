## 1. 后端 CORS 动态配置

- [x] 1.1 在 `server/.env.example` 和 `server/.env` 中添加 `CORS_ORIGINS` 环境变量，默认值 `http://localhost:5173`
- [x] 1.2 修改 `server/src/main.ts`：从 `CORS_ORIGINS` 环境变量读取允许的来源列表（逗号分隔），传给 `@fastify/cors`

## 2. 前端 Vite 网络绑定

- [x] 2.1 修改 `client/vite.config.ts`：`server.host` 设置为 `'0.0.0.0'`

## 3. 后端生产模式静态文件托管

- [x] 3.1 安装 `@fastify/static` 依赖
- [x] 3.2 修改 `server/src/main.ts`：检测 `NODE_ENV === 'production'` 时，注册 `@fastify/static` 托管 `client/dist/` 目录

## 4. 启动脚本更新（开发模式）

- [x] 4.1 更新 `scripts/start.sh`：获取并打印局域网 IP 地址（Bash: `hostname -I` 或 `ip route`）
- [x] 4.2 更新 `scripts/start.ps1`：获取并打印局域网 IP 地址（PowerShell: `Get-NetIPAddress`）
- [x] 4.3 更新 `scripts/start.bat`：获取并打印局域网 IP 地址（CMD: `ipconfig` + findstr）

## 5. 生产模式启动脚本

- [x] 5.1 创建 `scripts/start-prod.sh`：构建前端 + 以生产模式启动 NestJS（Bash）
- [x] 5.2 创建 `scripts/start-prod.ps1`：构建前端 + 以生产模式启动 NestJS（PowerShell）
- [x] 5.3 创建 `scripts/start-prod.bat`：构建前端 + 以生产模式启动 NestJS（CMD）

## 6. 验证测试

- [x] 6.1 开发模式：验证 `npm run dev` 绑定 `0.0.0.0`，其他设备可访问前端
- [x] 6.2 生产模式：验证 `start-prod` 脚本，其他设备可通过 `http://<IP>:3000` 访问完整应用
