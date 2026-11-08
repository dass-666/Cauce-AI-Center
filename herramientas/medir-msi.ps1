# Medición A/B de las estaciones en ESTA computadora (Windows 11, Intel UHD), sin tocar nada a mano.
#
#   herramientas\medir-estaciones.bat            (30 s por caso; unos 5 minutos en total)
#   herramientas\medir-estaciones.bat -Segundos 60
#
# Qué hace (y deshace):
#  1. Arranca el servidor local de Cauce (solo 127.0.0.1:8765) si no está corriendo; al final lo detiene si lo arrancó.
#  2. Pide a Windows que Edge use la GPU de AHORRO DE ENERGÍA (la Intel UHD, no la NVIDIA) con la misma preferencia
#     que Configuración > Sistema > Pantalla > Gráficos. Al terminar deja la preferencia como estaba.
#  3. Abre un Edge APARTE (perfil temporal, sin tus pestañas ni extensiones), maximizado, con la serie
#     ?medir=1&auto=N&serie=1: la página mide sola cinco casos (Compago y Ek Chuah con y sin estaciones, y Compago
#     sin la fusión del edificio) y descarga un archivo por caso y cauce-medicion-serie.json.
#  4. Copia los resultados a mediciones\<fecha>\ y muestra el resumen. Cierra ese Edge (solo ese).
# No instala nada, no cambia datos, no sube nada a internet. Durante la medición no hay que tocar la computadora.
param([int]$Segundos = 30, [int]$Puerto = 8765)
$ErrorActionPreference = "Stop"
$raiz = Split-Path -Parent $PSScriptRoot
Set-Location $raiz
$base = "http://127.0.0.1:$Puerto"
$inicio = Get-Date
$sello = $inicio.ToString("yyyyMMdd-HHmmss")
$salida = Join-Path $raiz "mediciones\$sello"
New-Item -ItemType Directory -Force -Path $salida | Out-Null
$perfil = Join-Path $env:TEMP "cauce-medicion-edge"

function Responde { try { Invoke-WebRequest "$base/escena/compago.json" -UseBasicParsing -TimeoutSec 2 | Out-Null; $true } catch { $false } }

# 1. Servidor
$servidor = $null
if (-not (Responde)) {
  $py = Get-Command python -ErrorAction SilentlyContinue; if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
  if (-not $py) { Write-Host "No encontre Python (python o py)."; exit 1 }
  $servidor = Start-Process -FilePath $py.Source -ArgumentList @("servir.py", "--sin-abrir", "--puerto", "$Puerto") -WorkingDirectory $raiz -WindowStyle Minimized -PassThru
  for ($i = 0; $i -lt 30 -and -not (Responde); $i++) { Start-Sleep -Milliseconds 500 }
  if (-not (Responde)) { Write-Host "El servidor no respondio en $base."; exit 1 }
}

# 2. Edge y su preferencia de GPU
$edge = @("${env:ProgramFiles(x86)}\Microsoft\Edge\Application\msedge.exe", "$env:ProgramFiles\Microsoft\Edge\Application\msedge.exe") | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $edge) { Write-Host "No encontre Microsoft Edge."; exit 1 }
$claveGpu = "HKCU:\Software\Microsoft\DirectX\UserGpuPreferences"
if (-not (Test-Path $claveGpu)) { New-Item -Path $claveGpu -Force | Out-Null }
$anterior = (Get-ItemProperty -Path $claveGpu -Name $edge -ErrorAction SilentlyContinue).$edge
Set-ItemProperty -Path $claveGpu -Name $edge -Value "GpuPreference=1;"   # 1 = ahorro de energia (Intel UHD)
Write-Host "Edge usara la GPU de ahorro de energia mientras se mide (antes: $(if ($anterior) { $anterior } else { 'sin preferencia' }))."

try {
  # 3. Edge aparte, con las descargas a la carpeta de resultados
  if (Test-Path $perfil) { Remove-Item -Recurse -Force $perfil }
  New-Item -ItemType Directory -Force -Path "$perfil\Default" | Out-Null
  $pref = @{ download = @{ default_directory = $salida; prompt_for_download = $false; directory_upgrade = $true }; profile = @{ exit_type = "Normal" } }
  $pref | ConvertTo-Json -Depth 4 | Set-Content -Encoding UTF8 "$perfil\Default\Preferences"
  $url = "$base/?medir=1&auto=$Segundos&serie=1"
  Write-Host "Midiendo $url  (no toques la computadora; unos $([math]::Ceiling(5 * ($Segundos + 15) / 60)) minutos)"
  Start-Process -FilePath $edge -ArgumentList @("--user-data-dir=$perfil", "--no-first-run", "--no-default-browser-check", "--start-maximized", "--new-window", $url) | Out-Null

  # 4. Espera el archivo final (en la carpeta de resultados o, si Edge no hizo caso, en Descargas)
  $descargas = Join-Path $env:USERPROFILE "Downloads"
  $limite = $inicio.AddSeconds(5 * ($Segundos + 40) + 60)
  $final = $null
  while ((Get-Date) -lt $limite -and -not $final) {
    Start-Sleep -Seconds 3
    $final = Get-ChildItem -Path $salida, $descargas -Filter "cauce-medicion-serie*.json" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge $inicio } | Select-Object -First 1
  }
  Get-ChildItem -Path $descargas -Filter "cauce-medicion-*.json" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge $inicio } | Copy-Item -Destination $salida -Force
} finally {
  Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like "*cauce-medicion-edge*" } | ForEach-Object { Invoke-CimMethod -InputObject $_ -MethodName Terminate | Out-Null }
  if ($anterior) { Set-ItemProperty -Path $claveGpu -Name $edge -Value $anterior } else { Remove-ItemProperty -Path $claveGpu -Name $edge -ErrorAction SilentlyContinue }
  Write-Host "Preferencia de GPU de Edge restaurada."
  if ($servidor) { Stop-Process -Id $servidor.Id -ErrorAction SilentlyContinue }
}

$serie = Get-ChildItem -Path $salida -Filter "cauce-medicion-serie*.json" | Select-Object -First 1
if (-not $serie) { Write-Host "No llego el resultado final. Lo que haya quedado esta en $salida"; exit 1 }
$r = Get-Content -Raw -Encoding UTF8 $serie.FullName | ConvertFrom-Json
Write-Host ""
Write-Host $r.texto
Write-Host ""
Write-Host "Resultados en: $salida"
