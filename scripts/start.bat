@echo off
setlocal enabledelayedexpansion
call "%~dp0common.bat"
if %ERRORLEVEL% NEQ 0 exit /b 1


echo =========================================
echo   TuLing - One-Click Start
echo =========================================
echo.

REM ===== Container runtime =====
echo [INFO] %CONTAINER_RUNTIME_NAME% ready (ok)

REM ===== Start containers =====
cd /d "%PROJECT_ROOT%"
%COMPOSE_CMD% ps --format "{{.Status}}" 2>nul | findstr "Up" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Starting %CONTAINER_RUNTIME_NAME% containers...
    %COMPOSE_CMD% up -d
) else (
    echo [INFO] %CONTAINER_RUNTIME_NAME% containers already running
)


REM ===== Detect service host (Podman WSL2 uses machine IP) =====
set "SVC_HOST=localhost"
if /i "%CONTAINER_RUNTIME%"=="podman" (
    for /f "tokens=2 delims= " %%I in ('podman machine ssh -- ip addr show eth0 2^>nul ^| findstr "inet "') do (
        for /f "tokens=1 delims=/" %%B in ("%%I") do set "SVC_HOST=%%B"
    )
)

REM ===== Wait for PostgreSQL and Redis =====
call :wait_port 5432 "PostgreSQL" 30
call :wait_port 6379 "Redis" 30
goto :after_wait

:wait_port
setlocal
set /a __port=%1
set "__name=%~2"
set /a __timeout=%3
set /a __elapsed=0
set /a __retried=0
:wploop
node "%SCRIPT_DIR%check-port.js" "%SVC_HOST%" "%__port%" >nul 2>nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] %__name% ready (%SVC_HOST%:%__port%)
    endlocal & goto :eof
)
timeout /t 1 /nobreak >nul 2>nul
set /a __elapsed+=1
if %__elapsed% LSS %__timeout% goto wploop
if %__retried% EQU 1 (
    echo [ERROR] %__name% timeout - %__timeout% sec
    endlocal & exit /b 1
)
echo [WARN] %__name% timeout, restarting %CONTAINER_RUNTIME_NAME% containers...
%COMPOSE_CMD% restart >nul 2>nul

set /a __retried=1
set /a __elapsed=0
timeout /t 2 /nobreak >nul 2>nul
goto wploop
endlocal
:after_wait

REM ===== Database migration =====
echo.
echo [INFO] Running database migration (Prisma)...
cd /d "%PROJECT_ROOT%\server"
call npx prisma generate
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Prisma generate failed
    exit /b 1
)
call npx prisma migrate deploy
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Database migration failed
    exit /b 1
)
echo [OK] Database migration complete

REM ===== Install backend dependencies =====
echo.
cd /d "%PROJECT_ROOT%\server"
if not exist "node_modules\" (
    echo [INFO] Installing backend dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Backend npm install failed
        exit /b 1
    )
    echo [OK] Backend dependencies installed
) else (
    echo [INFO] Backend dependencies already installed
)

REM ===== Build backend =====
echo [INFO] Building backend (NestJS)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend build failed
    exit /b 1
)
echo [OK] Backend build complete

REM ===== Install frontend dependencies =====
echo.
cd /d "%PROJECT_ROOT%\client"
if not exist "node_modules\" (
    echo [INFO] Installing frontend dependencies...
    call npm install
    if %ERRORLEVEL% NEQ 0 (
        echo [ERROR] Frontend npm install failed
        exit /b 1
    )
    echo [OK] Frontend dependencies installed
) else (
    echo [INFO] Frontend dependencies already installed
)

REM ===== Build frontend =====
echo [INFO] Building frontend (Vite)...
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Frontend build failed
    exit /b 1
)
echo [OK] Frontend build complete

REM ===== Free port 3000 if in use =====
netstat -ano 2>nul | findstr ":3000.*LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [WARN] Port 3000 is in use, stopping existing process...
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":3000.*LISTENING"') do (
        taskkill /PID %%a /T /F >nul 2>nul
    )
    timeout /t 1 /nobreak >nul 2>nul
    echo [OK] Port 3000 freed
)

REM ===== Start production server =====
echo.
echo [INFO] Starting production server (NestJS + static files)...
cd /d "%PROJECT_ROOT%\server"
set NODE_ENV=production
start "TuLing-Server" cmd /k "title TuLing-Server && node dist/main"
echo [OK] Server started (check the new window for logs)

REM ===== Wait for server to be ready =====
call :wait_port_listening 3000 30

REM ===== Save PID for clean shutdown =====
call :save_root_pid 3000 "server.pid"

REM ===== Get LAN IP =====
for /f "tokens=2 delims=:" %%a in ('ipconfig ^| findstr /R "IPv4.*:.*\.[0-9]" 2^>nul') do (
    set "__lanip=%%a"
    set "__lanip=!__lanip: =!"
    if not "!__lanip!"=="127.0.0.1" if "!__lanip:~0,3!" NEQ "172" goto :found_ip
)
goto :no_ip
:found_ip
echo.
echo [OK] =========================================
echo [OK]   All services started
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
goto :done
:no_ip
echo.
echo [OK] =========================================
echo [OK]   All services started
echo [OK] =========================================
echo.
echo   Local:   http://localhost:3000
call "%~dp0common.bat" get_public_ip
if defined __public_ip (
    echo   Public:  http://%__public_ip%:3000
    echo.
)

echo.
:done
echo Run scripts\stop.bat to stop all services
echo.

endlocal
exit /b 0

REM ===== Subroutine: wait for port to be LISTENING =====
:wait_port_listening
setlocal
set /a __wport=%1
set /a __wtimeout=%2
set /a __welapsed=0
:wsploop
timeout /t 1 /nobreak >nul 2>nul
set /a __welapsed+=1
netstat -ano 2>nul | findstr /R ":%__wport%.*LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Server is ready on port %__wport%
    endlocal & goto :eof
)
if %__welapsed% LSS %__wtimeout% goto wsploop
echo [WARN] Port %__wport% wait timeout - %__wtimeout% sec
endlocal & goto :eof

REM ===== Subroutine: save root process PID =====
:save_root_pid
setlocal
set /a __rport=%1
set "__rpidfile=%~2"
set __leaf_pid=
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":%__rport%.*LISTENING"') do (
    set "__leaf_pid=%%a"
)
if not defined __leaf_pid (
    echo [WARN] Cannot find PID for port %__rport%
    endlocal & goto :eof
)
set "__cur_pid=%__leaf_pid%"
set /a __safety=0
:walkup
set "__ppid="
for /f "tokens=2 delims==" %%a in ('wmic process where "ProcessId=%__cur_pid%" get ParentProcessId /value 2^>nul ^| findstr "ParentProcessId"') do (
    set "__ppid=%%a"
)
if not defined __ppid goto :walkup_done
set "__pname="
for /f "tokens=2 delims==" %%a in ('wmic process where "ProcessId=%__ppid%" get Name /value 2^>nul ^| findstr "Name"') do (
    set "__pname=%%a"
)
if not defined __pname goto :walkup_done
if /i "%__pname%"=="cmd.exe" (
    set "__cur_pid=%__ppid%"
    set /a __safety+=1
    if %__safety% LSS 10 goto walkup
    goto :walkup_done
)
if /i "%__pname%"=="node.exe" (
    set "__cur_pid=%__ppid%"
    set /a __safety+=1
    if %__safety% LSS 10 goto walkup
    goto :walkup_done
)
:walkup_done
echo %__cur_pid% > "%PIDS_DIR%\%__rpidfile%"
endlocal & goto :eof
