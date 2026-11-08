# Estaciones de trabajo dentro de las oficinas (2026-11-08)

**Regla de arquitectura (Diego):** una función nueva de un proyecto se representa como una **estación** (mesa,
equipo o zona de trabajo) dentro de un departamento que ya existe, no como un piso o un departamento nuevo. Solo una
función independiente y transversal a varios proyectos justificaría un espacio propio, previa evaluación.

## Qué hay

| Estación | Oficina › departamento anfitrión | Funciones (un personaje cada una) | Origen de la función |
|---|---|---|---|
| Observatorio Geopolítico y Macroeconómico | Ek Chuah › Análisis de riesgo | Analista macroeconómico (divisas, inflación, mercados) · Analista geopolítico (noticias, regulaciones, acontecimientos) · Analista de riesgos (verificación, alertas, implicaciones) | Ek Chuah PR #4 (borrador, sin fusionar) |
| Oportunidades Internacionales | Compago › Evaluación de oportunidades | Investigador de países y proveedores · Analista de importación, logística y aranceles · Evaluador de costos, márgenes y viabilidad | Compago PR #26 (borrador, sin fusionar) |

Por qué esos anfitriones: el Observatorio clasifica verificación y riesgos de acontecimientos, que es el trabajo de
«Análisis de riesgo»; Oportunidades Internacionales evalúa si una señal justifica investigar, que es lo que hace
«Evaluación de oportunidades». Se cambian en `escena/<proyecto>.json` › `estaciones.<id>.departamento`.

## Cómo se ve

- Una **mesa larga** con tres asientos, monitores y documentos, en una fila propia **delante** de los escritorios del
  departamento (los escritorios no se mueven; el cuarto crece una fila de 2.4 m hacia el pasillo).
- **Panel trasero bajo** con el **tablero** en su cara (nombre, marca DEMO, una columna por función con su estado y,
  abajo, el enlace con la otra oficina) y, a sus lados, dos pantallas ambientales (pictogramas sin cifras que nunca
  cambian: «curva» y «mapa» en el Observatorio, «mapa» y «comparar» en Oportunidades). El tablero no sobresale del
  panel (arriba a ~1.35 m) para no tapar, desde la cámara del edificio, los escritorios del departamento.
- Los personajes de la estación usan **cuerpos que el piso ya tiene a la vista** (mismo modelo de Kenney que algún
  personaje visible): no se descargan ni se suben a la GPU modelos nuevos. Si el piso no tiene a nadie a la vista,
  toman un modelo que ya se dibujó en la sesión. Consecuencia visible: con una sola persona a la vista (Compago DEMO),
  los tres se parecen a ella.
- Un objeto propio en el extremo izquierdo: un mapa de pie (Observatorio) o un globo terráqueo (Oportunidades).
- Una **luz** en el extremo derecho de la mesa: azul claro solo con una transferencia confirmada por las dos partes;
  ámbar apagado si solo un lado la registra; gris sin datos.
- Pantallas de los monitores: apagadas sin registro; del color del estado cuando hay un registro o un proceso.

## Qué representan los personajes

Son **funciones del sistema**, no agentes de IA ni procesos encendidos. No se ejecuta ningún modelo.

| Estado del puesto | Postura |
|---|---|
| Sin actividad | sentado, espera (respira, mira la pantalla) |
| Señal recibida · Investigación pendiente · Evaluación disponible | **consulta**: inclinado, lee un documento, pasa la hoja; no teclea |
| Datos insuficientes · Riesgo detectado | pide atención (mano levantada) |
| En proceso (con evidencia e inicio) | teclea — **único** caso de trabajo |
| Sin información (sin archivo, vencido, inválido) | silla vacía |

Gestos de transición solo ante un cambio observado entre dos lecturas. Con «reducir movimiento» del sistema, posturas
fijas. Animación ambiental (respirar, mirar, pasar la hoja) ≠ actividad real: la actividad real la dicen el estado,
la pantalla encendida, el tablero y el panel, siempre con su fuente.

## Interacciones

- Tocar el tablero, la mesa o las pantallas → detalle de la **estación** (función, estado, origen, contrato de origen,
  fuente y vigencia, puestos, datos disponibles, datos que faltan, enlace) y la cámara se acerca.
- Tocar un personaje o su silla → la misma estación con **ese puesto marcado**.
- Detalle del departamento anfitrión → lista «Estaciones de trabajo» con botón.
- «Un cuarto» → la estación aparece con su departamento anfitrión.
- Plano 2D → botón de la estación dentro del cuarto anfitrión.
- `?estaciones=0` → el mismo edificio sin estaciones (para medir A/B).

## Qué es real y qué es demostración

| Dato | Hoy |
|---|---|
| Que la función existe y en qué PR está | Real (leído de los PR #4 de Ek Chuah y #26 de Compago, sin modificarlos) |
| Estados, conteos, faltantes y enlace que se ven | **Demostración** (`datos/demo/*-estaciones.json`, escritos a mano, rotulados DEMO) |
| Acontecimientos, señales, proveedores, cotizaciones | **Ninguno**: no hay ninguno real en Cauce |
| Transferencia Ek Chuah → Compago | **Demostración**: ambas demos registran `SEN-DEMO-ARANCEL-01`; no existe un envío real |

Con un piso REAL y sin `datos/reales/<proyecto>-estaciones.json`, la estación queda con las sillas vacías y el panel
dice que falta su exportador. Nunca usa la demostración en su lugar.

## Contratos

- `cauce.estado-proyecto` 1.0.0: **sin cambios**.
- `cauce.estaciones` 0.1.0 (nuevo, propuesta): ver `contrato/ESTACIONES-CONTRATO.md`, con lo que falta en Ek Chuah y
  Compago para conectarse y el desalineamiento actual entre `ek-chuah.observatorio` y `ek-chuah.senales-economicas`.

## Rendimiento (SwiftShader, no es la Intel UHD)

Medido en Chromium con SwiftShader (cuenta objetos; **no** mide cuadros por segundo de la Intel UHD):

| Vista | Sin estaciones (`?estaciones=0`) | Con estación |
|---|---|---|
| Compago, edificio | 97 llamadas · 27 texturas | 108 llamadas · 32 texturas (presupuesto ≤ 32) |
| Ek Chuah, edificio | 73 llamadas | 84 llamadas |

+11 llamadas por piso: tablero (1), pantallas + luz del enlace en una sola malla (1), tres personajes (cuerpo e icono;
sin anillo de estado), y la decoración se fusiona con el cuarto. Sin luces, sombras ni partículas nuevas; el tablero
se redibuja solo si cambia lo que muestra; los datos se leen en el mismo ciclo de 30 s del piso.

Texturas (+5 en Compago): tablero (1), **un solo atlas** para los iconos de los 8 estados (1, creado al iniciar, así
que no crece al aparecer estados nuevos) y una textura de huesos por personaje animado (3, ~1 KB cada una). Para
caber en el presupuesto se cambiaron dos cosas que también benefician a los personajes que ya existían:

- cuerpo y cabeza de cada personaje de Kenney traían dos esqueletos idénticos; ahora comparten uno (una textura de
  huesos y una actualización por cuadro por personaje, no dos). Base sin estaciones: 28 → 27 texturas;
- los personajes de estación reutilizan modelos ya dibujados (ver arriba), así que recorrer los 4 pisos varias veces
  no deja texturas ni geometrías de más.

`?medir=1` muestra ahora también `texturas_huesos` y `texturas_imagen` en `__cauce3d.metricas()`.
**No se ha medido en la Intel UHD de Diego**: pasos en `docs/VALIDAR-ESTACIONES.md`.
