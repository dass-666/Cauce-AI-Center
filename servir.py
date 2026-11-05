"""Servidor local del centro de operaciones (solo biblioteca estándar de Python).

Sirve esta carpeta en http://127.0.0.1:8765 y SOLO en esta computadora (no se expone a la red).
No ejecuta adaptadores, no consulta bases de datos y no consume IA: solo entrega archivos.

Uso:  py servir.py            (o: python servir.py)
      py servir.py --puerto 9000 --sin-abrir
      py servir.py --base /cauce/     (fase L: prueba local de cómo se vería publicada bajo una subruta)
"""
import argparse
import http.server
import socketserver
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


def main():
    p = argparse.ArgumentParser(description="Centro de operaciones: servidor local")
    p.add_argument("--puerto", type=int, default=8765)
    p.add_argument("--sin-abrir", action="store_true", help="no abrir el navegador")
    p.add_argument("--base", default="/", help="subruta de prueba, p. ej. /cauce/ (solo en esta computadora)")
    a = p.parse_args()
    base = "/" + a.base.strip("/") + "/" if a.base.strip("/") else "/"
    Manejador.base = base
    url = f"http://{HOST}:{a.puerto}{base}"
    socketserver.TCPServer.allow_reuse_address = True
    with http.server.ThreadingHTTPServer((HOST, a.puerto), partial(Manejador, directory=str(RAIZ))) as srv:
        print(f"Centro de operaciones en {url}  (Ctrl+C para detener)")
        if not a.sin_abrir:
            threading.Timer(0.6, lambda: webbrowser.open(url)).start()
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            print("\nDetenido.")


if __name__ == "__main__":
    main()
