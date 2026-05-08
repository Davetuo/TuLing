## ADDED Requirements

### Requirement: One-click setup script
系统 SHALL 提供 `scripts/setup.sh`（Bash）和 `scripts/setup.ps1`（PowerShell），用于在新设备上完成从零到可启动的完整环境初始化。

#### Scenario: First-time setup on clean machine
- **WHEN** 用户克隆仓库后在项目根目录执行 `bash scripts/setup.sh`（或 PowerShell `.\scripts\setup.ps1`）
- **THEN** 脚本检查 Node.js >= 20 和 Docker 是否可用
- **AND** 在 `server/` 和 `client/` 分别执行 `npm install`
- **AND** 若 `server/.env` 不存在，从 `.env.example` 复制并提示用户修改密钥
- **AND** 执行 `npx prisma generate` 和 `npx prisma migrate dev` 初始化数据库表结构

#### Scenario: Re-running setup on already-initialized device
- **WHEN** 用户在已初始化的设备上再次执行 setup 脚本
- **THEN** `npm install` 安全通过（npm 自己的幂等性）
- **AND** 若 `.env` 已存在则跳过生成，不覆盖已有配置
- **AND** prisma migrate 安全通过（已是最新迁移时跳过）

#### Scenario: Missing prerequisite
- **WHEN** 执行 setup 脚本时 Node.js 未安装或版本低于 20
- **THEN** 脚本输出明确的错误提示，告知需要安装 Node.js >= 20
- **AND** 以非零退出码终止

### Requirement: One-click start script
系统 SHALL 提供 `scripts/start.sh`（Bash）和 `scripts/start.ps1`（PowerShell），用于一键启动项目的所有服务。

#### Scenario: Start all services from scratch
- **WHEN** 用户在项目根目录执行 `bash scripts/start.sh`（或 PowerShell `.\scripts\start.ps1`）
- **THEN** 若 Docker 容器未运行，执行 `docker compose up -d` 启动 PostgreSQL + Redis
- **AND** 等待 PostgreSQL 端口（5432）和 Redis 端口（6379）就绪
- **AND** 在后台启动 NestJS 后端（`cd server && npm run start:dev`）
- **AND** 在后台启动 Vite 前端（`cd client && npm run dev`）
- **AND** 后端可通过 `http://localhost:3000` 访问
- **AND** 前端可通过 `http://localhost:5173` 访问

#### Scenario: Docker containers already running
- **WHEN** 执行 start 脚本时 PostgreSQL 和 Redis 容器已在运行
- **THEN** 跳过 Docker 启动步骤，直接启动后端和前端

#### Scenario: Port conflict detected
- **WHEN** 执行 start 脚本时默认端口（3000 或 5173）已被占用
- **THEN** 脚本在启动前检测端口，输出明确提示信息告知用户哪个端口被占用

#### Scenario: Stop all services with Ctrl+C
- **WHEN** 用户在 start 脚本运行期间按下 Ctrl+C
- **THEN** 脚本捕获 SIGINT 信号，自动终止所有后台启动的 server/client 进程
- **AND** Docker 容器保持运行（不自动停止，方便下次快速启动）

### Requirement: One-click stop script
系统 SHALL 提供 `scripts/stop.sh`（Bash）和 `scripts/stop.ps1`（PowerShell），用于停止所有运行中的服务而不删除任何数据。

#### Scenario: Stop all running services
- **WHEN** 用户在项目根目录执行 `bash scripts/stop.sh`（或 PowerShell `.\scripts\stop.ps1`）
- **THEN** 终止所有由 start 脚本启动的 server/client 后台进程
- **AND** 执行 `docker compose down`（不带 `-v`）停止 PostgreSQL + Redis 容器
- **AND** 数据库数据、`node_modules/`、`.env` 配置完整保留
- **AND** 下次执行 `bash scripts/start.sh` 可直接恢复运行

#### Scenario: Stop when no services are running
- **WHEN** 执行 stop 脚本时没有运行中的 server/client 进程且 Docker 容器未运行
- **THEN** 脚本输出提示：所有服务已处于停止状态
- **AND** 正常退出（零退出码）

### Requirement: One-click cleanup script
系统 SHALL 提供 `scripts/cleanup.sh`（Bash）和 `scripts/cleanup.ps1`（PowerShell），用于一键清理开发环境到初始状态。

#### Scenario: Full cleanup
- **WHEN** 用户在项目根目录执行 `bash scripts/cleanup.sh`（或 PowerShell `.\scripts\cleanup.ps1`）
- **THEN** 停止所有运行中的 server/client 进程
- **AND** 执行 `docker compose down -v` 停止并删除 PostgreSQL + Redis 容器及数据卷
- **AND** 删除 `server/node_modules/`、`client/node_modules/`、`server/dist/`、`*.tsbuildinfo`

#### Scenario: Cleanup confirmation prompt
- **WHEN** 用户执行 cleanup 脚本
- **THEN** 脚本显示将要删除的内容摘要并要求用户确认（输入 yes 或按 Ctrl+C 取消）
- **AND** 仅在用户确认后执行清理操作

### Requirement: Cross-platform support
部署脚本 SHALL 同时提供 Bash 版本（macOS/Linux）、PowerShell 版本（Windows）和 CMD 批处理版本（Windows），覆盖三大操作系统。

#### Scenario: macOS/Linux user runs Bash scripts
- **WHEN** 用户在 macOS 或 Linux 终端执行 `bash scripts/setup.sh`、`bash scripts/start.sh`、`bash scripts/stop.sh`、`bash scripts/cleanup.sh`
- **THEN** 脚本正常执行，所有功能可用

#### Scenario: Windows user runs PowerShell scripts
- **WHEN** 用户在 Windows PowerShell 执行 `.\scripts\setup.ps1`、`.\scripts\start.ps1`、`.\scripts\stop.ps1`、`.\scripts\cleanup.ps1`
- **THEN** 脚本正常执行，所有功能可用

#### Scenario: Windows user runs CMD batch scripts
- **WHEN** 用户在 Windows 命令提示符 (CMD) 执行 `scripts\setup.bat`、`scripts\start.bat`、`scripts\stop.bat`、`scripts\cleanup.bat`
- **THEN** 脚本正常执行，所有功能可用

### Requirement: README quick-start update
项目的 README.md 快速开始章节 SHALL 指引用户使用一键脚本而非手动多步操作。

#### Scenario: User reads quick-start guide
- **WHEN** 用户打开 README.md 查看快速开始章节
- **THEN** 文档展示一键脚本用法（`bash scripts/setup.sh && bash scripts/start.sh`）
- **AND** 同时保留手动步骤作为备选方案
