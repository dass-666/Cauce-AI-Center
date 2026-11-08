# Probar el Laboratorio de IA (fases 3 y 3.1) en la MSI con Claude de verdad · unos 10–15 minutos

No hace falta Node, ni instalar nada, ni pagar API. Necesitas Git, Python (ya están), Edge y tu app de Claude.

## 1. Traer la rama (2 min)

En **Git Bash** (o PowerShell):

```
cd C:\Users\MSIGF\Cauce-AI-Center
git status
```

Si aparecen archivos modificados que no son tuyos a propósito, **detente** y avísame (no los borres).
Si está limpio (o solo aparece `ABRIR-CIERRE.bat` sin seguimiento):

```
git fetch origin
git checkout claude/laboratorio-fase-3-1
git log --oneline -1
```

## 2. Abrir la oficina con la Intel UHD (1 min)

1. Doble clic en `iniciar.bat` (deja la ventana negra abierta).
2. Para que Edge use la **Intel UHD**: Configuración de Windows → Sistema → Pantalla → Gráficos → Microsoft Edge →
   «Ahorro de energía». Cierra y vuelve a abrir Edge.
3. Abre `http://127.0.0.1:8765/` y pulsa **L**.

## 3. Una consulta con Claude de verdad (8–10 min)

1. Arriba, en **«Consulta nueva con Claude (respuesta manual, $0)»**: motor «Compago · datos DEMO», deja la pregunta y
   pulsa **«Crear consulta…»**. Debe aparecer «Te toca: respuesta del Investigador (rol 1 de 3)», la franja azul
   «DATOS DEMO · ANÁLISIS DE IA REAL POR INTERCAMBIO MANUAL» y, en la lista, «Pendiente de modelo · IA manual».
2. Pulsa **«Copiar solicitud»**. En la app de Claude abre una **conversación nueva, fuera de cualquier proyecto** y sin
   adjuntar nada; pega y envía.
3. Copia la respuesta completa de Claude (el bloque JSON). En Cauce escribe en «Modelo (declarado)» el modelo que
   muestre la app, pégala en «Respuesta» y pulsa **«Verificar y continuar»**.
   - Si dice «Respuesta aceptada… Siguiente: Analista», sigue.
   - Si dice «NO se aceptó», lee el motivo: dice la categoría (formato · contrato · seguridad), si es recuperable y, en un
     JSON roto, la línea, la columna y el fragmento exacto. Tu texto sigue en el cuadro. Pídele a Claude que la repita
     completa y vuelve a pegar. El trabajo no cambia con un intento fallido.
   - Si dice «Correcciones de forma aplicadas», el sistema quitó comas sobrantes, el prefijo [Ln] o comillas externas:
     no cambia el significado y queda registrado. Anota cuáles salieron.
4. Repite 2–3 para el **Analista** y el **Abogado del Diablo** (cada uno con su propia solicitud, que ya incluye lo
   anterior). Puedes usar la misma conversación de Claude o una nueva: anota cuál usaste.
5. **Recarga la página** (F5) a mitad del camino y pulsa L: el trabajo debe seguir donde lo dejaste.
6. Al terminar el tercer rol: el trabajo pasa a «Pendiente de aprobación humana» o a «Evidencia insuficiente».
   - Pestaña «Hallazgos y evidencia»: cada cita dice «✓ Cita comprobada» o «✗ lab-V NO pudo comprobar».
   - Pestaña «Verificación»: las alertas (citas inventadas, inferencias sin base, órdenes incrustadas…).
   - Línea «Quién produjo cada rol»: «IA · intercambio manual (procedencia declarada)» con el modelo que escribiste.
7. Decide tú: con nombre y motivo (10+ caracteres) aprueba, rechaza o pide evidencia. Debe verse la advertencia
   «Identidad DECLARADA, sin autenticar».
8. Pestaña «Auditoría» → **«Exportar expediente completo»**, **«Descargar informe (Markdown)»** y **«Descargar
   diagnóstico (sin contenido de respuestas)»**. Guárdalos: son la evidencia de la prueba. El diagnóstico se puede
   compartir sin exponer la consulta; si algo falló, es lo primero que necesito.

## 4. Rendimiento con el Laboratorio cerrado (1 min)

Abre `http://127.0.0.1:8765/?medir=1`, tecla 0, espera 20 s y «Copiar medición». Esperado: **55–60 cps**.

## 5. Pruebas sin Node (1 min)

`http://127.0.0.1:8765/pruebas.html` → debe decir **499 pasaron, 0 fallaron**.

## Qué me envías

- El diagnóstico (`…-diagnostico.md`) siempre; el expediente exportado (`…-expediente.json`) y el informe `.md` si
  quieres que revise el contenido; o: «Laboratorio fase 3.1 OK» + la medición.
- Si algo no cuadró: el número del paso, el mensaje que salió y una captura.
- Dime qué modelo mostraba la app y si usaste una conversación por rol o una sola.

Para volver a donde estabas: `git checkout main`.
