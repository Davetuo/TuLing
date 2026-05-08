## 1. Common utility scripts

- [x] 1.1 创建 `scripts/common.sh`：日志输出函数（info/warn/error 带颜色）、依赖检查函数（check_node、check_docker）、端口检测函数（check_port）、确认提示函数（confirm）
- [x] 1.2 创建 `scripts/common.ps1`：PowerShell 版公共函数（Write-Info/Write-Warn/Write-Error、Test-Node、Test-Docker、Test-Port、Confirm-Action）

## 2. Setup script

- [x] 2.1 创建 `scripts/setup.sh`：检查 Node.js >= 20 和 Docker → server/client 依次 npm install → 生成 .env（若不存在）→ prisma generate + prisma migrate dev
- [x] 2.2 创建 `scripts/setup.ps1`：PowerShell 版一键部署脚本，功能与 setup.sh 对等

## 3. Start script

- [x] 3.1 创建 `scripts/start.sh`：docker compose up -d（若未运行）→ 等待 PostgreSQL/Redis 就绪 → 后台启动 NestJS + Vite → trap 捕获 SIGINT 清理后台进程
- [x] 3.2 创建 `scripts/start.ps1`：PowerShell 版一键启动脚本，功能与 start.sh 对等

## 4. Stop script

- [x] 4.1 创建 `scripts/stop.sh`：终止 server/client 后台进程 → docker compose down（不带 -v，保留数据卷）→ 输出停止状态
- [x] 4.2 创建 `scripts/stop.ps1`：PowerShell 版一键停止脚本，功能与 stop.sh 对等

## 5. Cleanup script

- [x] 5.1 创建 `scripts/cleanup.sh`：确认提示 → 调用 stop → docker compose down -v → 删除 node_modules/dist/tsbuildinfo
- [x] 5.2 创建 `scripts/cleanup.ps1`：PowerShell 版一键清理脚本，功能与 cleanup.sh 对等

## 6. CMD batch scripts

- [x] 6.1 创建 `scripts/common.bat`：CMD 公共变量（SCRIPT_DIR、PROJECT_ROOT、PIDS_DIR）
- [x] 6.2 创建 `scripts/setup.bat`：CMD 版一键部署脚本，功能与 setup.sh 对等
- [x] 6.3 创建 `scripts/start.bat`：CMD 版一键启动脚本（新窗口模式，分别启动 server/client）
- [x] 6.4 创建 `scripts/stop.bat`：CMD 版一键停止脚本（通过窗口标题 taskkill + docker compose down）
- [x] 6.5 创建 `scripts/cleanup.bat`：CMD 版一键清理脚本（确认提示 + 完整清理）

## 7. README update

- [x] 7.1 更新 README.md 快速开始章节，主推一键脚本用法，保留手动步骤作为备选（含 Bash/PS/CMD 三列脚本表格）

## 8. Script testing

- [x] 8.1 Bash 脚本语法验证通过（bash -n），common.sh 核心函数测试通过
- [x] 8.2 PowerShell 脚本语法验证通过（AST Parser）
- [x] 8.3 CMD 批处理脚本语法验证通过（静态检查）
