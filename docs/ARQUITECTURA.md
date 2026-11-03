# Arquitectura

```
Ek Chuah  ──adaptador (solo lectura)──►  datos/reales/ek-chuah.json  ─┐
Compago   ──adaptador (solo lectura)──►  datos/reales/compago.json   ─┼─► servir.py (127.0.0.1) ─► navegador
(demo)    ─────────────────────────────►  datos/demo/*.json          ─┘
                                                                          │
                     app/nucleo/  contrato.js  → valida y corrige         │
                                  modelo.js    → decide qué se muestra    │
                                  estados.js   → catálogo de 6 estados    │
                     app/vistas/  vista2d.js   (hoy)  ┐ misma interfaz:   │
                                  vista3d.js   (fase 4)┘ dibujar(modelo)  │
                                  panel.js     → detalle compartido       ┘
```

## Principios

- **Una sola dirección:** los sistemas escriben un JSON; el centro lo lee. El centro nunca escribe en un sistema, nunca abre sus bases y nunca ejecuta sus comandos.
- **Las reglas viven en el núcleo, no en las vistas.** `modelo.js` decide si un dato es confiable y qué estado mostrar. La vista 2D y la futura 3D solo dibujan. Así la 3D no puede "olvidar" una regla.
- **Costo cero:** sin servicios externos, sin bibliotecas en tiempo de ejecución, sin IA. `servir.py` usa solo la biblioteca estándar de Python y escucha únicamente en `127.0.0.1`.
- **Un piso por proyecto:** cada proyecto es un piso del edificio; cada departamento, un cuarto. Agregar Tezcatlipoca o trading = un adaptador + una escena + una línea en `datos/proyectos.json`.

## Vista 3D (`app/vistas/vista3d/`)

Misma interfaz que la 2D: `crearVista3D(contenedor, { alSeleccionar, alFallar })` → `{ dibujar(modelo, seleccion), destruir() }`. Consume el **mismo modelo de vista**; no decide estados.

| Archivo | Qué hace | ¿Usa three.js? |
|---|---|---|
| `disposicion.js` | Tamaño del cuarto, lugar de cada escritorio, puerta y camino de la puerta a la silla | No (se prueba en Node) |
| `maquina.js` | Máquina de estados: de `animacion3d` (de `estados.js`) a una cola de acciones (`entrar`, `sentarse`, `teclear`, `celebrar`, `salir`…) | No |
| `paleta.js` | Colores por estado (los mismos que la 2D) y aspecto estable de cada personaje | No |
| `recursos.js` | Lleva la cuenta de geometrías, materiales y texturas para liberarlos de la tarjeta gráfica | No |
| `personaje.js` | Controlador del personaje (cola de acciones, caminos) y cuerpo provisional hecho con código | Sí |
| `kenney.js` | Personajes de Kenney (CC0): descarga solo los modelos que se ven, usa sus clips (walk, idle, sit, emote-no) y suma con código teclear, levantar la mano y celebrar. Si un modelo no carga, se usa el cuerpo provisional | Sí |
| `plano-edificio.js` | Coloca los 8 departamentos en el piso a partir de las celdas de `escena/<proyecto>.json`, con pasillos; cada cuarto crece si necesita más filas de escritorios | No (se prueba en Node) |
| `edificio.js` | Arma el escenario: un cuarto (modo *Un cuarto*) o todos con losa, pasillos y plantas (modo *Edificio*); decide cuántas veces por segundo se anima cada cuarto | Sí |
| `medidor.js` | Medidor de `?medir=1`: promedio, mínimo, peor cuadro y segundos bajo 50 cps de los últimos 20 s; se reinicia al cambiar brillo, modo, enfoque o tamaño | No (se prueba en Node) |
| `arquitectura.js` | Muros exteriores con ventanas, columnas, pretil, recepción (letrero con proyecto, REAL/DEMO y conexión; reloj con la hora local), placas en el pasillo. Sin personas | Sí |
| `identidad.js` | Tema y color de cada departamento (por palabras del id o del nombre) | No (se prueba en Node) |
| `iconos.js` | Símbolos de cada tema dibujados en un lienzo | No (usa canvas) |
| `iluminacion.js` | Luz según la hora local o fija; nunca baja de un mínimo visible | No (se prueba en Node) |
| `minimapa.js` | Minimapa HTML con el color del estado real de cada departamento | No (canvas 2D) |
| `encuadre.js` | Encuadre exacto: con las esquinas del escenario en coordenadas de cámara, calcula zoom y centro para llenar la zona libre; ningún cuarto queda bajo la barra, avisos o minimapa | No (se prueba en Node) |
| `etiquetas.js` | Etiquetas sin encimarse (gana la más importante; prueba 3 lugares por cuarto) y nombres cortos para celular | No (se prueba en Node) |
| `oficina.js` | Un departamento: piso, muros, mamparas, escritorios, computadoras, sillas, planta, letrero | Sí |
| `escena3d.js` | Renderizador, cámara isométrica ortográfica, controles, selección, brillo, ciclo de dibujo | Sí |

Reglas:

- **Dos modos** (se recuerda la elección): *Edificio* muestra los 8 departamentos a la vez; tocar uno acerca la cámara (0.6 s) y el panel muestra sus agentes. *Un cuarto* es la vista individual original. Al cambiar de modo o de departamento se liberan los recursos (prueba: cambios repetidos sin crecer la memoria).
- **Animación por distancia y enfoque:** el cuarto enfocado se anima en cada cuadro; los demás a 20 veces/s (12 si hay más de 12 personajes; 8 en celular) y los que quedan fuera de pantalla a 2. Lo estático de cada cuarto se fusiona en una geometría por material para hacer menos llamadas de dibujo. Los personajes no se simplifican.
- Etiquetas con nombre y estado de cada departamento (HTML sobre el lienzo); nunca se enciman y se ocultan al acercarse. En celular, nombre corto.
- Noche: ambiente mínimo 1.7, piso de los cuartos un poco más cálido y anillo de estado bajo cada personaje más visible. No se cambian los materiales de Kenney.
- Celular: sin giro de cámara; un dedo a los lados cambia de departamento, dos dedos acercan y mueven.
- `ausente` (= `sin_datos`) es **silla vacía con la pantalla apagada**. Si un personaje pierde la evidencia, se levanta y sale.
- La primera vez que se dibuja, cada personaje con evidencia entra caminando desde la puerta (es una animación de llegada, no significa que la tarea acabe de empezar; la hora real está en el panel).
- `app.js` carga la 3D con `import()` solo si se usa. *Bajo consumo* fuerza el plano 2D y no descarga three.js. Sin WebGL, o si la tarjeta gráfica deja de responder, vuelve sola al plano 2D con aviso.
- Rendimiento: 60 cuadros/s máx. en escritorio y 30 en celular; resolución limitada (1.25× en celular); sin sombras reales (manchas suaves); sin antialiasing en celular; se detiene con la pestaña oculta.
- Brillo (bloom): solo escritorio, **apagado por defecto**, se descarga aparte al encenderlo y **se apaga solo** si el equipo no sostiene 40 cuadros/s.
- `?medir=1` muestra cuadros por segundo, llamadas de dibujo, triángulos, geometrías y texturas.
- El controlador pide poses (`caminar`, `sentado`, `teclear`…) a un "cuerpo" con método `aplicar(pose, dt)`. Hay dos cuerpos: Kenney (`kenney.js`) y el provisional. Cambiar de personajes no toca la máquina de estados ni los caminos.

**Tablero y cambios (fuera de la 3D, también en el plano):** `app/vistas/tablero.js` muestra REAL/DEMO, conexión, antigüedad del dato, agentes por estado, alertas del archivo y los cambios observados. `app/nucleo/cambios.js` compara la lectura anterior con la actual (estado de agentes, agentes y alertas que aparecen o desaparecen, conexión). No es un historial: no guarda nada al recargar, no inventa pasos intermedios y solo dice entre qué datos (`generado_en`) se observó cada cambio.

**Decoración vs. evidencia:** la luz, el reloj, las ventanas, los muebles por tema y las placas son decoración y nunca simulan trabajo; no hay personas decorativas. La torreta de un departamento solo aparece si el archivo trae alertas suyas: parpadea solo con una alerta crítica y datos vigentes; con datos vencidos queda gris.

## Adaptadores

**Compago (fase 2, construido):** comando `exportar_cauce` en la rama `cauce/exportador-solo-lectura` de Compago (`apps/core/cauce.py`). Usa los modelos de Compago, así que funciona igual con SQLite y PostgreSQL. Garantiza solo lectura en la base (`PRAGMA query_only` / transacción `READ ONLY`), hace 18 consultas por ciclo sin importar el volumen y no exporta nombres de proveedores, productos, archivos, términos de búsqueda, usuarios ni textos de error. Si ya hay un archivo real, el visualizador lo usa; si no existe, muestra la demostración.

**Ek Chuah (pendiente):**

| Proyecto | Evidencia disponible | Limitación conocida |
|---|---|---|
| Ek Chuah | `fetch_log` (descargas con inicio, fin, estado y error), `alerts_sent`, `logs/alertas_diarias.log` | Simulaciones y análisis de riesgo no registran ejecuciones: se verán *Sin información*. |
| Compago | `ImportJob`/`ImportBatch`, `SearchRun`, `SourceCheck`, `apps/core/estado.py`, conteos de oportunidades | La importación se aplica en una sola transacción y no guarda avance por fila: no hay porcentaje real. |

Condiciones para ambos: abrir la base en modo solo lectura (o con un usuario de solo lectura), consultas acotadas e indexadas, frecuencia baja (cada 5–15 min o al terminar una tarea), y nunca en el servidor compartido.
