# Probar la fase L en Windows (5 minutos)

## 1. Abrir (1 min)

1. En la carpeta del repositorio: `git fetch origin` y `git checkout fase-l/animacion-oficina-portal`.
2. Doble clic en **`iniciar.bat`**. Luego, en Chrome o Edge, abre `http://127.0.0.1:8765/?medir=1`.
   No hace falta instalar nada nuevo (sin dependencias nuevas).
3. Si el navegador guardó la versión anterior: **Ctrl+F5**.

## 2. Qué visitar y qué observar (3 min)

| Pantalla | Cómo llegar | Qué debe pasar |
|---|---|---|
| **Edificio** | Al abrir (Compago DEMO) | Recepción con piso de baldosa, **marquesina en la entrada** con «COMPAGO · DEMO» y una luz verde (conexión), sala de juntas con cristal y sillas vacías, cocineta, charcos de luz cálida en pasillos. Cada oficina con un mueble propio (estantería, credenza o garrafón), puerta de cristal abierta y zócalo. |
| **Recepción** | **⌂ Recepción** (o **R**) | Mostrador con franja de color de Compago, letrero con el símbolo de «Análisis comercial» (carrito), directorio y emblema. **Nadie** atiende la recepción. |
| **Vista anterior** | Tecla **1**, luego **R**, luego **Retroceso** dos veces (o el botón **↶ Anterior**) | Regresa primero a *Importación* con el mismo encuadre y después al edificio completo. El botón desaparece cuando no hay más vistas. |
| **Personaje** | Clic en el personaje de *Importación* | Anillo dorado y **tarjeta flotante**: nombre, departamento, «Proceso automático», «Trabajando · DEMO». Obsérvalo ~30 s: teclea, **se detiene a leer**, **voltea a un lado**, **se acomoda** y vuelve a teclear. **F** lo sigue. |
| **Puesto vacío** | Departamento *Evaluación* → clic en el escritorio | Tarjeta con borde punteado: «Puesto sin personaje: no hay evidencia de actividad vigente». No aparece nadie. |
| **Números 1–9** | Mira las placas del piso frente a cada puerta | Cada placa dice «1 · Importación…», «2 · …»: la misma tecla que enfoca ese departamento. |
| **Sala de control** | **S** | Tarjetas con franja de color y estilo («ANÁLISIS COMERCIAL», «FINANZAS», «NEGOCIOS DE COMIDA»); los 3 pendientes al final y más compactos. Abrir/cerrar la sala **no mueve la cámara**. |
| **Ek Chuah** | Pestaña Ek Chuah | Baldosa verdosa, símbolo de finanzas en el letrero; oficinas con temas propios (servidores en *Datos*, archiveros en *Informes*, monedas en *Riesgo*). |
| **Pendiente** | Pestaña Tezcatlipoca | Mensaje «Proyecto pendiente: … su piso aparecerá cuando exista un exportador». Sin oficinas inventadas. |
| **Celular** | F12 → icono de celular (iPhone 12) | Sin desplazamiento horizontal; menú **⋯** con «↶ Vista anterior» después de acercarte; tarjeta del personaje más chica. |
| **Modo incrustado** | `http://127.0.0.1:8765/?incrustado=1` | Sin título ni pie; DEMO, conexión, alertas y pestañas siguen visibles. |

Opcional (subruta del futuro portal): cierra `iniciar.bat` y en una consola en la carpeta del repositorio ejecuta
`py servir.py --base /cauce/`; abre `http://127.0.0.1:8765/cauce` → debe quedar en `/cauce/` y funcionar igual.

## 3. Medir cuadros por segundo (1 min) — lo más importante

1. `http://127.0.0.1:8765/?medir=1`, edificio completo, sin tocar nada **20 segundos**.
2. **Copiar medición** (recuadro verde) y pégala en el hilo. Repite con **Inmersivo** y con un departamento enfocado.
3. Qué esperar: en este contenedor (sin tu GPU) el edificio pasó de **159 a 83 llamadas de dibujo** (−48 %) aunque
   tiene más muebles; los triángulos subieron de ~6 300 a ~9 400 (poco para cualquier GPU). Por eso **espero** que en
   tu Intel UHD se mantenga cerca de 60 cps o mejore, pero **no está medido**: la última medición real es de la fase G
   (≈61 cps). Si ves menos de 50 cps sostenidos, avísame con la medición.

## 4. Pruebas automáticas (opcional)

- Sin Node: `http://127.0.0.1:8765/pruebas.html` → debe decir **251 pasaron, 0 fallaron**.
- Con Node: `probar.bat`.
- Navegador completo (si tienes Node y Playwright): con `iniciar.bat` abierto, `node pruebas\navegador\todas.cjs`.

## 5. Regresar a la versión anterior

`git checkout fase-k/oficina-virtual-profesional` y Ctrl+F5. La fase L no cambia el contrato v1, ni `datos/reales/`,
ni los exportadores. Solo agrega campos opcionales (`estilo` en `datos/proyectos.json`, `tema` en `escena/*.json`)
que la fase K ignora sin fallar.
