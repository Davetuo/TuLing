# 途灵 - 一键生产启动脚本 (PowerShell)
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "common.ps1")

Write-Host ""
Write-Info "========================================="
Write-Info "  途灵 - 生产模式启动"
Write-Info "========================================="
Write-Host ""

Test-Node
Test-Docker

# ── Docker 容器 ──
$running = docker compose ps --format '{{.Status}}' 2>$null | Select-String "Up"
if (-not $running) {
    Write-Info "启动 Docker 容器 (PostgreSQL + Redis)..."
    docker compose up -d
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Exit "Docker 容器启动失败"
    }
} else {
    Write-Info "Docker 容器已在运行"
}

# ── 等待基础设施就绪 ──
Wait-Port 5432 30
Wait-Port 6379 30

# ── 构建后端 ──
Write-Info "构建后端 (NestJS)..."
$serverDir = Join-Path $ProjectRoot "server"
Push-Location $serverDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Exit "后端构建失败"
    }
    Write-Success "后端构建完成"
} finally {
    Pop-Location
}

# ── 构建前端 ──
Write-Info "构建前端 (Vite)..."
$clientDir = Join-Path $ProjectRoot "client"
Push-Location $clientDir
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Exit "前端构建失败"
    }
    Write-Success "前端构建完成"
} finally {
    Pop-Location
}

# ── 释放端口 3000 ──
$conn = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -First 1
if ($conn) {
    Write-Warn "端口 3000 已被占用 (PID: $($conn.OwningProcess))，正在终止..."
    taskkill /PID $conn.OwningProcess /T /F >$null 2>&1
    Start-Sleep -Seconds 1
}

# ── 启动生产服务 ──
Write-Info "启动生产服务 (NestJS + 静态文件)..."

$env:NODE_ENV = "production"
Push-Location $serverDir
try {
    $serverProc = Start-Process -FilePath "node" -ArgumentList "dist/main" `
        -PassThru -NoNewWindow
    $serverProc.Id | Out-File (Join-Path $PidsDir "server-prod.pid") -NoNewline
    Write-Success "生产服务已启动 (PID: $($serverProc.Id))"
} finally {
    Pop-Location
}

Start-Sleep -Seconds 2

Write-Host ""
Write-Success "========================================="
Write-Success "  生产服务已启动"
Write-Success "========================================="
Write-Host ""
Write-Info "本地访问: http://localhost:3000"

# ── 获取局域网 IP ──
try {
    $lanAddr = Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp,Manual -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '172.*' } |
        Select-Object -First 1 -ExpandProperty IPAddress
    if ($lanAddr) {
        Write-Info "局域网访问: http://${lanAddr}:3000"
    }
} catch { }

Write-Info "按 Ctrl+C 停止服务"
Write-Host ""

# ── 等待 Ctrl+C ──
try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    Write-Host ""
    Write-Info "正在停止服务..."
    $pidFile = Join-Path $PidsDir "server-prod.pid"
    if (Test-Path $pidFile) {
        $spid = Get-Content $pidFile
        taskkill /PID $spid /T /F >$null 2>&1
        Remove-Item $pidFile -Force -ErrorAction SilentlyContinue
    }
    Write-Success "服务已停止"
}
