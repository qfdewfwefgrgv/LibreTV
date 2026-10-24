# LibreTV local launcher: start the server if needed, then open the browser.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$url = 'http://localhost:8080'
$ProgressPreference = 'SilentlyContinue'

# 本地影库服务（作为点播源），端口 8090
$cmsDir = Join-Path (Split-Path -Parent $root) 'local-cms'
$cmsRunning = $false
try { $cmsRunning = [bool](Get-NetTCPConnection -LocalPort 8090 -State Listen -ErrorAction SilentlyContinue) } catch { }
if (-not $cmsRunning -and (Test-Path (Join-Path $cmsDir 'server.mjs'))) {
    Write-Host 'Starting local media library on 8090 ...'
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'node server.mjs' -WorkingDirectory $cmsDir
    for ($i = 0; $i -lt 20; $i++) {
        Start-Sleep -Milliseconds 500
        try {
            Invoke-WebRequest -Uri 'http://127.0.0.1:8090/' -UseBasicParsing -TimeoutSec 2 | Out-Null
            break
        } catch { }
    }
}

$running = $false
try { $running = [bool](Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue) } catch { }

if ($running) {
    Write-Host 'LibreTV is already running.'
} else {
    Write-Host 'Starting LibreTV server ...'
    Start-Process -FilePath 'cmd.exe' -ArgumentList '/k', 'npm start' -WorkingDirectory $root
    for ($i = 0; $i -lt 40; $i++) {
        Start-Sleep -Milliseconds 800
        try {
            Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 3 | Out-Null
            $running = $true
            break
        } catch { }
    }
    if (-not $running) { Write-Host 'Server did not respond in time; opening the page anyway.' }
}

Start-Process $url
