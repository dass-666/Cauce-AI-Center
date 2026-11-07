# CSI · Cauce Strategic Intelligence · fase 1 · informe consolidado (2026-11-07)

Departamento de Inteligencia Estratégica y Comportamiento Humano dentro de Cauce AI Center.
**CSI investiga · Nexus cuestiona · Diego decide.** Encadenado sobre el PR #23 (Nexus 1.5), sin fusionar ni desplegar.

Leyenda: **[verificado]** = lo comprobé con una prueba o comando en este entorno · **[inferencia]** = razonamiento sin medición · **[sin verificar]** = falta comprobarlo (normalmente en tu Windows).

## 1. Estado del PR #23 y dependencias

- PR #23 (rama `claude/project-thread-2fxi1j`, commit `99deed1`): borrador, sin fusionar. Sus 331 pruebas Node estaban en verde antes de empezar **[verificado]**. Se respetaron las ocho decisiones: Nexus sigue independiente; Ek Chuah y Tezcatlipoca en pausa; EK-L001/L003/L007 siguen como candidatas (no se tocaron); el almacén real sigue fuera de Git; Diego es el aprobador declarado sin autenticar; ninguna IA revisa; no se fusionó nada.
- **Cambio de contrato autorizado (decisión 7)**: `cauce.leccion` 0.3 = 0.2 + `muestra.naturaleza = "desconocida"`. Un 0.2 con «desconocida» se rechaza pidiendo 0.3; los registros 0.2 no se reinterpretan; los DEMO de Nexus no cambiaron (comprobado con `herramientas/nexus-demo.mjs --comprobar`) **[verificado]**. R08: con «desconocida» nada pasa de «no evaluado» salvo un método con confianza baja. Detalle en `contrato/NEXUS-CONTRATOS.md` § 0.3. Es un commit propio (`975c192`) para poder revisarlo aparte.
- Cadena de fusión: …→ #21 → #22 → #23 → **PR CSI** (nuevo, borrador, base = rama del #23).

## 2. Arquitectura

```
app/csi/                       (módulo independiente; solo comparte funciones puras de app/nexus/comun.js)
  base.js            fuentes, fechas, privacidad, «sin probabilidades»
  investigacion.js   cauce.csi.investigacion 0.1 + motor (aplicarCambio, historial con huellas, análisis)
  actores.js         cauce.csi.actores 0.1 + relaciones verificables + alianzas/tensiones sin suponer coordinación
  simulador.js       cauce.csi.escenario 0.1 + simular() determinista + plantilla A–D
  predicciones.js    cauce.csi.predicciones 0.1 (solo anexado, versiones, evaluación, referencia simple)
  adaptador-nexus.js cauce.csi.propuesta-nexus 0.1 → borrador cauce.leccion 0.3 + dictamen del gerente
  piso.js            CSI → cauce.estado-proyecto 1.0.0 (sin cambiarlo) para el edificio
  registro.js        lectura REAL/DEMO y resumen
  demo.js            caso ficticio construido con el mismo motor
app/vistas/csi.js    laboratorio (10 pestañas), solo HTML, sin animaciones
herramientas/csi.mjs demo | resumen | validar | predecir | piso      (Node, sin red)
datos/csi/demo/      caso ficticio · datos/csi/registro/ almacén REAL local (fuera de git, vacío)
escena/csi.json + datos/demo/csi.json   piso de 5 estaciones
```

Flujo: Investigación → Hipótesis → Escenario → Revisión escéptica (Nexus) → Propuesta → Decisión humana (Diego) → Seguimiento (predicciones).

**Por qué un piso y no solo un panel** [inferencia]: reutiliza tal cual edificio 3D, plano 2D, «Un cuarto», personajes Kenney, recepción y navegación. El 3D solo dibuja el piso elegido, así que agregar CSI no cuesta nada a los demás pisos. El laboratorio es HTML y, mientras está abierto, la 3D se pausa (0 cuadros en 2 s, [verificado]).

**Costo de esa decisión**: la sala de control y el selector ahora cuentan 7 proyectos. Siete pruebas antiguas esperaban 6; las actualicé (y lo digo aquí para que no pase inadvertido).

## 3. Funcionalidades implementadas

- **Oficina CSI** (bloque 2): Estratega (mesa de análisis), Psicólogo de Masas (paneles con gráficas), Analista de Poder (mapa y corcho), Simulador (supervisión) y Abogado del Diablo (auditoría, cuarto doble). Muebles por código y personajes existentes. Nadie aparece «trabajando»: CSI no corre solo.
- **Motor de investigaciones** (bloque 3): todos los campos pedidos. Hecho / declaración / inferencia / simulación / predicción separados por regla, no por convención. Una intención como «hecho» solo con documento oficial o regulatorio del propio actor. Retirar en vez de borrar. Revisión humana independiente (una IA o el propio autor no revisan) que se reabre si algo cambia después.
- **Actores e incentivos** (bloque 4): 8 tipos institucionales/colectivos (no personas privadas). Lo documentado exige fuente; lo hipotético se marca. Relaciones sin fuente no entran al análisis. Bloques = solo cooperación documentada; un par sin relación se dice «sin relación documentada».
- **Simulador** (bloque 5): escenarios manuales y plantilla «caída abrupta» con A (fundamentales), B (liquidez), C (oportunista) y D (manipulación, **solo hipótesis**). Decisiones, beneficios y costos hipotéticos, restricciones que bloquean ramas, respuestas, consecuencias, señales que apoyarían/refutarían y datos faltantes. Sin probabilidades.
- **Memoria de predicciones** (bloque 6): ver § 6.
- **Adaptador a Nexus** (bloque 7): ver § 7.
- **Paneles** (bloque 8): Resumen, Investigaciones, Actores (filtro por tipo), Relaciones, Hipótesis (tabla comparativa), Árbol de decisiones, Evidencias y objeciones, Predicciones (predicción vs resultado vs referencia), Propuesta a Nexus, Nueva investigación (crear, fuente, enunciado, hipótesis, objeción, revisión, predicción, evaluación, propuesta y descargas).

## 4. Capturas

En `/mnt/project-files/cauce/csi/capturas/` (Chromium con SwiftShader, no tu GPU): piso 3D, estación Estratega, plano 2D, resumen, investigación, hipótesis, árbol, predicciones, propuesta a Nexus, laboratorio y celular.

## 5. Demostración del laboratorio (caso ficticio «Caída del Índice Lumen 40»)

País, bolsa, 7 actores, fuentes y cifras inventados (todo `[DEMO]` y `ficticia: true`). 38 entradas en el historial, todos con huella. Lo que demuestra **[verificado por pruebas]**:

| Pedido | Dónde se ve |
|---|---|
| Una predicción equivocada se conserva | `pred-bc-facilidad` = **Fallida**; su «corrección» posterior al resultado es versión 2 «posterior: no cuenta» |
| Una hipótesis sin evidencia queda incompleta | H-D (manipulación) = **Incompleta**: sin evidencia y sin documento regulatorio |
| Una simulación no se presenta como resultado real | Aviso «SIMULACIÓN… no es un resultado real»; el enunciado `s1` no puede usarse como evidencia (error de contrato) |
| Un acierto no demuestra causalidad | `pred-rebote` = Acertada **igual que la referencia simple**, con el aviso explícito; el modelo acierta 1 de 2 y la referencia 2 de 2 |
| Nexus recibe sin aprobar | Propuesta H-B → Nexus «con objeciones» (R08, R09; R01/R03/R05 no evaluadas), decisión humana pendiente |

Además: dos hechos que se contradicen (boletín vs prensa) se señalan; una relación sin fuente queda fuera; una rama del árbol (recortar tasa) queda bloqueada por la restricción de inflación; la revisión de la investigación se reabrió sola cuando llegó una objeción después.

## 6. Memoria de predicciones

Registro solo anexado con cadena SHA-256: `registro` (antes del horizonte; fuentes anteriores al registro), `correccion` (versión nueva; si llega tarde queda «posterior» y no cuenta; no puede mover el inicio del horizonte), `evaluacion` (no antes del horizonte; evidencia posterior al registro y anterior a la evaluación; acertada/fallida exigen evidencia; indeterminada exige nota). Cuenta pendientes, en curso, **vencidas sin evaluar**, acertadas, fallidas e indeterminadas, y compara con la referencia simple; con menos de 10 decididas no declara ventaja. Reescribir, borrar o reordenar una entrada rompe la cadena **[verificado]**.

**Límite importante**: la hora de registro es **declarada**. La cadena prueba el orden, no la hora. Para que una predicción cuente como «anterior al acontecimiento» frente a terceros hay que publicar su huella fuera del equipo (p. ej. un commit en GitHub) antes del horizonte. No lo automaticé: requiere tu decisión.

## 7. Integración con Nexus y sus límites

- CSI no es un gerente: no aprueba ni ejecuta. El adaptador genera un **borrador** `cauce.leccion` 0.3 siempre «propuesta», confianza baja, «sin resultado», naturaleza `desconocida` (REAL) o `demo`, y lo pasa al gerente `nexus-R 0.2` solo para obtener su dictamen.
- **No escribe en el almacén de Nexus**. La propuesta se descarga; registrarla en Nexus sigue siendo la importación manual de la fase 1.5, con tu decisión.
- **Circularidad**: un hecho o declaración que cite a Nexus se rechaza; aunque alguien salte el validador, el adaptador lo excluye; una hipótesis cuyo origen es una recomendación de Nexus queda bloqueada. Las predicciones van como seguimiento, nunca como evidencia.
- Nunca se convierte una hipótesis en lección validada (comprobado también con `revisarPropuesta`).

## 8. Pruebas ejecutadas

RESULTADOS_PRUEBAS

## 9. Ramas, commits y PR

- Rama `claude/project-thread-bg64t5`, base `claude/project-thread-2fxi1j` (PR #23, `99deed1`).
- `975c192` Nexus: contrato `cauce.leccion` 0.3 · `9e572c2` CSI completo · más el commit de documentación.
- PR nuevo en **borrador**, encadenado al #23. No fusionar antes que #23.

## 10. Qué probar en Windows

Guía de 10–15 minutos: `docs/VALIDAR-CSI.md`. Lo esencial: **medir cps del piso CSI y de Compago en tu Intel UHD** (no lo medí: SwiftShader no cuenta) y recorrer el laboratorio.

## 11. Limitaciones y siguientes mejoras

Limitaciones:
- Rendimiento en Intel UHD **sin medir** [sin verificar]. En SwiftShader: 84 llamadas en el piso CSI frente a 97 en Compago.
- Horas declaradas, identidades declaradas (sin autenticación).
- El laboratorio no guarda solo: descarga archivos que tú copias a `datos/csi/registro/`; las predicciones reales se anexan con `herramientas/csi.mjs predecir`. Hoy no hay edición de un almacén real desde el navegador (decisión deliberada: igual que Nexus).
- Los patrones de privacidad no garantizan ausencia de datos personales.
- El caso DEMO es ilustrativo; no hay ninguna investigación real, ni fuentes reales consultadas (no hice búsquedas: no hay fuente autorizada ni finalidad concreta).
- La categoría y el estado de una hipótesis son reglas simples; no miden fuerza de evidencia ni calidad de fuentes.

Siguientes mejoras (en este orden, todas $0):
1. **Ahora**: que valides en Windows y decidas si el piso CSI se queda en el selector o solo como laboratorio (si prefieres que la sala siga con 6 proyectos, es un cambio pequeño).
2. **Ancla externa de predicciones**: un paso que imprima la huella para pegarla en un commit o issue antes del horizonte. Barato y es lo que da valor real a la memoria.
3. **Primera investigación REAL acotada**: un solo acontecimiento, 5–10 fuentes públicas que tú elijas. Sin eso, CSI no aprende nada.
4. **Después**: importar el registro real desde el navegador con vista previa (como Nexus 1.5); métricas de calibración solo cuando haya ≥ 30 predicciones evaluadas.
No recomiendo todavía: probabilidades, scraping masivo o modelos de IA para generar hipótesis; sin historial evaluado serían ruido con apariencia de precisión.
