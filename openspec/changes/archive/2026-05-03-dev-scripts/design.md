## Context

当前项目启动需要开发者手动执行 4 步操作（docker compose up → npm install → prisma migrate → npm run dev），跨设备复现环境耗时且易出错。项目技术栈涉及 Docker Compose (PostgreSQL + Redis)、NestJS 后端、Vite 前端三个独立进程的协调，需要一套脚本将这些步骤自动化。

约束：项目支持 Windows/macOS/Linux 三大平台，脚本需覆盖至少 Unix shell 和 Windows PowerShell 两种环境。

## Goals / Non-Goals

**Goals:**
- 提供一键式部署脚本，新设备克隆仓库后执行一条命令即可完成所有准备工作
- 提供一键式启动脚本，自动拉起基础设施 + 后端 + 前端
- 提供一键式停止脚本，仅停止服务不删除数据
- 提供一键式清理脚本，恢复环境到初始状态（不可逆操作）
- Bash 脚本覆盖 macOS/Linux，PowerShell 脚本覆盖 Windows
- 脚本可重复执行（幂等），不会因重复运行而损坏已有状态

**Non-Goals:**
- 不实现生产环境部署（生产部署使用 Docker 化方案，后续单独处理）
- 不实现 CI/CD 集成（仅为本地开发脚本）
- 不检测并自动安装 Node.js / Docker（前置条件由用户保证，脚本做检查并给出明确提示）

## Decisions

### 1. Bash 脚本 + PowerShell 脚本 + CMD 批处理三方案

**选择**：为 macOS/Linux 提供 Bash 脚本，为 Windows 提供 PowerShell 和 CMD 两套脚本，而非使用 Node.js 跨平台方案。

**理由**：
- Bash/PS/CMD 无需额外依赖，克隆即用
- 脚本逻辑简单（环境检查 + 进程管理），无需引入 Node.js 进程管理库
- PowerShell 脚本功能完善（try/finally 错误处理），CMD 批处理覆盖无法运行 PowerShell 的受限环境
- 团队开发者在各自平台使用原生体验

**未选择方案**：用 Node.js + npm scripts 统一。缺点是需要先 `npm install` 才能运行脚本，形成循环依赖（部署脚本本身依赖 npm install）。

### 2. 脚本文件组织

```
scripts/
├── common.sh          # Bash 公共函数（日志、颜色、错误处理、依赖检查）
├── setup.sh           # 一键部署（安装依赖 + 初始化）
├── start.sh           # 一键启动（拉起所有服务）
├── stop.sh            # 一键停止（仅停止服务，保留数据）
├── cleanup.sh         # 一键清理（停止 + 删除数据/产物，不可逆）
├── common.ps1         # PowerShell 公共函数
├── setup.ps1          # Windows 一键部署 (PowerShell)
├── start.ps1          # Windows 一键启动 (PowerShell)
├── stop.ps1           # Windows 一键停止 (PowerShell)
├── cleanup.ps1        # Windows 一键清理 (PowerShell)
├── common.bat         # CMD 公共变量
├── setup.bat          # Windows 一键部署 (CMD)
├── start.bat          # Windows 一键启动 (CMD)
├── stop.bat           # Windows 一键停止 (CMD)
└── cleanup.bat        # Windows 一键清理 (CMD)
```

### 3. 脚本职责划分

**setup**：安装依赖 + 环境初始化
- 检查 Node.js >= 20、Docker 是否可用
- `npm install`（server + client 两处）
- 从 `.env.example` 生成 `.env`（若不存在）
- `npx prisma generate` + `npx prisma migrate dev`（初始化数据库表结构）

**start**：启动所有服务
- `docker compose up -d`（若容器未运行）
- 等待 PostgreSQL/Redis 就绪（检查端口连通性）
- 后台启动 NestJS 后端（`npm run start:dev`）
- 后台启动 Vite 前端（`npm run dev`）
- 捕获 SIGINT/EXIT 以在前台被 Ctrl+C 时自动停止所有后台进程

**stop**：停止所有服务（保留数据）
- 终止后台运行的 server/client 进程（按 PID 文件或进程名匹配）
- `docker compose down`（不带 `-v`，保留数据卷）
- 不影响 `node_modules/`、`.env`、数据库数据

**cleanup**：清理环境（不可逆）
- 停止 server/client 进程
- `docker compose down -v`（删除数据卷）
- 删除 `node_modules/`、`dist/`、`*.tsbuildinfo`

### 4. 进程管理策略

**选择**：start.sh 使用 `&` 后台启动 + `trap` 捕获退出信号，而非使用 pm2 或 docker-compose 全容器化。

**理由**：开发脚本需要实时查看后端/前端日志输出（`start:dev` watch 模式），使用简单后台进程 + trap 能满足需求且零依赖。Ctrl+C 一键停止所有服务。

## Risks / Trade-offs

- [Windows 路径差异] PowerShell 脚本需注意路径分隔符和换行符。→ 全部使用正斜杠，PowerShell 自动兼容。
- [端口冲突] 若默认端口（5432/6379/3000/5173）被占用，启动会失败。→ start 脚本启动前检测端口，给出明确提示。
- [Docker 未运行] Docker Desktop 未启动时 docker compose 命令失败。→ setup/start 脚本检查 Docker 可用性，提前失败并提示。
