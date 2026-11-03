# Validar el centro de operaciones (paquetes A + B) en Windows 11 (unos 15 minutos)

## 1. Actualizar tu copia

En PowerShell, dentro de tu carpeta `Cauce-AI-Center`:

```powershell
git fetch origin
git switch fase-3d/centro-operaciones
git pull
```

Tu `datos\reales\compago.json` no se toca (está fuera de Git).

## 2. Pruebas automáticas

Doble clic en `iniciar.bat` y abre <http://127.0.0.1:8765/pruebas.html>. Esperado: `89 pasaron, 0 fallaron`.

## 3. Qué revisar (con la ventana maximizada, en <http://127.0.0.1:8765/>)

| Qué | Cómo comprobarlo |
|---|---|
| Edificio | Muros exteriores con ventanas al fondo y a la izquierda, columnas, pretil bajo al frente y **recepción** con el letrero del proyecto (REAL o DEMO y conexión) y un reloj con la hora de tu PC. No hay personas en la recepción ni en los pasillos. |
| Identidad | Cada departamento tiene su color, su símbolo en el letrero y muebles propios (cajas, mapa, archiveros, diana, monedas, carpetas, consola con monitores apagados, servidor). Placa con nombre en el pasillo frente a cada puerta. |
| Luz | Las ventanas y el ambiente cambian con la hora local (noche, mañana, día, tarde). Marca **Luz fija** para dejarla siempre igual. |
| Teclado | `1`–`8` enfocan un departamento; `←` `→` pasan al vecino; `Esc` cierra el panel y un segundo `Esc` regresa al piso completo. |
| Minimapa | Abajo a la derecha (solo escritorio). Colores = estado real. Toca un departamento para acercarte; fuera de los cuartos, regresas al piso. |
| Agente | Toca un personaje o su botón abajo: la cámara se acerca a su escritorio. `← Piso` regresa. |
| Tablero | Arriba: REAL/DEMO, conexión, "Dato de hace…", agentes por estado, **Alertas** (del archivo) y **Cambios observados**. |
| Cambios | Al abrir dice "Sin cambios observados todavía". Solo aparecen cambios cuando una lectura nueva (cada 30 s o con *Actualizar*) es distinta de la anterior. Si el exportador de Compago no ha corrido, no aparece nada: es lo correcto. |
| Plano 2D y Bajo consumo | Siguen funcionando; el tablero también aparece ahí. |

## 4. Rendimiento

Abre <http://127.0.0.1:8765/?medir=1>, *Edificio*, *Todo el piso*. En cada medición espera 30 s sin tocar nada y pulsa **Copiar medición**:

- **A:** Brillo apagado.
- **B:** Brillo encendido.

Si puedes, anota el % de GPU del Administrador de tareas durante A.

Referencia (renderizado por software en Linux, **no** representa tu PC): 177 llamadas sin brillo y 191 con brillo con 9 personajes; antes del cambio eran 179 y 193 en tu PC.

## Qué enviarme

Las dos líneas copiadas, el % de GPU si lo tienes, y lo que no te guste o no se entienda visualmente.
