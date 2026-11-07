# Validar la fase 2 en Windows 11

Esta guía comprueba las dos ramas en tu computadora: `fase-2/compago-real` (Cauce) y `cauce/exportador-solo-lectura` (Compago). Todo es local; no usa el servidor compartido ni PostgreSQL. Tarda unos 15 minutos.

Necesitas Git y Python 3. Node.js es opcional.

## 1. Descargar las ramas

En PowerShell:

```powershell
cd $HOME\Desktop
git clone -b fase-2/compago-real https://github.com/dass-666/Cauce-AI-Center.git
cd <carpeta de tu Compago>
git fetch origin
git switch cauce/exportador-solo-lectura
```

Si en Compago tienes cambios sin guardar, `git switch` se detiene. Guárdalos antes con `git stash`, o usa otra copia de la carpeta.

## 2. Pruebas automáticas

**Compago** (en su carpeta, con su entorno virtual activado):

```powershell
python manage.py test apps.tests.test_cauce
```

Esperado: `Ran 18 tests ... OK`. Si tienes tiempo, corre la suite completa con `python manage.py test` (esperado: todo OK).

**Cauce:** doble clic en `iniciar.bat` y abre <http://127.0.0.1:8765/pruebas.html>.

Esperado: `55 pasaron, 0 fallaron`.

## 3. Ver la demostración

Con `iniciar.bat` en marcha, abre <http://127.0.0.1:8765>. Esperado:

- El piso Compago tiene la franja amarilla **DATOS DE DEMOSTRACIÓN**.
- La barra de estado dice "Todavía no hay datos reales…".

## 4. Conectar Compago

1. Abre `conectar_compago.bat` con el Bloc de notas y cambia esta línea por la carpeta donde está el `manage.py` de Compago:
   `set "COMPAGO_DIR=C:\ruta\a\Compago"`
2. Guarda el archivo y ábrelo con doble clic. Deja esa ventana abierta.
3. Esperado: cada 5 minutos aparece una línea como
   `… compago.json actualizado · 60 ms total · 18 consultas (5 ms en base) · CPU 55 ms · memoria pico 450 KiB`.
   **Anota esas cifras**: son la medición real en tu PC.
4. Recarga el navegador. Esperado: desaparece la franja amarilla y la barra dice `REAL: Compago · exportar_cauce`.

Si tu Compago solo tiene datos de `cargar_demo`, casi todo saldrá en cero. Es correcto: el comando lee solo los registros **reales** de Compago. Para ver los demostrativos, agrega `--entorno demo` a la línea del `.bat`.

## 5. Probar fallas

| Prueba | Qué haces | Qué debe pasar |
|---|---|---|
| Desconexión | Cierras la ventana del exportador y esperas 15 min (o lo corres con `--vigencia 60` y esperas 1 min) | El piso muestra **Datos desactualizados** y todos los personajes, *Sin información* |
| Archivo dañado | Escribes cualquier texto en `datos\reales\compago.json` | **Archivo inválido**; no vuelve a la demostración |
| Sin archivo | Borras `datos\reales\compago.json` | Vuelve la demostración, con aviso |
| Importación | Importas un CSV pequeño en Compago mientras el exportador corre | Compago importa con normalidad; después de la siguiente exportación, el Importador muestra *Finalizado* (o *Error* si falló) |

## 6. Confirmar que Compago no cambió

```powershell
git status
```

En la carpeta de Compago no deben aparecer archivos modificados. El exportador no escribe en la base de datos (una prueba automática lo verifica). Su único archivo de salida queda en `Cauce-AI-Center\datos\reales\`, que git ignora.

## Qué reportar

- Si pasaron las pruebas del paso 2.
- Las cifras del paso 4.3.
- Cualquier tabla del paso 5 que no se comportó como se esperaba, con una captura de pantalla.

## 7. Oficina 3D

Ver [`VALIDAR-3D-WINDOWS.md`](VALIDAR-3D-WINDOWS.md).
