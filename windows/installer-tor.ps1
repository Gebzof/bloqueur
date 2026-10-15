# Installe Tor comme service Windows (démarrage automatique, sans fenêtre).
# Le bloqueur de pubs s'y connecte via le bouton "Tor" du popup (127.0.0.1:9050).
#
#   installer-tor.bat                 installe (sortie en Allemagne)
#   desinstaller-tor.bat              désinstalle
#   installer-tor.ps1 -Pays nl        installe avec une sortie aux Pays-Bas (code pays à 2 lettres)

param(
  [string]$Pays = 'de',
  [switch]$Desinstaller
)

$ErrorActionPreference = 'Stop'
$Dossier = 'C:\ProgramData\Tor'
$Tor = "$Dossier\tor\tor.exe"
$Torrc = "$Dossier\torrc"
$Journal = "$Dossier\tor.log"

function Pause-Fin { Write-Host ''; Read-Host 'Appuyez sur Entrée pour fermer' | Out-Null }

# Relance en administrateur si besoin
$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) {
  $arguments = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`" -Pays $Pays"
  if ($Desinstaller) { $arguments += ' -Desinstaller' }
  Start-Process powershell -Verb RunAs -ArgumentList $arguments
  exit
}

function Supprimer-Service {
  if (Get-Service -Name tor -ErrorAction SilentlyContinue) {
    Write-Host 'Arrêt du service Tor existant...'
    Stop-Service -Name tor -Force -ErrorAction SilentlyContinue
    if (Test-Path $Tor) { & $Tor --service remove | Out-Null } else { sc.exe delete tor | Out-Null }
    Start-Sleep -Seconds 2
  }
}

try {
  if ($Desinstaller) {
    Supprimer-Service
    if (Test-Path $Dossier) { Remove-Item $Dossier -Recurse -Force }
    Write-Host 'Tor est désinstallé.' -ForegroundColor Green
    Write-Host 'Pensez à décocher "VPN activé" dans le popup du bloqueur.'
    Pause-Fin
    exit
  }

  [Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
  $ProgressPreference = 'SilentlyContinue'
  $base = 'https://dist.torproject.org/torbrowser'

  Write-Host 'Recherche de la dernière version de Tor...'
  $liste = (Invoke-WebRequest "$base/" -UseBasicParsing).Content
  $version = [regex]::Matches($liste, 'href="(\d+\.\d+(?:\.\d+)?)/"') |
    ForEach-Object { $_.Groups[1].Value } |
    Sort-Object { [version]$_ } |
    Select-Object -Last 1
  if (-not $version) { throw 'Impossible de trouver la version de Tor sur torproject.org.' }
  Write-Host "Version : $version"

  $fichier = "tor-expert-bundle-windows-x86_64-$version.tar.gz"
  $archive = Join-Path $env:TEMP $fichier
  Write-Host 'Téléchargement...'
  Invoke-WebRequest "$base/$version/$fichier" -OutFile $archive -UseBasicParsing

  Write-Host "Vérification de l'empreinte SHA-256..."
  $sommes = (Invoke-WebRequest "$base/$version/sha256sums-signed-build.txt" -UseBasicParsing).Content
  $attendue = ($sommes -split "`n" | Where-Object { $_ -match [regex]::Escape($fichier) }) -replace '\s.*$', ''
  $obtenue = (Get-FileHash $archive -Algorithm SHA256).Hash.ToLower()
  if (-not $attendue -or $attendue.Trim().ToLower() -ne $obtenue) { throw "Empreinte incorrecte : le fichier téléchargé n'est pas fiable." }

  Supprimer-Service

  Write-Host "Installation dans $Dossier..."
  if (Test-Path "$Dossier\tor") { Remove-Item "$Dossier\tor" -Recurse -Force }
  New-Item -ItemType Directory -Force -Path "$Dossier\data" | Out-Null
  tar -xzf $archive -C $Dossier
  if ($LASTEXITCODE -ne 0) { throw "Échec de l'extraction de l'archive." }
  Remove-Item $archive -Force

  @"
SocksPort 127.0.0.1:9050
DataDirectory C:/ProgramData/Tor/data
GeoIPFile C:/ProgramData/Tor/data/geoip
GeoIPv6File C:/ProgramData/Tor/data/geoip6
ExitNodes {$Pays}
StrictNodes 1
Log notice file C:/ProgramData/Tor/tor.log
"@ | Set-Content -Path $Torrc -Encoding ASCII
  if (Test-Path $Journal) { Remove-Item $Journal -Force }

  # Le service tourne sous le compte "Service local" (SID S-1-5-19) : il doit pouvoir écrire dans le dossier
  icacls $Dossier /grant '*S-1-5-19:(OI)(CI)M' /T /Q | Out-Null

  Write-Host 'Création du service Windows...'
  & $Tor --service install -options -f $Torrc | Out-Null
  Set-Service -Name tor -StartupType Automatic
  if ((Get-Service -Name tor).Status -ne 'Running') { Start-Service -Name tor }

  Write-Host 'Connexion au réseau Tor (jusqu''à 2 minutes)...'
  $ok = $false
  for ($i = 0; $i -lt 120; $i++) {
    Start-Sleep -Seconds 1
    if ((Test-Path $Journal) -and (Select-String -Path $Journal -Pattern 'Bootstrapped 100' -Quiet)) { $ok = $true; break }
  }

  Write-Host ''
  if ($ok) {
    Write-Host "Tor est installé et connecté (sortie : $($Pays.ToUpper()))." -ForegroundColor Green
    Write-Host 'Il démarrera automatiquement avec Windows.'
    Write-Host ''
    Write-Host 'Dans Chrome : popup du bloqueur > bouton "Tor", puis "Vérifier l''IP".'
  } else {
    Write-Host 'Le service est installé mais Tor n''est pas encore connecté.' -ForegroundColor Yellow
    Write-Host "Journal : $Journal"
    if (Test-Path $Journal) { Get-Content $Journal -Tail 5 }
  }
} catch {
  Write-Host ''
  Write-Host "Erreur : $($_.Exception.Message)" -ForegroundColor Red
}
Pause-Fin
