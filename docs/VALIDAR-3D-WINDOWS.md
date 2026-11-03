# Validar la oficina 3D en Windows 11 (unos 20 minutos)

Objetivo: medir el rendimiento real en tu PC, revisar las animaciones y confirmar la conexión con Compago. Con estas cifras decidimos si se puede construir el piso con los 8 departamentos.

Necesitas Git, Python 3 y Chrome o Edge actualizado. Todo corre en tu PC, sin internet ni servidores.

## 1. Descargar la rama

En PowerShell, dentro de tu carpeta `Cauce-AI-Center` de la fase 2:

```powershell
git fetch origin
git switch fase-3d/edificio-compago
git pull
```

Si no tienes esa carpeta, ve a tu Escritorio y clónala con `git clone -b fase-3d/edificio-compago https://github.com/dass-666/Cauce-AI-Center.git`.

## 2. Pruebas automáticas

1. Doble clic en `iniciar.bat` y deja la ventana abierta.
2. Abre <http://127.0.0.1:8765/pruebas.html>.

Esperado: `73 pasaron, 0 fallaron`.

## 3. Animaciones (con datos de demostración)

La demostración solo aparece si no existe `datos\reales\compago.json`. Si existe, muévelo un momento a otra carpeta. No lo borres.

Abre <http://127.0.0.1:8765>. Arriba debe estar activo **3D**, y en la escena debe verse la etiqueta amarilla **DEMO**. Usa el selector de departamentos y revisa cada fila:

| Departamento | Debe verse |
|---|---|
| Importación de catálogos | Dos personajes entran por la puerta, uno tras otro. *Importador* teclea con la pantalla azul. *En espera* se recarga y mira alrededor |
| Búsqueda de proveedores | Entra, celebra con los brazos arriba y se sienta. Pantalla verde |
| Revisión de fuentes | De pie junto a su silla, negando con la cabeza. Pantalla roja |
| Márgenes y rentabilidad | Sentado, levanta la mano. Pantalla ámbar |
| Integración UNIQ | Silla vacía y pantalla apagada (no hay evidencia) |

Después revisa la interacción:

- Arrastra para girar, usa la rueda para acercar y clic derecho para mover. *Centrar* regresa la cámara.
- Toca un personaje: se abre su detalle. Toca el piso vacío: se cierra.
- Marca *Bajo consumo*: debe cambiar al plano 2D. Desmárcalo.

## 4. Rendimiento (lo más importante)

Cierra juegos, videos y programas pesados. Abre <http://127.0.0.1:8765/?medir=1> con la ventana **maximizada**, en *Importación de catálogos*.

Arriba aparece **Edificio | Un cuarto**. Por omisión se abre *Edificio* con *Todo el piso* (los 8 departamentos). Toca un departamento (o elígelo en el selector) para acercarte; *Todo el piso* regresa a la vista completa.

Haz estas mediciones. En cada una, **no toques nada durante 30 segundos**; después pulsa **Copiar medición** (arriba a la derecha) y pega el texto en un Bloc de notas.

| # | Cómo |
|---|---|
| A | *Edificio*, *Todo el piso*, *Brillo* apagado |
| B | *Edificio*, *Todo el piso*, *Brillo* encendido |
| D | *Edificio*, enfocado en *Importación de catálogos*, *Brillo* apagado |
| E | *Un cuarto*, *Brillo* apagado (para comparar con tu medición anterior) |
| C | Celular simulado: F12 → ícono de celular (Ctrl+Shift+M) → elige "iPhone 12 Pro" → F5 para recargar |

Durante la medición A, anota además dos cifras:

- **GPU:** abre el Administrador de tareas (Ctrl+Shift+Esc) → *Rendimiento* → *GPU* y anota el % de uso.
- **Memoria de la pestaña:** en Chrome o Edge, Shift+Esc y anota la memoria de la pestaña "Cauce".

La medición C usa tu PC, no un teléfono: solo comprueba la versión de celular. En un teléfono real podría ir más lento.

**Cómo leeremos tus cifras** (es mi criterio propuesto; lo podemos ajustar):

- A y B con 55–60 cps: el edificio se queda así.
- A entre 40 y 55: bajo la frecuencia de animación de los cuartos no enfocados y quito adornos (tiras de luz, plantas) antes de tocar los personajes.
- A por debajo de 40: los cuartos lejanos se dibujan quietos y solo se anima el enfocado.
- La línea copiada incluye `modo`, número de personajes y cuántos se animaron en el último cuadro: con eso sé dónde está el costo.

## 5. Conexión con Compago

1. Regresa `datos\reales\compago.json` a su carpeta, si lo moviste.
2. Abre `conectar_compago.bat`, como en la fase 2 (paso 4 de `VALIDAR-WINDOWS.md`), y recarga el navegador.

Esperado:

- En la escena, la etiqueta verde **REAL**.
- El letrero sin la marca DEMO.
- Solo aparecen personajes donde Compago registró actividad. Las sillas vacías son correctas si no hubo actividad.

Para probar la caducidad, cierra la ventana del exportador y espera a que pase la vigencia (15 minutos por defecto). Esperado: el aviso dice "Datos desactualizados" y los personajes se levantan y salen.

## Qué enviarme

1. El resultado del paso 2.
2. Las filas del paso 3 que no se vieron como se esperaba, con una captura.
3. Los tres textos copiados (A, B y C), el % de GPU y la memoria.
4. Si el paso 5 funcionó.
