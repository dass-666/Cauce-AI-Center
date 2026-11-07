@echo off
rem Trae la version de cierre de Cauce AI Center a este clon y la abre en http://127.0.0.1:8765
rem No borra nada: si hay cambios locales sin guardar, se detiene y lo dice.
cd /d "%~dp0"
where git >nul 2>nul || (echo No encontre Git. Instala Git para Windows. & pause & exit /b 1)
for /f "delims=" %%L in ('git status --porcelain') do (
  echo Hay cambios locales sin guardar en esta carpeta. Guardalos o descartalos y vuelve a ejecutar.
  git status --short
  pause & exit /b 1
)
git fetch origin claude/project-thread-fwbit2 || (echo No pude descargar la rama. Revisa la conexion. & pause & exit /b 1)
git checkout -B claude/project-thread-fwbit2 origin/claude/project-thread-fwbit2 || (echo No pude cambiar de rama. & pause & exit /b 1)
echo Rama lista. Abre http://127.0.0.1:8765/?csi=historico^&medir=1 y http://127.0.0.1:8765/pruebas.html
call iniciar.bat %*
