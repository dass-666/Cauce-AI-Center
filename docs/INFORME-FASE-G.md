# Fase G: experiencia visual y validación final

Rama `fase-g/experiencia-visual`, encima de la fase F (PR #14). No hay nada fusionado ni desplegado. No se tocaron el contrato v1 ni otros proyectos.

## 1. Resumen de mejoras
- **Modo inmersivo** (⛶): el edificio ocupa toda la ventana.
  - Arriba queda una franja fija con REAL/DEMO, la conexión, la edad del dato y las Alertas, que se pueden abrir.
  - Los errores de conexión y el diagnóstico del archivo siguen visibles.
  - Se pueden elegir departamentos sin salir, con etiquetas, la lista o la barra del celular.
  - Se sale con «✕ Salir», con Esc (primero cierra el detalle y luego vuelve al piso) o al pasar al plano.
  - No usa la pantalla completa del navegador.
- **Celular vertical**: los estados se leen con su nombre («1 trabajando», «1 error»…) en lugar de los símbolos ⚙ ✓ ! … – ?. La franja DEMO ya no se corta con «…». El aviso grande «7 puesto(s) sin personaje…» ahora es una pastilla de una línea («7 sin personaje»); el texto completo queda en el título y para lectores de pantalla. Pestañas y botones miden al menos 36 px. «Actualizar» se muestra como el icono ↻ (su nombre se conserva para accesibilidad).
- **Celular horizontal**: el edificio se dibuja al doble de tamaño. La insignia DEMO repetida en la escena se quitó porque la del tablero queda fija justo encima, y la pastilla del aviso ya no recorta la franja superior. Los estados se ven como punto de color con número, todos en una fila.
- **Escritorio**: sin cambios de diseño fuera del modo inmersivo. Solo se agregaron el botón ⛶ y transiciones suaves de 0.15 s en los bordes.

## 2. Capturas antes y después
En la carpeta del proyecto `cauce/fase-g/antes/` y `cauce/fase-g/despues/` (no van en git), con el mismo nombre de archivo: `escritorio-3d`, `escritorio-grande-3d`, `celular-vertical-3d`, `celular-horizontal-3d` y `*-plano`. Las capturas del modo inmersivo (`*-inmersivo`, `inmersivo-*-detalle`, `inmersivo-diagnostico`) solo existen en `despues/`. El recuadro verde de cifras que se ve en algunas capturas es el modo de medición `?medir=1` y no aparece en uso normal.

## 3. Resultados de pruebas
Todo pasó con el código final, sin ninguna falla:
- Node: 166/166. `pruebas.html` en Chromium: 166/166.
- Chromium: regresión 47, animaciones 15, estabilidad 15 (DEMO/REAL, caducidad, reconexión), memoria 4, móvil 16 (vertical y horizontal), brillo 3, naturaleza OK, extremo a extremo con Compago PR #10 9/9 y multiproyecto 6.
- Nuevas: **inmersivo 34** (escritorio, error de conexión, diagnóstico, celular vertical y horizontal, Esc, foco, 10 entradas y salidas sin fugas, plano) y **auditoría visual 20** (4 pantallas en 3D y en plano: sin desplazamiento horizontal, sin etiquetas encimadas, sin textos cortados y todos los controles con nombre accesible).
- Cambié una sola prueba existente, `regresion.cjs`. Antes pedía la insignia DEMO dentro de la escena en horizontal; ahora acepta la del tablero, que queda fija justo encima. Lo hice porque quité esa insignia a propósito para dar alto al edificio.

## 4. Mediciones antes y después (Chromium con SwiftShader; los cps no representan tu Intel UHD)
| Pantalla | Cuartos en pantalla antes | después | inmersivo |
|---|---|---|---|
| Escritorio 1366×768 | 23 % | 23 % | **40 %** |
| Escritorio 1920×1080 | 30 % | 30 % | **44 %** |
| Celular vertical (iPhone 12) | 19 % | 19 % | 20 % |
| Celular horizontal | 6 % | **13 %** | **29 %** |

| Celular | Lienzo libre al abrir antes → después | Con el detalle abierto antes → después |
|---|---|---|
| iPhone 12 vertical | 53 % → 57 % | 30.6 % → 34.4 % |
| Android 360×640 | 53 % → 53 % | 30.6 % → 34.4 % |
| Horizontal | 63 % → 63 % | 31.8 % → 31.8 % |

- **Costo gráfico**: no cambió, porque no se tocó ningún modelo, material ni luz. Compago sigue en 156 llamadas, 6 243 triángulos, 156 geometrías y 18 texturas, igual en el modo inmersivo. Entrar y salir 10 veces no acumula nodos (162→162).
- **Escalabilidad**: idéntica a la fase F en los 23 proyectos. Por ejemplo, 50 deptos × 3 sigue en 1 424 llamadas y 30 cambios de proyecto no acumulan geometrías ni texturas.
- **Memoria**: la memoria JS es ruido del recolector y oscila entre 19 y 33 MB según la corrida (antes, entre 18 y 28 MB). No crece con 30 cambios de proyecto (26 → 23 MB). La memoria de la GPU no se puede leer desde el navegador.
- **Límite**: el modo inmersivo dibuja más píxeles, por ejemplo 1366×768 en lugar de 1332×556 en escritorio. En una GPU integrada el costo por píxel puede bajar los cps. Eso solo se mide en tu equipo (paso 1 de la guía).

## 5. Problemas corregidos (todos medidos con `pruebas/navegador/auditoria-visual.cjs`)
1. En celular vertical, la franja DEMO y el motivo se cortaban con «…». Ahora hay 0 textos cortados (antes 1).
2. En celular horizontal, el edificio ocupaba el 6 % de la pantalla. La causa era que el aviso de dos líneas y la insignia repetida reducían el área de encuadre. Ahora ocupa el 13 %.
3. Las pestañas de proyecto medían 28 px en celular y ahora miden 36 px.
4. Los estados se mostraban con símbolos sin texto en celular. Ahora vertical usa palabras y horizontal usa puntos de color.
5. No había una forma de dar prioridad al edificio. Ahora existe el modo inmersivo.
6. Errores que encontré y corregí durante la auditoría final:
   - El aviso corto dejaba sin texto a los lectores de pantalla.
   - «Salir» tenía `aria-pressed`, que no corresponde a un botón de acción.
   - En el modo inmersivo, el diagnóstico de errores del archivo quedaba oculto detrás del edificio.
   - Una regresión mía en horizontal: los controles pasaron de 35 a 49 px de alto y el espacio libre con el detalle abierto bajó a 29.2 %. Lo corregí y volvió a 31.8 %.

## 6. Limitaciones pendientes
- **Celular vertical**: el edificio sigue en 19–20 % de la pantalla. El ancho del celular es el que limita, por la forma de rombo de la vista isométrica, no los controles. Se arreglaría girando la cámara en vertical, pero cambiaría la vista que ya validaste, así que no lo hice sin preguntarte.
- **Celular horizontal**: los botones de la cabecera miden 28 px. Es menos que los 36 px de vertical porque ahí la altura es muy escasa, aunque está por encima del mínimo de 24 px de WCAG 2.2.
- **Etiquetas de departamento**: miden menos de 32 px en celular. Para tocar es más cómoda la barra inferior ◀ ▾ ▶, que sí mide 46 px.
- **Modo inmersivo**: no permite cambiar de proyecto. Hay que salir primero, porque las pestañas se ocultan a propósito.
- **Sin probar**: el rendimiento real en el Intel UHD, el táctil físico, el mouse real y la apariencia en tu monitor.

## 7. Guía de validación final para Windows
`docs/VALIDAR-FASE-G.md` (4 pasos, unos 15 minutos).
