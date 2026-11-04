# Puente Compago (Docker local) → JSON → Cauce: lo que Cauce espera

**Para Ronny.** Esta guía no construye el puente: ese trabajo es tuyo. Solo fija la interfaz que Cauce ya lee, para que no haya que adivinar ni duplicar nada. Se basa en lo verificado el 2026-11-04 en:
- Compago `main`: `despliegue/compose.*.yml` y `LEEME.md`.
- El exportador `exportar_cauce`, que está en **Compago PR #9/#10 (`8c207ce`) y todavía no en `main`**.
- Cauce `contrato/CONTRATO.md` v1.

El contrato v1 no cambia.

## 1. La interfaz completa es un solo archivo
| Qué | Valor |
|---|---|
| Archivo | `<carpeta de Cauce>/datos/reales/compago.json` (la página lo lee cada 30 s; está fuera de git) |
| Formato | `cauce.estado-proyecto` 1.0.0, el que ya produce `exportar_cauce` |
| Quién lo escribe | El puente, con `python manage.py exportar_cauce --salida <ruta> --cada 60 --vigencia 900 [--entorno demo]` |
| Escritura | Temporal + `os.replace`, como ya hace `escribir_atomico` del exportador. Cauce además relee una vez si encuentra el archivo cortado |
| Red | Ninguna. Cauce **no** se conecta a Docker, a la base ni a la API: solo lee el archivo |

## 2. Recomendaciones para el piloto local aislado
1. **Monta solo `datos/reales/`** de Cauce en el contenedor que exporta, no el repositorio entero. Así el puente nunca puede tocar `datos/demo/`, porque si se sobrescribe `datos/demo/compago.json` fallan las pruebas de Cauce.
2. **Permisos.** El motor corre como uid 10001 con el sistema de archivos de solo lectura. El punto de montaje tiene que permitirle escribir `compago.json` y `compago.json.tmp`, que van en la misma carpeta para que el `replace` sea atómico.
3. **Datos sintéticos, entonces `--entorno demo`.** El compose demo carga datos ficticios (`cargar_demo`). Con `--entorno demo` el documento sale marcado como DEMO y Cauce muestra la franja DEMO. Con `--entorno reales` se leerían solo registros `is_demo=False`, y en un piloto sintético eso no dice nada útil.
4. **Vigencia de 900 s con `--cada 60`.** Si el puente se detiene, a los 15 min Cauce muestra «Datos desactualizados» y el selector dice «Vencido». Desde la fase J, esto también vale para una DEMO escrita en `datos/reales/`; las demos fijas de `datos/demo/` no caducan.
5. **Reloj.** Cauce tolera que el contenedor vaya hasta 5 min adelantado. Más que eso se ve como «hora en el futuro», que puede pasar con WSL2 después de suspender la PC. Si ocurre, reinicia WSL o sincroniza la hora.
6. **`--url-compago`.** Es opcional. Si se usa, que sea `http://127.0.0.1:8000`: Cauce solo muestra enlaces http(s) o relativos.
7. **Privacidad.** El exportador ya excluye nombres de proveedores y productos, archivos, costos, usuarios, IP y textos de error (docstring de `apps/core/cauce.py`). Si el puente agrega campos, Cauce los ignora, pero no deberían salir del contenedor.

## 3. Cómo comprobar el archivo (sin abrir la página)
```
node herramientas/validar-estado.mjs datos/reales/compago.json --proyecto=compago
```
- Código 0: Cauce lo mostrará en línea.
- Código 1: Cauce no mostrará actividad, y el comando dice por qué.

## 4. Qué verá Diego en cada caso (probado en `pruebas/navegador/fase-j.cjs` y `compago-pr10.cjs`)
| Situación del puente | En Cauce |
|---|---|
| Todavía no escribió nada | DEMO del repositorio (`datos/demo/compago.json`) |
| Exportó una DEMO del piloto | Insignia DEMO, franja DEMO y «En línea» |
| Exportó datos reales | Insignia REAL y «En línea»; selector en REAL |
| Se detuvo más de 15 min | «Datos desactualizados»; los personajes salen; selector en «Vencido» |
| Escribió un archivo a medias | Se relee y no se ve ningún error |
| Archivo dañado de verdad | «Archivo inválido»; selector en «Error». La DEMO del repositorio no lo tapa |
| Reloj del contenedor más de 5 min adelantado | «Hora en el futuro»; no se muestra como vigente |

## 5. Lo que Cauce no necesita del puente
- Puertos publicados, credenciales, la API de UNIQ ni acceso a PostgreSQL.
- Cambios en el contrato.
- Que Cauce corra dentro de Docker. Sigue siendo `iniciar.bat` (servidor local en 127.0.0.1).
