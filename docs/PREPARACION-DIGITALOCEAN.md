# Cauce AI Center · versión visual candidata y preparación para DigitalOcean · 2026-11-09

**Documento de preparación.** No se desplegó nada, no se cambió ningún servidor, no se fusionó ningún PR y no se tocaron otros repositorios. Los contratos (`cauce.estado-proyecto` 1.0.0 y `cauce.estaciones` 0.1.0) y la separación DEMO/REAL quedan **sin cambios**.

## 0. Versión candidata exacta

- Rama: `claude/ascensor-y-vida-cuarto`.
- PR #35, en borrador. Su base es la rama del PR #34 (`claude/project-thread-13jxhn`), y este sale de `main` e1891b5.
- **Commit candidato del código: 0b6c66a.** Los commits posteriores solo añaden documentación.
- Para publicar hay que fusionar primero #34 y luego #35. El #29 ya va incluido. Esa decisión es tuya.

## 1. Fallo intermitente de `ascensor.cjs` («redirigir a media salida»)

**Veredicto: eran las dos cosas, un defecto real de sincronización y una prueba frágil.**

### El defecto real

- **Qué pasaba.** Eliges Ek Chuah y, mientras la cámara todavía sale de Compago, eliges Montambre. Si los datos de Ek Chuah ya habían llegado y los de Montambre tardaban más que la salida (0.3 s), al terminar la salida **se dibujaba Ek Chuah**, un piso ya descartado. Montambre aparecía después. El edificio pasaba un instante por el piso equivocado.
- **Reproducción determinista:** se retrasan 900 ms los datos de Montambre y la redirección se hace en el mismo cuadro en que la salida sigue en curso. Resultado: **5 de 5** veces se dibujaba Ek Chuah con el código anterior, **0 de 5** con el corregido.
- **Gravedad: media.** No da datos falsos, porque cada piso muestra sus propios datos con su marca DEMO o REAL. Pero muestra un piso que no pediste, y en un servidor real, con más latencia que en local, sería más frecuente.
- **Corrección** en `app/vistas/vista3d/escena3d.js`: durante el viaje, un modelo de piso que no es `ascensor.destino` se descarta, y el piso guardado en espera se tira si dejó de ser el destino.

### La fragilidad de la prueba

- La prueba comprobaba desde Playwright que la cámara iba «saliendo», y el segundo clic llegaba entre 100 y 300 ms después.
- Con la máquina cargada, la salida ya había terminado y Ek Chuah se dibujaba legítimamente, porque se había llegado a él. La prueba fallaba sin que hubiera defecto.

### Cómo quedó la prueba

- La redirección se hace **dentro de la página**, en el mismo cuadro en que se comprueba la salida. No se amplió ningún tiempo de espera.
- Caso nuevo: «redirigir con los datos del destino lentos (900 ms)». **Falla con el código anterior** y pasa con el nuevo.
- `ascensor.cjs`: 33/33 en tres corridas seguidas.

## 2. Pruebas

- Node: **445 pasaron, 0 fallaron**.
- Batería completa Chromium (SwiftShader) sobre 0b6c66a: **36/36 guiones en verde** (sin repetir ninguno).
- SwiftShader comprueba comportamiento y cuenta recursos. **No mide cps.** Los cps reales son los de la Intel UHD medidos en adf51ef: 60.6 en «Un cuarto» y 57.6 durante el ascensor. Lo que cambió después no toca el dibujo de la escena.

## 3. Tamaño de los archivos desplegables (medido)

Son los archivos que la aplicación pide en una sesión completa: los 7 pisos, «Un cuarto», Plano 2D, Sala de control, Nexus, CSI e Inmersivo. Más abajo se añaden los que se usan solo con «Brillo».

| Grupo | Archivos | Tamaño | Con gzip (estimado) |
|---|---|---|---|
| Modelos Kenney (`.glb`) y su textura | 12 + 1 | 2 734 KB | 417 KB |
| Three.js (`vendor/three/`, módulo y complementos) | 7 | 2 294 KB | 459 KB |
| JavaScript propio (`app/`) | 78 | 830 KB | 284 KB |
| Datos JSON (`datos/`: registro, DEMO, Nexus y CSI de prueba, candidatas) | 19 | 255 KB | 48 KB |
| CSS | 1 | 59 KB | 14 KB |
| Escena JSON (`escena/`) | 6 | 11 KB | 5 KB |
| HTML (`index.html`) | 1 | 5 KB | 2 KB |
| **Total usado** | **124** | **≈ 6.2 MB** | **≈ 1.2 MB** |

Hay que publicar además lo que la sesión medida no pidió pero la aplicación sí usa:

- **«Brillo»** (`vendor/three/examples/jsm/postprocessing/` y `shaders/`): unos 48 KB. Solo se descargan si alguien enciende «Brillo».
- **Un modelo más** (`character-female-e.glb`, 248 KB).
- **Las licencias** (`vendor/three/LICENSE`, `vendor/kenney-mini-characters/License.txt`).

**Despliegue completo estimado: ≈ 6.5 MB.** El repositorio entero ocupa 7.8 MB, más 4.6 MB del historial de git.

## 4. Primera carga sin caché (medido en Chromium, desde el navegador)

Perfil nuevo, caché desactivada, `http://127.0.0.1:8765/`, hasta que el edificio de Compago quedó armado (9 s).

| | Primera carga | Sesión completa (recorriendo todo) |
|---|---|---|
| Solicitudes HTTP | **116**: 108 correctas y 8 «no existe» esperadas | 265, de ellas 124 archivos distintos |
| Bytes de archivos descargados | **≈ 4.97 MB** sin comprimir | ≈ 6.2 MB distintos |
| Con gzip o brotli en el servidor (estimado) | **≈ 1.0 MB** | ≈ 1.2 MB |
| Lo más pesado | Three.js 2.29 MB, 8 modelos 1.76 MB, 77 módulos propios 0.83 MB | |

- `servir.py` **no comprime**. Lo que medí transferido en local, unos 4.5 MB, es el tamaño real de los archivos. Las cifras con gzip son una estimación: comprimí cada archivo con nivel 6. Lo que transfiera DigitalOcean depende de que el servicio comprima, y **está por verificar** en el alojamiento real.
- **Diferencia entre lo que se carga y lo que se despliega.**
  - La primera carga baja ≈ 5.0 MB (≈ 1.0 MB comprimido), de los ≈ 6.5 MB desplegables.
  - El resto se baja solo al usarlo: otros pisos, Nexus, CSI, Brillo y algunos modelos.
  - Las 8 respuestas «no existe» son normales: `datos/proyectos.local.json` y `datos/reales/<id>.json`. Sin datos reales, la aplicación cae a los DEMO.
- **Lecturas periódicas.** Cada 30 s la página vuelve a leer el archivo de estado de cada piso: 7 lecturas, de unos 2 a 8 KB cada una si hay datos reales. Con una pestaña abierta eso da del orden de **1 a 7 MB por hora** sin comprimir. Es una estimación según el tamaño de los archivos DEMO.
- **77 módulos JavaScript sueltos.** No hay paso de compilación: cada módulo es una solicitud. Con HTTP/2, que es lo habitual con HTTPS, no es un problema. No propongo empaquetar ahora, porque añadiría una herramienta de build que hoy no existe.

## 5. Qué no debe publicarse

La forma segura de publicar es **partir de una copia limpia de git del commit candidato**, nunca de la carpeta de la MSI. La carpeta de la MSI tiene archivos locales que git ignora a propósito.

| No publicar | Por qué |
|---|---|
| `pruebas/`, `pruebas.html`, `prototipos/` | Solo pruebas (650 KB). `pruebas.html` ejecuta las pruebas en el navegador del visitante |
| `herramientas/` (`medir-*.bat/.ps1`, `csi.mjs`, `nexus-demo.mjs`, …) | Herramientas locales. Algunas escriben archivos o cambian la preferencia de GPU de Windows |
| `servir.py`, `*.bat` (`iniciar`, `probar`, `conectar_compago`, `conectar_ek_chuah`, `ABRIR-CIERRE`) | Servidor y atajos locales. `servir.py --recibir-mediciones` acepta escrituras |
| `docs/`, `contrato/`, `README.md`, `package.json`, `.git/`, `.gitignore`, `.gitattributes` | Documentación interna, especificaciones e historial |
| `mediciones/`, `r/`, `comparar/`, `__pycache__/` | Resultados de medición, capturas y copias de comparación locales |
| **`datos/csi/historico/*` y `datos/csi/registro/*`** | **Privado**: el caso histórico real y el almacén real de CSI |
| **`datos/nexus/registro/*`, `respaldos*/`, `restauraciones/`** | **Privado**: el registro real de Nexus y sus respaldos |
| `datos/proyectos.local.json`, `datos/reales/*.json` | Datos **REALES**. Solo con control de acceso, ver §6 |
| `?medir=1`, `?recorrido=1`, `?auto=…` | No son archivos, sino modos de medición dentro de la página. No hacen daño (solo leen, y el envío de informes falla sin el servidor local), pero no conviene enlazarlos |

**Decisiones tuyas antes de publicar.** Son archivos que hoy están en git y la aplicación usa:

1. `datos/nexus/candidatas/ek-chuah/EK-L001/003/007.json` son borradores de **lecciones reales** de Ek Chuah. Nexus los muestra. ¿Se publican?
2. `datos/csi/casos-publicados/expediente-bns-2015.json` es el expediente público del caso BNS 2015. Si el Laboratorio de IA va a usarlo como banco a ciegas, publicarlo facilita reconstruir sus defectos.
3. `datos/demo/informes/ejemplo.html` (DEMO). La sesión no lo pidió; se puede quitar o dejar.

## 6. Requisitos para alojar solo la visualización 3D y sus JSON

**Lo que necesita (comprobado en el código y en pruebas):**

- **Un servidor de archivos estáticos con HTTPS.** No hace falta Node, Python, base de datos ni procesos en el servidor. Se sirve igual en `/` que en `/cauce/`; todas las rutas son relativas y está probado con `servir.py --base /cauce/`.
- **Tipos MIME correctos:**
  - `.js` como `text/javascript`, porque los módulos ES no cargan con otro tipo;
  - `.json` como `application/json`;
  - `.glb` como `model/gltf-binary` (o `application/octet-stream`);
  - `.png` y `.css` con su tipo normal.
- **Un 404 de verdad para lo que no existe. Es crítico.**
  - Comprobado: si el servidor responde con el `index.html` y un 200, como hacen muchos sitios de una sola página, la aplicación ya no cae a los DEMO y muestra «Archivo inválido».
  - En App Platform: **no** configurar un documento «catch-all» que devuelva `index.html`.
- **Cabeceras recomendadas:**
  - `X-Content-Type-Options: nosniff`, `Referrer-Policy: no-referrer` y `Content-Security-Policy: frame-ancestors 'self'`, iguales a las de `servir.py`. La última va ajustada al dominio de CauceService si se incrusta.
  - `Cache-Control: no-cache` con revalidación (ETag) para `index.html`, `app/` y `datos/`. Los nombres de archivo no llevan huella, así que una caché larga mezclaría versiones al actualizar. `vendor/` sí admite una caché larga.
- **Compresión gzip o brotli** del lado del servidor. Baja la primera carga de ≈ 5 MB a ≈ 1 MB (estimado).
- **Espacio:** ≈ 6.5 MB más los JSON reales, del orden de decenas de KB.

**Lo que el alojamiento no resuelve por sí solo:**

1. **Acceso a los datos REALES.**
   - El repositorio es público y la página no tiene inicio de sesión: un sitio estático abierto dejaría `datos/reales/*.json` a la vista de cualquiera. Ahí estarían el estado de Compago y Ek Chuah, con datos de inversión.
   - Opciones:
     - (a) **Publicar solo DEMO**. Es lo único 100 % seguro en un sitio estático abierto.
     - (b) Servirlo **detrás de CauceService**, con su autenticación, que es lo que recomienda `docs/INTEGRACION-PORTAL-CAUCE.md`.
     - (c) Un servidor con autenticación básica.
   - Un iframe no es seguridad.
2. **Cómo llegan los JSON reales al servidor.** Hoy los escriben los adaptadores en la MSI. Hace falta un canal: el puente de Ronny, o subir los archivos con un proceso aparte. Eso no es parte de la visualización.
3. **Costo.**
   - Según lo que conozco, DigitalOcean ofrece sitios estáticos en App Platform sin costo con un límite de transferencia mensual, y Droplets desde unos pocos dólares al mes. **No lo verifiqué en esta sesión:** los precios y límites cambian y hay que confirmarlos en su página antes de decidir.
   - Con tu presupuesto de $0, la opción (a) en App Platform estático encaja. La (b) depende de dónde viva CauceService.

## 7. Cómo comprobarlo

- **Batería y Node:** `node pruebas/ejecutar.mjs` y `node pruebas/navegador/todas.cjs`, con `servir.py` corriendo.
- **Fallo del ascensor:** el caso «redirigir con los datos del destino lentos» de `ascensor.cjs`.
- **Tamaños y solicitudes:** abre `http://127.0.0.1:8765/` en Edge, con las herramientas de desarrollo en la pestaña Red, «Deshabilitar caché» marcado y recarga. Debe dar del orden de 116 solicitudes y unos 5 MB.
- **Copia limpia para publicar:** `git archive 0b6c66a index.html app vendor escena datos | tar -x -C <carpeta>`. Después quita de esa carpeta lo marcado en §5 según tu decisión.
