#!/usr/bin/env python3
"""
Bereitet die Kampenwand-Geodaten fuer Unreal Engine 5 auf.

Eingabe  (Ordner --src, Standard: ../geodata):
  heightmap_4km_2049px.r16, heightmap_info.json, downhill_linie.geojson
Ausgabe  (KampenwandRace/Content/KampenwandData/ und KampenwandRace/RawData/):
  RawData/Kampenwand_Heightmap_2017.png   16-bit Heightmap fuer den Landscape-Import
  Content/KampenwandData/world.json        Strecke, Spruenge, Gondelbahn, Baeume, Zuschauer

Koordinaten in UE (cm, linkshaendig): X = Osten, Y = Sueden, Z = oben,
Z = 0 entspricht 600 m ue. NN, Ursprung = Mitte der 4x4-km-Kachel.
Nur numpy + Pillow noetig.
"""
import argparse, json, math, os
import numpy as np
from PIL import Image

UE_SIZE = 2017            # empfohlene UE-Landscape-Groesse (16x16 Komponenten, 2x2 Sections, 63 Quads)
Z_REF_M = 600.0           # Hoehe, die in UE bei Z = 0 liegt
TRAIL_HALF_WIDTH_M = 2.2  # halbe Trailbreite, die ins Gelaende eingearbeitet wird
SEED = 1669               # Gipfelhoehe der Kampenwand :)

ap = argparse.ArgumentParser()
here = os.path.dirname(os.path.abspath(__file__))
ap.add_argument('--src', default=os.path.join(here, '..', 'geodata'))
ap.add_argument('--out', default=os.path.join(here, '..', 'KampenwandRace'))
args = ap.parse_args()

info = json.load(open(os.path.join(args.src, 'heightmap_info.json')))
N0 = info['aufloesung_px']
SIZE_M = float(info['groesse_m'])
HMIN, HMAX = info['hoehe_min_m'], info['hoehe_max_m']
LAT0, LON0 = info['zentrum_lat'], info['zentrum_lon']

raw = np.fromfile(os.path.join(args.src, 'heightmap_4km_2049px.r16'), dtype='<u2').reshape(N0, N0)
H0 = HMIN + raw.astype(np.float64) / 65535.0 * (HMAX - HMIN)   # Meter, Zeile 0 = Norden

# ---------- auf 2017 x 2017 umtasten (bilinear) ----------
def resample(img, n):
    m = img.shape[0]
    t = np.linspace(0, m - 1, n)
    i0 = np.clip(np.floor(t).astype(int), 0, m - 2); f = t - i0
    rows = img[i0] * (1 - f)[:, None] + img[i0 + 1] * f[:, None]
    return rows[:, i0] * (1 - f)[None, :] + rows[:, i0 + 1] * f[None, :]

H = resample(H0, UE_SIZE)
MPP = SIZE_M / (UE_SIZE - 1)   # Meter pro Pixel

def ll_to_local(lon, lat):
    """lon/lat -> Meter (x Osten, y Sueden) relativ zur Kachelmitte"""
    x = (lon - LON0) * math.cos(math.radians(LAT0)) * 111320.0
    y = -(lat - LAT0) * 110574.0
    return x, y

def to_px(x, y):
    return (x + SIZE_M / 2) / MPP, (y + SIZE_M / 2) / MPP   # (col, row)

def sample(Hm, x, y):
    c, r = to_px(x, y)
    c = min(max(c, 0), UE_SIZE - 1.001); r = min(max(r, 0), UE_SIZE - 1.001)
    c0, r0 = int(c), int(r); fc, fr = c - c0, r - r0
    return (Hm[r0, c0] * (1 - fc) * (1 - fr) + Hm[r0, c0 + 1] * fc * (1 - fr)
            + Hm[r0 + 1, c0] * (1 - fc) * fr + Hm[r0 + 1, c0 + 1] * fc * fr)

# ---------- Strecke ----------
gj = json.load(open(os.path.join(args.src, 'downhill_linie.geojson')))
coords = gj['features'][0]['geometry']['coordinates']
pts = np.array([ll_to_local(c[0], c[1]) for c in coords])

# gleichmaessig alle 4 m neu abtasten und leicht glaetten (Catmull-artiger Mittelwert)
seg = np.linalg.norm(np.diff(pts, axis=0), axis=1)
s = np.concatenate([[0], np.cumsum(seg)])
L = s[-1]
ss = np.arange(0, L, 4.0); ss = np.append(ss, L)
tx = np.interp(ss, s, pts[:, 0]); ty = np.interp(ss, s, pts[:, 1])
for _ in range(3):   # Ecken etwas runden, Start/Ziel festhalten
    tx[1:-1] = 0.25 * tx[:-2] + 0.5 * tx[1:-1] + 0.25 * tx[2:]
    ty[1:-1] = 0.25 * ty[:-2] + 0.5 * ty[1:-1] + 0.25 * ty[2:]
tz = np.array([sample(H, x, y) for x, y in zip(tx, ty)])
# Trail-Hoehe glaetten (gleitendes Mittel ueber ~24 m), damit keine DEM-Stufen entstehen
k = 7
tz_s = np.convolve(np.pad(tz, k, mode='edge'), np.ones(2 * k + 1) / (2 * k + 1), mode='same')[k:-k]

# ---------- Trail ins Gelaende einarbeiten ----------
rows, cols = np.mgrid[0:UE_SIZE, 0:UE_SIZE]
best_d = np.full(H.shape, 1e9); best_z = np.zeros(H.shape)
for i in range(len(tx) - 1):
    ax_, ay_, bx_, by_ = tx[i], ty[i], tx[i + 1], ty[i + 1]
    c0, r0 = to_px(min(ax_, bx_) - 12, min(ay_, by_) - 12)
    c1, r1 = to_px(max(ax_, bx_) + 12, max(ay_, by_) + 12)
    c0, r0 = max(int(c0), 0), max(int(r0), 0); c1, r1 = min(int(c1) + 2, UE_SIZE), min(int(r1) + 2, UE_SIZE)
    px = cols[r0:r1, c0:c1] * MPP - SIZE_M / 2; py = rows[r0:r1, c0:c1] * MPP - SIZE_M / 2
    dx, dy = bx_ - ax_, by_ - ay_; ll = dx * dx + dy * dy + 1e-9
    t = np.clip(((px - ax_) * dx + (py - ay_) * dy) / ll, 0, 1)
    d = np.hypot(px - (ax_ + t * dx), py - (ay_ + t * dy))
    z = tz_s[i] * (1 - t) + tz_s[i + 1] * t
    bd = best_d[r0:r1, c0:c1]; m = d < bd
    bd[m] = d[m]; best_z[r0:r1, c0:c1][m] = z[m]
w = np.clip(1 - (best_d - TRAIL_HALF_WIDTH_M) / 6.0, 0, 1)  # volle Wirkung im Trail, 6 m Uebergang
w = w * w * (3 - 2 * w)
H = H * (1 - w) + best_z * w

# ---------- Heightmap schreiben ----------
hmin, hmax = float(H.min()), float(H.max())
h16 = np.round((H - hmin) / (hmax - hmin) * 65535).astype(np.uint16)
os.makedirs(os.path.join(args.out, 'RawData'), exist_ok=True)
Image.fromarray(h16).save(os.path.join(args.out, 'RawData', 'Kampenwand_Heightmap_2017.png'))
# Trail-Maske fuer das Gelaende-Material (weiss = Erdtrail), gleiche Ausrichtung wie die Heightmap
mask = np.clip(1 - (best_d - 1.6) / 1.4, 0, 1)
Image.fromarray((mask * 255).astype(np.uint8)).save(os.path.join(args.out, 'RawData', 'Kampenwand_TrailMask_2017.png'))
# Hoehe, wie die Landscape sie nach dem Import wirklich hat (quantisiert)
Hq = hmin + h16.astype(np.float64) / 65535 * (hmax - hmin)

scale_xy = SIZE_M * 100 / (UE_SIZE - 1)
scale_z = (hmax - hmin) * 100 * 128 / 65535
loc_z = (hmin - Z_REF_M) * 100 + 32768 * scale_z / 128
landscape = dict(size_px=UE_SIZE, location_cm=[-SIZE_M * 50, -SIZE_M * 50, round(loc_z, 2)],
                 scale=[round(scale_xy, 4), round(scale_xy, 4), round(scale_z, 4)],
                 hmin_m=round(hmin, 2), hmax_m=round(hmax, 2), z_ref_m=Z_REF_M)

def ue(x, y, zm):
    return [round(x * 100, 1), round(y * 100, 1), round((zm - Z_REF_M) * 100, 1)]

track = [ue(x, y, sample(Hq, x, y) + 0.05) for x, y in zip(tx, ty)]

# ---------- Spruenge (Kicker) ----------
# auf flacheren Stuecken mit Auslauf; Abstand >= 220 m, nicht in den ersten/letzten 120 m
slope = -np.gradient(tz_s, ss)
jumps, last = [], -1e9
for i in range(len(ss)):
    if ss[i] < 120 or ss[i] > L - 160 or ss[i] - last < 220: continue
    if 0.08 < slope[i] < 0.30:
        j = i + 1
        hd = math.atan2(ty[min(j, len(ty) - 1)] - ty[i - 1], tx[min(j, len(tx) - 1)] - tx[i - 1])
        jumps.append(dict(pos=track[i], yaw_deg=round(math.degrees(hd), 2), dist_m=round(float(ss[i]), 1),
                          height_cm=round(80 + 50 * ((i * 7919) % 3) / 2, 1)))
        last = ss[i]

# ---------- Gondelbahn ----------
# Stationen etwas neben Start/Ziel; Stuetzen werden so gesetzt, dass das durchhaengende Seil
# ueberall mindestens CLEAR_M ueber dem Gelaende bleibt (vorher fuhren die Gondeln in die Wand).
CLEAR_M, SAG_RATIO = 12.0, 0.035
bx, by = tx[0] - 25, ty[0] - 30          # Bergstation (noerdlich/westlich vom Start)
vx, vy = tx[-1] + 40, ty[-1] + 35        # Talstation
def ground(x, y): return sample(Hq, x, y)
stations = [(bx, by, ground(bx, by) + 9.0), (vx, vy, ground(vx, vy) + 7.0)]

def cable_z(a, b, t):
    span = math.hypot(b[0] - a[0], b[1] - a[1])
    return a[2] + (b[2] - a[2]) * t - 4 * SAG_RATIO * span * t * (1 - t)

def solve(a, b, depth=0):
    span = math.hypot(b[0] - a[0], b[1] - a[1])
    n = max(int(span / 4), 2); worst, wt = 0.0, None
    for i in range(1, n):
        t = i / n; x = a[0] + (b[0] - a[0]) * t; y = a[1] + (b[1] - a[1]) * t
        pen = ground(x, y) + CLEAR_M - cable_z(a, b, t)
        if pen > worst: worst, wt = pen, t
    if wt is None or depth > 12: return [a, b]
    x = a[0] + (b[0] - a[0]) * wt; y = a[1] + (b[1] - a[1]) * wt
    tower = (x, y, max(ground(x, y) + 18.0, cable_z(a, b, wt) + worst + 2.0))
    return solve(a, tower, depth + 1)[:-1] + solve(tower, b, depth + 1)

line = solve(stations[0], stations[1])
# Kontrolle
minclear = 1e9
for a, b in zip(line[:-1], line[1:]):
    for i in range(1, 100):
        t = i / 100; x = a[0] + (b[0] - a[0]) * t; y = a[1] + (b[1] - a[1]) * t
        if min(math.hypot(x - st[0], y - st[1]) for st in stations) < 40: continue  # Stationseinfahrt
        minclear = min(minclear, cable_z(a, b, t) - ground(x, y))
gondola = dict(sag_ratio=SAG_RATIO, clearance_min_m=round(minclear, 2),
               supports=[dict(pos=ue(p[0], p[1], ground(p[0], p[1])), cable_z_cm=round((p[2] - Z_REF_M) * 100, 1))
                         for p in line])

# ---------- Baeume ----------
rng = np.random.default_rng(SEED)
gy, gx = np.gradient(Hq, MPP)
slope_deg = np.degrees(np.arctan(np.hypot(gx, gy)))
cand = rng.uniform(-SIZE_M / 2 + 5, SIZE_M / 2 - 5, size=(220000, 2))
trees = []
track_xy = np.stack([tx, ty], 1)
gond_xy = [(p[0], p[1]) for p in line]
def dist_polyline(px_, py_, poly):
    best = 1e9
    for (ax_, ay_), (bx_, by_) in zip(poly[:-1], poly[1:]):
        dx, dy = bx_ - ax_, by_ - ay_; t = max(0, min(1, ((px_ - ax_) * dx + (py_ - ay_) * dy) / (dx * dx + dy * dy + 1e-9)))
        best = min(best, math.hypot(px_ - ax_ - t * dx, py_ - ay_ - t * dy))
    return best
dist_track = best_d   # Abstand jedes Pixels zur Streckenmitte (m)
for x, y in cand:
    c, r = to_px(x, y); c, r = int(c), int(r)
    z = Hq[r, c]; sl = slope_deg[r, c]
    if z > 1560 or sl > 42: continue
    if dist_track[r, c] < 7.0: continue
    # Waldgrenze ausfransen, Lichtungen per Wertrauschen
    p = 1.0 if z < 1350 else max(0.0, (1560 - z) / 210)
    p *= 0.35 + 0.65 * (0.5 + 0.5 * math.sin(x * 0.011 + math.sin(y * 0.007) * 2.3) * math.cos(y * 0.013 - x * 0.004))
    if sl > 32: p *= 0.4
    if rng.random() > p: continue
    if dist_polyline(x, y, gond_xy) < 9: continue
    kind = 0 if (z > 1150 or rng.random() < 0.7) else 1   # 0 Fichte, 1 Buche
    trees.append([round(x * 100), round(y * 100), round((z - Z_REF_M) * 100 - 20), kind,
                  round(float(rng.uniform(0.75, 1.35)), 2), round(float(rng.uniform(0, 360)))])
    if len(trees) >= 45000: break

# ---------- Zuschauer ----------
spect = []
for i in range(0, len(tx), 3):
    d = ss[i]
    dens = 1.0 if d < 150 or d > L - 250 else (0.35 if (int(d) // 300) % 2 == 0 else 0.08)
    for side in (-1, 1):
        if rng.random() > dens: continue
        j = min(i + 1, len(tx) - 1); h = max(i - 1, 0)
        nx, ny = -(ty[j] - ty[h]), tx[j] - tx[h]; nl = math.hypot(nx, ny) + 1e-9
        off = side * rng.uniform(3.6, 6.0)
        x, y = tx[i] + nx / nl * off, ty[i] + ny / nl * off
        spect.append(ue(x, y, sample(Hq, x, y)) + [round(math.degrees(math.atan2(-ny * side, -nx * side)), 1)])

world = dict(
    note='Generiert von Tools/prepare_ue_data.py - nicht von Hand bearbeiten',
    source=info.get('quelle'), landscape=landscape,
    track=dict(length_m=round(float(L), 1), points=track),
    jumps=jumps, gondola=gondola, trees=trees, spectators=spect)
os.makedirs(os.path.join(args.out, 'Content', 'KampenwandData'), exist_ok=True)
json.dump(world, open(os.path.join(args.out, 'Content', 'KampenwandData', 'world.json'), 'w'), separators=(',', ':'))
print(json.dumps(landscape, indent=1))
print('Strecke %.0f m, %d Punkte, %d Spruenge, %d Baeume, %d Zuschauer' % (L, len(track), len(jumps), len(trees), len(spect)))
print('Gondelbahn: %d Stuetzpunkte, minimaler Seilabstand zum Gelaende %.1f m' % (len(line), minclear))
