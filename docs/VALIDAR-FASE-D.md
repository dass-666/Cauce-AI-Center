# Validar la fase D (estabilidad, arquitectura, celular, integraciones)

Ramas: `fase-d/estabilidad` (D1, D2, D4) y `fase-d/movil` (D3, encima de la anterior). Para probar todo, usa
`fase-d/movil`.

Lo que yo comprobé fue en Linux, con Chromium y SwiftShader (renderizado por software). **No** es Windows real,
**no** es tu Intel UHD y **no** es un celular físico.

## 0. Aviso: error en las guías de C2 a C4

En los PR #6, #7 y #8, `pruebas.html` **fallaba en el navegador**: unas pruebas leían archivos con `node:fs`, que
solo existe en Node. Las guías decían "0 fallaron" porque solo se corrió `node pruebas/ejecutar.mjs`. Se corrigió en
D1. Ahora `pruebas/navegador/pruebas-html.cjs` abre `pruebas.html` en Chromium para que no vuelva a pasar.

## 1. Pruebas automáticas (resultado en Linux)

| Prueba | Cómo se corre | Resultado |
|---|---|---|
| Núcleo (Node) | `node pruebas/ejecutar.mjs` | 109 pasaron, 0 fallaron |
| La misma, en el navegador | abrir `http://127.0.0.1:8765/pruebas.html` | 109 pasaron, 0 fallaron (Chromium) |
| Regresión visual | `node pruebas/navegador/regresion.cjs` | 47/47 |
| Animaciones | `node pruebas/navegador/animaciones.cjs` | 11/11 |
| Memoria | `node pruebas/navegador/memoria.cjs` | 3/3 |
| Estabilidad (DEMO→REAL, error 500, datos viejos, reconexión) | `node pruebas/navegador/estabilidad.cjs` | 14/14 |
| Brillo | `node pruebas/navegador/brillo.cjs` | 3/3 (185 → 199 llamadas de dibujo, software) |
| Espacio en celular | `node pruebas/navegador/movil-medidas.cjs` | 16/16 |

Las pruebas de navegador necesitan Playwright (no es dependencia del proyecto) y `servir.py` corriendo.

## 2. Qué cambió y cómo verlo tú

1. **DEMO → REAL (D1).** Antes, cuando aparecía el archivo real, la página comparaba los estados de la demo con los
   reales y los personajes "reaccionaban" a cambios que nunca pasaron. Ahora se anota un solo cambio:
   *Los datos pasaron de DEMO a REAL*, y nadie hace gestos.
   - Cómo verlo: con la página abierta en Compago (demo), corre el adaptador de Compago PR #9 (cuando lo autorices).
     En "Cambios observados" debe salir una sola línea de fuente.
2. **Lecturas cruzadas (D1).** Si pulsas *Actualizar* varias veces muy rápido, solo cuenta la última lectura.
3. **Demo sin marca (D1).** Un archivo en `datos/demo/` sin `es_demo: true` se muestra como *Archivo inválido*.
4. **Registro (D1).** Si `datos/proyectos.local.json` tiene una ruta fuera de `datos/` o `escena/`, o un id
   repetido, esa entrada se descarta y la consola (F12) lo avisa.
5. **Revisar un archivo (D4).** Antes de conectar un sistema:
   ```powershell
   node herramientas/validar-estado.mjs datos/reales/compago.json --proyecto=compago
   ```
   Código 0 significa válido y vigente. Para una demo, agrega `--demo`.
6. **Celular (D3)**, con F12 → Ctrl+Shift+M:
   - **Vertical (iPhone 12 Pro, 360×640):** arriba, cada indicador es icono + número (⚙ 1, … 3, ✓ 2…), todos en su
     propia línea y sin desplazar. Mantén el dedo o el ratón encima para ver el texto completo.
   - **Horizontal (por ejemplo 640×360):**
     - la cabecera queda en una sola franja;
     - al abrir un departamento, el detalle sale como columna a la derecha y no tapa la barra de abajo.
7. **Código (D2).** `escena3d.js` pasó de 927 a 826 líneas. Se separaron:
   - `brillo.js`;
   - `gestos.js`;
   - `etiquetas-dom.js`.

   El comportamiento no debe cambiar: el brillo, el deslizar y las etiquetas se ven igual que en C4.

## 3. Qué no se pudo validar
- Cuadros por segundo reales en tu Intel UHD (vuelve a medir A/B con `?medir=1`).
- Windows real, celular físico, Safari y Firefox.
- Una integración real: ninguna se activó. Ek Chuah y Tezcatlipoca no tienen adaptador (ver `docs/INTEGRACIONES.md`).

## 4. Comandos (PowerShell)
```powershell
git fetch origin
git switch fase-d/movil
git pull
.\iniciar.bat
# http://127.0.0.1:8765/pruebas.html  → 109 pasaron, 0 fallaron
# http://127.0.0.1:8765/?medir=1      → medición A/B
```
