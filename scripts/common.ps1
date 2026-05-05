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

$script:ContainerRuntime = $env:CONTAINER_RUNTIME
$script:ContainerRuntimeName = ""
$script:ComposeCommand = @()

function Find-ContainerRuntime {
    $requested = $env:CONTAINER_RUNTIME
    if ([string]::IsNullOrWhiteSpace($requested)) {
        $candidates = @("docker", "podman")
    } elseif ($requested -in @("docker", "podman")) {
        $candidates = @($requested)
    } else {
        Write-Error-Exit "CONTAINER_RUNTIME 仅支持 docker 或 podman (当前: $requested)"
    }

    foreach ($runtime in $candidates) {
        $runtimeCmd = Get-Command $runtime -ErrorAction SilentlyContinue
        if (-not $runtimeCmd) {
            if (-not [string]::IsNullOrWhiteSpace($requested)) { Write-Error-Exit "未检测到 $runtime，请先安装 $runtime" }
            continue
        }

        $prevEAP2 = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & $runtime info 2>$null | Out-Null
        $ErrorActionPreference = $prevEAP2
        if ($LASTEXITCODE -ne 0) {
            if (-not [string]::IsNullOrWhiteSpace($requested)) { Write-Error-Exit "$runtime 未运行，请启动对应服务" }
            continue
        }

        if ($runtime -eq "podman") { $env:PODMAN_COMPOSE_WARNING_LOGS = "false" }
        $prevEAP3 = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        & $runtime compose version 2>$null | Out-Null
        $ErrorActionPreference = $prevEAP3
        if ($LASTEXITCODE -eq 0) {

            $script:ComposeCommand = @($runtime, "compose")
        } else {
            $composeCmd = Get-Command "$runtime-compose" -ErrorAction SilentlyContinue
            if ($composeCmd) {
                $script:ComposeCommand = @($composeCmd.Source)
            } else {
                if (-not [string]::IsNullOrWhiteSpace($requested)) { Write-Error-Exit "未检测到 $runtime compose，请安装 Compose 插件或 $runtime-compose" }
                continue
            }
        }

        $script:ContainerRuntime = $runtime
        $script:ContainerRuntimeName = if ($runtime -eq "docker") { "Docker" } else { "Podman" }
        return
    }

    Write-Error-Exit "未检测到可用的 Docker 或 Podman，请安装并启动 Docker Desktop / Podman"
}

function Test-ContainerRuntime {
    Find-ContainerRuntime
    Write-Info "$script:ContainerRuntimeName 已就绪 ✓"
}

function Test-Docker {
    Test-ContainerRuntime
}

function Invoke-Compose {
    param([Parameter(ValueFromRemainingArguments = $true)][string[]]$Arguments)
    if (-not $script:ComposeCommand -or $script:ComposeCommand.Count -eq 0) {
        Find-ContainerRuntime
    }
    $cmd = $script:ComposeCommand[0]
    $baseArgs = @()
    if ($script:ComposeCommand.Count -gt 1) {
        $baseArgs = $script:ComposeCommand[1..($script:ComposeCommand.Count - 1)]
    }
    $prevEAP = $ErrorActionPreference
    $ErrorActionPreference = "Continue"
    & $cmd @baseArgs @Arguments
    $ErrorActionPreference = $prevEAP
}


function Ensure-PodmanPortForward {
    # Podman on Windows (WSL2 + pasta) doesn't auto-forward container ports to localhost.
    # This function detects the issue and applies workarounds.
    if ($script:ContainerRuntime -ne "podman") { return }
    if (-not $IsWindows -and $env:OS -ne "Windows_NT") { return }

    # Test if localhost:5432 is already accessible
    $accessible = $false
    try {
        $tcp = New-Object System.Net.Sockets.TcpClient
        $tcp.Connect("127.0.0.1", 5432)
        $tcp.Close()
        $accessible = $true
    } catch {}

    if ($accessible) { return }

    # Get Podman Machine WSL IP
    $wslIP = $null
    try {
        $prevEAPwsl = $ErrorActionPreference
        $ErrorActionPreference = "Continue"
        $ipOutput = & wsl.exe -d podman-machine-default -- ip -4 addr show eth0 2>$null
        $ErrorActionPreference = $prevEAPwsl
        $ipText = $ipOutput -join "`n"
        if ($ipText -match 'inet\s+(\d+\.\d+\.\d+\.\d+)/') {
            $wslIP = $Matches[1]
        }
    } catch {
        $ErrorActionPreference = $prevEAPwsl
    }

    if (-not $wslIP) {
        Write-Warn "无法获取 Podman Machine IP，端口转发可能不工作"
        return
    }

    # Always store the WSL IP so Test-Port can use it
    $script:PodmanWSLIP = $wslIP

    Write-Info "Podman Windows: localhost 端口不通，WSL IP: $wslIP"

    # Strategy 1: Try netsh portproxy (requires admin, may or may not work)
    $isAdmin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
    $ports = @(5432, 6379)
    if ($isAdmin) {
        foreach ($p in $ports) {
            netsh interface portproxy add v4tov4 listenport=$p listenaddress=127.0.0.1 connectport=$p connectaddress=$wslIP 2>$null | Out-Null
        }
    } else {
        $proxyArgs = ($ports | ForEach-Object { "netsh interface portproxy add v4tov4 listenport=$_ listenaddress=127.0.0.1 connectport=$_ connectaddress=$wslIP" }) -join " & "
        try {
            Start-Process -FilePath "cmd.exe" -ArgumentList "/c $proxyArgs" -Verb RunAs -Wait -WindowStyle Hidden
        } catch {}
    }

    # Wait briefly and re-test
    Start-Sleep -Seconds 2
    $accessible2 = $false
    try {
        $tcp2 = New-Object System.Net.Sockets.TcpClient
        $tcp2.Connect("127.0.0.1", 5432)
        $tcp2.Close()
        $accessible2 = $true
    } catch {}

    if ($accessible2) {
        Write-Success "端口代理已生效 (localhost -> $wslIP)"
        return
    }

    # Strategy 2: Update .env to use WSL IP directly
    Write-Warn "netsh portproxy 未能生效，正在将 .env 中的 localhost 替换为 WSL IP ($wslIP)..."
    $envFile = Join-Path $ProjectRoot "server\.env"
    if (Test-Path $envFile) {
        $content = [System.IO.File]::ReadAllText($envFile, [System.Text.Encoding]::UTF8)
        $newContent = $content -replace 'localhost:5432', "${wslIP}:5432"
        $newContent = $newContent -replace 'REDIS_HOST=localhost', "REDIS_HOST=$wslIP"
        if ($newContent -ne $content) {
            [System.IO.File]::WriteAllText($envFile, $newContent, [System.Text.Encoding]::UTF8)
            Write-Success ".env 已更新: localhost -> $wslIP (PostgreSQL/Redis)"
        }
    } else {
        Write-Warn "未找到 server/.env 文件，请手动将数据库/Redis 连接地址改为 $wslIP"
    }

    # Store the WSL IP for Wait-Port to use
    $script:PodmanWSLIP = $wslIP
}

function Test-Port {
    param([int]$Port)
    # First check local TCP connections (works for Docker / native services)
    $conn = Get-NetTCPConnection -LocalPort $Port -ErrorAction SilentlyContinue
    if ($conn) { return $true }
    # For Podman on Windows, try connecting to WSL IP or localhost
    $targets = @("127.0.0.1")
    if ($script:PodmanWSLIP) { $targets = @($script:PodmanWSLIP) + $targets }
    foreach ($target in $targets) {
        try {
            $tcp = New-Object System.Net.Sockets.TcpClient
            $tcp.Connect($target, $Port)
            $tcp.Close()
            return $true
        } catch {}
    }
    return $false
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
            if (-not $retried) {
                $containers = Invoke-Compose ps --format "{{.Service}}" 2>$null
                if ($containers) {
                    Write-Warn "端口 $Port 等待超时，尝试重启 $script:ContainerRuntimeName 容器..."
                    Invoke-Compose restart 2>$null | Out-Null

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

function Get-PublicIP {
    $services = @("https://ifconfig.me/ip", "https://api.ipify.org", "https://ip.sb")
    foreach ($svc in $services) {
        try {
            $ip = (Invoke-WebRequest -Uri $svc -TimeoutSec 3 -UseBasicParsing).Content.Trim()
            if ($ip -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$') {
                return $ip
            }
        } catch { }
    }
    return ""
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
