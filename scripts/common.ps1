# 途灵 - 公共工具函数 (PowerShell)
$ErrorActionPreference = "Stop"

$ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
$ProjectRoot = Split-Path -Parent $ScriptDir
$PidsDir = Join-Path $ScriptDir ".pids"

if (-not (Test-Path $PidsDir)) {
    New-Item -ItemType Directory -Path $PidsDir -Force | Out-Null
}

Set-Location $ProjectRoot

function Write-Info    { Write-Host "[INFO]" -ForegroundColor Blue -NoNewline; Write-Host " $args" }
function Write-Success { Write-Host "[OK]"   -ForegroundColor Green -NoNewline; Write-Host " $args" }
function Write-Warn    { Write-Host "[WARN]" -ForegroundColor Yellow -NoNewline; Write-Host " $args" }
function Write-Error-Exit {
    Write-Host "[ERROR]" -ForegroundColor Red -NoNewline; Write-Host " $args"
    exit 1
}

function Test-Node {
    $node = Get-Command node -ErrorAction SilentlyContinue
    if (-not $node) {
        Write-Error-Exit "未检测到 Node.js，请安装 Node.js >= 20 (https://nodejs.org)"
    }
    $version = node -v
    $major = [int]($version -replace 'v', '').Split('.')[0]
    if ($major -lt 20) {
        Write-Error-Exit "Node.js 版本过低 (当前: $version)，请升级到 >= 20"
    }
    Write-Info "Node.js $version ✓"
}

function Test-Docker {
    $docker = Get-Command docker -ErrorAction SilentlyContinue
    if (-not $docker) {
        Write-Error-Exit "未检测到 Docker，请安装 Docker Desktop (https://docker.com)"
    }
    docker info 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Error-Exit "Docker 未运行，请启动 Docker Desktop"
    }
    Write-Info "Docker 已就绪 ✓"
}

function Test-Port {
    param([int]$Port)
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    return $conn -ne $null
}

function Wait-Port {
    param([int]$Port, [int]$Timeout = 30)
    Write-Info "等待端口 $Port 就绪..."
    $elapsed = 0
    $retried = $false
    while (-not (Test-Port $Port)) {
        Start-Sleep -Milliseconds 500
        $elapsed++
        if ($elapsed -ge ($Timeout * 2)) {
            if (-not $retried -and (Get-Command docker -ErrorAction SilentlyContinue)) {
                $containers = docker compose ps --format "{{.Service}}" 2>$null
                if ($containers) {
                    Write-Warn "端口 $Port 等待超时，尝试重启 Docker 容器..."
                    docker compose restart 2>$null | Out-Null
                    $retried = $true
                    $elapsed = 0
                    Start-Sleep -Seconds 2
                    continue
                }
            }
            Write-Error-Exit "端口 $Port 等待超时 ($Timeout 秒)"
        }
    }
    Write-Success "端口 $Port 已就绪"
}

function Confirm-Action {
    param([string]$Message = "确认执行此操作？")
    $response = Read-Host "[?] $Message [y/N]"
    return $response -match '^[yY]'
}

function Stop-AppProcesses {
    $stopped = $false

    $serverPidFile = Join-Path $PidsDir "server.pid"
    if (Test-Path $serverPidFile) {
        $spid = Get-Content $serverPidFile
        $proc = Get-Process -Id $spid -ErrorAction SilentlyContinue
        if ($proc) {
            # Use taskkill /T to kill the entire process tree (nest --watch spawns children)
            taskkill /PID $spid /T /F >$null 2>&1
            Write-Info "后端进程已停止 (PID: $spid)"
            $stopped = $true
        }
        Remove-Item $serverPidFile -Force -ErrorAction SilentlyContinue
    }

    $clientPidFile = Join-Path $PidsDir "client.pid"
    if (Test-Path $clientPidFile) {
        $cpid = Get-Content $clientPidFile
        $proc = Get-Process -Id $cpid -ErrorAction SilentlyContinue
        if ($proc) {
            taskkill /PID $cpid /T /F >$null 2>&1
            Write-Info "前端进程已停止 (PID: $cpid)"
            $stopped = $true
        }
        Remove-Item $clientPidFile -Force -ErrorAction SilentlyContinue
    }

    # Fallback: kill by port (with /T to kill entire process tree)
    foreach ($port in @(3000, 5173)) {
        $conn = Get-NetTCPConnection -LocalPort $port -ErrorAction SilentlyContinue | Select-Object -First 1
        if ($conn) {
            taskkill /PID $conn.OwningProcess /T /F >$null 2>&1
            $stopped = $true
        }
    }

    # Last-resort fallback: stop any remaining node processes running nest/vite
    Get-Process -Name "node" -ErrorAction SilentlyContinue | ForEach-Object {
        if ($_.CommandLine -match "nest start|vite") {
            taskkill /PID $_.Id /T /F >$null 2>&1
            $stopped = $true
        }
    }

    if (-not $stopped) {
        Write-Info "没有运行中的应用进程"
    }
}
