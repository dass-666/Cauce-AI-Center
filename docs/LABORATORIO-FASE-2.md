# Laboratorio de IA · fase 2: flujo vertical, revisión humana y departamento en la oficina

Rama `claude/project-thread-g7h0tv`, encadenada sobre la del PR #28 (que va sobre la del #27). No toca el PR #29
(ascensor) ni `app/vistas/vista3d/`. Todo es DEMO y **sin modelo**: no hay ninguna IA conectada.

## 1. Qué IA existía antes de empezar (auditoría, actualizada)

Fuentes: auditoría del 2026-11-07 (`INFORME-CIERRE-26-Y-LABORATORIO-IA.md`, §3) y verificación de hoy en este
repositorio. Lo que **no** volví a verificar hoy lo marco así.

| Componente | Estado | Qué es en realidad |
|---|---|---|
| Cauce AI Center (oficina, adaptadores, sala de control, ascensor) | IMPLEMENTADO · determinista | Reglas y visualización. Hoy: `grep` de anthropic/openai/ollama/api_key en `app/`, `herramientas/`, `datos/` → cero integraciones con modelos. |
| «Gerentes», «agentes» y personajes de la oficina | SOLO VISUAL | Representan estados que exporta cada motor; no deciden ni ejecutan. |
| Compago | IMPLEMENTADO · determinista | Sin IA ni bots autónomos; único proceso automático: consumidor de importaciones (auditoría 2026-11-07, no re-verificado hoy). |
| Ek Chuah | PARCIAL · **única IA real** | Tareas programadas de la app de Claude (análisis semanal y revisión mensual). Según la auditoría del 2026-11-07 no producía archivos desde el 20-oct. **No re-verificado hoy**: la carpeta de Ek Chuah en la MSI no está conectada a esta sesión. |
| Tezcatlipoca / El Fiscal | IMPLEMENTADO (Fiscal) · determinista | El Fiscal es un auditor sin IA. Tezcatlipoca no tiene repositorio accesible ni exportador: **NO EXISTE integración**. |
| Nexus | IMPLEMENTADO · determinista | Gerente con reglas R01–R10; aprobador humano declarado. Reutilizado aquí: `validarLeccion`, `evaluarLeccion`, huellas, búsqueda de datos privados. |
| CSI | IMPLEMENTADO · determinista | Investigación, Abogado del Diablo por código, simulador sin probabilidades. Reutilizado: detector de estrategias financieras (`lenguaje.js`). |
| Laboratorio fase 1 + 1.1 (#27, #28) | IMPLEMENTADO · sin modelo | Contratos encargo/ejecución/verificación, lab-V, registro, banco BNS, piloto empaquetado (no ejecutado). |
| Integraciones con Claude/otros proveedores desde código | NO EXISTE | Una suscripción de chat no da acceso a la API. No hay credenciales y el presupuesto es $0. |
| Ollama u otro modelo local | NO EXISTE | No instalado ni autorizado. |
| Autorización humana | PARCIAL | Identidad **declarada** (sin autenticar) en Nexus y ahora en el Laboratorio. |
| Trazabilidad | IMPLEMENTADO | Registros solo-anexados con huellas encadenadas (Nexus, CSI, Laboratorio). |
| Separación DEMO/REAL | IMPLEMENTADO | `es_demo` en todos los contratos; registros separados por nombre; ids `demo-…`. |

## 2. Qué se construyó (fase 2)

Flujo vertical funcional, de punta a punta:

```
Motor (documento v1 que ya lee la oficina, SOLO LECTURA)
  → ficha citable (motores.js, determinista, con huella)
  → solicitud de una persona (cauce.lab.trabajo, estado «pendiente»)
  → Coordinador (código): Investigador → Analista → Abogado del Diablo   (cada uno = un encargo + una ejecución)
  → Verificador lab-V (código) comprueba cada cita contra la ficha y su huella
  → informe consolidado (cauce.lab.informe) → «requiere_evidencia» o «requiere_revision»
  → una PERSONA aprueba, rechaza o pide evidencia (nombre + motivo)
  → (opcional) propuesta para Nexus, solo si se aprobó; nunca se escribe en su almacén
```

| Pieza | Archivo |
|---|---|
| Lectura de motores → ficha citable | `app/laboratorio/motores.js` |
| Trabajo: contrato, estados, transiciones, historial | `app/laboratorio/trabajo.js` |
| Coordinador (avanzar, reintentar, decidir, interrupción) | `app/laboratorio/coordinador.js` |
| Adaptadores intercambiables (sin modelo, manual, Ollama no disponible), reintentos y límite de tiempo | `app/laboratorio/adaptadores.js` |
| Guion DEMO sin modelo (no es IA) | `app/laboratorio/guion-demo.js` |
| Informe consolidado + Markdown | `app/laboratorio/informe.js` |
| Propuesta a Nexus | `app/laboratorio/propuesta-nexus.js` |
| Trabajos DEMO de punta a punta | `app/laboratorio/escenarios-demo.js` |
| Registro: tipos `trabajo` e `informe` | `app/laboratorio/registro.js` |
| Herramienta: `flujo-demo`, `trabajos`, `revisar` | `herramientas/laboratorio.mjs` |
| Departamento en la oficina (tecla **L**, `?laboratorio=1`) | `app/vistas/laboratorio.js`, `app/laboratorio.css` |
| Contratos | `contrato/LABORATORIO-CONTRATOS.md` (sección «Fase 2») |

### Roles

| Rol | Qué hace | Hoy |
|---|---|---|
| Investigador | Cita hechos literales de la ficha y anota lo que falta | Guion DEMO |
| Analista | Interpreta: anomalías, fallos, hipótesis con su alternativa | Guion DEMO |
| Abogado del Diablo | Objeta: supuestos, sobreajuste, alcance, tiempos, evidencia | Guion DEMO |
| Verificador | lab-V: existencia, integridad, coincidencia literal, corte temporal, circularidad | **Código real** |
| Coordinador | Encargos, estados, reintentos, informe | **Código real** |

## 3. Operativo frente a DEMO

- **Operativo (código real, probado):** lectura de solo lectura, contratos, máquina de estados, Coordinador, reintentos
  y límite de tiempo, interrupción y reanudación, lab-V, informe, registro encadenado, revisión humana (vista y
  herramienta), propuesta a Nexus, adaptador manual (pegar una respuesta y verificarla).
- **DEMO:** el contenido de Investigador, Analista y Abogado del Diablo. Lo produce un **guion determinista** escrito a
  mano; cada texto empieza con «[GUION DEMO]», el autor es `guion-demo-sin-modelo` con adaptador `ninguno` y la vista
  muestra «DEMO · SIN MODELO · NO ES IA». El contrato 0.1 exige `autor.tipo = "ia"` en una ejecución: aquí significa
  «salida del rol»; el adaptador `ninguno` dice que no hubo modelo (limitación de contrato documentada).
- Trabajos DEMO de partida: Compago y Ek Chuah (requieren revisión humana), una **prueba de lab-V** con una cita
  inventada y un extracto alterado **a propósito** (requiere evidencia) y una **prueba de fallo** (el adaptador pierde
  la conexión dos veces → error → reintento → requiere revisión).

## 4. Motores conectados y contratos

| Motor | Conexión | Contrato |
|---|---|---|
| Compago | Solo lectura del mismo archivo que la oficina (`datos/demo/compago.json`; `datos/reales/compago.json` si existe) | `cauce.estado-proyecto` 1.x → ficha `lab-ficha 0.1` |
| Ek Chuah | Igual (`datos/demo/ek-chuah.json`, `datos/reales/ek-chuah.json`) | Igual |
| CSI | El lector lo admite (mismo contrato), sin trabajo DEMO propio | Igual |
| Nexus | Solo **propuestas** preparadas (borrador `cauce.leccion` 0.3, «propuesta») | `cauce.lab.propuesta-nexus` 0.1 |
| Tezcatlipoca | **No conectado**: no hay exportador ni repositorio accesible | — |

REAL: si existe `datos/reales/<motor>.json` con `es_demo: false`, la vista ofrece «Preparar trabajo REAL (respuesta
manual)». El trabajo queda **pendiente** esperando que una persona pegue la respuesta del Investigador; nada se envía
solo. En este contenedor `datos/reales/` está vacío, así que **no se probó con datos reales** (sí con un documento REAL
de prueba en `pruebas/casos-laboratorio-fase2.js`).

## 5. Controles de seguridad (cada uno con prueba)

- Solo una persona aprueba o rechaza; el código solo mueve estados mecánicos; una IA nunca aparece en el historial.
- Aprobar exige informe y motivo (≥ 10 caracteres); «requiere evidencia» no se puede aprobar directamente.
- El historial se reproduce al validar: un estado o una aprobación inyectados a mano se detectan; en el registro, una
  versión que reescribe el historial anterior se marca `historial_reescrito`.
- Guion sin modelo prohibido en REAL; DEMO y REAL no se mezclan (origen, ids, registros, encargos, ejecuciones).
- Origen siempre `solo_lectura`; ningún módulo del Laboratorio usa red, escribe, ejecuta procesos ni llama a funciones
  de escritura de motores o Nexus (prueba de aislamiento sobre el código fuente).
- Respuestas de modelos = contenido no confiable: se validan con el contrato y lab-V; las instrucciones que contengan
  (p. ej. `rm -rf`) se marcan y no se ejecutan; los textos se muestran como texto, nunca como HTML; invisibles y
  control bidireccional se limpian o se rechazan.
- Recomendaciones siempre «requiere decisión humana» y nunca automáticas; las que parecen compra, venta, apuesta o
  movimiento de dinero se excluyen con su motivo.
- Aprobar un informe **no** crea lecciones: la propuesta a Nexus llega como «propuesta», confianza baja, y Nexus la
  objeta con sus reglas (en el DEMO: `con_objeciones`, R02/R08/R09).
- Fallos de transporte: reintentos acotados por paso y reintentos del trabajo con tope (3); límite de tiempo por
  llamada; cada intento queda registrado.
- Sin credenciales nuevas, sin costo (`costo_mxn = 0`; lab-V alerta si no lo es).

## 6. Pruebas (detalle en `docs/LABORATORIO-FASE-2-PRUEBAS.md`)

- `node pruebas/ejecutar.mjs`: **458 / 0** (17 casos nuevos); `pruebas.html` en Chromium: 458 / 0.
- `pruebas/laboratorio-node.mjs` 9/9 · `pruebas/piloto-node.mjs` 6/6 · `pruebas/navegador/laboratorio.cjs` 33/33.
- Regresión de la oficina: 30/30 guiones de navegador en verde. CI de GitHub (Node) en verde.

## 7. Rendimiento

- La vista del Laboratorio se carga **solo al abrirla** (importación diferida): al arrancar la oficina no se descarga
  ni se ejecuta nada nuevo.
- A/B en SwiftShader con el Laboratorio cerrado: llamadas, triángulos y pasadas **idénticos** en los 10 escenarios;
  cps dentro del ruido del simulador (tabla en `docs/LABORATORIO-FASE-2-PRUEBAS.md`).
- Mientras está abierta, la 3D **se pausa** (como Nexus y CSI): prueba «114 → 114 cuadros» en 1.5 s.
- El plano del departamento es un SVG estático; el único efecto es un resaltado de 0.9 s en la estación que trabaja,
  desactivado con «reducir movimiento». Sin bucles ni temporizadores permanentes.
- No se tocó `app/vistas/vista3d/`. **No medí en la Intel UHD** (no tengo acceso a la pantalla de la MSI desde aquí);
  la medición en SwiftShader no representa a la UHD.

## 8. Pendiente y por qué

1. **Conectar un modelo real**: decisión tuya (costo $0 ⇒ sesión manual con tu plan, o Ollama local con autorización).
   El adaptador manual ya funciona: descargar encargo → tu sesión → pegar respuesta → lab-V.
2. **Piloto con el banco BNS 2015**: sigue bloqueado (banco no aprobado; clave privada fuera del proyecto).
3. **Lecturas REALES**: no hay exportaciones en `datos/reales/`; la integración real depende de que los motores
   exporten (Compago: arreglo `--entorno demo`; Ronny: puente Docker).
4. **Piso 3D propio del Laboratorio**: hoy es un departamento como Nexus y CSI (panel con plano). Un piso en el
   edificio cambiaría la lista de pisos y chocaría con el ascensor (#29); conviene después de decidir #29.
5. **Autenticación**: la identidad del revisor es declarada.
6. **Ek Chuah**: volver a revisar si su análisis semanal produce archivos (no verificado hoy).
7. Registrar las decisiones de la vista: hoy viven en la pestaña (se descargan); el registro auditable se hace con
   `herramientas/laboratorio.mjs revisar`.

## 9. Probarlo en la MSI en 10 minutos

Ver la guía `docs/VALIDAR-LABORATORIO-FASE-2.md`.
