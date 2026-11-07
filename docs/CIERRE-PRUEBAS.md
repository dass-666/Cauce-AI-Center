# Resultado de pruebas del cierre (7-nov-2026, Linux, Chromium real con GPU por software)

## Corrida final sobre el commit entregado (65ff2c3, árbol limpio)

- Node: **395 pasaron, 0 fallaron**.
- Regresión Chromium completa, los 29 guiones de `pruebas/navegador/`: **29 verdes, 0 rojos**, sin errores de JavaScript. Se corrió por lotes (`SOLO=…`) sobre el mismo árbol, porque el proceso de fondo del contenedor no sobrevive entre turnos; cada lote es la misma invocación de `todas.cjs`.

```
VERDE  animaciones.cjs               15 OK  0 FALLA  (37 s, código 0)
VERDE  auditoria-visual.cjs          20 OK  0 FALLA  (60 s, código 0)
VERDE  brillo.cjs                     3 OK  0 FALLA  (14 s, código 0)
VERDE  cierre.cjs                    42 OK  0 FALLA  (62 s, código 0)
VERDE  compago-pr10.cjs               9 OK  0 FALLA  (51 s, código 0)
VERDE  csi-fase2.cjs                 42 OK  0 FALLA  (37 s, código 0)
VERDE  csi.cjs                       39 OK  0 FALLA  (49 s, código 0)
VERDE  e2-capturas.cjs                0 OK  0 FALLA  (62 s, código 0)
VERDE  ek-chuah-integracion.cjs      16 OK  0 FALLA  (52 s, código 0)
VERDE  ek-chuah-pr2.cjs              19 OK  0 FALLA  (137 s, código 0)

VERDE  estabilidad.cjs               15 OK  0 FALLA  (50 s, código 0)
VERDE  fase-i.cjs                    19 OK  0 FALLA  (86 s, código 0)
VERDE  fase-j.cjs                    15 OK  0 FALLA  (138 s, código 0)

VERDE  fase-k-capturas.cjs            0 OK  0 FALLA  (93 s, código 0)
VERDE  fase-k.cjs                    48 OK  0 FALLA  (135 s, código 0)
VERDE  fase-l-portal.cjs             12 OK  0 FALLA  (32 s, código 0)

VERDE  fase-l.cjs                    42 OK  0 FALLA  (215 s, código 0)
VERDE  fase-m-capturas.cjs            0 OK  0 FALLA  (93 s, código 0)
VERDE  fase-m.cjs                    20 OK  0 FALLA  (108 s, código 0)

VERDE  inmersivo.cjs                 34 OK  0 FALLA  (59 s, código 0)
VERDE  memoria.cjs                    4 OK  0 FALLA  (49 s, código 0)
VERDE  movil-medidas.cjs             16 OK  0 FALLA  (42 s, código 0)
VERDE  multiproyecto.cjs              7 OK  0 FALLA  (176 s, código 0)

VERDE  naturaleza.cjs                 0 OK  0 FALLA  (1 s, código 0)
VERDE  nexus.cjs                     45 OK  0 FALLA  (52 s, código 0)
VERDE  pruebas-html.cjs               0 OK  0 FALLA  (3 s, código 0)
VERDE  regresion.cjs                 47 OK  0 FALLA  (135 s, código 0)

VERDE  rendimiento-uhd.cjs           29 OK  0 FALLA  (147 s, código 0)
VERDE  rendimiento.cjs                0 OK  0 FALLA  (167 s, código 0)
```

## Corridas anteriores (b52f6c9)

- Node: `node pruebas/ejecutar.mjs` → **394 pasaron, 0 fallaron** (igual en `pruebas.html` dentro de Chromium, comprobado por `csi.cjs`).
- **Actualización 7-nov-2026, en la MSI (Windows 11, Intel UHD)**:
  - `pruebas.html` → **394/394 en b52f6c9**. En el commit entregado, **395/395**: 1 prueba nueva para la forma exacta de L6 compartible, comprobada en el navegador de la app y en Edge.
  - La MSI no tiene Node ni Playwright, así que la regresión Chromium completa no se repitió aquí. La sustituyen los recorridos a mano de `docs/CIERRE.md` §7: inicio, caso suizo, investigación → expediente, borrador tras recargar y Nexus, todos OK y sin errores de JavaScript.
  - Los dos cambios de código de este paso son el estilo de la lista «Cotejo con el original» (clase `csi-lista`) y la prueba nueva. Los selectores que usan los guiones (`[data-cotejos]`, `[data-fuente-id]`) no cambian.
- Regresión Chromium completa `node pruebas/navegador/todas.cjs` (29 guiones, Playwright + SwiftShader): **28 verdes y 1 rojo** en la corrida completa.
  El rojo fue `csi.cjs`, una aserción antigua que buscaba la descarga `investigacion.json`, renombrada en este cierre a
  `investigaciones.json` (ahora es una colección). Se actualizó la aserción (y pide también el expediente .md) y
  `csi.cjs` se volvió a correr por separado: **39 OK, 0 FALLA, errores: ninguno**. No se repitió la corrida completa
  después de ese cambio; el cambio solo toca ese guion.
- Lo que estas pruebas NO miden: cps en Intel UHD (solo en la MSI, con `?medir=1`).

Salida íntegra de la corrida completa:

```
VERDE  animaciones.cjs               15 OK  0 FALLA  (37 s, código 0)
VERDE  auditoria-visual.cjs          20 OK  0 FALLA  (58 s, código 0)
VERDE  brillo.cjs                     3 OK  0 FALLA  (14 s, código 0)
VERDE  cierre.cjs                    42 OK  0 FALLA  (62 s, código 0)
VERDE  compago-pr10.cjs               9 OK  0 FALLA  (51 s, código 0)
VERDE  csi-fase2.cjs                 42 OK  0 FALLA  (36 s, código 0)
ROJO   csi.cjs                       38 OK  1 FALLA  (48 s, código 1)
         FALLA laboratorio: descargas de investigación y predicciones disponibles
VERDE  e2-capturas.cjs                0 OK  0 FALLA  (59 s, código 0)
VERDE  ek-chuah-integracion.cjs      16 OK  0 FALLA  (51 s, código 0)
VERDE  ek-chuah-pr2.cjs              19 OK  0 FALLA  (144 s, código 0)
VERDE  estabilidad.cjs               15 OK  0 FALLA  (50 s, código 0)
VERDE  fase-i.cjs                    19 OK  0 FALLA  (85 s, código 0)
VERDE  fase-j.cjs                    15 OK  0 FALLA  (136 s, código 0)
VERDE  fase-k-capturas.cjs            0 OK  0 FALLA  (90 s, código 0)
VERDE  fase-k.cjs                    48 OK  0 FALLA  (134 s, código 0)
VERDE  fase-l-portal.cjs             12 OK  0 FALLA  (31 s, código 0)
VERDE  fase-l.cjs                    42 OK  0 FALLA  (212 s, código 0)
VERDE  fase-m-capturas.cjs            0 OK  0 FALLA  (91 s, código 0)
VERDE  fase-m.cjs                    20 OK  0 FALLA  (107 s, código 0)
VERDE  inmersivo.cjs                 34 OK  0 FALLA  (57 s, código 0)
VERDE  memoria.cjs                    4 OK  0 FALLA  (49 s, código 0)
VERDE  movil-medidas.cjs             16 OK  0 FALLA  (42 s, código 0)
VERDE  multiproyecto.cjs              7 OK  0 FALLA  (174 s, código 0)
VERDE  naturaleza.cjs                 0 OK  0 FALLA  (1 s, código 0)
VERDE  nexus.cjs                     45 OK  0 FALLA  (51 s, código 0)
VERDE  pruebas-html.cjs               0 OK  0 FALLA  (2 s, código 0)
VERDE  regresion.cjs                 47 OK  0 FALLA  (133 s, código 0)
VERDE  rendimiento-uhd.cjs           29 OK  0 FALLA  (146 s, código 0)
VERDE  rendimiento.cjs                0 OK  0 FALLA  (166 s, código 0)

28/29 scripts en verde
```
