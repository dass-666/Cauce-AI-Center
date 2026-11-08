@echo off
rem Mide en ESTA computadora (Intel UHD) la oficina con y sin estaciones, sola. Ver herramientas\medir-msi.ps1.
rem Uso:  herramientas\medir-estaciones.bat   [-Segundos 60]
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0medir-msi.ps1" %*
pause
