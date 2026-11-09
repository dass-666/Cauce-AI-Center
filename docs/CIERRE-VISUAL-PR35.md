# Cierre visual del PR #35 · 2026-11-09

Commits **e97829b** y **003d9c2** en `claude/ascensor-y-vida-cuarto` (PR #35, borrador). No se fusionó ni desplegó nada, no se tocaron otros repositorios ni tu copia local.

## 1. Luz fija por defecto (brillo sigue apagado)

- Sin preferencia guardada, «Luz fija» empieza **encendida** y «Brillo» **apagado**.
- Si ya elegiste algo («hora» o «fija»; brillo encendido), se respeta lo guardado.
  - Ojo: tu navegador de la MSI puede tener guardado «hora» de pruebas anteriores. En ese caso seguirá con luz de la hora hasta que marques «Luz fija» una vez.
- `?hora=N` en la dirección (capturas y pruebas) sin preferencia guardada sigue usando la luz de esa hora.
- Archivo: `app/vistas/vista3d/escena3d.js`.

## 2. La franja DEMO ya no mueve el visor

**Causa (medida en Chromium).** Arriba del edificio hay tres franjas que cambian de alto según el piso:

- la franja DEMO: solo en pisos DEMO;
- la de conexión: 1 o 2 líneas;
- la línea de avisos del archivo: solo Ek Chuah.

Al cambiar de proyecto, el edificio subía o bajaba hasta 75 px a 1366×768.

**Arreglo.** Debajo de las franjas se reserva la diferencia con el alto mayor posible para ese ancho de ventana (margen superior de `.principal`, calculado en `app/app.js → reservarFranjas`). No se oculta ni se mueve ninguna información.

- La franja DEMO y la línea de avisos se miden aunque el piso actual no las muestre, así que tampoco salta el primer cambio.
- Sin reserva en Inmersivo, en Sala de control, Nexus y CSI, ni en celular horizontal (ahí casi no hay alto).

**Resultado medido** (prueba `franjas-luz.cjs`, 7 pisos, 2 vueltas):

| Ventana | Borde de arriba del visor | Antes |
|---|---|---|
| 1366×768 | 274–277 px | 199–274 px |
| 1280×720 | 235–236 px | 164–235 px |
| 1224×636 (tu ventana de Edge) | 235–236 px | 164–235 px |
| Celular 390×844 | 219 px desde la 2.ª vuelta | 155–219 px |

**Costo.** En los pisos sin franja DEMO queda un espacio vacío arriba. Es lo que ocupaba la franja; ya no se cierra al cambiar de piso.

- En 1280×720 el edificio queda siempre donde antes quedaba en Ek Chuah, el peor caso, y pide unos 25 px de desplazamiento vertical.
- **En celular vertical no se reserva la línea de avisos**, para no quitarle alto al edificio. La primera vez que un piso la muestra, el visor baja 24 px una sola vez.

## 3. Pruebas

- Node: **445 pasaron, 0 fallaron**.
- `franjas-luz.cjs` (nueva): **21/21**. Cubre luz y brillo por defecto y respetados, y 4 tamaños de ventana. Incluye Nexus e Inmersivo sin reserva y el regreso al mismo sitio.
- `navegacion-secciones.cjs`, `movil-medidas.cjs`, `inmersivo.cjs`, `candidata.cjs`, `recorrido.cjs` y `vida-cuarto.cjs`: en verde dentro de la batería.
- **Batería completa Chromium sobre 003d9c2: 35/36.**
  - El rojo fue `ascensor.cjs` (31/32), en el caso «redirigir a media salida».
  - Es el mismo fallo intermitente de tiempos que ya había salido una vez antes de estos cambios. Este cierre no toca el ascensor.
  - Repetido tres veces por separado: 32/32, 32/32, 32/32.
- Una corrida anterior sobre e97829b dio 35/36 por una regresión real, ya corregida en 003d9c2. La reserva le quitaba alto al edificio en celular (`movil-medidas.cjs`: en horizontal con el detalle abierto quedaba 26.6 % de pantalla, y se exige 30 %).

## 4. Rendimiento

- No se cambió nada de la escena 3D ni del dibujo.
- La reserva se calcula solo cuando cambia el tamaño de las franjas o de la ventana, no en cada cuadro.
- No se volvió a medir en la Intel UHD.

## 5. Comprobar en tu MSI

```bat
cd C:\Users\MSIGF\Cauce-AI-Center-A
git fetch origin claude/ascensor-y-vida-cuarto
git checkout --detach origin/claude/ascensor-y-vida-cuarto
git log --oneline -1
python servir.py --puerto 8766
```

`git log` debe mostrar 003d9c2 o posterior. Luego abre `http://127.0.0.1:8766/` y recarga una vez con Ctrl+F5.

1. Cambia entre Compago, Ek Chuah, Tezcatlipoca, Montambre y CSI: el edificio no sube ni baja.
2. «Luz fija» marcada y «Brillo» desmarcado. Si «Luz fija» aparece desmarcada, es tu preferencia guardada: márcala una vez y se recuerda.
3. Abre Nexus y vuelve: el edificio queda en su sitio.
