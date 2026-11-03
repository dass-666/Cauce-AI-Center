# Integraciones: cómo conectar proyectos sin tocar sus sistemas

Basado **solo** en lo que existe en este repositorio:
- el contrato `contrato/CONTRATO.md` y `app/nucleo/contrato.js`;
- los ejemplos de `datos/demo/` y `contrato/ejemplos/`;
- el registro `datos/proyectos.json`.

No se revisó ningún otro repositorio para este documento, y nada aquí activa una integración real.

## 1. Flujo (ya implementado en la página)

```
Sistema (Compago, Ek Chuah, …)
   │  adaptador de SOLO LECTURA (vive y corre del lado del sistema; nunca dentro del visualizador)
   ▼
datos/reales/<id>.json  ── contrato cauce.estado-proyecto v1 ──►  cargador.js ─► registro.js ─► contrato.js ─► modelo.js ─► vistas
                                                                                       │                         │
datos/demo/<id>.json (solo si no existe el real; debe decir es_demo: true)             └── cambios.js (diferencias entre lecturas)
```

| Pieza | Archivo | Qué garantiza |
|---|---|---|
| Registro de proyectos | `datos/proyectos.json` (o `proyectos.local.json`, fuera de git) + `app/nucleo/registro.js` | Cada proyecto solo puede leer `datos/reales/<archivo>.json`, `datos/demo/<archivo>.json` y `escena/<archivo>.json`. Se descartan ids repetidos, rutas fuera de la carpeta, URLs externas y una "demo" que apunte a datos reales. |
| Lectura | `app/cargador.js` | Distingue *no existe*, *error de red* y *JSON inválido*. No reintenta en bucle: lee cada 30 s y al volver a la pestaña. |
| Elección real/demo | `elegirCarga` en `modelo.js` | La demo **solo** se usa si no existe el real. Un archivo real dañado **no** se tapa con la demo. Lo leído en el lugar de la demo debe decir `es_demo: true`; si no, no se muestra. |
| Validación | `validarDocumento` en `contrato.js` | Campos obligatorios, fechas UTC, `trabajando` exige evidencia e inicio, avance solo con `hecho/total` reales, enlaces solo http/https o relativos seguros, sin HTML. Campos desconocidos: se ignoran. |
| Conexión | `construirModeloVista` | Estados de conexión: *En línea*, *Datos desactualizados* (más viejo que `vigencia_segundos`), *Sin conexión* (no existe o no se pudo leer) y *Archivo inválido*. Fuera de *En línea*, todos los personajes quedan *Sin información*; el último estado se ve solo como referencia. |
| Cambios observados | `cambios.js` | Solo compara la lectura anterior con la actual, del mismo proyecto y la misma fuente. Pasar de DEMO a REAL se anota como un solo cambio de fuente, sin comparar estados. |
| Lecturas cruzadas | `app.js` | Si dos lecturas se cruzan, solo cuenta la más reciente. |
| Animación | `maquina.js` | Los gestos solo aparecen ante un cambio observado. Al abrir, al cambiar de fuente o de proyecto, cada personaje aparece ya en su postura. |

## 2. Cómo se agrega un proyecto (pasos, sin código nuevo en el visualizador)

1. **Contrato verificado:** con el dueño del sistema, decidir qué registro respalda cada estado. Se escribe en una
   tabla como la de `docs/ARQUITECTURA.md` → *Adaptadores*. Sin esa tabla no se continúa.
2. **Demostración primero:** escribir `datos/demo/<id>.json` con `es_demo: true` y `[DEMO]` en cada texto.
3. **Escena:** escribir `escena/<id>.json` (departamentos y su posición). Es opcional: sin ella se acomodan solos.
4. **Registro:** agregar una línea en `datos/proyectos.json`:
   `{ "id", "nombre", "estado": "datos/reales/<id>.json", "demo": "datos/demo/<id>.json", "distribucion": "escena/<id>.json" }`.
5. **Adaptador de solo lectura**, en el repositorio del sistema y con autorización de Diego:
   - abre la base en solo lectura;
   - hace consultas acotadas;
   - corre cada 5–15 min o al terminar una tarea;
   - escribe primero a un temporal y luego lo renombra (así la página nunca lee un archivo a medias);
   - no exporta datos privados.
6. **Revisar el archivo** antes de abrir la página:
   `node herramientas/validar-estado.mjs datos/reales/<id>.json --proyecto=<id>`
   (código 0 = válido y vigente).
7. **Activar:** el archivo real aparece en `datos/reales/` (fuera de git) y la página lo toma sola en la siguiente
   lectura. Se anota como "Los datos pasaron de DEMO a REAL".

## 3. Estado por proyecto

| # | Proyecto | Registro | Demo | Escena | Adaptador | Siguiente paso |
|---|---|---|---|---|---|---|
| 1 | Compago | ✔ | ✔ `datos/demo/compago.json` | ✔ | Construido en Compago PR #9 (`exportar_cauce`), **sin fusionar** | Diego decide cuándo fusionarlo y correrlo en su PC |
| 2 | Ek Chuah | ✔ | ✔ `datos/demo/ek-chuah.json` | ✔ | **No existe** | Acordar la tabla de evidencia (candidatos ya anotados: `fetch_log`, `alerts_sent`, log diario). Luego, con permiso, el adaptador en el repositorio de Ek Chuah |
| 3 | Tezcatlipoca | ✔ (sin demo) | — | — | **No existe**; su repositorio no es accesible | Diego indica dónde vive y qué registra. Hasta entonces se ve *Sin conexión* (correcto) |
| 4 | Futuros (trading…) | — | — | — | — | Mismos 7 pasos |

## 4. Lo que **no** se hace

- El visualizador no se conecta a bases de datos, APIs ni servidores: solo lee archivos locales.
- No se inventan campos del contrato ni se cambia la versión 1.0.0. Si un sistema necesita algo nuevo, se
  propone una versión 1.1 compatible, con autorización.
- No se fabrican archivos "reales". Los datos ficticios de prueba viven solo en memoria, dentro de las pruebas
  (`pruebas/navegador/estabilidad.cjs`), y dicen *PRUEBA automática (datos ficticios)*.
- No se activa ninguna integración sin contrato verificado y sin autorización de Diego.

## 5. Riesgos conocidos

| Riesgo | Efecto | Mitigación |
|---|---|---|
| El adaptador escribe el archivo a medias | *Archivo inválido* durante una lectura | Escribir a un temporal y renombrar (paso 5) |
| Relojes desfasados | *Hora en el futuro* o *desactualizado* | Tolerancia de 5 min (`TOLERANCIA_FUTURO_SEGUNDOS`) y `vigencia_segundos` por proyecto |
| Estados que cambian y regresan entre dos lecturas | No se ven (correcto: no se inventan) | Si importa, el adaptador debe exportar ese historial; sería un cambio de contrato |
| `proyectos.local.json` editado a mano | Rutas peligrosas | `registro.js` las descarta y avisa en la consola |
