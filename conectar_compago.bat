@echo off
rem Conecta Compago con el centro de operaciones: exporta su estado (SOLO LECTURA) a datos\reales\compago.json.
rem 1) Cambia COMPAGO_DIR por la carpeta donde esta Compago (la que tiene manage.py).
rem 2) Deja esta ventana abierta; se actualiza cada CADA segundos. Ctrl+C para detener.
set "COMPAGO_DIR=C:\ruta\a\Compago"
set "CADA=300"
cd /d "%~dp0"
set "SALIDA=%CD%\datos\reales\compago.json"
if not exist "%COMPAGO_DIR%\manage.py" (echo No encontre manage.py en "%COMPAGO_DIR%". Edita COMPAGO_DIR en este archivo. & pause & exit /b 1)
cd /d "%COMPAGO_DIR%"
if exist ".venv\Scripts\python.exe" (
  ".venv\Scripts\python.exe" manage.py exportar_cauce --salida "%SALIDA%" --cada %CADA% --medir
) else (
  py -3 manage.py exportar_cauce --salida "%SALIDA%" --cada %CADA% --medir
)
pause
