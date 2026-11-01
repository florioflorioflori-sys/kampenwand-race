# Zuschauer für Kampenwand Downhill, per Skript in Blender gebaut (Mann oder Frau).
# Aufruf: python spectator.py M|F <ausgabe.glb> [vorschau.png]
# Gleiche Knochennamen wie der Fahrer. Jedes Teil hat ein eigenes Material; das Spiel
# blendet Teile (Frisuren, Hüte, Schal, Rucksack, Brille) je Person ein und färbt sie.
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix

SEX = sys.argv[1]; out = sys.argv[2]; preview = sys.argv[3] if len(sys.argv) > 3 else None
F = SEX == 'F'
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
# Körpermaße (Frau etwas kleiner, schmalere Schultern, breitere Hüfte)
K = 0.94 if F else 1.0
SH = 0.155 if F else 0.18      # Schulterbreite (halb)
HP = 0.105 if F else 0.095     # Hüftgelenk (halb)

PALETTE = {
    'Skin': (0.78, 0.55, 0.42), 'Top': (0.2, 0.35, 0.6), 'TopAccent': (0.9, 0.9, 0.85), 'Pants': (0.12, 0.14, 0.2), 'Shoe': (0.3, 0.2, 0.12),
    'Sole': (0.05, 0.05, 0.05), 'HairShort': (0.2, 0.13, 0.08), 'HairLong': (0.2, 0.13, 0.08), 'HairPony': (0.2, 0.13, 0.08), 'Beard': (0.2, 0.13, 0.08),
    'HatBeanie': (0.7, 0.15, 0.1), 'Pompom': (0.95, 0.95, 0.9), 'HatCap': (0.1, 0.3, 0.6), 'HatTyrol': (0.18, 0.24, 0.16), 'TyrolBand': (0.1, 0.08, 0.06),
    'Feather': (0.9, 0.9, 0.85), 'Scarf': (0.8, 0.6, 0.1), 'Backpack': (0.6, 0.15, 0.1), 'Glasses': (0.02, 0.02, 0.02), 'Eyes': (0.92, 0.9, 0.86),
    'Pupils': (0.06, 0.05, 0.04), 'Brows': (0.2, 0.13, 0.08), 'Lips': (0.62, 0.36, 0.32)}
M = {}
# jede Farbe minimal verschieden, damit beim Verdichten keine Materialien zusammenfallen
PALETTE = {n: (c[0], c[1], c[2] + i * 0.001) for i, (n, c) in enumerate(PALETTE.items())}
for n, c in PALETTE.items():
    m = bpy.data.materials.new(n); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*c, 1)
    b.inputs['Roughness'].default_value = 0.3 if n in ('Glasses', 'Eyes') else 0.85
    M[n] = m

def P(x, y, z): return (x, y, z * K)
# ---------------- Skelett ----------------
arm_data = bpy.data.armatures.new('Rig'); rig = bpy.data.objects.new('Rig', arm_data)
scn.collection.objects.link(rig); bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
def bone(name, h, t, parent=None):
    b = arm_data.edit_bones.new(name); b.head = Vector(h); b.tail = Vector(t)
    if parent: b.parent = arm_data.edit_bones[parent]
bone('root', (0, 0, 0), (0, 0.1, 0))
bone('pelvis', P(0, 0, 0.98), P(0, 0, 1.06), 'root')
bone('spine_01', P(0, 0, 1.06), P(0, 0, 1.18), 'pelvis')
bone('spine_02', P(0, 0, 1.18), P(0, 0, 1.32), 'spine_01')
bone('spine_03', P(0, 0, 1.32), P(0, 0, 1.47), 'spine_02')
bone('neck_01', P(0, 0, 1.47), P(0, -0.01, 1.56), 'spine_03')
bone('Head', P(0, -0.01, 1.56), P(0, -0.01, 1.76), 'neck_01')
for s, sx in (('l', 1), ('r', -1)):
    bone('clavicle_' + s, P(0.02 * sx, 0, 1.44), P(SH * sx, 0.01, 1.45), 'spine_03')
    bone('upperarm_' + s, P(SH * sx, 0.01, 1.45), P((SH + 0.28) * sx, 0.01, 1.45), 'clavicle_' + s)
    bone('lowerarm_' + s, P((SH + 0.28) * sx, 0.01, 1.45), P((SH + 0.53) * sx, 0, 1.45), 'upperarm_' + s)
    bone('hand_' + s, P((SH + 0.53) * sx, 0, 1.45), P((SH + 0.61) * sx, 0, 1.45), 'lowerarm_' + s)
    bone('middle_01_' + s, P((SH + 0.61) * sx, 0, 1.45), P((SH + 0.66) * sx, 0, 1.45), 'hand_' + s)
    bone('thigh_' + s, P(HP * sx, 0, 0.95), P(0.1 * sx, 0, 0.52), 'pelvis')
    bone('calf_' + s, P(0.1 * sx, 0, 0.52), P(0.1 * sx, 0.015, 0.09), 'thigh_' + s)
    bone('foot_' + s, P(0.1 * sx, 0.015, 0.09), P(0.1 * sx, -0.11, 0.025), 'calf_' + s)
    bone('ball_' + s, P(0.1 * sx, -0.11, 0.025), P(0.1 * sx, -0.17, 0.025), 'foot_' + s)
bpy.ops.object.mode_set(mode='OBJECT')

objs = []
def new_obj(name, me):
    o = bpy.data.objects.new(name, me); scn.collection.objects.link(o); return o
def apply_all(o):
    bpy.context.view_layer.objects.active = o
    for m in list(o.modifiers): bpy.ops.object.modifier_apply(modifier=m.name)
def select_only(*os_):
    bpy.ops.object.select_all(action='DESELECT')
    for o in os_: o.select_set(True)
    bpy.context.view_layer.objects.active = os_[-1]
def bm_edit(o, fn):
    bm = bmesh.new(); bm.from_mesh(o.data); fn(bm); bm.to_mesh(o.data); bm.free(); o.data.update()
def set_mats(o, names, pick=None):
    for n in names: o.data.materials.append(M[n])
    if pick:
        for f in o.data.polygons: f.material_index = pick(o.matrix_world @ f.center, f.normal)
    return o
def smooth(o):
    for f in o.data.polygons: f.use_smooth = True
    return o
def skin_body(name, pts, edges, sub=2):
    me = bpy.data.meshes.new(name); me.from_pydata([Vector(P(*p[0])) for p in pts], edges, []); me.update()
    o = new_obj(name, me)
    sk = o.modifiers.new('skin', 'SKIN'); sk.use_smooth_shade = True
    for i, p in enumerate(pts): me.skin_vertices[''].data[i].radius = (p[1], p[1])
    me.skin_vertices[''].data[0].use_root = True
    ss = o.modifiers.new('sub', 'SUBSURF'); ss.levels = sub
    apply_all(o); return o
def ellipsoid(name, c, r, seg=16, rings=10, rot=None):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    for v in bm.verts:
        p = Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2]))
        if rot: p = rot @ p
        v.co = p + Vector(c)
    bm.to_mesh(me); bm.free(); return smooth(new_obj(name, me))
def rigid(o, bone_name):
    vg = o.vertex_groups.new(name=bone_name); vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE'); return o

# ---------------- Jacke ----------------
cz = 1.33 if not F else 1.31
J = [((0, 0, 0.9), 0.17 if F else 0.165), ((0, 0, 1.03), 0.15 if F else 0.158), ((0, 0, 1.18), 0.155 if F else 0.165), ((0, 0, cz), 0.16 if F else 0.178),
     ((0, 0, 1.43), 0.14 if F else 0.155), ((0, 0, 1.5), 0.068)]
je = [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)]
for sx in (1, -1):
    b = len(J)
    J += [(((SH + 0.0) * sx, 0.005, 1.44), 0.07), (((SH + 0.13) * sx, 0.008, 1.45), 0.058), (((SH + 0.28) * sx, 0.008, 1.45), 0.052),
          (((SH + 0.42) * sx, 0.004, 1.45), 0.047), (((SH + 0.52) * sx, 0, 1.45), 0.045)]
    je += [(4, b), (b, b + 1), (b + 1, b + 2), (b + 2, b + 3), (b + 3, b + 4)]
jacket = skin_body('Jacket', J, je)
def shape_jacket(bm):
    for v in bm.verts:
        p = v.co
        if abs(p.x) < 0.24 and 0.8 * K < p.z < 1.5 * K:
            p.y *= 0.66 if p.y < 0 else 0.72
            if F and p.y < 0 and 1.22 * K < p.z < 1.4 * K and abs(p.x) < 0.13: p.y -= 0.03 * math.sin((p.z / K - 1.22) / 0.18 * math.pi)  # Brust
        p += v.normal * 0.004 * math.sin(p.x * 60 + p.z * 45) * math.sin(p.z * 50)
bm_edit(jacket, shape_jacket)
def jpick(c, n):
    ax = abs(c.x); z = c.z / K
    if ax < 0.016 and c.y < 0 and 0.88 < z < 1.48: return 1                 # Reißverschluss
    if ax < 0.24 and 0.88 < z < 0.93: return 1                                # Bund
    if ax > SH + 0.47: return 1                                               # Bündchen
    if z > 1.47 and ax < 0.1: return 1                                        # Kragen
    return 0
set_mats(jacket, ['Top', 'TopAccent'], jpick)
# ---------------- Hose ----------------
Pp = [((0, 0, 1.0), 0.15 if not F else 0.16), ((0, 0, 0.9), 0.155 if not F else 0.17)]
pe = [(0, 1)]
for sx in (1, -1):
    b = len(Pp)
    Pp += [(((HP + 0.005) * sx, 0, 0.84), 0.095 if not F else 0.1), ((0.1 * sx, 0, 0.68), 0.08), ((0.1 * sx, -0.003, 0.52), 0.065),
           ((0.1 * sx, 0.008, 0.3), 0.06), ((0.1 * sx, 0.015, 0.13), 0.058)]
    pe += [(1, b), (b, b + 1), (b + 1, b + 2), (b + 2, b + 3), (b + 3, b + 4)]
pants = skin_body('Pants', Pp, pe)
bm_edit(pants, lambda bm: [setattr(v.co, 'y', v.co.y * 0.8) for v in bm.verts if 0.82 * K < v.co.z < 1.05 * K and abs(v.co.x) < 0.25])
set_mats(pants, ['Pants'])
# ---------------- Kopf mit Gesicht ----------------
HC = Vector(P(0, -0.012, 1.665))
hr = (0.083, 0.098, 0.11) if not F else (0.078, 0.093, 0.104)
head = ellipsoid('Head', HC, hr, 32, 24)
def bump(x, c, w): t = (x - c) / w; return max(0.0, 1 - t * t) ** 2
def face(bm):
    for v in bm.verts:
        d = v.co - HC; ux, uy, uz = d.x / hr[0], d.y / hr[1], d.z / hr[2]; ax = abs(ux)
        fr = max(0.0, -uy)
        # Hinterkopf voller, Stirn senkrechter
        v.co.y += 0.012 * max(0.0, uy - 0.1) * bump(uz, 0.15, 0.9)
        # Unterkiefer schmaler zum Kinn, Kieferwinkel bleibt
        k = min(1.0, max(0.0, (-uz - 0.2) / 0.7))
        v.co.x = HC.x + (v.co.x - HC.x) * (1 - (0.3 if F else 0.24) * k * (0.5 + 0.5 * fr))
        # Unterseite hinter dem Kinn hochziehen (Kieferlinie statt Ei)
        if uz < -0.4 and uy > -0.3: v.co.z += 0.018 * min(1.0, (-uz - 0.4) / 0.5) * min(1.0, (uy + 0.3) / 0.6)
        # Kinn
        v.co.y -= 0.009 * bump(uz, -0.78, 0.25) * bump(ux, 0, 0.45) * fr
        # Wangenknochen und Augenhöhlen, Brauenwulst
        v.co.y -= 0.006 * bump(uz, -0.08, 0.25) * bump(ax, 0.62, 0.25) * fr
        v.co.y += 0.011 * bump(uz, 0.1, 0.17) * bump(ax, 0.4, 0.22) * fr
        v.co.y -= 0.005 * bump(uz, 0.33, 0.12) * bump(ax, 0.35, 0.45) * fr
        # Wangen unter den Jochbeinen leicht eingefallen
        v.co.y += 0.004 * bump(uz, -0.42, 0.2) * bump(ax, 0.6, 0.2) * fr
        # Schläfen
        v.co.x -= 0.004 * (1 if ux > 0 else -1) * bump(uz, 0.25, 0.3) * bump(ax, 0.9, 0.2) * fr
bm_edit(head, face)
set_mats(head, ['Skin'])
neck = set_mats(ellipsoid('Neck', P(0, 0.004, 1.53), (0.054 if not F else 0.047, 0.056, 0.075), 14, 8), ['Skin'])
ears = [set_mats(ellipsoid('Ear', (HC.x + sx * hr[0] * 0.98, HC.y + 0.008, HC.z - 0.008), (0.011, 0.024, 0.033), 10, 6, Matrix.Rotation(0.25 * sx, 3, 'Z')), ['Skin']) for sx in (1, -1)]
eyes = []; pupils = []; brows = []
for sx in (1, -1):
    ec = Vector((HC.x + sx * 0.032, HC.y - hr[1] * 0.84, HC.z + 0.012))
    eyes.append(set_mats(ellipsoid('Eye', ec, (0.011, 0.007, 0.0055), 10, 6), ['Eyes']))
    eyes.append(set_mats(ellipsoid('Lid', ec + Vector((0, -0.0025, 0.0045)), (0.0135, 0.0075, 0.0042), 10, 6), ['Skin']))
    pupils.append(set_mats(ellipsoid('Pupil', ec + Vector((0, -0.0062, -0.0005)), (0.0052, 0.0025, 0.0048), 8, 5), ['Pupils']))
    brows.append(set_mats(ellipsoid('Brow', ec + Vector((0, -0.003, 0.019)), (0.018, 0.006, 0.0035 if not F else 0.0025), 8, 4, Matrix.Rotation(-0.12 * sx, 3, 'Y')), ['Brows']))
# Nase: Rücken, Spitze, Nasenflügel
ny = HC.y - hr[1] * 0.93
nparts = [ellipsoid('NoseBridge', (HC.x, ny - 0.004, HC.z - 0.004), (0.0068, 0.009, 0.021), 10, 8, Matrix.Rotation(-0.42, 3, 'X')),
          ellipsoid('NoseTip', (HC.x, ny - 0.0115, HC.z - 0.022), (0.0088, 0.0085, 0.0085), 10, 8)]
for sx in (1, -1): nparts.append(ellipsoid('NoseWing', (HC.x + sx * 0.0095, ny - 0.004, HC.z - 0.025), (0.0058, 0.0065, 0.0055), 8, 6))
select_only(*nparts); bpy.ops.object.join(); nose = bpy.context.active_object; nose.name = 'Nose'; set_mats(nose, ['Skin'])
lp = [ellipsoid('LipU', (HC.x, HC.y - hr[1] * 0.86, HC.z - 0.046), (0.019, 0.0075, 0.0045), 12, 5), ellipsoid('LipL', (HC.x, HC.y - hr[1] * 0.83, HC.z - 0.0555), (0.017, 0.0075, 0.005), 12, 5)]
select_only(*lp); bpy.ops.object.join(); lips = bpy.context.active_object; lips.name = 'Lips'; set_mats(lips, ['Lips'])
# ---------------- Haare ----------------
def hair_cap(name, mat, back_drop=0.0, front=0.04, grow=1.06):
    o = ellipsoid(name, HC + Vector((0, 0.004, 0.006)), (hr[0] * grow, hr[1] * grow, hr[2] * grow), 24, 14)
    def cut(bm):
        kill = []
        for f in bm.faces:
            d = f.calc_center_median() - HC
            if d.y < -0.03 and d.z < front: kill.append(f)                       # Gesicht frei
            elif d.z < -0.02 - back_drop and d.y > -0.03: kill.append(f)          # Nacken
            elif abs(d.x) > hr[0] * 0.8 and d.z < 0.0 and d.y < 0.03: kill.append(f)  # Ohren frei
        bmesh.ops.delete(bm, geom=kill, context='FACES')
    bm_edit(o, cut)
    so = o.modifiers.new('s', 'SOLIDIFY'); so.thickness = 0.008; apply_all(o)
    return set_mats(o, [mat])
hshort = hair_cap('HairShort', 'HairShort', 0.0, 0.045)
hlong = hair_cap('HairLong', 'HairLong', 0.0, 0.05, 1.08)
curtain = ellipsoid('HairLongBack', HC + Vector((0, 0.045, -0.11)), (0.085, 0.045, 0.13), 16, 10)
set_mats(curtain, ['HairLong'])
select_only(curtain, hlong); bpy.ops.object.join(); hlong = bpy.context.active_object; hlong.name = 'HairLong'
hpony = hair_cap('HairPony', 'HairPony', 0.0, 0.05, 1.05)
tail = ellipsoid('Tail', (0, 0, 0), (0.03, 0.03, 0.1), 12, 8)
bm_edit(tail, lambda bm: [setattr(v, 'co', Matrix.Rotation(math.radians(-20), 3, 'X') @ v.co + HC + Vector((0, 0.115, -0.07))) for v in bm.verts])
set_mats(tail, ['HairPony']); select_only(tail, hpony); bpy.ops.object.join(); hpony = bpy.context.active_object; hpony.name = 'HairPony'
beard = ellipsoid('Beard', HC + Vector((0, -0.01, -0.035)), (hr[0] * 1.04, hr[1] * 1.04, hr[2] * 0.85), 20, 12)
def beard_cut(bm):
    kill = [f for f in bm.faces if not ((f.calc_center_median() - HC).y < 0.02 and (f.calc_center_median() - HC).z < -0.035)]
    bmesh.ops.delete(bm, geom=kill, context='FACES')
    for v in bm.verts:
        d = v.co - HC
        if d.y < -0.07 and -0.06 < d.z < -0.04 and abs(d.x) < 0.025: v.co.z -= 0.006   # Mund frei
bm_edit(beard, beard_cut)
sb = beard.modifiers.new('s', 'SOLIDIFY'); sb.thickness = 0.008; apply_all(beard); set_mats(beard, ['Beard'])
# ---------------- Hüte ----------------
TOP = HC.z + hr[2]
beanie = ellipsoid('HatBeanie', HC + Vector((0, 0.004, 0.02)), (hr[0] * 1.12, hr[1] * 1.1, hr[2] * 1.05), 24, 14)
bm_edit(beanie, lambda bm: bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.calc_center_median() - HC).z < 0.005], context='FACES'))
bpy.ops.mesh.primitive_torus_add(major_radius=hr[0] * 1.13, minor_radius=0.013, location=(HC.x, HC.y + 0.004, HC.z + 0.012), major_segments=24, minor_segments=6)
band = bpy.context.active_object; band.scale = (1, hr[1] / hr[0], 1); bpy.ops.object.transform_apply(scale=True)
select_only(band, beanie); bpy.ops.object.join(); beanie = bpy.context.active_object; beanie.name = 'HatBeanie'
smooth(beanie); set_mats(beanie, ['HatBeanie'])
pompom = set_mats(ellipsoid('Pompom', (HC.x, HC.y + 0.005, TOP + 0.03), (0.032, 0.032, 0.03), 10, 6), ['Pompom'])
cap = ellipsoid('HatCap', HC + Vector((0, 0.004, 0.02)), (hr[0] * 1.1, hr[1] * 1.08, hr[2] * 1.0), 24, 14)
bm_edit(cap, lambda bm: bmesh.ops.delete(bm, geom=[f for f in bm.faces if (f.calc_center_median() - HC).z < 0.02], context='FACES'))
brim = ellipsoid('Brim', (HC.x, HC.y - hr[1] * 1.15, HC.z + 0.025), (0.075, 0.06, 0.006), 16, 4, Matrix.Rotation(0.18, 3, 'X'))
select_only(brim, cap); bpy.ops.object.join(); cap = bpy.context.active_object; cap.name = 'HatCap'; set_mats(cap, ['HatCap'])
crown = bmesh.new(); bmesh.ops.create_cone(crown, cap_ends=True, segments=20, radius1=hr[0] * 1.05, radius2=hr[0] * 0.8, depth=0.1)
me = bpy.data.meshes.new('Tyrol'); crown.to_mesh(me); crown.free(); tyrol = new_obj('HatTyrol', me)
bm_edit(tyrol, lambda bm: [setattr(v, 'co', Vector((v.co.x, v.co.y * 1.15, v.co.z - (0.012 if (v.co.z > 0.04 and abs(v.co.x) < 0.02) else 0))) + Vector((HC.x, HC.y, HC.z + hr[2] * 0.62))) for v in bm.verts])
tbrim = ellipsoid('TBrim', (HC.x, HC.y, HC.z + hr[2] * 0.6 - 0.045), (0.15, 0.165, 0.006), 24, 4)
bm_edit(tbrim, lambda bm: [setattr(v.co, 'z', v.co.z + 0.02 * ((v.co.x - HC.x) / 0.15) ** 2) for v in bm.verts])
select_only(tbrim, tyrol); bpy.ops.object.join(); tyrol = bpy.context.active_object; tyrol.name = 'HatTyrol'; smooth(tyrol); set_mats(tyrol, ['HatTyrol'])
tband = bmesh.new(); bmesh.ops.create_cone(tband, cap_ends=False, segments=20, radius1=hr[0] * 1.07, radius2=hr[0] * 1.04, depth=0.018)
me = bpy.data.meshes.new('TBand'); tband.to_mesh(me); tband.free(); tb = new_obj('TyrolBand', me)
bm_edit(tb, lambda bm: [setattr(v, 'co', Vector((v.co.x, v.co.y * 1.15, v.co.z)) + Vector((HC.x, HC.y, HC.z + hr[2] * 0.6 - 0.025))) for v in bm.verts])
set_mats(tb, ['TyrolBand'])
feather = set_mats(ellipsoid('Feather', (HC.x + 0.085, HC.y + 0.04, HC.z + hr[2] * 0.6 + 0.04), (0.006, 0.012, 0.07), 6, 6, Matrix.Rotation(-0.5, 3, 'X')), ['Feather'])
# ---------------- Schal, Rucksack, Brille ----------------
bpy.ops.mesh.primitive_torus_add(major_radius=0.075, minor_radius=0.03, location=P(0, 0.0, 1.49), major_segments=20, minor_segments=8)
scarf = bpy.context.active_object; scarf.name = 'Scarf'; scarf.scale = (1.05, 1.0, 0.75); bpy.ops.object.transform_apply(scale=True)
end = ellipsoid('ScarfEnd', P(0.04, -0.085, 1.36), (0.035, 0.012, 0.11), 10, 6, Matrix.Rotation(0.15, 3, 'Y'))
select_only(end, scarf); bpy.ops.object.join(); scarf = bpy.context.active_object; scarf.name = 'Scarf'; smooth(scarf); set_mats(scarf, ['Scarf'])
bp = bmesh.new(); bmesh.ops.create_cube(bp, size=1.0)
for v in bp.verts: v.co = Vector((v.co.x * 0.27, v.co.y * 0.13, v.co.z * 0.4))
bmesh.ops.bevel(bp, geom=bp.edges[:], offset=0.035, segments=3, affect='EDGES')
for v in bp.verts: v.co += Vector(P(0, 0.17, 1.22))
me = bpy.data.meshes.new('Backpack'); bp.to_mesh(me); bp.free(); pack = smooth(new_obj('Backpack', me))
pocket = ellipsoid('Pocket', P(0, 0.24, 1.12), (0.1, 0.03, 0.08), 12, 6)
straps = [ellipsoid('Strap', P(sx * 0.09, -0.06, 1.33), (0.022, 0.012, 0.15), 8, 6, Matrix.Rotation(0.2 * sx, 3, 'Y')) for sx in (1, -1)]
select_only(pocket, *straps, pack); bpy.ops.object.join(); pack = bpy.context.active_object; pack.name = 'Backpack'; set_mats(pack, ['Backpack'])
gl = []
for sx in (1, -1):
    gl.append(ellipsoid('Lens', (HC.x + sx * 0.034, HC.y - hr[1] * 0.98, HC.z + 0.012), (0.024, 0.005, 0.017), 12, 6))
    gl.append(ellipsoid('Temple', (HC.x + sx * hr[0] * 1.0, HC.y - 0.025, HC.z + 0.015), (0.004, 0.05, 0.004), 6, 4))
gl.append(ellipsoid('Bridge', (HC.x, HC.y - hr[1] * 1.0, HC.z + 0.015), (0.012, 0.004, 0.003), 6, 4))
select_only(*gl); bpy.ops.object.join(); glasses = bpy.context.active_object; glasses.name = 'Glasses'; set_mats(glasses, ['Glasses'])
# ---------------- Hände, Schuhe ----------------
hands = []
for sx in (1, -1):
    wx = (SH + 0.53) * sx; base = Vector(P(0, 0, 1.45))
    hp = [ellipsoid('Palm', (wx + sx * 0.045, base.y, base.z), (0.048, 0.04, 0.015), 12, 8)]
    for k, (fy, L) in enumerate(((-0.026, 0.07), (-0.009, 0.08), (0.009, 0.077), (0.025, 0.062))):
        x0 = wx + sx * 0.088; z0 = base.z - 0.002
        a1 = 0.25 + k * 0.03; a2 = a1 + 0.35
        m1 = Vector((x0 + sx * math.cos(a1) * L * 0.27, base.y + fy, z0 - math.sin(a1) * L * 0.27))
        hp.append(ellipsoid('F1', m1, (L * 0.29, 0.0085, 0.008), 8, 5, Matrix.Rotation(a1 * sx, 3, 'Y')))
        e1 = Vector((x0 + sx * math.cos(a1) * L * 0.55, base.y + fy, z0 - math.sin(a1) * L * 0.55))
        m2 = e1 + Vector((sx * math.cos(a2) * L * 0.2, 0, -math.sin(a2) * L * 0.2))
        hp.append(ellipsoid('F2', m2, (L * 0.23, 0.0075, 0.007), 8, 5, Matrix.Rotation(a2 * sx, 3, 'Y')))
    hp.append(ellipsoid('Thumb', (wx + sx * 0.04, base.y - 0.042, base.z - 0.012), (0.03, 0.011, 0.011), 8, 5, Matrix.Rotation(0.6 * sx, 3, 'Z') @ Matrix.Rotation(0.4 * sx, 3, 'Y')))
    select_only(*hp); bpy.ops.object.join(); h = bpy.context.active_object; h.name = 'Hand'
    set_mats(h, ['Skin']); hands.append(h)
shoes = []
for sx in (1, -1):
    sbm = bmesh.new(); bmesh.ops.create_cube(sbm, size=1.0)
    for v in sbm.verts: v.co = Vector((v.co.x * 0.1, v.co.y * 0.27, v.co.z * 0.11))
    bmesh.ops.subdivide_edges(sbm, edges=sbm.edges[:], cuts=1, use_grid_fill=True)
    for v in sbm.verts:
        if v.co.y < -0.05 and v.co.z > 0: v.co.z -= (-v.co.y - 0.05) * 0.55
        if v.co.y > 0.08 and v.co.z > 0: v.co.z += 0.05                     # Wanderschuh-Schaft
    for v in sbm.verts: v.co += Vector(P(0.1 * sx, -0.045, 0.06))
    me = bpy.data.meshes.new('Shoe'); sbm.to_mesh(me); sbm.free(); s_ = new_obj('Shoe', me)
    sub = s_.modifiers.new('s', 'SUBSURF'); sub.levels = 1; apply_all(s_); smooth(s_)
    set_mats(s_, ['Shoe', 'Sole'], lambda c, n: 1 if c.z < 0.018 else 0); shoes.append(s_)

# ---------------- Gewichte ----------------
def auto(o): select_only(o, rig); bpy.ops.object.parent_set(type='ARMATURE_AUTO')
def keep_groups(o, ok, fallback):
    for vg in list(o.vertex_groups):
        if not ok(vg.name): o.vertex_groups.remove(vg)
    fb = o.vertex_groups.get(fallback) or o.vertex_groups.new(name=fallback)
    for v in o.data.vertices:
        if sum(g.weight for g in v.groups) < 1e-3: fb.add([v.index], 1.0, 'REPLACE')
auto(jacket); auto(pants)
keep_groups(jacket, lambda n: not n.startswith(('thigh', 'calf', 'foot', 'ball', 'root')), 'pelvis')
keep_groups(pants, lambda n: n.startswith(('pelvis', 'spine_01', 'thigh', 'calf', 'foot')), 'pelvis')
headparts = [head, nose, lips, hshort, hlong, hpony, beard, beanie, pompom, cap, tyrol, tb, feather, glasses] + ears + eyes + pupils + brows
for o in headparts: rigid(o, 'Head')
rigid(neck, 'neck_01'); rigid(scarf, 'spine_03'); rigid(pack, 'spine_03')
for o, s in zip(hands, 'lr'): rigid(o, 'hand_' + s)
for o, s in zip(shoes, 'lr'):
    vg = o.vertex_groups.new(name='foot_' + s); vb = o.vertex_groups.new(name='ball_' + s)
    for v in o.data.vertices:
        w = min(1, max(0, (-(o.matrix_world @ v.co).y - 0.07) / 0.06)); vg.add([v.index], 1 - w, 'REPLACE'); vb.add([v.index], w, 'REPLACE')
rest = headparts + [neck, scarf, pack] + hands + shoes
for o in rest: o.parent = rig; md = o.modifiers.new('arm', 'ARMATURE'); md.object = rig
select_only(*rest, pants, jacket); bpy.ops.object.join()
body = bpy.context.active_object; body.name = 'Body'
# grobe Stufe für Menschenmengen in der Ferne
lod = body.copy(); lod.data = body.data.copy(); lod.name = 'Body_lod1'; scn.collection.objects.link(lod)
dec = lod.modifiers.new('dec', 'DECIMATE'); dec.ratio = 0.22
bpy.context.view_layer.objects.active = lod
lod.modifiers.move(lod.modifiers.find('dec'), 0); bpy.ops.object.modifier_apply(modifier='dec')
tri = lambda o: sum(len(p.vertices) - 2 for p in o.data.polygons)
print('tris', tri(body), 'lod1', tri(lod))

if preview:
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam)
    if os.environ.get('VIEW') == 'head': cam.location = (0.25, -0.6, 1.7 * K); cam.rotation_euler = (math.radians(88), 0, math.radians(22)); cam.data.lens = 60
    else: cam.location = (1.6, -2.4, 1.3); cam.rotation_euler = (math.radians(82), 0, math.radians(34))
    scn.camera = cam; lod.hide_render = True
    hide = set(os.environ.get('HIDE', '').split(','))
    if hide:
        pv = body.copy(); pv.data = body.data.copy(); scn.collection.objects.link(pv); body.hide_render = True
        def dropf(bm):
            names = [m.name for m in pv.data.materials]
            bmesh.ops.delete(bm, geom=[f for f in bm.faces if names[f.material_index] in hide], context='FACES')
        bm_edit(pv, dropf)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.rotation_euler = (math.radians(50), 0, math.radians(20)); sun.data.energy = 4; scn.collection.objects.link(sun)
    scn.render.engine = 'CYCLES'; scn.cycles.device = 'CPU'; scn.cycles.samples = 16; scn.cycles.use_denoising = False
    w = bpy.data.worlds.new('w'); scn.world = w; w.color = (0.8, 0.85, 0.9)
    scn.render.resolution_x, scn.render.resolution_y = 600, 600; scn.render.filepath = preview
    bpy.ops.render.render(write_still=True)
if preview and os.environ.get('HIDE'): pv.hide_set(True); bpy.data.objects.remove(pv)
select_only(rig, body, lod)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_skins=True, export_animations=False,
                          export_yup=True, export_texcoords=False, export_materials='EXPORT')
print('ok', out)
