# Laboratorio de IA · fase 3: respuestas auténticas de un modelo por intercambio manual

Rama `claude/laboratorio-fase-3`, encadenada sobre la de la fase 2 (`claude/project-thread-g7h0tv`, PR #30). No toca
el PR #29 (ascensor), `app/vistas/vista3d/` ni ningún motor. No hay API, ni modelo instalado, ni credenciales.

## 1. Auditoría inicial (estado real verificado al empezar)

- PR #30 abierto en borrador, cabeza `867afbc`, base la rama de #28; cadena `main ← #27 ← #28 ← #30`. `main` = `e1891b5`.
- 458 pruebas Node pasaban; vista del Laboratorio 33/33 en Chromium.
- **Lo que fallaba para usar IA real** (verificado leyendo el código y probándolo):
  1. El adaptador manual solo se ofrecía para trabajos REALES, y `datos/reales/` está vacío: en la práctica **no se
     podía usar**.
  2. Pedía pegar un `cauce.lab.ejecucion` completo (ids, huella del encargo, tiempos, autor): imposible de escribir a
     mano y sin ninguna solicitud preparada para el modelo (solo «descargar el encargo» en JSON).
  3. El cuadro para pegar estaba escondido en la pestaña «Auditoría».
  4. **Defecto**: «Reintentar» o «Volver a analizar» en un trabajo manual corría el guion DEMO y fallaba
     («El trabajo pide el adaptador manual-claude…»).
  5. Sin procedencia: ni quién trajo la respuesta, ni qué modelo, ni la huella de lo pegado.
  6. Todo vivía en memoria: recargar la página perdía el trabajo.
  7. El contrato 0.1 obligaba a `autor.tipo = "ia"` también para el guion DEMO.

## 2. Qué se construyó

| Pieza | Archivo |
|---|---|
| Contrato 0.2 de autoría (guion DEMO / IA manual / IA automática / código / persona) | `app/laboratorio/base.js`, `contratos.js` |
| Papel, tareas y reglas de cada rol | `app/laboratorio/roles.js` |
| Solicitud por rol, análisis e importación de la respuesta, continuar el flujo | `app/laboratorio/manual.js` |
| Guardar, exportar y reanudar un expediente (con comprobación de huellas) | `app/laboratorio/expediente.js` |
| Identidad de revisión: declarada, con interfaz para autenticación futura | `app/laboratorio/identidad.js` |
| Naturaleza y fase de un trabajo para la oficina | `app/laboratorio/presentacion.js` |
| Adaptador para proveedores automáticos (apagado) y transporte de PRUEBA | `app/laboratorio/proveedores.js` |
| lab-V: inyección de instrucciones, inferencias sin base, referencias inexistentes, rol fuera de función | `app/laboratorio/verificador.js` |
| Informe 0.2 (autoría por rol, preguntas, limitaciones y recomendaciones de los roles, lectura vencida) | `app/laboratorio/informe.js` |
| Vista: consulta nueva, panel «Te toca», copiar, pegar o importar archivo, reanudar, exportar, estados | `app/vistas/laboratorio.js`, `app/laboratorio.css` |
| Contratos documentados | `contrato/LABORATORIO-CONTRATOS.md` (sección «Fase 3») |

### Flujo para la persona

```
Consulta nueva (motor + pregunta)  →  «Te toca: Investigador»  →  Copiar solicitud  →  conversación de Claude
  →  pegar respuesta  →  validación (formato, encargo, huella, repetición, contrato)  →  lab-V  →  «Te toca: Analista»
  →  …  →  «Te toca: Abogado del Diablo»  →  informe  →  Pendiente de aprobación | Evidencia insuficiente
  →  una persona decide (nombre + motivo; identidad declarada)
```

Un intento rechazado **no cambia el trabajo**: se anota en «Importaciones» y se dice por qué.

## 3. Contratos

Ver `contrato/LABORATORIO-CONTRATOS.md` § Fase 3. Resumen: `cauce.lab.ejecucion` 0.2 (autoría real, procedencia,
intercambio, preguntas, limitaciones, recomendaciones justificadas), `cauce.lab.informe` 0.2 (autoría por rol). Los 0.1
se siguen leyendo sin reescribirlos (sus huellas están citadas). Nuevos formatos: `cauce.lab.respuesta-manual` 0.1 y
`cauce.lab.expediente-local` 0.1. Encargo y verificación siguen en 0.1.

## 4. Qué es IA real y qué sigue siendo DEMO

| Función | Hoy |
|---|---|
| Contenido de Investigador / Analista / Abogado del Diablo en una **consulta nueva** | **IA real**, si la persona pega la respuesta de un modelo. Procedencia **declarada**, no verificable. |
| Los 4 trabajos de partida y «▶ Correr un trabajo DEMO» | **Guion DEMO** (no es IA), marcado `guion_demo`. |
| Datos de los motores | **DEMO** (no hay exportaciones reales en `datos/reales/`). |
| Proveedores automáticos | **No conectados.** Solo el transporte de PRUEBA (marcado `guion_demo`) en las pruebas. |
| lab-V, Coordinador, contratos, informe | Código determinista. |
| Respaldo semántico, aprobación | Una persona. |

**Nadie probó todavía con Claude de verdad**: yo no tengo acceso a tu app de Claude y no invento respuestas. Las
pruebas usan respuestas fijas escritas a mano, dichas como tales. La prueba real es el paso 3 de
`docs/VALIDAR-LABORATORIO-FASE-3.md`.

## 5. Verificación: qué automatiza el código y qué no

| Lo comprueba el código (sin ambigüedad) | Lo decide una persona |
|---|---|
| Forma, versión, campos desconocidos, tamaño, JSON truncado | Si una cita realmente APOYA la afirmación |
| Que la respuesta sea de ESTE encargo (id + huella) y de este rol | Si una inferencia es razonable |
| Respuesta repetida o reutilizada de otro trabajo | Si una contradicción es real |
| Fuente inexistente, extracto no literal, copia alterada, fecha fuera de corte | Si una objeción tiene razón |
| Inferencia sin cita ni base; referencia a algo que el rol anterior no dijo | Si la conclusión responde la pregunta |
| Lectura vencida (foto vieja presentada como actual) | Si aprobar, rechazar o pedir evidencia |
| Comandos y frases de inyección («ignora…», «aprueba…»): se marcan y no se obedecen | Si una frase nueva de inyección se escapó |
| Recomendaciones de dinero: se excluyen; sin base: se rechazan | — |
| Ninguna IA, código ni respuesta pueden aprobar | — |

El detector de inyección busca frases típicas: una formulación nueva puede pasar sin marca. Lo que lo hace seguro no
es el detector, sino que **ningún texto de una IA puede cambiar un estado** (lo prueban los casos de autoaprobación).

## 6. Autorización humana

`app/laboratorio/identidad.js`: decisión pendiente / aprobada / rechazada, siempre con «identidad declarada» y la
advertencia visible. No existe proveedor de identidad: `proveedorIdentidad()` devuelve «ninguno» y `autenticar()`
responde que no hay. Un «autenticada» escrito a mano en los datos se rechaza. Cuando haya identidad real (p. ej. la de
CauceService), se conecta ahí y el contrato del trabajo sube de versión para guardar la prueba.

## 7. Conexiones con motores (solo lectura)

| Motor | Estado |
|---|---|
| Compago, Ek Chuah, CSI | Lectura de solo lectura de su documento `cauce.estado-proyecto` (DEMO en el repo). Consulta manual disponible para los tres. |
| Nexus | Solo propuestas tras aprobación humana; nunca se escribe en su almacén. |
| Tezcatlipoca | Sin contrato accesible: no conectado. |

**Bloqueo exacto de lo REAL:** `datos/reales/` está vacío en este contenedor. En la MSI no lo pude mirar: las
carpetas `C:\Users\MSIGF\Cauce-AI-Center` y `EK_CHUAH` están aprobadas para el proyecto pero **no conectadas a esta
sesión**, y no pedí acceso para no interrumpirte. Si existe `datos/reales/<motor>.json` con `es_demo: false`, la
consulta nueva lo ofrece como «lectura REAL» y todo el flujo funciona igual (probado con un documento REAL de prueba).
La integración real sigue dependiendo de que los motores exporten (Compago: arreglo de `--entorno demo`; Ronny: puente).

## 8. Proveedores automáticos (preparado, apagado)

`crearAdaptadorAutomatico(config, {transporte, credencial_presente})`: proveedor explícito, `habilitado: false` por
defecto, límites de tiempo y de tamaño (solicitud y respuesta), cancelación, desactivación (interruptor), errores de
conexión, costo estimado con presupuesto (los de pago quedan bloqueados con $0 y se dice que una suscripción de chat no
da créditos de API), sin credenciales (ni las lee ni las guarda; una `api_key` en la configuración se rechaza), y sin
transporte no hace ninguna llamada. El transporte de PRUEBA solo trabaja con DEMO y su salida se marca `guion_demo`.

## 9. Rendimiento

Ver `docs/LABORATORIO-FASE-3-PRUEBAS.md`. El Laboratorio sigue cargándose solo al abrirlo y la 3D se pausa mientras
está abierto. Validar e importar una respuesta de 128 000 caracteres (400 afirmaciones) y verificarla con lab-V tarda
~70 ms en el contenedor; no hizo falta un hilo aparte. **No medido en la Intel UHD.**

## 10. Decisiones pendientes (tuyas)

1. Probar con Claude de verdad (guía de 10–15 min) y decidir si el formato de respuesta le resulta cómodo al modelo.
2. Fusiones: #27 → #28 → #30 → este PR, en ese orden (nada fusionado).
3. ¿Conectar la carpeta de la MSI a una sesión para buscar exportaciones REALES de Compago/Ek Chuah?
4. Proveedor automático: Ollama local ($0, requiere instalarlo y tu autorización) o seguir manual.
5. Identidad autenticada: depende de CauceService.
