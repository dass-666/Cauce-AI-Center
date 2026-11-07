# Fusión de la cadena #1 → #26 en `main`: procedimiento preparado (NO ejecutado)

Estado al 2026-11-07: **nada fusionado**, base del #26 sin cambiar, ningún PR cerrado. Este documento dice
qué operaciones exactas hay que autorizar, cómo comprobar antes y después, y cómo deshacer.

## 1. Hechos verificados (con `git`, en un clon recién traído)

| Dato | Valor |
|---|---|
| `main` | `6c92ef584b49df6bdca12bb286b433ab31837684`: un solo commit, «Inicio del repositorio», árbol prácticamente vacío |
| Cabeza del #26 (`claude/project-thread-fwbit2`) | `f254e791cecb01511a2b4d3908d5f58dd7f6c242` |
| Árbol de esa cabeza | `1a49e47ceb1548676535be1222422716cb488fea` |
| ¿`main` es ancestro de la cabeza? | Sí (`git merge-base --is-ancestor` → verdadero) |
| Commits nuevos para `main` | 76 (`git rev-list --count main..f254e79`) |
| Cambio total | 275 archivos, 129 404 líneas añadidas, 0 borradas |

Respecto de `65ff2c3` (el código validado en la MSI), `f254e79` solo cambia documentación:

- `20c127f` registra la regresión 29/29.
- `f254e79` sustituye el usuario de Windows por `<usuario>` en `docs/CIERRE.md` y `docs/TEZCATLIPOCA-REV3.md`.

Ningún archivo de `app/`, `pruebas/` ni `datos/` cambió.

**Cadena real.** El #1 apunta a `main` y cada PR apunta al anterior, hasta llegar al #26. Por ascendencia, la
cabeza del #26 contiene todos los commits del #1 al #25. El #15 (Ek Chuah) entró por la fusión que hizo el #17.
No hace falta fusionar uno por uno: fusionar el #26 contra `main` lleva todo.

## 2. Simulación hecha (sin tocar GitHub)

En una rama **local** `simulacion/fusion-26-main` (nunca subida):

```
git checkout -b simulacion/fusion-26-main origin/main
git merge --no-ff origin/claude/project-thread-fwbit2   # → e1171fa, padres 6c92ef5 y f254e79
git rev-parse HEAD^{tree}                               # → 1a49e47ceb1548676535be1222422716cb488fea (= árbol del #26)
node pruebas/ejecutar.mjs                               # → 395 pasaron, 0 fallaron
node pruebas/nexus-cli.mjs                              # → 17 pasaron, 0 fallaron
node pruebas/navegador/todas.cjs                        # → ver el informe de entrega (Chromium)
```

El árbol fusionado es **idéntico byte a byte** al de la cabeza del #26. Por eso, lo que se probó en el #26 es exactamente lo que
quedaría en `main`.

## 3. Problemas al cambiar la base del #26 a `main`

1. **El diff del PR se vuelve enorme**: 275 archivos y 76 commits. Revisarlo en la web ya no sirve; la revisión real es la de cada PR de la cadena.
2. **No usar «Squash and merge» ni «Rebase and merge».** Squash aplastaría 76 commits en uno y se perdería qué PR trajo qué. Rebase reescribiría los identificadores de los commits y dejaría de coincidir con lo validado. Usar **«Create a merge commit»**.
3. **El #26 está en borrador**: hay que marcarlo «Ready for review» antes de poder fusionarlo.
4. **Los PR #2–#25 quedan abiertos**. Sus bases no son `main`. GitHub suele marcar como fusionado un PR cuyos commits ya llegaron a su base, pero aquí sus bases son otras ramas que no cambian. *Inferencia sin verificar*: probablemente solo el #1 (base `main`) se marque solo como fusionado. Los demás los cierra Diego a mano después, con un comentario «incluido en `main` por la fusión del #26».
5. **El nombre de usuario de Windows sigue en el historial** (commits anteriores a `f254e79`). Para el repositorio público es un dato menor (no es una clave), pero borrarlo exigiría reescribir el historial. Eso **no** se recomienda: rompería los identificadores validados.
6. **El clon de la MSI va un commit atrás** (`20c127f`): después de fusionar, `git fetch` y `git checkout main`.
7. **No hay integración continua (CI)**: nada impide fusionar en rojo. La propuesta de CI está en el PR del Laboratorio, no en el #26.
8. **Ramas**: no borrar ninguna rama al fusionar (desmarcar «Delete branch»). Son el rastro de cada fase.

## 4. Procedimiento exacto (solo con autorización explícita de Diego)

**Antes (comprobaciones previas)**

```
git fetch origin
git rev-parse origin/main                                   # debe ser 6c92ef584b49df6bdca12bb286b433ab31837684
git rev-parse origin/claude/project-thread-fwbit2           # debe ser f254e791cecb01511a2b4d3908d5f58dd7f6c242
git rev-parse origin/claude/project-thread-fwbit2^{tree}    # debe ser 1a49e47ceb1548676535be1222422716cb488fea
git merge-base --is-ancestor origin/main origin/claude/project-thread-fwbit2 && echo OK
```

Si cualquiera de esos valores no coincide, **detenerse**: alguien cambió algo y hay que volver a simular.

**Operaciones** (en GitHub, en este orden):

1. PR #26 → «Edit» junto al título → base: `main` → confirmar.
2. PR #26 → «Ready for review».
3. PR #26 → menú del botón verde → **«Create a merge commit»** → confirmar. **No** marcar «Delete branch».

**Después (comprobaciones posteriores)**

```
git fetch origin
git log -1 --format='%P' origin/main          # dos padres: 6c92ef5… y f254e79…
git rev-parse origin/main^{tree}              # debe ser 1a49e47ceb1548676535be1222422716cb488fea
git checkout origin/main && node pruebas/ejecutar.mjs   # 395 pasaron, 0 fallaron
```

En la MSI: `git fetch`, `git checkout main` y `iniciar.bat`. Después, `pruebas.html` en Edge → 395/395.

## 5. Cómo deshacer

- **Preferido (no reescribe nada):** `git revert -m 1 <commit de fusión>` en una rama nueva, y fusionar ese revert por PR. `main` vuelve al árbol vacío y el historial queda completo.
- **Solo con autorización expresa:** `git push --force-with-lease=main:<commit de fusión> origin 6c92ef5:main`. Esto devuelve `main` a su único commit y **reescribe** `main`. Solo es razonable si nadie ha trabajado aún sobre la fusión.
- En ningún caso hay que tocar las ramas de los PR: siguen intactas y se puede repetir la fusión.

## 6. Qué queda en `main`

Exactamente el árbol `1a49e47c…`. Es decir, todo lo entregado del #1 al #26:

- oficina 3D y edificio
- centro de operaciones
- adaptadores Compago/Ek Chuah/Montambre (solo lectura)
- Nexus
- CSI fases 1–2
- caso BNS 2015 publicado
- documentos de cierre

**No** entra el Laboratorio de IA fase 1: está en un PR aparte que se basa en el #26.
