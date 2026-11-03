# Licencias de terceros

**Vista 2D: ninguna.** El plano 2D no usa bibliotecas, imágenes, modelos, fuentes tipográficas ni íconos de terceros.

**Vista 3D: solo three.js (MIT).** El mobiliario, los letreros y los personajes provisionales están hechos con código propio; no hay modelos, texturas, sonidos ni fuentes descargados. Costo: $0.

## Regla para agregar un recurso

Antes de agregar cualquier biblioteca, modelo 3D, textura, sonido o fuente:

1. Confirmar la licencia en el archivo de licencia **dentro de la descarga**, no solo en la página web.
2. Aceptar solo licencias que permitan uso comercial: MIT, BSD, Apache-2.0, CC0, CC-BY (con atribución), OFL (fuentes).
3. Rechazar: CC-BY-NC (prohíbe uso comercial), "solo uso personal", o licencias poco claras.
4. Copiar el recurso al repositorio en una versión fija (sin CDN) y registrarlo aquí.

| Recurso | Versión | Origen | Licencia | Dónde se usa | Verificado el |
|---|---|---|---|---|---|
| three.js (`vendor/three/`: `build/three.module.js`, `build/three.core.js`, `LICENSE` y 11 archivos de `examples/jsm/`: OrbitControls y postprocesado para el brillo) | 0.187.0 | Paquete npm `three@0.187.0` (registry.npmjs.org). Integridad sha512 `Qiu7R+Cmh8CstZsY1uJOSWnVlfo7ZtNLV7mF8Jltk3LB3AtDu9cRZlcnRKkAk8Y4z6KKw35z7Y7Urd7jWY8etA==`, igual a la publicada en el registro | MIT (`vendor/three/LICENSE`, "Copyright © 2010-2026 three.js authors"). Permite uso comercial; exige conservar el aviso | Vista 3D | 2026-11-03 |

### Pendientes (no están en el repositorio)

| Recurso | Licencia anunciada | Estado |
|---|---|---|
| Kenney Mini Characters | CC0 según kenney.nl | **No descargado**: kenney.nl está bloqueado en el entorno de desarrollo. Se verificará el `License.txt` del ZIP antes de usarlo |
| KayKit Character Animations | CC0 según itch.io | **No descargado**: itch.io está bloqueado. Mismo procedimiento |

Una prueba automática (`3D: three.js copiado es la versión 0.187.0 con licencia MIT`) falla si alguien cambia la versión copiada sin actualizar esta tabla.
