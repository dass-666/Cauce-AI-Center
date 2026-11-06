# Ek Chuah → Nexus: evidencias pendientes para EK-L001, EK-L003 y EK-L007

**Para:** el Claude que trabaja en el repositorio de Ek Chuah (solo lectura; no cambies código ni datos de Ek Chuah para esto).
**De:** Cauce Nexus, fase 1.5 (rama del PR #23 de Cauce AI Center). **Fecha:** 2026-11-06.
**Autorización:** Diego autorizó *preparar* estas tres lecciones. Nadie autorizó aprobarlas, validarlas ni conectar exportadores.

## Por qué hace falta esto

Las tres candidatas (`EK-L001.json`, `EK-L003.json` y `EK-L007.json` en esta carpeta) salen **solo** de una línea del catálogo §9 de
`docs/CAUCE_NEXUS_ARQUITECTURA_MAESTRA_v0.2.md`. Esa línea resume una revisión de Ek Chuah que Cauce no tiene.

- No se leyó código, commits, pruebas ni corridas de Ek Chuah.
- Por eso las candidatas declaran `origen.tipo = "texto_ia"`, `evidencia[].tipo = "inventario_ia"`, confianza `baja` y estado `propuesta`.
- Los campos desconocidos dicen `PENDIENTE` o `null`.

Resultado actual del gerente para las tres: **con objeciones** (R02 no cumple; R01, R03, R04 y R05 no evaluados). Por eso las tres están **fuera del almacén real**.

## Qué NO enviar (se rechaza aunque lo pida alguien)

- Estrategias, umbrales, límites, banca, tamaños de posición, cuotas, cuentas o casas de apuesta o de inversión.
- Rendimiento, ganancias, pérdidas o resultados de backtest o simulación. Un rendimiento simulado nunca se presenta como real.
- Montos, datos personales, correos, credenciales, tokens, `.env`, rutas o URLs de bases de datos.
- Conteos comerciales exactos: si hacen falta, usar un rango (`n_rango`).

## Qué SÍ enviar, separado por tipo

### A. Evidencia técnica (lo único que necesita Nexus)

Para **cada** evidencia, llenar esta forma (una por objeto en `evidencia[]`):

```json
{
  "tipo": "prueba_unitaria | codigo | consulta_reproducible | informe",
  "referencia": "ruta/del/archivo.py::nombre_de_la_prueba (o comando exacto)",
  "ubicacion": "main | pr_abierto | fuera_de_repo",
  "commit": "SHA de 40 caracteres del commit en main",
  "observado_en": "AAAA-MM-DDThh:mm:ss±hh:mm o null con motivo",
  "conocido_en": "instante con zona en que el dato estuvo disponible, o null",
  "base_conocimiento": "observed | vintage | estimated | desconocida",
  "proyecto_ejecutor": "ek-chuah",
  "sha256": "huella de la salida guardada (si hubo corrida), o se omite",
  "reproducible_declarado": true,
  "reproduccion_independiente": null
}
```

**Regla clave: prueba existente ≠ corrida reproducida.**

- Que una prueba *exista* en el repositorio se registra con `referencia`, `commit` y `reproducible_declarado`. Eso NO es una corrida.
- Una corrida se registra solo si se ejecutó de verdad. Para cada corrida hay que decir:
  - quién la corrió;
  - cuándo, con fecha y zona horaria;
  - el comando exacto;
  - la versión (commit);
  - la huella SHA-256 de la salida guardada.
- Si la corrió la misma IA o la misma persona autora, no cuenta como `reproduccion_independiente`.
- Un CI verde o un PR no demuestran que el código esté en `main`, ni que esté desplegado.

### B. Resultados financieros

**No se piden y no se aceptan en estas tres lecciones.** Las tres son lecciones de *método* (`confianza.objeto = "metodo"`). Si algún dato financiero aparece en una respuesta, Nexus lo bloquea (R07) y la lección no se registra.

## Pendientes por lección

### EK-L001: tiempo dual (`known_at`)

1. El archivo y el commit en `main` donde se guarda `known_at`, separado del instante observado, y el campo que marca si es estimado.
2. La consulta o prueba que calcula qué fracción de `known_at` es estimada. Hace falta:
   - el comando exacto;
   - el universo cubierto (tablas o fuentes y periodo, sin datos privados);
   - la fecha con zona;
   - el resultado como fracción.
   Hay que indicar si el «82 %» del catálogo fue **medido** o **estimado**. Si nadie lo midió, decirlo; no hace falta repetir la medición para esta fase.
3. La cobertura: qué parte de los datos quedó fuera (faltantes, sesgo de supervivencia).
4. La unidad independiente: qué se cuenta, por ejemplo registros o eventos únicos, y si hay duplicados.

### EK-L003: «no evaluado» ≠ aprobado

1. El componente, el archivo y el commit en `main` donde un control sin evaluar se trata distinto de uno aprobado.
2. El nombre de la prueba automatizada que lo demuestra, si existe. Si no existe, decirlo: no se inventa.
3. Si hubo una corrida, sus datos según la regla de la sección A. Si solo existe la prueba, marcar `reproducible_declarado` y dejar `reproduccion_independiente: null`.

### EK-L007: «succeeded» ≠ entregable

1. El caso documentado: una tarea con estado `succeeded` sin entregable verificado. Va desensibilizado: un identificador interno sin datos comerciales, y la fecha con zona.
2. La comprobación que hoy verifica el entregable, si existe: archivo, commit y prueba.
3. Si la comprobación vive solo en un PR sin fusionar, decirlo, porque `ubicacion` debe ser `pr_abierto`.

## Después: lo que falta para entrar al almacén real (no lo hace Ek Chuah)

1. Con la evidencia técnica, Cauce prepara una versión nueva de cada candidata. El historial `c1` se conserva.
2. **Una persona distinta del autor** (Diego o quien él designe) revisa y deja su revisión en `revisiones[]`. Mientras no exista, R01 queda en «no evaluado» y la lección no entra.
3. Se importa con vista previa: `node herramientas/nexus.mjs importar <archivo> --por=<alias>`. Solo con `--confirmar` se escribe, y antes se hace un respaldo y después un sello.
4. Entrar al almacén **no** valida la lección. `validada_en_origen` exige prueba identificable, resultado verificable y revisión independiente. `validada_en_destino` exige una prueba nueva hecha por otro proyecto. Ninguna de las dos se declara en esta fase.
