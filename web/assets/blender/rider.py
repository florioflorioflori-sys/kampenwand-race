# Downhill-Fahrer für Kampenwand Downhill, komplett per Skript in Blender gebaut.
# Aufruf: python rider.py <ausgabe.glb> [vorschau.png]
# Koordinaten: Blender Z oben, Figur schaut nach -Y, linke Seite +X (glTF: +Z vorne).
import bpy, bmesh, math, sys
from mathutils import Vector, Matrix

out = sys.argv[1]
preview = sys.argv[2] if len(sys.argv) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene

def mat(name, col, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*col, 1); b.inputs['Roughness'].default_value = rough; b.inputs['Metallic'].default_value = metal
    return m
M = {n: mat(n, c, r, mt) for n, c, r, mt in [
    ('Jersey', (0.8, 0.1, 0.05), 0.85, 0), ('JerseyAccent', (0.9, 0.9, 0.85), 0.85, 0), ('Pants', (0.03, 0.03, 0.03), 0.9, 0),
    ('PantsAccent', (0.5, 0.5, 0.5), 0.9, 0), ('Glove', (0.02, 0.02, 0.02), 0.8, 0), ('Shoe', (0.03, 0.03, 0.03), 0.7, 0),
    ('ShoeSole', (0.25, 0.22, 0.2), 0.9, 0), ('Skin', (0.75, 0.5, 0.38), 0.6, 0), ('Helmet', (0.9, 0.9, 0.88), 0.25, 0),
    ('HelmetAccent', (0.8, 0.1, 0.05), 0.3, 0), ('HelmetTrim', (0.02, 0.02, 0.02), 0.6, 0), ('Lens', (1.0, 0.45, 0.1), 0.05, 1.0),
    ('GoggleFrame', (0.03, 0.03, 0.03), 0.5, 0), ('Pad', (0.05, 0.05, 0.05), 0.6, 0), ('Hair', (0.25, 0.15, 0.08), 0.7, 0)]}

# ---------------- Skelett ----------------
arm_data = bpy.data.armatures.new('RiderRig'); rig = bpy.data.objects.new('RiderRig', arm_data)
scn.collection.objects.link(rig); bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
B = {}
def bone(name, h, t, parent=None, roll=0.0):
    b = arm_data.edit_bones.new(name); b.head = Vector(h); b.tail = Vector(t); b.roll = roll
    if parent: b.parent = arm_data.edit_bones[parent]; b.use_connect = False
    B[name] = (Vector(h), Vector(t)); return b
bone('root', (0, 0, 0), (0, 0.1, 0))
bone('pelvis', (0, 0, 0.98), (0, 0, 1.06), 'root')
bone('spine_01', (0, 0, 1.06), (0, 0, 1.18), 'pelvis')
bone('spine_02', (0, 0, 1.18), (0, 0, 1.32), 'spine_01')
bone('spine_03', (0, 0, 1.32), (0, 0, 1.47), 'spine_02')
bone('neck_01', (0, 0, 1.47), (0, -0.01, 1.56), 'spine_03')
bone('Head', (0, -0.01, 1.56), (0, -0.01, 1.76), 'neck_01')
for s, sx in (('l', 1), ('r', -1)):
    bone('clavicle_' + s, (0.02 * sx, 0, 1.44), (0.17 * sx, 0.01, 1.45), 'spine_03')
    bone('upperarm_' + s, (0.17 * sx, 0.01, 1.45), (0.45 * sx, 0.01, 1.45), 'clavicle_' + s)
    bone('lowerarm_' + s, (0.45 * sx, 0.01, 1.45), (0.71 * sx, 0, 1.45), 'upperarm_' + s)
    bone('hand_' + s, (0.71 * sx, 0, 1.45), (0.79 * sx, 0, 1.45), 'lowerarm_' + s)
    bone('middle_01_' + s, (0.79 * sx, 0, 1.45), (0.84 * sx, 0, 1.45), 'hand_' + s)
    bone('thigh_' + s, (0.095 * sx, 0, 0.95), (0.1 * sx, 0, 0.52), 'pelvis')
    bone('calf_' + s, (0.1 * sx, 0, 0.52), (0.1 * sx, 0.015, 0.09), 'thigh_' + s)
    bone('foot_' + s, (0.1 * sx, 0.015, 0.09), (0.1 * sx, -0.11, 0.025), 'calf_' + s)
    bone('ball_' + s, (0.1 * sx, -0.11, 0.025), (0.1 * sx, -0.17, 0.025), 'foot_' + s)
bpy.ops.object.mode_set(mode='OBJECT')

def new_obj(name, me):
    o = bpy.data.objects.new(name, me); scn.collection.objects.link(o); return o
def apply_all(o):
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
def select_only(*objs):
    bpy.ops.object.select_all(action='DESELECT')
    for o in objs: o.select_set(True)
    bpy.context.view_layer.objects.active = objs[-1]

# Hautmodifikator-Körper: Punkte mit Radien, Kanten als Glieder
def skin_body(name, pts, edges, sub=2):
    me = bpy.data.meshes.new(name); me.from_pydata([p[0] for p in pts], edges, []); me.update()
    o = new_obj(name, me)
    sk = o.modifiers.new('skin', 'SKIN'); sk.use_smooth_shade = True
    for i, p in enumerate(pts):
        r = p[1]; me.skin_vertices[''].data[i].radius = (r, r) if isinstance(r, float) else r
    me.skin_vertices[''].data[0].use_root = True
    ss = o.modifiers.new('sub', 'SUBSURF'); ss.levels = sub; ss.render_levels = sub
    apply_all(o)
    return o
def bm_edit(o, fn):
    bm = bmesh.new(); bm.from_mesh(o.data); fn(bm); bm.to_mesh(o.data); bm.free(); o.data.update()
def set_mats(o, names, pick=None):
    for n in names: o.data.materials.append(M[n])
    if pick:
        for f in o.data.polygons: f.material_index = pick(o.matrix_world @ f.center, f.normal)

# ---------------- Trikot (weit geschnitten) ----------------
J = [((0, 0, 0.9), (0.165, 0.165)), ((0, 0, 1.05), (0.16, 0.16)), ((0, 0, 1.2), (0.168, 0.168)), ((0, 0, 1.33), (0.175, 0.175)),
     ((0, 0, 1.43), (0.15, 0.15)), ((0, 0, 1.5), (0.072, 0.072))]
je = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)]
for sx in (1, -1):
    b = len(J)
    J += [((0.18 * sx, 0.005, 1.44), (0.07, 0.07)), ((0.31 * sx, 0.008, 1.45), (0.06, 0.06)), ((0.45 * sx, 0.008, 1.45), (0.054, 0.054)),
          ((0.6 * sx, 0.004, 1.45), (0.05, 0.05)), ((0.70 * sx, 0, 1.45), (0.045, 0.045))]
    je += [(4, b), (b, b + 1), (b + 1, b + 2), (b + 2, b + 3), (b + 3, b + 4)]
jersey = skin_body('Jersey', J, je)
def shape_torso(bm):
    for v in bm.verts:
        p = v.co
        if abs(p.x) < 0.24 and 0.8 < p.z < 1.5:
            p.y *= 0.68 if p.y < 0 else 0.74
            if p.y > 0 and p.z > 1.2: p.y += 0.012  # Rücken leicht gewölbt
        # Falten: leichtes Wellenmuster am Stoff
        p += Vector((0, 0, 0)) + v.normal * 0.004 * math.sin(p.x * 70 + p.z * 40) * math.sin(p.z * 55)
jersey and bm_edit(jersey, shape_torso)
def jersey_pick(c, n):
    ax = abs(c.x)
    if ax > 0.55 and ax < 0.6: return 1                       # Ärmelband
    if ax < 0.22 and 1.24 < c.z < 1.29: return 1              # Brustband
    if 0.12 < ax < 0.3 and c.z > 1.47: return 1                # Schulterpasse
    if ax > 0.66: return 1                                     # Bündchen
    return 0
set_mats(jersey, ['Jersey', 'JerseyAccent'], jersey_pick)

# ---------------- Hose (weit, über die Knieschoner) ----------------
P = [((0, 0, 1.0), (0.15, 0.15)), ((0, 0, 0.9), (0.16, 0.16))]
pe = [(0, 1)]
for sx in (1, -1):
    b = len(P)
    P += [((0.1 * sx, 0, 0.84), (0.1, 0.1)), ((0.1 * sx, 0, 0.68), (0.088, 0.088)), ((0.1 * sx, -0.005, 0.52), (0.08, 0.08)),
          ((0.1 * sx, 0.008, 0.3), (0.07, 0.07)), ((0.1 * sx, 0.015, 0.14), (0.064, 0.064))]
    pe += [(1, b), (b, b + 1), (b + 1, b + 2), (b + 2, b + 3), (b + 3, b + 4)]
pants = skin_body('Pants', P, pe)
def shape_pants(bm):
    for v in bm.verts:
        p = v.co
        if 0.84 < p.z < 1.05 and abs(p.x) < 0.25: p.y *= 0.8
        p += v.normal * 0.005 * math.sin(p.z * 60 + p.x * 30) * math.sin(p.y * 50 + p.z * 20)
bm_edit(pants, shape_pants)
set_mats(pants, ['Pants', 'PantsAccent'], lambda c, n: 1 if (abs(n.x) > 0.94 and c.x * n.x > 0 and c.z < 0.85 and abs(c.x) > 0.15) else 0)

# ---------------- Kopf, Hals, Haare ----------------
def ellipsoid(name, c, r, seg=24, rings=14):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * r[0] + c[0], v.co.y * r[1] + c[1], v.co.z * r[2] + c[2]))
    bm.to_mesh(me); bm.free()
    o = new_obj(name, me)
    for f in me.polygons: f.use_smooth = True
    return o
head = ellipsoid('Head', (0, -0.012, 1.665), (0.088, 0.1, 0.112))
def face(bm):
    for v in bm.verts:
        p = v.co; dy = -(p.y + 0.012)
        if dy > 0.07 and abs(p.x) < 0.02 and 1.62 < p.z < 1.68: p.y -= 0.018 * (1 - abs(p.x) / 0.02) * (1 - abs(p.z - 1.648) / 0.035)  # Nase
        if p.z < 1.6: p.x *= 0.85                                                                           # schmales Kinn
bm_edit(head, face)
set_mats(head, ['Skin'])
neck = ellipsoid('Neck', (0, 0, 1.53), (0.055, 0.055, 0.08), 16, 8); set_mats(neck, ['Skin'])

# ---------------- Fullface-Helm ----------------
HC = Vector((0, -0.014, 1.68))
helmet = ellipsoid('Helmet', HC, (0.124, 0.152, 0.14), 36, 20)
def helmet_shape(bm):
    kill = []
    for f in bm.faces:
        c = f.calc_center_median(); d = c - HC
        if d.y < -0.06 and -0.05 < d.z < 0.042 and abs(d.x) < 0.098: kill.append(f)   # Augenöffnung
        elif d.z < -0.125 and d.y > -0.05: kill.append(f)                               # Halsöffnung
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    for v in bm.verts:
        d = v.co - HC
        if d.y < 0.02 and d.z < -0.05:
            # Kinnbügel: kräftig nach vorn und unten gezogen, unten schmaler
            k = min(1, (-d.z - 0.05) / 0.07) * min(1, (0.02 - d.y) / 0.12)
            v.co.y -= 0.06 * k; v.co.z -= 0.035 * k; v.co.x *= 1 - 0.12 * k
        if d.y > 0.0 and d.z < 0.0: v.co.y += 0.025 * (-d.z / 0.15) * (d.y / 0.16); v.co.z -= 0.012 * (d.y / 0.16)  # Heck zieht nach unten aus
        if d.z > 0.06: v.co.z += 0.008 * (d.z - 0.06) / 0.09                                # etwas höhere Kalotte
bm_edit(helmet, helmet_shape)
so = helmet.modifiers.new('solid', 'SOLIDIFY'); so.thickness = 0.012; so.offset = -1; so.use_rim = True
apply_all(helmet)
def helmet_pick(c, n):
    d = c - HC
    if (c - HC).length < 0.118: return 2                                    # Innenpolster
    if abs(d.x) < 0.016 and d.z > -0.01 and d.y > -0.12: return 1           # Mittelstreifen
    if abs(d.x) > 0.05 and d.y > -0.05 and abs(d.z - (0.02 - d.y * 0.45)) < 0.022: return 1   # Seitenpfeil nach hinten
    if d.z < -0.1 and d.y < -0.1: return 2                                  # Kinnschutz-Gitter
    return 0
set_mats(helmet, ['Helmet', 'HelmetAccent', 'HelmetTrim'], helmet_pick)
# Schirm
me = bpy.data.meshes.new('Peak'); bm = bmesh.new()
W, Dp, n = 0.16, 0.08, 8
rows = []
for j in range(4):
    row = []
    for i in range(n + 1):
        u = i / n - 0.5; t = j / 3
        x = u * W * (1 - 0.3 * t); y = -0.127 - t * Dp; z = 0.066 + t * 0.033 - (u * u) * 0.07
        row.append(bm.verts.new((x + HC.x, y + HC.y, z + HC.z)))
    rows.append(row)
for j in range(3):
    for i in range(n): bm.faces.new((rows[j][i], rows[j][i + 1], rows[j + 1][i + 1], rows[j + 1][i]))
bm.to_mesh(me); bm.free(); peak = new_obj('Peak', me)
s2 = peak.modifiers.new('solid', 'SOLIDIFY'); s2.thickness = 0.007; apply_all(peak)
for f in peak.data.polygons: f.use_smooth = True
set_mats(peak, ['HelmetAccent'])
# Brille: gebogenes Glas, Rahmen und Band
def band(name, rad, a0, a1, z0, z1, c, seg=20, ry=1.0):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); vs = []
    for i in range(seg + 1):
        a = a0 + (a1 - a0) * i / seg
        vs.append((bm.verts.new((c.x + math.sin(a) * rad, c.y - math.cos(a) * rad * ry, c.z + z0)), bm.verts.new((c.x + math.sin(a) * rad, c.y - math.cos(a) * rad * ry, c.z + z1))))
    for i in range(seg): bm.faces.new((vs[i][0], vs[i + 1][0], vs[i + 1][1], vs[i][1]))
    bm.to_mesh(me); bm.free(); o = new_obj(name, me)
    for f in me.polygons: f.use_smooth = True
    return o
lens = band('Lens', 0.122, -0.9, 0.9, -0.03, 0.03, HC, 24, 1.12)
sl = lens.modifiers.new('solid', 'SOLIDIFY'); sl.thickness = 0.006; apply_all(lens); set_mats(lens, ['Lens'])
frame = band('GoggleFrame', 0.119, -1.0, 1.0, -0.038, 0.038, HC, 24, 1.11)
sf = frame.modifiers.new('solid', 'SOLIDIFY'); sf.thickness = 0.016; apply_all(frame); set_mats(frame, ['GoggleFrame'])
strap = band('Strap', 0.129, 0.95, 2 * math.pi - 0.95, -0.012, 0.016, HC, 30, 1.2)
ss_ = strap.modifiers.new('solid', 'SOLIDIFY'); ss_.thickness = 0.005; apply_all(strap); set_mats(strap, ['GoggleFrame'])
# Nackenschutz
bpy.ops.mesh.primitive_torus_add(major_radius=0.105, minor_radius=0.034, location=(0, 0.005, 1.475), major_segments=28, minor_segments=10)
brace = bpy.context.active_object; brace.name = 'Brace'; brace.scale = (1, 0.95, 0.8); bpy.ops.object.transform_apply(scale=True)
bpy.ops.object.shade_smooth(); set_mats(brace, ['Pad'])
# Pferdeschwanz (nur bei Fahrerinnen sichtbar)
pony = ellipsoid('Ponytail', (0, 0, 0), (0.035, 0.03, 0.09), 12, 8); set_mats(pony, ['Hair'])
bm_edit(pony, lambda bm: [setattr(v, 'co', Matrix.Rotation(math.radians(-25), 3, 'X') @ v.co + Vector((0, 0.17, 1.56))) for v in bm.verts])

# ---------------- Handschuhe (zur Faust um den Griff geformt) ----------------
def glove(sx):
    me = bpy.data.meshes.new('Glove'); bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * 0.11, v.co.y * 0.085, v.co.z * 0.06))
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    for v in bm.verts:
        p = v.co
        # Finger rund um den Griff gekrümmt (Griffachse entlang Y unter der Hand)
        if p.x > 0.0: p.z -= (p.x / 0.055) ** 2 * 0.03
        p.y *= 1.0 - 0.15 * (p.z < 0)
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((0.06, 0, -0.005)))
    for v in bm.verts: v.co.x *= sx; v.co += Vector((0.71 * sx, 0, 1.45))
    bm.to_mesh(me); bm.free(); o = new_obj('Glove', me)
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; apply_all(o)
    for f in o.data.polygons: f.use_smooth = True
    if sx < 0:
        bm_edit(o, lambda bm: bmesh.ops.reverse_faces(bm, faces=bm.faces[:]))
    set_mats(o, ['Glove']); return o
gloves = [glove(1), glove(-1)]
# Daumen
thumbs = []
for sx in (1, -1):
    t = ellipsoid('Thumb', (0.75 * sx, -0.05, 1.44), (0.03, 0.017, 0.017), 10, 6); set_mats(t, ['Glove']); thumbs.append(t)

# ---------------- Schuhe (Flat-Pedal-Schuhe) ----------------
def shoe(sx):
    me = bpy.data.meshes.new('Shoe'); bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts: v.co = Vector((v.co.x * 0.11, v.co.y * 0.29, v.co.z * 0.1))
    bmesh.ops.subdivide_edges(bm, edges=bm.edges[:], cuts=2, use_grid_fill=True)
    for v in bm.verts:
        p = v.co
        if p.y < -0.06 and p.z > 0: p.z -= (-p.y - 0.06) * 0.5    # Zehenkappe flacher
        if p.y > 0.1 and p.z > 0.0: p.z += 0.03                    # Ferse/Knöchel höher
    bmesh.ops.translate(bm, verts=bm.verts, vec=Vector((0.1 * sx, -0.05, 0.055)))
    bm.to_mesh(me); bm.free(); o = new_obj('Shoe', me)
    sub = o.modifiers.new('sub', 'SUBSURF'); sub.levels = 1; apply_all(o)
    for f in o.data.polygons: f.use_smooth = True
    set_mats(o, ['Shoe', 'ShoeSole'], lambda c, n: 1 if c.z < 0.02 else 0); return o
shoes = [shoe(1), shoe(-1)]
# Knieschoner
pads = []
for sx in (1, -1):
    p = ellipsoid('KneePad', (0.1 * sx, -0.075, 0.5), (0.068, 0.035, 0.11), 16, 10); set_mats(p, ['Pad']); pads.append(p)

# ---------------- Gewichte ----------------
def rigid(o, bone_name):
    vg = o.vertex_groups.new(name=bone_name); vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE')
def auto(o):
    select_only(o, rig); bpy.ops.object.parent_set(type='ARMATURE_AUTO')
for o in (jersey, pants): auto(o)
# Trikot nur am Oberkörper und den Armen, Hose nur an Becken und Beinen
def keep_groups(o, ok, fallback):
    for vg in list(o.vertex_groups):
        if not ok(vg.name): o.vertex_groups.remove(vg)
    fb = o.vertex_groups.get(fallback) or o.vertex_groups.new(name=fallback)
    for v in o.data.vertices:
        if sum(g.weight for g in v.groups) < 1e-3: fb.add([v.index], 1.0, 'REPLACE')
keep_groups(jersey, lambda n: not n.startswith(('thigh', 'calf', 'foot', 'ball', 'root')), 'pelvis')
keep_groups(pants, lambda n: n.startswith(('pelvis', 'spine_01', 'thigh', 'calf', 'foot')), 'pelvis')
for o in (head, helmet, peak, lens, frame, strap, pony): rigid(o, 'Head')
rigid(neck, 'neck_01'); rigid(brace, 'spine_03')
for o, s in zip(gloves + thumbs, ['l', 'r', 'l', 'r']): rigid(o, 'hand_' + s)
for o, s in zip(shoes, ['l', 'r']):
    vg = o.vertex_groups.new(name='foot_' + s)
    vb = o.vertex_groups.new(name='ball_' + s)
    for v in o.data.vertices:
        w = min(1, max(0, (-(o.matrix_world @ v.co).y - 0.07) / 0.06))
        vg.add([v.index], 1 - w, 'REPLACE'); vb.add([v.index], w, 'REPLACE')
for o, s in zip(pads, ['l', 'r']): rigid(o, 'calf_' + s)
# alles außer Trikot/Hose an das Skelett hängen
for o in [head, neck, helmet, peak, lens, frame, strap, brace, pony] + gloves + thumbs + shoes + pads:
    o.parent = rig; md = o.modifiers.new('arm', 'ARMATURE'); md.object = rig
# zusammenführen (Pferdeschwanz bleibt eigenes Objekt)
body = [jersey, pants, head, neck, helmet, peak, lens, frame, strap, brace] + gloves + thumbs + shoes + pads
select_only(*body[1:], body[0]); bpy.ops.object.join()
rider = bpy.context.active_object; rider.name = 'Rider'
nt = sum(len(p.vertices) - 2 for p in rider.data.polygons) + sum(len(p.vertices) - 2 for p in pony.data.polygons)
print('tris', nt)

if preview:
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam)
    import os
    if os.environ.get('VIEW') == 'head': cam.location = (0.35, -0.55, 1.72); cam.rotation_euler = (math.radians(88), 0, math.radians(32)); cam.data.lens = 60
    elif os.environ.get('VIEW') == 'back': cam.location = (-1.4, 2.2, 1.6); cam.rotation_euler = (math.radians(75), 0, math.radians(212))
    else: cam.location = (1.6, -2.2, 1.6); cam.rotation_euler = (math.radians(75), 0, math.radians(36))
    scn.camera = cam
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.rotation_euler = (0.7, 0.2, 0.6); scn.collection.objects.link(sun)
    scn.render.engine = 'CYCLES'; scn.cycles.device = 'CPU'; scn.cycles.samples = 16; scn.cycles.use_denoising = False
    w = bpy.data.worlds.new('w'); scn.world = w; w.color = (0.5, 0.55, 0.6)
    scn.render.resolution_x, scn.render.resolution_y = 700, 700; scn.render.filepath = preview
    bpy.ops.render.render(write_still=True)

select_only(rig, rider, pony)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_skins=True, export_animations=False,
                          export_apply=False, export_yup=True, export_texcoords=False, export_materials='EXPORT')
print('ok', out)
