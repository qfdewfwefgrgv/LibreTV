#requires -RunAsAdministrator
<#
  C 盘应急清理 + 空间体检脚本
  用法（管理员 PowerShell 里一行）：
    irm https://www.dianying.online/tools/clean-c.ps1 -OutFile "$env:TEMP\clean-c.ps1"; powershell -ExecutionPolicy Bypass -File "$env:TEMP\clean-c.ps1"

  只做只读扫描和公认安全的清理，不碰任何分区、不删个人文件。
#>

$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'

function Fmt($bytes) { if (-not $bytes) { return '0' } return [math]::Round($bytes / 1GB, 2) }
function DirSize($path) {
  if (-not (Test-Path $path)) { return 0 }
  $sum = (Get-ChildItem $path -Recurse -File -Force -ErrorAction SilentlyContinue | Measure-Object Length -Sum).Sum
  if ($sum) { return $sum } else { return 0 }
}

Write-Host ''
Write-Host '===== C 盘空间体检 =====' -ForegroundColor Cyan
$c = Get-Volume -DriveLetter C
$before = $c.SizeRemaining
Write-Host ("清理前：C 盘共 {0} GB，剩余 {1} GB" -f (Fmt $c.Size), (Fmt $before)) -ForegroundColor Yellow

Write-Host ''
Write-Host '[1/5] 清理临时文件…' -ForegroundColor Green
Remove-Item "$env:TEMP\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Windows\Temp\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\CrashDumps\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\Microsoft\Windows\WER\*" -Recurse -Force -ErrorAction SilentlyContinue
Remove-Item "$env:LOCALAPPDATA\Microsoft\Windows\Explorer\thumbcache_*.db" -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Windows\Logs\CBS\*.log" -Force -ErrorAction SilentlyContinue

Write-Host '[2/5] 清理 Windows 更新缓存…' -ForegroundColor Green
Stop-Service wuauserv, bits -Force -ErrorAction SilentlyContinue
Remove-Item "C:\Windows\SoftwareDistribution\Download\*" -Recurse -Force -ErrorAction SilentlyContinue
Start-Service wuauserv, bits -ErrorAction SilentlyContinue

Write-Host '[3/5] 清理交付优化缓存与回收站…' -ForegroundColor Green
Delete-DeliveryOptimizationCache -Force -ErrorAction SilentlyContinue
Clear-RecycleBin -Force -ErrorAction SilentlyContinue

Write-Host '[4/5] 清空缩略图与图标缓存…' -ForegroundColor Green
Remove-Item "$env:LOCALAPPDATA\IconCache.db" -Force -ErrorAction SilentlyContinue

Write-Host '[5/5] 统计占用，生成体检报告…' -ForegroundColor Green
$after = (Get-Volume -DriveLetter C).SizeRemaining
Write-Host ''
Write-Host ("清理完成：释放 {0} GB，当前剩余 {1} GB" -f ([math]::Round(($after - $before) / 1GB, 2)), (Fmt $after)) -ForegroundColor Cyan

Write-Host ''
Write-Host '===== 大文件/大目录分布 =====' -ForegroundColor Cyan

Write-Host ''
Write-Host '--- 系统保留文件 ---' -ForegroundColor Yellow
foreach ($f in @('C:\hiberfil.sys', 'C:\pagefile.sys', 'C:\swapfile.sys')) {
  if (Test-Path $f) {
    $item = Get-Item $f -Force
    Write-Host ("{0,-24} {1} GB" -f (Split-Path $f -Leaf), (Fmt $item.Length))
  }
}
if (Test-Path 'C:\Windows.old') {
  Write-Host ("Windows.old 存在，约 {0} GB（可用 cleanmgr 清理）" -f (Fmt (DirSize 'C:\Windows.old'))) -ForegroundColor Magenta
}

Write-Host ''
Write-Host '--- 用户目录 TOP 10 ---' -ForegroundColor Yellow
Get-ChildItem "$env:USERPROFILE" -Directory -Force -ErrorAction SilentlyContinue |
  ForEach-Object {
    [pscustomobject]@{ 目录 = $_.Name; GB = [math]::Round((DirSize $_.FullName) / 1GB, 2) }
  } | Sort-Object GB -Descending | Select-Object -First 10 | Format-Table -AutoSize

Write-Host '--- AppData\Local TOP 10 ---' -ForegroundColor Yellow
Get-ChildItem "$env:LOCALAPPDATA" -Directory -Force -ErrorAction SilentlyContinue |
  ForEach-Object {
    [pscustomobject]@{ 目录 = $_.Name; GB = [math]::Round((DirSize $_.FullName) / 1GB, 2) }
  } | Sort-Object GB -Descending | Select-Object -First 10 | Format-Table -AutoSize

Write-Host '--- C 盘根目录 TOP 10 ---' -ForegroundColor Yellow
Get-ChildItem 'C:\' -Directory -Force -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -notin @('Windows', 'Program Files', 'Program Files (x86)', 'ProgramData') } |
  ForEach-Object {
    [pscustomobject]@{ 目录 = $_.Name; GB = [math]::Round((DirSize $_.FullName) / 1GB, 2) }
  } | Sort-Object GB -Descending | Select-Object -First 10 | Format-Table -AutoSize

Write-Host '--- 系统目录（仅供参考，不要手动删） ---' -ForegroundColor Yellow
foreach ($d in @('C:\Windows', 'C:\Program Files', 'C:\Program Files (x86)', 'C:\ProgramData', 'C:\Windows\WinSxS', 'C:\Windows\Installer')) {
  if (Test-Path $d) {
    Write-Host ("{0,-32} {1} GB" -f $d, (Fmt (DirSize $d)))
  }
}

Write-Host ''
Write-Host '===== 下一步建议 =====' -ForegroundColor Cyan
Write-Host '1) 上面「用户目录 / AppData / C 根目录」的 TOP 表，截图发给助手，按实际大户决定搬哪个。'
Write-Host '2) 虚拟内存可挪到 D 盘（系统属性 -> 高级 -> 性能设置 -> 高级 -> 虚拟内存）。'
Write-Host '3) 系统更新清理：运行 cleanmgr /d C:，勾选「Windows 更新清理」「以前的 Windows 安装」。'
Write-Host '4) 休眠文件：powercfg /h off（已关闭会提示，可忽略）。'
Write-Host ''
Read-Host '按回车关闭窗口'
