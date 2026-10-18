# LibreTV local launcher: start the server if needed, then open the browser.
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
Set-Location $root
$url = 'http://localhost:8080'
$ProgressPreference = 'SilentlyContinue'

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
