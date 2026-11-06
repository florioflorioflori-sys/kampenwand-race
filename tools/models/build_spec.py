# Zuschauer aus dem MakeHuman-Grundkörper (CC0): echter Kopf mit Gesicht, Augen, Händen mit Fingern,
# Jacke, Hose, Schuhe als Kleidungsschicht. Haare, Mützen, Hüte, Schal, Rucksack, Brille und Brauen
# werden aus dem bisherigen Modell übernommen und an den neuen Kopf/Körper angepasst.
# Gleiche Materialnamen, gleiches Skelett, zwei Detailstufen (Body, Body_lod1).
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, bpy
from mathutils import Vector
from scipy.spatial import cKDTree
import mhlib, glbread
HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
SEX = args[0] if args else 'M'
OUT = args[1] if len(args) > 1 else os.path.join(HERE, 'glb', 'spec%s_new.glb' % SEX)
OLD = os.path.join(HERE, 'glb', 'spec%sData.glb' % SEX)

# ---------------- altes Modell (glTF-Koordinaten: y oben, Blick +z)
oj, oacc = glbread.load(OLD)
oldparts = {}
for p in oj['meshes'][0]['primitives']:
    nm = oj['materials'][p['material']]['name']
    oldparts[nm] = dict(P=oacc(p['attributes']['POSITION']).astype(float), I=oacc(p['indices']).reshape(-1, 3).astype(int),
                        col=oj['materials'][p['material']]['pbrMetallicRoughness']['baseColorFactor'][:3])
oS = oldparts['Skin']['P']
OEY = 1.677 if SEX == 'M' else 1.577
oH = oS[(oS[:, 1] > OEY - 0.2) & (np.abs(oS[:, 0]) < 0.15)]
oE = oldparts['Eyes']['P']
old = dict(eye=np.array([0, OEY, oE[:, 2].mean() - 0.004]), top=oH[:, 1].max(), back=oH[:, 2].min(),
           w=oH[np.abs(oH[:, 1] - OEY) < 0.03][:, 0].max())

# ---------------- neuer Körper
V0, VT, F, FT, G = mhlib.load_obj()
mix = [('macrodetails/caucasian-male-young', 1.0)] if SEX == 'M' else [('macrodetails/caucasian-female-young', 1.0)]
Vt = mhlib.tpose(mhlib.morph(V0, mix))
GJ = mhlib.game_joints(Vt)
PB = mhlib.to_blender(Vt)
gl = lambda B: np.stack([B[..., 0], B[..., 2], -B[..., 1]], -1)   # Blender -> glTF
bl = lambda Q: np.stack([Q[..., 0], -Q[..., 2], Q[..., 1]], -1)   # glTF -> Blender
def gverts(name): return sorted(set(v for i, g in enumerate(G) if g == name for v in F[i]))
eyeL = gl(PB[gverts('helper-l-eye')].mean(0)); eyeR = gl(PB[gverts('helper-r-eye')].mean(0))
teeth = gverts('helper-upper-teeth')
# Größe: Augenhöhe wie beim alten Modell (Frauen etwas größer als der MH-Standard)
SC = OEY / eyeL[1] if SEX == 'F' else 1.0
PB *= SC; GJ = {k: v * SC for k, v in GJ.items()}; eyeL *= SC; eyeR *= SC
mouth = gl(PB[teeth].mean(0)); mouth[2] = gl(PB[teeth])[:, 2].max()
W = mhlib.weights(len(PB))
bodyF = [i for i, g in enumerate(G) if g == 'body']
used = sorted(set(v for i in bodyF for v in F[i])); remap = {v: k for k, v in enumerate(used)}
P = PB[used]; W = {k: w[used] for k, w in W.items()}
faces = [[remap[v] for v in F[i]] for i in bodyF]
nv = len(P); names = list(W.keys()); Wm = np.stack([W[n] for n in names], 1); dom = np.array(names)[Wm.argmax(1)]
def vnormals(P, faces):
    N = np.zeros_like(P)
    for f in faces:
        a, b, c = P[f[0]], P[f[1]], P[f[2]]
        n = np.cross(b - a, c - a)
        if len(f) == 4: n += np.cross(c - a, P[f[3]] - a)
        for v in f: N[v] += n
    return N / (np.linalg.norm(N, axis=1, keepdims=True) + 1e-12)
N = vnormals(P, faces)
J = GJ
grp = lambda *ns: np.isin(dom, ns)
z = P[:, 2]
headM = grp('Head'); neckM = grp('neck_01')
handM = grp('hand_l', 'hand_r', 'middle_01_l', 'middle_01_r')
armx = np.abs(P[:, 0])
handM |= grp('lowerarm_l', 'lowerarm_r') & (armx > J['hand_l'][0] - 0.015)
footM = grp('foot_l', 'foot_r', 'ball_l', 'ball_r', 'calf_l', 'calf_r', 'thigh_l', 'thigh_r') & (z < J['foot_l'][2] + 0.05)
legM = grp('thigh_l', 'thigh_r', 'calf_l', 'calf_r') & ~footM
waistZ = J['spine_01'][2] + 0.02
pantsM = legM | (grp('pelvis') & (z < waistZ)) | (grp('spine_01') & (z < waistZ))
topM = ~(headM | neckM | handM | footM | pantsM)
ny = P[:, 1] - J['neck_01'][1]
ncut = J['neck_01'][2] + 0.012 - 0.04 * np.clip(-ny / 0.07, 0, 1)
neckish = neckM | grp('spine_03', 'clavicle_l', 'clavicle_r')
topM[neckish & (z >= ncut)] = False
topM |= neckM & (z < ncut)
skinM = ~(topM | pantsM | footM)

# Nachbarn + Stoffschicht
adj = [[] for _ in range(nv)]
for f in faces:
    for i in range(len(f)):
        a, b = f[i], f[(i + 1) % len(f)]; adj[a].append(b); adj[b].append(a)
adj = [np.array(sorted(set(a))) for a in adj]
def fbm3(p, oct=4, seed=0):
    r = np.random.default_rng(seed); s = np.zeros(len(p)); a = 1.0
    for o in range(oct):
        k = r.normal(size=(6, 3)) * (2 ** o) * 9; ph = r.uniform(0, 6.28, 6)
        s += a * np.sin(p @ k.T + ph).sum(1) / 6; a *= 0.5
    return s
off = np.zeros(nv)
off[topM] = 0.016 + 0.005 * np.clip(fbm3(P[topM], 4, 1), -1, 1)   # Jacke
off[pantsM] = 0.014 + 0.004 * np.clip(fbm3(P[pantsM], 4, 2), -1, 1)
off[footM] = 0.017
ua = grp('upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r') & topM
off[ua] += 0.004 + 0.003 * np.sin(armx[ua] * 160) * np.exp(-((armx[ua] - J['lowerarm_l'][0]) / 0.06) ** 2)
pz = pantsM & grp('calf_l', 'calf_r', 'thigh_l', 'thigh_r')
off[pz] += 0.003 * np.sin(z[pz] * 140) * (np.exp(-((z[pz] - J['calf_l'][2]) / 0.07) ** 2) + np.exp(-((z[pz] - J['foot_l'][2] - 0.1) / 0.05) ** 2))
for it in range(3):
    off = np.array([0.5 * off[i] + 0.5 * off[a].mean() if len(a) else off[i] for i, a in enumerate(adj)])
P2 = P + N * off[:, None]
def relax(Q, M, iters, mind):
    idx = np.where(M)[0]
    for it in range(iters):
        nq = np.array([Q[adj[i]].mean(0) for i in idx])
        Q[idx] = Q[idx] * 0.4 + nq * 0.6
        d = np.einsum('ij,ij->i', Q[idx] - P[idx], N[idx])
        Q[idx] += N[idx] * np.clip(mind[idx] - d, 0, None)[:, None]
    return Q
mind = off * 0.8
P2 = relax(P2, topM & ~neckM, 45, mind)
# Hosenbeine hängen gerade: Abstand zur Beinachse Richtung Hüllkurve ziehen
def seg_proj(X, pts):
    best_t = np.zeros(len(X)); best_d = np.full(len(X), 1e9); best_c = np.zeros_like(X); acc_ = 0.0
    for a, b in zip(pts[:-1], pts[1:]):
        ab = b - a; L = np.linalg.norm(ab); u = ab / L
        t = np.clip((X - a) @ u, 0, L); cpt = a + np.outer(t, u); d = np.linalg.norm(X - cpt, axis=1)
        m = d < best_d; best_d[m] = d[m]; best_t[m] = acc_ + t[m]; best_c[m] = cpt[m]
        acc_ += L
    return best_t, best_c
for sd in ('l', 'r'):
    lm = np.where(pantsM & grp('thigh_' + sd, 'calf_' + sd))[0]
    pts = [J['thigh_' + sd], J['calf_' + sd], J['foot_' + sd] + [0, 0, 0.02]]
    t, cpt = seg_proj(P2[lm], pts)
    rv = P2[lm] - cpt; r = np.linalg.norm(rv, axis=1)
    order = np.argsort(t); env = np.zeros(len(lm))
    for k, i in enumerate(lm):
        w = np.abs(t - t[k]) < 0.05
        env[k] = np.percentile(r[w], 90)
    kz = np.linalg.norm(J['thigh_' + sd] - J['calf_' + sd])
    blend = np.clip((t - kz * 0.35) / (kz * 0.5), 0, 1) * 0.75 + 0.15
    nr = r + (np.maximum(env, r) - r) * blend
    P2[lm] = cpt + rv / r[:, None] * nr[:, None]
P2 = relax(P2, pantsM, 20, mind)
P2 = relax(P2, footM, 45, np.full(nv, 0.012))
cl = topM | pantsM
wr = np.zeros(nv)
wr[cl] = 0.004 * np.clip(fbm3(P[cl] * np.array([1.0, 1.0, 0.35]), 3, 7), -1, 1) + 0.002 * np.clip(fbm3(P[cl] * 2.5, 2, 8), -1, 1)
hem = topM & (z < waistZ + 0.07)
wr[hem] += 0.008 * np.clip(1 - (z[hem] - waistZ) / 0.07, 0, 1)
P2 = P2 + N * wr[:, None]
sole = footM & (N[:, 2] < -0.5)
P2[sole, 2] = np.minimum(P2[sole, 2], 0.004)
N2 = vnormals(P2, faces)

# Materialien je Fläche
fany = lambda M: np.array([M[f].any() for f in faces])
fall = lambda M: np.array([M[f].all() for f in faces])
fc = np.array([P[f].mean(0) for f in faces]); fx = np.abs(fc[:, 0]); fz = fc[:, 2]
mat = np.full(len(faces), 'Skin', dtype=object)
mat[fany(topM)] = 'Top'
mat[fany(pantsM) & ~fany(footM)] = 'Pants'
mat[fany(footM)] = 'Shoe'
mat[fall(sole) | (fany(footM) & (fz < 0.03))] = 'Sole'
mat[fall(headM | (neckM & ~topM))] = 'Skin'
mat[fall(handM)] = 'Skin'
isT = mat == 'Top'
# Lippen: Bereich um die Mundspalte (vorn)
fg = gl(fc)
lip = (np.abs(fg[:, 0]) < 0.026 * (1 - ((fg[:, 1] - mouth[1]) / 0.014) ** 2).clip(0) ** 0.5 + 0.0) & (np.abs(fg[:, 1] - mouth[1] + 0.001) < 0.012) & (fg[:, 2] > mouth[2] - 0.004) & (mat == 'Skin')

# ---------------- Augen: Kugel mit Iris und Pupille
def eye(cg, r=0.0136):
    vs, fs, ms = [], [], []
    nu, nvv = 28, 16
    fwd = np.array([np.sign(cg[0]) * 0.06, 0.0, 1.0]); fwd /= np.linalg.norm(fwd)
    for i in range(nvv + 1):
        th = math.pi * i / nvv
        for k in range(nu):
            ph = 2 * math.pi * k / nu
            d = np.array([math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th)])  # um +z
            # nach fwd drehen (kleiner Winkel, einfache Näherung)
            d = d + fwd - np.array([0, 0, 1.0]) * 1.0 * (1 - 0) if False else d
            a = th
            bump = 0.0006 if a < 0.42 else 0
            vs.append(cg + d * (r + bump))
    for i in range(nvv):
        for k in range(nu):
            a = i * nu + k; b = i * nu + (k + 1) % nu
            fs.append([a, a + nu, b + nu, b])
            th = math.pi * (i + 0.5) / nvv
            ms.append('Pupils' if th < 0.17 else 'Iris' if th < 0.45 else 'Eyes')
    return np.array(vs), fs, ms
EYES = []
for c in (eyeL, eyeR):
    c = c.copy(); c[2] += 0.0005
    EYES.append(eye(c))

# ---------------- Zubehör aus dem alten Modell übernehmen
new = dict(eye=(eyeL + eyeR) / 2)
QG = gl(P)  # Haut (glTF)
nH = QG[(QG[:, 1] > new['eye'][1] - 0.2) & (np.abs(QG[:, 0]) < 0.15) & headM]
new.update(top=nH[:, 1].max(), back=nH[:, 2].min(), w=nH[np.abs(nH[:, 1] - new['eye'][1]) < 0.03][:, 0].max())
def headmap(p):
    q = p.copy()
    q[:, 0] = p[:, 0] * new['w'] / old['w']
    q[:, 1] = new['eye'][1] + (p[:, 1] - old['eye'][1]) * (new['top'] - new['eye'][1]) / (old['top'] - old['eye'][1])
    q[:, 2] = new['eye'][2] + (p[:, 2] - old['eye'][2]) * (new['eye'][2] - new['back']) / (old['eye'][2] - old['back'])
    return q
# Rumpf: Hals- und Rückenbezug
oTop = oldparts['Top']['P']
def bodymap(p, kind):
    q = p.copy()
    nk = gl(J['neck_01']); s3 = gl(J['spine_03'])
    if kind == 'Scarf':
        oN = np.array([0, oTop[:, 1].max() - 0.01, oTop[np.abs(oTop[:, 0]) < 0.06][:, 2].mean()])
        q += np.array([0, nk[1] - 0.035, nk[2]]) - oN
    else:  # Rucksack an den Rücken
        ch = (np.abs(oTop[:, 0]) < 0.1) & (np.abs(oTop[:, 1] - (oTop[:, 1].max() - 0.2)) < 0.05)
        oback = oTop[ch][:, 2].min(); oy = oTop[:, 1].max()
        Q2 = gl(P2); cm = topM & (np.abs(Q2[:, 0]) < 0.1) & (np.abs(Q2[:, 1] - (nk[1] - 0.2)) < 0.05)
        q += np.array([0, nk[1] - oy + 0.02, Q2[cm][:, 2].min() - oback])
    return q
# Kollision: nach außen schieben (Haut bzw. Kleidung als Fläche)
Q2G = gl(P2); N2G = gl(N2)
tree = cKDTree(Q2G)
def pushout(q, margin, mask=None, iters=3, hug=None):
    q = q.copy()
    for it in range(iters):
        d, i = tree.query(q, k=4)
        sp = Q2G[i].mean(1); nn = N2G[i].mean(1); nn /= np.linalg.norm(nn, axis=1, keepdims=True)
        dist = np.einsum('ij,ij->i', q - sp, nn)
        mv = np.clip(margin - dist, 0, None)
        if hug is not None:
            mv = np.where(dist > margin + hug, (margin + hug) - dist, mv) * (d[:, 0] < 0.03)
        mv[d[:, 0] > 0.06] = 0
        q += nn * mv[:, None]
    return q
HEADP = {'HairShort': 0.0025, 'HairLong': 0.0025, 'HairPony': 0.003, 'Beard': 0.002, 'HatBeanie': 0.009, 'Pompom': 0.0, 'HatCap': 0.006,
         'HatTyrol': 0.007, 'TyrolBand': 0.0, 'Feather': 0.0, 'Glasses': 0.0}
BODYP = {'Scarf': 0.008, 'Backpack': 0.006}
ACC = []
for nm, mg in HEADP.items():
    if nm not in oldparts: continue
    q = headmap(oldparts[nm]['P'])
    if nm in ('Pompom', 'TyrolBand', 'Feather'):
        # starr: nur verschieben wie der zugehörige Hut
        base = 'HatBeanie' if nm == 'Pompom' else 'HatTyrol'
        b0 = headmap(oldparts[base]['P']); b1 = pushout(b0, HEADP[base])
        q = q + (b1 - b0).mean(0) + np.array([0, 0.003, 0])
    elif nm == 'Glasses':
        q = q + np.array([0, 0, 0.004])
    elif nm.startswith('Hair'):
        q = pushout(q, mg, hug=0.004)
    else:
        q = pushout(q, mg)
    ACC.append((nm, q, oldparts[nm]['I']))
for nm, mg in BODYP.items():
    q = pushout(bodymap(oldparts[nm]['P'], nm), mg)
    ACC.append((nm, q, oldparts[nm]['I']))

# Gewichte für Zubehör: vom nächsten Körperpunkt
def nearw(qg):
    d, i = tree.query(qg, k=6)
    w = 1 / (d + 1e-4); w /= w.sum(1, keepdims=True)
    return {n: (W[n][i] * w).sum(1) for n in names}

# ---------------- Brauen: gebogene Streifen auf der Stirn
hs = np.where(headM & (QG[:, 2] > new['eye'][2] - 0.03))[0]
t2 = cKDTree(QG[hs][:, :2])
def onskin(x, y, lift):
    d, i = t2.query([x, y], k=6)
    k = hs[i][np.argmax(QG[hs[i]][:, 2])]
    return QG[k] + N2G[k] * lift
BROWS = []
for sx in (1, -1):
    vs, fs = [], []
    n = 12
    for i in range(n + 1):
        t = i / n
        x = sx * (0.011 + 0.046 * t)
        y = new['eye'][1] + 0.0175 + 0.006 * math.sin(math.pi * min(1, t * 1.25)) - 0.004 * t
        hw = 0.0042 * (1 - 0.6 * t) + 0.0008
        for dy in (-hw, 0.0, hw):
            vs.append(onskin(x, y + dy, 0.0011 + (0.0004 if dy == 0 else 0)))
    for i in range(n):
        for k in range(2):
            a = i * 3 + k
            fs.append([a, a + 3, a + 4, a + 1] if sx > 0 else [a, a + 1, a + 4, a + 3])
    BROWS.append((np.array(vs), fs))

# ---------------- Bündchen, Kragen, Saum: Bänder entlang der Stoffgrenzen (verdecken die Kanten)
def loops(A, B):
    bv = [i for i in np.where(A)[0] if B[adj[i]].any()]
    bv = np.array(bv)
    if len(bv) == 0: return []
    # Zusammenhangskomponenten über Nähe
    tr = cKDTree(P2[bv]); lab = -np.ones(len(bv), int); c = 0
    for s0 in range(len(bv)):
        if lab[s0] >= 0: continue
        st = [s0]; lab[s0] = c
        while st:
            u = st.pop()
            for w in tr.query_ball_point(P2[bv[u]], 0.03):
                if lab[w] < 0: lab[w] = c; st.append(w)
        c += 1
    return [bv[lab == k] for k in range(c) if (lab == k).sum() > 6]
def band(idx, mat_, half=0.011, thick=0.0035, lift=0.002, nseg=40, opn=None):
    Q = P2[idx]; c = Q.mean(0)
    w_, v_ = np.linalg.eigh(np.cov((Q - c).T)); ax = v_[:, 0]
    u = np.cross(ax, [0, 0, 1.0] if abs(ax[2]) < 0.9 else [1.0, 0, 0]); u /= np.linalg.norm(u); vv = np.cross(ax, u)
    ang = np.arctan2((Q - c) @ vv, (Q - c) @ u); rad = np.linalg.norm((Q - c) - np.outer((Q - c) @ ax, ax), axis=1); axo = (Q - c) @ ax
    bins = np.linspace(-np.pi, np.pi, nseg + 1); rr = np.zeros(nseg); aa = np.zeros(nseg); ok = np.zeros(nseg, bool)
    for k in range(nseg):
        m = (ang >= bins[k]) & (ang < bins[k + 1])
        if m.any(): rr[k] = rad[m].max(); aa[k] = axo[m].mean(); ok[k] = True
    xs = np.where(ok)[0]
    for arr in (rr, aa):
        arr[~ok] = np.interp(np.where(~ok)[0], xs, arr[ok], period=nseg)
    for it in range(2):
        rr = (np.roll(rr, 1) + rr * 2 + np.roll(rr, -1)) / 4; aa = (np.roll(aa, 1) + aa * 2 + np.roll(aa, -1)) / 4
    prof = [(-half, 0.0), (-half * 0.8, thick), (half * 0.8, thick), (half, 0.0), (0, -0.004)]
    vs, fs = [], []
    for k in range(nseg):
        a = (bins[k] + bins[k + 1]) / 2; rd = np.cos(a) * u + np.sin(a) * vv
        for (h, t) in prof:
            vs.append(c + ax * (aa[k] + h) + rd * (rr[k] + lift + t))
    m_ = len(prof)
    for k in range(nseg):
        for j in range(m_):
            a0 = k * m_ + j; a1 = ((k + 1) % nseg) * m_ + j; b0 = k * m_ + (j + 1) % m_; b1 = ((k + 1) % nseg) * m_ + (j + 1) % m_
            fs.append([a0, a1, b1, b0])
    return np.array(vs), fs, mat_
BANDS = []
big = lambda L: [max(L, key=len)] if L else []
for lp in big(loops(topM, skinM & (headM | neckM))): BANDS.append(band(lp, 'TopAccent', half=0.014, thick=0.006))
for lp in loops(topM, handM): BANDS.append(band(lp, 'TopAccent', half=0.012, thick=0.004))
for lp in big(loops(topM, pantsM)): BANDS.append(band(lp, 'TopAccent', half=0.014, thick=0.004))
for lp in loops(pantsM, footM): BANDS.append(band(lp, 'Pants', half=0.012, thick=0.003))
# Bandnormalen nach außen: Flächenreihenfolge prüfen
def orient(vs, fs, c):
    out = []
    for f in fs:
        a, b, cc = vs[f[0]], vs[f[1]], vs[f[2]]
        n = np.cross(b - a, cc - a); m = vs[f].mean(0)
        out.append(f if np.dot(n, m - c) >= 0 else f[::-1])
    return out
BANDS = [(vs, orient(vs, fs, vs.mean(0)), m) for vs, fs, m in BANDS]
print('bands', len(BANDS))

# ---------------- Schuhe: Wanderschuh als eigene Hülle um den Fuß
SHOES = []
for sx in (1, -1):
    fm = footM & (np.sign(P[:, 0]) == sx)
    Fv = P[fm]
    y0, y1 = Fv[:, 1].max() + 0.012, Fv[:, 1].min() - 0.014
    NS, NA, ex = 26, 24, 3.2
    secs = []
    for i in range(NS):
        t = i / (NS - 1); yy = y0 + (y1 - y0) * t
        m = np.abs(Fv[:, 1] - yy) < 0.02
        if m.sum() < 3: m = np.argsort(np.abs(Fv[:, 1] - yy))[:8]
        Q = Fv[m]
        secs.append([Q[:, 0].min(), Q[:, 0].max(), Q[:, 2].max()])
    secs = np.array(secs)
    for it in range(3):
        secs[1:-1] = (secs[:-2] + secs[1:-1] * 2 + secs[2:]) / 4
    vs, fs, ms = [], [], []
    for i in range(NS):
        t = i / (NS - 1); yy = y0 + (y1 - y0) * t
        xa, xb, zt = secs[i]
        heel = math.sin(math.pi * min(1, t * 5.0) / 2); toe = math.sin(math.pi * min(1, (1 - t) * 7.0) / 2)
        hw = ((xb - xa) / 2 + 0.011) * (0.62 + 0.38 * heel) * (0.55 + 0.45 * toe); xc = (xa + xb) / 2
        if t < 0.42: top = max(zt + 0.012, J['foot_l'][2] + 0.075)
        else: top = max(zt + 0.012, 0.045) * (0.55 + 0.45 * toe)
        hh = top / 2
        for k in range(NA):
            a = 2 * math.pi * k / NA; c, s_ = math.cos(a), math.sin(a)
            zz = hh + hh * np.sign(s_) * abs(s_) ** (2 / ex) - 0.002
            vs.append([xc + hw * np.sign(c) * abs(c) ** (2 / ex) * (1.07 if zz < 0.02 else 1.0), yy, zz])
    for i in range(NS - 1):
        for k in range(NA):
            a0 = i * NA + k; a1 = i * NA + (k + 1) % NA
            f = [a0, a1, a1 + NA, a0 + NA]
            fs.append(f if sx < 0 else f[::-1])
            zc = (vs[a0][2] + vs[a1][2]) / 2
            ms.append('Sole' if zc < 0.021 else 'Shoe')
    for end, rng_ in ((0, range(NA)), (NS - 1, range(NA))):
        cidx = len(vs); ring_ = [end * NA + k for k in rng_]
        vs.append(list(np.mean([vs[r] for r in ring_], 0)))
        for k in range(NA):
            f = [ring_[k], ring_[(k + 1) % NA], cidx]
            fs.append(f if (end == 0) == (sx > 0) else f[::-1]); ms.append('Shoe')
    vs = np.array(vs)
    # Ausrichtung prüfen: Normalen nach außen
    c0 = vs.mean(0); out = []
    for f in fs:
        n = np.cross(vs[f[1]] - vs[f[0]], vs[f[2]] - vs[f[0]]); m_ = vs[f].mean(0)
        out.append(f if np.dot(n, m_ - c0) >= 0 else f[::-1])
    SHOES.append((vs, out, ms))

exec(open(os.path.join(HERE, 'hair.py')).read())
# ---------------- Blender
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
COLS = {k: v['col'] for k, v in oldparts.items()}
def make_mat(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*COLS.get(name, (0.7, 0.7, 0.7)), 1); bs.inputs['Roughness'].default_value = 0.7
    return m
MLIST = list(oldparts.keys()) + ['HairShortC', 'HairLongC', 'HairPonyC']
for _n, _b in (('HairShortC', 'HairShort'), ('HairLongC', 'HairLong'), ('HairPonyC', 'HairPony')): COLS[_n] = COLS.get(_b, (0.3, 0.2, 0.1))
MATS = {n: make_mat(n) for n in MLIST}
assert all(bpy.data.materials[n].name == n for n in MLIST)

arm = bpy.data.armatures.new('Rig'); ao = bpy.data.objects.new('Rig', arm); sc.collection.objects.link(ao)
bpy.context.view_layer.objects.active = ao; bpy.ops.object.mode_set(mode='EDIT')
HIER = [('root', None), ('pelvis', 'root'), ('spine_01', 'pelvis'), ('spine_02', 'spine_01'), ('spine_03', 'spine_02'),
        ('clavicle_l', 'spine_03'), ('upperarm_l', 'clavicle_l'), ('lowerarm_l', 'upperarm_l'), ('hand_l', 'lowerarm_l'), ('middle_01_l', 'hand_l'),
        ('clavicle_r', 'spine_03'), ('upperarm_r', 'clavicle_r'), ('lowerarm_r', 'upperarm_r'), ('hand_r', 'lowerarm_r'), ('middle_01_r', 'hand_r'),
        ('neck_01', 'spine_03'), ('Head', 'neck_01'),
        ('thigh_l', 'pelvis'), ('calf_l', 'thigh_l'), ('foot_l', 'calf_l'), ('ball_l', 'foot_l'),
        ('thigh_r', 'pelvis'), ('calf_r', 'thigh_r'), ('foot_r', 'calf_r'), ('ball_r', 'foot_r')]
TAIL = {'root': J['pelvis'] * [0, 0, 1], 'pelvis': J['spine_01'], 'spine_01': J['spine_02'], 'spine_02': J['spine_03'], 'spine_03': (J['neck_01'] + J['spine_03']) / 2 + [0, 0, 0.06],
        'neck_01': J['Head'], 'Head': J['Head_tail']}
for s in ('l', 'r'):
    TAIL.update({'clavicle_' + s: J['upperarm_' + s], 'upperarm_' + s: J['lowerarm_' + s], 'lowerarm_' + s: J['hand_' + s], 'hand_' + s: J['middle_01_' + s],
                 'middle_01_' + s: J['middle_01_' + s] + (J['middle_01_' + s] - J['hand_' + s]) * 0.8,
                 'thigh_' + s: J['calf_' + s], 'calf_' + s: J['foot_' + s], 'foot_' + s: J['ball_' + s], 'ball_' + s: J['ball_' + s + '_tail'] + (J['ball_' + s + '_tail'] - J['ball_' + s]) * 1.5})
eb = {}
for n, p in HIER:
    b = arm.edit_bones.new(n); b.head = Vector(J[n] if n != 'root' else (0, 0, 0)); b.tail = Vector(TAIL[n])
    if (b.tail - b.head).length < 0.01: b.tail = b.head + Vector((0, 0, 0.05))
    if p: b.parent = eb[p]
    b.roll = 0.0; eb[n] = b
bpy.ops.object.mode_set(mode='OBJECT')

def build_mesh(name, verts, flist, mlist, groups, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(int(x) for x in f) for f in flist])
    for m in MLIST: me.materials.append(MATS[m])
    me.polygons.foreach_set('material_index', [MLIST.index(m) for m in mlist])
    me.polygons.foreach_set('use_smooth', [smooth] * len(flist))
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    for gname, wv in groups.items():
        vg = ob.vertex_groups.new(name=gname)
        for i in np.where(wv > 0.002)[0]: vg.add([int(i)], float(wv[i]), 'REPLACE')
    ob.parent = ao
    mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = ao
    return ob
keep = [i for i, f in enumerate(faces) if not footM[f].all()]
mat[[i for i in range(len(faces)) if footM[faces[i]].any() and i in set(keep)]] = 'Pants'
parts = [build_mesh('Body', P2, [faces[i] for i in keep], [mat[i] for i in keep], W)]
for vs, fs, ms in SHOES:
    parts.append(build_mesh('Shoe', vs, fs, ms, nearw(gl(vs))))
for vs, fs, ms in EYES:
    parts.append(build_mesh('Eye', bl(vs), fs, ms, {'Head': np.ones(len(vs))}))
for vs, fs in BROWS:
    parts.append(build_mesh('Brows', bl(vs), fs, ['Brows'] * len(fs), {'Head': np.ones(len(vs))}))
for vs, fs, m in BANDS:
    parts.append(build_mesh('Band', vs, fs, [m] * len(fs), nearw(gl(vs))))
for nm, q, I in ACC:
    flat = nm in ('Glasses', 'Feather')
    parts.append(build_mesh(nm, bl(q), I, [nm] * len(I), nearw(q), smooth=not flat))
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = parts[0]
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active; body.name = 'Body'
bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.remove_doubles(threshold=1e-6); bpy.ops.object.mode_set(mode='OBJECT')
# Detailstufe 1
lod = body.copy(); lod.data = body.data.copy(); lod.name = 'Body_lod1'; sc.collection.objects.link(lod)
dm = lod.modifiers.new('Dec', 'DECIMATE'); dm.ratio = 0.2
bpy.context.view_layer.objects.active = lod
bpy.ops.object.modifier_move_to_index(modifier='Dec', index=0)
bpy.ops.object.modifier_apply(modifier='Dec')
# Haarkarten erst nach der Detailstufe anhängen (nicht dezimieren, keine Doppelpunkte verschmelzen)
body.data.uv_layers.new(name='UVMap')
cparts = []
for nm, V, Fc, UV in CARDS:
    ob = build_mesh(nm, bl(V), Fc, [nm] * len(Fc), nearw(V))
    ul = ob.data.uv_layers.new(name='UVMap')
    vi = np.zeros(len(ob.data.loops), dtype=np.int64); ob.data.loops.foreach_get('vertex_index', vi)
    uv = UV[vi].copy(); uv[:, 1] = 1.0 - uv[:, 1]
    ul.data.foreach_set('uv', uv.astype(np.float32).ravel())
    cparts.append(ob)
bpy.ops.object.select_all(action='DESELECT')
for o in cparts + [body]: o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
print('verts', len(body.data.vertices), 'lod1', len(lod.data.vertices))
bpy.ops.object.select_all(action='DESELECT')
for o in (ao, body, lod): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_skins=True, export_animations=False, export_morph=False, export_yup=True)
print('exported', OUT, 'eye', new['eye'].round(4), 'old eye', old['eye'].round(4))
