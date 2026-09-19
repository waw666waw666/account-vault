@echo off
chcp 65001 >nul
REM 停止账号库服务（端口 5188）
cd /d "%~dp0"

powershell -NoProfile -ExecutionPolicy Bypass -Command "Get-NetTCPConnection -LocalPort 5188 -State Listen -ErrorAction SilentlyContinue | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force -ErrorAction SilentlyContinue }"

echo.
echo 账号库服务已停止（端口 5188）。
echo.
timeout /t 2 >nul
exit
