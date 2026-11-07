# Auditoría de correspondencia Compago ↔ Cauce (fase E)

Fecha: 2026-11-03. Base: punta de la cadena de Cauce (PR #10, `fase-d/movil`, commit `87ac5dd`) y Compago PR #9 (`cauce/exportador-solo-lectura`, commit `4be1e0f`), leído **solo en lectura**.

**Sobre el inventario:** el inventario técnico de Compago no llegó como archivo (en `uploads/` solo hay dos ZIP de modelos 3D y un video). Trabajé con los 7 hallazgos del mensaje y los **contrasté con el código de Compago**. Todos coinciden con lo que se ve en el código (abajo, la evidencia de cada uno).

Leyenda: **[H]** hecho comprobado en código o en una prueba · **[I]** inferencia razonable · **[?]** sin verificar.

## 1. Matriz de correspondencia

El exportador produce los mismos 8 departamentos e ids que usan la escena y el DEMO de Cauce [H]. El problema no son los cuartos: es **qué representa el personaje** de cada uno.

| Departamento | Personaje | Qué es en Compago | Evidencia que exporta | Naturaleza | ¿Hoy puede engañar? | Cambio en Cauce |
|---|---|---|---|---|---|---|
| Importación | Importador | Consumidor `aplicar_importaciones` con latido [H] | `ImportJob` (id, estado) [H] | **Automático** | Sí: «esperando» se ve **sentado** aunque el indicador diga «sin latido reciente» [H] | Silla vacía si no hay evidencia; ver §3 R2 |
| Búsqueda | Buscadora | Consulta que lanza una persona [H: no hay comando ni programación] | `SearchRun` [H] | **Reactivo** | Sí: «finalizado» = sentada relajada en permanencia, parece en turno | Terminal; aparición breve solo ante un `SearchRun` nuevo observado |
| Revisión de listas | Revisor | `revisar_fuentes`, pensado para cron, **sin programación** (docs/ACTUALIZACION-FUENTES.md: «se programa cuando exista el servidor») [H] | `SourceCheck` [H] | **Reactivo** (hasta que exista la programación) | Sí: sin registros sale «esperando» **sin evidencia** y sentado [H] | Terminal; mismo criterio que Búsqueda |
| Oportunidades | Seguimiento | Decisiones de una persona [H, lo dice el propio exportador] | `StatusChange` (si hay) [H] | **Humano** | Sí: personaje sentado sugiere un bot evaluando | Puesto humano con placa, silla siempre vacía |
| Márgenes | Analista | Cálculo al abrir el escenario; no registra ejecuciones [H] | ninguna; `sin_datos` [H] | **Módulo** | No con el exportador (silla vacía). **Sí en el DEMO de Cauce** («2 aprobaciones por revisar», mano levantada) | Terminal; corregir DEMO |
| Auditoría | Auditora | `revisar_datos` manual; no guarda resultado [H] | ninguna; `sin_datos` [H] | **Módulo** | No con el exportador. **Sí en el DEMO** («Revisión completa», celebra) | Terminal; corregir DEMO |
| Supervisión | Supervisora | Cálculo `estado.respaldo` hecho **al exportar** [H] | `apps.core.estado.respaldo` nivel [H] | **Módulo** | Sí: «esperando» con nivel OK = persona vigilando | Panel/semáforo sin personaje |
| UNIQ | Enlace | `emitir_paquete_uniq` a petición [H] | `PaqueteEmitido` [H] | **Reactivo** | Sí: sin paquetes sale «esperando» sentado sin evidencia [H] | Terminal; breve solo ante paquete nuevo |

Funciones futuras: **ninguno** de los 8 cuartos lo es hoy [H]. El «revisor escéptico» (`apps/revisor`) existe en Compago pero el exportador no lo incluye [H]; es un módulo de observación, no un agente [I].

## 2. Incompatibilidades verificadas (contrato v1 sin cambios)

| Campo | Cómo lo usa Cauce | Exportador PR #9 | Resultado |
|---|---|---|---|
| `es_demo` | `true` ⇒ franja DEMO y reloj simulado; exige `demo.ahora_simulado` y `fuente.tipo:"demo"` | **Siempre `false`**, también con `--entorno demo` (`cauce.py` línea 336) [H] | **Defecto real.** Archivo válido, pero registros demo se ven como REALES, sin franja (prueba «defecto verificado») |
| `proyecto` | `id` debe ser `compago` (registro) | `compago` [H] | Compatible |
| `departamentos` | 1–50, ids únicos; posición por `escena/compago.json` | 8, mismos ids [H] | Compatible |
| `agentes` | ids únicos en el proyecto | únicos [H] | Compatible. El DEMO de Cauce tiene un 9.º (`importador-cola`) que el exportador no produce |
| `estado` | 6 valores | usa 5 [H] | Compatible en forma; el problema es semántico (§3) |
| `evidencia` | `origen`+`referencia`; obligatoria solo para `trabajando` | presente salvo en «esperando» sin registros, módulos y oportunidades sin cambios [H] | Compatible; pero «esperando» sin evidencia se dibuja sentado |
| `actividad` | `trabajando` exige `inicio`; `fin<inicio` se descarta | cumple [H] | Compatible |
| `generado_en` | UTC con Z; >5 min en futuro = inválido | `_iso(ahora)` [H] | Compatible [I: depende del reloj de Windows] |
| `vigencia_segundos` | 30–604800; más viejo ⇒ todos «sin información» | 900 o 3×`--cada` [H] | Compatible |

Otros hallazgos en el exportador: con `--entorno demo`, **Supervisión lee el respaldo real** (no filtra `is_demo`) [H], así que un archivo «demo» mezcla un dato real. Los textos demo empiezan con «[Registros DEMO de Compago]», no con «[DEMO]» como pide la regla 4 [H, menor].

**Límite del contrato v1 (no defecto):** un archivo con `es_demo:true` usa `ahora_simulado` como reloj, así que nunca caduca [H, prueba]. Para una exportación demo periódica no se vigila frescura. Aceptable para demo; no se cambia el contrato.

## 3. Riesgos de actividad ficticia

Medido con el ejemplo del exportador: **hoy se dibujan 6 personajes; solo 1 tiene un proceso automático detrás** [H, prueba «riesgo medido»].

| # | Riesgo | Gravedad | Dónde |
|---|---|---|---|
| R1 | «esperando» sin evidencia = personaje sentado. La regla de oro solo protege `trabajando` | Alta | Cauce (estados.js, contrato) |
| R2 | Importador «esperando» o «trabajando» con consumidor **sin latido**: un lote atascado en `procesando` se vería tecleando indefinidamente | Alta | Exportador + Cauce |
| R3 | Personajes en procesos humanos, reactivos y módulos aparentan bots en turno | Alta | Cauce |
| R4 | `es_demo:false` en demo ⇒ demo presentado como real | Alta | Exportador |
| R5 | El DEMO de Cauce muestra actividad que Compago no registra (auditoría completa, márgenes con aprobaciones, segundo importador) | Media | `datos/demo/compago.json` |
| R6 | Etiqueta «Esperando: conectado y sin tarea» no es cierta para reactivos ni humanos | Media | estados.js |

## 4. Propuesta visual

Una **clasificación local** por agente (`prototipos/naturaleza/compago.json`, fuera del contrato, como la escena) y una regla por naturaleza (`app/nucleo/naturaleza.js`):

- **A. Automático:** personaje en su silla **solo con evidencia**. Sin evidencia, silla vacía y pantalla apagada.
- **B. Reactivo:** terminal que muestra el último registro. Un personaje aparece **8 s** solo si esta página vio cambiar la referencia de evidencia entre dos lecturas; la primera lectura nunca cuenta.
- **C. Humano:** placa «HUMANO», silla **siempre** vacía (Cauce no sabe si la persona está). Se muestra lo último que registró y, si pide decisión, se resalta la placa.
- **D. Módulo:** equipo o pantalla con el color del último resultado; nunca personaje.
- **E. Futuro:** cuarto con cinta «Inactivo · función futura».
- Sin clasificar: terminal sin personaje y aviso (lo prudente).

Se conservan los 8 cuartos: corresponden 1 a 1 con lo que exporta Compago, así que no hay razón para quitar ni agregar.

Prototipo aislado: `prototipos/naturaleza/index.html` (con `servir.py`: <http://127.0.0.1:8765/prototipos/naturaleza/index.html>). Dos lecturas DEMO; en la segunda solo la Buscadora aparece breve. Capturas en `cauce/fase-e/` de los archivos del proyecto.

## 5. Cambios necesarios en Cauce (no aplicados a la app principal)

1. Llevar `naturaleza.js` a la vista 3D: el personaje se crea o no según `presentar()`; los módulos y reactivos usan un mueble terminal.
2. Regla nueva en Cauce (no en el contrato): «esperando» sin evidencia ⇒ silla vacía para todas las naturalezas.
3. Para reactivos y humanos, mostrar «Sin actividad registrada» en vez de «Esperando».
4. Importador: si el indicador «Consumidor» ≠ «activo», no dibujar personaje (acoplado al texto del indicador; mejor resolverlo en el exportador, ver §6.3).
5. Corregir `datos/demo/compago.json` para que imite exactamente lo que el exportador puede producir (quitar `importador-cola`, Márgenes y Auditoría en `sin_datos`).

## 6. Cambios para Claude de Compago (mínimos, sin tocar el contrato)

1. **`construir_documento`** (`apps/core/cauce.py`), cuando `demo` sea verdadero:
   ```python
   "es_demo": demo,
   "fuente": {"tipo": "demo" if demo else "adaptador", ...},
   # y solo si demo:
   "demo": {"ahora_simulado": _iso(ahora)},
   ```
   Cambiar **solo** `es_demo` hace que Cauce rechace el archivo (prueba «arreglo ingenuo»). Las tres piezas juntas son válidas (prueba «arreglo mínimo»). Ajustar `test_cauce.py` línea 42.
2. Con `--entorno demo`, no exportar el respaldo real en Supervisión (usar «sin_datos» o un valor demo).
3. Importador: si no hay latido vigente, no emitir «esperando» ni «trabajando» como si el consumidor estuviera en marcha; emitir `requiere_revision` con evidencia del latido (p. ej. `origen:"latido", referencia:"último=<hora>"`), o `sin_datos`.
4. Opcional: prefijo «[DEMO]» en los textos demo (regla 4).

## 7. Dependencias de Ronaldo

[I] Ronaldo es quien opera UNIQ y el servidor (según `PARA-RONALDO.md` en Compago). Depende de él:
- Si UNIQ **solicita** paquetes por su cuenta (lo que haría el Enlace más que reactivo). Hoy se ve a petición [H en Compago; ? del lado UNIQ].
- El servidor donde correrían `aplicar_importaciones` de forma continua y `revisar_fuentes` por cron. Sin servidor, Revisión de listas sigue siendo reactiva.
- Nada de esta fase requiere su intervención para avanzar.

## 8. Plan incremental

| Paso | Qué | Quién | Requisito |
|---|---|---|---|
| E1 | Este prototipo y las pruebas (hecho) | Cauce | — |
| E2 | Arreglo `es_demo` en exportador (§6.1–6.2) | Claude de Compago | Tu visto bueno |
| E3 | Corregir DEMO de Cauce (§5.5) | Cauce | — |
| E4 | `naturaleza.js` en la vista 3D + mueble terminal + placa humana (§5.1–5.3), medir 55–60 cps en tu Intel UHD | Cauce | Decisión 1 de §10 |
| E5 | Latido del importador (§6.3) y §5.4 | Compago y Cauce | — |
| E6 | Reclasificar Revisión de listas a automático cuando exista cron real | Ambos | Servidor (Ronaldo) |

## 9. Pruebas realizadas

- Node: **129 pasaron, 0 fallaron** (109 previas + 20 nuevas en `pruebas/casos-naturaleza.js`).
- Chromium, `pruebas.html`: **129 pasaron, 0 fallaron**, sin errores de página.
- Chromium, `pruebas/navegador/naturaleza.cjs`: prototipo en escritorio (1280) y móvil (390): 8 cuartos, solo el Importador presente en la lectura 1, solo la Buscadora breve en la lectura 2, ningún puesto humano con personaje, sin desplazamiento horizontal, sin errores.
- No probé el exportador de Compago ejecutándolo (necesita su base de datos); los casos de compatibilidad usan el ejemplo `contrato/ejemplos/compago-exportador.json` y la lectura del código.
- No medí rendimiento 3D: esta fase no toca la escena 3D.

## 10. Decisiones tuyas

1. ¿Aceptas que en Cauce solo el Importador tenga personaje y el resto pase a terminal o placa humana? (recomendado)
2. ¿Autorizas pedir a Claude de Compago el arreglo §6.1–6.2? Es pequeño y no cambia el contrato.
3. ¿El arreglo del latido (§6.3) lo hace Compago (recomendado) o Cauce lo infiere del indicador (§5.4, más frágil)?
4. Cuando exista cron para `revisar_fuentes`, ¿se muestra como automático o como una categoría «programado»?
