# Laboratorio de IA · fase 3: pruebas y mediciones

Entorno: contenedor Linux en la nube, Node 22 y Chromium de Playwright con **SwiftShader** (la CPU dibuja en lugar de la
tarjeta gráfica). **Nada de esto se midió en la Intel UHD de la MSI.**

## 1. Resultados

| Conjunto | Resultado |
|---|---|
| Node (`node pruebas/ejecutar.mjs`) | **482 pasaron, 0 fallaron** (458 de antes + 24 nuevas «Lab 3 · …») |
| Mismo conjunto en el navegador (`pruebas.html`, `pruebas-html.cjs`) | **482 pasaron, 0 fallaron**, sin errores de consola |
| Flujo del Laboratorio fase 2 (`laboratorio.cjs`) | 33/33 |
| Flujo manual fase 3 en Chromium (`laboratorio-fase3.cjs`) | 27/27 |
| Regresión completa (`todas.cjs`) | **31/31 scripts en verde** |
| CI de GitHub en el PR | verde |

Las respuestas «de modelo» que usan las pruebas son **fijas, escritas a mano** y se dicen como tales en el código. No
prueban que Claude conteste bien: prueban que el sistema acepta lo correcto, rechaza lo incorrecto y no se deja mandar.

## 2. Casos adversarios (en `pruebas/casos-laboratorio-fase3.js`)

| Ataque o fallo | Qué pasa |
|---|---|
| Fuente inventada | `fuente_inexistente`, el trabajo pide evidencia |
| Extracto alterado o fecha cambiada | `extracto_no_encontrado` |
| Documento viejo presentado como actual | «lectura vencida», evidencia insuficiente |
| Dos fuentes contradictorias | contradicción «posible», nunca confirmada por código |
| Conclusión sin evidencia; referencia a algo que el rol anterior no dijo | `inferencia_sin_base`, `referencia_inexistente` |
| Datos DEMO en un trabajo REAL | rechazado (respuesta, guion y registro) |
| Comandos u órdenes incrustadas («ignora…», «aprueba…») | se marcan; no se ejecutan ni se obedecen |
| Recomendar apostar, comprar o vender | excluido del informe; el contrato lo impide |
| Autoaprobación (texto de la IA, código, adaptador) | imposible: solo una persona cambia el estado final |
| «Identidad autenticada» escrita a mano en los datos | rechazada |
| JSON truncado, inválido, vacío, enorme, caracteres invisibles | error claro; el trabajo no cambia |
| Historial o guardado alterado | la reanudación no carga nada |
| Respuesta reutilizada de otro trabajo o importada dos veces | rechazada |
| Error a mitad del flujo | trabajo en error; el reintento vuelve a esperar al modelo (no corre el guion) |
| Procedencia contradictoria; respuesta de otro rol | aviso o rechazo con motivo |
| Proveedor automático: tiempo agotado, cancelación, desactivación, sin conexión, tamaño, respuesta inválida | error controlado, sin llamadas reales |
| Aislamiento | los módulos nuevos no usan red, no escriben disco, no ejecutan procesos, no leen credenciales |

**Límites que el código no cierra:** el detector de inyección busca frases típicas y una formulación nueva puede pasar
sin marca (la protección real es que ningún texto cambia un estado). Que una cita *apoye* la afirmación, que una
inferencia sea razonable o que una objeción tenga razón lo decide una persona. La procedencia del modelo es
**declarada**: nada demuestra criptográficamente qué modelo escribió el texto.

## 3. Rendimiento (A/B en la misma máquina, SwiftShader)

Base `867afbc` (fase 2) frente a esta rama, `pruebas/navegador/rendimiento.cjs`, Laboratorio cerrado.

| Escenario | Llamadas de dibujo / cuadro (base → fase 3) | Triángulos / cuadro | JS ms/s (base → fase 3) |
|---|---|---|---|
| edificio | 97 → 97 | 12 963 → 12 963 | 36.6 → 33.3 |
| edificio enfocado | 75 → 75 | 12 729 → 12 729 | 26.7 → 29.9 |
| un cuarto | 15 → 15 | 2 087 → 2 087 | 26.6 → 28.7 |
| edificio con brillo | 131 → 131 | 13 320 → 13 320 | 38.1 → 44.7 |
| REAL vencido, quieto | 86 → 86 (1 cuadro/s) | 12 042 → 12 042 | 7.3 → 7.9 |
| celular | 97 → 97 | 12 963 → 12 963 | 45.0 → 53.2 |

El trabajo de la tarjeta gráfica es **idéntico** en todos los escenarios. El tiempo de JavaScript sube y baja en ambos
sentidos entre corridas (ruido de SwiftShader en un contenedor compartido). No hay una diferencia demostrada. Los
cuadros por segundo de SwiftShader **no** son los de la Intel UHD: la medición válida es el paso 4 de
`docs/VALIDAR-LABORATORIO-FASE-3.md`.

Importar y verificar una respuesta de 128 000 caracteres (400 afirmaciones) tarda **~67 ms** en Node en el contenedor.
