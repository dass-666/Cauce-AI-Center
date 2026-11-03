@echo off
rem Ejecuta las pruebas automaticas con Node.js (opcional). Sin Node: abre /pruebas.html en el navegador.
cd /d "%~dp0"
where node >nul 2>nul || (echo No encontre Node.js. Abre http://127.0.0.1:8765/pruebas.html con iniciar.bat en marcha. & pause & exit /b 1)
node pruebas\ejecutar.mjs
pause
