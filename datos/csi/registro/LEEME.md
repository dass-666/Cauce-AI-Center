# Almacén REAL de CSI (local, fuera de git)

Aquí van, si existen, `actores.json`, `investigaciones.json`, `escenarios.json` y `predicciones.json` reales.
Empieza vacío: mientras no haya nada, la oficina CSI muestra el caso DEMO ficticio de `datos/csi/demo/`.

- Las predicciones se anexan con `node herramientas/csi.mjs predecir <archivo.json> --por <alias>` (copia previa en `respaldos/`).
- Nunca se mezclan documentos DEMO y REAL: si se mezclan, la oficina no muestra nada hasta separarlos.
- Las identidades son declaradas, sin autenticar. Para fijar la hora de una predicción, publica su huella fuera del equipo.
