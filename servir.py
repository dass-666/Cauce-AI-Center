"""Servidor local del centro de operaciones (solo biblioteca estándar de Python).

Sirve esta carpeta en http://127.0.0.1:8765 y SOLO en esta computadora (no se expone a la red).
No ejecuta adaptadores, no consulta bases de datos y no consume IA: solo entrega archivos.

Uso:  py servir.py            (o: python servir.py)
      py servir.py --puerto 9000 --sin-abrir
      py servir.py --base /cauce/     (fase L: prueba local de cómo se vería publicada bajo una subruta)
      py servir.py --recibir-mediciones mediciones\\20261108   (solo herramientas\\medir-msi.ps1: acepta los
          informes de la medición automática como archivos JSON en esa carpeta; sin esa opción no se escribe nada)
"""
import argparse
import json
import re
import os
import socket
import sys
import http.server
import threading
import webbrowser
from functools import partial
from pathlib import Path

RAIZ = Path(__file__).resolve().parent
HOST = "127.0.0.1"


class Manejador(http.server.SimpleHTTPRequestHandler):
    # Windows a veces registra .js como text/plain y el navegador rechaza los módulos.
    extensions_map = {
        **http.server.SimpleHTTPRequestHandler.extensions_map,
        ".js": "text/javascript; charset=utf-8",
        ".mjs": "text/javascript; charset=utf-8",
        ".json": "application/json; charset=utf-8",
        ".css": "text/css; charset=utf-8",
        ".html": "text/html; charset=utf-8",
    }

    base = "/"  # subruta donde se publica (fase L); "/" = la raíz, como siempre
    mediciones = None  # carpeta donde se aceptan informes de medición (solo con --recibir-mediciones)

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        # Fase L: solo páginas de este mismo origen pueden incrustar el visualizador (protege contra clickjacking).
        # El portal Cauce deberá decidir su propia política (ver docs/INTEGRACION-PORTAL-CAUCE.md).
        self.send_header("Content-Security-Policy", "frame-ancestors 'self'")
        self.send_header("Referrer-Policy", "no-referrer")
        super().end_headers()

    def _fuera_de_base(self):
        """Con --base, la subruta sin «/» final redirige y todo lo que esté fuera de la subruta es 404."""
        if self.base == "/":
            return False
        ruta = self.path.split("?", 1)[0]
        if ruta == self.base.rstrip("/"):
            self.send_response(301)
            self.send_header("Location", self.base + (("?" + self.path.split("?", 1)[1]) if "?" in self.path else ""))
            self.end_headers()
            return True
        if not ruta.startswith(self.base):
            self.send_error(404)
            return True
        return False

    def do_GET(self):
        if not self._fuera_de_base():
            super().do_GET()

    def do_HEAD(self):
        if not self._fuera_de_base():
            super().do_HEAD()

    def do_POST(self):
        """Único escrito posible: un informe de medición JSON (≤ 1 MB, nombre fijo) en la carpeta de --recibir-mediciones."""
        ruta = self.path.split("?", 1)[0]
        if self.base != "/" and ruta.startswith(self.base):
            ruta = "/" + ruta[len(self.base):]
        m = re.fullmatch(r"/__medicion/([a-z0-9][a-z0-9-]{0,79})\.json", ruta)
        largo = int(self.headers.get("Content-Length") or 0)
        if not self.mediciones or not m or not 0 < largo <= 1 << 20:
            self.send_error(404 if not self.mediciones or not m else 413)
            return
        try:
            doc = json.loads(self.rfile.read(largo).decode("utf-8"))
        except (ValueError, UnicodeDecodeError):
            self.send_error(400)
            return
        destino = self.mediciones / f"{m.group(1)}.json"
        temporal = destino.with_suffix(".tmp")
        temporal.write_text(json.dumps(doc, ensure_ascii=False, indent=2), encoding="utf-8")
        os.replace(temporal, destino)
        self.send_response(204)
        self.end_headers()

    def translate_path(self, path):
        if self.base != "/" and path.startswith(self.base):
            path = "/" + path[len(self.base):]
        return super().translate_path(path)

    def list_directory(self, path):  # no mostrar listados de carpetas
        self.send_error(404)
        return None

    def log_message(self, formato, *args):  # registro breve
        if not str(args[1] if len(args) > 1 else "").startswith("2"):
            super().log_message(formato, *args)


class Servidor(http.server.ThreadingHTTPServer):
    """En Windows, SO_REUSEADDR deja que DOS programas escuchen el mismo puerto (y uno le roba al otro las
    peticiones). Ahí se pide el puerto en exclusiva: si está ocupado, se avisa en vez de arrancar a medias."""
    allow_reuse_address = os.name != "nt"

    def server_bind(self):
        if os.name == "nt" and hasattr(socket, "SO_EXCLUSIVEADDRUSE"):
            self.socket.setsockopt(socket.SOL_SOCKET, socket.SO_EXCLUSIVEADDRUSE, 1)
        super().server_bind()


def main():
    p = argparse.ArgumentParser(description="Centro de operaciones: servidor local")
    p.add_argument("--puerto", type=int, default=8765)
    p.add_argument("--sin-abrir", action="store_true", help="no abrir el navegador")
    p.add_argument("--base", default="/", help="subruta de prueba, p. ej. /cauce/ (solo en esta computadora)")
    p.add_argument("--recibir-mediciones", metavar="CARPETA", help="acepta informes de medición en esa carpeta")
    a = p.parse_args()
    if a.recibir_mediciones:
        Manejador.mediciones = Path(a.recibir_mediciones).resolve()
        Manejador.mediciones.mkdir(parents=True, exist_ok=True)
    base = "/" + a.base.strip("/") + "/" if a.base.strip("/") else "/"
    Manejador.base = base
    url = f"http://{HOST}:{a.puerto}{base}"
    try:
        srv = Servidor((HOST, a.puerto), partial(Manejador, directory=str(RAIZ)))
    except OSError:
        print(f"El puerto {a.puerto} ya está en uso en esta computadora.")
        print(f"- Si el centro de operaciones ya está abierto, entra a {url} (no hace falta abrirlo dos veces).")
        print(f"- Si es otro programa, usa otro puerto:  iniciar.bat --puerto 8775")
        sys.exit(2)
    with srv:
        print(f"Centro de operaciones en {url}  (Ctrl+C para detener)")
        if not a.sin_abrir:
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\nDetenido.")


if __name__ == "__main__":
    main()
