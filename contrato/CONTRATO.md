# Contrato de datos `cauce.estado-proyecto` · versión 1.0.0

Es el único "idioma" entre los sistemas (Ek Chuah, Compago, después Tezcatlipoca y trading) y el centro de operaciones. Cada sistema tiene un **adaptador de solo lectura** que escribe un archivo JSON con esta forma. El visualizador (2D hoy, 3D después) solo lee ese archivo.

La referencia ejecutable es `app/nucleo/contrato.js`. Las pruebas de `pruebas/casos.js` demuestran cada regla. Un ejemplo mínimo válido está en `contrato/ejemplos/minimo.json`.

## Reglas de oro

1. **Nadie aparece trabajando sin evidencia.** `trabajando` exige `evidencia` (origen y referencia) y `actividad.inicio`. Si falta algo, el personaje se muestra como **Sin información** y el visualizador lo anota.
2. **Sin datos recientes, no hay estados.** Si el archivo es más viejo que `vigencia_segundos`, todo el proyecto se muestra *Datos desactualizados*: todos los personajes quedan en *Sin información* y el último estado se ve solo como referencia.
3. **No se inventa avance.** `progreso` solo se manda si el sistema lo registra de verdad (`hecho` y `total` enteros, `0 ≤ hecho ≤ total`). Si no, se omite.
4. **La demostración se nota.** `es_demo: true` muestra una franja de aviso permanente. Los textos de las demostraciones empiezan con `[DEMO]`.
5. **Sin datos privados.** El archivo no lleva claves, montos de personas reales, datos personales ni rutas a bases de datos.

## Estructura

| Campo | Obligatorio | Descripción |
|---|---|---|
| `contrato` | Sí | Siempre `"cauce.estado-proyecto"`. |
| `version` | Sí | Versión del contrato, como `"1.0.0"`. El visualizador acepta cualquier `1.x.y`. |
| `proyecto.id` / `proyecto.nombre` | Sí | `id`: minúsculas, números, `-` o `_` (ej. `ek-chuah`). Debe coincidir con el registro `datos/proyectos.json`. |
| `generado_en` | Sí | Cuándo leyó el adaptador los datos. UTC terminado en `Z`, ej. `2026-11-03T16:28:00Z`. |
| `vigencia_segundos` | Sí | Entero de 30 a 604800. Pasado ese tiempo, el proyecto se muestra desactualizado. |
| `es_demo` | Sí | `true` para ejemplos; `false` para datos de un adaptador. |
| `demo.ahora_simulado` | Solo si `es_demo` | Hora que usa la demostración como "ahora", para que no caduque. Prohibido en datos reales. |
| `fuente.tipo` / `fuente.nombre` / `fuente.version` | Tipo y nombre | `tipo`: `"demo"` (con `es_demo: true`) o `"adaptador"` (con `es_demo: false`). |
| `departamentos[]` | Sí, 1 a 50 | Ver abajo. |
| `alertas[]` | No | Ver abajo. |
| `resultados[]` | No | Ver abajo. |

### Departamento

| Campo | Obligatorio | Descripción |
|---|---|---|
| `id`, `nombre` | Sí | `id` único dentro del proyecto. |
| `descripcion` | No | Qué hace y de dónde salen sus datos. |
| `indicadores[]` | No | Los "letreros" del video: `{etiqueta, valor, unidad?, nota?}`. `valor` puede ser número, texto o `null` (= no disponible). Se muestran los 3 primeros en el plano y todos en el detalle. |
| `agentes[]` | Sí (puede estar vacía) | Personajes, máximo 30. |

### Personaje (`agentes[]`)

| Campo | Obligatorio | Descripción |
|---|---|---|
| `id`, `nombre`, `rol` | Sí | `id` único en todo el proyecto. `rol` = su función permanente. |
| `estado` | Sí | `trabajando`, `esperando`, `finalizado`, `error`, `requiere_revision` o `sin_datos`. |
| `actividad.descripcion` | No | Tarea actual o última. |
| `actividad.inicio`, `actividad.fin` | No* | UTC con `Z`. *`inicio` es obligatorio para `trabajando`. Un `fin` anterior al inicio se descarta. |
| `actividad.progreso` | No | `{hecho, total, unidad?}`, solo si el sistema lo registra. |
| `evidencia.origen`, `evidencia.referencia` | No* | Qué registro respalda el estado (ej. `fetch_log`, `id=812`). *Obligatoria para `trabajando`. `observado_en` opcional. |
| `error.mensaje`, `error.codigo` | No | Detalle de un error. Si `estado` es `error` sin mensaje, el visualizador dice que no hay detalle (no lo inventa). |

### Alerta (`alertas[]`)

`{id, nivel, titulo, detalle?, departamento_id?, agente_id?, creada_en}` con `nivel` = `info`, `advertencia` o `critica`. Si está incompleta se omite con un aviso.

### Resultado (`resultados[]`)

`{id, titulo, descripcion?, departamento_id?, creado_en?, enlace?}`. `enlace` solo puede ser relativo (ej. `datos/reales/informe.html`) o `http(s)://`. Cualquier otro esquema (`javascript:`, `data:`, `file:`…) se quita.

Los campos que el contrato no conoce se ignoran: nunca llegan a la pantalla.

## Qué pasa en cada situación

| Situación | Se muestra |
|---|---|
| El archivo no existe | **Sin conexión**, piso vacío con el motivo. |
| No es JSON o no cumple el contrato | **Archivo inválido**, con la lista de errores. |
| Es de otro proyecto | **Archivo inválido**. |
| `generado_en` más de 5 min en el futuro | **Archivo inválido** (reloj desfasado). |
| Más viejo que su vigencia | **Datos desactualizados**; todos en *Sin información*. |
| Dentro de su vigencia | **En línea**, con los estados (ya corregidos por las reglas de oro). |

## Distribución de la escena (aparte del contrato)

La posición de cada departamento no la decide el sistema sino la escena: `escena/<proyecto>.json` define una cuadrícula (`columnas`, `metros_por_celda`) y `x, y, ancho, alto, piso` por departamento. La vista 2D lo usa como celdas; la 3D lo usará como metros. Un departamento que no aparezca se acomoda solo, debajo de los demás.

## Cambios de versión

- **1.x (menor):** solo agrega campos opcionales. Los visualizadores 1.0 siguen funcionando.
- **2.0 (mayor):** cambia o quita algo. El visualizador 1.x lo rechaza con un mensaje claro en vez de mostrar datos mal interpretados.
