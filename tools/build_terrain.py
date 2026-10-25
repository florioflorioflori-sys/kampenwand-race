"""Baut die Geländedaten für Kampenwand Race.

Lädt Höhendaten (AWS Terrain Tiles / Terrarium), schneidet den Bereich um die
Kampenwand aus, berechnet die Abfahrtsstrecke von der Bergstation zur Talstation
in Aschau, fräst den Trail ins Gelände und schreibt alles nach game/data/.

Aufruf:  python3 tools/build_terrain.py
Benötigt: numpy, pillow, scipy
"""
import heapq
import io
import json
import math
import os
import urllib.request
import zlib

import numpy as np
from PIL import Image
from scipy import ndimage

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "game", "data")
CACHE = os.path.join(ROOT, "tools", ".cache")

START = (47.756233, 12.354727)   # Bergstation Kampenwandbahn (ca. 1.460 m)
FINISH = (47.764254, 12.325544)  # Talstation Kampenwandbahn, Aschau (ca. 620 m)
ROUTE_GEOJSON = os.path.join(os.path.dirname(os.path.abspath(__file__)), "downhill_linie.geojson")
CENTER_LAT = 47.766

NEAR_CELL = 2.0      # m pro Zelle im Detailgelände
NEAR_MARGIN = 600.0  # m Rand um die Strecke
FAR_CELL = 8.0       # m pro Zelle im Ferngelände
FAR_SIZE = 16000.0   # m Kantenlänge Ferngelände
TRAIL_HALF_WIDTH = 1.6

TILE_URL = "https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png"


def lonlat_to_tile(lat, lon, z):
    n = 2 ** z
    x = (lon + 180.0) / 360.0 * n
    y = (1.0 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2.0 * n
    return x, y


def fetch_tile(z, x, y):
    os.makedirs(CACHE, exist_ok=True)
    path = os.path.join(CACHE, f"{z}_{x}_{y}.png")
    if not os.path.exists(path):
        data = urllib.request.urlopen(TILE_URL.format(z=z, x=x, y=y), timeout=60).read()
        with open(path, "wb") as f:
            f.write(data)
    a = np.asarray(Image.open(path).convert("RGB")).astype(np.float64)
    return a[..., 0] * 256.0 + a[..., 1] + a[..., 2] / 256.0 - 32768.0


class Mosaic:
    """Höhenmosaik in Web-Mercator-Pixeln einer Zoomstufe."""

    def __init__(self, z, lat0, lon0, lat1, lon1):
        self.z = z
        x0, y0 = lonlat_to_tile(lat0, lon0, z)
        x1, y1 = lonlat_to_tile(lat1, lon1, z)
        self.tx0, self.ty0 = int(min(x0, x1)), int(min(y0, y1))
        tx1, ty1 = int(max(x0, x1)), int(max(y0, y1))
        rows = []
        for ty in range(self.ty0, ty1 + 1):
            rows.append(np.hstack([fetch_tile(z, tx, ty) for tx in range(self.tx0, tx1 + 1)]))
        self.h = np.vstack(rows)
        # Meter pro Pixel (Mercator ist winkeltreu, also in x und y gleich)
        self.mpp = 40075016.686 / (2 ** z) / 256.0 * math.cos(math.radians(CENTER_LAT))

    def px(self, lat, lon):
        x, y = lonlat_to_tile(lat, lon, self.z)
        return (x - self.tx0) * 256.0, (y - self.ty0) * 256.0

    def sample(self, xs, ys):
        """Bikubisch interpolierte Höhe an Pixelkoordinaten."""
        return ndimage.map_coordinates(self.h, [ys, xs], order=3, mode="nearest")


def fbm(shape, cell, scales, seed):
    """Fraktales Rauschen: Summe aus geglätteten Zufallsfeldern (Amplitude, Wellenlänge)."""
    rng = np.random.default_rng(seed)
    out = np.zeros(shape)
    for amp, wavelength in scales:
        sigma = wavelength / cell / 2.0
        n = ndimage.gaussian_filter(rng.standard_normal(shape), sigma, mode="wrap")
        n /= n.std() + 1e-9
        out += amp * n
    return out


def find_route(m, start_px, finish_px, step=2):
    """Günstigster Abfahrtsweg: bergab bevorzugt, steile Hänge und Gegenanstiege teuer."""
    hs = m.h[::step, ::step]
    cell = m.mpp * step
    H, W = hs.shape
    s = (int(start_px[1] / step), int(start_px[0] / step))
    e = (int(finish_px[1] / step), int(finish_px[0] / step))
    dist = np.full((H, W), np.inf)
    prev = np.full((H, W, 2), -1, int)
    dist[s] = 0.0
    pq = [(0.0, s)]
    nbs = [(dy, dx) for dy in (-1, 0, 1) for dx in (-1, 0, 1) if dy or dx]
    while pq:
        d, (y, x) = heapq.heappop(pq)
        if (y, x) == e:
            break
        if d > dist[y, x]:
            continue
        for dy, dx in nbs:
            ny, nx = y + dy, x + dx
            if not (0 <= ny < H and 0 <= nx < W):
                continue
            ln = cell * math.hypot(dy, dx)
            g = (hs[y, x] - hs[ny, nx]) / ln  # positives Gefälle = bergab
            cost = ln * (1.0 + 300.0 * max(0.0, -g) + 400.0 * max(0.0, g - 0.30) ** 2 + 3.0 * max(0.0, 0.12 - g))
            nd = d + cost
            if nd < dist[ny, nx]:
                dist[ny, nx] = nd
                prev[ny, nx] = (y, x)
                heapq.heappush(pq, (nd, (ny, nx)))
    path = [e]
    while path[-1] != s:
        path.append(tuple(prev[path[-1]]))
    path = np.array(path[::-1], float) * step
    return path[:, ::-1]  # (x, y) in Pixeln


def smooth_polyline(p, iterations=4):
    """Chaikin-Glättung, Endpunkte bleiben erhalten."""
    for _ in range(iterations):
        q = [p[0]]
        for a, b in zip(p[:-1], p[1:]):
            q.append(0.75 * a + 0.25 * b)
            q.append(0.25 * a + 0.75 * b)
        q.append(p[-1])
        p = np.array(q)
    return p


def resample(p, spacing):
    seg = np.hypot(*np.diff(p, axis=0).T)
    t = np.concatenate([[0], np.cumsum(seg)])
    n = int(t[-1] / spacing) + 1
    ts = np.linspace(0, t[-1], n)
    return np.stack([np.interp(ts, t, p[:, 0]), np.interp(ts, t, p[:, 1])], 1)


def write_u16(path, h, hmin, hmax):
    q = np.clip(np.round((h - hmin) / (hmax - hmin) * 65535.0), 0, 65535).astype("<u2")
    with open(path, "wb") as f:
        f.write(zlib.compress(q.tobytes(), 9))


def main():
    os.makedirs(OUT, exist_ok=True)

    # ---- Detailbereich (Zoom 15, ca. 3,2 m/Pixel) ----
    pad = 0.03
    near = Mosaic(15, max(START[0], FINISH[0]) + pad, min(START[1], FINISH[1]) - pad,
                  min(START[0], FINISH[0]) - pad, max(START[1], FINISH[1]) + pad)
    sp, fp = near.px(*START), near.px(*FINISH)
    if os.path.exists(ROUTE_GEOJSON):
        # Streckenvorschlag aus der Geländeanalyse (lon, lat, z)
        with open(ROUTE_GEOJSON) as f:
            coords = json.load(f)["features"][0]["geometry"]["coordinates"]
        route_px = np.array([near.px(lat, lon) for lon, lat, _ in coords])
    else:
        route_px = find_route(near, sp, fp)
    route_px = resample(smooth_polyline(route_px), 2.0 / near.mpp)

    # Weltkoordinaten: x = Osten, z = Süden, Ursprung = linke obere Ecke des Detailgeländes
    rmin = route_px.min(0) - NEAR_MARGIN / near.mpp
    rmax = route_px.max(0) + NEAR_MARGIN / near.mpp
    nx = int((rmax[0] - rmin[0]) * near.mpp / NEAR_CELL) + 1
    nz = int((rmax[1] - rmin[1]) * near.mpp / NEAR_CELL) + 1
    gx = rmin[0] + np.arange(nx) * NEAR_CELL / near.mpp
    gz = rmin[1] + np.arange(nz) * NEAR_CELL / near.mpp
    GX, GZ = np.meshgrid(gx, gz)
    h = near.sample(GX.ravel(), GZ.ravel()).reshape(nz, nx)
    # Rasterartefakte der Quelldaten wegglätten, dann natürliche Unebenheiten hinzufügen
    h = ndimage.gaussian_filter(h, 4.0)
    h += fbm(h.shape, NEAR_CELL, [(2.5, 120.0), (0.9, 30.0), (0.25, 8.0)], seed=1)

    route = (route_px - rmin) * near.mpp  # Meter
    route = resample(route, 2.0)

    # Trail-Höhenprofil: geglättete Geländehöhe entlang der Strecke
    ri = np.clip((route[:, 1] / NEAR_CELL), 0, nz - 1)
    rj = np.clip((route[:, 0] / NEAR_CELL), 0, nx - 1)
    rh = ndimage.map_coordinates(h, [ri, rj], order=1)
    rh = ndimage.gaussian_filter1d(rh, 6.0, mode="nearest")
    # kleine Wellen im Trail (Roller) für Fahrgefühl
    s = np.arange(len(rh)) * 2.0
    rh += 0.35 * np.sin(s / 9.0) * np.sin(s / 37.0)

    # Distanzfeld zur Strecke + Höhe des nächsten Streckenpunkts
    mask = np.ones((nz, nx), bool)
    fine = resample(route, 0.5)
    ii = np.clip(np.round(fine[:, 1] / NEAR_CELL).astype(int), 0, nz - 1)
    jj = np.clip(np.round(fine[:, 0] / NEAR_CELL).astype(int), 0, nx - 1)
    mask[ii, jj] = False
    _, (ni, nj) = ndimage.distance_transform_edt(mask, return_indices=True)
    # Index des Streckenpunkts je markierter Zelle, dann exakter Abstand zu den Nachbarpunkten
    k_grid = np.zeros((nz, nx), int)
    k_grid[ii, jj] = np.arange(len(fine))
    k0 = k_grid[ni, nj]
    gxm = np.arange(nx)[None, :] * NEAR_CELL
    gzm = np.arange(nz)[:, None] * NEAR_CELL
    d = np.full((nz, nx), np.inf)
    kbest = k0.copy()
    for o in range(-6, 7):
        k = np.clip(k0 + o, 0, len(fine) - 1)
        dd = np.hypot(gxm - fine[k, 0], gzm - fine[k, 1])
        better = dd < d
        d[better] = dd[better]
        kbest[better] = k[better]
    fine_h = np.interp(np.linspace(0, len(rh) - 1, len(fine)), np.arange(len(rh)), rh)
    th = fine_h[kbest]
    w = np.clip((d - TRAIL_HALF_WIDTH) / 7.0, 0.0, 1.0)
    w = w * w * (3 - 2 * w)
    h = th * (1 - w) + h * w

    # ---- Ferngelände (Zoom 13) ----
    lat_c = (START[0] + FINISH[0]) / 2
    lon_c = (START[1] + FINISH[1]) / 2
    dlat = FAR_SIZE / 2 / 111320.0 * 1.1
    dlon = FAR_SIZE / 2 / (111320.0 * math.cos(math.radians(lat_c))) * 1.1
    far = Mosaic(13, lat_c + dlat, lon_c - dlon, lat_c - dlat, lon_c + dlon)
    # Ursprung des Detailgeländes in Fern-Pixeln
    def near_px_to_far_px(px, py):
        lon = (near.tx0 + px / 256.0) / 2 ** 15 * 360.0 - 180.0
        lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (near.ty0 + py / 256.0) / 2 ** 15))))
        return far.px(lat, lon)
    ox, oy = near_px_to_far_px(rmin[0], rmin[1])
    fn = int(FAR_SIZE / FAR_CELL) + 1
    near_w, near_h = (nx - 1) * NEAR_CELL, (nz - 1) * NEAR_CELL
    far_origin = (near_w / 2 - FAR_SIZE / 2, near_h / 2 - FAR_SIZE / 2)
    fx = ox + (far_origin[0] + np.arange(fn) * FAR_CELL) / far.mpp
    fz = oy + (far_origin[1] + np.arange(fn) * FAR_CELL) / far.mpp
    FX, FZ = np.meshgrid(fx, fz)
    fh = far.sample(FX.ravel(), FZ.ravel()).reshape(fn, fn)
    fh = ndimage.gaussian_filter(fh, 1.5)
    fh += fbm(fh.shape, FAR_CELL, [(4.0, 300.0), (1.5, 60.0)], seed=2)
    # Fernbereich unter dem Detailgelände an Detailhöhen angleichen (nahtloser Übergang)
    hmin = float(min(h.min(), fh.min())) - 5
    hmax = float(max(h.max(), fh.max())) + 5

    write_u16(os.path.join(OUT, "near_height.bin"), h, hmin, hmax)
    write_u16(os.path.join(OUT, "far_height.bin"), fh, hmin, hmax)
    trail = np.clip(np.round(d / 0.25), 0, 255).astype(np.uint8)  # 0,25 m pro Stufe
    with open(os.path.join(OUT, "near_trail.bin"), "wb") as f:
        f.write(zlib.compress(trail.tobytes(), 9))

    route3 = [[round(float(x), 2), round(float(y), 2), round(float(z), 2)] for (x, z), y in zip(route, rh)]
    meta = {
        "source": "AWS Terrain Tiles (Terrarium), Zoom 15/13",
        "height_min": hmin,
        "height_max": hmax,
        "near": {"width": nx, "height": nz, "cell": NEAR_CELL, "origin": [0.0, 0.0]},
        "far": {"width": fn, "height": fn, "cell": FAR_CELL, "origin": list(far_origin)},
        "trail_unit": 0.25,
        "start_latlon": START,
        "finish_latlon": FINISH,
        "route": route3,
    }
    with open(os.path.join(OUT, "terrain.json"), "w") as f:
        json.dump(meta, f, indent=1)
    length = float(np.sum(np.hypot(*np.diff(route, axis=0).T)))
    print(f"Detail {nx}x{nz} ({near_w:.0f} m x {near_h:.0f} m), Fern {fn}x{fn}")
    print(f"Strecke {length:.0f} m, Start {rh[0]:.0f} m, Ziel {rh[-1]:.0f} m, Höhen {hmin:.0f}..{hmax:.0f}")


if __name__ == "__main__":
    main()
