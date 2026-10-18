# LibreTV local stop helper: stop the process listening on port 8080.
$conns = Get-NetTCPConnection -LocalPort 8080 -State Listen -ErrorAction SilentlyContinue
if ($conns) {
    foreach ($c in $conns) { Stop-Process -Id $c.OwningProcess -Force -ErrorAction SilentlyContinue }
    Write-Host 'LibreTV stopped.'
} else {
    Write-Host 'LibreTV is not running.'
}
Start-Sleep -Seconds 2
