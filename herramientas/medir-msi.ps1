# Medición A/B de las estaciones en ESTA computadora (Windows 11, Intel UHD), sin tocar nada a mano.
#
#   herramientas\medir-estaciones.bat            (30 s por caso; unos 5 minutos en total)
#   herramientas\medir-estaciones.bat -Segundos 60
#
# Qué hace (y deshace):
#  1. Arranca SU PROPIO servidor local de Cauce (solo 127.0.0.1, puerto 8779 por omisión) con --recibir-mediciones:
#     la página le entrega cada informe directamente (no depende de los permisos de descarga de Edge). Al final lo
#     detiene. No usa ni toca un iniciar.bat que esté abierto.
#  2. Pide a Windows que Edge use la GPU de AHORRO DE ENERGÍA (la Intel UHD, no la NVIDIA) con la misma preferencia
#     que Configuración > Sistema > Pantalla > Gráficos. Al terminar deja la preferencia como estaba.
#  3. Abre un Edge APARTE (perfil temporal, sin tus pestañas ni extensiones), maximizado, con la serie
#     ?medir=1&auto=N&serie=1: la página mide sola cinco casos (Compago y Ek Chuah con y sin estaciones, y Compago
#     sin la fusión del edificio) y descarga un archivo por caso y cauce-medicion-serie.json.
#  4. Deja los resultados en mediciones\<fecha>\ (también busca en Descargas), muestra el avance mientras mide y el
#     resumen al final. Cierra ese Edge (solo ese).
# No instala nada, no cambia datos, no sube nada a internet. Durante la medición no hay que tocar la computadora.
param([int]$Segundos = 30, [int]$Puerto = 8779)
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

# 1. Servidor propio (que recibe los informes en la carpeta de resultados)
if (Responde) { Write-Host "El puerto $Puerto ya esta en uso. Usa otro:  herramientas\medir-estaciones.bat -Puerto 8781"; exit 1 }
$py = Get-Command python -ErrorAction SilentlyContinue; if (-not $py) { $py = Get-Command py -ErrorAction SilentlyContinue }
if (-not $py) { Write-Host "No encontre Python (python o py)."; exit 1 }
$servidor = Start-Process -FilePath $py.Source -ArgumentList @("servir.py", "--sin-abrir", "--puerto", "$Puerto", "--recibir-mediciones", "`"$salida`"") -WorkingDirectory $raiz -WindowStyle Minimized -PassThru
for ($i = 0; $i -lt 30 -and -not (Responde); $i++) { Start-Sleep -Milliseconds 500 }
if (-not (Responde)) { Write-Host "El servidor no respondio en $base (otro programa en el puerto? prueba -Puerto 8781)."; Stop-Process -Id $servidor.Id -ErrorAction SilentlyContinue; exit 1 }

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
  # Descargas a la carpeta de resultados y permiso de descargas automáticas múltiples para esta dirección (Edge
  # bloquea la segunda sin él). El servidor propio ya recibe los informes; las descargas son la copia de respaldo.
  $sitio = "http://127.0.0.1:$Puerto,*"
  $pref = @{ download = @{ default_directory = $salida; prompt_for_download = $false; directory_upgrade = $true }
             profile = @{ exit_type = "Normal"; content_settings = @{ exceptions = @{ automatic_downloads = @{ $sitio = @{ setting = 1 } } } } } }
  # Sin BOM: Windows PowerShell 5.1 pone BOM con -Encoding UTF8 y Edge puede tomar el archivo por dañado.
  [IO.File]::WriteAllText("$perfil\Default\Preferences", ($pref | ConvertTo-Json -Depth 10), (New-Object Text.UTF8Encoding $false))
  $url = "$base/?medir=1&auto=$Segundos&serie=1"
  Write-Host "Midiendo $url  (no toques la computadora; unos $([math]::Ceiling(5 * ($Segundos + 20) / 60)) minutos)"
  Start-Process -FilePath $edge -ArgumentList @("--user-data-dir=$perfil", "--disable-sync", "--no-first-run", "--no-default-browser-check", "--start-maximized", "--new-window", $url) | Out-Null

  # 4. Espera el archivo final (en la carpeta de resultados o, si Edge no hizo caso, en Descargas)
  $descargas = Join-Path $env:USERPROFILE "Downloads"
  $limite = $inicio.AddSeconds(5 * (3 * $Segundos + 75) + 60)   # el mismo tope que se pone la pagina por caso
  $final = $null
  $estadoArchivo = Join-Path $salida "estado.json"; $ultimo = ""
  while ((Get-Date) -lt $limite -and -not $final) {
    Start-Sleep -Seconds 3
    $final = Get-ChildItem -Path $salida, $descargas -Filter "cauce-medicion-serie*.json" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge $inicio } | Select-Object -First 1
    if (Test-Path $estadoArchivo) {
      try { $e = Get-Content -Raw -Encoding UTF8 $estadoArchivo | ConvertFrom-Json; $linea = "  $($e.hora)  $($e.caso): $($e.fase)$(if ($e.errores) { '  errores: ' + ($e.errores -join ' | ') })" } catch { $linea = "" }
      if ($linea -and $linea -ne $ultimo) { Write-Host $linea; $ultimo = $linea }
    }
  }
  Get-ChildItem -Path $descargas -Filter "cauce-medicion-*.json" -ErrorAction SilentlyContinue | Where-Object { $_.LastWriteTime -ge $inicio } | Copy-Item -Destination $salida -Force
} finally {
  # Primero la GPU (lo más importante de dejar como estaba); cada paso por separado para que un fallo no salte el resto.
  try { if ($anterior) { Set-ItemProperty -Path $claveGpu -Name $edge -Value $anterior } else { Remove-ItemProperty -Path $claveGpu -Name $edge -ErrorAction SilentlyContinue } }
  catch { Write-Host "AVISO: no pude restaurar la preferencia de GPU de Edge: $($_.Exception.Message)" }
  try { Get-CimInstance Win32_Process -Filter "Name='msedge.exe'" | Where-Object { $_.CommandLine -like "*cauce-medicion-edge*" } | ForEach-Object { try { Invoke-CimMethod -InputObject $_ -MethodName Terminate -ErrorAction Stop | Out-Null } catch { } } } catch { }
  # El perfil temporal puede traer datos de tu cuenta si Edge inicia sesión solo: se borra al terminar.
  Start-Sleep -Seconds 2
  try { if (Test-Path $perfil) { Remove-Item -Recurse -Force $perfil -ErrorAction Stop } } catch { Write-Host "AVISO: no pude borrar el perfil temporal $perfil; bórralo a mano." }
  Write-Host "Preferencia de GPU de Edge restaurada."
  if ($servidor) { Stop-Process -Id $servidor.Id -ErrorAction SilentlyContinue }
}

$serie = Get-ChildItem -Path $salida -Filter "cauce-medicion-serie*.json" | Select-Object -First 1
if (-not $serie) {
  Write-Host "No llego el resultado final. Lo que haya quedado esta en $salida"
  if (Test-Path (Join-Path $salida "estado.json")) { Write-Host "Ultimo estado que informo la pagina:"; Get-Content -Raw -Encoding UTF8 (Join-Path $salida "estado.json") | Write-Host }
  else { Write-Host "La pagina nunca informo su estado: no llego a cargar la oficina o no pudo hablar con el servidor." }
  exit 1
}
$r = Get-Content -Raw -Encoding UTF8 $serie.FullName | ConvertFrom-Json
Write-Host ""
Write-Host $r.texto
Write-Host ""
Write-Host "Resultados en: $salida"
