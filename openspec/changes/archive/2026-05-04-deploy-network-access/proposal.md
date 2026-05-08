## Why

项目当前仅支持 localhost 访问（前端 Vite 绑定 127.0.0.1，后端 CORS 仅允许 localhost:5173），无法从局域网其他设备访问服务。通过配置网络绑定和 CORS 策略，使用户可以通过网络 IP 在手机、平板等设备上访问和测试途灵服务，同时为后续生产部署奠定基础。

## What Changes

- 前端 Vite 绑定 `0.0.0.0`，允许来自任意网络接口的访问
- 后端 CORS 配置通过环境变量 `CORS_ORIGINS` 动态设置允许的来源，支持多域名（逗号分隔）
- 后端新增静态文件服务，在 production 模式下直接托管前端构建产物
- 新增 `scripts/start-prod.sh`（及 PS/CMD 版本）生产模式启动脚本，构建前端后由 NestJS 统一服务
- 启动脚本在控制台输出局域网 IP 地址，方便其他设备访问
- 更新 `.env.example` / `.env` 添加 CORS 和网络相关配置项

## Capabilities

### New Capabilities

- `network-deployment`: 配置服务网络绑定与 CORS 策略，使前后端可从局域网其他设备访问；支持开发模式（前后端分离）和生产模式（后端托管前端静态文件）

### Modified Capabilities

<!-- No existing specs to modify -->

## Impact

- 受影响文件：`server/src/main.ts`（CORS + 静态文件服务）、`client/vite.config.ts`（host 绑定）、`server/.env.example` + `server/.env`（新增 CORS 配置）、`scripts/` 目录（新增生产启动脚本、更新现有启动脚本输出网络 IP）
