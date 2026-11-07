# Validar la fase C, PR 1 (noche, encuadre y etiquetas) en Windows 11

## 1. Actualizar

```powershell
git fetch origin
git switch fase-3d/visibilidad-encuadre
git pull
```

Doble clic en `iniciar.bat` → <http://127.0.0.1:8765/pruebas.html>: `94 pasaron, 0 fallaron`.

## 2. Revisar

| Qué | Cómo |
|---|---|
| Noche | Abre <http://127.0.0.1:8765/?hora=23> (hora forzada solo para revisar). Los cuartos se ven con "luz encendida" y los pasillos más oscuros; cada personaje tiene un anillo del color de su estado. Compara con `?hora=12`. Los personajes de Kenney no cambian de material. |
| Encuadre | Con *Todo el piso*, el edificio ocupa casi todo el alto libre; ningún cuarto queda bajo la barra, el aviso ni el minimapa. Al abrir o cerrar el panel se vuelve a encuadrar (si no moviste la cámara). |
| Etiquetas | Ninguna se encima. Si no cabe sobre el muro, se mueve al centro del cuarto o junto a la puerta; si no cabe en ningún lado, se oculta (el departamento sigue en el selector y en el minimapa). |
| Celular (F12 → Ctrl+Shift+M → iPhone 12 Pro → F5) | Nombres cortos ("Importación", "Búsqueda"…). Al tocar una etiqueta se enfoca y el nombre completo aparece en el selector y el panel. Un dedo deslizando a los lados cambia de departamento; dos dedos acercan y mueven; ya no se gira. |

## 3. Medir (como antes)

<http://127.0.0.1:8765/?medir=1>, maximizada, *Todo el piso*, 30 s sin tocar, **Copiar medición**:

- **A:** Brillo apagado.
- **B:** Brillo encendido.

Cambio esperado: unas **+8 llamadas de dibujo** (un anillo de estado por personaje visible). En renderizado por software: 185 sin brillo y 199 con brillo (antes 177 y 191). El área 3D también es más alta, así que se dibujan más píxeles: por eso hay que medir en tu Intel UHD.
