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
Test-ContainerRuntime

# ── 判断是否需要安装依赖 ──
$serverDir = Join-Path $ProjectRoot "server"
$clientDir = Join-Path $ProjectRoot "client"

function Test-DepsNeeded {
    param([string]$Dir)
    $nm = Join-Path $Dir "node_modules"
    if (-not (Test-Path $nm)) { return $true }
    $pkg = Join-Path $Dir "package.json"
    if ((Get-Item $pkg).LastWriteTime -gt (Get-Item $nm).LastWriteTime) { return $true }
    return $false
}

$needServer = Test-DepsNeeded $serverDir
$needClient = Test-DepsNeeded $clientDir

# ── 启动容器（后台运行，利用依赖安装的时间） ──
Write-Info "Starting $script:ContainerRuntimeName containers (PostgreSQL + Redis)..."
Set-Location $ProjectRoot
$containersUp = Invoke-Compose ps --format "{{.Status}}" 2>$null | Select-String "Up"
if (-not $containersUp) {
    Invoke-Compose -Arguments @("up", "-d")
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Exit "$script:ContainerRuntimeName container startup failed"
    }
} else {
    Write-Info "$script:ContainerRuntimeName containers already running"
}

# ── Podman Windows 端口代理 ──
Ensure-PodmanPortForward

# ── 安装后端依赖 ──
if ($needServer) {
    Write-Info "Installing server dependencies..."
    Set-Location $serverDir
    npm install --no-audit --no-fund --prefer-offline
    if ($LASTEXITCODE -ne 0) { Write-Error-Exit "Server dependency installation failed" }
    Write-Success "Server dependencies installed"
} else {
    Write-Info "Server dependencies up-to-date (skip)"
}

# ── 安装前端依赖 ──
if ($needClient) {
    Write-Info "Installing client dependencies..."
    Set-Location $clientDir
    npm install --no-audit --no-fund --prefer-offline
    if ($LASTEXITCODE -ne 0) { Write-Error-Exit "Client dependency installation failed" }
    Write-Success "Client dependencies installed"
} else {
    Write-Info "Client dependencies up-to-date (skip)"
}

# ── 等待基础设施就绪 ──
Wait-Port 5432 30
Wait-Port 6379 30

# ── 环境变量 ──
Set-Location $ProjectRoot
$envFile = Join-Path $ProjectRoot "server\.env"
if (-not (Test-Path $envFile)) {
    Write-Info "Generating server\.env from template..."
    Copy-Item (Join-Path $ProjectRoot "server\.env.example") $envFile
    Write-Warn "Edit server\.env to set JWT secrets and SMTP config"
} else {
    Write-Info "server\.env already exists, skip"
}

# ── 数据库初始化 ──
Write-Info "Initializing database..."
Set-Location $serverDir

# Prisma generate (retry up to 3 times for Windows file locks)
$retry = 0
while ($retry -lt 3) {
    npx prisma generate
    if ($LASTEXITCODE -eq 0) { break }
    $retry++
    if ($retry -ge 3) { Write-Error-Exit "Prisma generate failed after 3 attempts" }
    Write-Warn "Prisma generate failed, retrying ($retry/3)..."
    Start-Sleep -Seconds 3
}

# Use migrate deploy (faster) when possible; fall back to migrate dev
npx prisma migrate deploy 2>$null
if ($LASTEXITCODE -ne 0) {
    Write-Info "migrate deploy unavailable, using migrate dev..."
    npx prisma migrate dev
    if ($LASTEXITCODE -ne 0) { Write-Error-Exit "Database migration failed" }
}

Write-Success "Database initialized"

# ── 完成 ──
Write-Host ""
Write-Success "========================================="
Write-Success "  Setup complete!"
Write-Success "========================================="
Write-Host ""
Write-Info "Run .\scripts\start.ps1 to start all services"
Write-Host ""
