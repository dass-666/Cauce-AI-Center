# Integración futura de Cauce AI Center en el portal CauceService

Fase L, 2026-11-05. **Documento de preparación: no se integró nada, no se publicó nada y no se tocó CauceService**
(su repositorio sigue sin localizarse). Explica qué necesita el edificio para abrirse desde la página principal de
Cauce el día que estemos listos, qué ya quedó preparado en este repositorio y qué decisiones faltan.

## 1. Resumen en cinco líneas

1. El visualizador es una **página estática**: HTML, CSS, JavaScript y archivos JSON. No tiene servidor propio con
   lógica, ni base de datos, ni claves. Cualquier servidor web puede entregarlo.
2. Todas sus rutas son **relativas**: funciona en la raíz (`/`) o en una subruta (`/cauce/`). Probado en Chromium.
3. La forma recomendada de mostrarlo en el portal es **servirlo bajo `/cauce/` del mismo dominio del portal** y
   abrirlo con un enlace o dentro de un `iframe` con `?incrustado=1`.
4. **Un iframe no es seguridad.** Quién puede ver qué proyecto lo tiene que decidir y aplicar el servidor del portal
   (autenticación y autorización), incluido el acceso directo a los archivos `datos/reales/*.json`.
5. Faltan decisiones que no son técnicas de Cauce (sección 7): dónde vive CauceService, cómo llegan los JSON al
   servidor (puente de Ronny), quién ve cada proyecto y cómo se comparte la sesión.

## 2. Cómo arranca hoy la aplicación

```
index.html
 ├─ script en línea (fase L): corrige /cauce → /cauce/ y activa ?incrustado=1
 ├─ app/estilos.css
 ├─ importmap: three → ./vendor/three/build/three.module.js   (copiado, sin CDN)
 └─ app/app.js (módulo)
     ├─ lee datos/proyectos.local.json o, si no existe, datos/proyectos.json   (registro de pisos)
     ├─ por cada piso lee datos/reales/<id>.json; si no existe, datos/demo/<id>.json (marcado DEMO)
     ├─ lee escena/<id>.json (distribución) y escena/<id>-naturaleza.json (qué es cada puesto), si existen
     ├─ vuelve a leer cada 30 s (y al volver a la pestaña)
     └─ solo si se usa la 3D: import("./vistas/vista3d/escena3d.js") → three.js y vendor/kenney-mini-characters/*.glb
```

- **Sin compilación ni `npm install`.** `package.json` solo declara que el código usa módulos.
- **Sin servicios externos.** Nada se descarga de internet; funciona sin conexión.
- **Solo lectura.** La página hace `fetch` (GET) de archivos; no envía datos a ningún lado, no tiene formularios ni
  botones que actúen sobre sistemas (comprobado en `pruebas/navegador/fase-k.cjs` y `fase-l.cjs`).

## 3. Archivos que necesita (lo que hay que publicar)

| Carpeta / archivo | Para qué | ¿Público para quien tenga acceso al edificio? |
|---|---|---|
| `index.html`, `app/` | La aplicación | Sí |
| `vendor/three/` (MIT), `vendor/kenney-mini-characters/` (CC0) | 3D y personajes | Sí (licencias en `docs/LICENCIAS.md`) |
| `escena/*.json` | Distribución de departamentos y naturaleza de cada puesto | Sí (no tiene datos operativos) |
| `datos/proyectos.json` | Registro de pisos (DEMO) | Sí |
| `datos/demo/*.json` | Demostraciones marcadas `es_demo: true` | Sí |
| `datos/proyectos.local.json` | Registro local con datos reales (fuera de git) | **Solo usuarios autorizados** |
| `datos/reales/*.json` | Estado real que escriben los adaptadores | **Solo usuarios autorizados, por proyecto** |
| `pruebas.html`, `pruebas/` | Pruebas | No hace falta publicarlos en producción |
| `servir.py`, `*.bat`, `docs/`, `contrato/`, `herramientas/` | Uso local y documentación | **No** publicar |

## 4. El servidor local (`servir.py`) y qué cambió en la fase L

- Escucha **solo en 127.0.0.1** (no se expone a la red). Solo entrega archivos; no ejecuta adaptadores.
- Cabeceras: `Cache-Control: no-store`, `X-Content-Type-Options: nosniff`, sin listados de carpetas.
- **Nuevo:** `Content-Security-Policy: frame-ancestors 'self'` (solo páginas del mismo origen pueden incrustarlo:
  evita que un sitio ajeno lo meta en un iframe para engañar al usuario) y `Referrer-Policy: no-referrer`.
- **Nuevo:** `py servir.py --base /cauce/` sirve la carpeta bajo `/cauce/` para probar **en tu computadora** cómo se
  vería publicada en una subruta. `/cauce` redirige a `/cauce/`; todo lo que esté fuera de `/cauce/` da 404.
  No es un servidor de producción y no debe usarse como tal.

## 5. Qué pasa bajo una subruta (probado)

`pruebas/navegador/fase-l-portal.cjs` levanta `servir.py --base /cauce/` en 127.0.0.1:8768 y comprueba en Chromium:

- `/cauce` → 301 → `/cauce/`; abrir `/cauce` en el navegador termina en `/cauce/` y la oficina 3D carga.
- **Ningún archivo se pide fuera de `/cauce/`** ni a otro servidor (three.js, modelos `.glb`, JSON, CSS).
- Sin archivos faltantes, salvo los datos reales que todavía no existen (esperado).
- La sala de control funciona; `pruebas.html` corre completo bajo `/cauce/` (251/251).
- `?incrustado=1`: sin marca ni pie; **siguen visibles** la franja DEMO, la conexión, la edad del dato, las alertas y
  las pestañas de pisos.
- Una página «portal» de prueba del mismo origen muestra la oficina dentro de un `iframe`.
- También hay una prueba en Node que busca rutas absolutas (`"/algo"`) en los archivos principales: no hay.

**Única condición:** la dirección debe terminar en `/` (`/cauce/`). `index.html` lo corrige solo; aun así, conviene
que el servidor del portal redirija `/cauce` → `/cauce/` (como hace `servir.py --base`).

## 6. Formas de mostrarlo en el portal (de la más simple a la más acoplada)

| Opción | Cómo | Ventajas | Desventajas | Recomendación |
|---|---|---|---|---|
| A. Enlace | Botón «Oficina virtual» que abre `/cauce/` (misma o nueva pestaña) | Nada que integrar; cero acoplamiento | Sale del portal | **Primer paso** |
| B. iframe mismo origen | `<iframe src="/cauce/?incrustado=1">` en una página del portal | Se ve dentro del portal; el visualizador no cambia | El portal debe dar alto suficiente (≥ 600 px); teclado dentro del iframe | **Cuando el portal tenga autenticación** |
| C. iframe de otro dominio | `cauce.otro-dominio` incrustado en el portal | Separación total | Hay que cambiar `frame-ancestors`, cookies de terceros, CORS si se comparten datos | Solo si hay una razón fuerte |
| D. Módulo dentro del portal | Importar `app/` en el código del portal | Una sola aplicación | Acopla versiones, estilos y ciclo de vida; duplica lógica si se reescribe | **No por ahora** |

Con A o B **no se duplica lógica**: el portal solo apunta a la carpeta publicada.

Ejemplo de B (solo ilustrativo, no está en ningún repositorio):

```html
<iframe src="/cauce/?incrustado=1" title="Cauce · oficina virtual (solo lectura)"
        style="width:100%; height:80vh; border:0" loading="lazy"></iframe>
```

## 7. Lo que NO se implementó y por qué (dependencias de CauceService)

| Tema | Por qué no se hizo | Qué hace falta decidir |
|---|---|---|
| **Autenticación** (quién entra) | Sin CauceService no hay a quién preguntar; una pantalla de acceso falsa sería peor que nada | Mecanismo del portal (sesión, SSO); que proteja `/cauce/` completo en el servidor |
| **Autorización por proyecto** | Hoy cualquiera con acceso a la carpeta puede leer todos los `datos/reales/*.json` | Reglas en el servidor (proxy) por archivo o por proyecto; quizá un registro distinto por usuario |
| **Origen de los datos reales** | Depende del puente de Ronny (Docker → JSON) | Dónde se escriben los JSON en el servidor y con qué permisos |
| **Política de incrustación del portal** | Depende de su dominio | `frame-ancestors` del portal; si se usa otro dominio, ajustar el de Cauce |
| **HTTPS, dominio, puertos** | Fuera de alcance (no publicar, no abrir puertos) | Lo configura quien administre el servidor |
| **Caché** | `no-store` es correcto en local | En producción: `no-store` para `datos/`, caché larga con versión para `vendor/` |
| **Historial permanente** | La sala guarda cambios solo durante la sesión | Si se quiere, lo debe guardar CauceService (base de datos), no el navegador |
| **Acciones sobre procesos** | Cauce es de solo lectura (`docs/CONTROL-FUTURO.md`) | Catálogo de acciones, permisos, auditoría y confirmación en CauceService |

Advertencias importantes:

- **Un iframe no protege nada.** Quien conozca la dirección `/cauce/datos/reales/compago.json` puede pedirla directo.
  La protección tiene que estar en el servidor.
- **No poner credenciales en el visualizador.** Es código que corre en el navegador: cualquiera puede leerlo.
- **`localStorage` compartido.** En el mismo dominio del portal, las preferencias de Cauce (`cauce.vista`,
  `cauce.proyecto`, `cauce.sala`, etc.) conviven con las del portal. Todas empiezan con `cauce.` para no chocar; no
  guardan datos operativos.
- **Los JSON pueden contener información sensible** (nombres de procesos, errores, conteos). Los exportadores ya
  evitan secretos (ver `docs/INTEGRACIONES.md`), pero el acceso igual debe ser solo para personas autorizadas.

## 8. Lista para el día de la integración

1. Localizar el repositorio de CauceService y confirmar dónde se publicará (`/cauce/` recomendado).
2. Decidir autenticación y autorización por proyecto **en el servidor** (sección 7).
3. Copiar solo las carpetas de la sección 3 (sin `servir.py`, `docs/`, `pruebas/`, `*.bat`).
4. Redirigir `/cauce` → `/cauce/`; cabeceras: `nosniff`, `frame-ancestors` del portal, `no-store` en `datos/`.
5. Hacer que el puente escriba `datos/reales/<id>.json` y `datos/proyectos.local.json` en el servidor, con permisos
   de solo lectura para el servidor web.
6. Agregar el enlace (opción A); después, si se quiere, el iframe con `?incrustado=1` (opción B).
7. Correr `pruebas/navegador/fase-l-portal.cjs` contra el servidor real (cambiando `ORIGEN`) y revisar que nada se pida
   fuera de `/cauce/`.

## 9. Archivos de esta preparación

- `index.html`: corrección de `/` final y modo incrustado (script en línea de 6 líneas).
- `app/configuracion.js`: `rutaBase`, `necesitaBarraFinal`, `leerConfiguracion` (probados en Node).
- `servir.py`: `--base`, `frame-ancestors 'self'`, `Referrer-Policy`.
- `app/estilos.css`: `html.incrustado` (oculta marca y pie).
- Pruebas: `pruebas/casos-fase-l.js` (sección «portal») y `pruebas/navegador/fase-l-portal.cjs` (12 comprobaciones).
