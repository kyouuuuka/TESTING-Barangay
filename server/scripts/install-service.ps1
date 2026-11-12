# Run the app as a Windows service: starts at boot (no login needed), restarts on crash.
# Run as admin (after `npm run build` in client/):
#   powershell -ExecutionPolicy Bypass -File install-service.ps1
# Manage later: nssm restart brgy-app | nssm stop brgy-app | nssm remove brgy-app confirm
param(
  [string]$Name = 'brgy-app',
  [string]$Log = "$env:TEMP\brgy-install-service.log"
)

function Log($msg) { "$(Get-Date -Format s)  $msg" | Out-File $Log -Append -Encoding utf8 }
$server = Split-Path $PSScriptRoot -Parent
$node = (Get-Command node -ErrorAction SilentlyContinue).Source
if (-not $node) { Log 'FAILED: node not found on PATH'; exit 1 }

# NSSM (service wrapper)
$nssm = (Get-Command nssm -ErrorAction SilentlyContinue).Source
if (-not $nssm) {
  Log 'Installing NSSM via winget...'
  winget install --id NSSM.NSSM -e --source winget --scope machine --silent `
    --accept-package-agreements --accept-source-agreements | Out-File $Log -Append -Encoding utf8
  $nssm = Get-ChildItem 'C:\Program Files\WinGet', "$env:LOCALAPPDATA\Microsoft\WinGet" -Recurse -Filter nssm.exe -ErrorAction SilentlyContinue |
    Sort-Object { $_.FullName -notmatch 'win64' } | Select-Object -First 1 -ExpandProperty FullName
}
if (-not $nssm) { Log 'FAILED: nssm.exe not found after install'; exit 1 }
Log "nssm: $nssm"

function N { & $nssm @args 2>&1 | Out-File $Log -Append -Encoding utf8 }

if (Get-Service $Name -ErrorAction SilentlyContinue) { N stop $Name; N remove $Name confirm }

New-Item -ItemType Directory -Force "$server\logs" | Out-Null
N install $Name $node '--env-file=.env' 'index.js'
N set $Name AppDirectory $server
N set $Name DisplayName 'Barangay Management System'
N set $Name Start SERVICE_AUTO_START
$pg = Get-Service 'postgresql*' -ErrorAction SilentlyContinue | Select-Object -First 1
if ($pg) { N set $Name DependOnService $pg.Name }   # wait for the database at boot
N set $Name AppStdout "$server\logs\app.log"
N set $Name AppStderr "$server\logs\app.log"
N set $Name AppRotateFiles 1
N set $Name AppRotateBytes 1048576
N start $Name

Start-Sleep -Seconds 3
$svc = Get-Service $Name -ErrorAction SilentlyContinue
if ($svc.Status -eq 'Running') { Log "DONE OK: $Name running, start type $($svc.StartType)" }
else { Log "FAILED: $Name status '$($svc.Status)'"; exit 1 }
