# Comparar FPS en tu Intel UHD: versión anterior (fase L) contra la nueva (rendimiento UHD)

Tiempo: unos 15 minutos (la medición automática tarda ~9 min con los valores por defecto).
No instala nada nuevo: usa Python (el de `iniciar.bat`), Git y Chrome o Edge.

> Nada de esto se ha medido todavía en tu computadora. Los números del informe salen de SwiftShader
> (la CPU haciendo de tarjeta gráfica en el contenedor): sirven para comparar **trabajo**, no son tus FPS.

## 0. Antes de medir (2 min)

1. Conecta el cargador de la laptop y deja Windows en el modo de energía de siempre (no cambies entre medición
   y medición: con batería la Intel UHD baja su frecuencia y los números cambian).
2. Cierra otras pestañas pesadas, videollamadas y juegos.
3. Usa **el mismo navegador** para las dos versiones (Chrome o Edge) y deja la ventana **maximizada**.

## 1. Traer la versión nueva sin publicar nada (2 min)

La rama nueva **no está en GitHub**: viene en el archivo `cauce-rendimiento-uhd.bundle` (carpeta del proyecto
`cauce/rendimiento-uhd/`). Descárgalo, por ejemplo a `Descargas`, y en una consola dentro de la carpeta del repositorio:

```bat
git bundle verify "%USERPROFILE%\Downloads\cauce-rendimiento-uhd.bundle"
git fetch "%USERPROFILE%\Downloads\cauce-rendimiento-uhd.bundle" rendimiento-uhd/optimizar:rendimiento-uhd/optimizar
git checkout rendimiento-uhd/optimizar
```

Esto no toca `main` ni ninguna otra rama. La rama nueva sale de la fase L (`f9b83e7`), así que también trae la versión anterior para comparar. Para volver: `git checkout fase-l/animacion-oficina-portal`.

## 2. Comparación automática (la recomendada, ~10 min)

1. Doble clic en **`herramientas\comparar-fps.bat`**. La primera vez crea una copia de la versión anterior
   (fase L, commit `f9b83e7`) en `comparar\anterior` (carpeta ignorada por git) y abre
   `http://127.0.0.1:8765/herramientas/comparar-fps.html`.
2. Deja marcados los escenarios (edificio, enfocado, un cuarto, con brillo y el control con brillo completo) y
   pulsa **Empezar medición**. La oficina ocupa toda la ventana y alterna *anterior / nueva / nueva / anterior*.
   **No muevas el ratón ni cambies de ventana** hasta que diga «Listo» (si la pestaña queda oculta, el navegador
   pausa la animación y esa medición no vale).
3. Pulsa **Copiar resultados** y pégalos en el hilo.

Cómo leer el resumen:

| Escenario | Qué esperar si las mejoras funcionan en tu equipo |
|---|---|
| Edificio / enfocado / un cuarto **sin brillo** | Igual que antes (≈60 cps). No cambié lo que se dibuja sin brillo. |
| Edificio **con brillo** | La nueva usa el **brillo ligero**. Antes medías ~29 cps; debería acercarse a 60 (**hipótesis**, no medido). |
| Edificio con **brillo completo en ambas** | Control: las dos deberían dar lo mismo (es el mismo efecto). Si la nueva da mucho más o mucho menos, algo externo cambió entre mediciones (temperatura, energía) y hay que repetir. |
| Columna **GPU ms** | Milisegundos que tarda la tarjeta gráfica por cuadro (solo la nueva y solo si el navegador lo permite). A 60 cps hay 16.7 ms por cuadro: si GPU ms está cerca de 16, el límite es la tarjeta; si está muy por debajo y aun así hay pocos cps, el límite es el procesador. |
| Columna **origen** | Debe decir lo mismo en las dos versiones (DEMO o REAL). Si la nueva lee `datos\reales\` y la anterior no, no son comparables: mueve temporalmente `datos\reales\*.json` fuera de la carpeta o copia lo mismo en `comparar\anterior\datos\reales\`. |
| Columna **px** | Escala de pantalla de Windows (1 = 100 %, 1.25 = 125 %, 1.5 = 150 %). Más px = más píxeles = más trabajo para la tarjeta. Anótala. |

## 3. Comparación a mano (si la automática no funciona)

Abre cada dirección, espera **20 segundos sin tocar nada** y pulsa **Copiar medición** (recuadro de abajo):

| Qué | Versión anterior | Versión nueva |
|---|---|---|
| Edificio | `http://127.0.0.1:8765/comparar/anterior/?medir=1` | `http://127.0.0.1:8765/?medir=1` |
| Con brillo | lo anterior + marcar **Brillo** | lo anterior + marcar **Brillo** (ligero) |
| Brillo completo (control) | igual que «con brillo» | `http://127.0.0.1:8765/?medir=1&brillo=completo` + marcar **Brillo** |
| Un cuarto | botón **Un cuarto** | botón **Un cuarto** |

Opciones de la versión nueva útiles para diagnosticar (solo afectan esa pestaña):

- `&brillo=completo` / `&brillo=ligero`: elige el tipo de brillo (queda guardado; `&brillo=ligero` regresa al nuevo).
- `&quieta=0`: desactiva el ahorro de «escena quieta» (para medir una escena sin personajes como antes).
- `&pbr=1`: personajes con su material original (PBR) en vez del Lambert más barato.
- `&px=1`: dibuja con 1 píxel real por píxel de pantalla aunque Windows esté al 125–150 %. Si con `&px=1` los cps
  suben mucho, el límite de tu equipo son los píxeles (la resolución), no la cantidad de objetos.

## 4. Qué revisar a ojo (3 min)

1. **Brillo ligero**: marca **Brillo**. Deben resplandecer los letreros, las pantallas, la franja de luz del pasillo y
   los anillos de estado; las ventanas **no**. Los bordes siguen suavizados (con el brillo completo se ven dentados).
   Si el ligero te parece demasiado débil o fuerte, dime cuánto (se ajusta un número).
2. **Personajes**: acércate a uno con la rueda del ratón; colores y textura iguales que antes.
3. **Escena quieta**: abre **Montambre** (sin personajes). Con `?medir=1` el recuadro dice
   «Escena quieta: no se redibuja». Gira la cámara con el ratón: debe moverse fluida y las etiquetas seguirla.
   Elige un departamento: debe enfocarse al instante.
4. **Un cuarto**: botón **Un cuarto** → se ve un solo departamento con su personaje, como antes.
5. **Selección y cámara**: tecla **1** (enfoca), **R** (recepción), **Retroceso** (vista anterior), clic en un
   personaje (tarjeta), **F** (seguir), **0** (edificio completo).

## 5. Si algo sale mal

- **No abre la herramienta**: abre `http://127.0.0.1:8765/herramientas/comparar-fps.html` a mano con `iniciar.bat` abierto.
- **«No arrancó la vista 3D en …/comparar/anterior/»**: la copia no se creó. En la consola:
  `git worktree add --detach comparar\anterior f9b83e7` (necesita haber hecho el paso 1).
- **Pantalla en blanco o errores**: Ctrl+F5. Si persiste, copia el texto rojo de la consola (F12) en el hilo.
- **Borrar la copia anterior al terminar**: `git worktree remove comparar\anterior`.
