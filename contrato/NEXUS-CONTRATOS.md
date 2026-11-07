# Contratos de Nexus · `cauce.leccion` 0.2 y `cauce.recomendacion` 0.2 · reglas `nexus-R 0.2`

Implementación de `docs/CAUCE_NEXUS_ARQUITECTURA_MAESTRA_v0.2.md` (§3, §4, §5, §8). Son **independientes** de
`cauce.estado-proyecto` 1.0.0, que no cambia. Referencias ejecutables: `app/nexus/leccion.js`, `recomendacion.js`,
`gerente.js`, `registro.js`; pruebas T01–T24 en `pruebas/casos-nexus.js`.

## `cauce.leccion` 0.2

Exactamente los campos de la tabla §3 (las claves desconocidas se **rechazan**, también dentro de `origen`, `evidencia`,
`muestra`, etc.). Plantilla registrable: `contrato/ejemplos/nexus/leccion-plantilla.json`.

Interpretaciones que el documento deja abiertas (decididas así; revisables):

| Tema | Decisión |
|---|---|
| Fechas de día (`fecha_hallazgo`, `vigente_hasta`, periodos, `validado_en.fecha`) | Se aceptan `AAAA-MM-DD` (como el ejemplo §3.1). Para comparar, un día sin zona vale como intervalo de 00:00 UTC+14 a 24:00 UTC−12: si un instante cae dentro, R04 queda «no evaluado». |
| Instantes (`observado_en`, `conocido_en`, `revisiones[].fecha`, `decision_humana.fecha`, `historial[].fecha`) | Con zona obligatoria; sin zona la lección no es registrable (T17). |
| `revision` que citan las recomendaciones | Es la `version` de la última entrada de `revisiones[]` (en §4.1 se cita `"0.2"`, igual que la `version` de la revisión de §3.1). |
| Costos y ajustes (T18, T19) | En `muestra.supuestos[]` como texto o `{variable, valor, conocido}`; `ajuste_comparaciones` declara el ajuste por selección. |
| Extensiones Cauce 0.2 (opcionales) | `evidencia.exportado_en` (T07 la necesita y §3 no le da campo) y `evidencia.fraccion_estimada` (0–1, T21). |
| Tipos de evidencia con significado para las reglas | `texto_ia`, `inventario_ia`, `resumen_ia`, `auditoria_ia`, `memoria_ia` = texto de IA (no acredita hechos); `estado_tarea`, `ci`, `pr`, `etiqueta` = estado de proceso, no entregable; `informe`, `entregable`, `artefacto`, `resultado_verificado`, `verificacion_despliegue`, `despliegue` = entregable. |
| Marca de prueba | El documento no tiene `es_demo`. Los registros de prueba se marcan en el archivo (`es_demo: true`) y con ids `demo-…`; un registro real rechaza ids `demo-…` y al revés. |

## `cauce.recomendacion` 0.2

Campos obligatorios de §4, claves desconocidas rechazadas. Cada cambio de estado es una **versión nueva** en el
almacén con `historial` anexado (los eventos anteriores no cambian). Transiciones: `propuesta → revisada →
pendiente_aprobacion → aprobada | rechazada | aplazada`, `aplazada → pendiente_aprobacion`, cualquiera → `caducada`.

- **Aprobar** solo lo hace una persona (último evento `aprobada`, `autor_tipo: humano`), distinta de quien propuso, desde
  `pendiente_aprobacion`, con `decision_humana` completa, el experimento sin valores pendientes y las 10 reglas en
  `cumple` sobre las lecciones citadas **en su revisión vigente**. Lo no evaluado nunca se aprueba.
- `revision_esceptica` la calcula el gerente (`revisionEsceptica()`); si lo guardado dice `cumple` donde el cálculo no,
  el registro la rechaza (T12). `no_evaluada` no es un estado válido.
- `toca_parametros_financieros` o `toca_apuestas` = **bloqueo absoluto**: Nexus nunca registra ejecución ni adopción.
- Aprobada ≠ ejecutada ≠ adoptada ≠ desplegada; la adopción necesita referencia propia (no se deduce de la ejecución).

## Almacén (fase 1 y 1.5)

Dos archivos JSON que solo crecen (`datos/nexus/registro/` real, fuera de git; `datos/nexus/demo/` de prueba). Cada
entrada: `{registro, registrado_en, registrado_por: {tipo, identificador, autenticacion?}, huella_anterior}`; `huella_anterior` es el
SHA-256 del JSON canónico de la entrada previa. Borrar, editar o reordenar se detecta con la cadena; **quitar las últimas
entradas** se detecta con el manifiesto (fase 1.5, abajo).

- `registrado_por.autenticacion` (extensión Cauce 1.5, opcional): solo `"declarada"`. Omitirla significa lo mismo. `"autenticada"` se rechaza mientras no exista un verificador real (CauceService).
- **Admisión al almacén real** (solo la primera versión de cada lección). Exige:
  - que cumpla el contrato;
  - que R01 cumpla, es decir, una revisión humana de alguien distinto del autor;
  - que R02 y R07 cumplan;
  - al menos una evidencia primaria con `commit` (7 a 40 caracteres hexadecimales) o `sha256`.

  Lo que no cumple se queda como **candidata** en `datos/nexus/candidatas/`. Las versiones siguientes solo necesitan contrato y reglas de paso, para poder registrar también una objeción.

## `cauce.nexus.manifiesto` 0.2 (fase 1.5)

Archivo aparte (`datos/nexus/registro/manifiesto.json` por omisión, o `--manifiesto=` en otro disco). Tiene esta forma:
`{contrato, version_contrato, sellos: [{sellado_en, sellado_por:{tipo, identificador, autenticacion:"declarada"}, registros:{lecciones:{n, cabeza}, recomendaciones:{n, cabeza}}, huella_anterior}]}`.

- `n` es el número de entradas y `cabeza` el SHA-256 de la última entrada.
- Los sellos forman su propia cadena.
- El **ancla** es `«nº de sellos»:«16 hex de la huella del último sello»`. Se anota fuera del equipo.

La comparación del almacén con el último sello da uno de estos estados: `integro`, `sin_sellar` (aviso), `truncado`, `reescrito`, `manifiesto_alterado` o `registro_alterado`.

## `cauce.nexus.respaldo` 0.2 (fase 1.5)

Cada respaldo es una carpeta `datos/nexus/respaldos/<fecha>/` con copias exactas de `lecciones.json`, `recomendaciones.json` y `manifiesto.json`. Lleva además un índice `respaldo.json`:
`{contrato, version_contrato, creado_en, creado_por, motivo, archivos: {nombre: sha256 del texto}}`.

Nunca se sobrescribe una carpeta existente. La restauración copia a `datos/nexus/restauraciones/<fecha>/` y no toca el almacén.

## `cauce.nexus.politica` 0.2 (fase 1.5)

`datos/nexus/politica.json` (en git) tiene la forma
`{contrato, version_contrato, aprobadores_declarados: [alias], autenticacion: "ninguna", nota}`.

Hoy el único aprobador es `diego`. En el almacén real, una decisión (aprobada, rechazada o aplazada) solo se admite si cumple todo esto:
- la registra un aprobador declarado;
- ese aprobador es el mismo que figura en `registrado_por`;
- el último evento del historial lleva `motivo`.

Ninguna de estas reglas es autenticación: solo deja registrado quién **dice** haber decidido.

## `cauce.nexus.candidatas` 0.2 (fase 1.5)

`datos/nexus/candidatas/indice.json` tiene la forma `{contrato, version_contrato, nota, archivos: ["ek-chuah/EK-L001.json", …]}`. La oficina muestra estas lecciones aparte, con la etiqueta «Candidata · no registrada». No cuentan en ninguna cifra.

## `cauce.leccion` 0.3 · cambio mínimo: `muestra.naturaleza = "desconocida"` (CSI, 2026-11-06)

Autorizado por Diego (decisión 7 del encargo CSI). **Único cambio** respecto de 0.2:

| | 0.2 | 0.3 |
|---|---|---|
| `muestra.naturaleza` | `sintetica`, `demo`, `real_historica`, `real_comercial` | lo mismo + `desconocida` |
| Todo lo demás | — | idéntico a 0.2 |

- **Compatibilidad**: el validador acepta `version_esquema` `"0.2"` y `"0.3"`. Una lección 0.2 válida sigue siéndolo; una lección 0.2 con `desconocida` se **rechaza** con el aviso «usa 0.3». Los registros existentes no se reinterpretan ni se reescriben (el almacén real sigue vacío; los DEMO siguen en 0.2 y su archivo no cambió).
- **Gerente (R08)**: con `desconocida`, cualquier confianza que no sea «baja» sobre «método» queda **no evaluada** (nunca «cumple» por omisión) → la lección nunca llega a «sin objeciones». Los demás casos de R08 (beneficio económico) siguen dando «no cumple». La rama nueva es inalcanzable para lecciones 0.2, así que sus dictámenes no cambian; por eso la versión de reglas sigue siendo `nexus-R 0.2`.
- **Pruebas**: `pruebas/casos-csi.js` (bloque «contrato 0.3» y «PR #23 intacto»).
- **Pendiente**: las candidatas EK-L001/L003/L007 siguen en 0.2 con `sintetica`; pasarlas a 0.3 con `desconocida` es una decisión aparte (no se tocaron).

## Hallazgo de contrato para v0.3 (resuelto arriba)


`muestra.naturaleza` no admite «desconocida». Una lección preparada sin acceso a los datos tiene que elegir un valor que nadie confirmó. Las candidatas Ek Chuah usan `sintetica`, el valor más restrictivo según R08, y lo declaran en `limitaciones`. La propuesta para v0.3 es agregar `desconocida`.
