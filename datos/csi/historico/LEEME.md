# CSI · casos HISTÓRICOS (reales, retrospectivos)

Esta carpeta guarda casos reales ya ocurridos, analizados después con fuentes públicas fechadas. **No son predicciones.**
Todo lo que hay aquí, salvo este archivo, está fuera de git: el repositorio es público y una investigación solo se
publica si Diego lo autoriza.

Para ver un caso en el laboratorio (tecla I, botón «HISTÓRICO», o `?csi=historico`):

1. Copia aquí el expediente (por ejemplo `expediente-bns-2015.json`).
2. Ejecuta `node herramientas/csi.mjs expediente datos/csi/historico/expediente-bns-2015.json`. Escribe
   `actores.json`, `investigaciones.json` y `escenarios.json` con el mismo motor que usa una persona, así el
   historial y las huellas son reales.
3. `node herramientas/csi.mjs revisar --base datos/csi/historico` muestra el flujo de 10 pasos, el Abogado del Diablo
   y las fuentes pendientes.

Un caso histórico no lleva `predicciones.json`. Las predicciones van en `datos/csi/registro/`, registradas antes de su horizonte.
