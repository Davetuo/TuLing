# 途灵 - 一键启动脚本 (PowerShell)
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "common.ps1")

Write-Host ""
Write-Info "========================================="
Write-Info "  途灵 - 一键启动"
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

# ── 释放被占用的端口 ──
foreach ($port in @(3000, 5173)) {
    $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
    if ($conn) {
        Write-Warn "端口 $port 已被占用 (PID: $($conn.OwningProcess))，正在终止..."
        taskkill /PID $conn.OwningProcess /T /F >$null 2>&1
        Start-Sleep -Seconds 1
    }
}

# ── 启动后端 ──
Write-Info "启动后端服务 (NestJS) 端口 3000..."
$serverProc = Start-Process -FilePath "npm" -ArgumentList "run","start:dev" `
    -WorkingDirectory (Join-Path $ProjectRoot "server") `
    -PassThru -NoNewWindow
$serverProc.Id | Out-File (Join-Path $PidsDir "server.pid") -NoNewline
Write-Success "后端已启动 (PID: $($serverProc.Id))"

# ── 启动前端 ──
Write-Info "启动前端服务 (Vite) 端口 5173..."
$clientProc = Start-Process -FilePath "npm" -ArgumentList "run","dev" `
    -WorkingDirectory (Join-Path $ProjectRoot "client") `
    -PassThru -NoNewWindow
$clientProc.Id | Out-File (Join-Path $PidsDir "client.pid") -NoNewline
Write-Success "前端已启动 (PID: $($clientProc.Id))"

Write-Host ""
Write-Success "========================================="
Write-Success "  所有服务已启动"
Write-Success "========================================="
Write-Host ""
Write-Info "后端 API:  http://localhost:3000"
Write-Info "前端页面:  http://localhost:5173"

# ── 获取局域网 IP ──
try {
    $lanAddr = Get-NetIPAddress -AddressFamily IPv4 -PrefixOrigin Dhcp,Manual -ErrorAction SilentlyContinue |
        Where-Object { $_.IPAddress -ne '127.0.0.1' -and $_.IPAddress -notlike '172.*' } |
        Select-Object -First 1 -ExpandProperty IPAddress
    if ($lanAddr) {
        Write-Info "局域网访问:"
        Write-Info "  前端:     http://${lanAddr}:5173"
        Write-Info "  后端 API: http://${lanAddr}:3000"
    }
} catch { }

$publicIp = Get-PublicIP
if ($publicIp) {
    Write-Info "公网访问: http://${publicIp}:3000"
    if ($lanAddr) {
        Write-Warn "请确保路由器已配置端口转发 (3000 -> ${lanAddr}:3000)"
    }
}

Write-Info "按 Ctrl+C 停止所有服务"
Write-Host ""

# ── 等待 Ctrl+C ──
try {
    while ($true) { Start-Sleep -Seconds 1 }
} finally {
    Write-Host ""
    Write-Info "正在停止所有服务..."
    Stop-AppProcesses
    Write-Success "所有服务已停止"
}
