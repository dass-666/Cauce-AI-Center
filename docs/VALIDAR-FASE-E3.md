# Fase E3: integración con el exportador corregido de Compago

Compago PR #10 (commit `8c207ce`, encima de su PR #9), leído **solo en lectura**. Cauce: rama `fase-e3/eventos-recientes`, encima del PR #12.

## Cómo se obtuvieron los documentos
Ejecuté `apps.core.cauce.construir_documento` del commit `8c207ce` contra una base **SQLite aislada** (fuera del repositorio de Compago, con `cargar_demo` y registros de prueba). El repositorio de Compago quedó sin cambios. Sus 34 pruebas (`apps.tests.test_cauce`) pasan; una se salta porque necesita PostgreSQL.
Los documentos están en `contrato/ejemplos/compago-pr10/`. **Límite:** con SQLite no se puede probar el bloqueo de fila de PostgreSQL. En SQLite, un lote «procesando» sin latido vigente sale «indeterminado».

## Matriz de compatibilidad
| Escenario (Compago) | Contrato v1 | Consumidor | Estado del importador | ¿Se dibuja? | Alertas |
|---|---|---|---|---|---|
| Base vacía | válido, REAL | sin evidencia | sin_datos | no | respaldo |
| Latido vigente, sin trabajos | válido | activo | esperando (evidencia AppLock) | sí, en reposo | respaldo |
| Latido y lote aplicándose | válido | activo | trabajando | sí, teclea | respaldo |
| Latido viejo y lote en cola | válido | detenido | requiere_revision | **no**; pantalla ámbar | crítica + respaldo |
| Lote «procesando» sin latido (SQLite) | válido | indeterminado | sin_datos | no | advertencia + respaldo |
| Lote aplicado hace 3 días, sin latido | válido | sin evidencia | sin_datos | no | respaldo |
| Lote aplicado hace 3 días, con latido | válido | activo | finalizado | sí, relajado y sin gesto al cargar | respaldo |
| `--entorno demo` con latido | válido, **DEMO** (franja) | activo | esperando | sí | — |
| `--entorno demo` sin latido | válido, DEMO | sin evidencia | sin_datos | no | — |

Los 8 departamentos llegan siempre: 1 automático, 3 reactivos, 1 humano y 3 módulos. Ningún agente fuera del importador se dibuja al cargar. Un archivo REAL puesto en `datos/demo/` se rechaza.

## Validar en Windows (mínimo)
1. En Cauce: `git checkout fase-e3/eventos-recientes`, `iniciar.bat`, y abrir `pruebas.html` → **164 pasaron, 0 fallaron**.
2. En Compago (rama del PR #10): `python manage.py exportar_cauce --salida <Cauce>\datos\reales\compago.json --cada 60`.
3. Con `aplicar_importaciones` **detenido**, el importador no aparece y el letrero dice «Consumidor: detenido» o «sin evidencia».
4. Arranca `aplicar_importaciones`. En menos de 2 minutos el importador entra y se sienta.
5. Haz una búsqueda de proveedores. En la siguiente lectura la Buscadora aparece unos 8 s y se va.
6. **No** exportes el DEMO sobre `datos/demo/compago.json`: ese archivo es el DEMO de Cauce y sus pruebas dependen de él. Si quieres ver el DEMO de Compago, escríbelo en `datos/demo/compago-exportado.json` y apúntalo con un `datos/proyectos.local.json`.
