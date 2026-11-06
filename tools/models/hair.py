# Haarsträhnen als Karten (glTF-Koordinaten). Jede Karte trägt im UV (2+u, v+4*seed);
# im Spiel schneidet der Shader daraus einzelne, spitz zulaufende Haare.
# Erwartet aus build_spec.py: QG, faces, headM, new, pushout, tree, N2G, Q2G, SEX
HR = np.random.default_rng(17 if SEX == 'M' else 23)
def sstep(a, b, x): t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
E = new['eye']; BK = new['back']; TOP = new['top']; HW = new['w']
ZC = (E[2] + BK) / 2; D2 = (E[2] - BK) / 2
NQ = vnormals(QG, faces)
def scalp_mask(p, front_drop=0.0):
    r = p - np.array([0, E[1], ZC]); f = r[:, 2] / D2
    thr = -0.085 + 0.15 * sstep(-0.7, 0.85, f) - front_drop * sstep(0.3, 0.9, f)
    ear = (np.abs(p[:, 0]) > HW * 0.72) & (r[:, 1] < 0.035) & (r[:, 1] > -0.06) & (np.abs(f) < 0.5)
    return (r[:, 1] > thr) & ~ear
# Dreiecke der Kopfhaut
tris = []
for f in faces:
    tris.append((f[0], f[1], f[2]))
    if len(f) == 4: tris.append((f[0], f[2], f[3]))
tris = np.array(tris)
def sample_roots(n, front_drop=0.0):
    hm = headM | (QG[:, 1] > E[1] - 0.12)
    ok = hm[tris].all(1) & scalp_mask(QG[tris].mean(1), front_drop)
    T = tris[ok]; A = QG[T]
    area = np.linalg.norm(np.cross(A[:, 1] - A[:, 0], A[:, 2] - A[:, 0]), axis=1); area /= area.sum()
    k = HR.choice(len(T), n, p=area)
    u, v = HR.random(n), HR.random(n); sw = u + v > 1; u[sw], v[sw] = 1 - u[sw], 1 - v[sw]
    w = 1 - u - v
    p = A[k, 0] * w[:, None] + A[k, 1] * u[:, None] + A[k, 2] * v[:, None]
    nn = NQ[T[k, 0]] * w[:, None] + NQ[T[k, 1]] * u[:, None] + NQ[T[k, 2]] * v[:, None]
    return p, nn / np.linalg.norm(nn, axis=1, keepdims=True)
def unit(v): return v / (np.linalg.norm(v, axis=-1, keepdims=True) + 1e-9)
def surf_n(q):
    d, i = tree.query(q, k=4); nn = unit(N2G[i].mean(1))
    return nn, d[:, 0]
def grow(p0, n0, d0, L, nseg, off, grav, curl=0.15, stiff=0.6, hug=0.006, zone=0.03):
    """Strähnen schrittweise wachsen lassen: am Kopf anliegend, frei hängend unter Schwerkraft."""
    n = len(p0); pts = np.zeros((nseg + 1, n, 3)); pts[0] = p0 + n0 * off[:, None]
    d = unit(d0 - n0 * np.einsum('ij,ij->i', d0, n0)[:, None]); ds = L / nseg
    ph = HR.random(n) * 6.28
    for s in range(1, nseg + 1):
        t = s / nseg
        nn, dist = surf_n(pts[s - 1])
        g = grav[:, None] * (0.25 + t) * np.array([0, -1, 0])
        wob = unit(np.cross(d, nn)) * (np.sin(ph + t * 7) * curl)[:, None]
        dn = unit(d * stiff + g + wob * 0.4)
        # anliegen: Anteil in Richtung Kopf entfernen, solange nah an der Fläche
        near = dist < 0.05
        into = np.einsum('ij,ij->i', dn, nn)
        dn[near] = unit(dn[near] - nn[near] * np.minimum(into[near], 0.0)[:, None] * 1.0)
        q = pts[s - 1] + dn * ds[:, None]
        mg = off + 0.002
        q2 = pushout(q, 0.0, iters=2)
        nn2, dist2 = surf_n(q2)
        dd = np.einsum('ij,ij->i', q2 - Q2G[tree.query(q2)[1]], nn2)
        corr = np.where(dd < mg, mg - dd, 0.0)
        corr = np.where((dd > mg + hug) & (dist2 < zone), (mg + hug) - dd, corr)
        q2 = q2 + nn2 * corr[:, None]
        pts[s] = q2
        d = unit(pts[s] - pts[s - 1])
    return pts
def cards(pts, width, seed_off=0, taper=0.55, double=False, keep=None):
    if keep is not None: pts = pts[:, keep]; width = width[keep]
    S1, n, _ = pts.shape
    V, Fc, UV = [], [], []
    for c in range(n):
        P_ = pts[:, c]; dirs = unit(np.gradient(P_, axis=0)); nn, _ = surf_n(P_)
        wv = unit(np.cross(dirs, nn))
        nrm = unit(np.cross(wv, dirs))
        seed = (c * 7 + seed_off) % 61
        for side in ((0, 1) if double else (0,)):
            base = len(V)
            for s in range(S1):
                t = s / (S1 - 1); w = width[c] * (1 - taper * t ** 1.5) / 2
                sh = -nrm[s] * 0.0006 if side else 0
                V += [P_[s] - wv[s] * w + sh, P_[s] + wv[s] * w + sh]
                UV += [(2.0, t + 4 * seed), (3.0, t + 4 * seed)]
            for s in range(S1 - 1):
                a0, a1, b0, b1 = base + 2 * s, base + 2 * s + 1, base + 2 * s + 2, base + 2 * s + 3
                Fc.append([a0, a1, b1, b0] if not side else [a0, b0, b1, a1])
    return np.array(V), Fc, np.array(UV)

CARDS = []
C_CROWN = np.array([0, TOP - 0.012, ZC - 0.45 * D2])
# kurz: vom Wirbel weg gekämmt, vorne leicht zur Seite
p, nn = sample_roots(500)
lay = HR.random(len(p))
d0 = unit(p - C_CROWN); fr = (p[:, 2] - ZC) / D2
up = np.stack([np.full(len(p), 0.55), np.full(len(p), 0.9), np.full(len(p), -0.5)], 1)
d0 = np.where((fr > 0.25)[:, None], up, d0)
L = (0.03 + 0.025 * HR.random(len(p))) * (1 - 0.4 * sstep(-0.1, -0.9, fr) - 0.3 * sstep(0.0, -0.5, p[:, 1] - TOP + 0.06))
pts = grow(p, nn, d0, L, 4, 0.002 + 0.005 * lay, 0.02 + 0.03 * HR.random(len(p)), curl=0.2, stiff=0.95, hug=0.004)
V, Fc, UV = cards(pts, 0.013 + 0.007 * HR.random(len(p)))
CARDS.append(('HairShortC', V, Fc, UV))
# lang: Seitenscheitel, fällt über die Schultern auf den Rücken
p, nn = sample_roots(420, front_drop=0.0)
lay = HR.random(len(p)); fr = (p[:, 2] - ZC) / D2
part = 0.018
side = np.sign(p[:, 0] - part + 1e-4)
d_front = np.stack([side * 1.0, -0.35 * np.ones(len(p)), -0.25 * np.ones(len(p))], 1)
d_back = unit(p - C_CROWN) + np.array([0, -0.6, 0])
d0 = np.where((fr > -0.25)[:, None], d_front, d_back)
L = 0.26 + 0.1 * HR.random(len(p))
L = np.where(fr > 0.55, L * (0.75 + 0.2 * HR.random(len(p))), L)
pts = grow(p, nn, d0, L, 10, 0.003 + 0.008 * lay, 0.35 + 0.2 * HR.random(len(p)), curl=0.1, stiff=0.55, hug=0.01, zone=0.07)
V, Fc, UV = cards(pts, 0.02 + 0.012 * HR.random(len(p)), seed_off=5, taper=0.45)
CARDS.append(('HairLongC', V, Fc, UV))
# Pferdeschwanz: straff zum Knoten am Hinterkopf, dann hängender Zopf
A = np.array([0, E[1] + 0.045, BK - 0.012])
p, nn = sample_roots(380)
lay = HR.random(len(p))
d0 = A - p
L = np.linalg.norm(A - p, axis=1) * 1.08
pts = grow(p, nn, d0, L, 5, 0.002 + 0.004 * lay, np.zeros(len(p)), curl=0.05, stiff=1.0, hug=0.003)
V, Fc, UV = cards(pts, 0.014 + 0.006 * HR.random(len(p)), seed_off=11, taper=0.2, keep=(np.linalg.norm(pts[-1] - A, axis=1) < 0.04) & (np.linalg.norm(pts - A, axis=2).max(0) < 0.2))
CARDS.append(('HairPonyC', V, Fc, UV))
nt = 120; ang = HR.random(nt) * 6.283; rad = 0.004 + 0.012 * np.sqrt(HR.random(nt))
p = A + np.stack([np.cos(ang) * rad, np.sin(ang) * rad * 0.8, -0.006 * np.ones(nt)], 1)
nn = unit(np.stack([np.cos(ang) * 0.6, np.sin(ang) * 0.4 + 0.2, -np.ones(nt)], 1))
d0 = np.array([0, -0.25, -1.0]) + nn * 0.3
L = 0.2 + 0.1 * HR.random(nt)
pts = grow(p, nn, d0, L, 8, np.full(nt, 0.0), 0.35 + 0.25 * HR.random(nt), curl=0.1, stiff=0.75, hug=5.0)
V2, F2, UV2 = cards(pts, 0.014 + 0.008 * HR.random(nt), seed_off=29, taper=0.6, keep=pts[:, :, 1].max(0) < A[1] + 0.03)
CARDS.append(('HairPonyC', V2, F2, UV2))
# Haargummi
print('hair cards', [(c[0], len(c[1])) for c in CARDS])
