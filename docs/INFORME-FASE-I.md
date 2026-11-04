# Fase I: centro de operaciones completo (prompt maestro)

Rama `fase-i/centro-completo`, encima de `fase-h/ek-chuah` (PR #17). No hay nada fusionado ni desplegado. Compago, Ek Chuah, Montambre y el contrato v1 no se modificaron.

## Auditoría inicial (hechos comprobados)
- **Versión más avanzada:** `fase-h/ek-chuah` (PR #17). Contiene las fases A–H y el PR #15. Los 17 PR siguen abiertos, apilados del #1 al #17. Ninguno está fusionado.
- **Repositorios que puedo leer:** Cauce, Compago, ek-chuah, MONTAMBRE, 3D (plugins de audio, sin relación), RUN (vacío) y dos de cursos. **No existen o no son accesibles:** Tezcatlipoca, CauceService, Repacar y Auxilio Auto. No puedo saber si Repacar y Auxilio Auto son el mismo proyecto.
- **Lo que ya funcionaba y no rehíce:**
  - Selector de proyectos, edificio 3D, cuarto individual, plano 2D, modo inmersivo y celular.
  - Los 6 estados, la caducidad, DEMO y REAL, y la naturaleza de cada puesto.
  - La aparición breve, las alertas, los cambios observados y la caída a 2D si falla WebGL.
  - 30 cambios de proyecto sin fugas y 50 departamentos en 2D.

## 1. ¿Qué partes del centro 3D ya están terminadas?
Están terminadas y con pruebas automatizadas que pasan:
- Selección de proyecto y edificio por piso, con vista de cuarto, enfoque, minimapa y plano 2D.
- Modo inmersivo y celular, en vertical y en horizontal.
- Paneles de detalle de departamento y de personaje.
- Alertas y cambios observados.
- DEMO, REAL, vencido, error y sin conexión.
- Animaciones por estado, aparición breve solo ante evidencia nueva, y recuperación ante fallas gráficas.

En tu Windows **solo está validada la fase G** (61 cps). La H y esta fase I no las has probado todavía.

## 2. Mejoras implementadas en esta fase
1. **Estado de cada proyecto en el selector.** Cada botón dice REAL, DEMO, Vencido, Error o Sin conexión sin necesidad de abrirlo. En celular se muestra un punto de color, y el texto queda disponible para lectores de pantalla. Los demás pisos se leen cada 30 s solo para esa insignia: no animan a nadie ni cuentan como cambio.
2. **Reintentar 3D.** Si la tarjeta gráfica falla, la página pasa al plano y ahora ofrece «Reintentar 3D». Al reintentar, la escena vuelve sin acumular geometrías ni texturas (156→156 y 18→18).
3. **Pisos preparados con su estructura.** Si `escena/<id>.json` trae el nombre de cada departamento, el piso sin datos muestra esos cuartos vacíos, marcados «Sin conexión» y con la nota del inventario. No tienen personajes, cifras ni alertas. Un archivo dañado nunca se tapa con la estructura. Es solo configuración: el motor 3D no cambió.
4. **Defecto corregido: «REAL» sin datos.** La insignia de la escena y el letrero de la recepción decían REAL en un proyecto sin archivo (por ejemplo, Tezcatlipoca). Ahora dicen «SIN DATOS».
5. **Defecto corregido: «1 error» sin archivo.** Cuando el archivo todavía no existía, se mostraba «El archivo tiene 1 error(es)». Ahora solo se ve el motivo («Sin conexión»).

## 3. ¿Qué proyectos están realmente conectados?
**Ninguno con datos reales todavía.** Compago y Ek Chuah tienen exportadores de solo lectura, pero en PR sin fusionar (Compago #9/#10, Ek Chuah #2). Además, solo se probaron con archivos sintéticos y nunca contra tus bases reales. Hoy los dos se ven en **DEMO**.

## 4. ¿Cuáles están preparados pero sin conexión?
| Proyecto | Qué hay en Cauce | Qué falta |
|---|---|---|
| Compago | Escena, naturalezas, DEMO y `conectar_compago.bat` | Fusionar su PR y exportar en tu PC |
| Ek Chuah | Escena, naturalezas, DEMO, `.bat` cada 15 min y la tarea documentada | Fusionar su PR #2 y la primera exportación real |
| Montambre | 4 cuartos vacíos según el inventario de su repo | Que exista algún proceso que observar (`docs/MONTAMBRE-REQUISITOS.md`) |
| Tezcatlipoca | Entrada en el registro | Acceso al repositorio (`docs/TEZCATLIPOCA-REQUISITOS.md`) |
| CauceService, Repacar / Auxilio Auto | Nada, a propósito | Saber dónde viven |

## 5. ¿Cuáles tienen procesos activos verificables?
**Ninguno verificado con datos reales.** Los candidatos que ya están clasificados por evidencia de su código son estos:
- **Compago:** el consumidor de importaciones (automático). Los demás puestos son reactivos, humanos o módulos.
- **Ek Chuah:**
  - Descargador, vigía y redactor: reactivos.
  - Tarea diaria: programado, «sin confirmar» mientras su log no tenga una corrida de las últimas 26 h.
  - Simulador y riesgo: módulos.
  - Auditor: humano.
- **Montambre:** ninguno. El worker y los agentes solo existen como README, y la moderación es humana.

## 6. ¿Qué animación se muestra para cada estado?
| Estado o situación | Qué se ve |
|---|---|
| Trabajando (con evidencia en curso) | Sentado tecleando, pantalla azul |
| Esperando | Sentado, mirando alrededor |
| Finalizado | Palomita. Solo celebra si se observó el cambio entre dos lecturas |
| Error | «!» rojo, de pie e inquieto; la etiqueta del departamento se pone en rojo |
| Requiere revisión | «?» ámbar, levanta la mano |
| Sin evidencia o datos vencidos | Silla vacía; si había alguien, sale |
| Programado sin corrida reciente | Oficina en espera, «Programado · sin confirmar» |
| Reactivo con registro nuevo y reciente | Entra unos 8 s y sale solo |
| Evento antiguo | Queda como historia en el detalle, sin animación |
| Humano o módulo | Nunca aparece como personaje trabajando |
| Proyecto solo con estructura | Cuartos vacíos, sin personajes |

**Procesos concurrentes y secuenciales.** El contrato representa cada puesto por separado: dos corridas simultáneas serían dos puestos con su propia evidencia. Ningún proyecto actual informa concurrencia, así que no agregué nada; cambiarlo exigiría tocar el contrato.

## 7. ¿Qué pruebas ejecuté y cuáles pasaron?
Todo en verde con el código final:
- Node: **214/214** (9 nuevas). `pruebas.html` en Chromium: 214/214.
- Chromium:
  - Regresión 47, animaciones 15, estabilidad 15, memoria 4, móvil 16, brillo 3 y naturaleza OK.
  - Compago PR #10 9/9, inmersivo 34, multiproyecto 6, auditoría visual 20.
  - Ek Chuah PR #2 19/19, Ek Chuah integración 16/16 y **fase I 19/19 (nueva)**.
- Sobrescritura del exportador de Ek Chuah: 10/10.

La suite completa encontró **una regresión mía** que corregí antes de entregar: el texto oculto de las insignias ensanchaba la página en celular con 23 proyectos, y fallaron móvil, regresión, integración y multiproyecto. Al volver a correr todo, todo pasó.

La prueba nueva cubre:
- Las insignias REAL, DEMO, Vencido y Error mientras se ve otro piso, sin animar a nadie.
- Tezcatlipoca con «SIN DATOS».
- Montambre en 3D, en 2D y en su detalle.
- La pérdida de contexto WebGL y «Reintentar 3D».
- 20 cambios entre los 4 pisos sin crecer geometrías, texturas ni nodos.
- Celular en vertical y en horizontal.

## 8. ¿Qué limitaciones de rendimiento quedan?
- **No tengo una GPU comparable a tu Intel UHD.** Todo lo de aquí es SwiftShader y solo sirve para comparar.
- Con 50 departamentos, la escena sube a 988–1424 llamadas de dibujo, contra 156 de Compago. En tu equipo podría bajar de 60 cps, pero **no está medido**. Hoy ningún proyecto real pasa de 8 departamentos, así que **no optimicé**, siguiendo tu regla. Si algún día un proyecto pasa de unos 20 cuartos, conviene medirlo en tu PC primero.
- Montambre dibuja 70 llamadas y no se cambió nada gráfico.

## 9. ¿Qué falta para considerar Cauce terminado?
1. Que lleguen datos reales: fusionar los exportadores de Compago y Ek Chuah y correrlos en tu PC.
2. Validar las fases H e I en tu Windows.
3. Fusionar la pila de 18 PR, en orden.
4. Tezcatlipoca, CauceService y Repacar: sin acceso no hay nada honesto que construir.
5. Opcional: muebles de Kenney (falta el ZIP) y medir escenas grandes en tu equipo.

## 10. ¿Qué tengo que hacer yo?
1. Decirme dónde están **Tezcatlipoca, CauceService y Repacar / Auxilio Auto**. Si están en GitHub, dale acceso a la app de Claude. Si son el mismo proyecto, dime cuál nombre usar.
2. Probar esta rama en Windows con la guía de abajo (5 min).
3. Decidir el orden de fusión: #1 … #14 → #16 → #17 → este PR, y cerrar el #15.
4. Cuando quieras datos reales: fusionar Ek Chuah PR #2 y seguir el paso 2 de `docs/INFORME-FASE-H.md` §7.

## Guía corta para Windows
1. En la carpeta de Cauce: `git fetch` y luego `git checkout fase-i/centro-completo`.
2. Doble clic en `iniciar.bat`. Arriba deben verse 4 botones: Compago **DEMO**, Ek Chuah **DEMO**, Tezcatlipoca **Sin conexión** y Montambre **Sin conexión**.
3. Entra a Montambre: 4 cuartos vacíos, sin personajes, sin «REAL» y con la nota de inventario. Entra a Tezcatlipoca: la escena dice «SIN DATOS».
4. Vuelve a Compago y Ek Chuah, en modo normal e inmersivo, con `?medir=1`. Deberían seguir en unos 60 cps, como en la fase G.
5. `probar.bat` debe decir **214 pasaron, 0 fallaron**.

## Rama, commit y PR
Rama `fase-i/centro-completo`, PR #18 (https://github.com/dass-666/Cauce-AI-Center/pull/18), encima del PR #17. Commits: `7348e58` (cambios) y uno más con este dato.
