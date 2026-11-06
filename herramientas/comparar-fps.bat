@echo off
rem Compara los FPS de la version anterior (fase L) con esta version, en ESTA computadora.
rem 1) Prepara una copia de la version anterior en comparar\anterior (con git; no toca esta carpeta ni main).
rem 2) Inicia el servidor local (solo 127.0.0.1) y abre la herramienta de comparacion en el navegador.
rem Uso:  herramientas\comparar-fps.bat            (anterior = fase L, commit f9b83e7)
rem       herramientas\comparar-fps.bat <commit>   (otra version anterior)
cd /d "%~dp0\.."
set ANTERIOR=%~1
if "%ANTERIOR%"=="" set ANTERIOR=f9b83e7aa8b1d771151d936b560369e71196218e
if not exist "comparar\anterior\index.html" (
  where git >nul 2>nul || (echo Necesito Git para preparar la version anterior. Instala Git para Windows o ve la guia. & pause & exit /b 1)
  git worktree add --detach comparar\anterior %ANTERIOR% || (echo No pude preparar la version anterior %ANTERIOR%. Importaste el bundle completo? & pause & exit /b 1)
)
echo Abriendo http://127.0.0.1:8765/herramientas/comparar-fps.html ...
start "" cmd /c "timeout /t 2 >nul & start http://127.0.0.1:8765/herramientas/comparar-fps.html"
call iniciar.bat --sin-abrir
