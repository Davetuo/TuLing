@echo off
REM TuLing - Common utilities (CMD Batch)
set "SCRIPT_DIR=%~dp0"
pushd "%~dp0.."
set "PROJECT_ROOT=%CD%"
popd
set "PIDS_DIR=%~dp0.pids"
if not exist "%PIDS_DIR%" mkdir "%PIDS_DIR%" >nul 2>nul
