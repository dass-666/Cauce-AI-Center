# Cierre de Cauce AI Center · lista de cierre y criterios verificables (7-nov-2026)

Este documento contrasta lo que los documentos prometen con lo que el código hace, con un criterio de terminación
por función y la evidencia que lo respalda. Cada línea lleva una de tres marcas:

- **HECHO** — está en el código, con prueba automática (Node y/o Chromium real) que lo comprueba en este entorno (Linux, GPU por software).
- **INFERENCIA** — se deduce del código y de las pruebas, pero no se ha observado directamente (p. ej. en la MSI de Diego).
- **SIN VERIFICAR** — no hay evidencia; se dice qué falta para tenerla.

Y un estado de producto: **implementado**, **incompleto** (funciona con límites conocidos) o **futuro** (decidido no hacerlo todavía).

Base de código: rama `claude/project-thread-fwbit2`, encima de PR #25 (`claude/csi-fase-2`, 2ec4d2c). Nada fusionado, nada desplegado.

## 1. Pruebas de la versión de cierre

| Conjunto | Resultado | Cómo repetirlo |
|---|---|---|
| Node (motor, contratos, reglas, informe, casos publicados) | **395 pasaron, 0 fallaron** · HECHO en la MSI (`pruebas.html`, Edge y navegador de la app) sobre el commit entregado; 394 en b52f6c9 + 1 nueva (L6 compartible) | `node pruebas/ejecutar.mjs` o `pruebas.html` en el navegador |
| Chromium real · recorrido de cierre (6 recorridos + celular) | **42 OK, 0 FALLA** · HECHO | `node pruebas/navegador/cierre.cjs` (Playwright, SwiftShader) |
| Chromium real · regresión completa (29 guiones) | **29 verdes, 0 rojos** sobre el commit entregado 65ff2c3 · HECHO; detalle en `docs/CIERRE-PRUEBAS.md` | `node pruebas/navegador/todas.cjs` |
| Intel UHD (cps reales en la MSI) | **61 cps** edificio sin brillo y con brillo ligero (mín. 61, peor cuadro 16.8 ms, GPU 1.9 ms) · HECHO en Edge sin ventana (headless) sobre la Intel UHD; falta la confirmación en ventana visible | `?medir=1` en la MSI, ver §7 |
| Recorridos a mano en la MSI (inicio, caso suizo, investigación de prueba → expediente, borrador tras recargar, Nexus) | todos OK, 0 errores de JavaScript · HECHO (7-nov-2026, navegador de la app sobre la Intel UHD) | §7 |

## 2. Oficina: navegación, proyectos y estados

| Función | Estado | Criterio de terminación | Evidencia |
|---|---|---|---|
| 7 pisos (Compago, Ek Chuah, Tezcatlipoca, Montambre, CSI, CauceService, Repacar) con DEMO / REAL / Sin conexión / Desactualizado | implementado · HECHO | cada piso muestra su naturaleza y nunca inventa actividad | `cierre.cjs` recorrido 1 (c1-oficina.png); `naturaleza.cjs`, `multiproyecto.cjs` |
| Sala de control (S), recepción, navegación R/A/0/F, Retroceso | implementado · HECHO | cada tecla lleva a una vista y vuelve | `fase-k.cjs`, `fase-l.cjs`, c1-sala-control.png |
| Vista 2D/3D, modo inmersivo, celular | implementado · HECHO en Chromium; **INFERENCIA** en Intel UHD (61 cps medidos por Diego en la fase G, nada después) | ≥55 cps en la MSI | `inmersivo.cjs`, `movil-medidas.cjs`; medición pendiente |
| Datos reales Compago vía exportador solo lectura | implementado · INFERENCIA | el piso Compago pasa a REAL con `datos/reales/compago.json` | `compago-pr10.cjs` con fixture; sin piloto Docker corrido en la MSI |
| Datos reales Ek Chuah | incompleto · SIN VERIFICAR | el exportador de Ek Chuah escribe `datos/reales/ek-chuah.json` | configuración lista; exportador no ejecutado con datos reales (fuera de alcance de este cierre) |
| Tezcatlipoca, CauceService, Repacar con datos reales | futuro | requisitos en `docs/TEZCATLIPOCA-REQUISITOS.md`; repos no accesibles | — |
| Control (escribir en los sistemas) | futuro por decisión | `docs/CONTROL-FUTURO.md` | — |

## 3. CSI (laboratorio de investigación)

| Función | Estado | Criterio | Evidencia |
|---|---|---|---|
| Tres conjuntos REAL / HISTÓRICO / DEMO sin mezclar, con banda de color y chip por investigación | implementado · HECHO | REAL con almacén vacío se puede abrir y dice que está vacío; DEMO siempre marcado | `csi.cjs`, `csi-fase2.cjs`, `cierre.cjs` |
| Caso suizo sin Node: el navegador reconstruye `datos/csi/casos-publicados/` cuando `datos/csi/historico/` está vacía | implementado · HECHO (nuevo en el cierre) | 13 fuentes (12 consultadas + 1 pendiente), flujo 9/10, 15 alertas, 0 sin huella, banda «reconstruido en este navegador» | `casos-cierre.js` (prueba del índice), `cierre.cjs` recorrido 2 |
| Crear investigación → fuentes → cotejo → hipótesis → flujo → Abogado → expediente | implementado · HECHO | se obtiene un `expediente-<id>.md` descargable, determinista | `cierre.cjs` recorrido 3 (c3-laboratorio.png), `casos-cierre.js` |
| Expediente en Markdown (`app/csi/informe.js`, `csi-informe 0.1`) también por CLI (`herramientas/csi.mjs informe`) | implementado · HECHO | mismo texto en navegador y Node para la misma investigación | `casos-cierre.js` |
| Guardar en el almacén desde el navegador | incompleto **por diseño** | el navegador no escribe en disco (el servidor es solo GET); descarga `investigaciones.json` para copiarla a mano | nota en pantalla y `docs/ARQUITECTURA.md` |
| Borrador persistente al recargar | implementado · HECHO (nuevo) | tras recargar, la pestaña dice «Nueva investigación ●» y conserva los datos; «Descartar borrador» lo limpia | `cierre.cjs` recorrido 5 (c5-borrador-recuperado.png) |
| Archivo REAL dañado | implementado · HECHO (corregido en el cierre) | se ve bajo la banda REAL con «no es JSON válido»; no cae al DEMO en silencio | `cierre.cjs` recorrido 6 (c6-archivo-danado.png) |
| Sin servidor / 404 de los almacenes | implementado · HECHO | la oficina abre con el DEMO y lo dice | `cierre.cjs` |
| Anclas de predicciones (generar, descargar, verificar, detectar manipulación) | implementado · HECHO | `csi-fase2.cjs` | — |
| Propuesta a Nexus desde una hipótesis | implementado · HECHO | «decisión: pendiente», sin botón de aprobar | `csi-fase2.cjs`, c2-caso-suizo-nexus.png |

## 4. Caso del franco suizo (PR #25, corregido aquí)

- **HECHO**: el expediente tiene 13 registros de fuente: 12 cotejados con huella SHA-256 y 1 PENDIENTE (`f-bns-2011`, el enlace equivocado del comunicado de 2011, sin huella ni cita, conservado para que el historial muestre la corrección).
- **HECHO**: las 12 huellas del expediente y del informe coinciden byte a byte con las copias privadas en `D:\CSI\copias` de la MSI (comprobado el 7-nov-2026 leyendo las copias sin publicarlas). La copia del enlace equivocado existe (71 693 bytes) y **no** está en el expediente, como debe ser.
- **HECHO**: `docs/CSI-CASO-BNS-2015.md` decía «las 12 fuentes… todas tienen huella» sin mencionar el 13.º registro; corregido. `docs/VALIDAR-CSI-FASE-2.md` decía «10 consultadas y 1 PENDIENTE»; corregido a 12 + 1.
- **HECHO**: el informe público no contiene rutas de Windows ni nombres de archivo privados (prueba `casos-cierre.js`).
- Etiquetas «posterior al evento», «declaración», «inferencia», «contrafactual»: **HECHO** en el expediente y en el Markdown generado (secciones 4 y 5).

## 5. Nexus (fase manual autorizada)

- Lecciones, propuestas, integridad, identidades declaradas, candidatas EK fuera del almacén: implementado · HECHO (`nexus.cjs`, Node).
- Aprobación solo por CLI (`herramientas/nexus.mjs`), el navegador solo descarga: implementado **por decisión** (fase manual). Las extensiones (aprobación en pantalla, autenticación, escritura) siguen **futuras** pendientes de las decisiones de `docs/NEXUS-FASE-1-5.md` §9.
- Nuevo en el cierre (HECHO, Node): `n_rango=[min,max]` validado; R08 con `n_comparaciones=null` tratado como «no divulgado» (ver §6 y `contrato/NEXUS-CONTRATOS.md`).

## 6. Tezcatlipoca («v0.2 rev3», parche de corte estricto, L6 compartible)

- **HECHO (7-nov-2026, en la MSI)** — detalle en `docs/TEZCATLIPOCA-REV3.md`: la entrega `Tezcatlipoca-v0.2-rev3-verificada.zip` apareció en la MSI. Sus 19 archivos coinciden con el manifiesto; los 6 resultados que faltaban se reprodujeron en una copia aislada con su procedencia y huellas nuevas (carpeta privada en la MSI). El parche da el `fiscal.py` declarado, con las **12 pruebas directas OK** (contra el código actual: 7 FAIL + 1 ERROR, como se declara) y las **26 existentes OK** antes y después. Los 8 expedientes pasan el validador de Cauce y siguen como **propuestas**, sin importar a Nexus. La zona del PC es UTC−6 (`tzutil /g`).
- **HECHO (lado Cauce)**: la contradicción «L6 compartible» se resolvió en el validador y las reglas de Cauce, que es la parte que sí está en este repositorio: `n_comparaciones: null` significa «no divulgado»; si en `supuestos[]` se declara el rango de divulgación (`{variable:"n_comparaciones_rango", valor:[min,max]}` o texto «entre a y b») con `min > 1`, R08 da **no cumple** con confianza alta sin `ajuste_comparaciones` (el mínimo basta para exigir el ajuste); si el rango admite 1 o no hay rango, **no evaluado**. Así una lección puede ser compartible y tener R08 pendiente, pero no presumir cumplimiento. `n_rango=[min,max]` queda definido contractualmente (enteros ≥ 0, `min ≤ max`, `n` dentro si existe).
- **HECHO (L6 compartible real)**: el validador la acepta. El gerente lee el rango **[3, 8]** de su texto y no lo confunde con el «entre 30 y 39» de `n_independiente`. Con su confianza baja sobre el método, **R08 cumple** y el dictamen es «incompleto», sin ningún «no cumple». Con confianza media daría «no cumple». Una prueba nueva fija esa forma exacta.
- **Decisión de Diego (reservada)**: aplicar o no el parche al bot. No se hizo nada sobre el bot.

## 7. Abrir en la MSI (lo que sí está verificado y lo que no)

- **HECHO**: la MSI tiene Git 2.56 y Python 3.13; el clon `C:\Users\<usuario>\Cauce-AI-Center` apunta a `origin = github.com/dass-666/Cauce-AI-Center` y está en la rama de la fase G. No hay Node (solo el de Electron), así que la validación en la MSI es con `pruebas.html`, no con `probar.bat`.
- **Pasos** (`ABRIR-CIERRE.bat`, en la raíz de la rama): doble clic en el .bat del clon. Hace `git fetch origin claude/project-thread-fwbit2` y `git checkout -B claude/project-thread-fwbit2 origin/claude/project-thread-fwbit2`, y luego arranca `iniciar.bat`. Si el clon tiene cambios locales, se detiene y lo dice; no borra nada.
- **Corregido el 7-nov-2026 (HECHO en la MSI, en un clon de prueba)**: copiado a mano en un clon de otra rama, el .bat se detectaba **a sí mismo** como cambio local (`?? ABRIR-CIERRE.bat`) y no avanzaba. Ahora:
  - se excluye de esa revisión;
  - se ejecuta desde una copia en `%TEMP%`, para que el cambio de rama pueda reemplazarlo;
  - guarda la copia sin seguimiento en `%TEMP%\ABRIR-CIERRE.respaldo.bat` antes de cambiar de rama;
  - llama a `iniciar.bat` con su ruta completa.

  Comprobado: con un cambio real se detiene y lo muestra; sin cambios cambia de rama y el servidor responde 200.
- Luego: `http://127.0.0.1:8765/?csi=historico&medir=1` y `http://127.0.0.1:8765/pruebas.html` (debe decir 395 pasaron).
- **HECHO en la MSI (7-nov-2026)**:
  - `pruebas.html` da 395/395 en el navegador de la app y en Edge.
  - Los cps se midieron en Edge sin ventana (headless) sobre la Intel UHD (`ANGLE Intel UHD Graphics 0x9A68, D3D11`). Edificio: **61 cps** sin brillo y **61** con brillo ligero, a 1367×596 px de lienzo y escala 1.
  - Recorridos a mano: inicio, caso suizo (13 registros = 12 cotejados + 1 pendiente, y las 12 huellas iguales en informe, JSON publicado y expediente .md), investigación de prueba hasta el expediente .md, borrador recuperado tras recargar, y Nexus con la propuesta «decisión: pendiente» y sin botón de aprobar.
- **SIN VERIFICAR**:
  - La medición en una **ventana visible** (la ventana de Edge que abrí se cerró a mano antes de medir y no la volví a abrir).
  - La regresión Chromium completa de 29 guiones: necesita Node y Playwright, que la MSI no tiene. Se cubrió con los recorridos a mano de arriba.

## 8. Decisiones registradas en este cierre (reversibles, tomadas por mí)

1. El caso histórico publicado se reconstruye en el navegador si la carpeta local está vacía; si la carpeta local tiene algo (válido o dañado), manda la carpeta local.
2. El borrador del laboratorio vive en `localStorage` del navegador; es el único estado persistente además de las preferencias. No se añadió escritura al servidor.
3. El registro pendiente del enlace equivocado de 2011 se conserva y se documenta; no se borra para «limpiar».
4. `nexus-R` sigue en 0.2: la rama nueva de R08 no cambia el dictamen de ninguna lección almacenada.

## 9. Decisiones que quedan para Diego

| Decisión | Efecto si no se toma |
|---|---|
| Fusionar la cadena de PR (#14 → … → #25 → cierre) | el producto sigue en ramas; `main` queda vacío |
| Aplicar o no el parche rev3 al Fiscal (verificado, no aplicado; usar `git -c core.autocrlf=false apply`) | sin cambios en el bot |
| Sacar el respaldo `2026-11-06` de la rotación antes del 21-nov (decisión 1 del manifiesto) | la rotación puede borrar la base con la que se calcularon las cifras |
| Importar o no lecciones de Tezcatlipoca a Nexus | siguen como propuestas fuera del almacén |
| Autorizar instalar Node + Playwright en la MSI para la regresión Chromium completa | queda cubierta por los recorridos a mano en la MSI y la corrida completa del contenedor (29/29 sobre 65ff2c3, GPU por software) |
| Confirmar los cps en ventana visible (`?medir=1`, 20 s sin tocar) | el valor de 61 cps queda medido sin ventana |
| Extensiones de Nexus (aprobar en pantalla, autenticación) | siguen futuras, como estaba decidido |
