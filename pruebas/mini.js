// Mini sistema de pruebas sin dependencias. Corre igual en Node (pruebas/ejecutar.mjs)
// y en el navegador (pruebas.html), para no exigir instalar nada en Windows.

const pruebas = [];

export function prueba(nombre, fn) {
  pruebas.push({ nombre, fn });
}

export function igual(obtenido, esperado, mensaje = "") {
  const a = JSON.stringify(obtenido);
  const b = JSON.stringify(esperado);
  if (a !== b) throw new Error(`${mensaje} Se esperaba ${b} y se obtuvo ${a}`.trim());
}

export function verdadero(valor, mensaje = "Se esperaba verdadero") {
  if (!valor) throw new Error(mensaje);
}

export async function ejecutar() {
  const resultados = [];
  for (const p of pruebas) {
    try {
      await p.fn();
      resultados.push({ nombre: p.nombre, ok: true });
    } catch (e) {
      resultados.push({ nombre: p.nombre, ok: false, error: e.message });
    }
  }
  return {
    resultados,
    pasaron: resultados.filter((r) => r.ok).length,
    fallaron: resultados.filter((r) => !r.ok).length,
  };
}
