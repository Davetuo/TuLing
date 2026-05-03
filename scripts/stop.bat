@echo off
setlocal enabledelayedexpansion
call "%~dp0common.bat"

echo.
echo =========================================
echo   TuLing - One-Click Stop
echo =========================================
echo.

REM ===== Stop backend =====
echo [INFO] Stopping backend...

set FOUND=0

REM Fast path: use PID file saved by start.bat
if exist "%PIDS_DIR%\server.pid" (
    set /p SPID=<"%PIDS_DIR%\server.pid"
    taskkill /PID !SPID! /T /F >nul 2>nul
    if !ERRORLEVEL! EQU 0 set FOUND=1
    del "%PIDS_DIR%\server.pid" >nul 2>nul
)

REM Fallback: kill by port (only if PID file didn't work)
if !FOUND! EQU 0 (
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":3000.*LISTENING"') do (
        taskkill /PID %%a /T /F >nul 2>nul
        set FOUND=1
    )
)

if !FOUND! EQU 1 (
    echo [OK] Backend stopped
) else (
    echo [INFO] Backend not running
)

REM ===== Stop frontend =====
echo [INFO] Stopping frontend...

set FOUND=0

REM Fast path: use PID file saved by start.bat
if exist "%PIDS_DIR%\client.pid" (
    set /p CPID=<"%PIDS_DIR%\client.pid"
    taskkill /PID !CPID! /T /F >nul 2>nul
    if !ERRORLEVEL! EQU 0 set FOUND=1
    del "%PIDS_DIR%\client.pid" >nul 2>nul
)

REM Fallback: kill by port (only if PID file didn't work)
if !FOUND! EQU 0 (
    for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":5173.*LISTENING"') do (
        taskkill /PID %%a /T /F >nul 2>nul
        set FOUND=1
    )
)

if !FOUND! EQU 1 (
    echo [OK] Frontend stopped
) else (
    echo [INFO] Frontend not running
)

REM ===== Stop Docker containers (keep data volumes) =====
echo.
echo [INFO] Stopping Docker containers - data preserved...
cd /d "%PROJECT_ROOT%"
docker compose down
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Docker stop encountered an issue - may already be stopped
) else (
    echo [OK] Docker containers stopped
)
echo.

echo [OK] =========================================
echo [OK]   All services stopped (data preserved)
echo [OK] =========================================
echo.
echo Run scripts\start.bat to restart
echo.

endlocal
