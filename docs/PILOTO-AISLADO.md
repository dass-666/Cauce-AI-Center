# Piloto aislado del Laboratorio de IA · preparación (fase 1.1)

**Estado: preparado para revisión humana. El piloto NO se ha ejecutado, el banco NO está aprobado y ningún modelo se ha conectado.**

Este documento describe el paquete mínimo que recibe una sesión de IA, cómo se separan los tres roles, cómo se puntúa después y qué se comprueba por código frente a lo que depende de configurar bien la sesión real.

## 1. Paquete mínimo (`cauce.lab.paquete` 0.1)

```
node herramientas/piloto.mjs empaquetar --rol critico --evaluacion <expediente-evaluacion.json> \
     --corrida <id> --pregunta "…" --creado-por diego --corte 2015-01-15T00:00:00Z \
     --banco banco-bns-2015-v1 --salida <carpeta nueva>
node herramientas/piloto.mjs comprobar <carpeta>            # fallo seguro: cualquier problema → código 1
```

El paquete del **crítico** contiene exactamente cinco archivos y nada más:

| Archivo | Qué es |
|---|---|
| `paquete.json` | El encargo formal (`cauce.lab.encargo` 0.1, firmado por una persona), su huella y la lista de archivos con SHA-256. |
| `INSTRUCCIONES.md` | Instrucciones neutrales: no dicen qué buscar en concreto ni cuántos defectos hay. |
| `formato-respuesta.json` | Plantilla de `cauce.lab.ejecucion` con marcadores `<…>`. |
| `expediente-evaluacion.json` | Copia byte a byte del expediente con la marca `[BANCO DE EVALUACIÓN]`. |
| `catalogo-fuentes.json` | Fuentes que el expediente declara (ids, fechas, huellas), sin su texto. |

No contiene: la clave, la especificación de defectos, el manifiesto del banco, los criterios privados, el expediente original, el historial del repositorio, documentación interna del banco, resultados de otras corridas ni rutas a herramientas del proyecto.

El **investigador** recibe catálogo + `copias/<fuente>.<ext>`; el **analista**, catálogo + `verificadas/` (ejecuciones del investigador con su verificación de lab-V). Ningún paquete lleva el banco salvo el del crítico (lo exige el contrato del encargo).

## 2. Separación de roles (C2)

Cada rol es **una sesión distinta, con su propio paquete y su propio encargo**. Nada pasa de un rol a otro salvo por el Laboratorio:

```
investigador ──(ejecución)──► lab-V ──(verificación)──► registro
                                                         │ solo lo VERIFICADO (no «verdadero»)
analista     ◄──(paquete con verificadas/)───────────────┘
                 ──(ejecución)──► lab-V ──► registro
crítico      ◄──(paquete con el banco; sin salidas de otros roles en el piloto 1)
                 ──(ejecución)──► lab-V ──► registro ──► puntuar (entorno privado)
```

- El investigador no recibe salidas de otros roles (contrato). El banco solo entra al crítico (contrato).
- Un rol no lee lo reservado a otro porque **no está en su carpeta** y la sesión se abre sin otro acceso (ver §4).
- **No son agentes independientes.** Si los tres roles los ejecuta el mismo modelo (o la misma cuenta), comparten entrenamiento y posiblemente memoria de sesión. El procedimiento exige: una conversación nueva por rol, sin memoria entre ellas, y anotarlo en `autor.identificador`. La independencia que se obtiene es de **insumos**, no de modelo.
- Orden del piloto 1: solo el crítico (es lo que mide el banco). Investigador y analista quedan para un piloto 2 sobre un caso nuevo, porque el caso suizo es famoso y su desenlace es conocido por cualquier modelo.

## 3. Evaluación posterior (C3)

```
node herramientas/piloto.mjs puntuar --ejecucion <respuesta.json> --clave <clave-respuestas.json> \
     --criterios <criterios.json> --insumo banco-bns-2015-v1 --salida <puntuacion.json>
```

Se ejecuta **después** de la corrida, **en el entorno privado** (donde está la clave), nunca en la sesión evaluada ni con acceso a ella. Produce `cauce.lab.puntuacion` 0.1 con, por defecto:

- Por cada defecto de la clave: entidad afectada (id de enunciado/hipótesis/observación), estado `correcto | parcial | incorrecto | no_detectado`, motivo, id de la objeción y su **evidencia textual**.
- `correcto` = la objeción apunta a la entidad y muestra el defecto (contiene un fragmento del valor alterado o del original de la clave) o cumple el criterio explícito del defecto; `parcial` = apunta a la entidad sin mostrarlo; `no_detectado` = ninguna objeción a la entidad.
- **Falsos positivos** (objeciones a entidades sin defecto) listados por separado; no restan en el puntaje pero quedan contados.
- **Controles** aparte: `criterios.control` (p. ej. el defecto que ya detectan las reglas actuales) no entra en `n_retos` ni en el puntaje.
- `puntaje = correctos / n_retos` y, aparte, `puntaje_con_parciales_a_medias`.

`criterios.json` (privado, junto a la clave) permite reglas estrictas y de interacción sin tocar el código:

```json
{
  "control": ["Dxx"],
  "defectos": { "Dyy": { "exige_tipo": ["evidencia"], "exige_palabras": [["intención", "intencion"], ["prueba", "evidencia"]] } },
  "interacciones": [{ "si": "Daa", "estado_de": "Dbb", "es": "no_detectado", "marcar": "parcial", "motivo": "…" }]
}
```

Los criterios reales del banco BNS 2015 (reglas estrictas de dos defectos, regla de interacción entre otros dos, control) están en `CRITERIOS-EVALUACION.md` de la carpeta privada de Diego; convertirlos a `criterios.json` es un paso humano, en esa carpeta, antes de puntuar. Este repositorio no contiene ni los ids ni la naturaleza de esos defectos.

## 4. Ensayo técnico sin IA (C4): qué se comprueba por código y qué no

Comprobado automáticamente (pruebas `pruebas/piloto-node.mjs` y casos del Laboratorio en `pruebas.html`), sobre el banco de prueba público de 2 defectos:

- El paquete se construye, se escribe y se vuelve a comprobar **leyendo del disco**; la copia del expediente es byte a byte; el encargo cumple su contrato.
- El comprobador falla con: clave, especificación o manifiesto del banco (por contrato, no por valores), criterios/revisión/LEEME/informes (por nombre), expediente original o sin marca, expediente en un rol que no lo recibe, archivo no declarado, declarado ausente, huella distinta, enlace simbólico (y su destino fuera), ruta absoluta o con `..`, referencias a `../`, al repositorio, a la carpeta del proyecto o a discos, resultados de otras corridas no declarados, registros JSONL, archivos y paquetes enormes, formato de respuesta con datos reales.
- Una respuesta con la forma del paquete cumple el contrato y lab-V la verifica con el encargo del paquete; una objeción a un insumo que el encargo no declara se rechaza.
- La puntuación es determinista y nunca sobrescribe.
- El comprobador no contiene valores ni ids de defectos del banco (prueba de aislamiento).

**No** se puede comprobar por código y depende de cómo se abra la sesión real:

| Propiedad | Cómo se garantiza |
|---|---|
| La sesión no tiene acceso al repositorio | Abrir una conversación nueva **sin** proyecto, sin repositorio conectado y sin carpetas aprobadas; subir solo la carpeta del paquete. |
| La sesión no tiene acceso a la carpeta del proyecto ni a la privada | Idem. Nunca usar un hilo de este proyecto como sesión evaluada: la carpeta del proyecto contiene copias del expediente original. |
| Sin red | Desactivar la búsqueda web en la conversación; el encargo declara `red: ninguna` y lab-V rechaza consultas declaradas, pero no puede ver las que no se declaran. |
| Sin memoria entre roles ni corridas | Conversaciones nuevas; memoria de la app desactivada para esa cuenta o cuenta aparte. No verificable desde aquí. |
| El modelo no conoce el banco | **No garantizable**: el caso es histórico y famoso; además los defectos los escribió una IA del mismo proveedor. El banco mide detección de errores en el texto, no conocimiento. |
| La clave no se mezcla con la sesión | Puntuar en la MSI, en la carpeta privada, con la sesión evaluada ya cerrada. |

## 5. Exposición residual (informe A4)

Lo que sigue pudiendo revelar los defectos a una IA, y qué haría falta para cerrarlo:

1. **El expediente original está publicado en `main`** (`datos/csi/casos-publicados/expediente-bns-2015.json`) y en varias carpetas del proyecto (`cauce/csi-fase-2/…`, `cauce/cierre/…`). Cualquier sesión con acceso a ellos reconstruye los 10 defectos por comparación en segundos. Cierre: la sesión evaluada no tiene acceso a nada de esto (§4); no se puede «despublicar» sin decisión de Diego.
2. **Memoria del proyecto**: se saneó para no decir qué defecto es cuál; sigue diciendo que hay 10, que las reglas detectan 1 y que existe un control. Cierre: no evaluar nunca con un hilo del proyecto.
3. **Evaluación marcada**: el expediente lleva la marca `[BANCO DE EVALUACIÓN]` y una nota que dice que contiene alteraciones deliberadas. La sesión sabe que está siendo evaluada y que hay errores (no cuántos ni cuáles). Es una decisión de diseño del banco (no se modificó): un crítico a ciegas sería otro experimento.
4. **Una IA escribió los defectos**: una sesión de su mismo modelo no es una evaluada limpia. Mitigación: revisión humana de la clave (pendiente) y, si se quiere, un segundo banco escrito por una persona.
5. **El contenedor de la sesión que trasladó la clave** conservó copias temporales hasta cerrarse. No quedan en la carpeta del proyecto ni en git (comprobado por nombre y por huella en 364 archivos y en todas las ramas).

Nada de lo anterior declara aislamiento absoluto. El piloto solo debe correr cuando Diego apruebe el banco y abra la sesión como dice §4.
