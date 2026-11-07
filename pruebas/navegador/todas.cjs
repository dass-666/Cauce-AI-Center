// Fase L: corre TODAS las pruebas de navegador (Chromium) una tras otra y resume el resultado.
// Con servir.py corriendo:  node pruebas/navegador/todas.cjs  [SAL=carpeta para capturas]  [SOLO=fase-l,fase-k]
// Cuenta una prueba como fallida si su script termina con código distinto de 0, si imprime alguna línea
// que empiece por «FALLA», o si informa errores de JavaScript («errores: [ ... ]»).
const { spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const DIR = __dirname;
const SAL = process.env.SAL || path.join(require('os').tmpdir(), 'cauce-capturas');
fs.mkdirSync(SAL, { recursive: true });
// Scripts que reciben la carpeta de capturas como argumento (los demás usan SAL del entorno).
const CON_CARPETA = new Set(['auditoria-visual.cjs', 'e2-capturas.cjs', 'naturaleza.cjs', 'compago-pr10.cjs']);
const solo = (process.env.SOLO || '').split(',').filter(Boolean);
const scripts = fs.readdirSync(DIR)
  .filter((f) => f.endsWith('.cjs') && f !== 'todas.cjs')
  .filter((f) => !solo.length || solo.some((s) => f.startsWith(s)))
  .sort();

const filas = [];
for (const f of scripts) {
  const sal = path.join(SAL, f.replace('.cjs', ''));
  fs.mkdirSync(sal, { recursive: true });
  const args = [path.join(DIR, f), ...(CON_CARPETA.has(f) ? [sal] : [])];
  const t0 = Date.now();
  const r = spawnSync(process.execPath, args, { env: { ...process.env, SAL: sal }, encoding: 'utf8', timeout: 15 * 60_000, maxBuffer: 64 << 20 });
  const texto = `${r.stdout || ''}\n${r.stderr || ''}`;
  const ok = (texto.match(/^\s*OK\b/gm) || []).length;
  const fallas = texto.split('\n').filter((l) => /^\s*FALLA/.test(l));
  const errores = /^errores(?: de consola)?: (?!ninguno)\S/m.test(texto);
  const bien = r.status === 0 && fallas.length === 0 && !errores;
  filas.push({ f, bien, ok, fallas, errores, s: Math.round((Date.now() - t0) / 1000), codigo: r.status });
  console.log(`${bien ? 'VERDE' : 'ROJO '}  ${f.padEnd(28)} ${String(ok).padStart(3)} OK  ${fallas.length} FALLA  ${errores ? 'con errores JS  ' : ''}(${filas.at(-1).s} s, código ${r.status})`);
  for (const l of fallas) console.log(`         ${l.trim()}`);
  if (!bien && !fallas.length) console.log(texto.split('\n').slice(-12).map((l) => `         ${l}`).join('\n'));
}
const rojos = filas.filter((x) => !x.bien).length;
console.log(`\n${filas.length - rojos}/${filas.length} scripts en verde`);
process.exit(rojos ? 1 : 0);
