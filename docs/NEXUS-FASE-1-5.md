# Cauce Nexus · fase 1.5: registro real y seguridad

**Fecha:** 2026-11-06.
**Rama:** `claude/project-thread-2fxi1j` (PR #23, borrador, **sin fusionar ni desplegar**).
**Referencia:** `docs/CAUCE_NEXUS_ARQUITECTURA_MAESTRA_v0.2.md`, aprobada por Diego como referencia de diseño.

Este documento es el informe consolidado de la fase. Cada afirmación lleva cómo se comprobó. Lo que no se comprobó, se dice.

---

## 1. Cambios implementados

| Bloque | Qué se hizo | Dónde |
|---|---|---|
| A · Continuidad | Se trabajó sobre la fase 1, sin arquitectura paralela. Siguen intactos `cauce.estado-proyecto` 1.0.0, la oficina 2D/3D y «Un cuarto». | toda la rama |
| B · Lecciones reales | EK-L001, EK-L003 y EK-L007 como **candidatas** fuera del almacén, más el manifiesto de evidencias pendientes para el Claude de Ek Chuah. | `datos/nexus/candidatas/` |
| B · Importación | Importación manual con vista previa, validación, dictamen, admisión al almacén real y rechazo explicado. Funciona en la línea de comandos y en la oficina. | `herramientas/nexus.mjs importar`, `admisionReal()` en `app/nexus/registro.js` |
| C · Historial | Manifiesto externo con sellos encadenados y un ancla para guardar fuera. Detecta truncamiento y reescritura. Respaldos verificables y restauración que nunca sobrescribe. | `app/nexus/integridad.js`, CLI `sellar`, `ancla`, `verificar-ancla`, `respaldar`, `verificar-respaldo`, `restaurar` |
| D · Aprobación | Política de aprobadores declarados (`diego`). Una decisión exige motivo y debe registrarla la misma persona. La identidad se marca «declarada». Registrar una ejecución exige una persona y una referencia externa. No hay botón Aprobar. | `app/nexus/identidad.js`, `datos/nexus/politica.json`, `validarPaso()` |
| E · Gerente | Se corrigieron 6 brechas reales (§1.1). Las reglas que no aplican se listan aparte. | `app/nexus/gerente.js`, `recomendacion.js`, `registro.js` |
| F · Oficina | Distinción DEMO/REAL, estado de integridad con ancla, cifras que filtran, filtros por proyecto, estado y confianza, detalle de evidencia, «Qué falta», candidatas aparte, e importación con archivo y vista previa. Sin animaciones nuevas. | `app/vistas/nexus.js`, `app/estilos.css`, `app/app.js` |

### 1.1 Brechas del gerente escéptico (bloque E)

Cada brecha tiene una prueba de regresión. Se comprobó que **las 6 pruebas marcadas «brecha» fallan con el código de la fase 1** y pasan con el de la 1.5. El método fue un worktree de la fase 1 con solo las pruebas nuevas copiadas.

| # | Brecha encontrada | Gravedad | Corrección |
|---|---|---|---|
| 1 | Una revisión humana ajena que **objetaba** («rechazada», «objeciones») contaba como revisión independiente en R01. | Alta: una objeción podía dejar la lección en 10/10. | Las decisiones contrarias no cuentan. Si la última revisión ajena objeta, R01 = no_cumple. |
| 2 | Si la evidencia cambiaba **después** de la revisión ajena, la revisión vieja seguía contando. | Alta: se podía cambiar la evidencia sin volver a revisar. | El registro calcula desde qué revisión cuenta cada lección (cambio de hallazgo, origen, evidencia, procedencia, muestra, confianza, antecedentes, fecha o tipo). Antes de esa revisión, R01 = no_evaluado. |
| 3 | Una **recomendación** podía citarse como evidencia o validación de la misma lección de la que nació. | Media: circularidad A → rec → A. | R03 = no_cumple si la recomendación cita esa lección, directa o indirectamente. Una recomendación nunca es fuente primaria (R02). Si es desconocida, queda no_evaluado. |
| 4 | Una lección **refutada** podía terminar sin objeciones y respaldar una recomendación. | Media. | R05 = no_cumple con «refutada». |
| 5 | Confianza **media** en un efecto sin `n_efectivo` pasaba R08: con muestras dependientes, el conteo bruto inflaba la confianza. | Media. | R08 = no_evaluado. |
| 6 | Se podía registrar «ejecutada» o «adoptada» con un evento de IA o código, o sin referencia externa. | Media: «aprobada» podía parecer «ejecutada». | Solo una persona registra la ejecución o la adopción, y la ejecución exige resultados con referencia. Nexus sigue sin ejecutar nada. |

Además, las reglas que **no aplican** (R06 y R10 en una lección sin validaciones) seguían contando como «cumple» sin distinguirse. Ahora el dictamen las lista en `no_aplica`, cada una con su motivo, y la oficina las muestra como «No aplica (justificado)». El §5 pide que un control no aplicable no se convierta en silencio en «cumple».

**Comprobado sin cambios** (pruebas de verificación, no de brecha):
- 9/10 con un `no_evaluado` da «incompleto».
- Una recomendación así no es aprobable.
- El paso a «aprobada» se rechaza con «Lo no evaluado nunca se aprueba».
- Una IA que se revisa a sí misma, o una IA ajena, no cuenta como revisión humana.
- Las lecciones caducadas dan R05 = no_cumple (T11, ya existía).

**Efecto visible en los datos de prueba:** la lección DEMO «Varias marcas de tiempo no traen zona horaria» se corrigió después de su revisión ajena. Por la brecha 2, ahora muestra además R01 «No evaluado: la evidencia cambió después de la última revisión humana independiente». Sigue en «Incompleto».

---

## 2. Estado de EK-L001, EK-L003 y EK-L007

**Las tres son candidatas y NO están en el almacén real.** El almacén real (`datos/nexus/registro/`) sigue vacío.

| Lección | Hallazgo (resumen) | Dictamen | Por qué no entra |
|---|---|---|---|
| EK-L001 | `known_at` separado del instante observado; el catálogo dice que cerca del 82 % es estimado. | Con objeciones | R02 no cumple. R01, R03, R04 y R05 sin evaluar. Procedencia no verificable. |
| EK-L003 | «No evaluado» no es «aprobado». | Con objeciones | Lo mismo. |
| EK-L007 | «succeeded» no es «entregable verificado». | Con objeciones | Lo mismo. |

**Hechos:**
- La única fuente disponible es una línea del §9 del documento maestro v0.2, que resume una revisión de Ek Chuah que Cauce no tiene.
- No se leyó código, commits, pruebas ni corridas de Ek Chuah: el repositorio no está en el alcance de esta sesión y no se pidió acceso.
- Por eso las tres declaran `origen.tipo = texto_ia`, evidencia `inventario_ia` (con commit y SHA-256 del documento de Cauce), confianza `baja` sobre `metodo`, estado `propuesta` y `naturaleza_resultado = sin_resultado`.
- Los campos desconocidos dicen `PENDIENTE` o `null`.

**Separación técnica / financiera:**
- Son lecciones de método.
- No traen datos financieros, de rendimiento, de límites ni de estrategia. Una prueba lo verifica con `buscarEstrategia`.
- El manifiesto pide solo evidencia técnica y rechaza de antemano lo financiero.

**Prueba existente ≠ corrida reproducida:** el manifiesto separa las dos cosas explícitamente. Nada se declara reproducido ni validado en destino.

**Inferencia que hay que confirmar:** `muestra.naturaleza = sintetica` es un valor obligado por el contrato, que no admite «desconocida». Se eligió por ser el más restrictivo y está declarado en `limitaciones`. Se propone agregar «desconocida» en v0.3.

**Siguiente paso (no depende de Cauce):** entregar `datos/nexus/candidatas/ek-chuah/EVIDENCIAS-PENDIENTES.md` al Claude de Ek Chuah.

---

## 3. Seguridad del historial y sus límites

### Qué se agregó

- **Manifiesto** (`manifiesto.json`, aparte de los registros y movible a otro disco con `--manifiesto=`). Cada sello guarda cuántas entradas tenía cada registro y la huella de la última. Los sellos se encadenan entre sí.
- **Continuidad.** Al leer, el almacén se compara con el último sello y da uno de estos estados:
  - `integro`;
  - `sin_sellar`: entradas nuevas sin sello todavía; es un aviso;
  - `truncado`: faltan entradas del final;
  - `reescrito`: cambió una entrada sellada;
  - `manifiesto_alterado`;
  - `registro_alterado`: la cadena está rota.

  Con un almacén truncado o reescrito, la línea de comandos **se niega a escribir o sellar**.
- **Ancla.** Tiene la forma `3:9f2c…` (número de sellos y 16 caracteres de huella). Se anota **fuera del equipo**. `verificar-ancla` detecta que le quitaron sellos al manifiesto, aunque registro y manifiesto se hayan recortado juntos.
- **Respaldos** en `datos/nexus/respaldos/<fecha>/`. Cada uno guarda las copias exactas y un índice con el SHA-256 de cada archivo. Se hacen automáticamente antes de cada escritura y nunca se sobrescriben.
- **Restauración segura.** `restaurar` verifica el respaldo (huellas, cadenas y manifiesto) y lo compara con el almacén actual: iguales, actual más nuevo, actual truncado o divergen. Copia a `datos/nexus/restauraciones/<fecha>/`. **No toca el almacén:** mover los archivos lo decide la persona.

### Modelo de amenazas (honesto)

| Amenaza | ¿Se detecta? |
|---|---|
| Error humano: borrar o editar una entrada, guardar a medias, copiar una versión vieja | Sí: cadena y manifiesto. |
| Quitar las últimas entradas del registro | Sí: manifiesto, estado `truncado`. |
| Quitar entradas **y** los sellos correspondientes del manifiesto | Solo comparando con el **ancla guardada fuera**. |
| Respaldo alterado | Sí: huella por archivo. |
| Alguien que puede editar **todos** los archivos (registro, manifiesto y respaldos), recalcular las huellas **y** cambiar el ancla que tú guardaste | **No.** Una huella local editable no es una firma. |

**Límite:** esto protege contra accidentes y descuidos, no contra un atacante con control total del equipo. La defensa real necesita dos cosas: anclas fuera del equipo y, en el futuro, firmas con identidad autenticada (CauceService).

---

## 4. Importación manual

**Con Node:**
1. `node herramientas/nexus.mjs importar <archivo> --por=diego` hace una **vista previa** y no escribe nada. Muestra:
   - el contrato;
   - las 10 reglas con su motivo;
   - si la lección entra al almacén real;
   - por qué no entra, cuando es el caso.
2. Con `--confirmar` escribe la lección. Antes hace respaldo, después sella y muestra el ancla nueva.

**Sin Node** (el MSI de Diego no lo tiene):
1. En la oficina, «Importar una lección (vista previa)»: pegar o elegir el archivo y escribir el alias.
2. La oficina muestra lo mismo que la vista previa de Node.
3. Si la lección se admite, ofrece dos descargas: `lecciones.json` y `manifiesto.json` sellado, junto con el ancla.

**Admisión al almacén real** (solo la primera versión de cada lección). Exige:
- que cumpla el contrato;
- R01 cumple, es decir, revisión humana de alguien distinto del autor;
- R02 cumple, es decir, evidencia primaria con referencia;
- R07 cumple: sin datos privados ni estrategia;
- commit o SHA-256 en una evidencia primaria;
- que no sea un id `demo-…`;
- que la registre una persona.

Las versiones siguientes solo necesitan contrato y reglas de paso. Así también queda registrada una revisión que **objeta**.

**Registrar no es validar:** una lección admitida conserva sus objeciones, y el gerente las sigue mostrando.

**No hay conexiones automáticas:** nada lee repositorios ni exportadores.

---

## 5. Aprobación humana (diseño, sin autenticación)

- `datos/nexus/politica.json` contiene `aprobadores_declarados: ["diego"]` y `autenticacion: "ninguna"`.
- En el almacén real, aprobar, rechazar o aplazar una recomendación es una **versión nueva** con todo esto:
  - el responsable está en la política;
  - el responsable es quien la registra (`--por`);
  - fecha con zona horaria;
  - un `motivo` escrito en el último evento.
- Para aprobar, además (desde la fase 1): 10/10 «cumple» en la revisión vigente de las lecciones citadas, que no sea quien propuso, y que venga de «pendiente_aprobacion».
- Toda identidad es **declarada**. La oficina y la línea de comandos lo dicen: «identidad declarada, sin autenticar». Un registro que diga `autenticacion: "autenticada"` se rechaza.
- **No hay botón Aprobar.** Uno así permitiría a cualquiera con el navegador «firmar» como diego.
- Aprobar **no ejecuta**: Nexus nunca ejecuta. Una ejecución hecha fuera se registra aparte, solo por una persona y con referencia a su evidencia. Con dinero o apuestas, el bloqueo es absoluto.

**Integración futura con CauceService (preparada, no implementada):**
- `identidad.js` define `SIN_AUTENTICACION` con la forma `verificar(sobre) → {autenticada, sujeto?, proveedor?, motivo}`.
- Un verificador de CauceService con esa misma forma permitiría admitir `autenticacion: "autenticada"` y firmar los sellos.
- No se crearon usuarios, contraseñas ni tokens, y no se supuso cómo autentica CauceService: su repositorio no está accesible.

---

## 6. Cambios visibles en la oficina

| Elemento | Cómo se ve |
|---|---|
| Datos DEMO | Franja amarilla «DEMO · DATOS DE PRUEBA». |
| Datos REAL | Franja verde «REAL · Almacén local… Identidades declaradas, sin autenticar». |
| Integridad (solo REAL) | Línea con el estado y el ancla. TRUNCADO y REESCRITO aparecen en rojo. |
| Cifras | Lecciones registradas, sin objeciones, incompletas, con objeciones, sin revisión humana independiente, candidatas, recomendaciones que esperan decisión. Las tres de estado son **botones que filtran**. |
| Filtros | Proyecto, estado y confianza, más «Quitar filtros». Si nada coincide, la oficina lo dice. |
| Tarjeta de lección | «Qué falta o qué se objeta» y el resumen de reglas («6 cumplen · 2 no aplican · 2 sin evaluar»). Detalle de evidencia: tipo, referencia, ubicación, commit, huella, observado, conocido, quién ejecutó, y si la reproducción es solo declarada. Además, limitaciones y revisiones. |
| Candidatas | Sección aparte con borde punteado, «Candidata · no registrada» y «Por qué no entra al almacén real». |
| Recomendaciones | Aprobador con «(identidad declarada, sin autenticar)», el motivo y el aviso «Aprobada no significa ejecutada». |
| Importar | Elegir archivo, vista previa, admisión SÍ/NO con motivos, y dos descargas con el ancla. |

No hay modelos 3D nuevos, animaciones ni servicios externos. Con Nexus abierto la 3D sigue en pausa (verificado: 124 → 124 cuadros).

---

## 7. Pruebas ejecutadas (en este entorno, Linux sin GPU)

| Prueba | Resultado |
|---|---|
| Node `node pruebas/ejecutar.mjs` | **331 pasaron, 0 fallaron** (antes 308). Son 23 nuevas en `pruebas/casos-nexus-15.js`: 6 de brecha y el resto de verificación. |
| Brechas con el código de la fase 1 | Las 6 pruebas «brecha» **fallan** con la fase 1, y también la de «no aplica», porque `no_aplica` no existía. La de 9/10 **pasa** también con la fase 1: ese comportamiento ya era correcto. |
| Línea de comandos `node pruebas/nexus-cli.mjs` | **17 OK, 0 FALLA**: vista previa, confirmar (respaldo y sello), truncar, detectar, negarse a sellar o escribir, ancla, respaldo, restaurar sin tocar el almacén, respaldo alterado y las candidatas, que no entran. |
| Chromium `pruebas/navegador/nexus.cjs` | **45 OK, 0 FALLA**, «errores: ninguno». Cubre escritorio 3D, plano 2D, Pixel 7 vertical y horizontal, DEMO/REAL, filtros, candidatas, importación (rechazo y admisión con descargas), integridad íntegra y truncada, «Un cuarto», la sala de control y pruebas.html (0 fallas en el navegador). |
| Regresión completa `pruebas/navegador/todas.cjs` | Ver §7.1. |
| Intel UHD | **No medido.** SwiftShader comprueba el comportamiento, no el rendimiento. |

### 7.1 Regresión completa 2D/3D

RESULTADO_REGRESION

---

## 8. Lo que Diego debe probar en Windows (MSI)

1. Abrir con `iniciar.bat` (o `py servir.py`) en `http://127.0.0.1:8765/` y pulsar **N**. Debe verse:
   - la franja DEMO;
   - las cifras (6 lecciones; 1, 1 y 4 por estado);
   - 3 candidatas Ek Chuah.
2. Pulsar la cifra «con objeciones»: deben quedar 4 tarjetas. Probar el filtro Proyecto = tezcatlipoca y luego «Quitar filtros».
3. Abrir «Importar una lección», elegir `contrato/ejemplos/nexus/leccion-plantilla.json` y escribir «diego». Debe decir «Admisión al almacén real: NO» por R01.
4. Con Nexus abierto, mirar que el edificio no consume (ventilador o administrador de tareas). Después cerrar con **N** y volver a «Un cuarto».
5. Abrir `pruebas.html`: debe decir 0 fallaron.
6. *(Opcional, y solo si instalas Node)* correr `node pruebas/nexus-cli.mjs`: debe decir 17 OK.
7. **Rendimiento:** medir los cuadros por segundo en la Intel UHD con la oficina normal, con «Un cuarto» y con Nexus abierto. No se mide desde la fase G.

---

## 9. Decisiones pendientes para continuar

1. **Evidencia de Ek Chuah.** ¿Le paso `EVIDENCIAS-PENDIENTES.md` al Claude de Ek Chuah (solo lectura) o prefieres revisarlo antes? Sin esa evidencia, las tres siguen como candidatas.
2. **Revisor independiente.** Para que una lección entre al almacén real hace falta la revisión humana de alguien **distinto del autor**. Si tú (diego) eres el aprobador, ¿quién revisa? Puedes ser tú, siempre que no seas el autor. La IA no cuenta.
3. **¿Versionar el almacén real en git?** Hoy es local y git lo ignora, por privacidad. Con git ganaríamos un historial externo y otra ancla, pero tendríamos que asegurar que nunca suba datos sensibles. Recomiendo seguir local y guardar el ancla fuera.
4. **Contrato v0.3.** Agregar `desconocida` en `muestra.naturaleza`. Con eso las candidatas dejarían de llevar un valor provisional.
5. **Autenticación.** Cuando CauceService tenga autenticación, decidir si Nexus firma los sellos con ella. Hoy no hay repositorio accesible para diseñarlo.
6. **Medición en Intel UHD** (sigue pendiente desde la fase G).
