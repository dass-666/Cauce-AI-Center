# Registro real de Nexus (local, fuera de git)

Aquí viven `lecciones.json`, `recomendaciones.json` y `manifiesto.json` reales. Git los ignora: no se suben al repositorio.
Si no existen, la oficina Nexus muestra los datos de prueba de `datos/nexus/demo/` con la franja DEMO.

## Agregar una lección

**Con Node:**

```
node herramientas/nexus.mjs importar mi-leccion.json --por=diego              (vista previa: no escribe)
node herramientas/nexus.mjs importar mi-leccion.json --por=diego --confirmar  (respaldo antes, sello después)
```

**Sin Node:**
1. En la oficina Nexus abre «Importar una lección (vista previa)».
2. Si la lección se admite, descarga `lecciones.json` y `manifiesto.json`.
3. Antes de reemplazar nada, copia esta carpeta completa a un respaldo.
4. Guarda los dos archivos aquí.

## Anota el ancla fuera del equipo

Después de cada sello, el ancla que aparece (por ejemplo `3:9f2c…`) se anota fuera del equipo: en papel, en un mensaje o en otro disco. Con `verificar-ancla` se comprueba que nadie quitó sellos.

## Reglas

- Nunca borres ni edites entradas a mano. Cada una lleva la huella de la anterior, y el manifiesto detecta si faltan las últimas.
- Restaurar nunca sobrescribe. `node herramientas/nexus.mjs restaurar datos/nexus/respaldos/<fecha>` deja las copias en `datos/nexus/restauraciones/` y explica qué cambiaría. Mover los archivos lo decides tú.
