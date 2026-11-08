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
- **Panel trasero bajo** con dos pantallas ambientales (pictogramas sin cifras que nunca cambian: «curva» y «mapa» en
  el Observatorio, «mapa» y «comparar» en Oportunidades) y un **tablero** encima con el nombre, la marca DEMO, una
  columna por función con su estado y, abajo, el enlace con la otra oficina.
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

| Vista | Sin estaciones (`?estaciones=0`) | Con estación |
|---|---|---|
| Compago, edificio | 97 llamadas · 12 963 triángulos · 28 texturas | 108 llamadas · ~16 100 triángulos · 40–45 texturas |
| Ek Chuah, edificio | 73 llamadas · 9 708 triángulos · 22 texturas | 84 llamadas · ~12 700 triángulos · 35 texturas |

+11 llamadas por piso: tablero (1), pantallas + luz del enlace en una sola malla (1), tres personajes (cuerpo e icono;
sin anillo de estado), y la decoración se fusiona con el cuarto. Sin luces, sombras ni partículas nuevas; el tablero
se redibuja solo si cambia lo que muestra; los datos se leen en el mismo ciclo de 30 s del piso (la escena del otro
piso, una vez). Las texturas nuevas son de los personajes de Kenney y los iconos (se cargan una vez).
**No se ha medido en la Intel UHD de Diego**: pasos en `docs/VALIDAR-ESTACIONES.md`.
