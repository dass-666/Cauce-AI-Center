# Validar la fase E2 en Windows (representación real de Compago)

Rama `fase-e2/representacion` (PR encima del #11). Nada de esto toca Compago.

1. `git fetch` y `git checkout fase-e2/representacion`; doble clic en `iniciar.bat`.
2. Abre `pruebas.html`: debe decir **152 pasaron, 0 fallaron**.
3. Piso Compago, vista 3D, DEMO (sin `datos/reales/compago.json`):
   - Solo el **Importador** está sentado tecleando.
   - Búsqueda, Revisión de listas y UNIQ: escritorio con equipo y silla **vacía**.
   - Evaluación de oportunidades: placa **HUMANO** en el escritorio y silla vacía.
   - Márgenes, Auditoría y Supervisión: escritorio con equipo y gabinete, **sin silla**.
   - Al cargar nadie camina ni celebra.
4. Cambia a **Plano**: cada puesto dice Automático / Reactivo / Humano / Módulo y no sale ningún aviso rojo de la tarjeta gráfica.
5. Rendimiento en tu Intel UHD: con `?medir=1`, anota cuadros por segundo y llamadas de dibujo (aquí, en software, bajaron de 185 a 156 porque hay menos personajes; tu equipo puede dar otra cifra).
6. Celular: la barra inferior, la lista de departamentos y el detalle funcionan como en la fase D.
7. Con Compago real (cuando su exportador corrija `es_demo` y el latido): si `Consumidor` no es `activo`, el Importador **no** aparece. Si haces una búsqueda de proveedores en Compago, en la siguiente lectura (≤30 s) la Buscadora aparece unos 8 s y se va.

Si algo no coincide, manda captura y lo que dice `?medir=1`.
