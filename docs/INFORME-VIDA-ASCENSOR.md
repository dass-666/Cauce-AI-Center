# Informe: vida en «Un cuarto» y ascensor entre pisos (2026-11-09)

Rama `claude/project-thread-l7uvsf`, creada desde la versión candidata `8705538` (PR #34). PR en borrador; sin fusionar ni desplegar.

## 1. Causa raíz

**Ascensor (transición entre pisos).** No era una regresión de un ascensor que existiera: **nunca hubo transición
vertical** en ninguna rama ni commit (`git log --all -S ascensor` y `-S elevador` no dan nada). Lo que había, desde la
fase L (`8df3c4d`), era un «fundido» del lienzo al cambiar de piso, y **nunca funcionó**: `escena3d.js` ponía
`opacity = 0` y en el `requestAnimationFrame` siguiente la volvía a `""`. Las dos cosas pasaban antes de que el
navegador recalculara estilos, así que la transición CSS de 0.35 s no tenía de dónde a dónde animar. Medido en la MSI
con Edge: durante el cambio Compago → Ek Chuah la opacidad del lienzo se quedó en 1 todos los cuadros. Por eso el piso
nuevo «saltaba».

**Personajes inmóviles en «Un cuarto».** La escena sí los animaba (61 cps, 3 personajes animados por cuadro en
Evaluación de oportunidades), pero los bucles de un puesto sentado que no teclea casi no se movían. `reposo` movía la
cabeza 0.06 rad con un periodo de ~18 s y el torso 0.012 rad. `consultar` y `atencion` eran posturas casi fijas, y el
clip `sit` de Kenney es una pose fija. Solo `teclear` tenía movimiento visible, y solo se muestra con evidencia de
trabajo. En DEMO, en Oportunidades nadie teclea (investigación pendiente, datos insuficientes, sin actividad). Así que
la animación sí estaba implementada, pero **parcialmente**: tan sutil que no se veía.

## 2. Qué corregí

- **`transicion-piso.js` (nuevo, sin Three.js):** decide la transición y su pose.
  - **Otro proyecto: ascensor.** Al subir, el piso actual baja y se desvanece (0.38 s) y el nuevo llega desde arriba
    y frena al asentarse (0.72 s). Al bajar es al revés. Sube o baja según el orden de las pestañas. Funciona también
    en «Un cuarto» y hacia o desde pisos sin oficinas.
  - **«Un cuarto», otro departamento o cambio de modo:** entrada breve, en la que el cuarto sube 0.35 y aparece en
    0.45 s.
  - **Sin animación:** con datos nuevos del mismo piso, al pasar de DEMO a REAL, en la primera carga y al cambiar de
    departamento en el edificio (ahí la cámara ya viaja, como antes).
- **`escena3d.js`:**
  - Mueve el grupo del escenario (no la cámara, así el encuadre final es exacto) y la opacidad del lienzo, cuadro a
    cuadro.
  - Mientras dura la transición oculta las etiquetas HTML y las vuelve a colocar al terminar.
  - Un segundo cambio a media llegada termina la primera y empieza la nueva.
  - Quité el fundido roto y su regla CSS.
- **«Cámara instantánea» (nuevo interruptor en la barra 3D de escritorio; `?camara=instantanea`; se recuerda en
  `cauce.camara3d`):** sin viajes de cámara ni transiciones. «Reducir movimiento» del sistema hace lo mismo y, además,
  deja las posturas fijas, como ya lo hacía.
- **Vida mínima (`maquina.js` → `vidaEnReposo` y `aplicarVida`; la aplican `kenney.js` y el cuerpo provisional de
  `personaje.js`):**
  - Respiración visible (ciclo de ~4.5 s) y mirada que deambula (≤ 0.22 rad).
  - Cada 6–10 s un gesto corto (2.4 s): revisar la pantalla, voltear a un lado, acomodarse, girar un poco la silla
    (≤ 0.24 rad) o estirarse. Con la mano levantada («atención») se acomoda en lugar de estirarse.
  - Determinista por personaje: nadie se mueve al unísono.
  - **Sin tecleo:** en reposo, consultar, atención o relajado los brazos no golpetean. «teclear» y «alerta» solo suman
    la respiración.
- **Semántica intacta:**
  - No cambia qué bucle toca a cada puesto (eso sigue viniendo del núcleo y de la evidencia).
  - No cambia el contrato de datos.
  - Nadie pasa a «trabajando».
  - Las funciones de las estaciones siguen siendo funciones, no agentes.

## 3. Pruebas corridas (en la MSI)

| Prueba | Resultado |
|---|---|
| Pruebas unitarias completas (`pruebas.html` en Edge sin ventana; la MSI no tiene Node) | **435 pasaron, 0 fallaron** (12 nuevas en `pruebas/casos-vida-transicion.js`) |
| `pruebas/navegador/vida-transicion.cjs` (nuevo, Playwright) | **No se pudo correr con Node en la MSI.** Corrí sus mismas comprobaciones por DevTools en Edge sin ventana con la Intel UHD: **23 de 23 bien** |

Las 23 comprobaciones cubren:

- Ascensor al subir y al bajar: forma, duración de 1.1–1.2 s, terminación y etiquetas.
- Departamento del mismo piso sin transición.
- Entrada breve de «Un cuarto».
- Los tres personajes de Oportunidades se mueven en 6 de 6 muestras, sin teclear.
- 12 viajes de ascensor: geometrías 82 → 82, texturas 32 → 32, llamadas 89 → 89 y triángulos 16198 → 16198.
- «Reducir movimiento»: ni transición ni vida.
- «Cámara instantánea»: ni transición ni viajes, pero los personajes siguen vivos.

Pendiente de correr con Node: `vida-transicion.cjs` y la regresión completa `todas.cjs`.

## 4. Impacto en rendimiento

A/B en la MSI, mismo Edge sin ventana a 1366×768, Intel UHD (ANGLE D3D11), cada cuadro dibujado, 20 s por caso:

| Caso | Versión | cps prom. | cps mín. | s < 50 | Llamadas | Triángulos | Texturas | Geometrías |
|---|---|---|---|---|---|---|---|---|
| Compago, edificio | 8705538 | 60.6 | 60 | 0 | 89 | 16198 | 32 | 82 |
| Compago, edificio | nueva | 60.6 | 60 | 0 | 89 | 16198 | 32 | 82 |
| Ek Chuah, edificio | 8705538 | 60.7 | 60 | 0 | 71 | 12725 | 29 | 69 |
| Ek Chuah, edificio | nueva | 60.6 | 60 | 0 | 71 | 12725 | 29 | 69 |
| Compago, «Un cuarto» Oportunidades | 8705538 | 60.6 | 60 | 0 | 21 | 4339 | 15 | 22 |
| Compago, «Un cuarto» Oportunidades | nueva | 60.6 | 60 | 0 | 21 | 4339 | 15 | 22 |

- **Costo nuevo:** unas operaciones con senos por personaje y cuadro. No agrega llamadas, texturas, geometrías ni
  materiales.
- **Durante el ascensor (≈ 1.1 s):** se dibuja cada cuadro (antes también, porque había personajes a la vista) y nunca
  hay dos pisos a la vez. El piso nuevo se construye entre la salida y la llegada, igual que antes.
- **Límite de esta medición:** no es la serie oficial de `herramientas\medir-estaciones.bat` (ventana maximizada y
  preferencia de GPU). Es una comparación A/B en las mismas condiciones. Si quieres la cifra oficial, se corre esa serie.

## 5. Limitaciones pendientes

- **Construcción del piso nuevo:** tarda ~0.1–0.2 s en la MSI y se nota como un cuadro largo entre la salida y la
  llegada. Ya existía antes; con el ascensor queda escondido en el momento en que no se ve ningún piso.
- **Orden de los pisos:** el orden de las pestañas define cuál está «arriba». Si se quiere otro orden (por ejemplo,
  pendientes abajo), es un cambio de una línea en `app.js` (`ordenPisos`).
- **Celular:** no tiene el interruptor «Cámara instantánea» (no cabe en su barra). Se respeta «reducir movimiento» y
  funciona `?camara=instantanea`.
