## ADDED Requirements

### Requirement: 一键初始化脚本
系统 SHALL 提供 `scripts/setup.sh`（Bash）和 `scripts/setup.ps1`（PowerShell），用于在新设备上完成从零到可启动的完整环境初始化。

#### Scenario: 全新机器首次初始化
- **WHEN** 用户克隆仓库后在项目根目录执行 `bash scripts/setup.sh`（或 PowerShell `.\scripts\setup.ps1`）
- **THEN** 脚本检查 Node.js >= 20 和 Docker 是否可用
- **AND** 在 `server/` 和 `client/` 分别执行 `npm install`
- **AND** 若 `server/.env` 不存在，从 `.env.example` 复制并提示用户修改密钥
- **AND** 执行 `npx prisma generate` 和 `npx prisma migrate dev` 初始化数据库表结构

#### Scenario: 已初始化设备上重复执行初始化
- **WHEN** 用户在已初始化的设备上再次执行 setup 脚本
- **THEN** `npm install` 安全通过（npm 自己的幂等性）
- **AND** 若 `.env` 已存在则跳过生成，不覆盖已有配置
- **AND** prisma migrate 安全通过（已是最新迁移时跳过）

#### Scenario: 缺少前置依赖
- **WHEN** 执行 setup 脚本时 Node.js 未安装或版本低于 20
- **THEN** 脚本输出明确的错误提示，告知需要安装 Node.js >= 20
- **AND** 以非零退出码终止

### Requirement: 一键启动脚本
系统 SHALL 提供 `scripts/start.sh`（Bash）和 `scripts/start.ps1`（PowerShell），用于一键启动项目的所有服务。

#### Scenario: 从零启动所有服务
- **WHEN** 用户在项目根目录执行 `bash scripts/start.sh`（或 PowerShell `.\scripts\start.ps1`）
- **THEN** 若 Docker 容器未运行，执行 `docker compose up -d` 启动 PostgreSQL + Redis
- **AND** 等待 PostgreSQL 端口（5432）和 Redis 端口（6379）就绪
- **AND** 在后台启动 NestJS 后端（`cd server && npm run start:dev`）
- **AND** 在后台启动 Vite 前端（`cd client && npm run dev`）
- **AND** 后端可通过 `http://localhost:3000` 访问
- **AND** 前端可通过 `http://localhost:5173` 访问

#### Scenario: Docker 容器已在运行
- **WHEN** 执行 start 脚本时 PostgreSQL 和 Redis 容器已在运行
- **THEN** 跳过 Docker 启动步骤，直接启动后端和前端

#### Scenario: 端口冲突检测
- **WHEN** 执行 start 脚本时默认端口（3000 或 5173）已被占用
- **THEN** 脚本在启动前检测端口，输出明确提示信息告知用户哪个端口被占用

#### Scenario: 通过 Ctrl+C 停止所有服务
- **WHEN** 用户在 start 脚本运行期间按下 Ctrl+C
- **THEN** 脚本捕获 SIGINT 信号，自动终止所有后台启动的 server/client 进程
- **AND** Docker 容器保持运行（不自动停止，方便下次快速启动）

### Requirement: 一键停止脚本
系统 SHALL 提供 `scripts/stop.sh`（Bash）和 `scripts/stop.ps1`（PowerShell），用于停止所有运行中的服务而不删除任何数据。

#### Scenario: 停止所有运行中的服务
- **WHEN** 用户在项目根目录执行 `bash scripts/stop.sh`（或 PowerShell `.\scripts\stop.ps1`）
- **THEN** 终止所有由 start 脚本启动的 server/client 后台进程
- **AND** 执行 `docker compose down`（不带 `-v`）停止 PostgreSQL + Redis 容器
- **AND** 数据库数据、`node_modules/`、`.env` 配置完整保留
- **AND** 下次执行 `bash scripts/start.sh` 可直接恢复运行

#### Scenario: 无服务运行时执行停止
- **WHEN** 执行 stop 脚本时没有运行中的 server/client 进程且 Docker 容器未运行
- **THEN** 脚本输出提示：所有服务已处于停止状态
- **AND** 正常退出（零退出码）

### Requirement: 一键清理脚本
系统 SHALL 提供 `scripts/cleanup.sh`（Bash）和 `scripts/cleanup.ps1`（PowerShell），用于一键清理开发环境到初始状态。

#### Scenario: 完整清理
- **WHEN** 用户在项目根目录执行 `bash scripts/cleanup.sh`（或 PowerShell `.\scripts\cleanup.ps1`）
- **THEN** 停止所有运行中的 server/client 进程
- **AND** 执行 `docker compose down -v` 停止并删除 PostgreSQL + Redis 容器及数据卷
- **AND** 删除 `server/node_modules/`、`client/node_modules/`、`server/dist/`、`*.tsbuildinfo`

#### Scenario: 清理前确认提示
- **WHEN** 用户执行 cleanup 脚本
- **THEN** 脚本显示将要删除的内容摘要并要求用户确认（输入 yes 或按 Ctrl+C 取消）
- **AND** 仅在用户确认后执行清理操作

### Requirement: 跨平台支持
部署脚本 SHALL 同时提供 Bash 版本（macOS/Linux）、PowerShell 版本（Windows）和 CMD 批处理版本（Windows），覆盖三大操作系统。

#### Scenario: macOS/Linux 用户执行 Bash 脚本
- **WHEN** 用户在 macOS 或 Linux 终端执行 `bash scripts/setup.sh`、`bash scripts/start.sh`、`bash scripts/stop.sh`、`bash scripts/cleanup.sh`
- **THEN** 脚本正常执行，所有功能可用

#### Scenario: Windows 用户执行 PowerShell 脚本
- **WHEN** 用户在 Windows PowerShell 执行 `.\scripts\setup.ps1`、`.\scripts\start.ps1`、`.\scripts\stop.ps1`、`.\scripts\cleanup.ps1`
- **THEN** 脚本正常执行，所有功能可用

#### Scenario: Windows 用户执行 CMD 批处理脚本
- **WHEN** 用户在 Windows 命令提示符 (CMD) 执行 `scripts\setup.bat`、`scripts\start.bat`、`scripts\stop.bat`、`scripts\cleanup.bat`
- **THEN** 脚本正常执行，所有功能可用

### Requirement: README 快速开始章节更新
项目的 README.md 快速开始章节 SHALL 指引用户使用一键脚本而非手动多步操作。

#### Scenario: 用户阅读快速开始指南
- **WHEN** 用户打开 README.md 查看快速开始章节
- **THEN** 文档展示一键脚本用法（`bash scripts/setup.sh && bash scripts/start.sh`）
- **AND** 同时保留手动步骤作为备选方案
