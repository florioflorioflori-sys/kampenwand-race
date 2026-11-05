# Verfeinert das Downhill-Bike: echte Stollenreifen, Kassette, Kettenblatt mit Zähnen,
# Gliederkette, Bremssättel, Leitungen, Pedal-Pins. Teile- und Materialnamen bleiben gleich.
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix
HERE = os.path.dirname(os.path.abspath(__file__))
OUT = sys.argv[sys.argv.index('--') + 1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=os.path.join(HERE, 'glb', 'bikeData.glb'))
ob = {o.name: o for o in bpy.context.scene.objects if o.type == 'MESH'}
MAT = {}
for o in ob.values():
    for m in o.data.materials: MAT[m.name] = m

def add_geo(target, bm_src, matname):
    """bmesh in ein Teil einfügen, Material zuweisen"""
    me = target.data
    if MAT[matname].name not in [m.name for m in me.materials]: me.materials.append(MAT[matname])
    mi = [m.name for m in me.materials].index(MAT[matname].name)
    tmp = bpy.data.meshes.new('tmp'); bm_src.to_mesh(tmp); bm_src.free()
    for p in tmp.polygons: p.material_index = 0
    bm = bmesh.new(); bm.from_mesh(me)
    n0 = len(bm.faces)
    bm2 = bmesh.new(); bm2.from_mesh(tmp)
    vmap = {}
    for v in bm2.verts: vmap[v] = bm.verts.new(v.co)
    for f in bm2.faces:
        try:
            nf = bm.faces.new([vmap[v] for v in f.verts]); nf.material_index = mi; nf.smooth = f.smooth
        except ValueError: pass
    bm.to_mesh(me); bm.free(); bm2.free(); bpy.data.meshes.remove(tmp)

def box(bm, c, size, rot=Matrix.Identity(3), bevel=0.0):
    r = bmesh.ops.create_cube(bm, size=1.0)
    vs = r['verts']
    for v in vs: v.co = rot @ Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2])) + Vector(c)
    return vs

def cyl(bm, c, r1, depth, axis='X', seg=16, r2=None):
    rr = bmesh.ops.create_cone(bm, cap_ends=True, segments=seg, radius1=r1, radius2=r2 if r2 is not None else r1, depth=depth)
    M = {'X': Matrix.Rotation(math.pi / 2, 3, 'Y'), 'Y': Matrix.Rotation(math.pi / 2, 3, 'X'), 'Z': Matrix.Identity(3)}[axis]
    for v in rr['verts']: v.co = M @ v.co + Vector(c)
    for f in bm.faces: f.smooth = True
    return rr['verts']

# ---------------- Reifen
def tire():
    bm = bmesh.new()
    R0, rt, wid = 0.343, 0.034, 1.0
    NU, NV = 160, 20
    vs = []
    for i in range(NU):
        a = i / NU * 2 * math.pi
        row = []
        for j in range(NV):
            b = j / NV * 2 * math.pi
            # Reifenquerschnitt: breiter Ballon, innen zur Felge offen
            x = math.sin(b) * rt * 1.0
            rr = R0 + math.cos(b) * rt
            row.append(bm.verts.new((x, math.cos(a) * rr, math.sin(a) * rr)))
        vs.append(row)
    for i in range(NU):
        for j in range(NV):
            f = bm.faces.new([vs[i][j], vs[(i + 1) % NU][j], vs[(i + 1) % NU][(j + 1) % NV], vs[i][(j + 1) % NV]]); f.smooth = True
    # Stollen: Mittel-, Übergangs- und Schulterstollen, versetzt
    NK = 46
    for k in range(NK):
        a0 = k / NK * 2 * math.pi
        rows = [(0.0, 0.016, 0.011, 0.0)] if k % 2 == 0 else [(-0.011, 0.01, 0.009, 0.0), (0.011, 0.01, 0.009, 0.0)]
        rows += [(-0.024, 0.009, 0.012, 0.5), (0.024, 0.009, 0.012, 0.5)] if k % 2 == 1 else [(-0.029, 0.008, 0.014, 0.9), (0.029, 0.008, 0.014, 0.9)]
        for (x, w, l, side) in rows:
            b = math.asin(max(-1, min(1, x / rt)))
            rr = R0 + math.cos(b) * rt
            a = a0 + (0.5 / NK * 2 * math.pi if side > 0.6 else 0)
            h = 0.0075
            c = Vector((x, math.cos(a) * (rr + h / 2 - 0.001), math.sin(a) * (rr + h / 2 - 0.001)))
            rot = Matrix.Rotation(a, 3, 'X') @ Matrix.Rotation(-b, 3, 'Y')
            r = bmesh.ops.create_cube(bm, size=1.0)
            for v in r['verts']:
                p = Vector((v.co.x * w, v.co.z * h, v.co.y * l)) if False else Vector((v.co.x * w, v.co.y * l, v.co.z * h))
                # Stollen stehen radial: lokale z = radial
                p = Matrix.Rotation(math.pi / 2 - a, 3, 'X') @ p if False else p
                v.co = p
            # radial ausrichten: lokales z -> radial, y -> tangential
            radial = Vector((math.sin(b), math.cos(a) * math.cos(b), math.sin(a) * math.cos(b)))
            tang = Vector((0, -math.sin(a), math.cos(a)))
            side_v = tang.cross(radial).normalized()
            M = Matrix((side_v, tang, radial)).transposed()
            for v in r['verts']:
                v.co = M @ v.co + c
                # Stollen oben leicht schmaler (Fase)
            top = [v for v in r['verts'] if (v.co - c).dot(radial) > 0]
            for v in top:
                d = v.co - c; d -= radial * d.dot(radial)
                v.co -= d * 0.18
    return bm

for wn in ('WheelF', 'WheelR'):
    o = ob[wn]; me = o.data
    names = [m.name for m in me.materials]
    if 'Rubber' in names:
        ri = names.index('Rubber')
        bm = bmesh.new(); bm.from_mesh(me)
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index == ri], context='FACES')
        bmesh.ops.delete(bm, geom=[v for v in bm.verts if not v.link_faces], context='VERTS')
        bm.to_mesh(me); bm.free()
    add_geo(o, tire(), 'Rubber')

# ---------------- Kassette am Hinterrad (Antriebsseite rechts = -X)
bm = bmesh.new()
for i, (r, teeth) in enumerate([(0.052, 36), (0.046, 32), (0.040, 28), (0.035, 24), (0.031, 21), (0.027, 18), (0.023, 15)]):
    x = -0.032 - i * 0.0042
    cyl(bm, (x, 0, 0), r - 0.003, 0.0018, 'X', seg=teeth * 2)
    for t in range(teeth):
        a = t / teeth * 2 * math.pi
        box(bm, (x, math.cos(a) * r, math.sin(a) * r), (0.0018, 0.004, 0.006), Matrix.Rotation(a - math.pi / 2, 3, 'X'))
add_geo(ob['WheelR'], bm, 'Metal')

# ---------------- Kettenblatt mit Zähnen und Kettenführung an der Kurbel
bm = bmesh.new()
RC, T = 0.072, 34
cyl(bm, (-0.045, 0, 0), RC - 0.004, 0.003, 'X', seg=68)
for t in range(T):
    a = t / T * 2 * math.pi
    box(bm, (-0.045, math.cos(a) * RC, math.sin(a) * RC), (0.003, 0.005, 0.007), Matrix.Rotation(a - math.pi / 2, 3, 'X'))
add_geo(ob['Crank'], bm, 'Metal')
bm = bmesh.new()
cyl(bm, (-0.05, 0, 0), 0.03, 0.012, 'X', seg=24)
add_geo(ob['Crank'], bm, 'Black')

# ---------------- Kette: Glieder vom Kettenblatt (Tretlager) zur Kassette (Hinterachse) am Hinterbau
BB = Vector((0, 0.0, 0.31)); RA = Vector((0, 0.665, 0.37))
def chain_path():
    pts = []
    d = (RA - BB); ang = math.atan2(d.z, d.y)
    up = Vector((0, -math.sin(ang), math.cos(ang)))
    top0, top1 = BB + up * RC, RA + up * 0.036
    bot0, bot1 = BB - up * RC, RA - up * 0.036
    n = 44
    for i in range(n + 1): pts.append(top0.lerp(top1, i / n))
    for i in range(10):  # um die Kassette
        a = math.pi / 2 - i / 10 * math.pi
        pts.append(RA + up * 0.036 * math.sin(a) + (d.normalized()) * 0.036 * math.cos(a))
    for i in range(n + 1): pts.append(bot1.lerp(bot0, i / n))
    return pts
bm = bmesh.new()
pts = chain_path()
for i in range(len(pts) - 1):
    a, b = pts[i], pts[i + 1]
    c = (a + b) / 2; dvec = (b - a); L = dvec.length
    if L < 1e-4: continue
    rot = dvec.normalized().to_track_quat('Y', 'X').to_matrix()
    for sx in (-0.043, -0.051):
        box(bm, (sx, c.y, c.z), (0.0012, L * 1.05, 0.006), rot)
    cyl(bm, (-0.047, a.y, a.z), 0.0022, 0.0095, 'X', seg=6)
add_geo(ob['Swing'], bm, 'Metal')

# ---------------- Bremssättel (links, +X) vorn an der Gabel, hinten am Hinterbau
def caliper(target, axle, ang):
    bm = bmesh.new()
    p = axle + Vector((0, math.cos(ang), math.sin(ang))) * 0.1
    rot = Matrix.Rotation(ang, 3, 'X')
    box(bm, (0.058, p.y, p.z), (0.026, 0.07, 0.036), rot)
    box(bm, (0.058, p.y, p.z) , (0.03, 0.05, 0.02), rot)
    add_geo(target, bm, 'Black')
    bm = bmesh.new()
    for k in (-0.018, 0.018):
        q = p + Vector((0, math.cos(ang), math.sin(ang))) * 0.0 + Vector((0, -math.sin(ang), math.cos(ang))) * 0 + Vector((0, math.cos(ang + math.pi / 2), math.sin(ang + math.pi / 2))) * k
        cyl(bm, (0.073, q.y, q.z), 0.006, 0.006, 'X', seg=10)
    add_geo(target, bm, 'Gold')
FA = Vector((0, -0.665, 0.37))
caliper(ob['ForkLower'], FA, math.radians(115))
caliper(ob['Swing'], RA, math.radians(60))

# ---------------- Bremsleitungen und Schaltzug (Frame), Leitung an der Gabel (Steer)
def hose(target, pts, r=0.0035):
    bm = bmesh.new()
    for i in range(len(pts) - 1):
        a, b = Vector(pts[i]), Vector(pts[i + 1])
        c = (a + b) / 2; d = b - a
        rr = bmesh.ops.create_cone(bm, cap_ends=False, segments=8, radius1=r, radius2=r, depth=d.length * 1.02)
        M = d.normalized().to_track_quat('Z', 'Y').to_matrix()
        for v in rr['verts']: v.co = M @ v.co + c
    for f in bm.faces: f.smooth = True
    add_geo(target, bm, 'Black')
def bez(p0, p1, p2, n=12):
    p0, p1, p2 = Vector(p0), Vector(p1), Vector(p2)
    return [(1 - t) ** 2 * p0 + 2 * (1 - t) * t * p1 + t * t * p2 for t in [i / n for i in range(n + 1)]]
hose(ob['Frame'], bez((0.03, -0.5, 0.95), (0.06, -0.35, 0.72), (0.04, 0.0, 0.36), 16))
hose(ob['Frame'], bez((-0.03, -0.5, 0.95), (-0.06, -0.33, 0.7), (-0.04, 0.02, 0.34), 16), 0.0028)
hose(ob['Steer'], bez((0.33, -0.5, 1.02), (0.2, -0.62, 0.98), (0.07, -0.56, 0.8), 14))

# ---------------- Pedal-Pins
bm = bmesh.new()
for sx in (-0.042, -0.02, 0.0, 0.02, 0.042):
    for sy in (-0.042, 0.042):
        for sz in (0.016, -0.016):
            cyl(bm, (sx, sy, sz), 0.0022, 0.008, 'Z', seg=6)
add_geo(ob['Pedal'], bm, 'Metal')


# ---------------- Rahmen in drei Formen: glatte, hydrogeformte Rohre (Querschnitt oval), Knotenbleche
import numpy as np
def G(y, z): return np.array([0.0, -z, y])   # Spiel (y oben, z vorn) -> Blender
def catmull(P, n=48):
    P = [np.array(p, float) for p in P]
    if len(P) == 2: return np.array([P[0] + (P[1] - P[0]) * t for t in np.linspace(0, 1, n)])
    Q = [P[0] * 2 - P[1]] + P + [P[-1] * 2 - P[-2]]
    out = []
    seg = len(P) - 1
    for i in range(seg):
        p0, p1, p2, p3 = Q[i], Q[i + 1], Q[i + 2], Q[i + 3]
        for t in np.linspace(0, 1, n // seg, endpoint=(i == seg - 1)):
            out.append(0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3))
    return np.array(out)
def sweep(bm, pts, radii, sx=1.0, seg=20, cap=True, t0=0.0, t1=1.0):
    C = catmull(pts); n = len(C)
    rr = np.interp(np.linspace(0, 1, n), np.linspace(0, 1, len(radii)), radii)
    i0, i1 = int(round(t0 * (n - 1))), int(round(t1 * (n - 1)))
    C = C[i0:i1 + 1]; rr = rr[i0:i1 + 1]
    rings = []
    for k in range(len(C)):
        T = C[min(k + 1, len(C) - 1)] - C[max(k - 1, 0)]; T /= np.linalg.norm(T)
        X = np.array([1.0, 0, 0]); X = X - T * T.dot(X)
        if np.linalg.norm(X) < 1e-4: X = np.array([0, 1.0, 0]) - T * T[1]
        X /= np.linalg.norm(X); Nn = np.cross(T, X)
        ring = [bm.verts.new(Vector(C[k] + rr[k] * (sx * math.cos(a) * X + math.sin(a) * Nn))) for a in np.linspace(0, 2 * math.pi, seg, endpoint=False)]
        rings.append(ring)
    for a, b in zip(rings[:-1], rings[1:]):
        for j in range(seg):
            f = bm.faces.new([a[j], a[(j + 1) % seg], b[(j + 1) % seg], b[j]]); f.smooth = True
    if cap:
        for ring, rev in ((rings[0], True), (rings[-1], False)):
            c = bm.verts.new(Vector(np.mean([np.array(v.co) for v in ring], 0)))
            for j in range(seg):
                vs = [ring[j], ring[(j + 1) % seg], c]
                bm.faces.new(vs[::-1] if rev else vs).smooth = True
def plate(bm, pts, th=0.012):
    """flaches Knotenblech (Polygon in der Seitenebene, Dicke in x)"""
    top = [bm.verts.new(Vector((th / 2, p[1], p[2]))) for p in pts]; bot = [bm.verts.new(Vector((-th / 2, p[1], p[2]))) for p in pts]
    bm.faces.new(top); bm.faces.new(bot[::-1]); n = len(pts)
    for i in range(n):
        bm.faces.new([top[i], bot[i], bot[(i + 1) % n], top[(i + 1) % n]])
BB, HTB, HTT, SEAT, SA, SB, PIV = (0.34, -0.04), (0.84, 0.5), (0.99, 0.45), (0.78, -0.25), (0.66, -0.15), (0.45, 0.06), (0.40, -0.07)
def lerp(a, b, t): return (a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t)
def common(bmP, bmA):
    # Steuerrohr (konisch), Tretlagergehäuse, Sitzrohr mit Klemme, Dämpferaufnahmen, Hauptlager
    sweep(bmP, [G(*lerp(HTB, HTT, -0.15)), G(*lerp(HTB, HTT, 1.12))], [0.037, 0.031], seg=24)
    cyl(bmP, (0, -BB[1], BB[0]), 0.026, 0.092, 'X', seg=24)
    sweep(bmP, [G(*BB), G(*lerp(BB, SEAT, 0.5)), G(*SEAT)], [0.022, 0.019, 0.018], seg=18)
    sweep(bmA, [G(*lerp(BB, SEAT, 0.96)), G(*lerp(BB, SEAT, 1.02))], [0.021, 0.021], seg=18)
    for (y, z) in (SA, SB):
        for sx in (-0.022, 0.022):
            cyl(bmP, (sx, -z, y), 0.016, 0.008, 'X', seg=14)
    cyl(bmP, (0, -PIV[1], PIV[0]), 0.022, 0.1, 'X', seg=18)
def frameA(bmP, bmA):   # Klassiker: gerades Oberrohr, kräftiges Unterrohr, Knotenblech am Steuerrohr
    common(bmP, bmA)
    tt0 = lerp(HTB, HTT, 0.85); tte = lerp(BB, SEAT, 0.83)
    sweep(bmP, [G(*tt0), G((tt0[0] + tte[0]) / 2 + 0.01, (tt0[1] + tte[1]) / 2), G(*tte)], [0.027, 0.022, 0.021], sx=0.9)
    dt0 = lerp(HTB, HTT, 0.2); dte = (0.40, 0.03)
    dt = [G(*dt0), G(0.64, 0.28), G(*dte)]
    sweep(bmP, dt, [0.036, 0.034, 0.032], sx=1.3)
    sweep(bmA, dt, [0.0375, 0.0355, 0.0335], sx=1.3, cap=False, t0=0.32, t1=0.55)
    plate(bmP, [G(*lerp(HTB, HTT, 0.85)), G(*lerp(HTB, HTT, 0.15)), G(0.72, 0.36), G(0.86, 0.25)])
    sweep(bmP, [G(*lerp(tt0, tte, 0.72)), G(*SA)], [0.014, 0.014])
def frameB(bmP, bmA):   # tiefer Durchstieg: Oberrohr fällt geschwungen ins Sitzrohr, Unterrohr gebogen
    common(bmP, bmA)
    tt0 = lerp(HTB, HTT, 0.8); tte = lerp(BB, SEAT, 0.6)
    tt = [G(*tt0), G(0.9, 0.22), G(0.76, -0.02), G(*tte)]
    sweep(bmP, tt, [0.029, 0.026, 0.024, 0.022], sx=1.05)
    sweep(bmA, tt, [0.0305, 0.0275, 0.0255, 0.0235], sx=1.05, cap=False, t0=0.18, t1=0.3)
    dt = [G(*lerp(HTB, HTT, 0.15)), G(0.66, 0.36), G(0.47, 0.17), G(0.39, 0.03)]
    sweep(bmP, dt, [0.038, 0.037, 0.035, 0.032], sx=1.2)
    sweep(bmP, [G(0.79, 0.05), G(*SA)], [0.016, 0.015])
def frameC(bmP, bmA):   # Fachwerk: langes gerades Oberrohr bis zur Sattelklemme, Strebe, breites flaches Unterrohr
    common(bmP, bmA)
    tt0 = lerp(HTB, HTT, 0.9); tte = lerp(BB, SEAT, 0.92)
    tt = [G(*tt0), G(*tte)]
    sweep(bmP, tt, [0.024, 0.02], sx=1.15)
    dt = [G(*lerp(HTB, HTT, 0.1)), G(0.6, 0.24), G(0.41, 0.03)]
    sweep(bmP, dt, [0.033, 0.034, 0.03], sx=1.55)
    sweep(bmA, dt, [0.0345, 0.0355, 0.0315], sx=1.55, cap=False, t0=0.55, t1=0.8)
    sweep(bmP, [G(0.62, 0.27), G(*lerp(tt0, tte, 0.28))], [0.017, 0.014])
    sweep(bmP, [G(*lerp(tt0, tte, 0.62)), G(*SA)], [0.015, 0.015])
frame0 = ob['Frame']
def strip_paint(o):
    bm = bmesh.new(); bm.from_mesh(o.data)
    pidx = [i for i, m in enumerate(o.data.materials) if m.name in ('Paint', 'PaintAccent')]
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.material_index in pidx], context='FACES')
    bm.to_mesh(o.data); bm.free()
variants = []
for name, fn in (('Frame', frameA), ('Frame2', frameB), ('Frame3', frameC)):
    o = frame0 if name == 'Frame' else frame0.copy()
    if o is not frame0:
        o.data = frame0.data.copy(); o.name = name; bpy.context.scene.collection.objects.link(o)
    variants.append((o, fn))
for o, fn in variants:
    strip_paint(o)
    bmP, bmA = bmesh.new(), bmesh.new(); fn(bmP, bmA)
    add_geo(o, bmP, 'Paint'); add_geo(o, bmA, 'PaintAccent')
    ob[o.name] = o

# glatte Schattierung überall, Kanten weich
for o in ob.values():
    for p in o.data.polygons: p.use_smooth = True
    mod = o.modifiers.new('wn', 'WEIGHTED_NORMAL'); mod.keep_sharp = True
    bpy.context.view_layer.objects.active = o
    bpy.ops.object.select_all(action='DESELECT'); o.select_set(True)
    bpy.ops.object.modifier_apply(modifier='wn')
    print(o.name, len(o.data.vertices))
bpy.ops.object.select_all(action='DESELECT')
for o in ob.values(): o.select_set(True)
bpy.ops.export_scene.gltf(filepath=OUT, export_format='GLB', use_selection=True, export_yup=True)
print('exported')
