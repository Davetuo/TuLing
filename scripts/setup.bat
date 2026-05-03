@echo off
setlocal enabledelayedexpansion
call "%~dp0common.bat"

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

REM ===== Check Docker =====
where docker >nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker not found. Please install Docker Desktop
    exit /b 1
)
docker info >nul
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Docker is not running. Please start Docker Desktop
    exit /b 1
)
echo [INFO] Docker ready (ok)
echo.

REM ===== Install server dependencies =====
echo [INFO] Installing server dependencies...
cd /d "%PROJECT_ROOT%\server"
call npm install --no-audit --no-fund
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Server dependency installation failed
    exit /b 1
)
echo [OK] Server dependencies installed
echo.

REM ===== Install client dependencies =====
echo [INFO] Installing client dependencies...
cd /d "%PROJECT_ROOT%\client"
call npm install --no-audit --no-fund
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Client dependency installation failed
    exit /b 1
)
echo [OK] Client dependencies installed
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

REM ===== Start Docker containers =====
echo [INFO] Starting Docker containers (PostgreSQL + Redis)...
cd /d "%PROJECT_ROOT%"
docker compose ps --format "{{.Status}}" 2>nul | findstr "Up" >nul
if %ERRORLEVEL% NEQ 0 (
    docker compose up -d
) else (
    echo [INFO] Docker containers already running
)

echo [INFO] Waiting for PostgreSQL (port 5432)...
set /a _wait=0
:wait_pg_setup
netstat -ano 2>nul | findstr ":5432" >nul
if %ERRORLEVEL% EQU 0 goto pg_ready
set /a _wait+=1
if %_wait% GEQ 30 (
    if not defined _retried (
        echo [WARN] Port 5432 timeout, restarting Docker containers...
        docker compose restart >nul 2>nul
        set _retried=1
        set /a _wait=0
        timeout /t 2 /nobreak >nul 2>nul
        goto wait_pg_setup
    )
    echo [ERROR] Port 5432 wait timeout - 30 seconds
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

REM Prisma generate may fail on Windows due to file locks from npm install.
REM Retry up to 3 times with a delay between attempts.
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
timeout /t 2 /nobreak >nul 2>nul
goto retry_generate

:generate_ok
call npx prisma migrate dev
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Database migration failed
    exit /b 1
)
echo [OK] Database initialized
echo.

echo [OK] =========================================
echo [OK]   Setup complete!
echo [OK] =========================================
echo.
echo Run scripts\start.bat to start all services
echo.

endlocal
