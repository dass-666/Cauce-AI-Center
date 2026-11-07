# CSI fase 2 · Motor de investigación estratégica y análisis de centros de poder

Fecha: 2026-11-07. Rama `claude/csi-fase-2`, PR #25 en borrador, sobre el PR #24.
Convención del informe: **[HECHO]** = lo comprobé con una prueba o un comando reproducible; **[INFERENCIA]** = conclusión razonable que no medí; **[SIN VERIFICAR]** = no lo pude comprobar.

---

## 1. Estado de los PR #23 y #24

- **[HECHO]** #23 (Nexus) y #24 (CSI fase 1) siguen **abiertos, en borrador y sin fusionar**. GitHub los marca `mergeable_state: clean` (consultado hoy).
- **[HECHO]** No reconstruí nada: la fase 2 se apila sobre #24. Se conservan las 5 estaciones y el piso CSI. Nexus sigue como supervisor independiente: CSI solo le **propone** y no escribe en su almacén.
- **[HECHO]** `cauce.estado-proyecto` 1.0.0 no cambió. `cauce.leccion` 0.2 y 0.3 siguen aceptándose (las pruebas de Nexus pasan sin cambios).
- **[HECHO]** El DEMO de CSI queda en el contrato 0.1 y no cambió: `node herramientas/csi.mjs demo --comprobar` da OK.
- Orden de fusión, si lo apruebas: #23 → #24 → #25. Ninguno se fusiona sin tu aprobación.

## 2. Arquitectura

Todo son módulos ES sin dependencias. Funcionan igual en Node y en el navegador, cuestan $0 y no tienen servicios ni agentes permanentes. La investigación que hice en esta sesión **no** es una dependencia del programa: el programa solo lee archivos JSON.

| Módulo | Qué hace |
|---|---|
| `app/csi/fuentes.js` (nuevo) | Fuentes 0.2: tres fechas por fuente (publicación, consulta y disponibilidad), clase, estado PENDIENTE, extracto con procedencia, duplicados y línea de conocimiento |
| `app/csi/lenguaje.js` (nuevo) | Detecta psicología atribuida, intenciones, «coordinación» y recomendaciones financieras privadas |
| `app/csi/investigacion.js` | Contrato 0.2: `naturaleza_estudio` (demo, histórico o prospectivo), alcance registrado **antes** de las fuentes, citas verificadas y contrafactuales |
| `app/csi/actores.js` | Mapa de poder 0.2: intereses económicos con fuente, decisiones históricas y conflictos de interés (documentado o posible) |
| `app/csi/flujo.js` (nuevo) | Flujo de 10 pasos con explicaciones ordinarias obligatorias |
| `app/csi/abogado.js` (nuevo) | 8 preguntas del Abogado del Diablo, deterministas y hechas por código |
| `app/csi/ancla.js` (nuevo) | Ancla `cauce.csi.ancla` 0.1: exportación, verificación y hora declarada frente a acreditada |
| `app/csi/adaptador-nexus.js` | Propuesta 0.2 con el flujo CSI → Abogado → Nexus → Diego |
| `app/csi/expediente.js` (nuevo) | Construye un caso histórico desde un expediente, pasando por las mismas reglas que una investigación hecha a mano |
| `app/csi/registro.js` | Lee los tres conjuntos (REAL, HISTÓRICO y DEMO) sin mezclarlos |
| `herramientas/csi.mjs` | Órdenes nuevas: `expediente`, `revisar`, `ancla`, `verificar-ancla` y `acreditar` |
| `app/vistas/csi.js` | 13 pestañas, bandas por naturaleza y selector «Ver: REAL · HISTÓRICO · DEMO» |

Compatibilidad: `VERSIONES_CSI = ["0.1","0.2"]`. Un documento 0.1 que use claves de 0.2 da error, para que no se mezclen las reglas.

## 3. Motor de fuentes

Cada fuente registra enlace o referencia, institución, título, `publicada_en`, `consultada_en`, `disponible_en` (con `disponible_segun`), tipo, clase (primaria, secundaria o interpretación), extracto y su tipo, método de consulta, limitaciones y huella (solo si hay copia local).

Reglas que se cumplen por código, cada una con su prueba en `pruebas/casos-csi-fase2.js`:
- **No se confunde la consulta con el conocimiento.** La fecha que cuenta para saber qué se podía conocer es la de disponibilidad o, si no hay, la de publicación. La consulta no puede ser anterior a la publicación, y la disponibilidad no puede ser posterior a la publicación ni a la consulta.
- **Fuente PENDIENTE.** Lleva un motivo obligatorio, no admite cita textual y **no respalda ningún enunciado**.
- **Cita sin procedencia.** Una cita debe aparecer de forma literal en un extracto textual de una fuente consultada. Si no aparece, es error.
- **Duplicados.** Se detectan por enlace normalizado o por huella.
- **Información futura.** Una fuente conocida después del momento de la decisión se marca como tal, y el Abogado lo señala.
- **Hecho apoyado solo en interpretaciones.** Es error.
- **No hay scraping.** El programa nunca descarga nada. Las fuentes se registran a mano o desde un expediente.

## 4. Investigación histórica

Caso real retrospectivo: **fin del tipo mínimo del franco suizo (15-ene-2015)**. Diego autorizó su publicación el 7-nov-2026, después de cotejarlo. El informe con las respuestas, las referencias y las huellas está en `docs/CSI-CASO-BNS-2015.md`, y el expediente en `datos/csi/casos-publicados/expediente-bns-2015.json`. Para verlo en el laboratorio, sigue `datos/csi/historico/LEEME.md`.

**Cotejo (7-nov-2026):** Las fuentes del caso se cotejaron contra copias byte a byte con SHA-256 (acción `cotejar_fuente`, que conserva el extracto anterior). Todas las citas aparecen en el original y 5 recortes mal marcados se corrigieron. La declaración del BNS de 2011, que estaba pendiente, se recuperó con su enlace real; las 12 fuentes tienen huella.

## 5. Mapa de actores

- **[HECHO]** Cada afirmación lleva su clase: HECHO, DECLARACIÓN, INFERENCIA, HIPÓTESIS o ESCENARIO.
- **[HECHO]** En REAL, el lenguaje psicológico o de intención atribuido a una persona da error, salvo que sea una declaración citada de esa persona.
- **[HECHO]** Presentar una «coordinación» como hecho da error. Una relación pública no se convierte en prueba de coordinación: en el mapa solo cuentan como verificables las relaciones con fuente consultada (`data-verificable`).
- **[HECHO]** Un actor documentado solo con fuentes pendientes da error.
- **[HECHO]** Los conflictos de interés distinguen entre `documentado` y `posible`.
- El mapa SVG muestra los actores y marca solo como verificables las relaciones con fuente consultada.

## 6. Abogado del Diablo

8 preguntas deterministas, evaluadas por cada hipótesis:
1. ¿Suponemos intenciones?
2. ¿Hay una explicación más sencilla?
3. ¿Las fuentes son independientes?
4. ¿Usamos información posterior?
5. ¿Seleccionamos solo ejemplos favorables?
6. ¿Supera una referencia simple?
7. ¿Qué la refutaría?
8. ¿Qué observaciones distinguen a las rivales?

- El autor es `{tipo: "codigo", identificador: "abogado-csi"}`, y la pantalla avisa: **«No es una revisión humana independiente ni la sustituye.»** No usé una segunda IA como si fuera un revisor.
- Las alertas pasan a objeciones de la investigación y a la propuesta para Nexus.

## 7. Anclaje

- **[HECHO]** `crearAncla` exporta **solo huellas SHA-256**: número de entrada, tipo y huella, sin textos ni ids salvo que se pida `--con-ids`. No revela predicciones.
- **[HECHO]** El programa **no publica nada**. El ancla nace como `no_publicada`, y las instrucciones dicen que publicar requiere tu autorización.
- **[HECHO]** La verificación posterior detecta:
  - un ancla modificada (no coincide su huella);
  - entradas cambiadas o borradas después de anclarse;
  - una mezcla de DEMO y REAL.
- **[HECHO]** Cada predicción se clasifica como: Hora DECLARADA · Anclada sin acreditar · ACREDITADA antes del horizonte · Acreditada tarde.
- **[HECHO]** El navegador y Node producen la misma huella para el mismo registro DEMO (5ae92069…).
- **[HECHO]** Las predicciones fallidas, indeterminadas y vencidas se conservan. La cadena solo crece.
- **Límite:** la fecha de un commit de git **no acredita** hora, porque la escribe quien hace el commit. El programa registra la acreditación de un tercero (sello RFC 3161, OpenTimestamps, hora de recepción de un servicio o testigo), pero **no verifica criptográficamente** el sello: eso se hace con la herramienta de ese tercero.
- **[HECHO]** No hay ninguna afirmación de superioridad predictiva. Con menos de 10 predicciones decididas, el Abogado lo advierte.

## 8. Nexus

Flujo: investigación → hipótesis → objeción del Abogado → revisión escéptica de Nexus → **decisión de Diego** → seguimiento.

- **Envía:** id, hipótesis, fuentes con procedencia, fuentes pendientes, evidencia, objeciones, limitaciones, estado de validación, condiciones de refutación y datos faltantes.
- **No envía:** evidencia sin fuente consultada, inferencias como evidencia, predicciones como causalidad, estrategias financieras privadas, datos personales ni aprobaciones. La decisión siempre sale como `pendiente`.
- **[HECHO]** Si hay datos privados o una estrategia financiera, el filtro bloquea el envío (`ok:false`).
- **[HECHO]** No hay botón para aprobar. Nunca se escribe en el almacén real de Nexus.

## 9. Capturas

En `/mnt/project-files/cauce/csi-fase-2/capturas/`. Se tomaron en Chromium con GPU por software, no en tu Intel UHD.
- `f2-historico-resumen`, `f2-fuentes`, `f2-mapa-actores`, `f2-flujo`, `f2-abogado`, `f2-nexus` (caso histórico real)
- `f2-predicciones-ancla`, `f2-laboratorio` (DEMO)
- `f2-celular-fuentes`, `f2-celular-abogado` (390 px)

## 10. Pruebas

- **[HECHO]** Node: **386 pasaron, 0 fallaron** (`node pruebas/ejecutar.mjs`), 27 de ellas nuevas de la fase 2 (2 del cotejo de fuentes). Cubren:
  - fuentes inexistentes, fechas incorrectas, información futura, citas sin procedencia y duplicados;
  - hipótesis contradictorias, inferencias presentadas como hechos y lenguaje psicológico;
  - anclas modificadas, predicciones posteriores al resultado y acreditación tardía;
  - referencia simple, filtro de Nexus y DEMO frente a REAL.
- **[HECHO]** Pruebas de mutación: al desactivar la regla de duplicados o la del ancla tardía, las pruebas fallan. Al restaurar el código, vuelven a 384/384; la regla del cotejo que conserva el extracto anterior se probó igual (386/386).
- **[HECHO]** Chromium `csi-fase2.cjs`: **42/42**, sin errores de consola. Cubre escritorio y celular, 2D y 3D, anclas en el navegador y archivos de ancla manipulados.
- **[HECHO]** Regresión completa de Chromium (`pruebas/navegador/todas.cjs`): **28/28 guiones en verde**, 0 fallas (incluye csi.cjs 39/39, nexus.cjs 45/45 y regresion.cjs 47/47; algunos guiones solo toman capturas y cuentan 0 comprobaciones).
- **[SIN VERIFICAR]** Rendimiento en tu Intel UHD: no lo medí. Ningún número de cps de este informe viene de tu equipo.

## 11. Rama, commits y PR

- Rama `claude/csi-fase-2`, encadenada sobre `claude/project-thread-bg64t5` (PR #24).
- Commits: `3cd8204` (motor de la fase 2) y el commit de documentación de este informe.
- PR #25 en borrador: https://github.com/dass-666/Cauce-AI-Center/pull/25.
- El caso histórico se publicó con autorización de Diego (7-nov-2026) en `docs/CSI-CASO-BNS-2015.md` y `datos/csi/casos-publicados/`. `datos/csi/historico/*` sigue en `.gitignore`: es la carpeta de trabajo local donde se construye.

## 12. Qué probar en Windows

Ver `docs/VALIDAR-CSI-FASE-2.md` (unos 15 minutos). Se resume en:
- recorrer las pestañas del caso histórico;
- generar, descargar y alterar un ancla en DEMO;
- medir los cps del piso CSI y de Compago con `?medir=1`;
- abrir `pruebas.html`, que debe decir 386/0.

## 13. Limitaciones y siguiente fase

**Límites honestos:**
- **No hay huella de contenido de las fuentes.** La herramienta web de la sesión resume las páginas, así que no guardé copias verificables. Las citas y cifras se obtuvieron con esa herramienta y **hay que cotejarlas con los originales** antes de usarlas fuera del laboratorio.
- **Sesgo retrospectivo.** Quien investigó (una IA) ya conocía el desenlace. El alcance registrado antes mitiga esto, pero no lo elimina.
- Algunas fuentes del caso son copias secundarias, porque el original no fue accesible. Una sigue PENDIENTE.
- El programa **no verifica sellos de terceros** y no conoce la hora real.
- Intel UHD sin medir, ni de la fase 2 ni de fases anteriores desde la G.

**Decisiones tuyas:**
1. ¿Autorizas subir el caso histórico al repositorio público? Mi recomendación es **no todavía**: primero cotejar las citas con los originales.
2. ¿Cómo quieres publicar anclas reales, si llegas a hacerlo? La opción gratuita más fuerte es un sello RFC 3161 de una autoridad gratuita.
3. ¿El piso CSI se queda como laboratorio de método o pasa a trabajo real con predicciones prospectivas?

**Siguiente fase propuesta, solo si la apruebas:**
- Cotejar las fuentes y guardar copias locales con huella.
- Verificar sellos RFC 3161 sin conexión con `openssl` a partir de un `.tsr` que tú obtengas.
- Un segundo caso histórico para comprobar que el método no está hecho a la medida del primero.

**Mi recomendación:** no abrir predicciones prospectivas reales hasta tener las tres cosas anteriores. Sin ellas, el registro solo probaría el orden de las predicciones, no la hora.
