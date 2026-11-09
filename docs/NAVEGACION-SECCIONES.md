# Navegación entre oficinas y secciones especiales · PR #35 · 2026-11-09

Commit **be9d956**, en la rama `claude/ascensor-y-vida-cuarto` (PR #35, borrador). No se fusionó ni se desplegó nada, no se tocó la rama de respaldo `claude/project-thread-l7uvsf` y no se modificaron otros repositorios.

## Causa raíz (reproducida en Chromium antes de corregir)

- **Sala de control, Nexus y CSI** se muestran poniendo una clase en `<html>`: `sala-abierta`, `nexus-abierto` y `csi-abierto`. Mientras esa clase está puesta, el CSS oculta `#oficina` con `display: none !important`, y la vista 3D queda en pausa.
- **El problema estaba en `elegirProyecto`**, la función de las pestañas de piso:
  - no cerraba la sección abierta;
  - si el piso elegido era el actual, salía sin hacer nada.
- **Reproducción:** con Nexus abierto, pulsar «Compago» dejaba `#oficina` con `display: none`. Con CSI abierto, pulsar «Ek Chuah» cambiaba el piso *por detrás* (`piso: "ek-chuah"`), pero el edificio seguía oculto.
- **Por qué Inmersivo lo «arreglaba»:** `ponerInmersivo(true)` era el único lugar del código que cerraba las tres secciones. Al cerrarlas quitaba la clase y volvía a aparecer el edificio.
- **No era culpa del PR #35:** el defecto existía desde que hay secciones especiales (fase K, Nexus y CSI). El #35 no tocó esa parte.

## Qué se cambió

**`app/app.js`**

- `cerrarSecciones()` cierra la sección que esté abierta.
  - La llaman la pestaña de piso (también si es el mismo piso), «Edificio 3D» y «Plano».
- Al volver de una sección no se arranca el ascensor, porque el piso anterior no estaba a la vista. Entre pisos, con el edificio visible, el ascensor sigue igual.
- Si la sección se abrió desde Inmersivo (teclas S, N o I), al cerrarla se vuelve a Inmersivo, con Esc o con el botón. Así se conserva tu preferencia.
  - Si sales con una pestaña de piso estando fuera de Inmersivo, sigues fuera.
- Al cerrar la última sección, la vista 3D se reanuda.

**Botones**

- `app/vistas/sala.js`, `nexus.js` y `csi.js`: el botón que decía «Ir al edificio ›» ahora dice **«‹ Volver a oficinas»**. Hace lo mismo que antes: cierra la sección.

**Pruebas y documentación**

- Prueba nueva: `pruebas/navegador/navegacion-secciones.cjs`.
- Ajustes de texto en `fase-k.cjs`, `nexus.cjs` y `docs/VALIDAR-CSI.md`.

## Pruebas

- **`navegacion-secciones.cjs`: 16/16.** Con el código anterior, la prueba falla: el botón «Un cuarto» quedaba oculto.
  - **Secuencia, dos vueltas sin recargar:** Compago → Nexus → Compago (mismo piso) → CSI → Ek Chuah → Sala de control → Compago → Un cuarto → Nexus → «‹ Volver a oficinas» → Edificio → CSI → volver → Sala → volver → Nexus → Plano 2D → Edificio 3D.
  - **En cada paso:** se ve lo que corresponde, hay un solo lienzo WebGL con tamaño, los controles están disponibles y no hay errores de consola.
  - **Al final de cada vuelta:** la cámara responde.
  - **Recursos:** la 2.ª vuelta no sube nada (82 → 82 geometrías, 32 → 32 texturas).
  - **Ascensor:** desde una sección no queda a medias; entre pisos sigue funcionando.
  - **DEMO:** la insignia sigue en su sitio.
  - **Con Inmersivo:** S, N e I abren su sección y Esc vuelve a Inmersivo. «‹ Volver a oficinas» también vuelve. La cámara responde, y Inmersivo se activa y se desactiva normalmente después.
- **Node:** 445 pasaron, 0 fallaron.
- **Batería completa Chromium sobre be9d956:** **35/35 guiones en verde** (incluye navegacion-secciones, recorrido, vida-cuarto y ascensor).

## Recursos y rendimiento

- No hay objetos 3D nuevos ni dibujo extra. Solo cambia qué sección se muestra.
- Sigue habiendo un solo visor: la prueba cuenta 1 lienzo en cada paso, y los recursos no crecen.
- No se midió en la Intel UHD, porque el cambio no toca el dibujo de la escena.

## Iluminación por defecto

- **Brillo apagado por defecto:** ya estaba implementado y se conserva.
- **Luz fija activada por defecto:** **no** está implementada en esta rama. Hoy viene apagada y se recuerda si la activas. No la cambié porque no forma parte de esta corrección. Si la quieres por defecto, es un cambio de una línea.

## Verificarlo en tu MSI

Tu copia local en `l7uvsf` no se toca. Se usa la carpeta aparte de la versión A.

```bat
cd C:\Users\MSIGF\Cauce-AI-Center-A
git fetch origin claude/ascensor-y-vida-cuarto
git checkout --detach origin/claude/ascensor-y-vida-cuarto
git log --oneline -1
python servir.py --puerto 8766
```

El `git log` debe mostrar be9d956 o un commit posterior. Si el navegador tenía abierta la versión anterior, recarga la página una vez con Ctrl+F5.

Luego, en `http://127.0.0.1:8766/`, sin recargar más:

1. Pulsa Nexus y después la pestaña **Compago**: vuelve el edificio.
2. Pulsa CSI y después **Ek Chuah**: aparece Ek Chuah.
3. Abre la Sala de control y pulsa **Compago**: vuelve el edificio.
4. En cada sección, el botón **«‹ Volver a oficinas»** vuelve al edificio.
5. Activa Inmersivo y pulsa N: se abre Nexus. Pulsa Esc: vuelves a Inmersivo.
6. Cambia entre Compago y Ek Chuah con el edificio a la vista: el ascensor sigue funcionando.
