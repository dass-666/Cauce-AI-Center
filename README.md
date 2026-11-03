# Cauce · Centro de operaciones visual

Oficina virtual para observar el trabajo real de nuestros sistemas (Ek Chuah, Compago y, después, Tezcatlipoca y trading). Cada proyecto es un piso, cada área un departamento y cada proceso un personaje que cambia de estado **solo cuando hay un registro que lo respalda**.

**Estado: fase 1, prototipo 2D con datos de demostración.** Todavía no lee datos reales: los adaptadores de Ek Chuah y Compago son las fases 2 y 3. La oficina 3D es la fase 4.

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

## Cómo se usa

- Arriba eliges el **piso** (proyecto). Tezcatlipoca aparece **sin conexión** a propósito: aún no tiene adaptador.
- Haz clic en el **letrero** de un departamento para ver sus indicadores, alertas y resultados.
- Haz clic en un **personaje** para ver su función, tarea, inicio, fin, avance (si el sistema lo informa), evidencia y errores.
- **Bajo consumo** apaga todas las animaciones (útil en celulares modestos). También se respeta la opción de Windows "reducir movimiento".
- La página relee los datos cada 30 segundos y al volver a la pestaña.

La franja amarilla **DATOS DE DEMOSTRACIÓN** indica que nada de lo que ves es actividad real.

### Los seis estados

| Estado | Cómo se ve | Cuándo |
|---|---|---|
| Trabajando | Personaje tecleando, pantalla azul | Hay un registro en curso con hora de inicio |
| Esperando | Personaje quieto, "…" | Conectado, sin tarea en curso |
| Finalizado | Palomita verde | Su última tarea terminó bien |
| Error | "!" rojo | Su última tarea falló (con el mensaje) |
| Requiere revisión | "?" ámbar | Algo espera una decisión humana |
| Sin información | Silla vacía en gris | No hay evidencia, o los datos están viejos o desconectados |

## Pruebas

- **Sin instalar nada:** con `iniciar.bat` en marcha, abre <http://127.0.0.1:8765/pruebas.html>.
- **Con Node.js (opcional, gratis):** doble clic en `probar.bat`, o `node pruebas/ejecutar.mjs`.

Cubren el contrato (archivos válidos e inválidos), las reglas contra actividad inventada, los seis estados, la desconexión, los datos desactualizados, los enlaces peligrosos y la distribución de la escena.

## Estructura

| Ruta | Contenido |
|---|---|
| `contrato/CONTRATO.md` | **El contrato de datos v1** (empieza aquí) y `contrato/ejemplos/` |
| `app/nucleo/` | Validación, estados y modelo de vista (compartidos por 2D y 3D) |
| `app/vistas/` | Vista 2D y panel de detalle |
| `datos/proyectos.json` | Registro de pisos. Para datos reales: copiarlo como `proyectos.local.json` (no va a git) |
| `datos/demo/` | Datos de demostración, marcados `[DEMO]` |
| `datos/reales/` | Donde escribirán los adaptadores (no va a git) |
| `escena/` | Posición de los departamentos (celdas en 2D, metros en 3D) |
| `pruebas/` | Pruebas automáticas |
| `docs/` | Arquitectura y licencias |
