# Fase M: renovación visual del edificio 3D

Rama de trabajo apilada sobre la fase L (PR #21) **más** la rama de rendimiento UHD (brillo ligero, escena quieta
sin redibujar, herramienta A/B), que Diego aprobó incluir. Contrato JSON v1, `datos/`, `escena/` y exportadores:
**sin cambios** (`git diff` vacío en esas carpetas).

## 1. Qué cambió

**A. Arquitectura y materiales** (`estilo-visual.js`, `arquitectura.js`, `oficina.js`)
- Paleta por proyecto: Compago (comercial) muros arena, fachada café, roble, acentos ámbar; Ek Chuah
  (financiero) muros salvia, fachada verde pizarra, nogal, latón. Proyectos sin estilo: la paleta de siempre.
- Muros interiores de 16 cm con remate claro, franja del acento por dentro y zócalo en los dos muros.
- Mamparas con riel inferior y parteluces cada ~1.2 m; umbral en cada puerta.
- Fachada con zócalo oscuro, cornisa y alféizar; banqueta clara alrededor; franja de tránsito en los pasillos;
  frente con escalón, árboles en jardineras, bancas y faroles.
- 4 tipos de piso según el trabajo del cuarto (duela, alfombra modular, concreto pulido, vinil), distintos
  entre proyectos.

**B. Interiores con identidad** (`interiores.js`, `zonas-cuarto.js`, `mobiliario.js`)
- Cada tipo de trabajo tiene su familia: tarima, banda con cajas y pantallas de archivos (Importación); globo,
  corcho y paneles de búsqueda (Proveedores); archiveros, estaciones de pie y pizarrón (Listas / Informes);
  mesa de análisis y pantallas comparativas o de escenarios (Evaluación / Simulaciones); muro de 3 pantallas
  (Márgenes / Riesgo); archivo alto, mesa con lámpara de inspección y panel de historial (Auditoría); consola
  y mosaico (Supervisión); gabinetes con charola de cables y red (UNIQ / Datos).
- Un colocador revisa que **ningún mueble toque escritorios, sillas, el pasillo de la puerta ni el camino de
  un personaje** (probado con 1–12 puestos, 3 tamaños de cuarto, 9 temas y 3 estilos).
- Pantallas ambientales: un atlas de 12 pictogramas **sin cifras ni ejes con valores**, en colores fríos que
  no son colores de estado. Estáticas. Se **atenúan** (0.85 → 0.3) si el piso no tiene datos vigentes.

**C. Iluminación ligera**: sombras de contacto al pie de muros (1 llamada para todo el edificio), luz cálida
por departamento que se nota más de noche, resplandor sobre el escritorio **solo** cuando la pantalla del puesto
está encendida por evidencia. Sin sombras dinámicas ni posproceso nuevo. Brillo, Luz fija y Bajo consumo intactos.

**D. Cámara**: la rueda acerca hacia el puntero; viajes de 0.45–0.9 s según distancia con arranque y frenado
suaves; en celular vertical el edificio se gira hasta 0.5 rad y se ve ~29 % más grande (área en pantalla
47 900 → 61 600 px²). `?giro=0` lo desactiva para comparar. Escritorio y celular horizontal quedan a 45°.

**E. Animaciones honestas**: la pantalla de un puesto cambia de color en 0.4 s cuando el cambio se **observó**
entre dos lecturas (la primera lectura y «reducir movimiento» la ponen directo). No hay animaciones ambientales
continuas: romperían la «escena quieta» (1 cuadro/s) que ahorra GPU. No se agregó ningún personaje.

## 2. Capturas

`/mnt/project-files/cauce/fase-m/capturas/`: `antes/`, `despues/` y `comparativas/` (lado a lado) de Compago y
Ek Chuah: edificio, acercamiento, recepción, oficina enfocada, inmersivo, un cuarto, noche y celular.

## 3. Pruebas

| Conjunto | Resultado |
|---|---|
| Node (`node pruebas/ejecutar.mjs`) | **268 pasaron, 0 fallaron** (11 nuevas de fase M) |
| `pruebas.html` en Chromium | **268 = 268** |
| Chromium, todas (`pruebas/navegador/todas.cjs`) | **25/25 scripts en verde** (incluye `fase-m.cjs` nuevo) |

`fase-m.cjs` comprueba: Compago y Ek Chuah, presupuesto de recursos, DEMO/REAL, REAL vencido (pantallas
atenuadas, nadie en escritorios, ningún resplandor), cámara (1/0/rueda), inmersivo, un cuarto, 2D, bajo consumo,
Tezcatlipoca sin edificio, 6 idas y vueltas entre proyectos sin crecer geometrías ni texturas, celular sin
desplazamiento horizontal. Ajuste a una prueba anterior: `fase-l.cjs` subió su límite de texturas de 26 a 32
(+6 texturas chicas de esta fase), con la razón escrita en la prueba.

## 4. Métricas gráficas (SwiftShader, comparables entre versiones)

| Escena | Llamadas | Triángulos | Texturas |
|---|---|---|---|
| Compago edificio / inmersivo | 83 → **97** | 9 363 → **12 963** | 22 → 28 |
| Compago enfocado | 64 → 75 | 9 145 → 12 729 | 22 → 28 |
| Compago un cuarto | 13 → 15 | 1 723 → 2 087 | 8 → 13 |
| Ek Chuah edificio / inmersivo | 63 → **73** | 6 752 → **9 708** | 16 → 22 |
| Brillo ligero (Compago) | 117 → 131 | 9 702 → 13 320 | — |

Referencia medida por Diego en Intel UHD (fase G): 170 llamadas y 6 257 triángulos a 61 cps. Las llamadas
siguen muy por debajo; los triángulos se duplican respecto a esa referencia pero siguen siendo pocos.

Trabajo por cuadro (`rendimiento.cjs`, misma máquina): sin pasadas de pantalla completa nuevas, JavaScript por
segundo igual (34 ms/s), escena quieta sigue en **1 cuadro/s**. **Señal a vigilar**: los cuadros por segundo de
SwiftShader bajaron ~15 % (27 → 23 en el edificio). SwiftShader dibuja con la CPU y castiga mucho las capas
transparentes (sombras de contacto, luz, resplandor); no predice la Intel UHD, pero es el primer lugar a revisar
si tu medición sale baja.

## 5. Limitaciones de la medición

- **No medí en Intel UHD.** Todo lo de arriba es SwiftShader. No afirmo 60 cps reales.
- La guía `docs/VALIDAR-FASE-M.md` dice qué medir (5 casos) y cómo copiar la medición.

## 6. Problemas detectados y corregidos

- `paletaDe("__proto__")` devolvía un objeto vacío (lo encontró la prueba nueva): ahora se usa `Object.hasOwn`.
- El segundo gabinete de UNIQ se encimaba con el primero (colocador): movido.
- El concreto con manchas grandes se veía sucio: cambiado a moteado fino.

## 7. Guía para Windows

Ver `docs/VALIDAR-FASE-M.md` (10–15 minutos).

## 8. Mejoras futuras

**Imprescindibles**
1. Medir en tu Intel UHD los 5 casos de la guía (normal, brillo, inmersivo, enfocado, Ek Chuah).
2. Si baja de 50 cps: primero quitar el resplandor y las sombras de contacto con un interruptor `?ligero=1`
   (son las capas transparentes que más cuestan) antes de tocar muebles.

**Opcionales**
- Instancing de plantas y sillas si algún día hay más de 30 puestos (hoy no se justifica: todo lo estático ya
  se fusiona por color de vértice).
- Furniture Kit de Kenney (CC0) cuando llegue el ZIP, para sustituir piezas hechas con código.
- Pantallas ambientales con el color de acento de cada departamento (costaría 1 textura por cuarto).
- Segundo nivel del edificio: no lo recomiendo aún; complica la navegación sin mejorar el monitoreo.
