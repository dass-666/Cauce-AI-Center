# Auditoría técnica C4 (rama `fase-3d/auditoria`, sobre C3)

Fecha: 2026-11-03. Revisión hecha en Linux con Chromium + SwiftShader (renderizado por software).
**No** es una medición de tu Intel UHD ni una prueba en Windows real.

Escala: **Impacto** (qué tan grave si pasa) · **Riesgo** (qué tan probable) · **Esfuerzo** (para corregir).

## Corregido en esta rama (con prueba)

| # | Hallazgo | Impacto | Riesgo | Esfuerzo | Cómo se comprobó |
|---|---|---|---|---|---|
| 1 | **Enlaces peligrosos que pasaban el filtro.** `esEnlaceSeguro` aceptaba `" javascript:…"`, `"java\tscript:…"`, `"\u0000javascript:…"` y `"/\\otro.sitio"`: el navegador quita esos espacios y tabuladores y los convierte en `javascript:` o en otro sitio. Un archivo de estado alterado podía ejecutar código al tocar un resultado. | Alto | Bajo (el archivo lo escribe tu propio adaptador, en tu PC) | Bajo | Se confirmó que la versión anterior los aceptaba. Ahora se interpretan como lo haría el navegador (`new URL`) y solo pasan http/https; se rechazan caracteres de control y espacios al inicio o al final. Prueba nueva en `casos.js` (9 casos maliciosos, 3 válidos). |
| 3 | **Barra móvil opaca:** al bajar la página, el texto de abajo se transparentaba entre los botones. | Bajo | Alto | Bajo | Captura revisada; regresión 47/47. |
| 2 | **"Reducir movimiento" del sistema no se respetaba** en los viajes de cámara. | Bajo | Medio | Bajo | Con `prefers-reduced-motion: reduce` la cámara salta sin animación. Los personajes siguen animados porque su postura comunica el estado. |

## Revisado sin problemas (evidencia)

| Área | Resultado |
|---|---|
| Liberación de geometrías, materiales y texturas | `pruebas/navegador/memoria.cjs`: 4 cambios de modo y 3 idas 3D ↔ 2D. Geometrías y texturas vivas iguales antes y después (166/40). Un solo lienzo 3D vivo. |
| Eventos y temporizadores | `destruir()` quita teclado, visibilidad, `ResizeObserver`, `setInterval` de la luz, controles y renderer (con `forceContextLoss`). Los demás escuchas viven en nodos que se eliminan. Las cargas asíncronas (brillo, modelos) revisan `destruida`. |
| Ciclo de animación | Una sola cola por personaje; el cambio que llega a media acción espera su turno (`pendiente`). Los gestos solo aparecen ante un cambio observado (C3, `animaciones.cjs` 11/11). |
| Estados vacíos y desconexión | Sin departamentos: aviso y sin barra móvil. Datos no vigentes: los personajes salen y la torreta no parpadea (fases anteriores, pruebas en `casos.js`). |
| Contrato JSON v1 | Sin cambios. Validación, campos desconocidos ignorados, HTML no interpretado (`textContent`). No hay `innerHTML` ni `eval` en `app/`. |
| Separación REAL/DEMO | Insignia en tablero y escena, franja DEMO, `[DEMO]` en textos de la demo (prueba), cambios observados marcados como DEMO. |
| Lectura de datos | `servir.py` solo escucha en `127.0.0.1`, sin listados de carpetas, `nosniff` y `no-store`. `datos/reales/` fuera de git. |
| Rendimiento (software) | 185 llamadas de dibujo en escritorio sin brillo (objetivo orientativo ~220). Sin cambios desde C1. |

## Propuestas (no implementadas: cambios grandes o que necesitan tu decisión)

| # | Propuesta | Impacto | Riesgo | Esfuerzo | Recomendación |
|---|---|---|---|---|---|
| P1 | `escena3d.js` tiene 927 líneas (cámara, encuadre, etiquetas, gestos, medición). Separar cámara/encuadre y etiquetas en módulos propios. | Medio (mantenimiento) | Bajo | Medio | Antes de integrar en CauceService, en una rama aparte y sin cambiar comportamiento. |
| P2 | `servir.py` sirve toda la carpeta del proyecto, incluido `.git/`, solo en tu PC (127.0.0.1). | Bajo | Bajo | Bajo | Si algún día se comparte en red: servir solo `index.html`, `app/`, `vendor/`, `datos/`, `escena/`. Hoy no hace falta. |
| P3 | Las pruebas de navegador (`pruebas/navegador/*.cjs`) necesitan Playwright, que no es dependencia del proyecto, y no corren en `pruebas.html`. | Medio | Medio | Bajo–medio | Mantenerlas fuera de las dependencias ($0) y correrlas antes de cada PR desde una PC con Node; o un GitHub Actions gratuito si el repo lo permite. |
| P4 | En celular, `colocarEtiquetas` lee la posición de la barra en cada cuadro (30 por segundo). | Bajo | Bajo | Bajo | Medir en un celular real antes de optimizar. |
| P5 | Al perder el contexto WebGL se pasa a 2D y no se intenta recuperar la 3D. | Bajo | Bajo | Medio | Suficiente por ahora: el botón 3D vuelve a crearla. |
| P6 | Un gesto de transición depende de que el archivo cambie entre dos lecturas de **esta** página (cada 30 s). Si el estado cambia y regresa entre lecturas, no se ve (es lo correcto: no se inventa). Lo mismo aplica al feed de cambios. | — | — | — | Documentado; no cambiar. |

## Calidad de las pruebas

- Node (`pruebas.html` / `node pruebas/ejecutar.mjs`): 102. Cubren contrato, estados, modelo, máquina de animación, encuadre, etiquetas, navegación, luz, cambios y medidor.
- Navegador: `regresion.cjs` (47 casos: escritorio y 3 celulares), `animaciones.cjs` (11) y `memoria.cjs` (3).
- Sin cubrir: Windows real, GPU real y celular físico. Tampoco Firefox ni Safari: solo Chromium.
