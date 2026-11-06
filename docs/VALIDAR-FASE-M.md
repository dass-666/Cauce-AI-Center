# Validar la fase M en Windows (10–15 minutos)

La fase M cambia cómo se ve el edificio, no lo que muestra. Lo único que no se puede comprobar desde aquí es el
**rendimiento real en tu Intel UHD**: las pruebas automáticas dibujan con SwiftShader (la CPU hace de tarjeta
gráfica) y no dicen nada de tus cuadros por segundo.

## 1. Abrir

1. Cambia a la rama de la fase M (o descarga el PR) y ejecuta `iniciar.bat`.
2. Abre `http://127.0.0.1:8765/?medir=1` (el recuadro de medición aparece abajo a la derecha).
3. Si aparece la sala de control, ciérrala.

## 2. Qué deberías ver

- **Compago**: muros interiores color arena, fachada café con cornisa clara, maderas de roble, sillas azules.
- **Ek Chuah**: muros salvia, fachada verde pizarra con cornisa de latón, nogal oscuro, sillas verdes.
- Cada departamento con muebles propios: tarima y banda con cajas (Importación), globo y tablero de corcho
  (Búsqueda), archiveros y estaciones de pie (Revisión/Informes), mesa de análisis (Evaluación/Simulaciones),
  pantallas en el muro (Márgenes/Riesgo), archivo alto y mesa con lámpara de inspección (Auditoría), consola
  (Supervisión) y gabinetes de servidores (UNIQ/Datos).
- Pisos distintos según el trabajo (duela, alfombra modular, concreto pulido o vinil).
- Las pantallas de muro muestran **dibujos abstractos sin cifras**. Si los datos no están vigentes se ven
  atenuadas.
- Un resplandor suave sobre el escritorio **solo** donde la pantalla del puesto está encendida por evidencia.
- Nadie nuevo: los mismos personajes de antes, solo donde hay evidencia.

## 3. Medir (lo importante)

Para cada caso deja la vista quieta 20 s y pulsa **Copiar medición**; pégala en tu respuesta.

| Caso | Cómo |
|---|---|
| Normal, brillo apagado | Al abrir, sin tocar nada |
| Normal, brillo encendido | Marca **Brillo** |
| Inmersivo, brillo encendido | Botón **Inmersivo** |
| Un departamento enfocado | Tecla **1** |
| Ek Chuah | Pestaña **Ek Chuah** |

Referencia anterior en tu equipo (fase G): **61 cps** de promedio, 53 mínimo, 170 llamadas, 6 257 triángulos.
Ahora el edificio de Compago usa **97 llamadas** y **~13 000 triángulos** (conteo exacto en el recuadro).
Si algún caso baja de **50 cps de promedio**, dímelo con la medición copiada: hay alternativas preparadas
(ver «Mejoras futuras» en el informe).

Para comparar contra la versión anterior en la misma sesión puedes usar `herramientas\comparar-fps.bat`
(de la rama de rendimiento UHD, incluida en esta fase).

## 4. Revisar que nada se rompió

- **0** = edificio completo, **1–9** = departamentos, **R** = recepción, **A** = siguiente alerta,
  **Retroceso** = vista anterior. Los viajes de cámara deben verse suaves.
- La **rueda del ratón** ahora acerca hacia donde apunta el puntero.
- **Un cuarto**, **Plano** (2D), **Bajo consumo**, **Luz fija** y **Brillo** siguen funcionando.
- En el celular (vertical) el edificio aparece un poco girado y más grande; en horizontal, como antes.
