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
| Node (motor, contratos, reglas, informe, casos publicados) | **394 pasaron, 0 fallaron** · HECHO | `node pruebas/ejecutar.mjs` o `pruebas.html` en el navegador |
| Chromium real · recorrido de cierre (6 recorridos + celular) | **42 OK, 0 FALLA** · HECHO | `node pruebas/navegador/cierre.cjs` (Playwright, SwiftShader) |
| Chromium real · regresión completa (29 guiones) | ver `docs/CIERRE-PRUEBAS.md` | `node pruebas/navegador/todas.cjs` |
| Intel UHD (cps reales en la MSI) | **SIN VERIFICAR** desde la fase G; SwiftShader no cuenta | `?medir=1` en la MSI, ver §7 |

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

- **SIN VERIFICAR · bloqueo**: los materiales citados en el encargo (entrega «v0.2 rev3», `parche_corte_estricto_rev3.patch`, los 12 + 26 resultados de prueba, el manifiesto con los 6 resultados faltantes y los 8 expedientes) **no están** en ningún lugar accesible: ni en `/mnt/project-files/tezcatlipoca/` (solo el Fiscal del 5-nov: bundle + docs), ni en el chat del proyecto, ni en el hilo de Tezcatlipoca, ni en las carpetas de la MSI a las que tengo acceso (`C:\Users\MSIGF\Cauce-AI-Center`, `D:\CSI`). El repositorio de Tezcatlipoca no está conectado. No se puede verificar SHA-256 ni pruebas de algo que no se tiene. **Decisión de Diego**: adjuntar esos archivos al hilo (o indicar la carpeta exacta) para hacer la verificación; no se inventa un resultado.
- **HECHO (lado Cauce)**: la contradicción «L6 compartible» se resolvió en el validador y las reglas de Cauce, que es la parte que sí está en este repositorio: `n_comparaciones: null` significa «no divulgado»; si en `supuestos[]` se declara el rango de divulgación (`{variable:"n_comparaciones_rango", valor:[min,max]}` o texto «entre a y b») con `min > 1`, R08 da **no cumple** con confianza alta sin `ajuste_comparaciones` (el mínimo basta para exigir el ajuste); si el rango admite 1 o no hay rango, **no evaluado**. Así una lección puede ser compartible y tener R08 pendiente, pero no presumir cumplimiento. `n_rango=[min,max]` queda definido contractualmente (enteros ≥ 0, `min ≤ max`, `n` dentro si existe).
- **Decisión de Diego (reservada)**: aplicar o no el parche al bot. No se hizo nada sobre el bot.

## 7. Abrir en la MSI (lo que sí está verificado y lo que no)

- **HECHO**: la MSI tiene Git 2.56 y Python 3.13; el clon `C:\Users\MSIGF\Cauce-AI-Center` apunta a `origin = github.com/dass-666/Cauce-AI-Center` y está en la rama de la fase G. No hay Node (solo el de Electron), así que la validación en la MSI es con `pruebas.html`, no con `probar.bat`.
- **Pasos** (`ABRIR-CIERRE.bat`, entregado en los archivos del proyecto y en la raíz de la rama): abre Git Bash o cmd en ese clon y ejecuta el .bat. Hace `git fetch origin claude/project-thread-fwbit2`, `git checkout -B claude/project-thread-fwbit2 origin/claude/project-thread-fwbit2` y arranca `iniciar.bat`. Si el clon tiene cambios locales, se detiene y lo dice; no borra nada.
- Luego: `http://127.0.0.1:8765/?csi=historico&medir=1` y `http://127.0.0.1:8765/pruebas.html` (debe decir 394 pasaron).
- **SIN VERIFICAR**: no he ejecutado nada en la MSI en este cierre; los cps en Intel UHD siguen sin medir desde la fase G. Lo valida Diego con los pasos de arriba (o con una sesión de Remote Control aprobada por él).

## 8. Decisiones registradas en este cierre (reversibles, tomadas por mí)

1. El caso histórico publicado se reconstruye en el navegador si la carpeta local está vacía; si la carpeta local tiene algo (válido o dañado), manda la carpeta local.
2. El borrador del laboratorio vive en `localStorage` del navegador; es el único estado persistente además de las preferencias. No se añadió escritura al servidor.
3. El registro pendiente del enlace equivocado de 2011 se conserva y se documenta; no se borra para «limpiar».
4. `nexus-R` sigue en 0.2: la rama nueva de R08 no cambia el dictamen de ninguna lección almacenada.

## 9. Decisiones que quedan para Diego

| Decisión | Efecto si no se toma |
|---|---|
| Fusionar la cadena de PR (#14 → … → #25 → cierre) | el producto sigue en ramas; `main` queda vacío |
| Entregar los materiales de Tezcatlipoca rev3 | la verificación del parche, hashes y pruebas no puede hacerse |
| Aplicar o no el parche al bot | sin cambios en el bot |
| Confirmar el tratamiento de `n_comparaciones=null` / `n_rango` con quien mantiene Tezcatlipoca | queda como definición de Cauce, documentada en el contrato |
| Medir cps en la MSI (`?medir=1`) | el rendimiento en Intel UHD sigue como inferencia |
| Extensiones de Nexus (aprobar en pantalla, autenticación) | siguen futuras, como estaba decidido |
