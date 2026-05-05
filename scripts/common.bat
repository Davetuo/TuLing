@echo off
REM TuLing - Common utilities (CMD Batch)
set "SCRIPT_DIR=%~dp0"
pushd "%~dp0.."
set "PROJECT_ROOT=%CD%"
popd
set "PIDS_DIR=%~dp0.pids"
if not exist "%PIDS_DIR%" mkdir "%PIDS_DIR%" >nul 2>nul

if /i "%~1"=="get_public_ip" goto :get_public_ip

call :detect_container_runtime
exit /b %ERRORLEVEL%

:detect_container_runtime
set "__requested=%CONTAINER_RUNTIME%"
if defined __requested (
    if /i "%__requested%"=="docker" goto :try_docker
    if /i "%__requested%"=="podman" goto :try_podman
    echo [ERROR] CONTAINER_RUNTIME only supports docker or podman ^(current: %__requested%^)

    exit /b 1
)
goto :try_docker

:try_docker
where docker >nul 2>nul
if errorlevel 1 (
    if /i "%__requested%"=="docker" (
        echo [ERROR] Docker not found. Please install Docker Desktop
        exit /b 1
    )
    goto :try_podman
)
docker info >nul 2>nul
if errorlevel 1 (
    if /i "%__requested%"=="docker" (
        echo [ERROR] Docker is not running. Please start Docker Desktop
        exit /b 1
    )
    goto :try_podman
)
docker compose version >nul 2>nul
if not errorlevel 1 (
    set "CONTAINER_RUNTIME=docker"
    set "CONTAINER_RUNTIME_NAME=Docker"
    set "COMPOSE_CMD=docker compose"
    exit /b 0
)
where docker-compose >nul 2>nul
if not errorlevel 1 (
    set "CONTAINER_RUNTIME=docker"
    set "CONTAINER_RUNTIME_NAME=Docker"
    set "COMPOSE_CMD=docker-compose"
    exit /b 0
)
if /i "%__requested%"=="docker" (
    echo [ERROR] Docker Compose not found. Please install Docker Compose
    exit /b 1
)
goto :try_podman

:try_podman
where podman >nul 2>nul
if errorlevel 1 (
    if /i "%__requested%"=="podman" (
        echo [ERROR] Podman not found. Please install Podman
        exit /b 1
    )
    goto :runtime_not_found
)
podman info >nul 2>nul
if errorlevel 1 (
    if /i "%__requested%"=="podman" (
        echo [ERROR] Podman is not running. Please start Podman machine or Podman Desktop
        exit /b 1
    )
    goto :runtime_not_found
)
podman compose version >nul 2>nul
if not errorlevel 1 (
    set "CONTAINER_RUNTIME=podman"
    set "CONTAINER_RUNTIME_NAME=Podman"
    set "PODMAN_COMPOSE_WARNING_LOGS=false"
    set "COMPOSE_CMD=podman compose"
    exit /b 0

)
where podman-compose >nul 2>nul
if not errorlevel 1 (
    set "CONTAINER_RUNTIME=podman"
    set "CONTAINER_RUNTIME_NAME=Podman"
    set "PODMAN_COMPOSE_WARNING_LOGS=false"
    set "COMPOSE_CMD=podman-compose"
    exit /b 0

)
if /i "%__requested%"=="podman" (
    echo [ERROR] Podman Compose not found. Please install podman compose or podman-compose
    exit /b 1
)
goto :runtime_not_found

:runtime_not_found
echo [ERROR] No available Docker or Podman runtime found. Please install and start Docker Desktop or Podman.
exit /b 1

REM ===== Get public IP via PowerShell =====
REM Sets __public_ip variable. Call with: call "%~dp0common.bat" get_public_ip
:get_public_ip
set "__public_ip="
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command ^
  "$s=@('https://ifconfig.me/ip','https://api.ipify.org','https://ip.sb');foreach($u in $s){try{$r=(Invoke-WebRequest -Uri $u -TimeoutSec 3 -UseBasicParsing).Content.Trim();if($r -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'){Write-Host $r -NoNewline;exit 0}}catch{}}Write-Host ''"