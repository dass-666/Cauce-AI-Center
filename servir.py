"""Servidor local del centro de operaciones (solo biblioteca estándar de Python).

Sirve esta carpeta en http://127.0.0.1:8765 y SOLO en esta computadora (no se expone a la red).
No ejecuta adaptadores, no consulta bases de datos y no consume IA: solo entrega archivos.

Uso:  py servir.py            (o: python servir.py)
      py servir.py --puerto 9000 --sin-abrir
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

    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        self.send_header("X-Content-Type-Options", "nosniff")
        super().end_headers()

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
    a = p.parse_args()
    url = f"http://{HOST}:{a.puerto}/"
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
