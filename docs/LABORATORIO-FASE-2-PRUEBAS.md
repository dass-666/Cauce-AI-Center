# Laboratorio de IA · fase 2 · resultados de pruebas

Medido en el contenedor de desarrollo (Linux, Node 22, Chromium con SwiftShader) sobre el commit de la fase 2 de la
rama `claude/project-thread-g7h0tv`. **Nada de esto se midió en la MSI ni en la Intel UHD.**

## Resultados

| Prueba | Cómo se corre | Resultado |
|---|---|---|
| Unitarias + integración (todas) | `node pruebas/ejecutar.mjs` | **458 pasaron, 0 fallaron** (antes 441; +17 de `casos-laboratorio-fase2.js`) |
| Las mismas en navegador | `pruebas.html` en Chromium (`pruebas/navegador/todas.cjs`) | 458 / 0, igual que Node |
| Herramienta y disco | `node pruebas/laboratorio-node.mjs` | 9 / 9 (incluye `flujo-demo` → `trabajos` → `revisar`) |
| Piloto empaquetado (sin ejecutar) | `node pruebas/piloto-node.mjs` | 6 / 6 |
| Vista del Laboratorio | `node pruebas/navegador/laboratorio.cjs` | 33 / 33 |
| Regresión de la oficina | los 30 guiones de `pruebas/navegador/` | 30 / 30 en verde (23 de una pasada + 7 con `SOLO=`, tras reiniciar el servidor) |
| CI (GitHub Actions, Node) | al empujar | verde |

### Qué cubren los 17 casos nuevos (resumen)

- Ficha citable: determinista, con huella; invisibles y saltos limpiados; motor sin integración rechazado; documento
  que no cumple el contrato v1 rechazado; DEMO/REAL marcados.
- Máquina de estados: transiciones válidas e inválidas; solo una persona aprueba o rechaza; motivo ≥ 10; aprobar
  exige informe; historial inyectado o reescrito detectado; tope de 3 reintentos.
- Coordinador: flujo completo DEMO; interrupción y reanudación sin repetir pasos verificados; error de transporte →
  error → reintento; tiempo agotado; salida basura conservada y rechazada por lab-V.
- lab-V dentro del flujo: cita inventada y extracto alterado → «requiere evidencia».
- Seguridad: guion sin modelo prohibido en REAL; respuesta con `rm -rf` marcada y no ejecutada; recomendaciones de
  compra/venta excluidas; propuesta a Nexus solo tras aprobación y nunca escrita; aislamiento del código fuente
  (sin red, escritura ni procesos).
- Registro: tipos `trabajo` e `informe`; cadena de huellas; DEMO y REAL en registros separados.

## Rendimiento (A/B en SwiftShader, `pruebas/navegador/rendimiento.cjs`)

Base = rama de #28 (sin Laboratorio). Lab = esta rama, con el Laboratorio cerrado (como arranca la oficina).

| Escenario | cps base | cps lab | llamadas/cuadro | triángulos/cuadro |
|---|---|---|---|---|
| edificio | 24 | 24.5 | 97 = 97 | 12 963 = 12 963 |
| edificio-enfocado | 20.7 | 20.3 | 75 = 75 | 12 729 = 12 729 |
| un-cuarto | 51.6 | 54.5 | 15 = 15 | 2 087 = 2 087 |
| edificio-brillo | 19 | 17.8 | 131 = 131 | 13 320 = 13 320 |
| un-cuarto-brillo | 32.8 | 31.3 | 22 = 22 | 2 198 = 2 198 |
| edificio-brillo-dpr1.5 | 11 | 11 | 131 = 131 | 13 320 = 13 320 |
| edificio-brillo-completo | 10.2 | 10.2 | 111 = 111 | 12 977 = 12 977 |
| edificio-dpr1.5 | 15.3 | 14.7 | 97 = 97 | 12 963 = 12 963 |
| edificio-real-vencido-quieto | 1 | 1 | 86 = 86 | 12 042 = 12 042 |
| celular-edificio | 30 | 30 | 97 = 97 | 12 963 = 12 963 |

Errores en consola: ninguno en ambos. El trabajo de la GPU (llamadas, triángulos, pasadas, megapíxeles) es
**idéntico**; las diferencias de cps son ruido del simulador (±1.5 cps en ambos sentidos). Con el Laboratorio abierto
la 3D se pausa (114 → 114 cuadros en 1.5 s).

**Interpretación honesta:** SwiftShader es un procesador por software; sus cps no predicen los de la Intel UHD. Lo que
sí demuestra es que el Laboratorio no añade trabajo de dibujo. La cifra en la UHD (meta 55–60 cps) queda por medir en
la MSI con `?medir=1` (ver `docs/VALIDAR-LABORATORIO-FASE-2.md`, paso 4).
