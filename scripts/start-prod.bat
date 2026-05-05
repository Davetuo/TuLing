@echo off
setlocal enabledelayedexpansion
call "%~dp0common.bat"
if %ERRORLEVEL% NEQ 0 exit /b 1


echo =========================================
echo   TuLing - Production Start
echo =========================================
echo.

REM Container runtime
echo [INFO] %CONTAINER_RUNTIME_NAME% ready (ok)


REM Containers
cd /d "%PROJECT_ROOT%"
%COMPOSE_CMD% ps --format "{{.Status}}" 2>nul | findstr "Up" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Starting %CONTAINER_RUNTIME_NAME% containers...
    %COMPOSE_CMD% up -d
) else (
    echo [INFO] %CONTAINER_RUNTIME_NAME% containers already running
)


REM Wait for ports
call :wait_port 5432 "PostgreSQL" 30
call :wait_port 6379 "Redis" 30

REM Build backend
echo.
echo [INFO] Building backend (NestJS)...
cd /d "%PROJECT_ROOT%\server"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend build failed
    exit /b 1
)
echo [OK] Backend build complete

REM Build frontend
echo.
echo [INFO] Building frontend (Vite)...
cd /d "%PROJECT_ROOT%\client"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed
    exit /b 1
)
echo [OK] Frontend build complete

REM Free port 3000
netstat -ano 2>nul | findstr ":3000.*LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [WARN] Port 3000 is in use, stopping existing process...
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":3000.*LISTENING"') do (
        taskkill /PID %%a /T /F >nul 2>nul
    )
    timeout /t 1 /nobreak >nul 2>nul
    echo [OK] Port 3000 freed
)

REM Start production server
echo.
echo [INFO] Starting production server (NestJS + static files)...
cd /d "%PROJECT_ROOT%\server"
set NODE_ENV=production
start "TuLing-Prod" cmd /k "cd /d "%PROJECT_ROOT%\server" && title TuLing-Prod && set NODE_ENV=production && node dist/main"
echo [OK] Production server started (check the new window for logs)

REM Wait for server
timeout /t 3 /nobreak >nul 2>nul

REM Get network IP
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4.*:.*\.[0-9]" 2^>nul') do (
    set "__lanip=%%a"
    set "__lanip=!__lanip: =!"
    if not "!__lanip!"=="127.0.0.1" if "!__lanip:~0,3!" NEQ "172" goto :found_ip
)
goto :no_ip
:found_ip
echo.
echo [OK] =========================================
echo [OK]   Production server started
echo [OK] =========================================
echo.
echo   Local:   http://localhost:3000
echo   Network: http://%__lanip%:3000
call "%~dp0common.bat" get_public_ip
if defined __public_ip (
    echo   Public:  http://%__public_ip%:3000
    echo   [WARN] Please configure port forwarding on router (3000 -^> %__lanip%:3000)
    echo.
)

echo.
goto :end
:no_ip
echo.
echo [OK] =========================================
echo [OK]   Production server started
echo [OK] =========================================
echo.
echo   Local:   http://localhost:3000
call "%~dp0common.bat" get_public_ip
if defined __public_ip (
    echo   Public:  http://%__public_ip%:3000
    echo.
)

echo.
:end
echo Run scripts\stop.bat to stop all services
echo.

endlocal
exit /b 0

REM ===== Subroutine: wait for port to be LISTENING =====
:wait_port
setlocal
set /a __port=%1
set "__name=%~2"
set /a __timeout=%3
set /a __elapsed=0
:wploop
timeout /t 1 /nobreak >nul 2>nul
set /a __elapsed+=1
netstat -ano 2>nul | findstr /R ":%__port%.*LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Port %__port% - %__name% ready
    endlocal & goto :eof
)
if %__elapsed% LSS %__timeout% goto wploop
echo [ERROR] Port %__port% timeout - %__timeout% sec
endlocal & exit /b 1
