## Why

项目目前依赖手动多步操作才能启动（启动 Docker → 初始化数据库 → 启动后端 → 启动前端），跨设备复现环境成本高。通过提供一键脚本降低上手门槛，使任何新设备都能在一条命令内完成从零到运行的完整部署。

## What Changes

- 新增 `scripts/setup.sh`：一键部署脚本，自动完成依赖安装、环境配置、数据库初始化
- 新增 `scripts/start.sh`：一键启动脚本，自动拉起 Docker 基础设施 + 后端 + 前端
- 新增 `scripts/stop.sh`：一键停止脚本，停止后端/前端进程和 Docker 容器，保留所有数据
- 新增 `scripts/cleanup.sh`：一键清理脚本，停止服务并清除数据卷和构建产物（不可逆）
- 新增 `scripts/common.sh`：公共工具函数（颜色输出、错误处理、前置条件检查）
- 提供对应的 Windows PowerShell 版本（`setup.ps1` / `start.ps1` / `stop.ps1` / `cleanup.ps1`）和 CMD 批处理版本（`setup.bat` / `start.bat` / `stop.bat` / `cleanup.bat`），使项目在 Windows/macOS/Linux 均可便捷部署
- 更新 README.md 快速开始章节，指引用户使用一键脚本

## Capabilities

### New Capabilities

- `dev-scripts`: 提供跨平台一键部署、启动、清理脚本，覆盖依赖安装→环境初始化→服务启动→环境清理的完整开发运维闭环

### Modified Capabilities

<!-- No existing specs to modify -->

## Impact

- 新增 `scripts/` 目录（14 个文件：5 个 bash 脚本 + 4 个 PowerShell 脚本 + 5 个 CMD 批处理脚本）
- 受影响文件：`README.md`（更新快速开始指引）
