# 途灵 - 一键清理脚本 (PowerShell，不可逆操作)
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "common.ps1")

Write-Host ""
Write-Warn "========================================="
Write-Warn "  ! 途灵 - 一键清理（不可逆操作）"
Write-Warn "========================================="
Write-Host ""
Write-Warn "此操作将执行以下清理："
Write-Warn "  1. 停止所有运行中的服务进程"
Write-Warn "  2. 删除 Docker/Podman 容器及数据卷（数据库数据将丢失）"
Write-Warn "  3. 删除 node_modules\ 目录"
Write-Warn "  4. 删除 dist\ 构建产物"
Write-Host ""

if (-not (Confirm-Action -Message '确定要继续清理吗？')) {

    Write-Info "已取消清理操作"
    exit 0
}

Write-Host ""
Write-Info "========================================="
Write-Info "  途灵 - 一键清理"
Write-Info "========================================="
Write-Host ""

# ── 停止应用进程 ──
Write-Info "停止应用进程..."
Stop-AppProcesses

# ── 停止并删除容器及数据卷 ──
Write-Info "删除容器及数据卷..."
Invoke-Compose down -v
if ($LASTEXITCODE -ne 0) {
    Write-Warn "容器清理时出现问题"
}
Write-Success "容器及数据卷已删除"


# ── 删除依赖和构建产物 ──
Write-Info "清理 node_modules\ ..."
$serverNM = Join-Path $ProjectRoot "server\node_modules"
$clientNM = Join-Path $ProjectRoot "client\node_modules"
if (Test-Path $serverNM) { Remove-Item $serverNM -Recurse -Force -ErrorAction SilentlyContinue }
if (Test-Path $clientNM) { Remove-Item $clientNM -Recurse -Force -ErrorAction SilentlyContinue }
Write-Success "node_modules\ 已删除"

Write-Info "清理构建产物..."
$serverDist = Join-Path $ProjectRoot "server\dist"
if (Test-Path $serverDist) { Remove-Item $serverDist -Recurse -Force }
Remove-Item (Join-Path $ProjectRoot "server\*.tsbuildinfo") -Force -ErrorAction SilentlyContinue
Remove-Item (Join-Path $ProjectRoot "client\*.tsbuildinfo") -Force -ErrorAction SilentlyContinue
Write-Success "构建产物已删除"

# ── 清理 PID 文件 ──
if (Test-Path $PidsDir) { Remove-Item $PidsDir -Recurse -Force }

Write-Host ""
Write-Success "========================================="
Write-Success "  清理完成！环境已恢复至初始状态"
Write-Success "========================================="
Write-Host ""
Write-Info "重新部署: .\scripts\setup.ps1; .\scripts\start.ps1"
Write-Host ""
