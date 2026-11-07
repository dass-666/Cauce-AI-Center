# Resultado de pruebas del cierre (7-nov-2026, Linux, Chromium real con GPU por software)

- Node: `node pruebas/ejecutar.mjs` → **394 pasaron, 0 fallaron** (igual en `pruebas.html` dentro de Chromium, comprobado por `csi.cjs`).
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
