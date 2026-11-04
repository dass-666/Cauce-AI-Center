"""Fase G: el exportador de Ek Chuah no puede pisar los DEMO de Cauce ni archivos ajenos.

Usa la escritura real del exportador (ek_chuah.cauce.exporter.escribir_seguro) sobre una COPIA de datos/ de Cauce,
con un documento construido SIN base de datos (escenario "sin-base"): no lee nada de Ek Chuah ni de la PC.

    uv run --project <carpeta de Ek Chuah> python pruebas/ek-chuah-sobrescritura.py

Sale con 0 si todo se comporta como debe.
"""

import hashlib
import shutil
import sys
import tempfile
from datetime import datetime, timezone
from pathlib import Path

from ek_chuah.cauce import exporter as ex
from ek_chuah.core.errors import EkChuahError

CAUCE = Path(__file__).resolve().parent.parent


def sha(p: Path) -> str:
    return hashlib.sha256(p.read_bytes()).hexdigest()


def main() -> int:
    res = []
    ok = lambda nombre, cond, extra="": res.append(f"{'OK   ' if cond else 'FALLA'} {nombre}{' · ' + extra if extra else ''}")
    antes_repo = {p: sha(p) for p in sorted((CAUCE / "datos").rglob("*.json"))}
    with tempfile.TemporaryDirectory() as tmp:
        tmp = Path(tmp)
        copia = tmp / "cauce"
        shutil.copytree(CAUCE / "datos", copia / "datos")
        (copia / "datos" / "reales").mkdir(exist_ok=True)
        demos = {p: sha(p) for p in sorted((copia / "datos" / "demo").rglob("*.json"))}
        lectura = ex.leer_fuentes(tmp / "no-existe.db", tmp / "no-existe.log", tmp / "no-existe")
        ahora = datetime.now(timezone.utc).replace(microsecond=0)
        real = ex.construir_documento(lectura, ahora, demo=False)
        demo = ex.construir_documento(lectura, ahora, demo=True)

        def intenta(doc, destino):
            try:
                ex.escribir_seguro(doc, destino)
                return "escrito"
            except EkChuahError as e:
                return f"rechazado: {e}"

        r = intenta(real, copia / "datos" / "demo" / "ek-chuah.json")
        ok("REAL sobre datos/demo/ek-chuah.json (DEMO de Cauce): rechazado", r.startswith("rechazado"), r)
        r = intenta(demo, copia / "datos" / "demo" / "ek-chuah.json")
        ok("DEMO sobre datos/demo/ek-chuah.json: rechazado (carpeta demo)", r.startswith("rechazado"), r)
        r = intenta(real, copia / "datos" / "Demo" / "nuevo.json")
        ok("cualquier archivo en una carpeta «Demo» (mayúsculas): rechazado", r.startswith("rechazado"), r)
        ok("los DEMO de la copia quedaron idénticos (SHA-256)", demos == {p: sha(p) for p in sorted((copia / "datos" / "demo").rglob("*.json"))})
        destino = copia / "datos" / "reales" / "ek-chuah.json"
        ok("REAL en datos/reales/ek-chuah.json (nuevo): escrito", intenta(real, destino) == "escrito")
        ok("REAL otra vez sobre su propio archivo: escrito", intenta(real, destino) == "escrito")
        r = intenta(demo, destino)
        ok("DEMO sobre el REAL de Ek Chuah: rechazado", r.startswith("rechazado"), r)
        ajeno = copia / "datos" / "reales" / "compago.json"
        shutil.copy(CAUCE / "contrato" / "ejemplos" / "compago-exportador.json", ajeno)
        h = sha(ajeno)
        r = intenta(real, ajeno)
        ok("REAL sobre el archivo de Compago: rechazado y sin cambios", r.startswith("rechazado") and sha(ajeno) == h, r)
        sobrantes = [p.name for p in (copia / "datos" / "reales").iterdir() if p.name.endswith(".tmp")]
        ok("sin temporales sobrantes", not sobrantes, ", ".join(sobrantes))
    ok("datos/ del repositorio de Cauce sin cambios (SHA-256)", antes_repo == {p: sha(p) for p in sorted((CAUCE / "datos").rglob("*.json"))})
    print("\n".join(res))
    return 1 if any(x.startswith("FALLA") for x in res) else 0


if __name__ == "__main__":
    sys.exit(main())
