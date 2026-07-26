param(
  [ValidateSet("static", "server")]
  [string]$Edition = "static"
)

$ErrorActionPreference = "Stop"

if (-not (Get-Command git -ErrorAction SilentlyContinue)) {
  winget install --id Git.Git --exact --accept-package-agreements --accept-source-agreements
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  winget install --id OpenJS.NodeJS.LTS --exact --accept-package-agreements --accept-source-agreements
  $env:Path = [Environment]::GetEnvironmentVariable("Path", "Machine") + ";" +
    [Environment]::GetEnvironmentVariable("Path", "User")
}

$nodeMajor = [int]((node --version).TrimStart("v").Split(".")[0])
if ($nodeMajor -lt 22) {
  throw "MyHome needs Node.js 22 or newer. Update Node.js and run this command again."
}

npm ci --cache .cache/npm

if ($Edition -eq "server") {
  if (-not (Test-Path ".dev.vars")) {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
    $secret = [Convert]::ToHexString($bytes).ToLower()
    "SESSION_SECRET=$secret" | Set-Content ".dev.vars"
  }
  npx wrangler d1 migrations apply myhome --local
  Write-Host "`nMyHome server edition is ready."
  Write-Host "Start it with: npm run dev:server"
} else {
  Write-Host "`nMyHome static edition is ready."
  Write-Host "Start it with: npm run dev"
}
