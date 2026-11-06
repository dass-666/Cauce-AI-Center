# Registro real de Nexus (local, fuera de git)

Aquí viven `lecciones.json` y `recomendaciones.json` reales. Git los ignora: no se suben al repositorio.
Si no existen, la oficina Nexus muestra los datos de prueba de `datos/nexus/demo/` con la franja DEMO.

- Con Node: `node herramientas/nexus.mjs agregar-leccion mi-leccion.json` (crea el archivo si no existe).
- Sin Node: en la oficina Nexus, «Revisar un borrador» → «Descargar registro con esta lección» y guardar el
  archivo descargado aquí como `lecciones.json` (reemplaza al anterior, que ya va incluido dentro).

Nunca borres ni edites entradas a mano: cada una lleva la huella de la anterior y el registro detecta el cambio.
