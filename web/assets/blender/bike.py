# Downhill-Bike für Kampenwand Downhill, per Skript in Blender gebaut.
# Aufruf: python bike.py <ausgabe.glb> [vorschau.png]
# Alle Maße in Spiel-Koordinaten (x links, y oben, z vorne); G() rechnet in Blender um.
import bpy, bmesh, math, sys
from mathutils import Vector, Matrix

out = sys.argv[1]; preview = sys.argv[2] if len(sys.argv) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
def G(x, y, z): return Vector((x, -z, y))
R = 0.37

def mat(name, col, rough=0.5, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m
M = {n: mat(n, c, r, mt) for n, c, r, mt in [
    ('Paint', (0.05, 0.05, 0.05), 0.3, 0.3), ('PaintAccent', (0.9, 0.3, 0.05), 0.35, 0.2), ('Black', (0.02, 0.02, 0.02), 0.45, 0.4),
    ('Metal', (0.7, 0.7, 0.7), 0.25, 1.0), ('Gold', (0.85, 0.6, 0.2), 0.2, 1.0), ('Spring', (0.9, 0.3, 0.05), 0.35, 0.3),
    ('Rubber', (0.025, 0.025, 0.025), 0.9, 0.0), ('Rotor', (0.6, 0.6, 0.62), 0.3, 1.0), ('Saddle', (0.03, 0.03, 0.03), 0.6, 0.0)]}

class MB:
    """sammelt Geometrie für ein Objekt, Materialien nach Namen"""
    def __init__(self, name): self.name = name; self.bm = bmesh.new(); self.mats = []
    def mi(self, m):
        if m not in self.mats: self.mats.append(m)
        return self.mats.index(m)
    def add(self, bm2, m, smooth=True):
        i = self.mi(m); me = bpy.data.meshes.new('t'); bm2.to_mesh(me); bm2.free()
        for f in me.polygons: f.material_index = i; f.use_smooth = smooth
        self.bm.from_mesh(me); bpy.data.meshes.remove(me)
    def obj(self, loc=None):
        me = bpy.data.meshes.new(self.name); self.bm.to_mesh(me); self.bm.free()
        for m in self.mats: me.materials.append(M[m])
        o = bpy.data.objects.new(self.name, me); scn.collection.objects.link(o)
        if loc is not None: o.location = loc
        return o

def tube(mb, a, b, r0, r1=None, m='Paint', seg=12, sx=1.0, cap=True):
    """Rohr zwischen zwei Punkten (Spiel-Koordinaten), sx = ovale Breite"""
    r1 = r0 if r1 is None else r1
    A, Bv = G(*a), G(*b); d = Bv - A; L = d.length
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=cap, segments=seg, radius1=r0, radius2=r1, depth=L)
    for v in bm.verts: v.co.x *= sx
    q = Vector((0, 0, 1)).rotation_difference(d.normalized())
    bmesh.ops.transform(bm, verts=bm.verts, matrix=Matrix.Translation((A + Bv) / 2) @ q.to_matrix().to_4x4())
    mb.add(bm, m)
def ball(mb, c, r, m='Paint', sc=(1, 1, 1)):
    bm = bmesh.new(); bmesh.ops.create_uvsphere(bm, u_segments=12, v_segments=8, radius=r)
    for v in bm.verts: v.co = Vector((v.co.x * sc[0], v.co.y * sc[1], v.co.z * sc[2])) + G(*c)
    mb.add(bm, m)
def box(mb, c, s, m='Black', rot=None, bevel=0.0):
    bm = bmesh.new(); bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * s[0], v.co.z * s[2] * -1, v.co.y * s[1]))  # s in Spiel-Achsen
    if bevel: bmesh.ops.bevel(bm, geom=bm.edges[:], offset=bevel, segments=2, affect='EDGES')
    if rot: bmesh.ops.rotate(bm, verts=bm.verts, matrix=Matrix.Rotation(rot, 3, 'X'))
    bmesh.ops.translate(bm, verts=bm.verts, vec=G(*c))
    mb.add(bm, m, smooth=False)
def helix(mb, a, b, r, turns, t, m):
    A, Bv = G(*a), G(*b); d = Bv - A; q = Vector((0, 0, 1)).rotation_difference(d.normalized()).to_matrix()
    bm = bmesh.new(); n = turns * 14; prev = None; rings = []
    for i in range(n + 1):
        an = i / n * turns * 2 * math.pi; c = Vector((math.cos(an) * r, math.sin(an) * r, i / n * d.length))
        tng = Vector((-math.sin(an) * r, math.cos(an) * r, d.length / n / (2 * math.pi / 14) * 0 + d.length / (turns * 2 * math.pi))).normalized()
        nrm = Vector((math.cos(an), math.sin(an), 0)); bn = tng.cross(nrm)
        ring = [bm.verts.new(A + q @ (c + (nrm * math.cos(k / 6 * 2 * math.pi) + bn * math.sin(k / 6 * 2 * math.pi)) * t)) for k in range(6)]
        if prev:
            for k in range(6): bm.faces.new((prev[k], prev[(k + 1) % 6], ring[(k + 1) % 6], ring[k]))
        prev = ring
    mb.add(bm, m)

# ---------------- Rahmen ----------------
fr = MB('Frame')
bb = (0, 0.36, -0.03)
tube(fr, bb, (0, 0.83, 0.5), 0.036, 0.03, 'Paint', 16, 1.25)                # Unterrohr, oval
tube(fr, (0, 0.52, 0.17), (0, 0.66, 0.36), 0.0372, 0.0335, 'PaintAccent', 16, 1.27)  # Dekor-Feld
tube(fr, (0, 0.7, -0.2), (0, 0.965, 0.45), 0.026, 0.024, 'Paint', 14, 1.1)   # Oberrohr
tube(fr, bb, (0, 0.78, -0.24), 0.03, 0.026, 'Paint', 14)                      # Sitzrohr
tube(fr, (0, 0.78, -0.24), (0, 0.84, -0.26), 0.016, 0.016, 'Black', 10)       # Sattelstütze
tube(fr, (0, 0.815, 0.508), (0, 1.0, 0.445), 0.036, 0.036, 'Paint', 16)       # Steuerrohr
ball(fr, bb, 0.042, 'Paint', (1.6, 1, 1))                                      # Tretlager
box(fr, (0, 0.88, 0.4), (0.03, 0.09, 0.12), 'Paint', rot=0.6)                 # Knotenblech
# Hinterbau: Kettenstreben, Sitzstreben, Wippe
for sx in (1, -1):
    tube(fr, (0.05 * sx, 0.4, -0.08), (0.066 * sx, R, -0.66), 0.022, 0.016, 'Paint', 10, 1.4)
    tube(fr, (0.066 * sx, R, -0.66), (0.045 * sx, 0.64, -0.24), 0.016, 0.02, 'Paint', 10, 1.2)
    box(fr, (0.066 * sx, R, -0.66), (0.012, 0.06, 0.06), 'Paint', bevel=0.01)  # Ausfallende
    box(fr, (0.035 * sx, 0.67, -0.18), (0.012, 0.045, 0.13), 'Black', rot=0.5, bevel=0.008)  # Wippe
tube(fr, (0.066, R, -0.66), (-0.066, R, -0.66), 0.012, 0.012, 'Metal', 8)
# Dämpfer mit Feder und Ausgleichsbehälter
sa, sb = (0, 0.66, -0.15), (0, 0.45, 0.06)
tube(fr, sa, (0, 0.55, -0.045), 0.02, 0.02, 'Black', 12)
tube(fr, (0, 0.56, -0.055), sb, 0.012, 0.012, 'Metal', 10)
helix(fr, (0, 0.635, -0.125), (0, 0.48, 0.03), 0.034, 7, 0.006, 'Spring')
tube(fr, (0.035, 0.63, -0.12), (0.035, 0.57, -0.06), 0.014, 0.014, 'Gold', 10)  # Piggyback
# Sattel
sad = bmesh.new(); bmesh.ops.create_uvsphere(sad, u_segments=16, v_segments=8, radius=1)
for v in sad.verts:
    p = v.co; w = 0.075 * (1 - 0.6 * max(0, -p.y)) if p.y < 0 else 0.075
    v.co = Vector((p.x * w, p.y * 0.14, p.z * 0.028 + (0.01 if p.y > 0.5 else 0))) + G(0, 0.865, -0.27)
fr.add(sad, 'Saddle')
# Antrieb: Kettenblatt, Kette, Kettenführung, Schaltwerk, Bremssattel hinten
ring = bmesh.new(); bmesh.ops.create_cone(ring, cap_ends=True, segments=32, radius1=0.078, radius2=0.078, depth=0.004)
bmesh.ops.rotate(ring, verts=ring.verts, matrix=Matrix.Rotation(math.pi / 2, 3, 'Y')); bmesh.ops.translate(ring, verts=ring.verts, vec=G(0.06, *bb[1:]))
fr.add(ring, 'Metal', False)
for y0, y1 in ((0.438, R + 0.055), (0.282, R - 0.055)):
    tube(fr, (0.062, y0, bb[2]), (0.066, y1, -0.66), 0.005, 0.005, 'Black', 5)
box(fr, (0.065, 0.39, 0.02), (0.012, 0.09, 0.05), 'Black', bevel=0.005)
box(fr, (0.085, R - 0.08, -0.66), (0.02, 0.08, 0.04), 'Black', bevel=0.006)
box(fr, (-0.075, R + 0.07, -0.6), (0.03, 0.06, 0.08), 'Black', bevel=0.008)
frame = fr.obj()

# ---------------- Lenkung: Doppelbrückengabel, Vorbau, Lenker ----------------
st = MB('Steer')
fa = Vector((0, -0.35, 0.95)).normalized()  # Gabelachse (Spiel: y oben, z vorn) ~ 70°
def onfork(t): return (0, 1.0 - fa.y * 0 + 0, 0)
top, axle = Vector((0, 1.02, 0.44)), Vector((0, R, 0.66))
ax = (axle - top).normalized()
for sx in (1, -1):
    p0 = top + ax * 0.03; p1 = top + ax * 0.36; p2 = top + ax * 0.33; p3 = axle
    tube(st, (0.078 * sx, p0.y, p0.z), (0.078 * sx, p1.y, p1.z), 0.019, 0.019, 'Gold', 12)       # Standrohre
    tube(st, (0.078 * sx, p2.y, p2.z), (0.078 * sx, p3.y, p3.z), 0.028, 0.025, 'Black', 14)      # Tauchrohre
    box(st, (0.078 * sx, R, 0.66), (0.03, 0.05, 0.05), 'Black', bevel=0.008)
for t in (0.04, 0.2):
    c = top + ax * t
    box(st, (0, c.y, c.z), (0.2, 0.03, 0.06), 'Black', rot=-0.35, bevel=0.01)                  # Gabelbrücken
tube(st, (0.09, R, 0.66), (-0.09, R, 0.66), 0.01, 0.01, 'Metal', 8)
box(st, (-0.1, R + 0.08, 0.6), (0.03, 0.06, 0.08), 'Black', bevel=0.008)                       # Bremssattel vorn
box(st, (0, 1.045, 0.43), (0.06, 0.04, 0.07), 'Black', bevel=0.008)                            # Vorbau
# Lenker mit Kröpfung und Griffe
pts = [(-0.39, 1.075, 0.40), (-0.26, 1.07, 0.405), (-0.12, 1.05, 0.425), (0, 1.05, 0.43), (0.12, 1.05, 0.425), (0.26, 1.07, 0.405), (0.39, 1.075, 0.40)]
for a, b in zip(pts, pts[1:]): tube(st, a, b, 0.012, 0.012, 'Black', 10)
for i in range(1, len(pts) - 1): ball(st, pts[i], 0.012, 'Black')
for sx in (1, -1):
    tube(st, (0.29 * sx, 1.072, 0.402), (0.392 * sx, 1.075, 0.4), 0.018, 0.018, 'Rubber', 12)
    tube(st, (0.2 * sx, 1.085, 0.405), (0.3 * sx, 1.07, 0.48), 0.006, 0.005, 'Metal', 6)          # Bremshebel
    box(st, (0.2 * sx, 1.085, 0.4), (0.03, 0.025, 0.03), 'Black')
steer = st.obj()

# ---------------- Laufrad (um die Achse zentriert) ----------------
def wheel(name):
    w = MB(name)
    # Reifen mit Stollen
    tr = bmesh.new(); bmesh.ops.create_cone(tr, segments=4, radius1=1, radius2=1, depth=1)  # Platzhalter
    tr.free()
    tire = bmesh.new()
    seg, ms = 48, 12
    rows = []
    for i in range(seg):
        a = i / seg * 2 * math.pi; row = []
        for k in range(ms):
            b = k / ms * 2 * math.pi
            rr = R - 0.047 + math.cos(b) * 0.047
            row.append(tire.verts.new((math.sin(b) * 0.033, math.cos(a) * rr, math.sin(a) * rr)))
        rows.append(row)
    for i in range(seg):
        for k in range(ms): tire.faces.new((rows[i][k], rows[i][(k + 1) % ms], rows[(i + 1) % seg][(k + 1) % ms], rows[(i + 1) % seg][k]))
    w.add(tire, 'Rubber')
    # Stollen in zwei versetzten Reihen plus Mitte
    for i in range(40):
        a = i / 40 * 2 * math.pi
        for off in ((0.02, 0) if i % 2 else (-0.02, 0), (0.0, 1)):
            if off[1] == 1 and i % 2: continue
            kn = bmesh.new(); bmesh.ops.create_cube(kn, size=1)
            for v in kn.verts: v.co = Vector((v.co.x * 0.016, v.co.y * 0.014, v.co.z * 0.012))
            bmesh.ops.translate(kn, verts=kn.verts, vec=Vector((off[0], 0, R + 0.002)))
            bmesh.ops.rotate(kn, verts=kn.verts, matrix=Matrix.Rotation(-a, 3, 'X'))
            w.add(kn, 'Rubber', False)
    # Felge (Hohlkammer), Nabe, Speichen, Bremsscheibe
    rim = bmesh.new(); bmesh.ops.create_cone(rim, cap_ends=False, segments=48, radius1=R - 0.088, radius2=R - 0.088, depth=0.03)
    rim2 = bmesh.new(); bmesh.ops.create_cone(rim2, cap_ends=False, segments=48, radius1=R - 0.105, radius2=R - 0.105, depth=0.024)
    for b_ in (rim, rim2): bmesh.ops.rotate(b_, verts=b_.verts, matrix=Matrix.Rotation(math.pi / 2, 3, 'Y'))
    w.add(rim, 'Black'); w.add(rim2, 'Black')
    hub = bmesh.new(); bmesh.ops.create_cone(hub, cap_ends=True, segments=14, radius1=0.028, radius2=0.028, depth=0.14)
    bmesh.ops.rotate(hub, verts=hub.verts, matrix=Matrix.Rotation(math.pi / 2, 3, 'Y')); w.add(hub, 'Black')
    for i in range(32):
        a = i / 32 * 2 * math.pi; sd = 0.035 if i % 2 else -0.035
        h = Vector((sd, math.cos(a + 0.18) * 0.026, math.sin(a + 0.18) * 0.026)); r_ = Vector((0, math.cos(a) * (R - 0.1), math.sin(a) * (R - 0.1)))
        sp = bmesh.new(); bmesh.ops.create_cone(sp, cap_ends=False, segments=4, radius1=0.0022, radius2=0.0022, depth=(r_ - h).length)
        q = Vector((0, 0, 1)).rotation_difference((r_ - h).normalized())
        bmesh.ops.transform(sp, verts=sp.verts, matrix=Matrix.Translation((h + r_) / 2) @ q.to_matrix().to_4x4())
        w.add(sp, 'Metal', False)
    rot = bmesh.new(); outer, inner = [], []
    for i in range(36):
        a = i / 36 * 2 * math.pi
        outer.append(rot.verts.new((-0.06, math.cos(a) * 0.1, math.sin(a) * 0.1))); inner.append(rot.verts.new((-0.06, math.cos(a) * 0.075, math.sin(a) * 0.075)))
    for i in range(36): rot.faces.new((outer[i], outer[(i + 1) % 36], inner[(i + 1) % 36], inner[i]))
    for i in range(6):
        a = i / 6 * 2 * math.pi
        arm = bmesh.new(); bmesh.ops.create_cube(arm, size=1)
        for v in arm.verts: v.co = Vector((v.co.x * 0.004, v.co.y * 0.012, v.co.z * 0.06)) + Vector((-0.06, 0, 0.05))
        bmesh.ops.rotate(arm, verts=arm.verts, matrix=Matrix.Rotation(a, 3, 'X')); w.add(arm, 'Rotor', False)
    sol = rot  # einseitig, dünn
    w.add(sol, 'Rotor', False)
    return w.obj()
wF, wR = wheel('WheelF'), wheel('WheelR')
# Kurbel (um das Tretlager zentriert) und Pedale (um die Pedalachse zentriert)
cr = MB('Crank')
tube(cr, (0.085, 0, 0), (0.09, 0, 0.17), 0.012, 0.01, 'Black', 8, 1.6)
tube(cr, (-0.085, 0, 0), (-0.09, 0, -0.17), 0.012, 0.01, 'Black', 8, 1.6)
tube(cr, (0.1, 0, 0), (-0.1, 0, 0), 0.012, 0.012, 'Metal', 8)
crank = cr.obj()
pd = MB('Pedal')
box(pd, (0, 0, 0), (0.1, 0.016, 0.1), 'Black', bevel=0.004)
for ix in (-1, 1):
    for iz in (-1, 0, 1):
        for top in (1, -1): tube(pd, (ix * 0.042, 0.008 * top, iz * 0.04), (ix * 0.042, 0.014 * top, iz * 0.04), 0.0025, 0.0025, 'Metal', 4)
pedal = pd.obj()
tri = sum(sum(len(p.vertices) - 2 for p in o.data.polygons) for o in (frame, steer, wF, wR, crank, pedal))
print('tris', tri)

if preview:
    import os
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam)
    view = [o.copy() for o in ()]
    wF.location = G(0, R, 0.66); wR.location = G(0, R, -0.66); crank.location = G(*bb)
    cam.location = (2.2, -0.6, 0.8); cam.rotation_euler = (math.radians(85), 0, math.radians(80)); scn.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.rotation_euler = (0.7, 0.2, 0.6); scn.collection.objects.link(sun)
    scn.render.engine = 'CYCLES'; scn.cycles.device = 'CPU'; scn.cycles.samples = 16; scn.cycles.use_denoising = False
    w = bpy.data.worlds.new('w'); scn.world = w; w.color = (0.5, 0.55, 0.6)
    scn.render.resolution_x, scn.render.resolution_y = 800, 560; scn.render.filepath = preview
    bpy.ops.render.render(write_still=True)
    wF.location = wR.location = crank.location = (0, 0, 0)
bpy.ops.object.select_all(action='SELECT')
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_animations=False, export_yup=True,
                          export_texcoords=False, export_materials='EXPORT')
print('ok', out)
