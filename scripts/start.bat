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

REM Wait for ports (with timeout + auto-restart)
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

REM ===== Free port 3000 if in use =====
netstat -ano 2>nul | findstr ":3000.*LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [WARN] Port 3000 is in use, stopping existing backend process...
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":3000.*LISTENING"') do (
        taskkill /PID %%a /T /F >nul 2>nul
    )
    timeout /t 1 /nobreak >nul 2>nul
    echo [OK] Port 3000 freed
)

echo.
echo [INFO] Starting backend (NestJS) on port 3000...
start "TuLing-Server" cmd /k "cd /d "%PROJECT_ROOT%\server" && title TuLing-Server && npm run start:dev"
echo [OK] Backend started (check the new window for logs)

REM Wait until backend binds port 3000
call :wait_port_listening 3000 20

REM Save the root cmd.exe PID by walking up the process tree from the port PID
call :save_root_pid 3000 "server.pid"

REM ===== Free port 5173 if in use =====
netstat -ano 2>nul | findstr ":5173.*LISTENING" >nul
if %ERRORLEVEL% EQU 0 (
    echo [WARN] Port 5173 is in use, stopping existing frontend process...
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":5173.*LISTENING"') do (
        taskkill /PID %%a /T /F >nul 2>nul
    )
    timeout /t 1 /nobreak >nul 2>nul
    echo [OK] Port 5173 freed
)

echo.
echo [INFO] Starting frontend (Vite) on port 5173...
start "TuLing-Client" cmd /k "cd /d "%PROJECT_ROOT%\client" && title TuLing-Client && npm run dev"
echo [OK] Frontend started (check the new window for logs)

REM Wait until frontend binds port 5173
call :wait_port_listening 5173 20

REM Save the root cmd.exe PID by walking up the process tree from the port PID
call :save_root_pid 5173 "client.pid"

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
    endlocal & goto :eof
)
if %__welapsed% LSS %__wtimeout% goto wsploop
echo [WARN] Port %__wport% wait timeout - %__wtimeout% sec
endlocal & goto :eof

REM ===== Subroutine: save root process PID by walking up from port PID =====
:save_root_pid
setlocal
set /a __rport=%1
set "__rpidfile=%~2"
REM Find PID listening on the port
set __leaf_pid=
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":%__rport%.*LISTENING"') do (
    set "__leaf_pid=%%a"
)
if not defined __leaf_pid (
    echo [WARN] Cannot find PID for port %__rport%
    endlocal & goto :eof
)
REM Walk up the process tree: keep replacing current PID with its parent
REM until parent is not a cmd.exe/node.exe (i.e. we've reached the root of our tree)
set "__cur_pid=%__leaf_pid%"
set /a __safety=0
:walkup
set "__ppid="
for /f "tokens=2 delims==" %%a in ('wmic process where "ProcessId=%__cur_pid%" get ParentProcessId /value 2^>nul ^| findstr "ParentProcessId"') do (
    set "__ppid=%%a"
)
if not defined __ppid goto :walkup_done
REM Check if parent is a cmd.exe or node.exe (part of our process tree)
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
