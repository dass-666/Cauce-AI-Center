# Validar CSI fase 2 en Windows (Intel UHD) · 15 minutos

Todo local y $0. No toca Compago, Ek Chuah, Tezcatlipoca ni el almacén real de Nexus. Nada se publica.

1. **Traer la rama**: `git fetch origin claude/csi-fase-2` y `git checkout claude/csi-fase-2`.
2. **Caso histórico**: ya no hace falta Node ni copiar nada. El caso publicado
   (`datos/csi/casos-publicados/expediente-bns-2015.json`) se reconstruye en el navegador con el mismo motor
   cuando `datos/csi/historico/` está vacía. La banda azul lo dice: «reconstruido en este navegador».
3. **Abrir**: `iniciar.bat` (o `python servir.py`) y `http://127.0.0.1:8765/?csi=historico&medir=1`.
   - Debe verse la banda azul «HISTÓRICO · REAL RETROSPECTIVO».
   - Arriba, «Ver: REAL · HISTÓRICO · DEMO». REAL aparece deshabilitado si tu almacén está vacío.
4. **Recorrer las pestañas**:
   - **Fuentes**: el alcance registrado antes de las fuentes, 13 registros (12 consultadas con huella y 1 PENDIENTE, el enlace equivocado de 2011), las tres fechas por fuente, «Abrir el original ↗» y la tabla «¿Qué se podía conocer en cada momento?».
   - **Mapa y relaciones**: los 5 actores.
   - **Flujo de 10 pasos**: debe decir 9/10. Falta la evidencia de H-C y H-D, y eso es lo correcto.
   - **Abogado del Diablo**: una tabla de 8 preguntas × 4 hipótesis.
   - **Árbol**: la etiqueta CONTRAFACTUAL.
   - **Predicciones**: debe explicar que un caso histórico no tiene predicciones.
   - **Propuesta a Nexus → «Preparar H-A»**: debe mostrar «decisión: pendiente». No hay botón para aprobar.
   - **Investigaciones → «Descargar expediente (.md)»**: baja `expediente-hist-bns-minimo-2015.md` con las 13 fuentes, las huellas y el historial.
5. **Anclas en DEMO**:
   - Pulsa «DEMO» y luego la pestaña Predicciones. Las 5 filas deben decir «Hora DECLARADA».
   - Pulsa «Generar ancla» y luego «Descargar ancla».
   - En «Verificar con un ancla…», elige el archivo descargado. Las filas deben pasar a «Anclada, ancla sin acreditar».
   - Abre el archivo descargado con el Bloc de notas, cambia un carácter de una huella, guárdalo y vuelve a elegirlo. Debe decir «NO coincide».
6. **Medir (lo único que no pude medir)**:
   - Anota los cps con `?medir=1` en el piso «Inteligencia Estratégica (CSI)» y en Compago, en 3D.
   - Con el laboratorio abierto, la 3D se pausa.
7. **Pruebas**: abre `http://127.0.0.1:8765/pruebas.html`. Debe decir «395 pasaron, 0 fallaron».

Envíame:
- los cps del paso 6;
- qué pestaña te resultó confusa;
- tu decisión sobre las preguntas del informe (sección 13).
