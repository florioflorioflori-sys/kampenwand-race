# Baut den Downhill-Fahrer aus dem MakeHuman-Grundkörper: Trikot, weite Hose, Handschuhe,
# Schuhe, Knieschoner, Nackenschutz, Fullface-Helm mit Brille. Gleiches Skelett (Namen,
# Hierarchie) wie bisher, damit die Posen-Logik im Spiel unverändert funktioniert.
import sys, os, math
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import numpy as np, bpy, bmesh
from mathutils import Vector, Matrix
import mhlib
HERE = os.path.dirname(os.path.abspath(__file__))
args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
OUT = args[0] if args else os.path.join(HERE, 'glb', 'rider_new.glb')
SEX = args[1] if len(args) > 1 else 'M'
rng = np.random.default_rng(3)

# ---------------- Körper
V0, VT, F, FT, G = mhlib.load_obj()
mix = [('macrodetails/caucasian-male-young', 1.0), ('macrodetails/universal-male-young-maxmuscle-averageweight', 0.35)] if SEX == 'M' else \
      [('macrodetails/caucasian-female-young', 1.0)]
Vm = mhlib.morph(V0, mix)
Vt = mhlib.tpose(Vm)
GJ = mhlib.game_joints(Vt)
P = mhlib.to_blender(Vt)
W = mhlib.weights(len(P))
bodyF = [i for i, g in enumerate(G) if g == 'body']
used = sorted(set(v for i in bodyF for v in F[i]))
remap = {v: k for k, v in enumerate(used)}
P = P[used]; W = {k: w[used] for k, w in W.items()}
faces = [[remap[v] for v in F[i]] for i in bodyF]
uvs = [[VT[t] for t in FT[i]] for i in bodyF]
nv = len(P)
names = list(W.keys())
Wm = np.stack([W[n] for n in names], 1)
dom = np.array(names)[Wm.argmax(1)]

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
def grp(*ns): return np.isin(dom, ns)
z = P[:, 2]
# Regionen
headM = grp('Head'); neckM = grp('neck_01')
handM = grp('hand_l', 'hand_r', 'middle_01_l', 'middle_01_r')
footM = grp('foot_l', 'foot_r', 'ball_l', 'ball_r') | (grp('calf_l', 'calf_r') & (z < J['foot_l'][2] + 0.085))
legM = grp('thigh_l', 'thigh_r', 'calf_l', 'calf_r') & ~footM
waistZ = J['spine_01'][2] - 0.01
pelM = grp('pelvis')
pantsM = legM | (pelM & (z < waistZ + 0.02))
armx = np.abs(P[:, 0])
gloveM = handM | (grp('lowerarm_l', 'lowerarm_r') & (armx > J['hand_l'][0] - 0.06))
jerseyM = ~(headM | neckM | handM | footM | pantsM | gloveM)
# Kragen: Hals unten gehört zum Trikot
jerseyM |= neckM & (z < J['neck_01'][2] - 0.005)
skinM = ~(jerseyM | pantsM | gloveM | footM)

# ---------------- Stoff: Abstand zur Haut + Falten
def fbm3(p, oct=4, seed=0):
    r = np.random.default_rng(seed); s = np.zeros(len(p)); a = 1.0
    for o in range(oct):
        k = r.normal(size=(6, 3)) * (2 ** o) * 9
        ph = r.uniform(0, 6.28, 6)
        s += a * np.sin(p @ k.T + ph).sum(1) / 6
        a *= 0.5
    return s
off = np.zeros(nv)
off[jerseyM] = 0.022 + 0.008 * np.clip(fbm3(P[jerseyM], 4, 1), -1, 1)
# weite Downhill-Hose, an den Oberschenkeln weiter
th = grp('thigh_l', 'thigh_r') & pantsM
off[pantsM] = 0.028 + 0.008 * np.clip(fbm3(P[pantsM], 4, 2), -1, 1)
off[th] += 0.008
off[gloveM] = 0.004
off[footM] = 0.016
# Ärmel weiter und mit Querfalten am Ellbogen
ua = grp('upperarm_l', 'upperarm_r', 'lowerarm_l', 'lowerarm_r') & jerseyM
off[ua] += 0.006 + 0.004 * np.sin(armx[ua] * 160) * np.exp(-((armx[ua] - J['lowerarm_l'][0]) / 0.06) ** 2)
# Hose: Querfalten über dem Knie und am Knöchel
kz = J['calf_l'][2]
pz = pantsM & grp('calf_l', 'calf_r', 'thigh_l', 'thigh_r')
off[pz] += 0.004 * np.sin(z[pz] * 140) * (np.exp(-((z[pz] - kz) / 0.07) ** 2) + np.exp(-((z[pz] - J['foot_l'][2] - 0.12) / 0.06) ** 2))
# Laplace-Glättung des Abstands, damit Säume weich ineinander laufen
adj = [[] for _ in range(nv)]
for f in faces:
    for i in range(len(f)):
        a, b = f[i], f[(i + 1) % len(f)]; adj[a].append(b); adj[b].append(a)
adj = [np.array(sorted(set(a))) for a in adj]
for it in range(3):
    off = np.array([0.5 * off[i] + 0.5 * off[a].mean() if len(a) else off[i] for i, a in enumerate(adj)])
P2 = P + N * off[:, None]
def relax(Q, M, iters, mind):
    idx = np.where(M)[0]
    for it in range(iters):
        nq = np.array([Q[adj[i]].mean(0) if len(adj[i]) else Q[i] for i in idx])
        Q[idx] = Q[idx] * 0.4 + nq * 0.6
        d = np.einsum('ij,ij->i', Q[idx] - P[idx], N[idx])
        Q[idx] += N[idx] * np.clip(mind[idx] - d, 0, None)[:, None]
    return Q
mind = off * 0.75
P2 = relax(P2, jerseyM & ~grp('neck_01'), 30, mind)
P2 = relax(P2, pantsM, 30, mind)
P2 = relax(P2, footM, 30, np.full(nv, 0.012))
P2 = relax(P2, gloveM & ~handM, 4, mind)
# Falten nach dem Glätten: längs an den Beinen, quer an Armbeugen und Hüfte
cl = jerseyM | pantsM
wr = np.zeros(nv)
wr[cl] = 0.006 * np.clip(fbm3(P[cl] * np.array([1.0, 1.0, 0.35]), 3, 7), -1, 1) + 0.003 * np.clip(fbm3(P[cl] * 2.5, 2, 8), -1, 1)
# Trikotsaum steht über der Hose ab
hem = jerseyM & (z < waistZ + 0.06)
wr[hem] += 0.01 * np.clip(1 - (z[hem] - waistZ) / 0.06, 0, 1)
P2 = P2 + N * wr[:, None]
# Schuhsohle flach
sole = footM & (N[:, 2] < -0.5)
P2[sole, 2] = np.minimum(P2[sole, 2], 0.004)

# ---------------- Materialien je Fläche
def fmask(M):
    return np.array([M[f].all() for f in faces])
def fany(M):
    return np.array([M[f].any() for f in faces])
fc = np.array([P[f].mean(0) for f in faces])
fdom = np.array([dom[f[0]] for f in faces])
mat = np.full(len(faces), 'Skin', dtype=object)
mat[fany(jerseyM)] = 'Jersey'
mat[fany(pantsM) & ~fany(footM)] = 'Pants'
mat[fany(gloveM) & ~fany(jerseyM & ~gloveM)] = 'Glove'
mat[fany(footM)] = 'Shoe'
mat[fmask(sole)] = 'ShoeSole'
mat[fmask(headM | (neckM & ~jerseyM))] = 'Skin'
fx = np.abs(fc[:, 0]); fz = fc[:, 2]
isJ = mat == 'Jersey'
# Trikot-Akzente: Brustband, Ärmelstreifen, Bündchen, Kragen
chestZ = J['spine_03'][2] + 0.02
for xc in (J['upperarm_l'][0] + 0.12, J['upperarm_l'][0] + 0.17):
    mat[isJ & (np.abs(fx - xc) < 0.016)] = 'JerseyAccent'
mat[isJ & (fx > J['hand_l'][0] - 0.085) & (fx > 0.3)] = 'JerseyAccent'
mat[isJ & (fz > J['neck_01'][2] - 0.035) & (fx < 0.09)] = 'JerseyAccent'
# Hose: Seitenstreifen außen
isP = mat == 'Pants'
legc = np.where(fc[:, 0] > 0, J['thigh_l'][0], J['thigh_r'][0])
outer = (np.sign(fc[:, 0]) * (fc[:, 0] - legc) > 0.05) & (np.abs(fc[:, 1] - 0.0) < 0.03)

# ---------------- Fullface-Helm als parametrische Schale
def make_helmet(ST):
    global RX, RY, RZ, HC
    hv = np.where(headM)[0]
    hmin, hmax = P[hv].min(0), P[hv].max(0)
    hcenter = (hmin + hmax) / 2
    eyeZ = J['Head'][2] + 0.075
    HC = np.array([0.0, hcenter[1] + 0.008, eyeZ + 0.005])
    RX, RY, RZ = (hmax[0] - hmin[0]) / 2 + 0.038, (hmax[1] - hmin[1]) / 2 + 0.036 + ST['long'], hmax[2] - HC[2] + 0.035 + ST['tall']
    NT, NPH = 72, 40
    th_ = np.linspace(-np.pi, np.pi, NT + 1)[:-1]
    ph_ = np.linspace(-1.25, 1.5707, NPH)
    def hpt(t, ph, dr=0.0):
        ct, st = np.cos(t), np.sin(t)
        fr = max(0.0, ct)  # vorne
        r = 1.0 + dr
        x = RX * r * np.cos(ph) * st
        y = -RY * r * np.cos(ph) * ct
        zz = RZ * r * np.sin(ph) if ph > 0 else (RZ * (1.3 + 0.25 * fr)) * r * np.sin(ph)
        # Kinnbügel ragt vorn unten heraus, hinten reicht der Helm tiefer in den Nacken
        if ph < -0.15: y -= ST['chin'] * fr ** ST['chinP'] * min(1, (-0.15 - ph) / 0.5)
        if ph < -0.6: zz -= 0.02 * (1 - fr)
        return HC + np.array([x, y, zz])
    PORT_T, PORT_P0, PORT_P1 = 1.05, -0.24, 0.24
    def region(t, ph):
        at = abs(t)
        if at < PORT_T and PORT_P0 < ph < PORT_P1: return 'port'
        if at < PORT_T + 0.06 and PORT_P0 - 0.05 < ph < PORT_P1 + 0.05: return 'HelmetTrim'
        if ph < -1.1: return 'HelmetTrim'
        if ST['acc'] == 0:
            if ph > PORT_P1 and (abs(at - 0.42) < 0.07): return 'HelmetAccent'
            if at > 1.7 and abs(ph - 0.05) < 0.08: return 'HelmetAccent'
        elif ST['acc'] == 1:
            if ph > PORT_P1 and (abs(at - 0.16) < 0.05 or abs(at - 0.34) < 0.03): return 'HelmetAccent'
            if ph < PORT_P0 - 0.1 and 0.5 < at < 1.4 and ph > -0.9: return 'HelmetAccent'
        else:
            if 1.2 < at < 2.5 and -0.2 < ph < 0.75 + 0.3 * math.sin(at * 3.0): return 'HelmetAccent'
            if ph > 1.2: return 'HelmetAccent'
        if at < 0.5 and -0.75 < ph < -0.55 and abs(t) > 0.12: return 'HelmetTrim'  # Belüftung im Kinnbügel
        return 'Helmet'
    hverts, hfaces, hmat = [], [], []
    grid = {}
    for a in range(NT):
        for b in range(NPH):
            grid[a, b] = len(hverts); hverts.append(hpt(th_[a], ph_[b]))
    for a in range(NT):
        for b in range(NPH - 1):
            tc = th_[a] + np.pi / NT; pc = (ph_[b] + ph_[b + 1]) / 2
            if tc > np.pi: tc -= 2 * np.pi
            rg = region(tc, pc)
            if rg == 'port': continue
            hfaces.append([grid[a, b], grid[(a + 1) % NT, b], grid[(a + 1) % NT, b + 1], grid[a, b + 1]]); hmat.append(rg)
    # Innenschale (Polster) für den Blick in die Öffnung
    base_n = len(hverts)
    for a in range(NT):
        for b in range(NPH):
            hverts.append(hpt(th_[a], ph_[b], -0.12))
    for a in range(NT):
        for b in range(NPH - 1):
            tc = th_[a] + np.pi / NT; pc = (ph_[b] + ph_[b + 1]) / 2
            if tc > np.pi: tc -= 2 * np.pi
            if region(tc, pc) == 'port': continue
            q = [base_n + grid[a, b], base_n + grid[a, b + 1], base_n + grid[(a + 1) % NT, b + 1], base_n + grid[(a + 1) % NT, b]]
            hfaces.append(q); hmat.append('Pad')
    # Brille: gewölbte Linse mit Rahmen in der Öffnung, Band rundum
    gl_t = np.linspace(-PORT_T + 0.08, PORT_T - 0.08, 22); gl_p = np.linspace(PORT_P0 + 0.06, PORT_P1 - 0.06, 6)
    g0 = len(hverts)
    for t in gl_t:
        for ph in gl_p: hverts.append(hpt(t, ph, -0.06))
    for i_ in range(len(gl_t) - 1):
        for k in range(len(gl_p) - 1):
            a0 = g0 + i_ * len(gl_p) + k
            hfaces.append([a0, a0 + len(gl_p), a0 + len(gl_p) + 1, a0 + 1]); hmat.append('Lens')
    # Rahmen: Ring um die Linse
    fr0 = len(hverts); ring_pts = []
    for t in gl_t: ring_pts.append((t, gl_p[0]))
    for ph in gl_p[1:]: ring_pts.append((gl_t[-1], ph))
    for t in gl_t[::-1][1:]: ring_pts.append((t, gl_p[-1]))
    for ph in gl_p[::-1][1:-1]: ring_pts.append((gl_t[0], ph))
    for t, ph in ring_pts:
        hverts.append(hpt(t, ph, -0.065)); hverts.append(hpt(t, ph, -0.02))
    nr = len(ring_pts)
    for i_ in range(nr):
        a0 = fr0 + i_ * 2; b0 = fr0 + ((i_ + 1) % nr) * 2
        hfaces.append([a0, b0, b0 + 1, a0 + 1]); hmat.append('GoggleFrame')
    # Band
    bt = np.linspace(PORT_T - 0.05, 2 * np.pi - PORT_T + 0.05, 40)
    b0_ = len(hverts)
    for t in bt:
        tt = t if t <= np.pi else t - 2 * np.pi
        hverts.append(hpt(tt, -0.08, 0.02)); hverts.append(hpt(tt, 0.1, 0.02))
    for i_ in range(len(bt) - 1):
        a0 = b0_ + i_ * 2
        hfaces.append([a0, a0 + 2, a0 + 3, a0 + 1]); hmat.append('GoggleFrame')
    # Schirm
    pk0 = len(hverts); pt_ = np.linspace(-0.85, 0.85, 15) if ST['peak'] > 0 else []
    for t in pt_:
        p0 = hpt(t, PORT_P1 + 0.1, -0.015)
        fwd = np.array([np.sin(t) * 0.35, -np.cos(t), 0.0]); fwd /= np.linalg.norm(fwd)
        ln = ST['peak'] * (1 - 0.35 * (t / 0.85) ** 2)
        hverts += [p0 + np.array([0, 0, 0.012]), p0 + fwd * ln + np.array([0, 0, 0.022 + ST['peakUp']]), p0 + fwd * (ln + 0.004) + np.array([0, 0, 0.01 + ST['peakUp']]), p0 + np.array([0, 0, -0.01])]
    for i_ in range(len(pt_) - 1):
        for k in range(4):
            a0 = pk0 + i_ * 4
            hfaces.append([a0 + k, a0 + 4 + k, a0 + 4 + (k + 1) % 4, a0 + (k + 1) % 4]); hmat.append('HelmetAccent')
    shell2 = np.array(hverts); hmat = np.array(hmat, dtype=object)
    return shell2, hfaces, hmat
HSTYLES = {'A': dict(chin=0.07, chinP=2, long=0.0, tall=0.0, peak=0.075, peakUp=0.0, acc=0),
           'B': dict(chin=0.11, chinP=3, long=0.012, tall=0.012, peak=0.125, peakUp=0.03, acc=1),
           'C': dict(chin=0.05, chinP=1.5, long=-0.004, tall=-0.006, peak=0.0, peakUp=0.0, acc=2)}
HELMS = {k: make_helmet(v) for k, v in HSTYLES.items()}
shell2, hfaces, hmat = HELMS['A']


# ---------------- Zusatzteile: Schirm, Brillenband, Nackenschutz, Knieschoner
extra = []  # (verts, faces, mat, bone)
def ring(center, rx, ry, rt, zf, n=40, m=10, mat='Pad', bone='spine_03', zflat=0.6):
    vs, fs = [], []
    for i in range(n):
        a = i / n * 2 * math.pi
        cx, cy = math.cos(a), math.sin(a)
        for j in range(m):
            b = j / m * 2 * math.pi
            r = rt * (1 + 0.0 * math.cos(b))
            vs.append([center[0] + (rx + r * math.cos(b)) * cx, center[1] + (ry + r * math.cos(b)) * cy, center[2] + r * math.sin(b) * zflat])
    for i in range(n):
        for j in range(m):
            a = i * m + j; b = ((i + 1) % n) * m + j; c = ((i + 1) % n) * m + (j + 1) % m; d = i * m + (j + 1) % m
            fs.append([a, b, c, d])
    extra.append((np.array(vs), fs, mat, bone))
# Nackenschutz (Neck Brace) auf den Schultern
nb = J['clavicle_l'].copy(); nb[0] = 0; nb[2] += 0.03; nb[1] = J['neck_01'][1] + 0.01
ring(nb, 0.115, 0.1, 0.026, 0.55, mat='Pad', bone='spine_03')

# Knieschoner: Schale über dem Knie
for s in ('l', 'r'):
    k = J['calf_' + s]
    km = (np.linalg.norm(P2 - k, axis=1) < 0.11) & (N[:, 1] < -0.25) & pantsM
    kf = [f for f in faces if km[f].all()]
    kset = sorted(set(v for f in kf for v in f)); kmap = {v: i for i, v in enumerate(kset)}
    KP = P2[kset] + N[kset] * 0.012
    # Wölbung: Mitte weiter vorn
    dd = np.linalg.norm(KP - k, axis=1)
    KP += N[kset] * (0.012 * np.clip(1 - dd / 0.1, 0, 1))[:, None]
    extra.append((KP, [[kmap[v] for v in f] for f in kf], 'Pad', None, kset))

# ---------------- Blender-Objekte
bpy.ops.wm.read_factory_settings(use_empty=True)
sc = bpy.context.scene
def make_mat(name, col, rough, metal=0.0, nrm=None, alpha=None):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    bs = m.node_tree.nodes['Principled BSDF']
    bs.inputs['Base Color'].default_value = (*col, 1); bs.inputs['Roughness'].default_value = rough; bs.inputs['Metallic'].default_value = metal
    if nrm:
        img = bpy.data.images.load(nrm); img.colorspace_settings.name = 'Non-Color'
        tx = m.node_tree.nodes.new('ShaderNodeTexImage'); tx.image = img
        nm = m.node_tree.nodes.new('ShaderNodeNormalMap'); nm.inputs['Strength'].default_value = 1.0
        m.node_tree.links.new(tx.outputs['Color'], nm.inputs['Color']); m.node_tree.links.new(nm.outputs['Normal'], bs.inputs['Normal'])
    return m
FAB = os.path.join(HERE, 'tex', 'fabric_n.png')
MATS = {
    'Jersey': make_mat('Jersey', (0.8, 0.1, 0.05), 0.75, nrm=FAB), 'JerseyAccent': make_mat('JerseyAccent', (0.9, 0.9, 0.9), 0.7, nrm=FAB),
    'Pants': make_mat('Pants', (0.05, 0.05, 0.05), 0.8, nrm=FAB), 'PantsAccent': make_mat('PantsAccent', (0.8, 0.1, 0.05), 0.75, nrm=FAB),
    'Skin': make_mat('Skin', (0.55, 0.36, 0.27), 0.5), 'Glove': make_mat('Glove', (0.06, 0.06, 0.06), 0.7, nrm=FAB),
    'Shoe': make_mat('Shoe', (0.06, 0.06, 0.07), 0.6), 'ShoeSole': make_mat('ShoeSole', (0.03, 0.03, 0.03), 0.9),
    'Helmet': make_mat('Helmet', (0.9, 0.9, 0.9), 0.2), 'HelmetAccent': make_mat('HelmetAccent', (0.1, 0.1, 0.1), 0.3),
    'HelmetTrim': make_mat('HelmetTrim', (0.04, 0.04, 0.04), 0.6), 'Lens': make_mat('Lens', (0.9, 0.5, 0.1), 0.05, 0.6),
    'GoggleFrame': make_mat('GoggleFrame', (0.05, 0.05, 0.05), 0.5), 'Pad': make_mat('Pad', (0.08, 0.08, 0.08), 0.55), 'Hair': make_mat('Hair', (0.25, 0.15, 0.08), 0.6),
}
MLIST = list(MATS.keys())

# Armatur: gleiche Namen/Hierarchie/Rollen wie bisher
arm = bpy.data.armatures.new('RiderRig'); ao = bpy.data.objects.new('RiderRig', arm); sc.collection.objects.link(ao)
bpy.context.view_layer.objects.active = ao; bpy.ops.object.mode_set(mode='EDIT')
HIER = [('root', None), ('pelvis', 'root'), ('spine_01', 'pelvis'), ('spine_02', 'spine_01'), ('spine_03', 'spine_02'),
        ('clavicle_l', 'spine_03'), ('upperarm_l', 'clavicle_l'), ('lowerarm_l', 'upperarm_l'), ('hand_l', 'lowerarm_l'), ('middle_01_l', 'hand_l'),
        ('clavicle_r', 'spine_03'), ('upperarm_r', 'clavicle_r'), ('lowerarm_r', 'upperarm_r'), ('hand_r', 'lowerarm_r'), ('middle_01_r', 'hand_r'),
        ('neck_01', 'spine_03'), ('Head', 'neck_01'),
        ('thigh_l', 'pelvis'), ('calf_l', 'thigh_l'), ('foot_l', 'calf_l'), ('ball_l', 'foot_l'),
        ('thigh_r', 'pelvis'), ('calf_r', 'thigh_r'), ('foot_r', 'calf_r'), ('ball_r', 'foot_r')]
ROLL = {'clavicle_l': -1.5, 'upperarm_l': -1.57, 'lowerarm_l': -1.61, 'hand_l': -1.57, 'middle_01_l': -1.57,
        'clavicle_r': 1.5, 'upperarm_r': 1.57, 'lowerarm_r': 1.61, 'hand_r': 1.57, 'middle_01_r': 1.57, 'ball_l': -3.14, 'ball_r': 3.14}
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
    eb[n] = b
for n, b in eb.items():
    # Rolle so ausrichten wie beim alten Skelett: lokale Achsen nach Weltachsen, wie Blender sie für die Rolle 0 festlegt
    b.roll = 0.0
bpy.ops.object.mode_set(mode='OBJECT')

def build_mesh(name, verts, flist, mlist, groups, uvl=None, smooth=True):
    me = bpy.data.meshes.new(name)
    me.from_pydata([tuple(v) for v in verts], [], [tuple(f) for f in flist])
    for m in MLIST: me.materials.append(MATS[m])
    me.polygons.foreach_set('material_index', [MLIST.index(m) for m in mlist])
    me.polygons.foreach_set('use_smooth', [smooth] * len(flist))
    if uvl is not None:
        uv = me.uv_layers.new(name='UVMap')
        k = 0
        for poly in me.polygons:
            for li in poly.loop_indices:
                uv.data[li].uv = uvl[k]; k += 1
    ob = bpy.data.objects.new(name, me); sc.collection.objects.link(ob)
    for gname, wv in groups.items():
        vg = ob.vertex_groups.new(name=gname)
        nz = np.where(wv > 0.002)[0]
        for i in nz: vg.add([int(i)], float(wv[i]), 'REPLACE')
    ob.parent = ao
    mod = ob.modifiers.new('Armature', 'ARMATURE'); mod.object = ao
    return ob

# Körper + Kleidung (UV der Kleidung 6-fach für das Gewebe)
uvflat = [tuple(np.array(u) * 6.0) for f in uvs for u in f]
body = build_mesh('Rider', P2, faces, list(mat), W, uvflat)
# Helm
HW = {'Head': np.ones(len(shell2))}
parts = [body]
helms = []
for k, (hs, hf, hm) in HELMS.items():
    helms.append(build_mesh('Helm' + k, hs, hf, list(hm), {'Head': np.ones(len(hs))}))
for e in extra:
    if len(e) == 5:
        KP, kf, m, _, kset = e
        grpw = {k: v[kset] for k, v in W.items()}
        parts.append(build_mesh('Pad', KP, kf, [m] * len(kf), grpw))
    else:
        vs, fs, m, bone = e
        parts.append(build_mesh('Part', vs, fs, [m] * len(fs), {bone: np.ones(len(vs))}))
# Zusammenführen und glätten
bpy.ops.object.select_all(action='DESELECT')
for o in parts: o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body = bpy.context.view_layer.objects.active; body.name = 'Rider'
sub = body.modifiers.new('Sub', 'SUBSURF'); sub.levels = 1; sub.render_levels = 1
bpy.ops.object.modifier_move_to_index(modifier='Sub', index=0)
bpy.ops.object.modifier_apply(modifier='Sub')
mj, mja, mp, mpa = (MLIST.index(n) for n in ('Jersey', 'JerseyAccent', 'Pants', 'PantsAccent'))
for poly in body.data.polygons:
    c = poly.center
    if poly.material_index == mj and abs(c.z - chestZ) < 0.03 and abs(c.x) < J['upperarm_l'][0] + 0.01:
        poly.material_index = mja
    if poly.material_index == mp and c.z > J['calf_l'][2] - 0.3:
        legx = J['thigh_l'][0] if c.x > 0 else J['thigh_r'][0]
        if (c.x - legx) * (1 if c.x > 0 else -1) > 0.06 and abs(c.y) < 0.022:
            poly.material_index = mpa
# Pferdeschwanz aus dem alten Modell übernehmen (an den neuen Kopf versetzt)
old = os.path.join(HERE, 'glb', 'riderData.glb')
before = set(bpy.data.objects)
bpy.ops.import_scene.gltf(filepath=old)
newo = set(bpy.data.objects) - before
oldrig = [o for o in newo if o.type == 'ARMATURE'][0]
oldHead = oldrig.data.bones['Head'].head_local.copy()
pt = [o for o in newo if o.name.startswith('Ponytail')][0]
pt.parent = None
pt.matrix_world = Matrix.Translation(Vector(J['Head']) - oldHead + Vector((0, 0.012, 0.02)))
bpy.context.view_layer.objects.active = pt; bpy.ops.object.select_all(action='DESELECT'); pt.select_set(True)
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
for m in pt.modifiers: pt.modifiers.remove(m)
pt.parent = ao; mod = pt.modifiers.new('Armature', 'ARMATURE'); mod.object = ao; pt.name = 'Ponytail'
for o in newo:
    if o != pt: bpy.data.objects.remove(o, do_unlink=True)
for h in helms:
    bpy.ops.object.select_all(action='DESELECT'); h.select_set(True); bpy.context.view_layer.objects.active = h
    sm = h.modifiers.new('Sub', 'SUBSURF'); sm.levels = 1; bpy.ops.object.modifier_move_to_index(modifier='Sub', index=0); bpy.ops.object.modifier_apply(modifier='Sub')
print('verts', len(body.data.vertices), 'faces', len(body.data.polygons))
bpy.ops.object.select_all(action='DESELECT')
for o in (ao, body, pt, *helms): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_skins=True, export_animations=False, export_morph=False, export_yup=True, export_image_format='WEBP')
print('exported', OUT)
