# Probar la fase K en Windows (5 minutos)

## 1. Abrir (1 min)

1. En la carpeta del repositorio: `git fetch origin` y `git checkout fase-k/oficina-virtual-profesional`.
2. Doble clic en **`iniciar.bat`** (abre `http://127.0.0.1:8765/?medir=1` si lo escribes a mano en Chrome o Edge).
   No hace falta instalar nada nuevo.

## 2. Qué visitar y qué observar (3 min)

| Pantalla | Cómo llegar | Qué debe pasar |
|---|---|---|
| **Sala de control** | Botón **◉ Sala de control** (o tecla **S**) | 6 proyectos: Compago y Ek Chuah **DEMO**; Tezcatlipoca, CauceService y Repacar / Auxilio Auto **Pendiente**; Montambre **Sin conexión**. «Procesos trabajando (REAL)» = **0** (sin datos reales). Lo de DEMO va marcado DEMO y se cuenta aparte. |
| Ir a un piso | En la tarjeta de Ek Chuah: **Ir al piso ›** | Se cierra la sala, cambia el piso y aparece arriba «Piso Ek Chuah · DEMO». |
| Ir a un problema | Sala → en «Requiere atención», **Ver departamento** | Lleva al piso y abre el detalle de ese departamento. No hay botones para «resolver»: eso se hace en el sistema. |
| **Recepción** | Botón **⌂ Recepción** (o **R**) | La cámara se acerca a la recepción: letrero del proyecto, **directorio** con el estado de cada departamento y el emblema en el piso. |
| Siguiente alerta | Botón **⚠** (o **A**, varias veces) | Recorre solo los departamentos con alertas, errores o revisiones. **0** regresa al edificio completo. |
| **Personaje en DEMO** | Departamento *Importación* → botón **Importador** | Teclea en ráfagas (pausa, lee la pantalla, sigue). Botón **◎ Seguir** (o **F**): la cámara lo acompaña; arrastrar la vista lo apaga. |
| Panel | El mismo detalle | Arriba «COMPAGO · PERSONAJE · DEMO»; «Qué es: Proceso automático»; «Desde la última evidencia»; «Fuente … vigencia»; «Cambios observados en esta sesión». |
| Sin actividad | Departamento *Evaluación* | Silla vacía con placa HUMANO: nunca aparece una persona trabajando. |
| Celular | El servidor solo escucha en 127.0.0.1: pruébalo en la PC con F12 → icono de celular (iPhone 12) | Sala en una columna, botones grandes; menú **⋯** con «Ir a la recepción» y «Sala de control». |

## 3. Medir cuadros por segundo (1 min)

1. Abre `http://127.0.0.1:8765/?medir=1`, edificio completo, sin tocar nada **20 segundos**.
2. Botón **Copiar medición** del recuadro verde y pégalo en el hilo. Repite con **Inmersivo**.
3. Referencia: fase G midió **≈61 cps** en tu Intel UHD. La fase K agrega 3 llamadas de dibujo (159 en vez de 156)
   y 2 texturas; con la sala abierta la 3D **no dibuja**. Si ves menos de 50 cps sostenidos, avísame con la medición.

## 4. Pruebas automáticas (opcional)

- Sin Node: `http://127.0.0.1:8765/pruebas.html` → debe decir **230 pasaron, 0 fallaron**.
- Con Node: `probar.bat`.

## 5. Regresar a la versión anterior

`git checkout fase-j/estabilidad-puente` y recarga la página (Ctrl+F5). La fase K no cambia el contrato, ni
`datos/reales/`, ni los exportadores: volver atrás no pierde datos. La preferencia «sala abierta» se guarda en el
navegador; si al volver la ves rara, cierra la sala o borra los datos del sitio.
