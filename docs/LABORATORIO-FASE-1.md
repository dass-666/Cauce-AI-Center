# Laboratorio de IA · fase 1 (sin modelos)

**Qué es.** La infraestructura para encargar trabajo a una IA y verificar mecánicamente lo que responde, **antes** de conectar ningún modelo. En la fase 1 no hay ningún modelo, API, red ni gasto. Las respuestas de IA de las pruebas son sintéticas y llevan la marca [DEMO].

## Qué se entregó (comprobado con pruebas)

| Pieza | Archivo | Pruebas |
|---|---|---|
| Contratos `cauce.lab.encargo/ejecucion/verificacion` 0.1 | `app/laboratorio/contratos.js`, `contrato/LABORATORIO-CONTRATOS.md` | `pruebas/casos-laboratorio.js` |
| Verificador determinista `lab-V 0.1` | `app/laboratorio/verificador.js` | idem |
| Registro auditable encadenado | `app/laboratorio/registro.js` | idem + `pruebas/laboratorio-node.mjs` |
| Generador del banco de errores sembrados | `app/laboratorio/banco.js` | idem |
| Herramienta de línea de comandos (escritura atómica) | `herramientas/laboratorio.mjs` | `pruebas/laboratorio-node.mjs` |
| Ejemplos DEMO | `datos/laboratorio/demo/` | usados por las pruebas de Node |

```
node pruebas/ejecutar.mjs          # 430: las 395 anteriores + 35 del Laboratorio (también en pruebas.html)
node pruebas/laboratorio-node.mjs  # 6: disco, atomicidad y la herramienta de punta a punta
```

## Qué verifica lab-V (y qué NO)

lab-V **sí** comprueba, por cita:

- Que la fuente exista en el catálogo del encargo. Una fuente inventada es «posible invención».
- Que la copia local tenga la huella registrada (integridad).
- Que el extracto aparezca en la fuente, de forma literal o con espacios normalizados. Avisa si es demasiado corto, si aparece más de una vez o si hay una negación justo antes («posible fuera de contexto»).
- Que la fuente se conociera antes del corte temporal.

También comprueba:

- Circularidad directa e indirecta: respuestas de IA usadas como fuente o como insumo sin verificar.
- Mezcla DEMO/REAL, encargo modificado y rol distinto.
- Red sin permiso, dominios no permitidos y costo distinto de $0.
- Instrucciones dentro de la respuesta: las avisa y **nunca las ejecuta**.
- Que una ejecución fallida quede como «sin salida» con su error literal, y que una salida parcial no quede como «apta».

lab-V **no** comprueba que la cita respalde la afirmación (respaldo semántico). Eso queda siempre «pendiente de revisión humana». Ninguna afirmación sale marcada como verdadera.

## Aislamiento (cómo se comprueba)

- `app/laboratorio/*.js` no usa red, no escribe, no ejecuta y no llama a funciones de escritura de CSI ni de Nexus. Una prueba lo revisa en el código fuente.
- `herramientas/laboratorio.mjs` no importa red ni procesos hijos y no apunta a `app/csi`, `app/nexus`, `datos/csi` ni `datos/nexus`. También lo revisa una prueba.
- Los registros REALES (`datos/laboratorio/registro/`), los bancos generados (`datos/laboratorio/banco/`) y las especificaciones privadas (`datos/laboratorio/privado/`) están en `.gitignore`.
- No se modificó ningún motor existente. El Laboratorio solo **lee** con `construirDesdeExpediente` y `revisarAbogado`.

## Banco de errores sembrados

- `construirBanco` toma un expediente CSI y una especificación de defectos, y produce tres cosas separadas:
  - una copia de **evaluación**
  - una **clave** de respuestas
  - un **manifiesto** con huellas SHA-256
- Garantías comprobadas:
  - el original no cambia
  - fuentes y cotejos quedan idénticos
  - el resultado es determinista
  - la aprobación empieza en «pendiente_revision_diego»
- El banco real del franco suizo (10 defectos) **no** está en el repositorio. Se entregó aparte para que Diego lo revise.
- En el repositorio solo hay una especificación de prueba con 2 defectos (`datos/laboratorio/banco-prueba/`).

Hallazgo: con las reglas actuales (motor CSI + Abogado), solo 1 de los 10 defectos se detecta: la hipótesis sin condición de refutación. Eso justifica el Laboratorio y fija la línea base contra la que se medirá cualquier IA.

## Integración futura (documentada, NO implementada)

```
Diego escribe el encargo (humano) ──► sesión manual de Claude (adaptador «manual-claude», sin API)
      │                                  rol investigador → ejecución 1
      │                                  rol analista      → ejecución 2 (recibe solo ejecuciones VERIFICADAS)
      │                                  rol crítico       → ejecución 3 (único que recibe el banco)
      ▼
lab-V verifica cada ejecución ──► registro auditable ──► revisión humana (respaldo semántico)
      ▼  solo lo aprobado por Diego
CSI / Nexus por sus contratos actuales:
  · objeción o hipótesis con autor.tipo = "ia" (el contrato Nexus ya lo admite)
  · evidencia de origen «texto_ia», que por regla «no acredita hechos» (app/nexus/gerente.js)
```

- La sesión manual consiste en copiar el encargo a una conversación de Claude y pegar la respuesta como `cauce.lab.ejecucion`. No hay API, así que el costo es $0.
- Un modelo local (adaptador `ollama`) queda reservado. No se instala nada sin aprobación.
- Ninguna salida de IA se convierte en fuente. Una lección de IA no entra a Nexus sin aprobación humana.
- No hay sala 3D para el Laboratorio en esta fase.

## Límites conocidos

- Las PDF y HTML necesitan una extracción de texto aprobada por una persona (`texto_sha256`). `catalogoDesdeInvestigacion` deja ese campo en `null`, y entonces la coincidencia textual queda «no evaluable».
- La detección de «fuera de contexto» es una heurística de negación en 80 caracteres. Avisa; no decide.
- Los defectos del banco los escribió la misma IA que construyó el Laboratorio. No es una evaluación independiente.
