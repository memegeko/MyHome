param(
  [string]$InstallDirectory = (Join-Path (Get-Location) 'MyHome'),
  [string]$Ref = 'work'
)
$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
if (Test-Path -LiteralPath $InstallDirectory) {
  throw "Already exists: $InstallDirectory. Use its start-setup.cmd, or choose another InstallDirectory."
}
$nodeVersion = 'v24.14.0'
$tempDirectory = Join-Path ([IO.Path]::GetTempPath()) ('myhome-' + [Guid]::NewGuid().ToString('N'))
New-Item -ItemType Directory -Path $tempDirectory | Out-Null
try {
  $needsNode = $true
  if (Get-Command node -ErrorAction SilentlyContinue) {
    & node -e 'const [a,b]=process.versions.node.split(".").map(Number);process.exit(a>22||(a===22&&b>=18)?0:1)'
    $needsNode = $LASTEXITCODE -ne 0
  }
  if ($needsNode) {
    $architecture = if ($env:PROCESSOR_ARCHITECTURE -eq 'ARM64' -or $env:PROCESSOR_ARCHITEW6432 -eq 'ARM64') { 'arm64' } else { 'x64' }
    $archive = "node-$nodeVersion-win-$architecture.zip"
    Write-Host 'Downloading a local Node.js runtime (no administrator access needed)...'
    Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/$nodeVersion/$archive" -OutFile (Join-Path $tempDirectory $archive)
    Invoke-WebRequest -UseBasicParsing "https://nodejs.org/dist/$nodeVersion/SHASUMS256.txt" -OutFile (Join-Path $tempDirectory 'SHASUMS256.txt')
    $checksumLine = Get-Content (Join-Path $tempDirectory 'SHASUMS256.txt') | Where-Object { ($_ -split '\s+')[1] -eq $archive }
    $expected = ($checksumLine -split '\s+')[0]
    $actual = (Get-FileHash (Join-Path $tempDirectory $archive) -Algorithm SHA256).Hash
    if (-not $expected -or $expected -ne $actual) { throw 'Node.js checksum verification failed.' }
    Expand-Archive -LiteralPath (Join-Path $tempDirectory $archive) -DestinationPath $tempDirectory
  }
  Write-Host 'Downloading MyHome...'
  Invoke-WebRequest -UseBasicParsing "https://codeload.github.com/memegeko/MyHome/zip/$Ref" -OutFile (Join-Path $tempDirectory 'myhome.zip')
  $sourceDirectory = Join-Path $tempDirectory 'source'
  Expand-Archive -LiteralPath (Join-Path $tempDirectory 'myhome.zip') -DestinationPath $sourceDirectory
  $source = Get-ChildItem -LiteralPath $sourceDirectory -Directory | Select-Object -First 1
  if (-not $source -or -not (Test-Path (Join-Path $source.FullName 'package-lock.json'))) { throw 'Download is missing the MyHome lockfile.' }
  New-Item -ItemType Directory -Force -Path (Split-Path -Parent ([IO.Path]::GetFullPath($InstallDirectory))) | Out-Null
  Move-Item -LiteralPath $source.FullName -Destination $InstallDirectory
  if ($needsNode) {
    New-Item -ItemType Directory -Path (Join-Path $InstallDirectory '.cache') -Force | Out-Null
    Move-Item -LiteralPath (Join-Path $tempDirectory "node-$nodeVersion-win-$architecture") -Destination (Join-Path $InstallDirectory '.cache/node')
    $env:Path = (Join-Path $InstallDirectory '.cache/node') + ';' + $env:Path
  }
  @'
@echo off
cd /d "%~dp0"
if exist ".cache\node\node.exe" set "PATH=%CD%\.cache\node;%PATH%"
if not exist "node_modules" (
  call npm.cmd ci --cache .cache/npm
  if errorlevel 1 exit /b 1
)
call npm.cmd run setup:cloudflare
'@ | Set-Content -LiteralPath (Join-Path $InstallDirectory 'start-setup.cmd') -Encoding ASCII
  Push-Location $InstallDirectory
  try {
    & npm.cmd ci --cache .cache/npm
    if ($LASTEXITCODE -ne 0) { throw 'Dependency installation failed. Run npm.cmd ci again in the installation directory.' }
    Write-Host 'Opening MyHome Setup. Keep this terminal open. Later, double-click start-setup.cmd.'
    & npm.cmd run setup:cloudflare
    if ($LASTEXITCODE -ne 0) { throw 'Setup stopped with an error. Retry using start-setup.cmd.' }
  } finally { Pop-Location }
} finally { Remove-Item -LiteralPath $tempDirectory -Recurse -Force }
