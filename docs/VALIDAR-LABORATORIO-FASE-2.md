# Probar el Laboratorio de IA (fase 2) en la MSI · unos 10 minutos

No necesita Node ni instalar nada: Git, Python (ya están) y Edge.

## 1. Traer la rama (2 min)

En la MSI, abre **Git Bash** (o PowerShell) y escribe:

```
cd C:\Users\MSIGF\Cauce-AI-Center
git status
```

Si `git status` muestra archivos modificados que no son tuyos a propósito, **detente** y avísame (no los borres).
Si está limpio (o solo aparece `ABRIR-CIERRE.bat` sin seguimiento):

```
git fetch origin
git checkout claude/project-thread-g7h0tv
git log --oneline -1
```

La última línea debe empezar con el commit que figura en el PR del Laboratorio fase 2.

## 2. Abrir la oficina con la Intel UHD (1 min)

1. Haz doble clic en `iniciar.bat` (deja la ventana negra abierta).
2. Para que Edge use la **Intel UHD** y no la GTX 1650: Configuración de Windows → Sistema → Pantalla → Gráficos →
   Microsoft Edge → «Ahorro de energía». Cierra y vuelve a abrir Edge.
3. En Edge abre `http://127.0.0.1:8765/`.

## 3. El Laboratorio (5 min)

1. Pulsa la tecla **L** (o el botón «⚗ Laboratorio»). Debe aparecer:
   - la franja amarilla **«DEMO · SIN MODELO · NO ES IA»**;
   - el plano con cinco estaciones (Coordinador arriba; Investigador, Analista, Abogado del Diablo y Verificador abajo);
   - **4 trabajos**: dos «Requiere revisión humana» (Compago y Ek Chuah), «Prueba de lab-V» en «Requiere evidencia»
     y «Prueba de fallo» en «Requiere revisión humana»; el botón muestra un **4**.
2. En el trabajo de Compago, pestaña «Hallazgos y evidencia»: cada cita dice «✓ Cita comprobada por lab-V».
3. Pulsa «Aprobar informe» **sin escribir motivo** → debe decir «No se registró». Escribe un motivo de al menos
   10 caracteres y vuelve a pulsar → pasa a «Terminados» y el contador baja a **3**.
4. Pulsa «Preparar propuesta» (para Nexus) → debe decir que Nexus la ve «con objeciones» y que **no se escribe** en
   su almacén.
5. Elige «Prueba de lab-V»: dos citas en rojo «✗ lab-V NO pudo comprobar esta cita» y **no** hay botón «Aprobar».
6. Elige «Prueba de fallo» → pestaña «Auditoría»: el historial muestra «Error» y «Reintento».
7. Pulsa «▶ Correr un trabajo DEMO paso a paso»: las estaciones se encienden una tras otra y aparece un trabajo nuevo
   en «Requiere revisión humana». Pulsa «▶ … sobre Ek Chuah» y enseguida «■ Detener»: queda en «Pendiente».
8. Pulsa **Esc**: vuelves al edificio.

## 4. Rendimiento con el Laboratorio cerrado (1 min)

Abre `http://127.0.0.1:8765/?medir=1`, espera 20 s con el edificio completo (tecla 0) y usa «Copiar medición».
Esperado: **55–60 cps** como antes (el Laboratorio no se carga hasta abrirlo y, abierto, pausa la 3D).

## 5. Pruebas sin Node (1 min)

Abre `http://127.0.0.1:8765/pruebas.html` → debe decir **458 pasaron, 0 fallaron**.

## Qué me envías

- Si todo cuadró: «Laboratorio OK» y el resultado de «Copiar medición».
- Si algo no cuadró: el número del paso y una captura.

Para volver a donde estabas: `git checkout main`.
