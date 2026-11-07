# Tezcatlipoca: qué hace falta saber antes de integrarlo

**Estado verificado (2026-11-04):** no tengo acceso a ningún repositorio de Tezcatlipoca. En Cauce solo existe su entrada en `datos/proyectos.json`, sin demo ni distribución, y por eso se ve «Sin conexión» a propósito. No sé qué hace, en qué lenguaje está ni qué guarda. **No inventé arquitectura, oficinas ni agentes.**

## Qué ya está listo en Cauce (no hay que construir nada)
Para sumarlo basta con:
1. Un exportador de **solo lectura** del lado de Tezcatlipoca que escriba `datos/reales/tezcatlipoca.json` con el contrato v1 (`contrato/CONTRATO.md`).
2. `escena/tezcatlipoca.json`, con la distribución de oficinas.
3. `escena/tezcatlipoca-naturaleza.json`, con la clasificación por evidencia.
4. Un DEMO marcado como tal (`es_demo`, `fuente.tipo: "demo"`, `demo.ahora_simulado`).

El motor 3D, el plano, el selector, el modo inmersivo y la caducidad se reutilizan sin cambios. Ek Chuah y Compago siguieron exactamente este camino.

## Preguntas para su desarrollador (responder con evidencia: archivo, tabla o comando)
| Tema | Pregunta | Para qué lo usa Cauce |
|---|---|---|
| **Repositorio** | ¿Dónde vive? ¿Qué lenguaje y qué base de datos usa? ¿Cómo se corren sus pruebas? | Dar acceso de solo lectura y saber en qué escribir el exportador |
| **Procesos reales** | ¿Qué hace el sistema, paso a paso? ¿Qué comandos o servicios existen? | Definir las oficinas (máximo 50) |
| **Agentes implementados** | ¿Hay procesos que corran solos? ¿Cuáles usan IA y cuáles son reglas fijas? ¿Cuáles son decisiones humanas? | Clasificarlos como automático, reactivo, humano o módulo, sin inventar bots |
| **Ejecuciones programadas** | ¿Qué corre por horario (cron, tarea de Windows, app de Claude)? ¿Cómo se comprueba que está instalado? ¿Deja un registro de cada corrida? | Un «programado» solo se confirma con evidencia reciente, no por estar configurado |
| **Fuentes de evidencia** | ¿Qué tablas, logs o archivos registran inicio, fin y resultado de cada corrida? ¿Con qué hora (UTC o local)? | Llenar `evidencia` y decidir qué es «reciente» (la regla de Ek Chuah `hora_del_registro`) |
| **Estados** | ¿Cómo se distingue «trabajando», «terminó bien», «falló» y «atorado»? ¿Cuánto dura una corrida normal? | Mapear a los 6 estados del contrato y fijar el umbral de «atorado» |
| **Alertas** | ¿Qué avisos genera? ¿Con qué niveles? ¿Se guardan? | `alertas[]`; nunca crean personajes |
| **Resultados** | ¿Qué produce (informes, archivos, cifras)? ¿Cuáles se pueden mostrar sin datos privados? | `resultados[]`, solo nombres o conteos |
| **Privacidad** | ¿Maneja dinero, cuentas, datos personales, credenciales o webhooks? ¿Qué columnas y tablas no deben salir nunca? | Lista blanca de columnas en el exportador, igual que en Ek Chuah |
| **Frecuencia** | ¿Cada cuánto cambia algo que valga la pena ver? | Fijar la frecuencia de exportación y la vigencia (3 ciclos) |
| **Operaciones** | ¿Puede ejecutar acciones con efecto real (compras, envíos, operaciones)? | Si sí: el exportador nunca las llama; solo lee registros |

## Lo que Cauce NO hará sin esas respuestas
- Crear oficinas o personajes de Tezcatlipoca.
- Escribir un DEMO con actividad supuesta.
- Asumir que algún proceso es autónomo o que corre por horario.

## Siguiente paso recomendado
Que Diego indique dónde está el repositorio de Tezcatlipoca y dé acceso de solo lectura. Con eso puedo hacer el inventario, como en la fase E (Compago) o la F (Ek Chuah), antes de proponer oficinas.
