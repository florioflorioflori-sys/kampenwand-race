"""Baut die Browser-Vorabversion: bettet Heightmap und Streckenlinie in eine HTML-Datei ein.

Aufruf: python3 web/build.py <ordner-mit-geodaten> [ausgabe.html]
Erwartet heightmap_4km_2049px.r16, heightmap_info.json und downhill_linie.geojson.
"""
import base64, gzip, json, sys
from pathlib import Path
import numpy as np

src = Path(sys.argv[1])
out = Path(sys.argv[2]) if len(sys.argv) > 2 else Path(__file__).parent / 'dist' / 'kampenwand-downhill.html'
info = json.loads((src / 'heightmap_info.json').read_text())
n = info['aufloesung_px']
h = np.fromfile(src / 'heightmap_4km_2049px.r16', dtype='<u2').reshape(n, n)[::2, ::2]
m = info['hoehe_min_m'] + h.astype(np.float64) / 65535 * (info['hoehe_max_m'] - info['hoehe_min_m'])
dm = np.round(m * 10).astype(np.int32)                       # Dezimeter
delta = np.diff(dm, axis=1, prepend=0).astype('<i2')          # zeilenweise Differenzen komprimieren besser
hm = base64.b64encode(gzip.compress(delta.tobytes(), 9)).decode()
coords = json.loads((src / 'downhill_linie.geojson').read_text())['features'][0]['geometry']['coordinates']
trail = json.dumps([[round(c[0], 6), round(c[1], 6), c[2]] for c in coords], separators=(',', ':'))
html = (Path(__file__).parent / 'src' / 'game.html').read_text()
html = html.replace('__HM__', hm).replace('__TRAIL__', trail)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html)
print(out, len(html) // 1024, 'KB')
