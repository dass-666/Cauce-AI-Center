# Cauce Nexus · fase 1

Nexus es un **gerente supervisado de conocimiento**: conserva lecciones con evidencia, aplica reglas escépticas
deterministas, registra recomendaciones y espera la decisión de una persona. **No** controla motores, no toma
decisiones financieras ni de apuestas, no escribe en Compago, Ek Chuah ni Tezcatlipoca y no usa IA.
Diseño de referencia: `docs/CAUCE_NEXUS_ARQUITECTURA_MAESTRA_v0.2.md`. Contratos: `contrato/NEXUS-CONTRATOS.md`.

## Qué hay

| Pieza | Archivo |
|---|---|
| Utilidades (fechas con zona, privacidad, huellas SHA-256) | `app/nexus/comun.js` |
| Contrato `cauce.leccion` 0.2 | `app/nexus/leccion.js` |
| Gerente `nexus-R 0.2` (R01–R10) | `app/nexus/gerente.js` |
| Contrato `cauce.recomendacion` 0.2 y su revisión | `app/nexus/recomendacion.js` |
| Almacén que solo crece | `app/nexus/registro.js` |
| Datos de prueba (ficticios, `demo-…`) | `app/nexus/demo.js` → `datos/nexus/demo/` (`node herramientas/nexus-demo.mjs`) |
| Almacén real (local, fuera de git) | `datos/nexus/registro/` |
| Línea de comandos (requiere Node) | `herramientas/nexus.mjs` |
| Oficina Nexus (botón ✦ o tecla **N**) | `app/vistas/nexus.js` |

## Reglas nexus-R 0.2 y pruebas de aceptación

| Regla | Pruebas §8 | Qué hace no_cumple / no_evaluado |
|---|---|---|
| R01 Procedencia y separación | T01, T20 | Falta procedencia; origen texto IA marcado validado; IA autora que se revisa; IA sin revisión humana · sin revisión humana ajena → no evaluado |
| R02 Evidencia y cobertura | T01 | Sin evidencia o solo texto de IA · cobertura no declarada → no evaluado |
| R03 Independencia y circularidad | T03, T10, T15 | Duplicados exactos; A→B→A; n_independiente > n · sin n_independiente o sin unidad → no evaluado; con n ≠ n_independiente cuenta la unidad independiente |
| R04 Temporalidad | T04, T07, T17, T21 | known_at posterior al hallazgo; exportación como observación; revisión sin zona; estimado + confianza alta · known_at nulo o dentro del día sin hora → no evaluado |
| R05 Reproducción y vigencia | T11, T24 | Caducada; validada sin artefacto · sin huella ni commit → no evaluado. «Declarada» ≠ «reproducida» |
| R06 Transferencia | T05, T10, T22, T24 | validado_en sin prueba_ref; validación con una lección derivada; destino sin prueba propia, posterior y con revisión ajena |
| R07 Privacidad y estrategia | T13 | Credenciales, datos personales, umbrales/banca/casas/cuentas con cifras; tipo estrategia no restringida |
| R08 Inferencia y robustez | T06, T14, T16, T18, T19, T21 | Backtest/simulación como beneficio real; sintético como efecto; selección en muestra o N comparaciones sin ajuste con confianza ≥ media; costos desconocidos = 0 · confianza alta sin n_efectivo → no evaluado |
| R09 Resultado y estado operativo | T02, T08 | «succeeded» sin informe; CI/PR como desplegado; validada solo con PR abierto |
| R10 Autorización y aislamiento | T09 | Estrategia exportada; en recomendaciones: experimento con pendientes, ejecución sin aprobación, dinero/apuestas con ejecución o adopción |
| — | T12 | Revisión guardada que dice «cumple» donde el cálculo no: el registro la rechaza |
| — | T23 | Un campo `nexus` en un archivo `cauce.estado-proyecto` 1.0.0 no llega al modelo (ver hallazgo abajo) |

Dictamen: cualquier `no_cumple` → **con objeciones**; si no, cualquier otra cosa que no sea `cumple` → **incompleto**;
solo 10/10 → **sin objeciones**. Un control que no aplica responde `cumple` con `aplica: false` y su motivo, a la vista.

## Contraste del documento v0.2 con Cauce (hallazgos)

1. **T23:** el validador de `cauce.estado-proyecto` 1.0.0 **no rechaza** claves desconocidas: las descarta al normalizar.
   El resumen de Nexus nunca llega al modelo, pero el documento dice «contrato existente rechaza». No se cambió el
   contrato 1.0.0 (prohibido); si se quiere rechazo explícito, sería un aviso en `herramientas/validar-estado.mjs`.
2. **Fases:** §10 pone el validador determinista en la fase 2 «solo tras autorización». Diego autorizó por escrito
   implementarlo ya; queda en PR borrador, sin fusionar.
3. **§11 sigue abierto:** aprobación formal del v0.2, responsable humano, política de conservación y el conjunto
   inicial de lecciones. Por eso el almacén real está **vacío**: las 15 lecciones del §9 son candidatas y no se cargaron.
4. **`cauce.nexus-resumen` 0.2** (§1, §11.5): no hizo falta. La oficina lee directamente los dos registros de Nexus; no
   se creó un piso nuevo ni se tocó el contrato 1.0.0.
5. El ejemplo §3.1 usa días sin zona y `observado_en: null`: es registrable, y el gerente lo deja «incompleto» (R04 no
   evaluado), que es coherente con «no validada».

## Revisar la oficina Nexus (Windows)

1. `iniciar.bat` (o `py servir.py`) y abrir `http://127.0.0.1:8765/`. Botón **✦ Nexus** o tecla **N** (Esc o N cierra).
2. Franja **DATOS DE PRUEBA**; 6 lecciones (1 sin objeciones, 1 incompleta, 4 con objeciones); 2 recomendaciones
   esperando decisión (una bloqueada por dinero y objeciones); 1 «Aprobada · sin ejecutar · no adoptada».
3. *Importar una lección*: pegar la plantilla, escribir tu alias → dictamen «Incompleto» y «Admisión al almacén real: NO» (falta revisión de otra persona).
4. Con Nexus abierto la 3D no dibuja. *Un cuarto*, la sala de control y el plano siguen igual. `pruebas.html` → 0 fallaron.

## Registrar de verdad

Desde la fase 1.5 está en `docs/NEXUS-FASE-1-5.md`: importar con vista previa, admisión al almacén real, sellos, respaldos y aprobación con identidad declarada.

## Límites conocidos

- Sin autenticación: `registrado_por` y `autor` son texto. La identidad es **declarada**; la autenticada llegará con CauceService.
- Los patrones de privacidad y estrategia no garantizan ausencia de filtraciones (§7): la exportación requiere revisión humana.
- ~~Quitar la última entrada del almacén no rompe la cadena de huellas.~~ Resuelto en 1.5 con el manifiesto, con los límites del modelo de amenazas de `NEXUS-FASE-1-5.md`.
- No hay exportadores automáticos ni IA (prohibidos en esta fase).
