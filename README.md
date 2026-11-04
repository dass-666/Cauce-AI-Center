# Cauce · Centro de operaciones visual

Oficina virtual para observar el trabajo real de nuestros sistemas (Ek Chuah, Compago y, después, Tezcatlipoca y trading). Cada proyecto es un piso, cada área un departamento y cada proceso un personaje que cambia de estado **solo cuando hay un registro que lo respalda**.

**Estado: fase G (sin fusionar).** Compago puede mostrar datos reales. Ek Chuah ya tiene la configuración para conectar su exportador de solo lectura (ver abajo), pero todavía no está conectado a datos reales.

- Costo: $0. Sin servicios externos, sin bibliotecas en tiempo de ejecución, sin IA.
- Funciona solo en tu computadora (`127.0.0.1`); no se publica en internet ni en el servidor compartido.
- Solo lectura: no modifica Ek Chuah, Compago ni sus bases de datos.

## Cómo abrirlo en Windows 11

Necesitas **Python 3** (gratis). Si ya usas Ek Chuah con `uv`, también sirve.

1. Descarga el repositorio (botón **Code → Download ZIP** en GitHub, o `git clone`) y descomprímelo, por ejemplo en `C:\Users\<tu usuario>\Desktop\Cauce-AI-Center`.
2. Haz doble clic en **`iniciar.bat`**. Se abre una ventana negra (el servidor) y el navegador en <http://127.0.0.1:8765>.
3. Para detenerlo, cierra la ventana negra o presiona `Ctrl+C` en ella.

Si `iniciar.bat` dice que no encontró Python, instálalo desde <https://www.python.org/downloads/> marcando **"Add python.exe to PATH"**, y vuelve a intentarlo. Alternativa manual en PowerShell, dentro de la carpeta: `py servir.py`.

> Si Windows muestra "Windows protegió su PC" al abrir el `.bat`, es porque el archivo viene de internet. Puedes revisarlo con el Bloc de notas: solo busca Python y ejecuta `servir.py`.

## Conectar Compago (datos reales)

Requiere la rama `cauce/exportador-solo-lectura` de Compago (agrega el comando `exportar_cauce`; no cambia su lógica ni su base).

1. Abre `conectar_compago.bat` con el Bloc de notas y cambia `COMPAGO_DIR` por la carpeta de Compago (la que tiene `manage.py`). `CADA=300` = cada 5 minutos (mínimo 60).
2. Doble clic en `conectar_compago.bat` y deja esa ventana abierta. Cada ciclo escribe `datos\reales\compago.json` y muestra cuánto tardó, cuántas consultas hizo, CPU y memoria.
3. Con `iniciar.bat` en marcha, el piso **Compago** cambia solo de DEMO a REAL: desaparece la franja amarilla y la barra dice `REAL: Compago · exportar_cauce`.

Qué pasa si algo falla:
- Si cierras la ventana del exportador, después de 3 ciclos sin datos (15 min con `CADA=300`) el piso se muestra **Datos desactualizados** y todos los personajes pasan a *Sin información*.
- Si borras `datos\reales\compago.json`, se vuelve a mostrar la demostración, con aviso.
- Si el archivo está dañado, se muestra **Archivo inválido** (no se tapa con la demostración).

Para una sola exportación (sin repetir), en la carpeta de Compago: `python manage.py exportar_cauce --salida <ruta>\datos\reales\compago.json --medir`.

## Conectar Ek Chuah (datos reales, fase G)

Requiere la rama `claude/exportador-cauce` de Ek Chuah (PR #2; agrega `exportar-cauce`, de solo lectura). Guía completa y pendientes: `docs/EK-CHUAH-INTEGRACION.md`.

1. Abre `conectar_ek_chuah.bat` con el Bloc de notas y cambia `EKCHUAH_DIR` por la carpeta de Ek Chuah (la que tiene `pyproject.toml`). `CADA=0` exporta una vez; `CADA=300`, cada 5 minutos mientras la ventana siga abierta.
2. Escribe `datos\reales\ek-chuah.json`. **No instala ni activa ninguna tarea programada de Windows.**
3. La «Tarea diaria» se muestra como *Programado · sin confirmar* si su log no registra una ejecución en las últimas 26 h.

## Cómo se usa

- Arriba eliges el **piso** (proyecto). Tezcatlipoca aparece **sin conexión** a propósito: aún no tiene adaptador.
- **3D / Plano**: la oficina 3D muestra un departamento a la vez (elígelo arriba a la izquierda). Arrastra para girar, rueda o pellizco para acercar, dos dedos o clic derecho para mover. *Centrar* regresa la cámara. El plano 2D muestra todos los departamentos y gasta menos.
- Haz clic en el **letrero** de un departamento para ver sus indicadores, alertas y resultados.
- Haz clic en un **personaje** para ver su función, tarea, inicio, fin, avance (si el sistema lo informa), evidencia y errores.
- **Bajo consumo** usa el plano 2D sin animaciones y no descarga la 3D (útil en celulares modestos). También se respeta la opción de Windows "reducir movimiento".
- La página relee los datos cada 30 segundos y al volver a la pestaña.

La franja amarilla **DATOS DE DEMOSTRACIÓN** indica que nada de lo que ves es actividad real.

### Los seis estados

| Estado | Cómo se ve | Cuándo |
|---|---|---|
| Trabajando | Personaje sentado tecleando, pantalla azul | Hay un registro en curso con hora de inicio |
| Esperando | Sentado, recargado y mirando alrededor, "…" | Conectado, sin tarea en curso |
| Finalizado | Palomita verde; en 3D se levanta, celebra y se vuelve a sentar | Su última tarea terminó bien |
| Error | "!" rojo; en 3D de pie e inquieto junto a su escritorio | Su última tarea falló (con el mensaje) |
| Requiere revisión | "?" ámbar; en 3D levanta la mano | Algo espera una decisión humana |
| Sin información | Silla vacía y pantalla apagada (en 3D, si estaba, se levanta y sale) | No hay evidencia, o los datos están viejos o desconectados |

## Pruebas

- **Sin instalar nada:** con `iniciar.bat` en marcha, abre <http://127.0.0.1:8765/pruebas.html>.
- **Con Node.js (opcional, gratis):** doble clic en `probar.bat`, o `node pruebas/ejecutar.mjs`.

Cubren el contrato (archivos válidos e inválidos), las reglas contra actividad inventada, los seis estados, la desconexión, los datos desactualizados, los enlaces peligrosos y la distribución de la escena.

## Estructura

| Ruta | Contenido |
|---|---|
| `contrato/CONTRATO.md` | **El contrato de datos v1** (empieza aquí) y `contrato/ejemplos/` |
| `app/nucleo/` | Validación, estados y modelo de vista (compartidos por 2D y 3D) |
| `app/vistas/` | Vista 2D, vista 3D (`vista3d/`) y panel de detalle |
| `vendor/three/` | three.js 0.187.0 copiado (MIT), sin CDN |
| `vendor/kenney-mini-characters/` | Personajes de Kenney (CC0) |
| `datos/proyectos.json` | Registro de pisos: archivo real (`estado`) y demostración (`demo`) de cada proyecto |
| `datos/demo/` | Datos de demostración, marcados `[DEMO]` |
| `datos/reales/` | Donde escriben los adaptadores (no va a git) |
| `conectar_compago.bat` | Arranca el exportador de Compago cada N segundos |
| `escena/` | Posición de los departamentos (celdas en 2D, metros en 3D) |
| `pruebas/` | Pruebas automáticas |
| `docs/` | Arquitectura y licencias |
