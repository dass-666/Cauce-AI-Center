# Informe fase L: oficina viva, animaciones y preparación para el portal (2026-11-05)

Rama `fase-l/animacion-oficina-portal`, creada desde `fase-k/oficina-virtual-profesional` (`05c5aeb`, PR #20).
PR en borrador. Sin fusionar, sin desplegar, sin tocar `main`, PR #19, PR #20, el contrato v1, `datos/reales/`, los
exportadores, CauceService ni el trabajo de Ronny. Sin dependencias nuevas.

## 1. Resumen ejecutivo

- **Hecho y probado en Chromium:** muebles modulares por código (15 piezas reutilizables), recepción con marquesina,
  sala de juntas y cocineta, oficinas con mueble propio, puerta y zócalo; personajes que **leen, voltean y se acomodan**
  entre ratos de tecleo (ciclo determinista, sin inventar actividad); giro y caminata suaves; **vista anterior**
  (Retroceso / ↶); **tarjeta flotante** al tocar un personaje o un **puesto vacío**; identidad por proyecto (estilo y
  tema de oficina); sala con pendientes al final; **preparación para el portal** (subruta `/cauce/`, `?incrustado=1`,
  `frame-ancestors 'self'`, documento `docs/INTEGRACION-PORTAL-CAUCE.md`).
- **Defecto de K corregido:** en oficinas con dos filas de escritorios, los personajes **atravesaban** el escritorio
  de enfrente al ir a su silla. Demostrado con una prueba que falla con el código de K y pasa con el de L.
- **Rendimiento (SwiftShader, sin tu GPU):** llamadas de dibujo del edificio **159 → 83 (−48 %)** pese a tener más
  muebles; triángulos 6 271 → 9 363 (+49 %, todavía poco); texturas 20 → 23.
- **No medido:** cuadros por segundo en tu Intel UHD. Última medición real: fase G (≈61 cps). H–L sin validar en tu
  equipo. Guía de 5 minutos: `docs/VALIDAR-FASE-L.md`.
- **Pruebas:** Node **251/251** (antes 230, +21). Chromium: **21 scripts** (los 19 de K + `fase-l.cjs` + `fase-l-portal.cjs`);
  resultado final en la sección 6.

## 2. Qué se implementó (por bloque)

### L1–L2 Arquitectura y mobiliario modular — `mobiliario.js`, `arquitectura.js`, `oficina.js`
- `crearMobiliario()`: escritorio, monitor y teclado, silla, laptop, archivero, estantería, mesa de juntas, planta
  (3 tamaños), lámpara, división de cristal, mostrador, sofá, garrafón, credenza y papeles. Geometrías en caché por
  medida: cien escritorios comparten las mismas geometrías.
- Recepción: piso de baldosa (textura generada), entrada con puertas de cristal y **marquesina** con el nombre del
  piso, luz de conexión y «DEMO» cuando corresponde; sala de juntas con cristal y **sillas vacías** (si el ancho ≥ 14);
  cocineta (si ≥ 20); charcos de luz cálida en pasillos (una sola malla aditiva).
- Cada oficina: mueble en el muro del fondo según su tema (estantería, credenza o garrafón y archivero), puerta de
  cristal abierta y zócalo de color. Detalles por escritorio (papeles o planta) deterministas por posición.
- Placas del piso numeradas «1 · Importación…»: el número es la tecla que enfoca ese departamento.

### L3 Animaciones naturales (prioridad alta) — `maquina.js`, `personaje.js`, `kenney.js`
- `faseTrabajo(reloj, v)`: mientras el **dato** dice «trabajando», el personaje alterna tecleo con pausas cortas
  (leer, mirar a un lado, acomodarse). Es una variación de postura del **mismo** estado, no actividad nueva: no cambia
  contadores, no genera eventos y depende solo del reloj y del identificador (dos personas nunca se mueven en sincronía).
- Giro con velocidad máxima (4,5 rad/s): se eliminaron los saltos de orientación (máximo medido entre muestras: de
  2,62 rad a 0,67 rad). Caminata con aceleración y frenado; sentarse y levantarse en 0,6 s.
- Reposo: mira la pantalla con las manos en el regazo. Alerta: inclinado hacia la pantalla (antes exagerado). Atención:
  una mano arriba. Celebrar: un puño arriba, **sin salto**.
- «Reducir movimiento»: el mezclador de animaciones no avanza y la cámara no se desliza (probado).

### L4 Vida visual sin actividad ficticia
- Lo que se mueve sin datos es **ambiente**: luz de pasillos, luz de conexión de la marquesina, brillo de pantallas
  según el estado ya existente. No hay personas nuevas, ni contadores, ni alertas inventadas.
- Puesto sin evidencia: silla vacía y tarjeta «Puesto sin personaje: no hay evidencia de actividad vigente».

### L5 Identidad por proyecto — `identidad.js`, `iconos.js`, `registro.js`, `modelo.js`
- Campo opcional `estilo` en `datos/proyectos.json`: `comercial` (Compago), `financiero` (Ek Chuah), `alimentos`
  (Montambre), además de `servicios` y `general`. Cambia baldosa, línea de color e icono del letrero.
- Campo opcional `tema` por departamento en `escena/*.json` (servidores en *Datos*, archiveros en *Informes*…). Si no
  se declara, se deduce como antes. Ambos campos están **fuera del contrato v1**; la fase K los ignora sin fallar.

### L6 Cámara — `camara-historial.js`, `escena3d.js`, `barra-movil.js`
- Historial de vistas (hasta 12, sin repetir): **Retroceso** o botón **↶ Anterior** regresa con el mismo encuadre; en
  celular, «↶ Vista anterior» en el menú ⋯. Se guarda también antes de mover la cámara a mano. Se vacía al cambiar de piso.
- Fundido corto al reconstruir la escena (anulado con «reducir movimiento»).

### L7 Interacción con personajes y puestos
- Tarjeta flotante junto al personaje: nombre, departamento, naturaleza («Proceso automático», etc.), estado y
  marca DEMO/REAL. Se reubica para no tapar paneles. **F** lo sigue.
- Cada puesto tiene una zona invisible de toque: tocar un escritorio vacío explica por qué no hay nadie.

### L8 Recepción y sala central — `sala.js`
- Recepción sin recepcionista (no hay evidencia de que exista). Mostrador con la franja de color del proyecto.
- Sala: franja de color y etiqueta de estilo por tarjeta; los **pendientes** al final y en tarjeta compacta; en
  pantallas < 1100 px, enlaces «Atención / Proyectos / Cambios» para saltar de sección (enlaces internos, no botones:
  la sala sigue sin nada que actúe sobre sistemas). Abrir y cerrar la sala no mueve la cámara.
- Pestañas: si hay 2 o más pisos pendientes, se agrupan en «+N pendientes» (`app/nucleo/pisos.js`).

### L9 Preparación para el portal — `configuracion.js`, `index.html`, `servir.py`, `docs/INTEGRACION-PORTAL-CAUCE.md`
- Todas las rutas son relativas (probado en Node: ninguna ruta absoluta en los archivos principales).
- `index.html` corrige `/cauce` → `/cauce/` y activa `?incrustado=1` (oculta título y pie; **siguen** DEMO, conexión,
  alertas y pestañas).
- `servir.py --base /cauce/` para probar la subruta **en local** (127.0.0.1). Cabeceras nuevas:
  `Content-Security-Policy: frame-ancestors 'self'` y `Referrer-Policy: no-referrer`.
- **No** se creó autenticación, ni se publicó, ni se tocó CauceService. El documento explica por qué un iframe **no**
  es seguridad y qué debe decidir el servidor del portal.

### L10 Escalabilidad
- Un piso nuevo se agrega con una línea en el registro y, si se quiere, `escena/<id>.json` con `tema`; el motor no
  cambia. Los muebles se reutilizan por caché; los estáticos se fusionan por material y por color (ver sección 4).

## 3. Qué se descartó y por qué

| Idea | Motivo |
|---|---|
| Sombras dinámicas, posprocesado (bloom, SSAO) | Costo alto en Intel UHD; el brillo sigue apagado por defecto |
| «Modo ligero» separado | No hizo falta: las llamadas bajaron 48 %. Se reconsidera si tu medición sale < 50 cps |
| Recepcionista, visitantes, gente en la sala de juntas | Serían personas inventadas |
| Refactor grande de `app/app.js` | Riesgo alto sin beneficio visible; solo se extrajo `pisos.js` |
| Furniture Kit de Kenney | Sigue pendiente el ZIP; los muebles por código cubren la necesidad |
| Integración real con el portal, autenticación | Fuera de alcance; depende de CauceService (sin repositorio) |

## 4. Rendimiento (L11) — medido en este contenedor con SwiftShader (GPU por software)

| Vista | Llamadas K → L | Triángulos K → L | Geometrías K → L | Texturas K → L |
|---|---|---|---|---|
| Edificio | 159 → **83** | 6 271 → 9 363 | 159 → 84 | 20 → 23 |
| Oficina enfocada | 119 → **64** | 5 371 → 9 145 | — | — |
| Un cuarto | 23 → **13** | 1 435 → 1 723 | 24 → 15 | 9 → 9 |
| Inmersivo | 107 → **58** | 4 925 → 8 615 | — | — |
| Celular | 159 → **83** | — | — | — |

- Por qué bajaron: los materiales de color liso ahora se fusionan en **una** malla con color por vértice, en lugar
  de una malla por color. Las llamadas de dibujo suelen ser el cuello de botella de una GPU integrada; los triángulos
  extra (≈9 400) son pocos para cualquier GPU actual.
- Sesión larga (`memoria.cjs`, `estabilidad.cjs`): geometrías y texturas estables, sin fugas.
- **Los cps de SwiftShader no sirven para predecir tu Intel UHD** (en este contenedor el edificio dio 21 cps en K y
  31 en L; eso solo indica dirección). **Espero** que tu equipo se mantenga cerca de 60 cps, pero **no está medido**.

## 5. Defectos corregidos

| Defecto | Gravedad | Corrección | Cómo se comprueba |
|---|---|---|---|
| Personajes atravesaban el escritorio de enfrente en oficinas de dos filas (venía de K) | Media (visual, se notaba) | `camino()` rodea los escritorios ocupados | `casos-fase-l.js`: falla con el algoritmo de K, pasa con L; `fase-l.cjs` sigue al personaje |
| Saltos bruscos de orientación al girar | Baja | Velocidad máxima de giro | `fase-l.cjs` mide el salto máximo entre muestras |
| La tarjeta del puesto vacío mostraba «null» como texto | Baja | Corrección al armar la tarjeta | `fase-l.cjs` revisa el texto |
| La tarjeta oculta seguía visible (CSS) | Baja | Regla `[hidden]` | `fase-l.cjs` |
| `todas.cjs` marcaba errores en falso | Baja (herramienta de pruebas) | Expresión anclada al inicio de línea | La suite completa en verde |
| Lista «+N pendientes» quedaba abierta y tapaba los botones de vista (propio de L, detectado por `multiproyecto.cjs`) | Media (bloqueaba clics) | Se cierra al elegir, al tocar fuera o con Escape | `multiproyecto.cjs` comprueba que se cierra |
| Regresión propia detectada por `fase-k.cjs`: los accesos nuevos de la sala eran botones | Baja | Se cambiaron a enlaces internos **sin debilitar** la prueba de K | `fase-k.cjs` en verde |

## 6. Pruebas ejecutadas

- **Node:** `node pruebas/ejecutar.mjs` → **251 pasaron, 0 fallaron** (230 de antes + 21 de `casos-fase-l.js`).
- **pruebas.html en Chromium:** 251/251, también bajo `/cauce/`.
- **Chromium (SwiftShader):** `node pruebas/navegador/todas.cjs` corre los 21 scripts y los resume.
  - Nuevos: `fase-l.cjs` (42 comprobaciones: muebles, marquesina, pausas, giro, caminos, vista anterior, tarjetas,
    puesto vacío, estilo, temas, sala, celular, incrustado, reducir movimiento) y `fase-l-portal.cjs` (12: subruta,
    nada pedido fuera de `/cauce/`, cabeceras, iframe del mismo origen).
  - Resultado de la corrida final: ver `RESULTADO-PRUEBAS.txt` en la carpeta de entrega.
- Ninguna prueba anterior se quitó ni se relajó. La línea base de K se corrió en una copia aparte (19/19 en verde).

## 7. Riesgos y limitaciones

- **Intel UHD sin medir desde la fase G.** Es el riesgo principal; triángulos +49 % y texturas +3.
- Las pausas de tecleo son decorativas: **no** significan que el proceso esté leyendo algo. Está documentado y
  solo ocurren cuando el dato ya dice «trabajando».
- El historial de vistas y de cambios es solo de la sesión (se pierde al recargar).
- Los enlaces de sección de la sala solo aparecen en pantallas < 1100 px.
- La subruta se probó con `servir.py`, no con el servidor real del portal (no existe todavía).

## 8. Qué necesita tu computadora

Nada nuevo: los mismos archivos, `iniciar.bat` y Chrome o Edge. Para validar: `docs/VALIDAR-FASE-L.md` (5 minutos),
lo más importante es pegar la **medición de cps** del edificio, el modo inmersivo y un departamento.

## 9. Qué falta para el portal

Ver `docs/INTEGRACION-PORTAL-CAUCE.md`, sección 7: localizar el repositorio de CauceService, autenticación y
autorización por proyecto **en el servidor**, dónde escribe el puente de Ronny los JSON, política de incrustación,
HTTPS y caché de producción. Recomendación: primero un **enlace** a `/cauce/`; después un iframe del mismo origen.

## 10. Propuesta de fase M

| Prioridad | Tarea | Por qué ahora | Costo |
|---|---|---|---|
| 1 | **Medir en tu Intel UHD** (fases H–L) | Sin esto no sabemos si L es aceptable | 5 min tuyos |
| 2 | Primer dato **REAL** de Compago vía el puente de Ronny (piloto local) | Todo lo visual ya está; falta verdad | Depende de Ronny |
| 3 | Modo ligero solo si la medición sale < 50 cps | Evitar trabajo innecesario | 1 sesión |
| 4 | Extraer el controlador de la sala de `app/app.js` | Mantenimiento; `app.js` sigue grande | 1 sesión |
| 5 | Cuando aparezca CauceService: enlace a `/cauce/` y reglas de acceso en su servidor | Integración mínima y segura | Depende del repositorio |
| Después | Furniture Kit (si llega el ZIP), historial permanente en CauceService | Valor menor por ahora | — |

No recomiendo más animación ni más muebles antes de medir en tu equipo y de tener datos reales.

## 11. Versiones

- Base: `05c5aeb` (fase K). Three.js r187 y Kenney Mini Characters sin cambios. Sin dependencias nuevas.
- Archivos nuevos: `mobiliario.js`, `camara-historial.js`, `app/nucleo/pisos.js`, `app/configuracion.js`,
  `pruebas/casos-fase-l.js`, `pruebas/navegador/fase-l.cjs`, `fase-l-portal.cjs`, `todas.cjs`, este informe,
  `VALIDAR-FASE-L.md` e `INTEGRACION-PORTAL-CAUCE.md`.
