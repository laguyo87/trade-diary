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

  # Close the app if running (avoids file-in-use on update)
  Get-Process -Name TradeDiary -ErrorAction SilentlyContinue | Stop-Process -Force
  Start-Sleep -Milliseconds 400

  if (Test-Path $dst) { Remove-Item $dst -Recurse -Force }
  New-Item -ItemType Directory -Path $dst -Force | Out-Null

  robocopy $Src $dst /E /NFL /NDL /NJH /NJS /NP | Out-Null
  if ($LASTEXITCODE -ge 8) { throw "robocopy failed (code $LASTEXITCODE)" }

  if (-not (Test-Path (Join-Path $dst 'TradeDiary.exe'))) { throw 'TradeDiary.exe missing after copy' }
  'OK' | Out-File -FilePath $Marker -Encoding ASCII
} catch {
  ('ERR ' + $_.Exception.Message) | Out-File -FilePath $Marker -Encoding ASCII
  exit 1
}
