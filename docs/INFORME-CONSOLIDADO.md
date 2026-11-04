# Cauce AI Center: informe consolidado (al 2026-11-04)

Rama más avanzada: `fase-j/estabilidad-puente` (PR #19), encima del #18 → #17 → … → #1. **No hay nada fusionado ni desplegado.** El contrato v1 no se modificó. No se tocaron Compago, Ek Chuah ni Montambre.

## 1. Avances por fase (lo que hay hoy)
| Fase | PR | Qué dejó | Validado en tu Windows |
|---|---|---|---|
| A–F | #1–#14 | Contrato v1, 2D, edificio 3D, celular, animaciones honestas, estabilidad, naturaleza de cada puesto (Compago), multiproyecto | Hasta la #4 (60 cps) |
| G | #16 | Modo inmersivo y celular afinado | **Sí**: 61 cps normal e inmersivo |
| H | #17 (incluye #15) | Ek Chuah: 6 oficinas por evidencia, exportación cada 15 min con vigencia de 2700 s (sin instalar tareas), requisitos de Tezcatlipoca | No |
| I | #18 | Estado de cada piso en el selector, «Reintentar 3D», pisos preparados con estructura, Montambre sin conexión; corrige «REAL» sin datos | No |
| J | #19 | Estabilidad para el puente de Ronny y sesiones largas (ver §2), guía de interfaz `docs/PUENTE-COMPAGO-DOCKER.md` | No |

## 2. Lo nuevo en la fase J
1. **Archivo leído a medias.** Si el adaptador está reemplazando el archivo justo cuando Cauce lo lee (pasa en volúmenes de Docker en Windows), Cauce lo vuelve a leer una vez antes de marcarlo «Archivo inválido». Si sigue dañado, el error se muestra como antes.
2. **DEMO de un piloto detenido.** Una DEMO que escribe un adaptador en `datos/reales/` ahora caduca con el reloj real. Antes quedaba «En línea» para siempre, porque el exportador pone `ahora_simulado` igual a la hora de exportación. Las demos fijas de `datos/demo/` siguen sin caducar.
   - Es una regla del visualizador, no un cambio al contrato. Se revierte con una línea en `app/nucleo/modelo.js`.
3. **Guía de interfaz para Ronny.** Describe el archivo, su ruta, la escritura atómica, `--entorno demo` para datos sintéticos, la vigencia, el reloj de WSL2 y qué verás en cada caso. No construye el puente ni duplica su trabajo.
4. **Pruebas de sesión larga:**
   - 60 lecturas que cambian, 30 cambios de piso y 40 lecturas con cambios reales.
   - Geometrías, texturas, nodos y escuchas de eventos (listeners) no crecen: 154→154, 17→17, 165→165 y 45→45.
   - El registro de cambios se tapa en 30.

## 3. Pruebas (código final de la fase J)
- Node: **218/218**. `pruebas.html` en Chromium: 218/218.
- Chromium:
  - Regresión 47, animaciones 15, estabilidad 15, memoria 4, móvil 16, brillo 3, naturaleza OK.
  - Compago PR #10 9/9, inmersivo 34, multiproyecto 6, auditoría visual 20.
  - Ek Chuah PR #2 19/19, Ek Chuah integración 16/16, fase I 19/19 y **fase J 15/15 (nueva)**.
- Sobrescritura del exportador de Ek Chuah: 10/10.
- Todo con SwiftShader (GPU por software). **No mide tu Intel UHD.** La única medición real sigue siendo la tuya de la fase G.

## 4. Estado por proyecto
| Proyecto | Estado en Cauce | Procesos con evidencia | Qué falta |
|---|---|---|---|
| **Compago** | DEMO; integración lista | Consumidor de importaciones (automático); el resto reactivo, humano o módulo | El puente local de Ronny (Docker → `datos/reales/compago.json`) con `exportar_cauce` de los PR #9/#10, que no está en `main` |
| **Ek Chuah** | DEMO; integración lista | Descargador, vigía y redactor (reactivos); tarea diaria (programado, sin confirmar) | Fusionar su PR #2 y una primera exportación real (`INFORME-FASE-H.md` §7) |
| **Montambre** | Sin conexión; 4 cuartos vacíos | Ninguno (worker y agentes solo tienen README) | Que exista un proceso que observar (`MONTAMBRE-REQUISITOS.md`) |
| **Tezcatlipoca** | Sin conexión | Desconocido | Localizar el proyecto (`TEZCATLIPOCA-REQUISITOS.md`) |
| **CauceService** | Nada | Desconocido | Localizarlo; no se supone que esté en GitHub |
| **Repacar / Auxilio Auto** | Nada | Desconocido | Localizarlo y confirmar si son uno o dos proyectos |

Ningún proyecto tiene hoy datos reales conectados.

## 5. Pendientes y riesgos
1. **18 PR apilados sin fusionar.** Orden: #1 … #14 → #16 → #17 → #18 → #19, y cerrar el #15 porque el #17 lo incluye.
2. **H, I y J sin validar en Windows.** Guía: §6.
3. **Escenas grandes sin medir.** Con 50 departamentos son entre 988 y 1424 llamadas de dibujo en software, contra 156 de Compago. Ningún proyecto real pasa de 8, así que no se optimizó.
4. **Concurrencia.** El contrato representa cada puesto por separado. Si un proceso corre varias veces a la vez, el exportador tendría que publicar un puesto por corrida. No se tocó el contrato.
5. **Muebles de Kenney.** Siguen pendientes de tu ZIP; los actuales están hechos por código.

## 6. Guía corta para Windows (5 min)
1. `git fetch`, luego `git checkout fase-j/estabilidad-puente` y doble clic en `iniciar.bat`.
2. Arriba, 4 botones: Compago **DEMO**, Ek Chuah **DEMO**, Tezcatlipoca y Montambre **Sin conexión**. Montambre muestra 4 cuartos vacíos.
3. Abre `?medir=1` en Compago y Ek Chuah, normal e inmersivo. Deberías seguir viendo unos 60 cps, como en la fase G.
4. `probar.bat` debe decir **218 pasaron, 0 fallaron**.
5. Pásale `docs/PUENTE-COMPAGO-DOCKER.md` a Ronny.
