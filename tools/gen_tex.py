# Erzeugt kachelbare Oberflächen-Texturen (Albedo mit Höhe in Alpha + Normal) für Strecke, Wiese, Fels, Waldboden
import numpy as np, sys
from PIL import Image
from scipy import ndimage
OUT = sys.argv[1]
rng = np.random.default_rng(7)

def spec_noise(n, beta, seed, fmin=1.0):
    r = np.random.default_rng(seed)
    w = r.standard_normal((n, n))
    F = np.fft.fft2(w)
    fx = np.fft.fftfreq(n) * n
    f = np.sqrt(fx[None, :] ** 2 + fx[:, None] ** 2)
    f[0, 0] = 1
    amp = 1.0 / np.maximum(f, fmin) ** beta
    amp[0, 0] = 0
    out = np.real(np.fft.ifft2(F * amp))
    out = (out - out.mean()) / (out.std() + 1e-9)
    return out.astype(np.float32)

def band(n, f0, f1, seed):
    r = np.random.default_rng(seed)
    F = np.fft.fft2(r.standard_normal((n, n)))
    fx = np.fft.fftfreq(n) * n
    f = np.sqrt(fx[None, :] ** 2 + fx[:, None] ** 2)
    m = ((f >= f0) & (f < f1)).astype(np.float32)
    out = np.real(np.fft.ifft2(F * m))
    return ((out - out.mean()) / (out.std() + 1e-9)).astype(np.float32)

def wrap_blur(a, s):
    return ndimage.gaussian_filter(a, s, mode='wrap')

def normal_from_h(h, strength):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * 0.5 * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * 0.5 * strength
    nz = np.ones_like(h)
    l = np.sqrt(dx * dx + dy * dy + 1)
    # OpenGL-Konvention: +Y nach oben in UV
    return np.stack([-dx / l, dy / l, nz / l], -1)

def cavity(h, s):
    return h - wrap_blur(h, s)

def ao(h, scales=(2, 6, 16), k=1.0):
    a = np.zeros_like(h)
    for s in scales:
        a += np.clip(wrap_blur(h, s) - h, 0, None)
    return np.clip(1 - a * k, 0, 1)

def save(name, alb, hgt, nrm):
    alb = np.clip(alb, 0, 1) ** (1 / 2.2)
    hh = (hgt - hgt.min()) / (hgt.max() - hgt.min() + 1e-9)
    rgba = np.concatenate([alb, hh[..., None]], -1)
    Image.fromarray((rgba * 255 + 0.5).astype(np.uint8), 'RGBA').save(f'{OUT}/{name}_c.webp', quality=88, method=6)
    Image.fromarray(((nrm * 0.5 + 0.5) * 255 + 0.5).astype(np.uint8), 'RGB').save(f'{OUT}/{name}_n.webp', quality=90, method=6)
    Image.fromarray((np.clip(alb, 0, 1) * 255).astype(np.uint8)).resize((512, 512)).save(f'{OUT}/{name}_preview.png')
    print(name, 'ok')

def stamp_stones(n, count, rmin, rmax, seed, h, col, palette, flat=0.55, emb=0.3):
    r = np.random.default_rng(seed)
    ids = np.zeros((n, n), np.int32) - 1
    for i in range(count):
        cx, cy = r.uniform(0, n, 2)
        rad = rmin * (rmax / rmin) ** (r.random() ** 1.7)
        ax, ay = rad * r.uniform(0.7, 1.25), rad * r.uniform(0.6, 1.0)
        th = r.uniform(0, np.pi)
        R = int(max(ax, ay) * 1.3) + 2
        xs = np.arange(int(cx) - R, int(cx) + R + 1); ys = np.arange(int(cy) - R, int(cy) + R + 1)
        X, Y = np.meshgrid(xs - cx, ys - cy)
        c, s = np.cos(th), np.sin(th)
        u = (X * c + Y * s) / ax; v = (-X * s + Y * c) / ay
        # unregelmäßiger Umriss
        ang = np.arctan2(v, u)
        wob = 1 + 0.12 * np.sin(ang * 3 + r.uniform(0, 6)) + 0.07 * np.sin(ang * 5 + r.uniform(0, 6))
        d = np.sqrt(u * u + v * v) / wob
        m = d < 1
        dome = np.sqrt(np.clip(1 - d * d, 0, 1)) ** flat * rad * 0.55 - emb * rad * 0.55
        yi = (ys % n)[:, None].repeat(len(xs), 1); xi = (xs % n)[None, :].repeat(len(ys), 0)
        cur = h[yi, xi]
        upd = m & (dome > cur)
        h[yi[upd], xi[upd]] = dome[upd]
        pc = palette[r.integers(len(palette))] * r.uniform(0.8, 1.15)
        ids[yi[upd], xi[upd]] = i
        col[yi[upd], xi[upd]] = pc
    return ids

# ------------------------------------------------------------------ Strecke: festgefahrene Erde, Kies, Steine
def trail(n=2048):
    h = spec_noise(n, 1.6, 1) * 1.2 + spec_noise(n, 1.0, 2) * 0.12
    h = h * 1.0
    col = np.zeros((n, n, 3), np.float32)
    earth1 = np.array([0.20, 0.135, 0.075]); earth2 = np.array([0.32, 0.235, 0.145]); earth3 = np.array([0.14, 0.10, 0.06])
    t = np.clip(spec_noise(n, 1.4, 3) * 0.35 + 0.5, 0, 1)[..., None]
    base = earth1 * (1 - t) + earth2 * t
    dark = np.clip(spec_noise(n, 1.8, 4) * 0.5, 0, 1)[..., None]
    base = base * (1 - dark * 0.4) + earth3 * dark * 0.4
    grain = spec_noise(n, 0.6, 5)[..., None]
    base = base * (1 + grain * 0.08)
    hs = np.full((n, n), -1e9, np.float32)
    scol = np.zeros((n, n, 3), np.float32)
    pal = [np.array(p) for p in ([0.38, 0.35, 0.31], [0.44, 0.41, 0.36], [0.30, 0.27, 0.24], [0.42, 0.37, 0.30], [0.50, 0.48, 0.44], [0.34, 0.28, 0.22])]
    pal = [p * 0.72 for p in pal]
    # Kies (viele kleine) und Steine (wenige große), dichter in Streifen
    stamp_stones(n, 4200, 2.5, 8, 11, hs, scol, pal, flat=0.7, emb=0.45)
    stamp_stones(n, 220, 10, 30, 12, hs, scol, pal, flat=0.5, emb=0.5)
    stone = hs > -1e8
    hs2 = np.where(stone, hs, 0)
    sh = spec_noise(n, 1.2, 13)
    hh = h * 4 + np.where(stone, hs2 * 0.6 + sh * 0.5, 0)
    hh = np.maximum(hh, h * 4)
    # Steinoberfläche: feine Körnung, Erdreste in Vertiefungen
    sgrain = band(n, 200, 700, 14)[..., None]
    scol2 = scol * (1 + sgrain * 0.12)
    dirtOnStone = np.clip(0.75 - (hs2 / (hs2.max() + 1e-6)) * 2.2 + spec_noise(n, 1.5, 15) * 0.35, 0, 1)[..., None]
    scol2 = scol2 * (1 - dirtOnStone * 0.6) + base * dirtOnStone * 0.6
    alb = np.where(stone[..., None], scol2, base)
    a = ao(hh, (2, 5, 12), 0.09)
    cav = np.clip(cavity(hh, 3) * 0.08 + 1, 0.6, 1.25)
    alb = alb * a[..., None] * cav[..., None]
    nrm = normal_from_h(hh, 1.6)
    save('trail', alb, hh, nrm)

# ------------------------------------------------------------------ Almwiese: Halme, Klee, Streu, etwas Erde
def meadow(n=1024):
    r = np.random.default_rng(21)
    img = np.zeros((n, n, 3), np.float32)
    soil = np.array([0.11, 0.09, 0.05])
    img[:] = soil
    img *= (1 + spec_noise(n, 1.5, 22)[..., None] * 0.2)
    h = np.zeros((n, n), np.float32)
    greens = [np.array(c) for c in ([0.10, 0.17, 0.04], [0.14, 0.22, 0.05], [0.18, 0.25, 0.06], [0.08, 0.13, 0.035], [0.24, 0.26, 0.08], [0.33, 0.28, 0.12], [0.40, 0.34, 0.16])]
    wts = np.array([3, 4, 3, 2, 1.5, 1.0, 0.6]); wts /= wts.sum()
    patch = spec_noise(n, 1.7, 23)
    N = 60000
    for i in range(N):
        x, y = r.uniform(0, n, 2)
        L = r.uniform(6, 22); a = r.uniform(0, np.pi * 2)
        k = r.choice(len(greens), p=wts)
        c = greens[k] * r.uniform(0.75, 1.2)
        if patch[int(y), int(x)] > 0.8 and r.random() < 0.6: c = greens[5] * r.uniform(0.8, 1.2)
        steps = int(L)
        for sidx in range(steps):
            t = sidx / max(1, steps - 1)
            px = int(x + np.cos(a) * L * t + np.sin(a) * t * t * 3) % n
            py = int(y + np.sin(a) * L * t - np.cos(a) * t * t * 3) % n
            shade = 0.55 + 0.6 * t
            img[py, px] = c * shade
            h[py, px] = max(h[py, px], t * 2 + 0.3)
    # Klee-Blätter
    for i in range(1500):
        x, y = r.integers(0, n, 2); rad = r.uniform(2, 4)
        c = np.array([0.12, 0.24, 0.06]) * r.uniform(0.8, 1.2)
        for j in range(3):
            aa = j * 2.09 + r.uniform(0, 0.4)
            cx, cy = x + np.cos(aa) * rad, y + np.sin(aa) * rad
            R = int(rad) + 1
            for dy in range(-R, R + 1):
                for dx in range(-R, R + 1):
                    if dx * dx + dy * dy <= rad * rad * 0.8:
                        img[int(cy + dy) % n, int(cx + dx) % n] = c * (0.85 + 0.25 * (dy < 0)); h[int(cy + dy) % n, int(cx + dx) % n] = 1.2
    img = img * (1 + band(n, 100, 400, 24)[..., None] * 0.06)
    hb = wrap_blur(h, 1.0)
    a = ao(hb, (2, 6), 0.35)
    img *= a[..., None]
    save('meadow', img, hb, normal_from_h(hb, 1.5))

# ------------------------------------------------------------------ Kalkfels: Schichten, Klüfte, Flechten
def rock(n=2048):
    h = spec_noise(n, 2.0, 31) * 3 + spec_noise(n, 1.4, 32) * 0.6
    # Klüfte über Voronoi-Kanten
    r = np.random.default_rng(33)
    pts = r.uniform(0, n, (45, 2))
    yy, xx = np.mgrid[0:n, 0:n].astype(np.float32)
    xx0, yy0 = xx.copy(), yy.copy()
    xx = xx + spec_noise(n, 1.9, 61) * 55; yy = yy + spec_noise(n, 1.9, 62) * 55
    d1 = np.full((n, n), 1e9, np.float32); d2 = np.full((n, n), 1e9, np.float32)
    for p in pts:
        for ox in (-n, 0, n):
            for oy in (-n, 0, n):
                if abs(p[0] + ox - n / 2) > n * 0.85 or abs(p[1] + oy - n / 2) > n * 0.85: continue
                d = np.sqrt((xx - p[0] - ox) ** 2 + (yy - p[1] - oy) ** 2)
                m = d < d1
                d2 = np.where(m, d1, np.minimum(d2, d)); d1 = np.where(m, d, d1)
    edge = d2 - d1
    crack = np.exp(-(edge / (2.0 + 4.0 * np.clip(spec_noise(n, 1.7, 63) * 0.5 + 0.5, 0, 1))) ** 2) * np.clip(spec_noise(n, 1.5, 34) * 0.8 + 0.4, 0, 1)
    # Schichtung schräg
    strata = np.sin((yy0 * 0.9 + xx0 * 0.25) / n * np.pi * 2 * 14 + spec_noise(n, 1.8, 35) * 2.5)
    h = h + strata * 0.25 - crack * 2.2 + band(n, 120, 500, 36) * 0.18
    base = np.array([0.66, 0.64, 0.59])
    var = spec_noise(n, 1.6, 37)[..., None]
    alb = base * (1 + var * 0.14) * (1 + spec_noise(n, 2.2, 64)[..., None] * 0.1)
    alb = alb * (1 + (strata[..., None] * 0.07))
    # Verwitterung: dunkle Streifen (Regenablauf) nach unten
    streak = wrap_blur(np.clip(spec_noise(n, 1.2, 38), 0, None), (40, 2))[..., None]
    alb = alb * (1 - np.clip(streak, 0, 1) * 0.35) + np.array([0.18, 0.17, 0.15]) * np.clip(streak, 0, 1) * 0.2
    # Flechten: gelbgrüne und graue Flecken
    lich = np.clip(spec_noise(n, 1.3, 39) * 1.2 - 1.0, 0, 1)[..., None]
    lich2 = np.clip(spec_noise(n, 1.1, 40) * 1.3 - 1.4, 0, 1)[..., None]
    alb = alb * (1 - lich * 0.7) + np.array([0.42, 0.44, 0.24]) * lich * 0.7
    alb = alb * (1 - lich2 * 0.8) + np.array([0.20, 0.21, 0.19]) * lich2 * 0.8
    alb = alb * (1 - crack[..., None] * 0.65)
    a = ao(h, (3, 10, 30), 0.12)
    alb = alb * a[..., None]
    save('rock', alb, h, normal_from_h(h, 1.4))

# ------------------------------------------------------------------ Waldboden: Nadeln, Laub, Moos, Zweige
def forest(n=1024):
    r = np.random.default_rng(51)
    img = np.zeros((n, n, 3), np.float32)
    img[:] = np.array([0.10, 0.065, 0.035])
    img *= (1 + spec_noise(n, 1.5, 52)[..., None] * 0.25)
    h = spec_noise(n, 1.8, 53) * 0.5
    moss = np.clip(spec_noise(n, 1.6, 54) * 0.6 - 0.45 + spec_noise(n, 0.9, 57) * 0.25, 0, 1)
    # Nadeln
    for i in range(45000):
        x, y = r.uniform(0, n, 2); L = r.uniform(5, 12); a = r.uniform(0, np.pi * 2)
        c = np.array([0.36, 0.20, 0.09]) * r.uniform(0.5, 1.2) if r.random() < 0.8 else np.array([0.20, 0.13, 0.07])
        for sidx in range(int(L)):
            px = int(x + np.cos(a) * sidx) % n; py = int(y + np.sin(a) * sidx) % n
            img[py, px] = c; h[py, px] += 0.15
    # Laubblätter (Buche, Ahorn) als Ellipsen
    lcols = [np.array(c) for c in ([0.55, 0.28, 0.07], [0.45, 0.20, 0.06], [0.62, 0.38, 0.10], [0.35, 0.16, 0.06], [0.50, 0.33, 0.12])]
    for i in range(2600):
        cx, cy = r.uniform(0, n, 2); ax = r.uniform(5, 11); ay = ax * r.uniform(0.45, 0.65); th = r.uniform(0, np.pi)
        c = lcols[r.integers(len(lcols))] * r.uniform(0.75, 1.15)
        R = int(ax) + 2
        ys = np.arange(int(cy) - R, int(cy) + R + 1); xs = np.arange(int(cx) - R, int(cx) + R + 1)
        X, Y = np.meshgrid(xs - cx, ys - cy)
        u = (X * np.cos(th) + Y * np.sin(th)) / ax; v = (-X * np.sin(th) + Y * np.cos(th)) / ay
        d = u * u + v * v
        m = d < 1
        yi = (ys % n)[:, None].repeat(len(xs), 1); xi = (xs % n)[None, :].repeat(len(ys), 0)
        vein = np.exp(-(v * ay) ** 2 * 2)
        shade = (0.85 + 0.2 * (1 - d)) * (1 - 0.25 * vein)
        img[yi[m], xi[m]] = c * shade[m][:, None]
        h[yi[m], xi[m]] += 0.4 + 0.3 * (1 - d[m])
    # Zweige
    for i in range(120):
        x, y = r.uniform(0, n, 2); L = r.uniform(20, 70); a = r.uniform(0, np.pi * 2); w = r.uniform(1, 2.5)
        for sidx in range(int(L)):
            for ww in range(int(w) + 1):
                px = int(x + np.cos(a) * sidx - np.sin(a) * ww) % n; py = int(y + np.sin(a) * sidx + np.cos(a) * ww) % n
                img[py, px] = np.array([0.20, 0.15, 0.10]) * (0.7 + 0.3 * ww / (w + 1)); h[py, px] += 1.0
    mc = np.array([0.075, 0.12, 0.035]) * (1 + spec_noise(n, 0.5, 55) * 0.3)[..., None]
    mm = np.clip(moss * 1.6, 0, 0.85)[..., None]
    img = img * (1 - mm) + mc * mm
    h = h + moss * 0.6 + band(n, 200, 500, 56) * 0.08 * moss
    hb = wrap_blur(h, 0.8)
    a = ao(hb, (2, 6, 14), 0.25)
    img *= a[..., None]
    save('forest', img, hb, normal_from_h(hb, 1.8))

which = sys.argv[2:] or ['trail', 'meadow', 'rock', 'forest']
for w in which: globals()[w]()
