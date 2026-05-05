@echo off
setlocal enabledelayedexpansion
call "%~dp0common.bat"
if %ERRORLEVEL% NEQ 0 exit /b 1


echo.
echo =========================================
echo   TuLing - One-Click Setup
echo =========================================
echo.

REM ===== Check Node.js =====
where node >nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Node.js not found. Please install Node.js ^>= 20
    exit /b 1
)
for /f "tokens=1 delims=v." %%a in ('node -v 2^>nul') do set NODE_MAJOR=%%a
for /f "tokens=*" %%v in ('node -v 2^>nul') do set NODE_FULL=%%v
if !NODE_MAJOR! LSS 20 (
    echo [ERROR] Node.js version too low ^(current: !NODE_FULL!^), upgrade to ^>= 20
    exit /b 1
)
echo [INFO] Node.js !NODE_FULL! (ok)

REM ===== Container runtime =====
echo [INFO] %CONTAINER_RUNTIME_NAME% ready (ok)
echo.


REM ===== Install dependencies (skip if node_modules is up-to-date) =====
set NEED_SERVER=0
set NEED_CLIENT=0
if not exist "%PROJECT_ROOT%\server\node_modules" set NEED_SERVER=1
if not exist "%PROJECT_ROOT%\client\node_modules" set NEED_CLIENT=1

REM Check if package.json is newer than node_modules
if !NEED_SERVER! EQU 0 (
    for %%A in ("%PROJECT_ROOT%\server\package.json") do for %%B in ("%PROJECT_ROOT%\server\node_modules") do (
        if "%%~tA" GTR "%%~tB" set NEED_SERVER=1
    )
)
if !NEED_CLIENT! EQU 0 (
    for %%A in ("%PROJECT_ROOT%\client\package.json") do for %%B in ("%PROJECT_ROOT%\client\node_modules") do (
        if "%%~tA" GTR "%%~tB" set NEED_CLIENT=1
    )
)

if !NEED_SERVER! EQU 1 (
    echo [INFO] Installing server dependencies...
    cd /d "%PROJECT_ROOT%\server"
    call npm install --no-audit --no-fund --prefer-offline
    if %ERRORLEVEL% NEQ 0 (echo [ERROR] Server dependency installation failed && exit /b 1)
    echo [OK] Server dependencies installed
) else (
    echo [INFO] Server dependencies up-to-date (skip)
)

if !NEED_CLIENT! EQU 1 (
    echo [INFO] Installing client dependencies...
    cd /d "%PROJECT_ROOT%\client"
    call npm install --no-audit --no-fund --prefer-offline
    if %ERRORLEVEL% NEQ 0 (echo [ERROR] Client dependency installation failed && exit /b 1)
    echo [OK] Client dependencies installed
) else (
    echo [INFO] Client dependencies up-to-date (skip)
)
echo.

REM ===== Generate .env =====
cd /d "%PROJECT_ROOT%"
if not exist "server\.env" (
    echo [INFO] Creating server\.env from template...
    copy "server\.env.example" "server\.env" >nul
    echo [WARN] Please edit server\.env to set your JWT secrets and SMTP config
) else (
    echo [INFO] server\.env already exists, skip
)
echo.

REM ===== Start containers (PostgreSQL + Redis) =====
echo [INFO] Starting %CONTAINER_RUNTIME_NAME% containers (PostgreSQL + Redis)...
cd /d "%PROJECT_ROOT%"
%COMPOSE_CMD% ps --format "{{.Status}}" 2>nul | findstr "Up" >nul
if !ERRORLEVEL! NEQ 0 (
    %COMPOSE_CMD% up -d
    if !ERRORLEVEL! NEQ 0 (
        echo [ERROR] Failed to start containers.
        echo [INFO] Container logs:
        %COMPOSE_CMD% logs --tail=20
        exit /b 1
    )
) else (
    echo [INFO] %CONTAINER_RUNTIME_NAME% containers already running
)

REM ===== Detect database host =====
set "DB_HOST=localhost"
set "DB_PORT=5432"
if /i "%CONTAINER_RUNTIME%"=="podman" (
    REM Podman on Windows/WSL2: localhost forwarding may not work, use machine IP
    for /f "tokens=2 delims= " %%I in ('podman machine ssh -- ip addr show eth0 2^>nul ^| findstr "inet "') do (
        for /f "tokens=1 delims=/" %%B in ("%%I") do set "DB_HOST=%%B"
    )
)
echo [INFO] Database target: !DB_HOST!:!DB_PORT!

REM ===== Auto-update .env with correct host (Podman WSL2 IP may change) =====
if /i "!DB_HOST!" NEQ "localhost" (
    echo [INFO] Updating server\.env with Podman machine IP (!DB_HOST!)...
    powershell -NoProfile -Command ^
        "$f='%PROJECT_ROOT%\server\.env'; $c=Get-Content $f; ^
         $c=$c -replace '(@)([^:/@]+)(:5432)', \"@!DB_HOST!:5432\"; ^
         $c=$c -replace 'REDIS_HOST=.*', 'REDIS_HOST=!DB_HOST!'; ^
         Set-Content $f $c -NoNewline:$false"
)

REM Wait for PostgreSQL to accept TCP connections
echo [INFO] Waiting for PostgreSQL (!DB_HOST!:!DB_PORT!)...
set /a _db_wait=0
set _db_retried=0
:wait_pg_setup
node "%SCRIPT_DIR%check-port.js" "!DB_HOST!" "!DB_PORT!" >nul 2>nul
if !ERRORLEVEL! EQU 0 goto pg_ready
set /a _db_wait+=1
if !_db_wait! GEQ 30 (
    if !_db_retried! EQU 0 (
        echo [WARN] PostgreSQL not ready after 30s, restarting containers...
        %COMPOSE_CMD% restart
        echo [INFO] Container status:
        %COMPOSE_CMD% ps
        set _db_retried=1
        set /a _db_wait=0
        timeout /t 3 /nobreak >nul 2>nul
        goto wait_pg_setup
    )
    echo [ERROR] PostgreSQL connection timeout (60 seconds total)
    echo [INFO] Container logs:
    %COMPOSE_CMD% logs postgres --tail=30
    exit /b 1
)
timeout /t 1 /nobreak >nul 2>nul
goto wait_pg_setup
:pg_ready
echo [OK] PostgreSQL ready
echo.

REM ===== Initialize database =====
echo [INFO] Initializing database...
cd /d "%PROJECT_ROOT%\server"

REM Prisma generate with retry (Windows file lock workaround)
set RETRY=0
:retry_generate
call npx prisma generate
if %ERRORLEVEL% EQU 0 goto generate_ok
set /a RETRY+=1
if !RETRY! GEQ 3 (
    echo [ERROR] Prisma generate failed after 3 attempts
    exit /b 1
)
echo [WARN] Prisma generate failed, retrying ^(!RETRY!/3^)...
timeout /t 3 /nobreak >nul 2>nul
goto retry_generate

:generate_ok
REM Use migrate deploy (faster, ~2s) when possible; fall back to migrate dev
call npx prisma migrate deploy 2>nul
if %ERRORLEVEL% EQU 0 goto migrate_ok
echo [INFO] migrate deploy unavailable, using migrate dev...
call npx prisma migrate dev
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Database migration failed
    exit /b 1
)
:migrate_ok
echo [OK] Database initialized
echo.

echo [OK] =========================================
echo [OK]   Setup complete!
echo [OK] =========================================
echo.
echo Run scripts\start.bat to start all services
echo.

endlocal
