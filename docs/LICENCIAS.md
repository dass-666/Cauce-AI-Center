# Licencias de terceros

**Vista 2D: ninguna.** El plano 2D no usa bibliotecas, imágenes, modelos, fuentes tipográficas ni íconos de terceros.

**Vista 3D: three.js (MIT) y Kenney Mini Characters (CC0).** El mobiliario y los letreros están hechos con código propio. Si un modelo de Kenney no carga, se usa el personaje provisional hecho con código. Costo: $0.

## Regla para agregar un recurso

Antes de agregar cualquier biblioteca, modelo 3D, textura, sonido o fuente:

1. Confirmar la licencia en el archivo de licencia **dentro de la descarga**, no solo en la página web.
2. Aceptar solo licencias que permitan uso comercial: MIT, BSD, Apache-2.0, CC0, CC-BY (con atribución), OFL (fuentes).
3. Rechazar: CC-BY-NC (prohíbe uso comercial), "solo uso personal", o licencias poco claras.
4. Copiar el recurso al repositorio en una versión fija (sin CDN) y registrarlo aquí.

| Recurso | Versión | Origen | Licencia | Dónde se usa | Verificado el |
|---|---|---|---|---|---|
| three.js (`vendor/three/`: `build/three.module.js`, `build/three.core.js`, `LICENSE` y 14 archivos de `examples/jsm/`: OrbitControls, postprocesado para el brillo, GLTFLoader, SkeletonUtils y BufferGeometryUtils) | 0.187.0 | Paquete npm `three@0.187.0` (registry.npmjs.org). Integridad sha512 `Qiu7R+Cmh8CstZsY1uJOSWnVlfo7ZtNLV7mF8Jltk3LB3AtDu9cRZlcnRKkAk8Y4z6KKw35z7Y7Urd7jWY8etA==`, igual a la publicada en el registro | MIT (`vendor/three/LICENSE`, "Copyright © 2010-2026 three.js authors"). Permite uso comercial; exige conservar el aviso | Vista 3D | 2026-11-03 |

| Kenney Mini Characters (`vendor/kenney-mini-characters/`: `License.txt`, los 12 `character-*.glb` y `Textures/colormap.png`; sin los accesorios ni las sillas de ruedas) | 1.0 (creado el 17-07-2024) | ZIP oficial `kenney_mini-characters.zip` que entregó Diego, descargado de kenney.nl/assets/mini-characters. SHA-256 del ZIP: `9e1d48e6d7b8479ebbe84df71eb5bd8e1b3f0da546dea641890dccc8a02d0999` | CC0 1.0 (`License.txt`: "Creative Commons Zero, CC0 … personal, educational, and commercial purposes"). El crédito es opcional; lo damos aquí: **Kenney (www.kenney.nl)** | Personajes de la vista 3D | 2026-11-03 |

### Revisado y no incluido

| Recurso | Licencia | Por qué no se incluye |
|---|---|---|
| KayKit Character Animations 1.2 (Kay Lousberg). SHA-256 del ZIP: `c9d3fbea492dc6edd0903939369a564c2240b892430bcd99e0aee4876110bb8f` | CC0 1.0, verificada en su `License.txt` | Sus animaciones son para su propio esqueleto (6 huesos, sin piernas), distinto al de Kenney (7 huesos con piernas). Los modelos de Kenney ya traen caminar, quieto, sentado y negar; los gestos que faltan se hacen con código |

Dos pruebas automáticas fallan si cambia lo copiado sin actualizar esta tabla: `3D: three.js copiado es la versión 0.187.0 con licencia MIT` y `3D: personajes de Kenney presentes y con licencia CC0`.
