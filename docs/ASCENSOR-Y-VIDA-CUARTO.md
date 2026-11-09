# Ascensor entre pisos y vida en «Un cuarto» · PR #35 (versión A, borrador) · 2026-11-09

Rama `claude/ascensor-y-vida-cuarto`, base PR #34. Commits:

- 10296e4: integra el PR #29.
- d9512df: vida en reposo y fundido.
- adf51ef: recorrido medido.

**No se fusionó ni se desplegó nada, y no se tocó ningún otro repositorio.** La rama `claude/project-thread-l7uvsf` de tu MSI queda como respaldo: no se borró ni se mezcló.

## 1. Causa raíz (comprobada)

- **Ascensor: no se perdió; nunca llegó a esta rama.** Vive en el PR #29, que no está fusionado. Ni `main` ni el #34 lo contenían (`git merge-base --is-ancestor`).
- **Personajes inmóviles: la animación estaba solo a medias.**
  - La respiración era de milímetros.
  - «Atención» estaba totalmente fija.
  - El fundido al cambiar de cuarto o de piso **nunca se veía** desde la fase L: la opacidad bajaba con la transición puesta y volvía en el cuadro siguiente.

## 2. Qué se corrigió y añadió

1. **Ascensor del #29 integrado tal cual.**
   - Al cambiar de piso, la cámara sube o baja durante 0.6–0.9 s.
   - Dentro del mismo piso no hay ascensor.
2. **Vida en reposo** (`faseVida`, en `maquina.js`): un ciclo determinista en el que el personaje mira la pantalla, voltea a un lado, gira la silla y se acomoda.
   - Solo afecta a personajes sentados en reposo, consultar o atención.
   - **Nunca teclea** y nunca cambia el estado.
3. **Fundido que sí se ve**, más un acercamiento breve de la cámara al entrar a «Un cuarto».
4. **«Cámara instantánea» y «reducir movimiento»** quitan el fundido, el zoom y el ascensor. «Reducir movimiento» además deja quietas las posturas.
5. **Recorrido medido** (`?medir=1&recorrido=1`, `herramientas\medir-recorrido.bat`).
   - La página se maneja sola con sus propios botones y registra cada cuadro: tiempo, corrimiento de la cámara, velo y posición del edificio en pantalla.
   - `?vida=0` apaga la vida para medir cuánto cuesta.
6. Los contratos `cauce.estado-proyecto` 1.0.0 y `cauce.estaciones` 0.1.0 quedaron **sin cambios**.

## 3. Pruebas

- **Node: 445 pasaron, 0 fallaron.** En **Edge de tu MSI**, `pruebas.html` dio también 445/0.
- **Chromium (SwiftShader):**
  - `ascensor.cjs` 32/32;
  - `vida-cuarto.cjs` 10/10;
  - `recorrido.cjs` 10/10;
  - **batería completa sobre adf51ef: 34/34 guiones en verde**.

## 4. Medido en tu Intel UHD

Condiciones: Edge 157, «Intel UHD Graphics 0x9A68, Direct3D11», ventana de 1224×636 y una corrida de cada caso.

| Tramo | Con vida en reposo | Sin vida (`?vida=0`) |
|---|---|---|
| «Un cuarto» quieto 20 s (Compago › Oportunidades) | **60.6 cps**, peor cuadro 16.8 ms | 60.6 cps, 17.3 ms |
| Cambios de cuarto (16) | **60.5 cps**, peor cuadro 33 ms, sin ascensor | 60.6 cps, 32.9 ms |
| Viajes de ascensor (10) | **57.6 cps** de promedio durante el viaje, peor cuadro 99 ms | 57.1 cps, 115.5 ms |
| Ascensor desde «Un cuarto» (2) | 60.6 cps, 16.6 ms | 60.6 cps, 16.6 ms |
| Edificio quieto 10 s | 59.6 cps (2 cuadros de hasta 99 ms) | 60.6 cps, 16.7 ms |

- **La vida en reposo no tiene un costo medible** en «Un cuarto».
  - En el edificio quieto, la pasada con vida tuvo 2 cuadros lentos que la otra no tuvo.
  - Con una sola corrida no se puede atribuir eso a la vida ni descartarlo. Habría que repetir la medición.
- **Cada viaje de ascensor tiene casi siempre un cuadro lento** (50–115 ms) cuando se arma el piso nuevo.
  - Pasa igual con o sin vida, y ocurre con el velo puesto.
  - Es la «pausa al llegar» del #29, ahora medida en la UHD: unos 0.1 s, no los 300–600 ms del simulador.
- **Fugas:**
  - Geometrías 86→86→86 y texturas 34→34→34 después de la 1.ª vuelta.
  - La 1.ª visita a CSI guarda texturas compartidas (82→86, 32→34), y luego ya no sube.
  - Memoria JS 28–29 MB, estable.

## 5. ¿El ascensor sube y baja de verdad?

- **Sí.** La herramienta registró los 10 viajes como graduales: el corrimiento pasa por 9–16 valores intermedios, y el edificio se movió **131–199 px en pantalla** antes de que el velo lo tapara.
- En las capturas de tu pantalla, tomadas cada ~165 ms:
  - el edificio baja unos 110 px al subir de Ek Chuah a Montambre;
  - sube al bajar a Compago;
  - después aparece el velo «▲ Piso 4 · Montambre» o «▼ Piso 1 · Compago».
- **Limitación de diseño (opinión):** la parte visible del movimiento es corta, menos de ~0.3 s antes del velo. Es un desplazamiento de cámara con cortina, no un viaje por un edificio con los pisos intermedios a la vista. Si al probarlo te parece poco, la mejora barata es retrasar el velo para que se vea más recorrido. Cuesta poco, pero lo tienes que decidir tú.

## 6. Hallazgo nuevo (no corregido)

Al cambiar de proyecto, la franja de encabezado («DATOS DE DEMOSTRACIÓN» / «Sin conexión») cambia de alto y mueve todo el lienzo unos 25–50 px.

- No es del ascensor.
- Se nota justo durante el viaje.
- Gravedad baja-media (visual).
- Solución propuesta: reservar un alto fijo para esa franja.

No lo cambié sin tu visto bueno.

## 7. Dependencia con el PR #29

- El #35 contiene **todo** el #29, sin cambios propios sobre sus archivos.
- Si se fusiona el #35 (después del #34), el #29 queda incluido y se cierra como incluido.
- Si se fusiona antes el #29, el #35 se fusiona igual sin duplicar nada, porque son los mismos commits.

## 8. Abrir la versión A en tu MSI

Tu copia local sigue en `claude/project-thread-l7uvsf`, limpia, y no se cambió. La versión A está **aparte**, en `C:\Users\MSIGF\Cauce-AI-Center-A` (adf51ef, sin cambios).

```bat
cd C:\Users\MSIGF\Cauce-AI-Center-A
git fetch origin claude/ascensor-y-vida-cuarto
git checkout --detach origin/claude/ascensor-y-vida-cuarto
python servir.py --puerto 8766
```

Se abre `http://127.0.0.1:8766/` (8766 para no chocar con tu servidor de 8765, que sirve la otra rama).

Qué probar:

1. **Ascensor:** en la barra de pisos, cambia de Compago a Ek Chuah y luego a CSI. El edificio sube o baja, aparece «▲ Piso N» y llega el piso nuevo.
2. **Mismo piso:** cambia de departamento. No hay ascensor; hay un fundido breve.
3. **«Un cuarto»:** Compago › Evaluación de oportunidades. Míralos unos 30 s: miran la pantalla, voltean, giran la silla y se acomodan. Ninguno teclea.
4. **«Cámara instantánea»:** marca la casilla. Los cambios son inmediatos y los personajes siguen moviéndose.
5. Para medir otra vez: `herramientas\medir-recorrido.bat`, unos 6 minutos sin tocar nada.
