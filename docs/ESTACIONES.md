# Estaciones de trabajo dentro de las oficinas (2026-11-08)

**Regla de arquitectura (Diego):** una función nueva de un proyecto se representa como una **estación** (mesa,
equipo o zona de trabajo) dentro de un departamento que ya existe, no como un piso o un departamento nuevo. Solo una
función independiente y transversal a varios proyectos justificaría un espacio propio, previa evaluación.

## Qué hay

| Estación | Oficina › departamento anfitrión | Funciones (un personaje cada una) | Origen de la función |
|---|---|---|---|
| Observatorio Geopolítico y Macroeconómico | Ek Chuah › Análisis de riesgo | Analista macroeconómico (divisas, inflación, mercados) · Analista geopolítico (noticias, regulaciones, acontecimientos) · Analista de riesgos (verificación, alertas, implicaciones) | Ek Chuah PR #4 (borrador, sin fusionar) |
| Oportunidades Internacionales | Compago › Evaluación de oportunidades | Investigador de países y proveedores · Analista de importación, logística y aranceles · Evaluador de costos, márgenes y viabilidad | Compago PR #26–#28 (borradores, sin fusionar) |

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
- Los tres personajes de cada estación usan **tres modelos fijos y distintos** de Kenney (`MODELOS_ESTACION` en
  `kenney.js`: female-d, male-a, male-c), ya incluidos en el repositorio. Antes reutilizaban el modelo de las
  personas a la vista y en Compago DEMO los tres eran iguales; ahora se distinguen a simple vista. Cuesta 2 pieles de
  modelo en la GPU, compensadas con las mejoras de abajo.
- Un objeto propio en el extremo izquierdo: un mapa de pie (Observatorio) o un globo terráqueo (Oportunidades).
- Una **luz** en el extremo derecho de la mesa: azul claro solo con una transferencia REAL confirmada por las dos
  partes; **ámbar** si la confirmación es de demostración (y el tablero dice «transferencia de DEMOSTRACIÓN (no es
  real)»); ámbar apagado si solo un lado la registra; gris sin datos.
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
| Que la función existe y en qué PR está | Real (leído de Ek Chuah PR #4 y Compago PR #26–#28, sin modificarlos) |
| Estados, conteos, faltantes y enlace que se ven | **Demostración** (`datos/demo/*-estaciones.json`, escritos a mano, rotulados DEMO) |
| Acontecimientos, señales, proveedores, cotizaciones | **Ninguno**: no hay ninguno real en Cauce |
| Transferencia Ek Chuah → Compago | **Demostración**: ambas demos registran `SEN-DEMO-ARANCEL-01`; no existe un envío real |

Un piso DEMO vigente dice «Demostración vigente» (no «En línea»), para no sugerir que el proyecto real está
funcionando.

Con un piso REAL y sin `datos/reales/<proyecto>-estaciones.json`, la estación queda con las sillas vacías y el panel
dice que falta su exportador. Nunca usa la demostración en su lugar.

## Contratos

- `cauce.estado-proyecto` 1.0.0: **sin cambios**.
- `cauce.estaciones` 0.1.0 (nuevo, propuesta): ver `contrato/ESTACIONES-CONTRATO.md`. Ahí se separan el canal
  comercial Ek Chuah → Compago (`senales-economicas` 0.2.0, ya resuelto en Compago PR #27, no pasa por Cauce) y el
  estado de estaciones hacia Cauce (sin exportador en ninguno), con la especificación exacta para cada proyecto.
- Lector de la salida de Compago `estado_internacional` 0.1.x (`app/nucleo/estaciones-compago.js`): cuando Compago
  la escriba en un archivo, Cauce ya la traduce a `cauce.estaciones` sin cambios de código.

## Rendimiento (SwiftShader, no es la Intel UHD)

Medido en Chromium con SwiftShader (cuenta objetos; **no** mide cuadros por segundo de la Intel UHD):

| Vista (edificio) | 9c002f0 sin estaciones | 9c002f0 con estación | Ahora sin estaciones | Ahora con estación |
|---|---|---|---|---|
| Compago | 97 llamadas · 27 texturas | 108 · 32 | **78 · 26** | **89 · 32** |
| Ek Chuah | 73 | 84 | — | **71 · 29** |
| Montambre | 49 | — | 39 | — |
| CSI | 84 | — | 71 | — |

Presupuestos de fase M: ≤ 110 llamadas y ≤ 32 texturas. Compago pasa de 2 llamadas de margen a **21**; las texturas
siguen justas (32) porque los dos modelos nuevos que distinguen a los personajes ocupan lo que se ahorró.

Qué se cambió (sin reescribir el renderizador ni perder calidad visible):

- **Fusión entre cuartos** (`fusionarEntreCuartos`, `oficina.js`): los muebles y paredes estáticos de todos los
  cuartos de un piso que comparten material se juntan en una sola malla (antes, una por cuarto). Comparado píxel a
  píxel con `?fusion=0`: idéntico en Compago y Montambre; 9–30 píxeles distintos en Ek Chuah y CSI, por animación.
- **Charcos de luz** del techo con la misma textura radial blanca de las sombras, teñida por color (−1 textura).
- **Iconos de estación dentro del atlas de burbujas** de estado (−1 textura).
- Cuerpo y cabeza de cada personaje comparten esqueleto (de 9c002f0).
- Sin luces, sombras ni partículas nuevas; el tablero se redibuja solo si cambia lo que muestra; recorrer los pisos
  varias veces no deja geometrías ni texturas de más (prueba de 4 idas y vueltas).

`?medir=1` muestra además cuadro p50/p95/p99, cps del 1 % más lento y memoria JS; `?fusion=0` apaga la fusión para
comparar. **No se ha medido en la Intel UHD de Diego**: `herramientas\medir-estaciones.bat` lo hace solo
(`docs/VALIDAR-ESTACIONES.md`).
