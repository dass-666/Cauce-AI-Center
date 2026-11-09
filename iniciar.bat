@echo off
rem Inicia el centro de operaciones en http://127.0.0.1:8765 (solo en esta computadora).
cd /d "%~dp0"
where py >nul 2>nul && (py -3 servir.py %* & goto :fin)
where python >nul 2>nul && (python servir.py %* & goto :fin)
where uv >nul 2>nul && (uv run --no-project python servir.py %* & goto :fin)
echo No encontre Python. Instala Python 3 desde python.org o usa uv (el mismo de Ek Chuah).
pause
:fin
rem Codigo distinto de 0 (por ejemplo 2 = puerto ocupado, ya explicado por servir.py): la ventana queda abierta para leerlo.
if errorlevel 1 pause
