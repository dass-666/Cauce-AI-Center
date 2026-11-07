# Validar la fase C2 (interfaz para celular) en Windows 11

Rama `fase-3d/interfaz-movil` (sale de C1, `fase-3d/visibilidad-encuadre`). En escritorio no cambia nada visible
salvo un arreglo: el cuarto enfocado ahora se acerca según el espacio libre real (ver "Cambios técnicos").

## 1. Actualizar

```powershell
git fetch origin
git switch fase-3d/interfaz-movil
git pull
```

Doble clic en `iniciar.bat` → <http://127.0.0.1:8765/pruebas.html>: `97 pasaron, 0 fallaron`.

## 2. Revisar en modo celular de Edge o Chrome

F12 → Ctrl+Shift+M → elige **iPhone 12 Pro** y luego **Galaxy S8+ (360×740)** → F5.

| Qué | Qué debe pasar |
|---|---|
| Cabecera | Arriba solo quedan los proyectos y los botones. La franja DEMO y la línea "DEMO · En línea · Dato de hace…" **se quedan pegadas arriba** al bajar la página. |
| Barra inferior | `◀ [● Departamento ⚠n ▾] ▶ ⋯`, fija abajo. El punto es el color del estado; ⚠n son las alertas del archivo. |
| Flechas | ◀ ▶ pasan al departamento anterior/siguiente (mismo orden que el teclado y que deslizar el dedo). |
| Lista | Tocar el nombre abre la lista: "Todo el piso" y cada departamento con su estado, "x/y con evidencia" y alertas. Tocar uno lo enfoca. |
| Menú ⋯ | Edificio completo / Un cuarto, Centrar, ← Volver al piso (si hay uno enfocado), Luz fija. Tocar fuera cierra la lista o el menú. |
| Detalle | Al elegir un departamento o personaje, el detalle se abre **encima** de los botones de personajes y de la barra, sin taparlos (máx. 32 % del alto, con desplazamiento). El cuarto enfocado queda visible arriba del detalle. |
| Deslizar | Sigue funcionando (un dedo a los lados). Dos dedos acercan y mueven. |
| Escritorio | Sin barra inferior; todo como en C1. |

## 3. En un celular real (opcional)

Con la PC y el celular en la misma red esto **no** funciona tal cual: `servir.py` solo escucha en `127.0.0.1`
(a propósito, por seguridad). No lo cambies para probar; la revisión con F12 es suficiente para esta fase.

## 4. Cambios técnicos

- `navegacion.js` (nuevo): una sola regla para el vecino; teclado, flechas y gesto la usan (prueba que no haya copia).
- `barra-movil.js` (nuevo): solo DOM.
- `escena3d.js`: crea la barra solo en celular; `zonaLibre()` considera barra, botones, aviso (arriba en celular) y el
  panel de detalle que le pasa `app.js` (`tapan`); `enfocar()` calcula el acercamiento con la zona libre real.
- `app.js`: dibuja el panel **antes** que la vista, para que la cámara sepa cuánto tapa.
- Corrección encontrada al probar: en escritorio el panel lateral no debe contar como obstáculo (se descarta lo que
  queda fuera del lienzo).

## 5. Pruebas automáticas

- Node: 97 (3 nuevas: vecino circular, resumen sin inventar evidencia, regla única del vecino).
- Navegador (Playwright + SwiftShader, `pruebas/navegador/regresion.cjs`): escritorio + 3 celulares
  (iPhone 12 Pro vertical y horizontal, Android 360×640): barra, flechas, lista, menú, panel ≤ 50 %, cabecera fija,
  etiquetas sin encimarse ni debajo de la barra: 47/47 OK. SwiftShader no mide rendimiento real.
- Limitación: en celular horizontal (340 px de alto) la vista 3D queda casi toda bajo el pliegue al abrir; las
  etiquetas que caerían bajo la barra se ocultan hasta que bajas la página.

## 6. Rendimiento

La barra es HTML: no agrega llamadas de dibujo. En celular la vista 3D es más alta (más píxeles); no se midió en un
celular real.
