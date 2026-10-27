"""Sirve mi_dashboard/ por HTTP sin cache del navegador.

Reemplaza a `python -m http.server`, que no manda cabeceras anti-cache: el
navegador puede reusar un .js viejo aunque el archivo haya cambiado.
Uso: python servidor.py [puerto]   (por defecto 5500)
"""

import sys
from functools import partial
from http.server import SimpleHTTPRequestHandler, ThreadingHTTPServer
from pathlib import Path


class SinCache(SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header("Cache-Control", "no-store")
        super().end_headers()


def main(puerto: int) -> None:
    # Siempre sirve la carpeta de este archivo, se lance desde donde se lance.
    handler = partial(SinCache, directory=str(Path(__file__).resolve().parent))
    with ThreadingHTTPServer(("", puerto), handler) as srv:
        print(f"Dashboard en http://localhost:{puerto}/dashboard.html  (Ctrl+C para salir)")
        try:
            srv.serve_forever()
        except KeyboardInterrupt:
            pass


if __name__ == "__main__":
    main(int(sys.argv[1]) if len(sys.argv) > 1 else 5500)
