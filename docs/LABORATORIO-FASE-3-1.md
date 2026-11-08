# Laboratorio de IA · fase 3.1: resistencia del intercambio manual, diagnóstico y comparación

Rama `claude/laboratorio-fase-3-1`, encadenada sobre la fase 3 (`claude/laboratorio-fase-3`, PR #31). No toca #29,
`app/vistas/vista3d/` ni ningún motor. Sin API, sin modelo instalado, sin credenciales. **Sigue sin probarse con Claude de
verdad ni en la Intel UHD**: todas las respuestas de las pruebas son sintéticas y se dicen como tales.

## 1. Estado de partida verificado

PR #31 en borrador con cabeza `c5270e9` sobre #30 (`867afbc`); 482 pruebas Node = 482 en `pruebas.html`; 31/31 scripts de
regresión en verde (todo en el contenedor). `datos/reales/` vacío.

## 2. Defectos reales encontrados y corregidos

Se probaron 14 respuestas sintéticas con los problemas habituales de un modelo. Fallaban de forma innecesaria:

| # | Defecto (fase 3) | Gravedad | Corrección (3.1) | Cómo se comprueba |
|---|---|---|---|---|
| 1 | Con dos bloques ```json (un ejemplo y la respuesta) se tomaba el primero: cuatro errores confusos | media | se elige el bloque que trae el formato; corrección `bloque_elegido_entre_varios` | `Lab 3.1 · sintético: JSON rodeado…` |
| 2 | Un extracto con el prefijo `[L3] ` que la propia solicitud pone delante de cada línea → lab-V «cita inventada» | **alta** (falso positivo que tumba la evidencia) | se quita el prefijo y se declara | `…prefijo [Ln]…`, navegador 3.1 |
| 3 | Extracto entre comillas `"…"` → mismo falso positivo | media | se quitan las comillas envolventes y se declara | ídem |
| 4 | Coma sobrante antes de `}`/`]` → rechazo total | media | se quita fuera de cadenas y se declara | `…comas finales…` |
| 5 | `rol: "Investigador"` → mensaje absurdo («dice ser Investigador y se espera Investigador») | baja | se normaliza y se declara | `…rol con mayúsculas…` |
| 6 | `hipotesis: null` → rechazo | baja | null = lista vacía, declarado | ídem |
| 7 | Marcadores «…» de la plantilla aceptados como contenido en preguntas/dudas/limitaciones | media | se quitan; en una afirmación se rechaza (`plantilla_sin_rellenar`) | ídem |
| 8 | **Un intento fallido borraba el texto pegado y el modelo escrito** (la vista redibuja el formulario) | **alta** (pierdes la respuesta de Claude) | el formulario vive en el estado de la vista y se repone | navegador 3.1 |
| 9 | «El JSON no es válido: … position 761» sin decir dónde | media | línea, columna y fragmento `⟵AQUÍ⟶` (solo en pantalla) | `…mezcla NO se repara…` |
| 10 | Los avisos de una importación aceptada desaparecían al pasar al rol siguiente | baja | se muestran en el panel del rol siguiente | navegador 3.1 |

**Qué NO se corrige (sustantivo, por diseño):** cita parafraseada, hecho sin cita, inferencia sin base, fuente fuera del
catálogo, «…» dentro de una afirmación, JSON con comillas mezcladas, respuesta cortada. lab-V no cambió sus reglas.

## 3. Mejoras funcionales

- **Errores con código y categoría** (`formato · contrato · seguridad · evidencia`) y marca de «recuperable».
- **Correcciones de forma declaradas** en los avisos, en `importaciones[].correcciones` y en `intercambio.correcciones`.
- **Diagnóstico sin contenido** (`app/laboratorio/diagnostico.js`): rol que falló, validación, categoría, si se
  recupera sin cambiar el significado, qué requiere revisión humana y qué pruebas convendría hacer. Descargable en
  «Auditoría» (Markdown y JSON). No incluye pregunta, ficha, extractos ni solicitud.
- **Banco de comparación** (`app/laboratorio/comparacion.js`, `node herramientas/comparar-modelos.mjs <expedientes…>`):
  8 criterios medibles por modelo declarado; sin expedientes de IA dice «sin datos». No hay calificaciones.
- **Inventario de lo que el Laboratorio consume de un motor** (`comprobarExportacion`, `CAMPOS_LABORATORIO`).

## 4. Pruebas añadidas y resultados

| Conjunto | Resultado |
|---|---|
| Node | **499 / 0** (17 nuevas «Lab 3.1 · …») |
| `pruebas.html` en Chromium | **499 / 0**, sin errores de consola |
| `laboratorio-fase3.cjs` (fase 3, sin cambios) | 27/27 |
| `laboratorio-fase3-1.cjs` (nuevo) | 16/16 |
| Regresión completa `todas.cjs` | ver `docs/LABORATORIO-FASE-3-1-PRUEBAS.md` |

## 5. Auditoría de persistencia y seguridad

| Comprobación | Resultado |
|---|---|
| Recargar no pierde trabajos | ✓ (navegador) · exportar→reanudar→exportar es byte a byte idéntico (Node) |
| Importar dos veces no duplica | ✓ el mismo expediente reanudado dos veces = un trabajo; la misma respuesta = rechazo |
| Una respuesta no sirve en otro encargo | ✓ `respuesta_reutilizada` (seguridad), también tras reanudar |
| Decisiones humanas no fabricables por la IA | ✓ claves `estado`/`decision_humana` en una respuesta = fallo de **seguridad**; un expediente con decisión «por ia» o «autenticada» no se reanuda |
| DEMO y REAL separados | ✓ (fase 3 + reanudación con `es_demo` cambiado rechazada) |
| Importación maliciosa no ejecuta código | ✓ `__proto__`/`constructor` rechazados y prototipos intactos; `<script>` se guarda como texto; la vista solo usa nodos de texto |
| Almacenamiento local con límites y error recuperable | ✓ cuota agotada → aviso «Exporta el expediente», el trabajo sigue en memoria (navegador) |
| Exportaciones sin secretos ni texto rechazado | ✓ el contenido de un intento rechazado no se guarda; sin claves de credenciales; fallos solo `{codigo, categoria, recuperable}` |

**Lo que no cierra el código:** el detector de inyección sigue siendo por frases; la procedencia del modelo sigue siendo
declarada; el guardado local es del navegador (un usuario del mismo equipo lo puede borrar, no alterar sin que falle la
reanudación).

## 6. Revisión de integración con motores (solo lectura; nada inventado)

`comprobarExportacion(documento)` inventaría, para un documento `cauce.estado-proyecto` 1.x:

| Usa hoy la ficha | Trae el contrato y la ficha aún no usa | No existe en el contrato (haría falta) |
|---|---|---|
| proyecto, generado_en, vigencia, es_demo/ahora_simulado, indicadores {etiqueta, valor}, agentes {nombre, estado, evidencia.observado_en}, alertas | **agentes[].error.mensaje** (el detalle del error: lo más útil para el Investigador y hoy no es citable), actividad {descripcion, inicio, fin, progreso}, evidencia.referencia, indicadores {unidad, nota}, departamento.descripcion, resultados[], fuente | observado_en y fuente por indicador, evidencia en alertas, lecturas anteriores (historial), versión del motor |

- **Compago / Ek Chuah / CSI**: mismo contrato v1, misma ficha. Lo que falta no lo puede poner el Laboratorio: lo tiene
  que exportar cada motor (Compago: Claude de Compago; Ek Chuah: Ronny; CSI: su exportador de piso).
- **CSI (contrato propio 0.2)**: el encargo ya admite el insumo `csi_investigacion` y lab-V tiene
  `catalogoDesdeInvestigacion` (fase 1, usado por el piloto). Conectar una investigación CSI real como catálogo de fuentes
  del Laboratorio es posible sin cambiar contratos; no se hizo porque no hay caso real aprobado para ello.
- **Nexus**: solo `prepararPropuestaNexus` tras aprobación humana (`cauce.leccion` 0.3, tipo texto_ia, confianza baja).
  Nada escribe en su almacén. Comprobado de nuevo en las pruebas (aprobar no genera ni inserta nada).
- **Tezcatlipoca**: sin contrato verificable; `comprobarExportacion` lo rechaza con el motivo.
- Recomendación (no implementada): «ficha 0.2» que incluya `error.mensaje` y `actividad`. Cambia las huellas de las fichas,
  así que conviene hacerlo antes de que existan expedientes reales guardados.

## 7. Rendimiento

Sin cambios en la oficina 3D. Los módulos nuevos (`diagnostico.js`, `comparacion.js`) se cargan solo con el Laboratorio.
Medición A/B en `docs/LABORATORIO-FASE-3-1-PRUEBAS.md`. **No medido en la Intel UHD.**

## 8. Decisiones que dependen de Diego

1. La prueba real con Claude (guía `docs/VALIDAR-LABORATORIO-FASE-3.md`, ahora con el diagnóstico).
2. Fusiones: #27 → #28 → #30 → #31 → este PR.
3. Si quieres la «ficha 0.2» (error.mensaje y actividad citables) antes de la prueba real o después.
4. Ollama: sigue sin instalar. Mi recomendación no cambia: primero la prueba real, después comparar con el banco.
