# Fase G: integración del exportador de Ek Chuah

Rama `fase-g/integracion-ek-chuah`, apilada sobre `fase-f/multiproyecto` (PR #14). No había ninguna rama de una fase G visual: la última rama de Cauce era la F, así que no hay cambios duplicados. Nada está fusionado ni desplegado. **Ek Chuah y Compago no se modificaron**: Ek Chuah se leyó en su PR #2 (rama `claude/exportador-cauce`, commit `a23e06c`) y Compago no se tocó. El contrato v1 tampoco cambió (`contrato/` y `app/nucleo/contrato.js` quedan igual).

Uso tres etiquetas: **[verificado]** (probado aquí, con prueba o registro), **[inferido]** (deducción razonable sin prueba) y **[sin verificar]** (requiere tu PC con Windows).

## 1. Matriz de compatibilidad (contrato v1 ↔ exportador de Ek Chuah)

| Campo del contrato | Qué manda Ek Chuah | Resultado en Cauce |
|---|---|---|
| `contrato`, `version` | `cauce.estado-proyecto` 1.0.0 | Compatible [verificado: validador 8/8] |
| `proyecto.id` | `ek-chuah` | Coincide con el registro y la escena [verificado] |
| `generado_en`, `vigencia_segundos` | UTC con `Z`; 26 h por omisión, `--vigencia` configurable | Al vencer se muestra «Datos desactualizados» [verificado en Node y Chromium] |
| `es_demo`, `fuente.tipo` | REAL: `false` / `adaptador`. `--demo`: `true` / `demo` y `demo.ahora_simulado` | Franja DEMO solo con `es_demo: true` [verificado] |
| `departamentos[].id` | Las 6 oficinas del DEMO de Cauce | Las 6 caben en `escena/ek-chuah.json` sin cambios [verificado] |
| `agentes[].id` | Los 6 del DEMO más `tarea-diaria` | Los 7 están clasificados [verificado] |
| `estado` | finalizado, error, requiere_revision, esperando, sin_datos, y trabajando solo con `running` de hace 30 min o menos | Compatible; un `trabajando` sin evidencia se degrada (regla del contrato) [verificado] |
| `actividad.progreso` | Nunca lo manda | No se inventa avance [verificado] |
| `evidencia.observado_en` | **Hora de la exportación, no la del registro** | ⚠ Defecto 1: lo resuelve la configuración de Cauce, ver §4 |
| `alertas[]` | `ek-as-<id>` y `ek-exp-<motivo>`, con títulos fijos | Van al panel y no crean personajes [verificado] |
| `resultados[]` | Solo nombres de los análisis, sin `enlace` | Se muestran sin enlace [verificado] |

## 2. Los 8 escenarios de extremo a extremo (Chromium, `pruebas/navegador/ek-chuah-pr2.cjs`)

Son los documentos de `contrato/ejemplos/ek-chuah-pr2/`, generados por el exportador con bases **sintéticas**. Cada uno se sirve como `datos/reales/ek-chuah.json` y es la primera lectura del piso.

| Documento | Fuente | Oficinas | Visibles al cargar | Tarea diaria | Datos sensibles |
|---|---|---|---|---|---|
| demo-dia-normal | DEMO, con franja | 6 | 0 | Programado, confirmada | ninguno |
| real-dia-normal | REAL | 6 | 0 | Programado, confirmada | ninguno |
| demo-fallas | DEMO, con franja | 6 | 0 | Programado, confirmada (con error) | ninguno |
| real-fallas | REAL | 6 | 0 | Programado, confirmada (con error) | ninguno |
| demo-sin-evidencia | DEMO, con franja | 6 | 0 | Programado · sin confirmar | ninguno |
| real-sin-evidencia | REAL | 6 | 0 | Programado · sin confirmar | ninguno |
| demo-sin-base | DEMO, con franja | 6 | 0 | Programado · sin confirmar | ninguno |
| real-sin-base | REAL (con alerta crítica) | 6 | 0 | Programado · sin confirmar | ninguno |

Secuencia de animaciones (en la misma prueba):
- Una corrida nueva y reciente de la tarea diaria hace que el personaje entre unos 8 s, sin celebrar, y luego salga. Nadie más se mueve.
- Un registro nuevo pero de hace 3 días no hace entrar a nadie.
- Leer el mismo archivo otra vez no mueve a nadie.
- Pasar de DEMO a REAL no cuenta como un registro nuevo.
- Con el archivo vencido aparece «Datos desactualizados» y no se ve a nadie.
- En celular (iPhone 12 emulado) la cabecera dice REAL y la página no se desplaza a lo ancho.

## 3. Clasificación definitiva de las oficinas (`escena/ek-chuah-naturaleza.json`)

| Oficina | Puesto | Naturaleza | Por qué |
|---|---|---|---|
| Obtención de datos | descargador | Reactivo | `fetch-macro` lo lanza la tarea o una persona, y `fetch_log` no dice quién |
| Supervisión y alertas | vigia | Reactivo | `alertas` también se corre a mano (por consola) |
| Supervisión y alertas | **tarea-diaria** | **Programado, condicionado** | Solo se da por confirmado si el log registra una ejecución en las últimas 26 h (`reciente_horas`). Si no, se lee «Programado · sin confirmar» |
| Informes | redactor | Reactivo | Tarea externa de la app de Claude; Cauce solo ve el nombre del archivo |
| Simulaciones | simulador | Módulo | No registra ejecuciones |
| Análisis de riesgo | evaluador-riesgo | Módulo | No registra ejecuciones |
| Auditoría y verificación | auditor | Humano | La decisión la toma una persona |

Se conservan las 6 oficinas. No hay procesos automáticos ni agentes ficticios. Un programado nunca aparece trabajando de forma continua: solo aparece unos segundos cuando llega un registro nuevo y reciente.

## 4. Defectos encontrados

**Corregidos en Cauce**
1. **Un registro viejo se veía como reciente** (gravedad media; solo afectaba a las animaciones). El exportador de Ek Chuah pone en `evidencia.observado_en` la hora en que exporta. Cauce usaba esa hora para decidir si un registro era reciente, así que una corrida atrasada de hace días hacía entrar al personaje. Corrección: la clasificación puede declarar `"hora_del_registro": "actividad"`. Con eso Cauce usa `actividad.fin`, salvo cuando el puesto está trabajando. Solo Ek Chuah lo declara, y **Compago sigue con la regla de siempre**. Lo comprueban una prueba Node y una de Chromium, que fallan con la regla anterior.
2. **«Programado» afirmaba una programación que no está confirmada.** La tarea de Windows no está verificada, y el texto decía «se ejecuta según su programación» aunque no hubiera ninguna corrida. Corrección: `programacion.reciente_horas`. Sin una ejecución dentro del plazo, el texto dice «Programación sin confirmar» y el plano 2D muestra «Programado · sin confirmar».
3. **`tarea-diaria` no estaba clasificada**, así que se mostraba como módulo y dejaba un aviso. Ahora está clasificada.

**Encontrados en Ek Chuah, sin corregir** (Ek Chuah queda fuera del alcance; conviene corregirlo en su PR #2)
- `observado_en` debería ser la hora del registro, como hace Compago, y no la de la exportación. Cauce ya no depende de eso.
- En los ejemplos REAL que genera `generar_ejemplos.py`, la `referencia` de la tarea lleva la hora original del texto. Es solo cosmético.

## 5. Privacidad

[verificado] Revisé los 8 documentos, la clasificación, la escena, el DEMO de Cauce y **todo el texto visible de la página**, incluidos los paneles de cada personaje y de cada oficina. Busqué montos en pesos, enlaces, token, webhook, claves, `journal`, rutas de Windows o de usuario, `.env`, `.db`, correos y números largos, y no encontré nada. Una prueba aparte comprueba que el filtro sí detecta esos patrones. `conectar_ek_chuah.bat` lleva una ruta de ejemplo (`C:\ruta\a\EK_CHUAH`) y no tu carpeta. Cauce no agrega datos: solo muestra lo que viene en el JSON.

## 6. Los DEMO de Cauce no se sobrescriben

[verificado: `pruebas/ek-chuah-sobrescritura.py`, 10/10] La prueba usa la escritura real del exportador sobre una copia de `datos/` y sin ninguna base de datos. Resultados:
- Escribir en `datos/demo/` (o en una carpeta `Demo`) se rechaza.
- Escribir un DEMO encima del REAL se rechaza.
- Escribir encima del archivo de Compago se rechaza.
- El REAL nuevo y su reescritura se escriben bien.
- Los SHA-256 de los DEMO no cambian.

Además, un REAL puesto en `datos/demo/` Cauce no lo muestra (ya ocurría desde la fase 2).

## 7. Compago sigue igual

- No cambió ningún archivo de Compago (`escena/compago*.json`, `datos/demo/compago.json`, `conectar_compago.bat`).
- La regla de hora por omisión es exactamente la de la fase F. Una prueba lo compara en los 10 documentos de Compago, personaje por personaje.
- Todas las pruebas anteriores pasan sin cambios: regresión 47, animaciones 15, estabilidad 15, memoria 4, móvil 16, brillo 3, naturaleza OK, Compago PR #10 9/9 y multiproyecto 6.
- Solo cambió la prueba F de la clasificación provisional de Ek Chuah, que ahora es la definitiva.

## 8. Validar en Windows (guía breve)

1. En Cauce: `git fetch` y `git checkout fase-g/integracion-ek-chuah`. Haz doble clic en `iniciar.bat` y abre <http://127.0.0.1:8765/pruebas.html>. Debe decir **205 pasaron, 0 fallaron**.
2. Sin conectar nada, abre el piso **Ek Chuah**. Debe verse el DEMO con la franja amarilla, 6 oficinas y nadie sentado.
3. Primera conexión, una sola vez. Ek Chuah debe estar en la rama del PR #2 (`git checkout claude/exportador-cauce`). Abre `conectar_ek_chuah.bat` con el Bloc de notas, cambia `EKCHUAH_DIR` por tu carpeta de Ek Chuah y pon `CADA=0`. Haz doble clic. Debe terminar con «Código de salida: 0» (o 1 si falta la base; en ese caso igual escribe el aviso).
4. Vuelve a Cauce y pulsa **Actualizar**. El piso pasa a **REAL**, sin franja. Revisa la tarjeta «Tarea diaria»: si dice «Programado · sin confirmar», el log no tiene una corrida de las últimas 26 h, o la tarea de Windows no está instalada.
5. Haz clic en cada personaje y en cada oficina. No debe aparecer ningún monto, ruta, token ni texto de tu bitácora.
6. Si quieres que se actualice solo, pon `CADA=300` y deja la ventana abierta. Al cerrarla, en unos 15 min el piso pasa a «Datos desactualizados». **No crees una tarea programada todavía.**
7. Compago: repite tu validación de la fase E3 (`docs/VALIDAR-FASE-E3.md`). Debe comportarse igual.

[sin verificar] `conectar_ek_chuah.bat` no se pudo ejecutar aquí (no hay Windows). Está escrito igual que `conectar_compago.bat`.

## 9. Pendientes antes de activar los datos reales

1. Revisar y fusionar el PR #2 de Ek Chuah. Antes conviene pedir ahí que `observado_en` sea la hora del registro (no bloquea).
2. Verificar si la tarea `EkChuah-Alertas` está instalada y corre (`schtasks /Query /TN "EkChuah-Alertas" /V /FO LIST` y la cola de `logs\alertas_diarias.log`). Sin eso, «Programado · sin confirmar» es el resultado correcto.
3. Correr el exportador una vez contra tu base real (paso 3 de la guía) y revisar el JSON a mano antes de dejarlo en ciclo. Las pruebas usan datos sintéticos: **con la base real no está probado**.
4. Decidir quién corre el exportador de forma periódica: la ventana de `conectar_ek_chuah.bat`, una línea al final de `alertas_diarias.ps1` (es un cambio en Ek Chuah) o una tarea nueva. No activé nada.
5. Medir los cps en tu Intel UHD con Ek Chuah REAL. Aquí usé una GPU por software.
6. Fusionar la pila de PRs de Cauce en orden (#1 → … → #14 → este).
