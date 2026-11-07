# CSI · casos HISTÓRICOS (reales, retrospectivos)

Esta carpeta guarda casos reales ya ocurridos, analizados después con fuentes públicas fechadas. **No son predicciones.**
Todo lo que hay aquí, salvo este archivo, está fuera de git: el repositorio es público y una investigación solo se
publica si Diego lo autoriza.

**Si la carpeta está vacía, no hace falta hacer nada.** El laboratorio (tecla I, botón «HISTÓRICO» o `?csi=historico`)
reconstruye en el navegador los casos publicados que lista `datos/csi/casos-publicados/indice.json`, con el mismo motor
que usa una persona; la banda azul dice «reconstruido en este navegador». No requiere Node.

Para trabajar aquí un caso propio (publicado o no):

1. Copia el expediente (`cauce.csi.expediente`) a esta carpeta.
2. `node herramientas/csi.mjs expediente datos/csi/historico/<expediente>.json` escribe `actores.json`,
   `investigaciones.json` y `escenarios.json`. Si existen, el laboratorio los usa en vez de reconstruir los publicados.
3. `node herramientas/csi.mjs revisar --base datos/csi/historico` muestra el flujo de 10 pasos, el Abogado del Diablo
   y las fuentes pendientes. `node herramientas/csi.mjs informe --base datos/csi/historico` escribe un `expediente-<id>.md` por investigación.

Un caso histórico no lleva `predicciones.json`. Las predicciones van en `datos/csi/registro/`, registradas antes de su horizonte.
