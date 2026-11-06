# Cauce Nexus · fase 1

Nexus es el **gerente que observa**: conserva lecciones con su evidencia, detecta errores de razonamiento, registra
recomendaciones y espera la decisión de una persona. **No** controla motores, no toma decisiones financieras ni de
apuestas, no ejecuta cambios en Compago, Ek Chuah ni Tezcatlipoca y no usa IA.

## Qué hay

| Pieza | Archivo | Notas |
|---|---|---|
| Contratos 0.2 (provisionales) | `contrato/NEXUS-CONTRATOS.md` | Separados de `cauce.estado-proyecto` 1.0.0, que no cambia. |
| Utilidades | `app/nexus/comun.js` | Fechas con zona, actores, detector de datos privados, huellas SHA-256. |
| Contrato de lección | `app/nexus/leccion.js` | Solo la forma. |
| Gerente escéptico | `app/nexus/gerente.js` | 12 reglas deterministas; cada una `cumple`/`no_cumple`/`no_evaluado` con explicación. |
| Recomendaciones | `app/nexus/recomendacion.js` | Máquina de etapas basada en eventos. |
| Registro | `app/nexus/registro.js` | Solo crece; cadena de huellas; consulta; resumen para la oficina. |
| Datos de prueba | `app/nexus/demo.js` → `datos/nexus/demo/` | Ficticios, `es_demo: true`, regenerables con `node herramientas/nexus-demo.mjs`. |
| Registro real | `datos/nexus/registro/` | Local, **fuera de git**. Vacío hasta que Diego registre la primera lección. |
| Línea de comandos | `herramientas/nexus.mjs` | `validar`, `lecciones`, `revisar`, `historial`, `agregar-leccion`, `agregar-evento`, `revision-gerente`. Necesita Node. |
| Oficina Nexus | `app/vistas/nexus.js` | Botón ✦ *Nexus* o tecla **N**. |

## Reglas del gerente

| Id | Regla | No cumple cuando… | No evaluado cuando… |
|---|---|---|---|
| G01 | Fechas con zona | alguna fecha no tiene zona | — |
| G02 | Privacidad | hay credenciales o datos personales | — |
| G03 | Conclusión con pruebas | declara más que hipótesis y solo hay afirmaciones | no declara nivel |
| G04 | Evidencia no duplicada | misma huella/referencia dos veces, o la misma que un antecedente que «apoya» | las pruebas no tienen huella ni referencia |
| G05 | Muestras independientes | dos pruebas con la misma muestra, solapada, derivada o mismo periodo y fuente; validación en destino con muestra del origen | 2+ pruebas sin describir su muestra |
| G06 | Sin información futura | datos u obtención posteriores a la conclusión; prueba que empieza antes de terminar el entrenamiento | no se sabe hasta cuándo usan datos |
| G07 | Sin circularidad | la lección se apoya en sí misma, directa o en cadena (incluye `leccion:<id>` en evidencias) | un antecedente no está en el registro |
| G08 | Sin autovalidación | el autor (persona o IA) valida su propia conclusión | — |
| G09 | Nivel sustentado | declara un nivel mayor del que sostienen las validaciones válidas | no declara nivel |
| G10 | Reproducibilidad | declara reproducible sin artefacto (referencia + huella + procedimiento) | no declara |
| G11 | Sin sobreajuste | resultado favorable medido solo en la misma muestra con la que se eligió | no se sabe cómo se evaluó |
| G12 | Vigencia | ya caducó | sin `caduca_en` |

Dictamen: cualquier `no_cumple` → **con objeciones**; si no, cualquier `no_evaluado` → **incompleto**; solo con 12/12
→ **sin objeciones**. El gerente nunca dice «aprobada». «Validada» en destino solo cuenta con una validación de otro
actor, en un proyecto destino, con muestra independiente. Una lección escrita por una IA necesita validación **humana**
para pasar de hipótesis (preparado para una IA supervisada futura; hoy no hay IA).

Ojo: «cumple» en G10 significa que hay un artefacto con huella; **Nexus no lo volvió a ejecutar**.

## Revisar la oficina Nexus (Windows)

1. `iniciar.bat` (o `py servir.py`) y abrir `http://127.0.0.1:8765/`.
2. Botón **✦ Nexus** o tecla **N** (Esc o N para cerrar). También `http://127.0.0.1:8765/?nexus=1`.
3. Debe verse la franja **DATOS DE PRUEBA**, 6 lecciones (2 sin objeciones, 1 incompleta, 3 con objeciones),
   2 recomendaciones esperando decisión (una bloqueada) y 1 aprobada «sin implementar».
4. «Revisar un borrador de lección»: pegar `contrato/ejemplos/nexus/leccion-plantilla.json` → dictamen y botón de descarga.
5. Mientras Nexus está abierto la 3D no dibuja (no gasta tarjeta gráfica). *Un cuarto*, la sala de control y el plano siguen igual.
6. `pruebas.html` debe decir «0 fallaron».

## Registrar una lección real

- **Con Node:** `node herramientas/nexus.mjs agregar-leccion mi-leccion.json` y luego `node herramientas/nexus.mjs revisar lec-…`.
- **Sin Node (el MSI hoy no lo tiene):** oficina Nexus → *Revisar un borrador* → *Descargar registro con esta lección* →
  guardar como `datos/nexus/registro/lecciones.json`. El archivo descargado ya incluye todo el historial anterior.
- Aprobar una recomendación = agregar un evento `aprobacion` firmado por una persona (por ahora solo con Node).
  A propósito no hay botón «Aprobar» en la pantalla: la fase 1 no tiene usuarios ni firmas, y un botón cualquiera
  podría pulsarlo cualquiera que abra la página.

## Límites conocidos (fase 1)

- Los contratos son **provisionales** (sin el documento v0.2).
- El autor de un registro (`por.id`) es texto libre: no hay autenticación. Cualquiera con acceso a los archivos puede
  escribir «humano: director». La garantía real de «aprobación humana» llegará con CauceService (usuarios y firmas).
- El detector de datos privados usa patrones: puede fallar ante formatos raros. No sustituye la revisión humana.
- Borrar la última entrada no rompe la cadena (sí lo detectaría git o un respaldo).
- No hay exportadores automáticos (prohibido en esta fase).
