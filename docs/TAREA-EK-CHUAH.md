# Tarea recomendada para actualizar el JSON de Ek Chuah (documentada, NO instalada)

Esta tarea es **independiente**: no modifica la tarea `EkChuah-Alertas` ni ningún archivo de Ek Chuah, y solo lee. Instálala cuando decidas usar datos reales. Mientras tanto basta con `conectar_ek_chuah.bat` con la ventana abierta.

## Frecuencia y vigencia
| Parámetro | Valor | Por qué |
|---|---|---|
| Frecuencia | cada **15 min** | Las descargas y alertas de Ek Chuah ocurren una vez al día (9:00) o a mano. Con 15 min, una corrida aparece en Cauce como mucho 15 min después de terminar. |
| `--vigencia` | **2700 s** (45 min = 3 ciclos) | Tolera dos exportaciones perdidas (PC suspendida, `uv` lento) sin marcar «desactualizado». Con 900 s (un solo ciclo, como sugiere el ejemplo de Ek Chuah), un minuto de retraso ya lo marcaría vencido. |
| «trabajando» | sin cambios | El exportador solo marca *trabajando* con una fila `running` de hace 30 min o menos. Con un ciclo de 15 min, una descarga larga se ve trabajando en 1 o 2 lecturas y luego pasa a *requiere revisión* si se atora. |

El exportador ya admite todo esto (`--vigencia`, de 30 a 604 800 s; `src/ek_chuah/cauce/exporter.py`, PR #2 `a23e06c`). **No hace falta modificar Ek Chuah.**

Contrapartida: si el exportador se detiene, Cauce sigue mostrando la última lectura como vigente hasta 45 min, con «Dato de hace N min» siempre visible. Para avisar antes, baja la vigencia a 1800 s (2 ciclos).

## Comando para crearla (cuando lo decidas; PowerShell como tu usuario, sin administrador)
Cambia las dos rutas de abajo:
```powershell
$ek    = "C:\ruta\a\EK_CHUAH"                       # carpeta con pyproject.toml
$cauce = "C:\ruta\a\Cauce-AI-Center"                # carpeta con servir.py
$cmd   = "cd /d `"$ek`" && uv run ek-chuah exportar-cauce --salida `"$cauce\datos\reales\ek-chuah.json`" --vigencia 2700"
schtasks /Create /TN "Cauce-EkChuah-Exportar" /SC MINUTE /MO 15 /TR "cmd /c $cmd" /F
```
- Corre como tu usuario y solo mientras tengas la sesión iniciada (no pide contraseña ni permisos de administrador).
- Si `uv` no está en el PATH de la tarea, usa la ruta completa (`where uv` te la da).
- Comprobar: `schtasks /Query /TN "Cauce-EkChuah-Exportar" /V /FO LIST`. Borrar: `schtasks /Delete /TN "Cauce-EkChuah-Exportar" /F`.
- Códigos del exportador: 0 = leyó todo; 1 = falta la base o una tabla (igual escribe el aviso); 2 = se negó a escribir (por ejemplo, la salida apunta a un DEMO).

## Qué NO hace
- No escribe en `datos/demo/`. El exportador se niega, y lo comprueba `pruebas/ek-chuah-sobrescritura.py`.
- No lee `journal_*`, `.env`, webhooks ni los títulos o el contenido de las alertas.
- No cambia la tarea diaria `EkChuah-Alertas`. «Programado · sin confirmar» seguirá apareciendo mientras su log no tenga una corrida de las últimas 26 h.
