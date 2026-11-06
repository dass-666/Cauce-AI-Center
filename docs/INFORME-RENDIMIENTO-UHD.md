# Informe: rendimiento para Intel UHD (rama local `rendimiento-uhd/optimizar`, sobre la fase L)

Fecha: 2026-11-06. Base: fase L (`fase-l/animacion-oficina-portal`, commit `f9b83e7`, PR #21 en borrador).
**No se publicó nada**: la rama existe solo como commits locales y en el archivo `cauce-rendimiento-uhd.bundle`.
No se tocó `main`, el contrato v1, los datos, los exportadores, otros repositorios ni el trabajo de Ronny.

## 1. Resumen en cuatro líneas

1. **Hecho medido**: el brillo anterior (UnrealBloom) agrega **14 pasadas de pantalla completa** por cuadro y
   procesa 2.35 megapíxeles extra (5.28 con la pantalla al 150 %). Es la causa más probable de tu caída de 60 a 29 cps.
2. **Cambio**: nuevo **brillo ligero** (por defecto al encender Brillo): 3 pasadas, **−65 % de píxeles de
   posproceso**, conserva el suavizado de bordes. El anterior sigue disponible con `?brillo=completo`. Brillo
   sigue **apagado por defecto** y se puede apagar igual que antes.
3. **Cambio**: si nada se mueve (por ejemplo Montambre o un piso REAL sin evidencia vigente), la escena ya
   **no se redibuja 60 veces por segundo**: de 29 a 1 cuadro por segundo en la prueba, −77 % de JavaScript.
4. **No medido en tu equipo**: tus FPS con estos cambios. Dejé una herramienta que compara la versión
   anterior y la nueva en tu Intel UHD (`herramientas\comparar-fps.bat`, guía en `docs/VALIDAR-RENDIMIENTO-UHD.md`).

## 2. Qué se auditó y qué se encontró

Código revisado: `app/vistas/vista3d/` completo (escena, brillo, oficina, arquitectura, personajes Kenney,
etiquetas, minimapa, medidor) y las pruebas existentes (251 Node + 21 scripts de Chromium).

| Posible fuente de consumo | ¿Hay evidencia de problema? | Decisión |
|---|---|---|
| **Brillo completo (UnrealBloom)**: copia de la escena en coma flotante + 14 pasadas + sin suavizado | **Sí**: 14 pasadas y 2.35 MP extra por cuadro (medido); en SwiftShader los cps bajan 64 %; tú mediste 60 → 29 | Brillo ligero nuevo; el completo queda para comparar |
| **Redibujar una escena sin cambios** (60 veces por segundo sin personajes) | **Sí**: 29 cuadros/s idénticos en un piso REAL vencido (medido) | No redibujar si nada se mueve (con seguro de 1 vez/s) |
| Etiquetas HTML recolocadas en cada cuadro aunque la cámara no se mueva | Pequeña: ~1 recálculo de estilos por cuadro | Solo se recolocan si la cámara o el espacio libre cambian |
| Material PBR de los personajes Kenney (MeshStandardMaterial) | **Débil**: +5 % en SwiftShader con el personaje a pantalla grande; en vista normal no se nota | Cambiado a Lambert (mismo color y textura; `?pbr=1` vuelve al original) |
| Sombras dinámicas, luces puntuales, materiales PBR en el edificio | **No existen**: el edificio usa 1 luz hemisférica + 1 direccional, materiales Lambert/Basic y sombras falsas (texturas) | Sin cambios |
| Llamadas de dibujo del edificio (83 con Compago DEMO) | No: ya se redujeron de 159 a 83 en la fase L (muebles unidos) | Sin cambios |
| Procesador (JavaScript) | No: ~1 ms por cuadro; 1 recálculo de diseño (layout) por segundo | Sin cambios grandes |
| Densidad de píxeles (hasta 2 en escritorio) con suavizado | **Riesgo no medido**: con Windows al 150 % se dibujan 2.25 veces más píxeles | Opción de diagnóstico `?px=1`; no cambié el valor por defecto |
| Memoria (texturas/geometrías) | No: encender/apagar el brillo 6 veces no acumula texturas (prueba) | Sin cambios |

## 3. Cambios (todos en `app/vistas/vista3d/`)

1. **`brillo.js` + `brillo-tipo.js` (nuevo)**: dos tipos de brillo.
   - *Ligero* (por defecto): la escena se dibuja directo en pantalla como sin brillo; solo los objetos que no
     reciben luz (pantallas, letreros, placas, anillos, torreta, franja de luz del pasillo) se dibujan otra vez en
     una imagen de 1/4 × 1/4 (1/16 de píxeles), se desenfoca (2 pasadas pequeñas) y se suma encima (1 pasada).
     Las ventanas y las sombras falsas no brillan (`userData.sinBrillo`).
   - *Completo*: exactamente el UnrealBloom anterior, con `?brillo=completo` (queda guardado).
   - El interruptor **Brillo** sigue igual, apagado por defecto, y en celular no aparece (como antes).
2. **`ciclo.js` (nuevo) + `escena3d.js`**: «escena quieta». Se dibuja solo si la cámara cambió o se anima, si
   algo pidió redibujar (datos, selección, tamaño, luz, brillo) o si algún cuarto tiene movimiento (personaje a la
   vista, entrando o saliendo, o torreta que parpadea). Seguro: al menos una vez por segundo. `?quieta=0` lo apaga.
   Con personajes a la vista (la DEMO de Compago) se dibuja cada cuadro, igual que antes.
3. **`escena3d.js`**: las etiquetas de departamento solo se recolocan si la cámara o la zona libre cambian;
   la zona libre ya no se recalcula en cada cuadro (se usa la calculada cada 300 ms).
4. **`kenney.js`**: personajes con MeshLambertMaterial (misma textura y color). `?pbr=1` usa el original.
5. **`tiempo-gpu.js` (nuevo, solo con `?medir=1`)**: el recuadro del medidor muestra **ms de tarjeta gráfica por
   cuadro** si el navegador ofrece `EXT_disjoint_timer_query_webgl2` (si no, dice «no disponible»).
6. **`?px=`** (solo diagnóstico): fija la densidad de píxeles (0.5–2).
7. **Herramientas**: `herramientas/comparar-fps.html` + `comparar-fps.bat` (A/B en tu equipo, alternando versiones)
   y `pruebas/navegador/rendimiento.cjs` (mide el trabajo por cuadro de cualquier versión, envolviendo WebGL).

Sin dependencias nuevas: todo usa three.js r187 que ya estaba en `vendor/`.

## 4. Mediciones en el contenedor (SwiftShader, 1366×768) — NO son tus FPS

SwiftShader dibuja con la CPU. Lo válido para comparar es el **trabajo por cuadro** (llamadas, pasadas, píxeles
de posproceso, cuadros redibujados, JavaScript), que no depende de la tarjeta. Los cps de SwiftShader solo indican
la dirección del cambio. Misma máquina, mismo script (`pruebas/navegador/rendimiento.cjs`), versión anterior en el
puerto 8766 y nueva en el 8765.

| Escenario | Llamadas | Pasadas pantalla completa | MP de posproceso por cuadro | Cuadros dibujados/s (SwiftShader) | JS ms/s |
|---|---|---|---|---|---|
| Edificio sin brillo | 83 → 83 | 0 → 0 | 0 → 0 | 28.5 → 29.3 | 30.2 → 29.2 |
| Edificio enfocado | 64 → 64 | 0 → 0 | 0 → 0 | 26.1 → 24.7 | 27.3 → 25.0 |
| Un cuarto | 13 → 13 | 0 → 0 | 0 → 0 | 50.8 → 51.8 | 20.4 → 20.4 |
| **Edificio con brillo** (anterior: completo; nueva: ligero) | 97 → 117 | **14 → 3** | **2.35 → 0.83** | **10.3 → 20.5** | 17.3 → 37.6 |
| **Un cuarto con brillo** | 27 → 20 | **14 → 3** | **2.35 → 0.83** | **11.8 → 30.0** | 12.9 → 23.6 |
| **Edificio con brillo, pantalla al 150 %** | 97 → 117 | 14 → 3 | **5.28 → 1.88** | **5.2 → 11.7** | 11.7 → 30.2 |
| Edificio con brillo completo en ambas (control) | 97 → 97 | 14 → 14 | 2.35 → 2.35 | 10.3 → 10.0 | 17.3 → 17.4 |
| Edificio sin brillo, pantalla al 150 % | 83 → 83 | 0 → 0 | 0 → 0 | 17.7 → 17.2 | 28.3 → 29.4 |
| **Piso REAL vencido (nadie se mueve)** | 77 → 77 | 0 → 0 | 0 → 0 | **29.2 → 1.0** | **29.9 → 6.9** |
| Celular (390×844) | 83 → 83 | 0 → 0 | 0 → 0 | 30.2 → 30.1 | 33.1 → 30.9 |

Lectura honesta:
- Sin brillo **no cambió nada medible** (las diferencias de ±1–2 cps son ruido): no había nada que arreglar ahí
  según la evidencia, y tú ya medías ~60 cps.
- Con brillo ligero el JavaScript por segundo sube porque se dibujan **el doble de cuadros**; por cuadro baja.
  Las llamadas suben en 34 (los objetos que brillan se dibujan otra vez, muy pequeños): costo de CPU bajo.
- Personajes Lambert contra PBR (acercamiento máximo, 2 repeticiones): 20 → 21 cps en SwiftShader. Diferencia
  pequeña; la incluyo porque no cambia el aspecto (comparé capturas) y compila un programa de sombreado más sencillo.

**Hipótesis (no verificada)**: la Intel UHD comparte memoria con el procesador y suele estar limitada por píxeles
y ancho de banda, no por cantidad de objetos. Por eso espero que con el brillo ligero pases de ~29 a cerca de
55–60 cps, pero solo tu medición lo confirma.

## 5. Edificio Compago con 8 departamentos

- Compago DEMO ya tiene **8 departamentos**: 7 con lugar en `escena/compago.json` y **UNIQ acomodado
  automáticamente** en una tercera fila (junto a la recepción). Se comprobó que los 8 no se enciman (prueba Node).
  No cambié la distribución: es una decisión de diseño (Importación ocupa 2 celdas). Si quieres a UNIQ en la
  cuadrícula, basta agregar su posición en `escena/compago.json` (no toca el contrato).
- Carga al crecer (8 departamentos, todos trabajando, SwiftShader; igual en la versión anterior y la nueva):

  | Agentes por departamento | Personajes visibles | Llamadas | Triángulos | Texturas |
  |---|---|---|---|---|
  | 1 | 4 | 94 | 12 146 | 30 |
  | 3 | 12 | 142 | 22 586 | 50 |
  | 6 | 24 | 214 | 38 672 | 76 |

  Cada puesto suma ~1 llamada (pantalla) y cada personaje visible ~3 (dos mallas + anillo). 214 llamadas y
  39 000 triángulos siguen siendo poco para una Intel UHD. **Conclusión**: la arquitectura actual soporta los 8
  departamentos sin cambios; agrupar pantallas o personajes (instancias) solo convendría con muchos más agentes.

## 6. Pruebas ejecutadas (en el contenedor)

- **Node**: 257 pasaron, 0 fallaron (251 de antes + 6 nuevas en `pruebas/casos-rendimiento.js`: tipos de brillo,
  tamaño reducido, qué materiales brillan, decisión de redibujar, 8 departamentos sin encimarse, que el
  interruptor de brillo y «Un cuarto» sigan).
- **Chromium (SwiftShader)**: **23/23 scripts en verde** (`node pruebas/navegador/todas.cjs`, ~35 min): los 21
  de antes (regresión, animaciones, fase K y L, inmersivo, celular, memoria, Ek Chuah, Compago PR #10…) más
  `rendimiento-uhd.cjs` (29 comprobaciones: brillo ligero/completo y su liberación de memoria, escena quieta,
  cámara, etiquetas, selección, Retroceso, Un cuarto, WebGL perdido, `?px=`, celular) y `rendimiento.cjs`.
  `pruebas.html` en Chromium: 257 = 257 de Node.
  - La **primera** corrida completa dio 22/23: `regresion.cjs` encontró que, con la escena quieta, el recuadro de
    `?medir=1` seguía mostrando la vista anterior al pasar a «Un cuarto». Lo corregí (el recuadro se actualiza
    cada 0.5 s aunque no se redibuje) y la segunda corrida completa quedó 23/23.
- **Herramienta de comparación** (`herramientas/comparar-fps.html`) probada en Chromium contra la copia de la
  fase L: corre los escenarios alternando versiones y produce la tabla para copiar. En SwiftShader la columna
  «GPU ms» sale 0 o vacía (ese reloj no es real ahí): en tu Chrome/Edge con Intel UHD **no sé todavía** si el
  navegador lo ofrece; si no, dirá «—» y los cps siguen valiendo.
- **Capturas**: brillo apagado / ligero / completo, noche con brillo ligero, personaje PBR contra Lambert,
  edificio con 48 puestos.

## 7. Riesgos de rendimiento y limitaciones

| Riesgo | Gravedad | Qué hacer / cómo comprobar |
|---|---|---|
| Tus FPS reales con brillo ligero **no están medidos** | Alta (es lo que importa) | `herramientas\comparar-fps.bat` y pegar resultados |
| Densidad de píxeles: con Windows al 125–150 % se dibujan 1.56–2.25 veces más píxeles | Media | Medir con y sin `&px=1`. Si sube mucho, propongo bajar el máximo a 1.5 o ajustar solo |
| El brillo ligero **se ve distinto** al completo: ya no resplandecen muros ni pisos claros, solo letreros, pantallas y luces | Baja (estética) | Compárelo a ojo; la fuerza es un número (`fuerza: 0.75` en `brillo.js`) |
| El brillo ligero no lo tapan muros ni personajes (no hay oclusión) | Baja | En vista isométrica casi no se nota; corregirlo costaría otra pasada |
| «Escena quieta»: una animación futura que no avise que se mueve se vería a 1 cuadro por segundo | Media (para el futuro) | Regla en `ciclo.js` y `enMovimiento()`; prueba de navegador; `?quieta=0` para descartarlo |
| `EXT_disjoint_timer_query_webgl2` puede no estar disponible | Baja | El medidor dice «no disponible»; los cps siguen sirviendo |
| Personajes Lambert sin brillo especular | Muy baja | `?pbr=1` para comparar |
| Muchos personajes (≥ 50 visibles) | Baja hoy | ~3 llamadas por personaje; instanciar si algún día hace falta |
| Medidas en SwiftShader ≠ Intel UHD | — | Por eso todas las cifras de este informe son de trabajo, no tus FPS |

## 8. Qué sigue (recomendación)

1. **Ahora**: que midas con la herramienta (15 min). Con eso decidimos si el brillo ligero queda, si hay que
   ajustar la densidad de píxeles y si conviene publicar la rama (PR sobre #21).
2. **Después, solo si tu medición lo pide**: limitar densidad de píxeles a 1.5 en pantallas grandes, o calidad
   automática (bajar resolución si los cps caen de 50 sostenidos).
3. **No recomiendo ahora**: instanciar personajes o unir pantallas (no hay evidencia de que haga falta).
