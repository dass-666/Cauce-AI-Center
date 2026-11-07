# Tezcatlipoca v0.2 rev3 · verificación en la MSI (7-nov-2026)

Entrega revisada: `Tezcatlipoca-v0.2-rev3-verificada.zip` (SHA-256 `fce5a1c1c4abeb08494cb8a950538b1b5c10daa10481e5b846bbaf9103cdfdca`,
58 581 bytes), en la MSI de Diego. Contiene el parche, el manifiesto, los ocho expedientes (lecciones) y los scripts.
**Este repositorio es público:** aquí solo van resultados, huellas y conclusiones. La base de Tezcatlipoca, las versiones
locales de las lecciones (con cifras exactas) y las salidas derivadas de la base se quedan en la MSI.

| Marca | Significado |
|---|---|
| **HECHO** | ejecutado y observado en la MSI en esta sesión |
| **INFERENCIA** | se deduce de lo ejecutado, sin observación directa |
| **DECISIÓN DE DIEGO** | no lo resuelvo yo |

## 1. Archivos contra el manifiesto · HECHO

- El manifiesto (`MANIFIESTO.v0.2.rev3.json`) cita **25** archivos en `archivos_de_la_entrega_sha256`. La entrega trae **19** más el propio manifiesto.
- Los **19 coinciden** byte a byte con su SHA-256 declarado (0 distintos). Faltan los 6 que enumera `NOTA-DE-ENTREGA.txt`:
  `resultado_caracterizacion_actual.json`, `resultado_caracterizacion_rev3.json`, `resultado_impacto_y_sensibilidad_respaldo.json`,
  `resultado_suite_26_contra_actual.txt`, `resultado_suite_26_contra_rev3.txt`, `resultado_tests_corte_estricto_contra_rev3.txt`.
- Código de origen: `fiscal.py` de la carpeta del bot (`Desktop\Tezcatlipoca`) tiene hoy `cc726912…`, igual al declarado; `tests_fiscal.py`,
  `filtros.py`, `registro.py` y `discord_bot_ai.py` también coinciden. El respaldo `respaldos/2026-11-06/predicciones.db` existe con la huella
  declarada `1e9c1ddb…` (sigue en la rotación del bot; ver §6, decisión 1). **El parche no está aplicado al bot.**

## 2. Reproducción de los 6 resultados en una copia aislada · HECHO

- Copia aislada: solo los `.py` y `ajustes.json` del bot (sin claves ni `data/`) en una carpeta temporal → `actual`; una segunda copia con el
  parche → `rev3`. El respaldo se copió y se abrió con `mode=ro`. Python 3.13.14. No se ejecutó el bot.
- `git apply` del parche da `fiscal.py` = `56fbb4a2…`, **igual al declarado**. Ojo: en esta MSI `core.autocrlf=true` convierte el archivo a
  CRLF y la huella cambia (`d0227054…`); con `git -c core.autocrlf=false apply` coincide. Si Diego aplica el parche, que lo haga así.
- Nuevas salidas (con sus propias huellas; **no** son los originales, que no se tienen):

| Archivo nuevo | Resultado | SHA-256 de la salida nueva |
|---|---|---|
| `resultado_tests_corte_estricto_contra_rev3.txt` | 12/12 OK | `433e9d7d981db7455aaa1482d2f6d678532da572b82ab478da46a388190e7e88` |
| `resultado_suite_26_contra_actual.txt` | 26 OK | `f8c4623c855b71d1d247306b3d0df6b873fa4a05c8c526381562713f631419ba` |
| `resultado_suite_26_contra_rev3.txt` | 26 OK | `e17af5ea798d598bcf6ed5c96fb0d62a5677da2d12d0b9609f34d0074cfb597e` |
| `resultado_caracterizacion_actual.json` | admite capturas hasta +2 min y fechas ilegibles | `89b343f264785db1a094eb4675a9eb14ea9b40745eadd819e3be3042370cb2df` |
| `resultado_caracterizacion_rev3.json` | corte estricto: solo hasta el instante del corte; excluye ilegibles | `b62415f401d562dfd259c78e09d8aeed69df521fbf45d52bd16a4150898102fa` |
| `resultado_impacto_y_sensibilidad_respaldo.json` | **privado** (derivado de la base); sus cifras coinciden con las que declaran L3, L5, L6 y L10 locales | `6a16daec47f2960241f9b75337b579ef87131141c0fec180ff366f353a601136` |
| *(control)* `resultado_tests_corte_estricto_contra_actual.txt` | 7 FAIL + 1 ERROR, **mismo veredicto prueba por prueba** que el original de la entrega | `275ce73b223dd839e612ea6439b899820e1a5c3668a99a23f82611ebb69af3a4` |

- Procedencia completa (huellas de cada entrada, comandos, equipo): `C:\Users\MSIGF\Documents\Tezcatlipoca-rev3-reproduccion-2026-11-07\PROCEDENCIA.json`
  (SHA-256 `0cfd2aec0f1e2bc9d5d1dcba7909352c9b61067c8db2590f324917358b875926`), junto a las salidas. Carpeta privada: no va a git.
- **Límite (R05):** lo reprodujo la misma familia de IA que escribió las pruebas. No es la reproducción independiente que pide R05.

## 3. Parche del Fiscal · HECHO (verificación), DECISIÓN DE DIEGO (aplicarlo)

- 12 pruebas directas: contra el código actual fallan 7 y la 5 da ERROR (`capturas_hasta` no existe); contra rev3 pasan las 12.
- Suite existente: 26/26 OK antes y después del parche.
- Impacto descriptivo sobre el respaldo: el parche cambia las capturas de una sola recomendación y **ningún** veredicto ni contradicción del
  Fiscal; no hay recomendaciones de una pierna sin fecha válida (con UTC−6 asumido).
- El parche **queda para revisión aparte**: no se aplicó al bot ni se tocó su carpeta.

## 4. Los ocho expedientes con el contrato actual de Cauce · HECHO

Validador (`app/nexus/leccion.js`) y gerente (`app/nexus/gerente.js`, reglas nexus-R 0.2) de esta rama, ejecutados en el navegador de la MSI:

| Lección | Contrato | Dictamen del gerente | R08 |
|---|---|---|---|
| L3 | válida | con objeciones (R03) | cumple |
| L5 | válida | con objeciones (R03, R08) | no cumple: 2 alternativas sin ajuste |
| L5-compartible | válida | con objeciones (R03) | no evaluado: `n_comparaciones` null sin rango declarado |
| L6 | válida | con objeciones (R03, R07: cifras y detalle local, como se espera de la versión local) | cumple |
| **L6-compartible** | **válida** (`n_rango=[30,39]` aceptado) | **incompleto** (R01, R03, R04 no evaluadas; 0 no cumple) | **cumple** (ver abajo) |
| L9 | válida | con objeciones (R03) | cumple |
| L10 | válida | con objeciones (R03, R08) | no cumple: 3 alternativas sin ajuste |
| L10-compartible | válida | incompleto | no evaluado: `n_comparaciones` null sin rango declarado |

Ninguna queda «apta para decisión humana» y todas siguen en `validacion.estado = "propuesta"`. **No se importaron al almacén de Nexus**
(la importación es manual y es decisión de Diego; ver decisión 9 del manifiesto).

### L6 compartible y R08 con `n_comparaciones = null`

- `n_comparaciones: null` + el texto en `supuestos` «Candidatos de umbral por grupo (n_comparaciones): **entre 3 y 8**…» → `rangoComparaciones` lee **[3, 8]**
  (y no confunde el rango de `n_independiente`, «entre 30 y 39», que va antes).
- Con la confianza declarada (**baja**, objeto **método**, estado propuesta) la selección no pesa y R08 **cumple**: el null no cambia el dictamen.
- Si alguien subiera la confianza a media o alta sin ajuste por comparaciones, R08 daría **no cumple** (la selección en la misma muestra, y además
  el mínimo del rango, 3, ya es más de una alternativa). Así la lección puede circular como compartible sin presumir robustez.
- Prueba nueva en `pruebas/casos-cierre.js` con esa forma exacta de `supuestos` (395 pruebas en total).
- `n_rango = [min, max]` (enteros ≥ 0, `min ≤ max`) es contrato de Cauce desde el cierre: el formato «PROVISIONAL» del manifiesto (decisión 8) ya
  coincide con lo que valida Cauce.
- Observación para quien mantiene Tezcatlipoca (sin cambiar nada): L5-compartible y L10-compartible también dejan `n_comparaciones` en null, pero no
  declaran rango; R08 queda «no evaluado». Declarar un rango como en L6 lo haría evaluable.

## 5. Lo que no se hizo, a propósito

- No se aplicó el parche al bot ni se modificó ningún archivo de `Desktop\Tezcatlipoca`.
- No se subió a git ninguna lección, la base ni salidas derivadas de ella.
- No se cambió el estado de ninguna lección.

## 6. Decisiones de Diego (del manifiesto, siguen abiertas)

1. Conservar el respaldo `2026-11-06` fuera de la rotación antes del 21-nov-2026 (hoy sigue dentro de `respaldos/` del bot; también hay una copia en `Documents\Codex\…\work\respaldo-local\`).
2. Revisor humano independiente (R01) y reproducción independiente (R05).
3–5. Privacidad, justificaciones R04, `origen.tipo` y `vigente_hasta`.
6. **Aplicar o no el parche rev3 al Fiscal** (verificado aquí, no aplicado).
7. Zona horaria del PC: **HECHO** el 7-nov-2026, `tzutil /g` en la MSI → `Central Standard Time (Mexico)` (UTC−6, sin horario de verano desde 2022),
   el supuesto con el que se calcularon las cifras. Queda para Diego decidir, fuera de Nexus, si se corrige el histórico (las marcas con `+00:00`).
8. `n_rango`: ya es formato de Cauce (§4).
9. Si se importan lecciones a Nexus, cuáles y cuándo.
