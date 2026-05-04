@echo off
setlocal enabledelayedexpansion
call "%~dp0common.bat"

echo =========================================
echo   TuLing - One-Click Start
echo =========================================
echo.

REM ===== Check Docker =====
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

REM ===== Start Docker containers =====
cd /d "%PROJECT_ROOT%"
docker compose ps --format "{{.Status}}" 2>nul | findstr "Up" >nul
if %ERRORLEVEL% NEQ 0 (
    echo [INFO] Starting Docker containers...
    docker compose up -d
) else (
    echo [INFO] Docker containers already running
)

REM ===== Wait for PostgreSQL and Redis (with auto-restart) =====
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
netstat -ano 2>nul | findstr ":%__port%" >nul
if %ERRORLEVEL% EQU 0 (
    echo [OK] Port %__port% - %__name% ready
    endlocal & goto :eof
)
timeout /t 1 /nobreak >nul 2>nul
set /a __elapsed+=1
if %__elapsed% LSS %__timeout% goto wploop
if %__retried% EQU 1 (
    echo [ERROR] Port %__port% timeout - %__timeout% sec
    endlocal & exit /b 1
)
echo [WARN] Port %__port% timeout, restarting Docker containers...
docker compose restart >nul 2>nul
set /a __retried=1
set /a __elapsed=0
timeout /t 2 /nobreak >nul 2>nul
goto wploop
endlocal
:after_wait

REM ===== Build backend =====
echo.
echo [INFO] Building backend (NestJS)...
cd /d "%PROJECT_ROOT%\server"
call npm run build
if %ERRORLEVEL% NEQ 0 (
    echo [ERROR] Backend build failed
    exit /b 1
)
echo [OK] Backend build complete

REM ===== Build frontend =====
echo.
echo [INFO] Building frontend (Vite)...
cd /d "%PROJECT_ROOT%\client"
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
call :get_public_ip
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
call :get_public_ip
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
