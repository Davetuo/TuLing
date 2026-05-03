# 途灵 - 一键部署脚本 (PowerShell)
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "common.ps1")

Write-Host ""
Write-Info "========================================="
Write-Info "  途灵 - 一键部署"
Write-Info "========================================="
Write-Host ""

Test-Node
Test-Docker

# ── 后端依赖 ──
Write-Info "安装后端依赖..."
Set-Location (Join-Path $ProjectRoot "server")
npm install
Write-Success "后端依赖安装完成"

# ── 前端依赖 ──
Write-Info "安装前端依赖..."
Set-Location (Join-Path $ProjectRoot "client")
npm install
Write-Success "前端依赖安装完成"

# ── 环境变量 ──
Set-Location $ProjectRoot
$envFile = Join-Path $ProjectRoot "server\.env"
if (-not (Test-Path $envFile)) {
    Write-Info "生成 server\.env 配置文件..."
    Copy-Item (Join-Path $ProjectRoot "server\.env.example") $envFile
    Write-Warn "已生成 server\.env，请根据需要修改 JWT 密钥和 SMTP 配置"
} else {
    Write-Info "server\.env 已存在，跳过"
}

# ── 启动 Docker 容器 ──
Write-Info "启动 Docker 容器（PostgreSQL + Redis）..."
Set-Location $ProjectRoot
$containersUp = docker compose ps --format "{{.Status}}" 2>$null | Select-String "Up"
if (-not $containersUp) {
    docker compose up -d
} else {
    Write-Info "Docker 容器已在运行"
}

Write-Info "等待 PostgreSQL 就绪（端口 5432）..."
Wait-Port 5432
Write-Success "PostgreSQL 就绪"

# ── 数据库初始化 ──
Write-Info "初始化数据库..."
Set-Location (Join-Path $ProjectRoot "server")
npx prisma generate
npx prisma migrate dev
Write-Success "数据库初始化完成"

# ── 完成 ──
Write-Host ""
Write-Success "========================================="
Write-Success "  部署完成！"
Write-Success "========================================="
Write-Host ""
Write-Info "运行 .\scripts\start.ps1 启动所有服务"
Write-Host ""
