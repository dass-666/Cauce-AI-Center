# Validar la fase C3 (animaciones por estado) en Windows 11

Rama `fase-3d/animaciones` (sale de C2, `fase-3d/interfaz-movil`).

## Regla principal

Un gesto de transición (entrar caminando, celebrar, reaccionar a un error, levantar la mano) **solo se ve cuando la
página observó el cambio entre dos lecturas** del archivo. Al abrir la página, al cambiar de modo o de proyecto, o al
volver de 2D, cada personaje aparece **ya en su postura**, sin caminar ni hacer gestos. Antes de C3 un personaje
"finalizado" celebraba y todos entraban caminando al abrir la página: eso representaba eventos que nadie observó.

## Posturas por estado (en bucle, discretas, no simulan tareas ni resultados)

| Estado | Postura | Gesto ocasional (cada 7–13 s, propio de cada personaje) |
|---|---|---|
| Trabajando | Sentado, manos en el teclado | Levanta la vista a la pantalla |
| Esperando | Sentado, recargado, respira y mira alrededor despacio | — |
| Finalizado | Sentado, relajado (recargado, brazos sueltos) | — |
| Error | De pie junto al escritorio, mano en la cabeza, mira la pantalla | Niega despacio con la cabeza |
| Requiere revisión | Sentado | Levanta un poco la mano y la baja |
| Sin evidencia | Silla vacía | — |

## Gestos de transición (solo con cambio observado)

| Cambio observado | Qué hace |
|---|---|
| → Finalizado | Se levanta, celebra (clip `emote-yes` de Kenney), se vuelve a sentar |
| → Error | Se levanta y niega con la cabeza (clip `emote-no`); queda de pie |
| → Requiere revisión | Levanta la mano y saluda un momento |
| Sin evidencia → con evidencia | Entra caminando y se sienta (sin celebrar lo que pasó mientras no estaba) |
| Con evidencia → sin evidencia | Se levanta y sale |

Ritmo (0.85–1.15×), fase y periodo salen del id del personaje: siempre iguales para el mismo personaje y distintos
entre personajes; nunca se mueven todos a la vez (hay prueba).

## Revisar

1. `git switch fase-3d/animaciones` · `git pull` · `iniciar.bat` → `pruebas.html`: `101 pasaron, 0 fallaron`.
2. Abre <http://127.0.0.1:8765/>: nadie entra caminando ni celebra; todos están en su lugar.
3. Para ver un gesto hace falta un **cambio real entre dos lecturas** (por ejemplo, que Compago cambie el estado de un
   agente y `exportar_cauce` vuelva a escribir el archivo). No hay forma de "forzarlo" desde la página, a propósito.
   La prueba automática lo simula en memoria: `node pruebas/navegador/animaciones.cjs` (requiere Playwright).

## Rendimiento

No se agregan mallas ni materiales: 185 llamadas de dibujo en renderizado por software (igual que C1/C2). El cálculo extra por personaje es un seno por
cuadro. Se agregó el clip `emote-yes` al mezclador (un clip más con peso 0 la mayor parte del tiempo). No medido en tu
Intel UHD.
