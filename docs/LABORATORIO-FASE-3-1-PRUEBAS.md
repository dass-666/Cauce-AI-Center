# Laboratorio de IA · fase 3.1: pruebas y mediciones

Entorno: contenedor Linux en la nube, Node 22, Chromium de Playwright con **SwiftShader** (dibuja la CPU). **Nada se midió
en la Intel UHD de la MSI** ni se probó con Claude de verdad.

## 1. Resultados

| Conjunto | Resultado |
|---|---|
| Node (`node pruebas/ejecutar.mjs`) | **499 pasaron, 0 fallaron** (482 de la fase 3 + 17 «Lab 3.1 · …») |
| Mismo conjunto en el navegador (`pruebas.html`) | **499 pasaron, 0 fallaron**, sin errores de consola |
| `laboratorio.cjs` (fase 2) | 33/33 |
| `laboratorio-fase3.cjs` (fase 3, sin cambios) | 27/27 |
| `laboratorio-fase3-1.cjs` (nuevo) | 16/16 |
| Regresión completa (`todas.cjs`) | **32/32 scripts en verde** |

## 2. Batería sintética (`pruebas/casos-laboratorio-fase3-1.js`)

Todas las respuestas son sintéticas, escritas por la prueba. Columna «tipo»: **P** = presentación recuperable (se
corrige la forma y se declara), **S** = sustantivo (se rechaza o lab-V lo marca; nunca se corrige).

| Caso | Tipo | Resultado |
|---|---|---|
| JSON rodeado de explicación y bloques Markdown; dos bloques | P | aceptado; `bloque_elegido_entre_varios` registrado en `intercambio.correcciones` |
| Comas finales; comillas tipográficas (todas) | P | reparado y declarado |
| Comillas mezcladas (rectas y tipográficas) | S (formato) | rechazado con línea, columna y fragmento; el fragmento no se guarda |
| Prefijo `[Ln]`, comillas envolventes, ubicación numérica | P | cita comprobada **literal** por lab-V |
| Rol con mayúsculas, listas `null`, marcadores «…» en listas de texto | P | normalizado y declarado |
| Marcador «…» en una afirmación | S (contrato) | `plantilla_sin_rellenar` |
| Cita parafraseada | S (evidencia) | `extracto_no_encontrado`, `hecho_sin_cita_utilizable`; diagnóstico: no recuperable |
| Respuesta cortada | S (formato, recuperable) | `json_truncado`; trabajo intacto |
| Hecho sin cita, inferencia sin base, fuente inexistente | S (evidencia) | marcados por lab-V (sin cambios en sus reglas) |
| Contradicción entre roles (objeciones del crítico) | S | en el informe y en «requiere revisión humana»; una «contradicción» con una sola fuente no entra al contrato |
| Demasiado extensa (> 300 000) | S (seguridad) | `demasiado_larga`, sin analizar |
| Diagnóstico | — | sin pregunta, ficha, extractos ni solicitud; `validarDiagnostico` rechaza uno que los traiga |
| Comparación | — | guion DEMO → `sin_datos`; trabajo manual → una fila con 8 criterios, `puntuacion_humana: null` |
| Persistencia | — | exportar→reanudar→exportar idéntico; reanudar dos veces = un trabajo; huellas sobreviven |
| Seguridad: decisiones fabricadas, decisión «por ia», autenticación a mano, historial con saltos, DEMO/REAL | — | todo rechazado |
| Seguridad: `__proto__`/`constructor`, `<script>` | — | rechazado / guardado como texto; prototipos intactos |
| Exportaciones | — | sin contenido rechazado, sin claves de credenciales, fallos solo `{codigo, categoria, recuperable}` |
| `comprobarExportacion` | — | usados / no usados (presentes en el DEMO) / faltantes; Tezcatlipoca rechazado |

## 3. Navegador (`pruebas/navegador/laboratorio-fase3-1.cjs`, 16 comprobaciones)

Fallo de formato clasificado y con fragmento; texto y formulario conservados; reparación con comas y prefijo aceptada
con avisos; descarga de diagnóstico sin contenido; lista de importaciones; recarga; reanudar el mismo expediente no
duplica; expediente con fallos por código; cuota de almacenamiento agotada → aviso recuperable; sin errores de consola.

## 4. Rendimiento (SwiftShader, Laboratorio cerrado)

| Escenario | Llamadas / cuadro (fase 3 → 3.1) | Triángulos / cuadro |
|---|---|---|
| edificio | 97 → 97 | 12 963 → 12 963 |
| edificio enfocado | 75 → 75 | 12 729 → 12 729 |
| un cuarto | 15 → 15 | 2 087 → 2 087 |
| edificio con brillo | 131 → 131 | 13 320 → 13 320 |
| REAL vencido, quieto | 86 → 86 (1 cuadro/s) | 12 042 → 12 042 |
| celular | 97 → 97 | 12 963 → 12 963 |

Trabajo de dibujo **idéntico**: la fase 3.1 no toca la oficina 3D y sus módulos nuevos solo se cargan al abrir el
Laboratorio. Los cuadros por segundo de SwiftShader no son los de la Intel UHD.
