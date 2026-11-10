# One-time PostgreSQL 17 setup (dev laptop or barangay server PC). Run as admin:
#   powershell -ExecutionPolicy Bypass -File setup-postgres.ps1 -SuperPassword <pw> -AppPassword <pw>
# Installs PostgreSQL 17 + pgAdmin, creates role brgy_app + database brgy,
# and binds Postgres to localhost only, so it is never reachable from the network.
param(
  [Parameter(Mandatory)][string]$SuperPassword,
  [Parameter(Mandatory)][string]$AppPassword,
  [string]$Log = "$env:TEMP\brgy-setup-postgres.log"
)

function Log($msg) { "$(Get-Date -Format s)  $msg" | Out-File $Log -Append -Encoding utf8 }
$psql = 'C:\Program Files\PostgreSQL\17\bin\psql.exe'

if (-not (Test-Path $psql)) {
  Log 'Installing PostgreSQL 17 via winget...'
  winget install --id PostgreSQL.PostgreSQL.17 -e --source winget --silent `
    --accept-package-agreements --accept-source-agreements `
    --override "--mode unattended --unattendedmodeui none --superpassword $SuperPassword --serverport 5432 --disable-components stackbuilder" |
    Out-File $Log -Append -Encoding utf8
  if (-not (Test-Path $psql)) { Log "FAILED: install (winget exit $LASTEXITCODE)"; exit 1 }
}

$svc = Get-Service 'postgresql*17*' | Select-Object -First 1
if (-not $svc) { Log 'FAILED: PostgreSQL service not found'; exit 1 }
$svc.WaitForStatus('Running', [TimeSpan]::FromMinutes(2))

$env:PGPASSWORD = $SuperPassword
function Sql($q) { & $psql -h localhost -U postgres -d postgres -w -c $q 2>&1 | Out-File $Log -Append -Encoding utf8 }
Sql "CREATE ROLE brgy_app LOGIN PASSWORD '$AppPassword'"
Sql 'CREATE DATABASE brgy OWNER brgy_app'
Sql "ALTER DATABASE brgy SET timezone TO 'Asia/Manila'"
Sql "ALTER SYSTEM SET listen_addresses = 'localhost'"
Restart-Service $svc.Name
Log "Restarted $($svc.Name)"

$env:PGPASSWORD = $AppPassword
$check = & $psql -h localhost -U brgy_app -d brgy -w -At -c 'SHOW listen_addresses'
if ($check -eq 'localhost') { Log 'DONE OK: brgy_app connects, listen_addresses = localhost' }
else { Log "FAILED: verify returned '$check'"; exit 1 }
