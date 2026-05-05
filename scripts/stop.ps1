# 途灵 - 一键停止脚本 (PowerShell，保留数据)
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
. (Join-Path $ScriptDir "common.ps1")

Write-Host ""
Write-Info "========================================="
Write-Info "  途灵 - 一键停止"
Write-Info "========================================="
Write-Host ""

# ── 停止应用进程 ──
Write-Info "停止应用进程..."
Stop-AppProcesses

# ── 停止容器（保留数据卷） ──
Write-Info "停止容器（保留数据）..."
Invoke-Compose down
if ($LASTEXITCODE -ne 0) {
    Write-Warn "容器停止时出现问题（可能已停止）"
}
Write-Success "容器已停止"


Write-Host ""
Write-Success "========================================="
Write-Success "  所有服务已停止（数据已保留）"
Write-Success "========================================="
Write-Host ""
Write-Info "运行 .\scripts\start.ps1 重新启动"
Write-Host ""
