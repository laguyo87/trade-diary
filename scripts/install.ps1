# Installs the portable build to C:\Program Files\TradeDiary and (re)creates
# the desktop shortcut. The privileged copy runs in an elevated child process
# (UAC); the shortcut is created here without elevation.
#
# NOTE: This file is intentionally ASCII-only. The Korean shortcut name is built
# from Unicode code points so it survives regardless of how PowerShell decodes
# this script file. (매매일지 = U+B9E4 U+B9E4 U+C77C U+C9C0)
$ErrorActionPreference = 'Stop'

$root = Split-Path -Parent $PSScriptRoot
$src = Join-Path $root 'release\TradeDiary-win'
$dst = 'C:\Program Files\TradeDiary'
$copyScript = Join-Path $PSScriptRoot 'copy-to-programfiles.ps1'
$marker = Join-Path $root 'release\td_install_marker.txt'

if (-not (Test-Path $src)) {
  Write-Host '[install] release\TradeDiary-win not found. Run `npm run app:portable` first.'
  exit 1
}
Remove-Item $marker -ErrorAction SilentlyContinue

Write-Host '[install] Copying to C:\Program Files (approve the UAC prompt if it appears) ...'
try {
  Start-Process powershell -Verb RunAs -Wait -ArgumentList @(
    '-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', $copyScript, '-Src', $src, '-Marker', $marker
  )
} catch {
  Write-Host ('[install] Elevation was cancelled or failed: ' + $_.Exception.Message)
  exit 1
}

$res = if (Test-Path $marker) { (Get-Content $marker -Raw).Trim() } else { '' }
Remove-Item $marker -ErrorAction SilentlyContinue
if ($res -notlike 'OK*') {
  Write-Host ('[install] Copy failed: ' + $res)
  exit 1
}

# Desktop shortcut (Korean name via code points)
$name = -join ([char]0xB9E4, [char]0xB9E4, [char]0xC77C, [char]0xC9C0) # 매매일지
$exe = Join-Path $dst 'TradeDiary.exe'
$desktop = [Environment]::GetFolderPath('Desktop')
$lnk = Join-Path $desktop ($name + '.lnk')
$ws = New-Object -ComObject WScript.Shell
$sc = $ws.CreateShortcut($lnk)
$sc.TargetPath = $exe
$sc.WorkingDirectory = $dst
$sc.IconLocation = "$exe,0"
$sc.Description = $name
$sc.Save()

Write-Host ''
Write-Host ('[install] Done. Installed: ' + $exe)
Write-Host ('[install] Shortcut: ' + $lnk)
