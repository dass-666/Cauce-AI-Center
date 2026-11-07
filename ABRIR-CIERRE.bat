@echo off
rem Trae la version de cierre de Cauce AI Center a este clon y la abre en http://127.0.0.1:8765
rem No borra nada: si hay cambios locales sin guardar, se detiene y lo dice.
rem Se ejecuta desde una copia en %TEMP% para que el cambio de rama pueda reemplazar este mismo archivo sin
rem que Windows lea un .bat a medio cambiar. Si este .bat esta en la carpeta sin seguimiento (copiado a mano),
rem no cuenta como cambio local: se guarda una copia en %TEMP% y la rama trae el suyo.
if /i "%~1"=="--desde-temp" goto :principal
set "CAUCE_REPO=%~dp0"
set "CAUCE_ARGS=%*"
set "CAUCE_COPIA=%TEMP%\cauce-abrir-cierre.bat"
copy /y "%~f0" "%CAUCE_COPIA%" >nul || (echo No pude preparar la ejecucion en %TEMP%. & pause & exit /b 1)
"%CAUCE_COPIA%" --desde-temp

:principal
cd /d "%CAUCE_REPO%" || (echo No encontre la carpeta %CAUCE_REPO%. & pause & exit /b 1)
where git >nul 2>nul || (echo No encontre Git. Instala Git para Windows. & pause & exit /b 1)
git rev-parse --is-inside-work-tree >nul 2>nul || (echo Esta carpeta no es un clon de Git: %CAUCE_REPO% & pause & exit /b 1)
for /f "delims=" %%L in ('git status --porcelain -- . ":(exclude)ABRIR-CIERRE.bat"') do (
  echo Hay cambios locales sin guardar en esta carpeta. Guardalos o descartalos y vuelve a ejecutar.
  git status --short
  pause & exit /b 1
)
git fetch origin claude/project-thread-fwbit2 || (echo No pude descargar la rama. Revisa la conexion. & pause & exit /b 1)
git ls-files --error-unmatch ABRIR-CIERRE.bat >nul 2>nul || (
  copy /y ABRIR-CIERRE.bat "%TEMP%\ABRIR-CIERRE.respaldo.bat" >nul || (echo No pude respaldar ABRIR-CIERRE.bat. & pause & exit /b 1)
  del ABRIR-CIERRE.bat
  echo Guarde tu copia de ABRIR-CIERRE.bat en %TEMP%\ABRIR-CIERRE.respaldo.bat: la rama trae la suya.
)
git checkout -B claude/project-thread-fwbit2 origin/claude/project-thread-fwbit2 || (echo No pude cambiar de rama. Tu copia del .bat esta en %TEMP%\ABRIR-CIERRE.respaldo.bat si hacia falta. & pause & exit /b 1)
for /f %%H in ('git rev-parse --short HEAD') do echo Rama lista en el commit %%H.
echo Abre http://127.0.0.1:8765/?csi=historico^&medir=1 y http://127.0.0.1:8765/pruebas.html
call "%CAUCE_REPO%iniciar.bat" %CAUCE_ARGS%
