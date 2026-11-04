# Fase H: integración de Ek Chuah y preparación multiproyecto

Rama `fase-h/ek-chuah`, encima del PR #16 (fase G visual). No hay nada fusionado ni desplegado. Ek Chuah, Compago y el contrato v1 no se modificaron.

## 1. Resumen técnico
- **No dupliqué trabajo.** Otro hilo ya había hecho la integración de Ek Chuah en el **PR #15** (`fase-g/integracion-ek-chuah`, sobre el #14), en paralelo a mi fase G (#16). Esta rama **une los dos** con un commit de merge, sin reescribir historia.
  - Único conflicto: los dos PR crearon `docs/VALIDAR-FASE-G.md`. Se conserva la guía visual del #16, y la del #15 pasa a `docs/EK-CHUAH-INTEGRACION.md`.
- **Revisé el trabajo del #15 en lugar de rehacerlo.** Encontré un defecto en una de sus pruebas (sección 5) y completé lo que la fase H pedía y el #15 no tenía:
  - Una frecuencia de 15 minutos.
  - La tarea programada recomendada, documentada pero sin instalar.
  - Aislamiento con Compago.
  - Modo inmersivo y celular con Ek Chuah REAL.
  - El inventario de requisitos de Tezcatlipoca.
- El motor visual **no se duplicó ni se tocó**. Ek Chuah usa el mismo motor que Compago y solo aporta archivos de configuración: `escena/ek-chuah.json` y `escena/ek-chuah-naturaleza.json`.

## 2. Compatibilidad con Ek Chuah PR #2 (`a23e06c`, leído sin modificarlo)
- Los 8 documentos del exportador (4 DEMO y 4 REAL) son válidos con el contrato v1, cargan las 6 oficinas y no muestran a nadie al abrir. Lo comprueba `ek-chuah-pr2.cjs`.
- El exportador ya admite `--vigencia` entre 30 y 604 800 s. **Para la frecuencia de 15 min no hace falta cambiar Ek Chuah.**
- En Ek Chuah queda un detalle sin corregir: `observado_en` lleva la hora de exportación y no la del registro. Cauce ya no depende de ese dato (usa `hora_del_registro: "actividad"`, del #15). Conviene pedírselo a Claude de Ek Chuah, aunque no bloquea nada.

## 3. Clasificación de las seis oficinas
| Oficina | Puesto | Naturaleza | Personaje |
|---|---|---|---|
| Obtención de datos | descargador | Reactivo | Solo unos segundos si llega una corrida nueva y reciente de `fetch_log` |
| Supervisión y alertas | vigia | Reactivo | Igual, con `alerts_sent` |
| Supervisión y alertas | **tarea-diaria** | **Programado** | Solo se confirma si el log registra una ejecución en las últimas 26 h. Si no, aparece como «Programado · sin confirmar» |
| Informes | redactor | Reactivo | Igual, con el archivo de análisis |
| Simulaciones | simulador | Módulo | Nunca (no registra ejecuciones) |
| Análisis de riesgo | evaluador-riesgo | Módulo | Nunca |
| Auditoría y verificación | auditor | Humano | Nunca (la decisión es de una persona) |

No hay ningún proceso automático ni personajes de relleno. Los errores se ven en rojo: Obtención de datos y Supervisión salen así en el escenario de fallas.

## 4. Resultados de las pruebas (código final)
Todo en verde con el código final, sin ninguna falla:
- Node: **205/205**. `pruebas.html` en Chromium: 205/205.
- Chromium: regresión 47, animaciones 15, estabilidad 15 (DEMO/REAL, caducidad, reconexión), memoria 4, móvil 16, brillo 3, naturaleza OK, Compago PR #10 9/9, inmersivo 34, multiproyecto 6, auditoría visual 20, **Ek Chuah PR #2 19/19** y **Ek Chuah integración 16/16 (nueva)**.
- Escritura del exportador real sobre una copia de `datos/`, sin base de datos: 10/10. Los DEMO no se sobrescriben.
- Rendimiento (SwiftShader, solo para comparar): Compago sigue en 156 llamadas y 18 texturas, igual que antes. Ek Chuah dibuja 121 llamadas. No se cambió nada gráfico.
- Privacidad: en los documentos de Ek Chuah, las escenas y todo el texto visible (incluidos los paneles en modo normal, inmersivo y en celular) no aparecen montos, enlaces, tokens, webhooks, credenciales, `journal`, rutas ni correos.

Los 10 escenarios que pediste:

| # | Escenario | Dónde se prueba |
|---|---|---|
| 1 | Día normal | `ek-chuah-pr2` (DEMO y REAL) |
| 2 | Fallas | `ek-chuah-pr2` y `ek-chuah-integracion` (errores en rojo y alerta crítica) |
| 3 | Sin base | `ek-chuah-pr2` |
| 4 | Sin evidencia | `ek-chuah-pr2` («sin confirmar») |
| 5 | DEMO | `ek-chuah-pr2` (franja DEMO) |
| 6 | REAL | `ek-chuah-pr2` y `ek-chuah-integracion` |
| 7 | Datos antiguos | Archivo vencido de 27 h, un registro de hace 3 días que no anima a nadie, y vigencia de 2700 s: en línea a los 30 min y desactualizado a los 50 min |
| 8 | Cambio entre Compago y Ek Chuah | `ek-chuah-integracion` (ida y vuelta) |
| 9 | Eventos reactivos recientes | `ek-chuah-pr2`: la tarea diaria entra unos 8 s y sale sola, sin que nadie más se mueva |
| 10 | Aislamiento | `ek-chuah-integracion`: Compago conserva su DEMO y sus 3 alertas, sin textos de Ek Chuah, y viceversa; los cambios observados vuelven a cero |

## 5. Problemas encontrados y corregidos
1. **Prueba frágil en el PR #15** (`ek-chuah-pr2.cjs`). Esperaba 11 s fijos a que la tarea diaria saliera. Con la GPU por software, la salida termina a los 13 s, así que fallaban 3 comprobaciones encadenadas. Se reproduce igual en la rama del #15 sola, sin mi unión.
   - Lo diagnostiqué segundo a segundo: entra, se sienta, se queda unos 8 s, camina unos 5 s y desaparece. **La app se comporta bien.**
   - Corrección: la prueba ahora espera hasta 20 s. Si el personaje nunca sale, sigue fallando.
2. **Conflicto de documentos entre el #15 y el #16**: resuelto como se describe en la sección 1.

No encontré defectos nuevos en la app.

## 6. Configuración preparada para datos reales
- `conectar_ek_chuah.bat` ahora exporta **cada 15 min** por omisión, con **vigencia de 2700 s** (3 ciclos). Solo corre mientras la ventana está abierta, no instala nada y no escribe en `datos/demo/`. Esto último lo comprueba `ek-chuah-sobrescritura.py`.
- `docs/TAREA-EK-CHUAH.md` documenta la tarea recomendada `Cauce-EkChuah-Exportar` (`schtasks`, cada 15 min). **No está instalada.**
- Por qué 2700 s y no 900 (el valor que sugiere Ek Chuah): con 900, una sola exportación atrasada ya marca los datos como vencidos. Con 2700 se toleran dos exportaciones perdidas. A cambio, un dato puede verse «en línea» hasta 45 min, aunque siempre con «Dato de hace N min» a la vista.

## 7. Guía mínima de activación futura en Windows
1. Fusiona primero el PR #2 de Ek Chuah. Luego, en Cauce, `git checkout fase-h/ek-chuah`.
2. Edita `EKCHUAH_DIR` en `conectar_ek_chuah.bat`, pon `CADA=0` y ejecútalo **una vez**. Abre `datos\reales\ek-chuah.json` y revisa que no traiga montos, rutas ni nombres.
3. En Cauce pulsa Actualizar. El piso debe decir REAL y verse sin personajes. La tarea diaria puede decir «sin confirmar», y eso es correcto si la tarea de Windows no está instalada.
4. Si todo está bien, elige entre dejar el `.bat` con `CADA=900` y la ventana abierta, o instalar la tarea de `docs/TAREA-EK-CHUAH.md`.

## 8. Requisitos para Tezcatlipoca
Están en `docs/TEZCATLIPOCA-REQUISITOS.md`. No tengo acceso a su repositorio, así que **no inventé oficinas, procesos ni agentes**. El documento tiene 11 preguntas para su desarrollador: repositorio, procesos, agentes, tareas programadas, evidencia, estados, alertas, resultados, privacidad, frecuencia y operaciones con efecto real. También explica lo que Cauce ya tiene listo: basta con un exportador de solo lectura y dos archivos de escena.

## 9. Riesgos pendientes
1. **Datos reales sin probar.** Todos los documentos de Ek Chuah son sintéticos y falta correr el exportador contra tu base real (paso 2 de la guía).
2. **Tarea `EkChuah-Alertas` sin verificar.** Mientras no se confirme, «Programado · sin confirmar» es la respuesta honesta.
3. **Pila de 16 PRs sin fusionar.** El #15 y el #16 son ramas hermanas, y esta rama contiene a las dos. Al fusionar, el orden recomendado es #14 → #16 → esta rama, y luego cerrar el #15 porque queda incluido.
4. **Rendimiento con Ek Chuah en tu Intel UHD sin medir.** Con GPU por software dibuja menos que Compago (121 llamadas contra 156). Compago ya te dio 61 cps.
5. Las horas del log de la tarea diaria son locales y sin zona horaria. Se interpretan con la zona de tu PC (documentado en Ek Chuah).

## 10. PR y commit final
PR #17 (https://github.com/dass-666/Cauce-AI-Center/pull/17), rama `fase-h/ek-chuah`, encima del #16. Sin fusionar.
Commits: `e47d9c6` (unión del #15) y `6595d9b` (cambios de la fase H). Este informe se agrega en un commit más, que es el último del PR.
