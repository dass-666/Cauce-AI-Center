# Ascensor virtual entre pisos (bloque D)

Rama `claude/project-thread-69w6z9`, PR en borrador, independiente del Laboratorio (PR #27). **Sin fusionar.**

## Qué hace

Cada proyecto es un piso del edificio, en el orden de `datos/proyectos.json`: el primero (Compago) es el **piso 1**,
abajo; Ek Chuah el 2, Tezcatlipoca el 3, Montambre el 4, CSI el 5, CauceService el 6 y Repacar el 7. Es una
convención nueva de esta mejora (antes los pisos no tenían número). Si se reordena el registro, cambia el sentido.

Al pulsar la pestaña de otro piso en la vista 3D:

1. **Salida** (mitad del viaje): la cámara se aleja del piso actual hacia arriba (si el destino es superior) o hacia
   abajo, acelerando. Un velo del color del fondo va tapando la escena y aparece el letrero `▲ Piso 2 · Ek Chuah`.
2. **Cambio de escena**: se construye el piso nuevo cuando el velo ya está opaco (no se ve el salto).
3. **Llegada** (otra mitad): la cámara llega al piso nuevo desde abajo (si sube) o desde arriba, frenando, y el velo
   se retira. Termina con el encuadre de siempre del piso.

Duración total: 0.6 s para un piso, +0.1 s por piso extra, máximo 0.9 s (`duracionAscensor` en
`app/vistas/vista3d/ascensor.js`; es la única cifra que hay que tocar para ajustarla tras probarla). Las dos mitades
duran lo mismo y las curvas están elegidas para que la velocidad no salte al cambiar de escena (probado en Node).

## Cómo está hecho (y qué no hace)

- **No mueve la geometría ni la cámara de OrbitControls.** El viaje es un corrimiento vertical de la proyección
  ortográfica (`camara.top/bottom`). En una proyección paralela, subir la cámara en vertical equivale exactamente a
  correr la imagen en vertical, así que el efecto es «la cámara sube» sin tocar el objetivo de los controles, los
  límites, el historial de vistas ni el encuadre. Por eso la cámara manual, «Centrar», «Vista anterior», la
  recepción, seguir a un personaje y el giro siguen igual.
- **No atraviesa paredes**: con la proyección paralela no hay plano cercano que corte los muros.
- **Dentro del mismo piso no hay ascensor**: cambiar de departamento o de bot usa el viaje lateral de la fase M.
- **Plano 2D**: cambio de piso directo, como antes.
- **Un solo viaje a la vez** (una máquina de estados, sin bucle propio: avanza dentro del ciclo de dibujo existente).
  - Otro piso en el mismo sentido a media salida: el mismo movimiento sigue, solo cambia el destino.
  - Otro piso en sentido contrario, o mientras se llega: un viaje nuevo que parte de la posición actual (sin saltos).
  - Volver a pulsar el piso actual a media salida: la cámara regresa a él sin cambiar de escena (cancelación).
  - Si el piso nuevo no llega en 4 s, el velo se quita y el viaje termina (no se queda la pantalla tapada).
- **Sala de control**: si está abierta (vista en pausa), el cambio es directo.
- **Piso sin oficinas** (Tezcatlipoca, CauceService, Repacar): el velo se retira sobre su aviso de pendiente.
- **Selección**: al cambiar de piso se limpia como antes (no se lleva un departamento de otro piso).
  «Edificio / Un cuarto» conserva la selección y no activa el ascensor.

## Accesibilidad

- `prefers-reduced-motion: reduce` del sistema: sin ascensor (cambio instantáneo), igual que el resto de viajes de
  cámara.
- Opción nueva **«Cámara instantánea»** en la barra de la vista 3D (en celular: menú ⋯ → Cámara). Quita el ascensor y
  los viajes de cámara; los personajes no cambian. Se guarda en `localStorage` (`cauce.camara3d`).
- El velo y el letrero son `aria-hidden`: el cambio de piso ya lo anuncian las pestañas (`role="tab"`).

## Rendimiento

Sin dependencias, sin sombras, sin pasadas de dibujo nuevas. El velo es un `div` con opacidad (lo compone el
navegador, no WebGL). Durante el viaje se dibuja cada cuadro, igual que en cualquier movimiento de cámara; el resto
del tiempo, el ahorro por escena quieta sigue igual. La construcción del piso nuevo es la misma de antes.

Dos ajustes para que el cambio de escena no cueste más que antes: con el velo opaco no se dibuja (no se ve nada),
y el piso nuevo se arma en un cuadro y se dibuja en el siguiente, con todos sus sombreadores preparados de una vez
(`renderer.compile`), porque con la vista corrida three.js los prepararía a destiempo, cuando cada mueble entra en
cuadro.

**No hay medición en Intel UHD.** Lo medido en este contenedor es Chromium con SwiftShader (la CPU hace de tarjeta
gráfica); sirve para comparar trabajo, no cuadros por segundo reales:

| Medida (SwiftShader, 1366×768, DEMO) | main | esta rama |
|---|---|---|
| Llamadas de dibujo, edificio Compago quieto | 97 | 97 (igual durante el viaje) |
| Tiempo de JavaScript al llegar a Compago (perfil de 3.5 s) | ~0.19 s | ~0.18 s |
| Peor cuadro al cambiar Ek Chuah ↔ Compago | 100–217 ms | 133–217 ms al llegar a Ek Chuah; **300–600 ms al llegar a Compago** |

**Riesgo abierto:** al llegar a Compago, SwiftShader muestra un cuadro lento (300–600 ms) unos 3 cuadros después
de terminar el viaje, que en `main` es de ≤ 217 ms. El perfil de JavaScript es igual en las dos versiones, así que
el tiempo se va en el proceso gráfico de SwiftShader; no se encontró la causa en este contenedor y no se puede saber
si ocurre en la Intel UHD. Hay que medirlo en la MSI (paso 7 de abajo); si se nota un tirón al llegar, el arreglo
más simple es la opción «Cámara instantánea» mientras se investiga.

## Pruebas

- Node y `pruebas.html`: `pruebas/casos-ascensor.js` (sentido, duración, continuidad de velocidad, velo, redirección,
  regreso, cancelación, espera agotada, movimiento reducido, y que no hay bucle propio ni geometría movida).
- Chromium: `pruebas/navegador/ascensor.cjs` (subir, bajar, saltar varios pisos, mismo piso por departamento y por
  bot, redirigir a media salida, ráfaga de 5 cambios, ciclos de dibujo sin duplicar, cancelación, piso sin oficinas,
  Edificio / Un cuarto, alternar modo a media salida, selección, sala de control, plano 2D, «Cámara instantánea»,
  `prefers-reduced-motion`, celular y ausencia de errores de JavaScript).

## Cómo verlo en la MSI

1. En `C:\Users\MSIGF\Cauce-AI-Center` (Git Bash o PowerShell):
   `git fetch origin` y `git checkout claude/project-thread-69w6z9` (si `git status` muestra cambios locales, no
   continuar: avisar).
2. Ejecutar `iniciar.bat` y abrir `http://127.0.0.1:8765/` en Edge (vista 3D, Edificio).
3. Pulsar **Ek Chuah** estando en Compago: la cámara debe subir. Pulsar **Compago**: debe bajar. Pulsar **CSI**
   desde Compago: sube 4 pisos (un poco más largo, máximo 0.9 s).
4. Pulsar **Ek Chuah** y enseguida **Montambre**: un solo viaje que termina en Montambre.
5. Dentro de un piso, teclas 1–9 o los botones de bot: no debe haber ascensor, solo el viaje lateral de siempre.
6. Marcar **Cámara instantánea**: los cambios de piso son directos. Desmarcarla para volver a animar.
7. Rendimiento: abrir `http://127.0.0.1:8765/?medir=1`, cambiar de piso varias veces y, ya quieto, pulsar
   «Copiar medición» con el edificio completo y brillo apagado. Referencia previa: 60–61 cps en Intel UHD. Recordar
   que la MSI tiene dos tarjetas (GTX 1650 + Intel UHD): el texto copiado dice cuál usó Edge.
8. Para ver todas las pruebas en el navegador: `http://127.0.0.1:8765/pruebas.html` (deben salir 409 de 409).
