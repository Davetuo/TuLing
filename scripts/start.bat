@echo off
setlocal enabledelayedexpansion
call "%~dp0common.bat"

echo =========================================
echo   TuLing - One-Click Start
echo =========================================
echo.

REM Check Docker
where docker >nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker not found
    exit /b 1
)
docker info >nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop
    exit /b 1
)

REM Docker containers
cd /d "%PROJECT_ROOT%"
docker compose ps --format "{{.Status}}" 2>nul | findstr "Up" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Starting Docker containers...
    docker compose up -d
) else (
    echo [INFO] Docker containers already running
)

REM Wait for ports
echo [INFO] Waiting for PostgreSQL (port 5432)...
:wait_pg
netstat -ano 2>nul | findstr ":5432" >nul
if %ERRORLEVEL% NEQ 0 goto wait_pg
echo [OK] Port 5432 ready

echo [INFO] Waiting for Redis (port 6379)...
:wait_redis
netstat -ano 2>nul | findstr ":6379" >nul
if %ERRORLEVEL% NEQ 0 goto wait_redis
echo [OK] Port 6379 ready

REM ===== Free port 3000 if in use =====
netstat -ano 2>nul | findstr ":3000.*LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [WARN] Port 3000 is in use, stopping existing backend process...
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":3000.*LISTENING"') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    REM Brief wait for OS to release the port
    ping -n 3 127.0.0.1 >nul
    echo [OK] Port 3000 freed
)

echo.
echo [INFO] Starting backend (NestJS) on port 3000...
start "TuLing-Server" cmd /k "cd /d "%PROJECT_ROOT%\server" && title TuLing-Server && npm run start:dev"
echo [OK] Backend started (check the new window for logs)

REM Save backend PID for stop.bat
ping -n 2 127.0.0.1 >nul
for /f %%a in ('powershell -NoProfile -Command "Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*TuLing-Server*' } | Select-Object -First 1 | ForEach-Object { $_.Id }" 2^>nul') do (
    echo %%a > "%PIDS_DIR%\server.pid"
)

REM ===== Free port 5173 if in use =====
netstat -ano 2>nul | findstr ":5173.*LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [WARN] Port 5173 is in use, stopping existing frontend process...
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":5173.*LISTENING"') do (
        taskkill /PID %%a /F >nul 2>&1
    )
    ping -n 3 127.0.0.1 >nul
    echo [OK] Port 5173 freed
)

echo.
echo [INFO] Starting frontend (Vite) on port 5173...
start "TuLing-Client" cmd /k "cd /d "%PROJECT_ROOT%\client" && title TuLing-Client && npm run dev"
echo [OK] Frontend started (check the new window for logs)

REM Save frontend PID for stop.bat
ping -n 2 127.0.0.1 >nul
for /f %%a in ('powershell -NoProfile -Command "Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*TuLing-Client*' } | Select-Object -First 1 | ForEach-Object { $_.Id }" 2^>nul') do (
    echo %%a > "%PIDS_DIR%\client.pid"
)

echo.
echo [OK] =========================================
echo [OK]   All services started
echo [OK] =========================================
echo.
echo   Backend API:  http://localhost:3000
echo   Frontend App: http://localhost:5173
echo.
echo Run scripts\stop.bat to stop all services
echo.

endlocal
