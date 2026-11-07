# Validar CSI en Windows (Intel UHD) · 10 a 15 minutos

Nada de esto toca Compago, Ek Chuah, Tezcatlipoca ni Nexus real. Todo es local y $0.

1. **Abrir**: doble clic en `iniciar.bat` (o `python servir.py`) y abre `http://127.0.0.1:8765/?medir=1`.
2. **Piso CSI**: en la barra de pisos elige «Inteligencia Estratégica (CSI)». Debes ver la franja amarilla DEMO y cinco oficinas: Estratega, Psicólogo de Masas, Analista de Poder, Simulador y Abogado del Diablo. Nadie «trabajando».
3. **Medir FPS (lo único que no pude medir)**: con el medidor (`?medir=1`) anota los cps del piso CSI en 3D, en «Un cuarto» (tecla 1) y en el plano. Compáralos con Compago en el mismo equipo. En SwiftShader el piso CSI usa 84 llamadas de dibujo contra 97 de Compago; eso **no** es una medición de tu Intel UHD.
4. **Laboratorio**: tecla **I** (o botón «CSI»). Recorre las pestañas: Resumen, Investigaciones, Actores, Relaciones, Hipótesis, Árbol de decisiones, Evidencias y objeciones, Predicciones, Propuesta a Nexus. Comprueba:
   - Predicciones: `pred-bc-facilidad` aparece **Fallida** y su corrección posterior dice «no cuenta»; `pred-regulador` aparece «Vencida sin evaluar».
   - Propuesta a Nexus → «Preparar H-B»: Nexus dice «con_objeciones» y la decisión humana queda «pendiente». No hay botón para aprobar.
5. **Nueva investigación**: en la última pestaña crea una de práctica (deja marcada «Práctica»), agrega una fuente con fecha, un hecho que la cite, una hipótesis con condición de refutación y una predicción con horizonte futuro (formato `2027-01-01T10:00`). Pulsa «Propuesta H1 → Nexus». Descarga los dos archivos si quieres conservarlos.
6. **Volver**: Esc o «Ir al edificio». La 3D debe seguir fluida; cambia a Compago y a Ek Chuah para confirmar que no cambió nada.
7. **Pruebas**: abre `http://127.0.0.1:8765/pruebas.html`. Debe decir «359 pasaron, 0 fallaron».

Envíame: los cps de los pasos 2–3 (CSI y Compago) y cualquier cosa que se vea mal o confusa.
