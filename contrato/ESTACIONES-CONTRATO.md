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

## Qué falta para conectar los proyectos (no hecho)

| Proyecto | Necesita | Fuente propuesta (verificar contra el código cuando se fusione) |
|---|---|---|
| Ek Chuah (PR #4, sin fusionar) | Un exportador de solo lectura que escriba `ek-chuah-estaciones.json` | Macro: señales `divisas` e `inflacion` de `ek-chuah.senales-economicas`; geopolítico: acontecimientos y señales `aranceles`, `restricciones_comerciales`, `logistica`; riesgos: `verificaciones` y `riesgos` de `ek-chuah.observatorio` (`bloquea` → `riesgo_detectado`). `ejecucion.estado` con inicio/fin reales sería la única fuente válida para `en_proceso`. `enlaces[].emitida` solo cuando exista una entrega real del archivo a Compago. |
| Compago (PR #26, sin fusionar) | Una función más en `apps/core/cauce.py` (o junto a ella) que escriba `compago-estaciones.json` | `SenalExterna` (recibidas, sin `trabajando`), `InvestigacionComercial.estado` (`pendiente` → `investigacion_pendiente`, `incompleta` → `datos_insuficientes` con `datos_faltantes` como tipos, `evaluada` → `evaluacion_disponible`, `descartada` → conteo). `enlaces[].recibida` con el id de origen de la señal (no el prefijo `ek-` del adaptador). Sin importes, nombres de proveedor ni productos. |
| Ambos | Alinear contratos | Hoy el adaptador de Compago consume `ek-chuah.observatorio` 0.1 y Ek Chuah ofrece además `ek-chuah.senales-economicas` 0.1 «para Compago»: hay que decidir cuál es el canal oficial y cómo se conserva el id de la señal de punta a punta para que Cauce pueda confirmar transferencias. |
