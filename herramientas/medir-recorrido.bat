@echo off
rem Mide en ESTA computadora (Intel UHD) el ascensor entre pisos y "Un cuarto" del PR #35, solo. Ver herramientas\medir-msi.ps1.
rem Dos pasadas de unos 3 minutos: con la vida en reposo y sin ella (para ver cuánto cuesta). No toques la computadora.
cd /d "%~dp0\.."
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0medir-msi.ps1" -Recorrido %*
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0medir-msi.ps1" -Recorrido -SinVida %*
pause
