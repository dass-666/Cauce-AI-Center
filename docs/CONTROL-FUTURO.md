# Control de procesos desde Cauce: diseño para después (fase K10)

**Estado: solo diseño. Nada de esto está implementado.** Cauce sigue siendo un consumidor de solo lectura: no hay
endpoints, credenciales, comandos remotos ni botones que actúen sobre un sistema. Los botones de la sala de control
solo llevan a un piso o a un departamento.

## 1. Por qué no se hace todavía

| Falta | Por qué importa |
|---|---|
| Ningún sistema expone acciones autorizadas | Compago, Ek Chuah y Montambre no tienen una API de acciones; inventarla desde Cauce sería tocar sus repositorios (fuera de alcance). |
| No hay identidad de usuario en Cauce | Hoy cualquiera con acceso a `127.0.0.1:8765` ve todo. Para *actuar* hace falta saber quién es y qué puede hacer. |
| El puente de Compago (Ronny) todavía es un piloto local aislado | Primero debe funcionar la lectura REAL estable; una acción sobre datos DEMO o mezclados sería peligrosa. |
| CauceService (la plataforma destino) no está localizado | El control debería vivir en CauceService, no en un visor local. |

## 2. Arquitectura propuesta (cuando se autorice)

```
Navegador (Cauce)                Servicio de acciones (nuevo, en CauceService)        Sistema (Compago, Ek Chuah…)
  vista / sala  ──lectura──►  datos/reales/*.json  (sin cambios: contrato v1)
  panel «Acciones» ──solicitud firmada──► API de acciones ──► cola ──► ejecutor propio del sistema
                       ◄──estado de la solicitud (pendiente/aprobada/rechazada/hecha)──┘
```

Principios:

1. **Separación total entre ver y actuar.** El visor no cambia: sigue leyendo el JSON. Las acciones viajan por otro
   canal, con otro proceso y otras credenciales. Si el servicio de acciones no existe o no responde, el visor
   funciona igual (y no muestra ningún botón de acción).
2. **El sistema ejecuta, no Cauce.** Cauce solo *pide*. Cada sistema decide qué acciones acepta y las ejecuta con su
   propio código (por ejemplo, un comando de Django en Compago). Cauce nunca abre bases de datos ni corre comandos.
3. **Catálogo cerrado de acciones**, declarado por cada sistema (no por Cauce): `iniciar_importacion`,
   `pausar_consumidor`, `reintentar_lote`, `aprobar_oportunidad`, `solicitar_analisis`… Cada una con: quién puede
   pedirla, si requiere segunda aprobación, si es reversible y su tiempo máximo.
4. **El resultado se ve por la vía de lectura.** Una acción «hecha» solo se considera hecha cuando el siguiente
   archivo de estado lo refleja (evidencia), no cuando la API responde 200.

## 3. Requisitos de seguridad

| Tema | Requisito mínimo |
|---|---|
| Autenticación | Usuario y sesión en CauceService (no en el visor local). Nada de llaves en el navegador ni en `datos/`. |
| Autorización | Permisos por proyecto y por acción (p. ej. Ronny: Compago/importaciones; Diego: todo). Por omisión, nadie puede nada. |
| DEMO/REAL | Las acciones **nunca** se ofrecen sobre un piso en DEMO, vencido, inválido o sin conexión. |
| Confirmación | Pantalla de confirmación con el resumen exacto (sistema, acción, objeto, quién) y escribir el nombre de la acción en las irreversibles. |
| Doble envío | Cada solicitud lleva un identificador único (idempotencia); el servicio rechaza duplicados y el botón queda deshabilitado mientras la solicitud está pendiente. |
| Auditoría | Registro inmutable: quién, qué, cuándo, desde dónde, resultado. Visible en el panel del departamento. |
| Límites | Tope de solicitudes por minuto y por usuario; acciones costosas solo en horario permitido. |
| Red | El servicio de acciones no se expone a internet sin autenticación fuerte; en piloto, solo `127.0.0.1` o VPN. |

## 4. Cómo se vería en la interfaz (cuando exista)

- El panel del departamento tendría una sección **Acciones disponibles**, que solo aparece si el servicio de acciones
  respondió que existen y que este usuario puede usarlas. Hoy esa sección **no existe** (no se muestran botones
  deshabilitados que parezcan funcionales).
- Cada acción pedida aparece en el historial del departamento como «Solicitada por X», luego «Aceptada por el
  sistema» y, solo con evidencia en el archivo de estado, «Hecha».
- Un personaje no empieza a «trabajar» por una solicitud: sigue mostrando solo lo que el archivo respalda.

## 5. Orden sugerido (cada paso requiere autorización de Diego)

1. Lectura REAL estable de Compago (puente de Ronny) durante al menos una semana.
2. Localizar CauceService y decidir dónde vive el servicio de acciones.
3. Diseñar con el dueño de cada sistema su catálogo de acciones (empezar por una reversible y de bajo riesgo,
   p. ej. «solicitar un nuevo análisis»).
4. Autenticación y auditoría antes de la primera acción.
5. Piloto local aislado con datos de prueba; luego producción.
