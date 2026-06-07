# Elevated copy step (ASCII-only on purpose: Windows PowerShell may read a
# no-BOM UTF-8 file as ANSI, which would corrupt non-ASCII characters).
# Copies the portable build into C:\Program Files\TradeDiary.
param(
  [Parameter(Mandatory = $true)][string]$Src,
  [Parameter(Mandatory = $true)][string]$Marker
)
$ErrorActionPreference = 'Stop'
$dst = 'C:\Program Files\TradeDiary'
Remove-Item $Marker -ErrorAction SilentlyContinue
try {
  if (-not (Test-Path $Src)) { throw "source not found: $Src" }

  # Close the app if running, then wait until all processes are gone
  # (Electron spawns main+renderer+GPU; DLLs stay locked until they exit)
  Get-Process -Name TradeDiary -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
  for ($w = 0; $w -lt 25; $w++) {
    if (-not (Get-Process -Name TradeDiary -ErrorAction SilentlyContinue)) { break }
    Start-Sleep -Milliseconds 300
  }
  Start-Sleep -Milliseconds 600

  # Copy with retry — file locks (e.g. d3dcompiler_47.dll) can linger briefly
  $copied = $false
  for ($attempt = 1; $attempt -le 4 -and -not $copied; $attempt++) {
    try {
      if (Test-Path $dst) { Remove-Item $dst -Recurse -Force -ErrorAction Stop }
      New-Item -ItemType Directory -Path $dst -Force | Out-Null
      robocopy $Src $dst /E /NFL /NDL /NJH /NJS /NP | Out-Null
      if ($LASTEXITCODE -ge 8) { throw "robocopy failed (code $LASTEXITCODE)" }
      if (-not (Test-Path (Join-Path $dst 'TradeDiary.exe'))) { throw 'TradeDiary.exe missing after copy' }
      $copied = $true
    } catch {
      if ($attempt -eq 4) { throw }
      Start-Sleep -Seconds 1
    }
  }
  'OK' | Out-File -FilePath $Marker -Encoding ASCII
} catch {
  ('ERR ' + $_.Exception.Message) | Out-File -FilePath $Marker -Encoding ASCII
  exit 1
}
