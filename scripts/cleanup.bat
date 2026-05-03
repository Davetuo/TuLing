@echo off
setlocal enabledelayedexpansion
call "%~dp0common.bat"

echo.
echo =========================================
echo   ! TuLing - One-Click Cleanup
echo   WARNING: This is IRREVERSIBLE!
echo =========================================
echo.
echo This will:
echo   1. Stop all running service processes
echo   2. Remove Docker containers AND data volumes (DB data will be lost)
echo   3. Delete node_modules\ directories
echo   4. Delete dist\ build artifacts
echo.

set /p CONFIRM="[?] Are you sure you want to continue? [y/N] "
if /i not "%CONFIRM%"=="y" (
    echo [INFO] Cleanup cancelled
    exit /b 0
)

echo.
echo [INFO] Stopping app processes...

REM Kill node on port 3000 then close cmd window
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":3000.*LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f %%a in ('powershell -NoProfile -Command "Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*TuLing-Server*' } | ForEach-Object { $_.Id }" 2^>nul') do (
    taskkill /PID %%a /T /F >nul 2>&1
)

REM Kill node on port 5173 then close cmd window
for /f "tokens=5" %%a in ('netstat -ano 2^>nul ^| findstr /R ":5173.*LISTENING"') do (
    taskkill /PID %%a /F >nul 2>&1
)
for /f %%a in ('powershell -NoProfile -Command "Get-Process cmd -ErrorAction SilentlyContinue | Where-Object { $_.MainWindowTitle -like '*TuLing-Client*' } | ForEach-Object { $_.Id }" 2^>nul') do (
    taskkill /PID %%a /T /F >nul 2>&1
)

echo [OK] App processes stopped
echo.

echo [INFO] Removing Docker containers and data volumes...
cd /d "%PROJECT_ROOT%"
docker compose down -v
if %ERRORLEVEL% NEQ 0 (
    echo [WARN] Docker cleanup encountered an issue
) else (
    echo [OK] Docker containers and data volumes removed
)
echo.

echo [INFO] Removing node_modules\ ...
if exist "%PROJECT_ROOT%\server\node_modules" (
    rmdir /s /q "%PROJECT_ROOT%\server\node_modules" 2>nul Some native binaries may remain locked — harmless, npm install will overwrite
)
if exist "%PROJECT_ROOT%\client\node_modules" (
    rmdir /s /q "%PROJECT_ROOT%\client\node_modules" 2>nul Some native binaries may remain locked — harmless, npm install will overwrite
)
echo [OK] node_modules\ removed

echo [INFO] Removing build artifacts...
if exist "%PROJECT_ROOT%\server\dist" (
    rmdir /s /q "%PROJECT_ROOT%\server\dist"
)
del /q "%PROJECT_ROOT%\server\*.tsbuildinfo" 2>nul
del /q "%PROJECT_ROOT%\client\*.tsbuildinfo" 2>nul
echo [OK] Build artifacts removed
echo.

REM ===== Clean up PID directory =====
if exist "%PIDS_DIR%" rmdir /s /q "%PIDS_DIR%" 2>nul

echo [OK] =========================================
echo [OK]   Cleanup complete!
echo [OK] =========================================
echo.
echo To redeploy: scripts\setup.bat ^&^& scripts\start.bat
echo.

endlocal
