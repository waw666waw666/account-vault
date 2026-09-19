try { chcp 65001 | Out-Null } catch {}
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
$OutputEncoding = [System.Text.Encoding]::UTF8
$Host.UI.RawUI.WindowTitle = '账号库 (Account Vault)'

$root = (Split-Path -Parent $PSScriptRoot)

function Fail-And-Exit([string]$message, [string]$hint) {
    Clear-Host
    Write-Host ""
    Write-Host "=======================================================" -ForegroundColor Red
    Write-Host "  启动失败" -ForegroundColor Red
    Write-Host "=======================================================" -ForegroundColor Red
    Write-Host ""
    Write-Host "  $message" -ForegroundColor Yellow
    Write-Host ""
    if ($hint) { Write-Host "  $hint" -ForegroundColor Gray; Write-Host "" }
    Write-Host "  按任意键关闭此窗口..." -ForegroundColor Cyan
    $null = $Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
    exit 1
}

Write-Host ""
Write-Host "[1/3] 检查运行环境..." -ForegroundColor Cyan

$node = Get-Command node -ErrorAction SilentlyContinue
if (-not $node) {
    Fail-And-Exit "未检测到 Node.js。" "请先安装 Node.js（18 以上版本）：https://nodejs.org`n  安装完成后重新双击 run.bat。"
}

$npm = Get-Command npm -ErrorAction SilentlyContinue
if (-not $npm) {
    Fail-And-Exit "检测到 Node.js，但找不到 npm。" "请重新安装 Node.js（选择默认选项即可）：https://nodejs.org"
}

$nodeVersion = (& node -v) -replace '^v', ''
$nodeMajor = [int]($nodeVersion -split '\.')[0]
if ($nodeMajor -lt 18) {
    Fail-And-Exit "Node.js 版本过低（当前 v$nodeVersion，需要 v18 或更高）。" "请升级 Node.js：https://nodejs.org"
}
Write-Host "      Node.js v$nodeVersion  OK" -ForegroundColor Green

Write-Host "[2/3] 检查项目依赖..." -ForegroundColor Cyan
$viteBin = Join-Path $root 'node_modules\vite\bin\vite.js'
if (-not (Test-Path $viteBin)) {
    Write-Host "      首次运行，正在安装依赖（需联网，约 10-60 秒）..." -ForegroundColor Yellow
    Push-Location $root
    $installLog = & npm install --no-audit --no-fund 2>&1
    $installCode = $LASTEXITCODE
    Pop-Location

    if ($installCode -ne 0 -or -not (Test-Path $viteBin)) {
        Write-Host ""
        Write-Host "      依赖安装失败，最后几行输出：" -ForegroundColor Red
        $installLog | Select-Object -Last 12 | ForEach-Object { Write-Host "        $_" -ForegroundColor DarkGray }
        Fail-And-Exit "依赖安装未成功。" "请确认电脑已联网，然后重新双击 run.bat。`n  如果反复失败，请检查网络代理或换用手机热点。"
    }
}
Write-Host "      依赖已就绪  OK" -ForegroundColor Green

Write-Host "[3/3] 启动服务..." -ForegroundColor Cyan

if (-not (Get-NetTCPConnection -LocalPort 5188 -State Listen -ErrorAction SilentlyContinue)) {
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/c','npm run dev' -WorkingDirectory $root -WindowStyle Hidden
}

$ready = $false
for ($i = 0; $i -lt 60; $i++) {
    Start-Sleep -Milliseconds 500
    if (Get-NetTCPConnection -LocalPort 5188 -State Listen -ErrorAction SilentlyContinue) { $ready = $true; break }
}

if (-not $ready) {
    Fail-And-Exit "服务未能在 30 秒内启动（端口 5188 未监听）。" "请先双击 stop.bat 关闭残留进程，再重新双击 run.bat。"
}

Start-Process 'http://127.0.0.1:5188/'

Clear-Host
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "  账号库 已启动成功！" -ForegroundColor Green
Write-Host "=======================================================" -ForegroundColor Green
Write-Host "  访问地址 : http://127.0.0.1:5188/" -ForegroundColor White
Write-Host "  后台状态 : 服务已常驻系统后台" -ForegroundColor Cyan
Write-Host ""
Write-Host "  关闭服务 : 双击 stop.bat" -ForegroundColor Gray
Write-Host "=======================================================" -ForegroundColor Green
Write-Host ""
Write-Host "本窗口将在 5 秒后自动关闭..." -ForegroundColor Yellow

Start-Sleep -Seconds 5
