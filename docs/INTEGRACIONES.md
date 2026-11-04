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
   Si cada departamento trae además `"nombre"` (y opcionalmente `"descripcion"`), sacados de un inventario del
   repositorio, el piso muestra esos cuartos **vacíos** mientras no exista archivo de estado: sin personajes, sin
   cifras, con «Sin conexión» y la nota de inventario (`"inventario"`). Así se ve Montambre (fase I).
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

## 3. Estado por proyecto (actualizado en la fase I, 2026-11-04)

| # | Proyecto | Registro | Demo | Escena | Adaptador | Siguiente paso |
|---|---|---|---|---|---|---|
| 1 | Compago | ✔ | ✔ | ✔ + naturalezas | `exportar_cauce` en Compago PR #9/#10, **sin fusionar** | Diego lo fusiona y lo corre en su PC |
| 2 | Ek Chuah | ✔ | ✔ | ✔ + naturalezas | `exportar-cauce` en Ek Chuah PR #2, **sin fusionar** | Paso 2 de `docs/INFORME-FASE-H.md` §7 (primera exportación real) |
| 3 | Tezcatlipoca | ✔ (sin demo) | — | — | Repositorio **no accesible** | `docs/TEZCATLIPOCA-REQUISITOS.md` |
| 4 | Montambre | ✔ (sin demo) | — | ✔ solo estructura (4 cuartos) | **No existe**; tampoco hay procesos automáticos que exportar | `docs/MONTAMBRE-REQUISITOS.md` |
| 5 | CauceService, Repacar / Auxilio Auto | — | — | — | Repositorios **no accesibles** | Diego indica dónde viven |
| 6 | Futuros (trading…) | — | — | — | — | Mismos 7 pasos |
