# Validación final de la fase G en Windows (unos 15 minutos)

Todo lo que se puede medir desde Linux ya está probado (Node y Chromium). Esta guía cubre solo lo que no se puede verificar ahí: tu Intel UHD, el mouse, el táctil real y cómo se ve en tu pantalla.

## 0. Preparar
1. En la carpeta del repositorio: `git fetch origin` y luego `git checkout fase-g/experiencia-visual`.
2. Ejecuta `py servir.py`. Se abre `http://127.0.0.1:8765/`.

## 1. Rendimiento en tu Intel UHD (lo más importante)
1. Abre `http://127.0.0.1:8765/?medir=1`, quédate en Compago y en 3D, y espera 10 segundos.
2. Anota los **cps** del recuadro verde, pulsa «Copiar medición» y guarda el texto.
3. Pulsa **⛶ Inmersivo**, espera 10 segundos y anota los cps otra vez.
- ✅ Si los dos valores son de 55 cps o más, está bien. El modo inmersivo dibuja más píxeles, así que puede bajar un poco.
- ❌ Si alguno baja de 55, pégame los dos textos copiados.

## 2. Modo inmersivo con mouse y teclado
1. Pulsa **⛶ Inmersivo**. La cabecera desaparece y arriba solo quedan DEMO, «En línea», la edad del dato y «Alertas».
2. Haz clic en la etiqueta de un departamento. Se abre el detalle a la derecha y sigues en modo inmersivo.
3. Abre «Alertas». La lista se despliega.
4. Pulsa **Esc** varias veces. Primero se cierra el detalle, luego vuelves al piso y al final sales del modo.
- ❌ Si algo se ve encimado o cortado, mándame una captura.

## 3. Celular simulado (opcional)
`servir.py` solo escucha en tu computadora, a propósito, así que el celular real no puede abrirla. En Chrome pulsa F12, luego Ctrl+Shift+M, y elige «iPhone 12 Pro». Revisa en vertical y en horizontal (botón de girar):
- La franja DEMO se lee completa, sin «…».
- Los estados dicen su nombre («1 trabajando», «1 error»…). En horizontal solo se ven puntos de color con número.
- ⛶ abre el modo inmersivo, ✕ lo cierra, y la barra de abajo sigue cambiando de departamento.

## 4. Apariencia
Dime si algo se ve peor que antes: colores, tamaños de letra o botones.

**Qué me mandas:** los dos textos de «Copiar medición» y un «sí/no» para los pasos 2, 3 y 4. Con eso decido si la fase G está lista o necesita ajustes.
