# Validar las estaciones en la MSI (Windows 11, Intel UHD)

Tiempo: 10–15 minutos. No instala nada ni cambia datos reales.

## 1. Traer la rama

```bat
cd C:\Users\MSIGF\Cauce-AI-Center
git fetch origin
git checkout claude/project-thread-13jxhn
iniciar.bat
```

## 2. Pruebas

Abre `http://127.0.0.1:8765/pruebas.html`: el resumen debe decir **420 pasaron, 0 fallaron**.

## 3. Ver las estaciones

1. Abre `http://127.0.0.1:8765/` → piso **Ek Chuah** → modo **Edificio**. En «Análisis de riesgo» hay una mesa larga
   con tres personajes y un tablero «Observatorio Geopolítico y Macroeconómico» con la marca DEMO.
2. Toca el tablero: el panel dice qué es cada función, que es demostración y qué datos faltan.
3. Toca a un personaje: se marca su puesto.
4. Piso **Compago** → «Evaluación de oportunidades»: estación «Oportunidades Internacionales» con un globo.
5. **Un cuarto** → elige «Análisis de riesgo» (Ek Chuah) u «Oportunidades» (Compago): la estación también está.
6. **Plano** (2D): botón de la estación dentro del cuarto anfitrión.

Qué NO debe pasar: ningún personaje de estación tecleando en la demo; ningún monto ni «rentable»; ningún piso o
departamento nuevo.

## 4. Medir cuadros por segundo (lo que importa en la UHD)

Con Edge visible, pantalla completa, brillo apagado, sin tocar nada durante 20 s en cada caso:

| Caso | Dirección |
|---|---|
| A · sin estaciones | `http://127.0.0.1:8765/?medir=1&estaciones=0` |
| B · con estaciones | `http://127.0.0.1:8765/?medir=1` |

En cada uno, abre **Compago** y luego **Ek Chuah** en modo Edificio, espera 20 s y pulsa **«Copiar medición»**.
Envía las cuatro mediciones. Si la GPU NVIDIA está activa, fija Edge en «Ahorro de energía» (Intel UHD) en
Configuración › Sistema › Pantalla › Gráficos antes de medir.

Criterio propuesto: aceptar si B queda a ≤ 3 cps de A en promedio y sin segundos nuevos bajo 50 cps.
