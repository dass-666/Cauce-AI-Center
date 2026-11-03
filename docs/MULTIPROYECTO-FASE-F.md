# Fase F: arquitectura multiproyecto y preparación de Ek Chuah

Rama `fase-f/multiproyecto`  , encima de `fase-e3/eventos-recientes` (PR #13). No hay nada fusionado ni desplegado. Ek Chuah y Compago solo se leyeron; no se modificaron.

Uso tres etiquetas: **[medido]** (lo medí aquí), **[código]** (es un límite que fija el código) y **[estimado]** (es una inferencia sin medición).

## 1. Estado actual de escalabilidad
- **[código]** Cauce carga **un solo proyecto a la vez**. Al cambiar de proyecto destruye la escena y construye la nueva. Los modelos Kenney se cargan una sola vez y se comparten. Por eso el costo de la GPU depende del proyecto que se ve y no de cuántos proyectos hay registrados.
- **[código]** El número de proyectos del registro (`datos/proyectos.json`) no tiene un límite fijo. Cada proyecto admite hasta 50 departamentos y hasta 30 agentes por departamento (`contrato.js`).
- **[medido]** Con 23 proyectos registrados (3 reales y 20 sintéticos DEMO), todo funciona. El único problema que encontré fue el selector de proyectos en el celular.

## 2. Límites comprobados (Chromium con SwiftShader, es decir, GPU por software y no tu Intel UHD)
| Proyecto | Llamadas de dibujo | Triángulos | Geometrías | Texturas | Personajes |
|---|---|---|---|---|---|
| Compago | 156 | 6 243 | 156 | 18 | 4 |
| Ek Chuah (DEMO) | 121 | 3 876 | 125 | 14 | 3 |
| 8 deptos × 1 | 176 | 10 386 | 168 | 42 | 8 |
| 20 deptos × 3 | 584 | 61 345 | 366 | 145 | 60 |
| 50 deptos × 3 (máximo práctico) | 1 424 | 151 991 | 846 | 325 | 150 |

Las llamadas de dibujo crecen de forma casi lineal: unas 18 por departamento y unas 3 por personaje. Los cps de SwiftShader (entre 5 y 22) **no sirven** para predecir tu equipo.
- **[medido]** En 30 cambios entre proyectos, las geometrías (178→178), las texturas (33→33) y los nodos de la página (169→169) volvieron siempre al mismo número. La memoria JS pasó de 21 a 23 MB, que es ruido del recolector y no una fuga creciente. La memoria de la GPU no se puede leer desde el navegador.
- **[medido]** El plano 2D con 50 departamentos × 3 personajes se dibuja completo.
- **[estimado]** En tu Intel UHD, Compago ya dio 60 cps (validado en las fases #3 y #4). Un proyecto de unos 20 departamentos probablemente se mantenga cerca de esa cifra. Con 50 departamentos × 3 es probable que baje de 60 y entonces haría falta el modo «Bajo consumo». **No lo he medido.**

## 3. Acoplamientos encontrados
1. **Selector de proyectos en celular** (comprobado y corregido): con 23 proyectos ocupaba 266 px de 664 px de alto.
2. **El DEMO de Ek Chuah mostraba 6 personajes sin evidencia** (comprobado y corregido): como no tenía clasificación, usaba el comportamiento anterior.
3. **`identidad.js` (TEMAS)**: los colores e iconos por tema usan palabras de Compago, como importacion, margenes o auditoria. Para otros proyectos cae a temas genéricos, así que funciona. Lo dejo así porque no es un problema comprobado.
4. **Personajes ocultos**: cada puesto reactivo crea su figura aunque no se vea (son 3 en Compago y 3 en Ek Chuah). El costo es bajo y no lo optimizo sin una medición en tu equipo.
5. El latido de Compago depende de la palabra «activo» (ya documentado en E3).

## 4. Arquitectura recomendada (ya existe en su mayor parte; no hace falta reescribir)
| Capa | Dónde vive |
|---|---|
| Motor de estado | `app/nucleo/` (contrato, modelo, estados, cambios, naturaleza, registro) |
| Motor visual | `app/vistas/vista3d/` y `vista2d.js` |
| Configuración por proyecto | `datos/proyectos.json` y `escena/<id>.json` (distribución) y `escena/<id>-naturaleza.json` |
| Adaptadores de datos | Fuera de Cauce: cada proyecto exporta el contrato v1 (por ejemplo, `exportar_cauce` de Compago) |
| Interfaz general | `app/app.js`, `panel.js`, `estilos.css` |

Para sumar un proyecto bastan un exportador de solo lectura en ese proyecto, una entrada en el registro y dos JSON de escena. No propongo plugins ni más capas, porque hoy no hay un problema que lo justifique.

## 5. Cambios implementados
- `app/estilos.css` y `app/app.js`: en el celular, el selector es una sola fila deslizable y la pestaña elegida queda a la vista. Pasó de 266 px a **28 px**, sin desplazamiento horizontal de la página.
- `escena/ek-chuah-naturaleza.json`: es una clasificación **provisional** y no tiene ningún puesto automático ni programado. El DEMO de Ek Chuah pasó de 6 personajes a **0 visibles al cargar** y bajó de 28 a 14 texturas.
- `pruebas/navegador/multiproyecto.cjs` (prueba nueva) y 2 pruebas Node nuevas.

## 6. Pruebas y mediciones
- Node 166/166 y `pruebas.html` en Chromium 166/166.
- Chromium: regresión 47, animaciones 15, estabilidad 15 (DEMO/REAL, caducidad y reconexión), memoria 4, móvil 16, brillo 3, naturaleza OK, extremo a extremo con Compago PR #10 9/9 y multiproyecto 6 (con mediciones aparte). Ninguna falla.
- **Límites:** usé una GPU por software, así que no medí cps reales ni memoria de la GPU. Tampoco probé un celular físico (usé emulación de iPhone 12).

## 7. Prototipo multiproyecto
El prototipo es la propia app con 20 proyectos **sintéticos** etiquetados como «Sintético NN» y en DEMO. Solo existen dentro de la prueba `multiproyecto.cjs` y no se publican en `datos/`. Se puede cambiar entre Compago, Ek Chuah DEMO y los sintéticos sin que se mezclen sus departamentos (lo verifica la prueba de aislamiento). Ek Chuah **sigue siendo DEMO**: no hay integración real y no construí una oficina bursátil definitiva. Captura: `movil-23-proyectos.png`.

## 8. Inventario de Ek Chuah (solo lectura, main `05eca04`)
Ek Chuah se describe como «investigación y simulación: no ejecuta operaciones reales». No tiene agentes de IA autónomos dentro del código. Las alertas usan reglas fijas.
| Proceso | Tipo | Evidencia persistida | Propuesta en Cauce |
|---|---|---|---|
| `fetch-macro` (descarga Banxico/INEGI) | manual y en la tarea de Windows EkChuah-Alertas (9:00) | `fetch_log` (status, inicio, fin) | Reactivo; pasa a programado si se confirma la tarea |
| `alertas --discord` | igual que el anterior | `alerts_sent` (nivel, título, hora) | Reactivo; las alertas van al panel |
| Análisis semanal (tarea de la app de Claude, domingo 8 pm) | IA externa programada | `data/analisis/` fuera de git | Reactivo sin evidencia hasta que se exporte |
| Revisión mensual (día 15) | humana | bitácora | Humano |
| `portfolio-sim`, `practice-report` (dinero imaginario) | módulos | ninguna | Módulo |
| `risk-menu`, `plan`, `calificacion`, `historia`, `company` | módulos | ninguna | Módulo |

**Nunca se debe exportar:** `journal_accounts` y `journal_entries` (dinero real del usuario), `config/personas*.toml`, el cuestionario familiar ni los webhooks de `.env`. No los leí.

## 9. Información que todavía falta
1. Saber si la tarea de Windows EkChuah-Alertas sigue instalada, con evidencia como el log `logs/alertas_diarias.log`.
2. Un `exportar_cauce` de **solo lectura** en Ek Chuah, que haría Claude de Ek Chuah. Leería solo `fetch_log`, `alerts_sent` y el log de la tarea. No leería el diario ni datos personales.
3. Tu decisión sobre las oficinas de Ek Chuah: ¿se quedan las 6 del DEMO actual (datos, supervisión, informes, simulaciones, riesgo, auditoría) o se reducen a las que tengan evidencia?
4. Una medición en tu Intel UHD con el proyecto sintético de 20 o 50 departamentos.

## 10. Plan incremental
1. Validar este PR en Windows: el selector en el celular y el DEMO de Ek Chuah sin personajes.
2. Claude de Ek Chuah hace el exportador de solo lectura y lo valida con el contrato v1 (este paso necesita tu aprobación).
3. Cauce prueba el exportador de extremo a extremo, igual que en E3 con Compago, y ajusta `ek-chuah-naturaleza.json` según la evidencia.
4. Solo si tu equipo baja de 55 cps con proyectos grandes: optimizar los personajes ocultos o activar «Bajo consumo» automático.
5. Después, Tezcatlipoca (todavía no hay un repositorio identificado).
