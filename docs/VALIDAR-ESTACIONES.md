# Validar las estaciones en la MSI (Windows 11, Intel UHD)

Tiempo: 10–15 minutos. No instala nada, no pide credenciales y no cambia datos reales. Solo hace falta Python 3
(ya instalado en la MSI) y Microsoft Edge. Sin Node, sin `npm install`, sin compilar: la oficina son archivos
estáticos (Three.js va copiado en `vendor/`), servidos por `servir.py` (biblioteca estándar de Python)
solo en `127.0.0.1`.

## 1. Traer la rama

```bat
cd C:\Users\MSIGF\Cauce-AI-Center
git status
git fetch origin
git checkout claude/project-thread-13jxhn
git pull
```

Si `git status` muestra cambios tuyos, guárdalos antes (`git stash`) para no perderlos.

## 2. Abrir la oficina

```bat
iniciar.bat
```

Abre `http://127.0.0.1:8765/`. Si el puerto 8765 está ocupado, la ventana lo explica y queda abierta; usa otro:
`iniciar.bat --puerto 8775`.

Pruebas en el navegador: `http://127.0.0.1:8765/pruebas.html` debe decir **423 pasaron, 0 fallaron**.

## 3. Medir (automático, con la Intel UHD)

```bat
herramientas\medir-estaciones.bat
```

No toques la computadora durante unos 5 minutos. El guion:

1. arranca su propio servidor en `127.0.0.1:8779` (no hace falta tener `iniciar.bat` abierto; lo detiene al
   terminar), que recibe cada informe directamente en la carpeta de resultados, sin depender de las descargas de Edge;
2. pide a Windows que **Edge use la GPU de ahorro de energía (Intel UHD)**, la misma preferencia que
   Configuración › Sistema › Pantalla › Gráficos, y **la restaura** al terminar;
3. abre un Edge aparte (perfil temporal, sin tus pestañas), maximizado, que mide solo cinco casos de 30 s:
   A Compago sin estaciones · B Compago con estaciones · C Ek Chuah sin · D Ek Chuah con · E Compago sin la fusión
   de geometría del edificio (para saber cuánto aporta);
4. deja los resultados en `mediciones\<fecha>\` (fuera de git) y muestra el resumen;
5. al terminar cierra solo ese Edge y **borra su perfil temporal** (Edge puede iniciar sesión solo con tu cuenta de
   Windows; se abre con `--disable-sync`, pero por si acaso no queda nada guardado).

Mientras mide, la ventana muestra en qué caso va. Envía `mediciones\<fecha>\cauce-medicion-serie.json`. Trae, por caso: GPU que usó el navegador (debe decir Intel),
cps promedio y mínimo, 1 % más lento, cuadros p50/p95/p99 en ms, segundos bajo 50 cps, llamadas de dibujo,
texturas, geometrías y memoria JS.

Criterio: **aceptar si B queda a ≤ 3 cps de A en promedio y sin segundos nuevos bajo 50 cps** (y lo mismo D frente
a C). Si la GPU del resumen no es Intel, la medición no vale para esta decisión.

Más tiempo por caso: `herramientas\medir-estaciones.bat -Segundos 60`. Medición manual de un solo caso:
`http://127.0.0.1:8765/?medir=1&auto=30&proyecto=compago&modo3d=edificio` (añade `&estaciones=0` para el caso sin
estaciones); descarga un `cauce-medicion-*.json`.

## 4. Revisión visual (cuando quieras abrirla)

1. Piso **Ek Chuah** → modo **Edificio**. En «Análisis de riesgo», mesa larga con tres personajes y el tablero
   «Observatorio Geopolítico y Macroeconómico» con la marca DEMO, sobre el panel (no tapa escritorios).
2. Toca el tablero: el panel dice qué es cada función, que es demostración y qué datos faltan. La transferencia a
   Compago dice «de DEMOSTRACIÓN (no es real)» y la luz de enlace es ámbar, no verde.
3. Toca a un personaje: se marca su puesto.
4. Piso **Compago** → «Evaluación de oportunidades»: los tres personajes son distintos entre sí.
5. **Un cuarto** y **Plano** (2D): la estación también está.
6. Botón ⇥ del panel: se pliega a una franja y la oficina gana ancho; «◂ Detalle» lo vuelve a abrir (se recuerda).
7. En la barra del proyecto DEMO dice «Demostración vigente», no «En línea».

Qué NO debe pasar: ningún personaje de estación tecleando en la demo; ningún monto ni «rentable»; ningún piso o
departamento nuevo; nada que diga que la transferencia DEMO es real.
