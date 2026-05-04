@echo off
REM TuLing - Common utilities (CMD Batch)
set "SCRIPT_DIR=%~dp0"
pushd "%~dp0.."
set "PROJECT_ROOT=%CD%"
popd
set "PIDS_DIR=%~dp0.pids"
if not exist "%PIDS_DIR%" mkdir "%PIDS_DIR%" >nul 2>nul

REM ===== Get public IP via PowerShell =====
REM Sets __public_ip variable. Call with: call :get_public_ip
:get_public_ip
set "__public_ip="
for /f "usebackq delims=" %%p in (`powershell -NoProfile -Command ^
  "$s=@('https://ifconfig.me/ip','https://api.ipify.org','https://ip.sb');foreach($u in $s){try{$r=(Invoke-WebRequest -Uri $u -TimeoutSec 3 -UseBasicParsing).Content.Trim();if($r -match '^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$'){Write-Host $r -NoNewline;exit 0}}catch{}}Write-Host ''" 2^>nul`) do set "__public_ip=%%p"
goto :eof
