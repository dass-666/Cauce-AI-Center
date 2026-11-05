# Informe fase K: de edificio 3D a centro de operaciones (2026-11-05)

Rama `fase-k/oficina-virtual-profesional`, creada desde `fase-j/estabilidad-puente` (`ce0688a`, PR #19).
Sin fusionar, sin desplegar, sin tocar `main`, el contrato v1, los exportadores ni el trabajo de Ronny.

## 1. Resumen ejecutivo

- **Hecho y probado en Chromium:** sala de control con los 6 proyectos, accesos de cámara (recepción, siguiente
  alerta, edificio completo, seguir personaje), recepción con directorio del piso, paneles con fuente, vigencia e
  historial de la sesión, transiciones más suaves de los personajes y mejoras de celular.
- **Costo gráfico medido (SwiftShader):** +3 llamadas de dibujo (156 → 159), +2 texturas (18 → 20), +28 triángulos.
  Con la sala abierta la 3D **deja de dibujar**.
- **No medido:** cuadros por segundo en tu Intel UHD. La última medición real sigue siendo la de la fase G (≈61 cps).
  Fases H, I, J y K siguen sin validar en tu equipo (guía: `docs/VALIDAR-FASE-K.md`, 5 min).
- **Pruebas:** **230/230** en Node y en `pruebas.html` (antes 218; +12 de la fase K); Chromium: **18 scripts en verde** (los 16 anteriores + `fase-k.cjs` 48/48 + `fase-k-capturas.cjs`).

## 2. Funciones implementadas

### Sala de control (K2) — `app/nucleo/sala.js`, `app/vistas/sala.js`
- Botón **◉ Sala de control** o tecla **S**. Funciona en 3D, en el plano 2D y **sin WebGL** (solo HTML).
- Cifras: proyectos con datos reales vigentes, solo DEMO, vencidos, con archivo inválido, sin conexión, procesos
  trabajando **REAL** y, aparte, «trabajando en DEMO (simulado)». **DEMO y REAL nunca se suman.**
- Tarjeta por proyecto: estado (REAL, DEMO, Vencido, Error, Sin conexión, **Pendiente**), edad del dato,
  departamentos, cuántos trabajan, asuntos por revisar, fuente y nota de pendiente. Botón «Ir al piso».
- **Requiere atención:** errores, revisiones, alertas (crítica primero), archivos inválidos e información vencida; REAL
  antes que DEMO. «Ver departamento» lleva al piso y abre ese departamento. Nota explícita: *Cauce solo muestra el
  problema; se atiende en el sistema de origen.* No hay botones que actúen sobre sistemas (probado).
- **Últimos cambios observados:** de todos los pisos, desde que se abrió la página, clasificados (Error,
  Finalización, Información vencida, Alerta, Cambio de estado, Conexión, Cambio de fuente) y «Reciente» (< 15 min) o
  «Anterior». Se dice claramente que **no es un historial permanente** (se pierde al recargar).
- El contador rojo del botón cuenta solo asuntos con datos **REAL** (lo de DEMO está en la sala, marcado).
- Al llegar a un piso desde la sala, se anuncia («Piso Ek Chuah · DEMO») y la pestaña parpadea dos veces (sin
  parpadeo con «reducir movimiento»).

### Registro preparado para más proyectos (K9) — `datos/proyectos.json`, `app/nucleo/registro.js`
- Campos opcionales, fuera del contrato v1: `"pendiente"` (texto) y `"color"` (`#rrggbb`).
- **CauceService** y **Repacar / Auxilio Auto** agregados como **pendientes** (sin demo, sin escena, sin procesos).
  En Repacar la nota dice que falta confirmar si son uno o dos proyectos. Tezcatlipoca marcado pendiente.
- Un proyecto nuevo aparece en la sala y en el selector solo con su línea de registro; no se toca el motor gráfico.

### Recepción e identidad (K3) — `app/vistas/vista3d/arquitectura.js`
- **Directorio del piso:** pantalla en la recepción con cada departamento, su color de estado y sus alertas, y la
  insignia REAL/DEMO/SIN DATOS. Sale del mismo modelo de vista (con datos vencidos, todo «sin información»).
- **Emblema** con las iniciales del proyecto en el piso de la recepción y **color de identidad** del registro en el
  remate de los muros y el marco del letrero (Compago ámbar, Ek Chuah verde, Montambre lila).
- Nada de esto representa trabajo: no se agregaron personas ni actividad decorativa.

### Navegación (K5) — `app/vistas/vista3d/escena3d.js`, `barra-movil.js`
- **⌂ Recepción** (R), **⚠ Siguiente alerta** (A: recorre solo departamentos con alertas, errores o revisiones),
  **0 / Inicio** edificio completo, **F** seguir al personaje elegido (botón «◎ Seguir»; se apaga al mover la cámara;
  solo aparece si el personaje está en escena, es decir, con evidencia).
- Con «reducir movimiento» del sistema la cámara salta sin viaje (probado).
- Celular: el menú ⋯ suma «Ir a la recepción», «Siguiente departamento con alertas» y «Sala de control».
- Atajos visibles al pie de página en escritorio. Los controles anteriores no cambiaron.

### Personajes (K4) — `app/vistas/vista3d/kenney.js`
- **Mezcla de 0.35 s** entre la postura de un gesto y la del siguiente (antes, brazos y cabeza saltaban).
- Los pesos de las animaciones de Kenney se acercan a su objetivo en ~0.3 s (antes cambiaban de golpe al terminar de
  celebrar o de reaccionar a un error). La primera lectura sigue apareciendo ya en su postura, sin transición.
- **Tecleo en ráfagas:** pausas cortas en que deja las manos quietas y lee la pantalla; la vista recorre la pantalla.
- **Sin cambios** en la máquina de estados ni en las reglas de evidencia: el personaje solo trabaja con evidencia
  vigente; vencido o sin datos, se va. Probado: con datos vencidos 0 personajes en escena.
- **Caminar hasta el escritorio:** ya existía (entrada/salida con camino puerta → silla) y se conserva. No se agregó
  un sistema de navegación nuevo: no hacía falta.

### Paneles (K6) — `app/vistas/panel.js`
- Arriba: **proyecto · tipo · DEMO/REAL**. Fila **Fuente** (nombre, generado hace, vigencia, conexión).
- Personaje: «Qué es» siempre visible (sin clasificar se dice explícitamente: no se presenta como agente autónomo) y
  **Desde la última evidencia** (con «hora simulada» en DEMO).
- Departamento: **Puestos** por naturaleza (p. ej. «1 automático, 2 reactivo»).
- **Cambios observados en esta sesión** para ese departamento o personaje, con su categoría.

### Celular (K7)
- Sala en una columna, cifras en 3 columnas compactas, botones de 44 px, sin desplazamiento horizontal (vertical y
  horizontal, probado). Entrar a inmersivo cierra la sala.

## 3. Defectos corregidos

| Defecto | Gravedad | Arreglo | Cómo se comprobó |
|---|---|---|---|
| `ek-chuah-pr2.cjs` fallaba solo con el paso de los días (2 casos) en `ce0688a` | Media (prueba falsa en rojo) | Las DEMO de la prueba se mueven a la hora actual, igual que las REAL | Corrida limpia de `ce0688a`: 17/19; tras el arreglo: 19/19 |
| Brazos y cabeza saltaban entre gestos; clips de Kenney cambiaban de golpe | Baja (visual) | Mezcla 0.35 s y pesos suavizados | Visual en capturas; `animaciones.cjs` sin cambios en verde |
| La barra 3D se partía en dos renglones con el detalle abierto | Baja | Accesos nuevos como icono (nombre en aria-label y título) | Captura `k-panel-departamento.png` |

## 4. Rendimiento (K8)

Medido con `pruebas/navegador/fase-k-capturas.cjs` (SwiftShader, 1366×768). **Las llamadas, triángulos, geometrías y
texturas sí son comparables con una GPU real; los cuadros por segundo de SwiftShader no.**

| Vista | Llamadas antes → después | Triángulos | Geometrías | Texturas |
|---|---|---|---|---|
| Edificio completo | 156 → 159 | 6243 → 6271 | 156 → 159 | 18 → 20 |
| Departamento enfocado | 118 → 119 | 5369 → 5371 | 156 → 159 | 18 → 20 |
| Un cuarto | 23 → 23 | 1435 → 1435 | 24 → 24 | 9 → 9 |
| Inmersivo | 106 → 107 | 4923 → 4925 | 157 → 160 | 18 → 20 |
| Celular (vertical y horizontal) | 156 → 159 | 6243 → 6271 | 156 → 159 | 18 → 20 |

- Sesión larga (fase-k.cjs): 24 aperturas de sala y 12 cambios de piso desde ella → geometrías 160→160, texturas
  20→20, nodos de la página estables. Las pruebas de memoria y estabilidad de fases anteriores siguen en verde.
- Sala abierta: 0 cuadros dibujados (probado).
- **Intel UHD: sin medir.** Con +2 % de llamadas, espero que se mantenga cerca de 60 cps, pero es una inferencia, no
  una medición.

## 5. Pruebas ejecutadas

Corridas el 2026-11-05 en este contenedor (Chromium + SwiftShader). Para separar lo mío de lo que ya existía, la
fase J (`ce0688a`) se corrió **limpia** en otra carpeta y otro puerto.

| Suite | `ce0688a` (fase J, limpia) | Fase K |
|---|---|---|
| Node (`pruebas/ejecutar.mjs`) y `pruebas.html` en Chromium | 218/218 | **230/230** |
| animaciones · auditoria-visual · brillo · compago-pr10 | 15 · 20 · 3 · 9 | 15 · 20 · 3 · 9 |
| ek-chuah-integracion · **ek-chuah-pr2** | 16 · **17/19 (2 fallas por fecha)** | 16 · **19/19** |
| estabilidad · fase-i · fase-j | 15 · 19 · 15 | 15 · 19 · 15 |
| inmersivo · memoria · movil-medidas · multiproyecto | 34 · 4 · 16 · 6 | 34 · 4 · 16 · 6 |
| regresion · naturaleza · e2-capturas | 47 · OK · OK | 47 · OK · OK (159 llamadas) |
| **fase-k.cjs** (nueva) | — | **48/48** |

`fase-k.cjs` cubre: sala (6 proyectos, pendientes, DEMO≠REAL, sin botones de acción, 3D en pausa, Esc y S), ir a
piso y a departamento desde la sala, teclas 0/R/A/F, seguir y soltar, puesto humano sin personaje, REAL con cambios
(alerta crítica primero, contador, historial en el panel), JSON a medias (sigue REAL), vencido (0 personajes),
sesión larga sin crecer recursos, WebGL perdido (2D + sala + reintentar), celular vertical y horizontal (sin
desplazamiento, botones de 44 px, menú ⋯), inmersivo y movimiento reducido. Cero errores de JavaScript.

Cambios a pruebas existentes (no reducen cobertura): `casos.js`, `casos-fase-i.js` y `fase-i.cjs` ahora esperan
los 6 proyectos del registro; `ek-chuah-pr2.cjs` mueve sus DEMO a la hora actual (ver §3).

## 6. Cambios de arquitectura

- `app/nucleo/sala.js` (sin DOM, probado en Node) concentra las reglas de la sala; `app/vistas/sala.js` solo dibuja.
- `cambios.js` agrega `departamento_id` y `agente_id` a cada cambio (aditivo; el tablero no cambia).
- `modelo.js` copia `color` del registro a `modelo.proyecto` (aditivo; no viene del contrato).
- La vista 3D expone `pausar(si)`; la 2D no lo necesita.
- **Acoplamientos que quedan** (no se tocaron para no romper compatibilidad): los temas de departamento se adivinan
  por palabras del id (`identidad.js`); `app.js` sigue concentrando el arranque, la sala y el selector (~400 líneas).
  Propuesta de fase L abajo.

## 7. Futuro centro de control (K10)

Solo diseño en `docs/CONTROL-FUTURO.md`: separación ver/actuar, el sistema ejecuta (no Cauce), catálogo cerrado de
acciones por sistema, autenticación en CauceService, permisos por proyecto, nunca acciones sobre DEMO/vencido,
confirmación, idempotencia contra doble envío y auditoría. **No se creó ningún botón, endpoint ni credencial.**

## 8. Riesgos y limitaciones

- **Rendimiento real sin medir** en la Intel UHD (fases H–K).
- El historial es **de la sesión**: se pierde al recargar. No se construyó base de datos (fuera de alcance).
- La DEMO no cambia sola, así que en DEMO la sección de cambios siempre está vacía: es correcto, no un fallo.
- 6 pestañas en la cabecera: en 1366 px caben en un renglón porque los pisos sin conexión muestran solo el punto.
  Con 8 o más proyectos conviene agruparlos (fase L).
- La preferencia «sala abierta» se recuerda en el navegador; quien la deje abierta verá la sala al volver.

## 9. Trabajo pendiente y fase L propuesta

| Mejora | Depende de | Valor |
|---|---|---|
| Medir H–K en la Intel UHD y decidir si se fusiona la cadena #14→#19 + K | **Diego** (5 min) | Alto: sin esto todo lo visual es provisional |
| Ver la sala con datos REAL de Compago (cambios reales, vencimientos reales) | **Ronny** (puente Docker → JSON) | Alto |
| Agrupar pisos «pendientes» en la cabecera cuando haya más de 7 proyectos | Independiente | Medio |
| Sacar de `app.js` el control de la sala y del selector a módulos propios | Independiente | Medio (mantenimiento) |
| Tema de cada departamento declarado en `escena/<id>.json` en vez de adivinarlo | Independiente | Medio |
| Historial que sobreviva a recargar (archivo local o CauceService) | **Autorización** (almacenamiento nuevo) | Medio |
| Pisos de Tezcatlipoca, CauceService y Repacar | **Acceso a sus repositorios** | Alto cuando existan |
| Acciones sobre procesos (docs/CONTROL-FUTURO.md) | **Autorización** + CauceService + dueño de cada sistema | Alto, pero no antes de lo anterior |

## 10. Versiones y commits

- Base: `ce0688a` (fase J, PR #19).
- `5cc531c` sala de control, recepción, navegación, paneles, personajes, pruebas y diseño del control futuro.
- `cf809c3` atajos visibles, guía de Windows, prueba de Ek Chuah que caducaba.
- Commit del informe: el último de la rama.
- Dependencias nuevas: ninguna (three.js y Kenney ya incluidos). Furniture Kit no hizo falta.
