# Contrato `cauce.estaciones` · versión 0.1.0 (propuesta)

Estado de las **estaciones de trabajo** que viven dentro de una oficina (piso) existente. Es un archivo **aparte** del
contrato `cauce.estado-proyecto` 1.0.0, que **no cambia**: una estación no es un departamento ni un agente.

- Referencia ejecutable: `app/nucleo/estaciones.js` (`validarEstaciones`, `construirEstaciones`, `cruzarEnlace`).
- Pruebas: `pruebas/casos-estaciones.js` (Node y `pruebas.html`) y `pruebas/navegador/estaciones.cjs` (Chromium).
- Ejemplos (demostración, datos inventados): `datos/demo/ek-chuah-estaciones.json`, `datos/demo/compago-estaciones.json`.

## Dónde vive cada cosa

| Qué | Dónde | Lo escribe |
|---|---|---|
| Que la estación existe, en qué departamento está y qué funciones tiene | `escena/<proyecto>.json` › `"estaciones"` | Cauce (estructura; no cambia con los datos) |
| En qué estado está cada función | `datos/reales/<proyecto>-estaciones.json` | El exportador de solo lectura del proyecto (**todavía no existe**) |
| Demostración | `datos/demo/<proyecto>-estaciones.json` | Cauce, a mano, marcada DEMO |

Las rutas por omisión se pueden cambiar en `datos/proyectos.json` con `estaciones_estado` (solo `datos/reales/`) y
`estaciones_demo` (solo `datos/demo/`). El archivo de estaciones se lee de la **misma carpeta que el piso**: si el piso
muestra la demostración, `datos/demo/`; si el piso es REAL, `datos/reales/`. Nunca cae a la demostración en silencio.

## Reglas de oro

1. **Nadie teclea sin evidencia.** `en_proceso` exige `evidencia` (`origen`, `referencia`) e `inicio`; si falta, el
   puesto se muestra «Sin información».
2. **Un registro guardado no es un proceso.** Señal recibida, investigación pendiente o evaluación disponible se
   dibujan como *consulta* (el personaje lee), nunca como trabajo en curso.
3. **Sin datos vigentes, sillas vacías.** Sin archivo, inválido, de otro proyecto, vencido o con hora futura: todos los
   puestos «Sin información» (el último estado se conserva solo como referencia en el panel).
4. **DEMO y REAL no se mezclan** (`es_demo` debe coincidir con el piso) y lo DEMO se rotula en el tablero y el panel.
5. **Sin importes ni conclusiones comerciales.** Los `conteos` son enteros ≥ 0 o `null`. Un texto con un importe
   (`$1,200`, `350 USD`) o una conclusión («rentable», «ganancia segura», «recomendación de compra») no se muestra.
   Nombrar una divisa (`USD/MXN`) sí se permite.
6. **Una transferencia entre oficinas solo se ve confirmada si las dos partes la registran** (misma `senal_id`,
   `emitida` en el origen y `recibida` en el destino, ambas vigentes y de la misma naturaleza). Un solo lado = «sin
   confirmar». Un enlace sin `evidencia` se descarta.
7. Los campos que el contrato no conoce se ignoran: nunca llegan a la pantalla.

## Estructura

| Campo | Obligatorio | Descripción |
|---|---|---|
| `contrato` | Sí | `"cauce.estaciones"` |
| `version` | Sí | `0.1.x` (otra menor o mayor se rechaza mientras sea propuesta) |
| `proyecto.id` | Sí | Debe coincidir con el piso |
| `generado_en` | Sí | UTC con `Z` |
| `vigencia_segundos` | Sí | 30 a 604 800 |
| `es_demo`, `demo.ahora_simulado` | Sí / solo DEMO | Como en el contrato v1 |
| `fuente.tipo`, `fuente.nombre` | Sí | `demo` (con `es_demo: true`) o `adaptador` |
| `estaciones[]` | Sí, 1 a 8 | Ver abajo |

### Estación

| Campo | Obligatorio | Descripción |
|---|---|---|
| `id` | Sí | El mismo id que en `escena/<proyecto>.json` › `estaciones` |
| `puestos[]` | No | `{ id, estado, nota?, evidencia?, inicio? }`; `id` = el de la escena |
| `conteos[]` | No | Hasta 8 `{ etiqueta, valor (entero ≥ 0 o null), nota? }` |
| `datos_faltantes[]` | No | Hasta 12 textos cortos: **tipos** de dato que faltan (nunca valores) |
| `enlaces[]` | No | `{ senal_id, sentido (emitida \| recibida), contraparte (id de proyecto), registrado_en, evidencia }` |
| `nota`, `contrato_origen` | No | Texto corto |

### Estados de un puesto

| Estado | Postura 3D | Qué significa |
|---|---|---|
| `sin_actividad` | sentado, espera | La función existe y no tiene nada pendiente |
| `senal_recibida` | consulta (lee) | Llegó una señal registrada: una alerta, no una conclusión |
| `investigacion_pendiente` | consulta | Investigación abierta que espera a una persona |
| `evaluacion_disponible` | consulta | Hay una evaluación guardada. **No confirma rentabilidad** |
| `datos_insuficientes` | pide atención (mano) | Faltan datos para concluir |
| `riesgo_detectado` | pide atención | Riesgo o verificación débil que alguien debe revisar |
| `en_proceso` | teclea | Proceso registrado en curso, **con evidencia e inicio** |
| `sin_informacion` | silla vacía | Solo lo pone Cauce (sin datos vigentes); el archivo no puede escribirlo |

Los gestos de transición (levantar la mano, entrar) solo se ven ante un cambio observado entre dos lecturas, como en
el resto de la oficina.

## Dos canales distintos (no confundirlos)

| Canal | Qué lleva | Estado verificado (solo lectura, 2026-11-08) |
|---|---|---|
| 1. Comercial, Ek Chuah → Compago | Señales económicas `ek-chuah.senales-economicas` 0.2.0 | Ek Chuah PR #4 (ff3b6cd) lo **ofrece**; Compago PR #27 (74e5562) lo **consume** con `adaptador_ek_chuah_02.py`, que conserva el `id` de la señal (`SEN-…`). Ninguno de los dos PR está fusionado. Ek Chuah dice en su código «No está conectado a Compago ni a Cauce». Este canal **no pasa por Cauce** y Cauce no lo necesita para dibujar. |
| 2. Estado de estaciones, cada proyecto → Cauce | `cauce.estaciones` 0.1.0 (este contrato) | **No existe ningún exportador** en Ek Chuah ni en Compago. Compago PR #28 (e617db4) tiene `apps/internacional/estacion.py` (`estado_internacional` 0.1.1), una salida de solo lectura que todavía no escribe ningún archivo («No está conectado a `exportar_cauce`»). |

Mientras el canal 2 no exista, la oficina REAL muestra sillas vacías y «falta su exportador», y una transferencia
entre oficinas no se puede confirmar como real. La demostración lo rotula: «transferencia de DEMOSTRACIÓN (no es
real)», luz ámbar.

## Lector de la salida de Compago (ya en Cauce)

`app/nucleo/estaciones-compago.js` acepta, en `datos/reales/compago-estaciones.json`, en lugar de un
`cauce.estaciones` directo, este sobre con lo que ya devuelve `estacion.estado(demo)` de Compago:

```json
{ "contrato": "compago.estado-internacional", "version": "0.1.1", "proyecto": { "id": "compago" },
  "generado_en": "2026-11-08T21:00:00Z", "vigencia_segundos": 1800, "es_demo": false,
  "departamento": { "...": "lo que devuelve estacion.estado(demo)" } }
```

Ejemplo sintético: `contrato/ejemplos/compago-estado-internacional.json`. Traducción (lectura de Cauce, no
afirmación de Compago, y así lo dice el panel):

| Puesto | Estado que dibuja Cauce |
|---|---|
| investigador | `investigacion_pendiente` si hay investigaciones pendientes; si no, `senal_recibida` si hay acontecimientos por revisar; si no, `sin_actividad` |
| importacion | `riesgo_detectado` si hay riesgos; si no, `datos_insuficientes` si hay evidencia insuficiente; si no, `sin_actividad` |
| evaluador | `evaluacion_disponible` si hay evaluadas (no confirma rentabilidad); si no, `sin_actividad` |

Nunca `en_proceso` (Compago no registra ejecuciones con inicio) y sin `enlaces` (el sobre no trae ids de señal).
Conteos: los cinco de `estacion.conteos` y `detalle.productos_candidatos`, solo enteros. Un sobre con contrato,
versión o `es_demo` incoherentes se rechaza como archivo inválido (sillas vacías, nunca la demo). Pruebas:
`pruebas/casos-estaciones.js`.

## Especificación para los desarrolladores de cada proyecto (no hecho; no se tocó su código)

### Compago (lo mínimo, sobre PR #28)

1. Un comando de solo lectura, por ejemplo `python manage.py exportar_estacion_cauce --salida <ruta> [--demo]`, que
   escriba el sobre de arriba con `departamento = estacion.estado(demo)`, `generado_en` UTC con `Z` y
   `vigencia_segundos` de 1800 (ajustable). `es_demo` del sobre = el argumento `demo` (en la auditoría de
   Compago se vio un exportador que escribía `false` en demo: aquí no debe repetirse).
2. Escritura atómica (archivo temporal + reemplazo), UTF-8, sin importes, proveedores ni nichos (ya lo cumple
   `estado()`).
3. Opcional, para que Cauce pueda confirmar transferencias reales: añadir a `estacion` una lista
   `senales_recibidas: [{ "id": "SEN-…", "registrado_en": "…Z" }]` con el `id` que conserva `adaptador_ek_chuah_02`
   (las del adaptador 0.1 llevan prefijo `ek-` y no sirven para cruzar). Cauce lo traduciría a `enlaces[].recibida`.

### Ek Chuah (sobre PR #4)

1. Un comando de solo lectura, por ejemplo `uv run ek-chuah exportar-estaciones-cauce --salida <ruta> [--demo]`,
   que escriba `cauce.estaciones` 0.1.0 con una estación `observatorio` y tres puestos `macro`, `geopolitico`,
   `riesgos` (los ids de `escena/ek-chuah.json`).
2. Estados a partir de lo que ya calcula: `senal_recibida` si hay señales nuevas de su tipo (macro: `divisas`,
   `inflacion`; geopolítico: `aranceles`, `restricciones_comerciales`, `logistica`, `riesgos_suministro`);
   `riesgo_detectado` si una evaluación trae un problema con `gravedad = "bloquea"`; `datos_insuficientes` si
   `cobertura.registros_sin_evidencia_suficiente > 0` o hay `fuentes_sin_acceso`; `en_proceso` **solo** con una
   ejecución registrada con `inicio` y `evidencia`; si no, `sin_actividad`.
3. `conteos`: enteros de `cobertura` (por tipo). `datos_faltantes`: tipos de dato, nunca valores.
4. `enlaces[]`: `{ "senal_id": "SEN-…", "sentido": "emitida", "contraparte": "compago", "registrado_en": "…Z",
   "evidencia": { "origen": "ek-chuah", "referencia": "senales-economicas 0.2.0 <generado_en>" } }` **solo** cuando
   el archivo de señales se entregó de verdad a Compago (no al generarlo).
5. `es_demo: true` y `fuente.tipo: "demo"` cuando la captura es sintética (`naturaleza = "sintetica"`).

### Cauce (cuando lleguen los archivos)

Copiarlos a `datos/reales/<proyecto>-estaciones.json` (o declarar la ruta en `datos/proyectos.json` ›
`estaciones_estado`). No hace falta cambiar código: el validador ya rechaza lo que no cumpla.
