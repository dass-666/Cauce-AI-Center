@echo off
rem Conecta Ek Chuah con el centro de operaciones: exporta su estado (SOLO LECTURA) a datos\reales\ek-chuah.json.
rem Requiere la rama claude/exportador-cauce de Ek Chuah (PR #2), que agrega el comando exportar-cauce.
rem NO instala ni activa tareas programadas de Windows: solo corre mientras esta ventana siga abierta.
rem 1) Cambia EKCHUAH_DIR por la carpeta de Ek Chuah (la que tiene pyproject.toml).
rem 2) CADA = segundos entre exportaciones (minimo 60). CADA=0 exporta una sola vez (para la primera prueba).
rem    Recomendado: CADA=900 (15 min), vigencia 2700 s = 3 ciclos (tolera 2 exportaciones perdidas).
rem    La vigencia es 3 ciclos: si cierras esta ventana, Cauce lo muestra "Datos desactualizados".
set "EKCHUAH_DIR=C:\ruta\a\EK_CHUAH"
set "CADA=900"
cd /d "%~dp0"
set "SALIDA=%CD%\datos\reales\ek-chuah.json"
if not exist "%CD%\datos\reales\" (echo No existe la carpeta datos\reales de Cauce. & pause & exit /b 1)
if not exist "%EKCHUAH_DIR%\pyproject.toml" (echo No encontre pyproject.toml en "%EKCHUAH_DIR%". Edita EKCHUAH_DIR en este archivo. & pause & exit /b 1)
where uv >nul 2>nul || (echo No encontre uv. Es el mismo que usas para Ek Chuah: https://docs.astral.sh/uv/ & pause & exit /b 1)
set /a VIGENCIA=CADA*3
if "%CADA%"=="0" set "VIGENCIA=93600"
if not "%CADA%"=="0" if %CADA% LSS 60 (echo CADA debe ser 0 o al menos 60. & pause & exit /b 1)
cd /d "%EKCHUAH_DIR%"
:ciclo
uv run ek-chuah exportar-cauce --salida "%SALIDA%" --vigencia %VIGENCIA%
set "CODIGO=%ERRORLEVEL%"
echo Codigo de salida: %CODIGO%  (0 = leyo todo; 1 = falta la base o una tabla, igual escribio el aviso; 2 = se nego a escribir)
if "%CODIGO%"=="2" (pause & exit /b 2)
if "%CADA%"=="0" (pause & exit /b %CODIGO%)
timeout /t %CADA% /nobreak >nul
goto ciclo
