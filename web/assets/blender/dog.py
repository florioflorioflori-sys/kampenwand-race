# Hund für Kampenwand Downhill, per Skript in Blender gebaut (mittelgroß, ca. 58 cm Schulterhöhe).
# Aufruf: python dog.py <ausgabe.glb> [vorschau.png]
# Ein durchgehender Körper (Skin-Modifier + Unterteilung) mit Skelett für Laufen, Sitzen und
# Schwanzwedeln. Fellzonen sind eigene Materialien (Fur, FurLight, FurMid), das Spiel färbt sie je Rasse.
# Schlappohren und Stehohren sind eigene Teile und werden je Hund ein- oder ausgeblendet.
import bpy, bmesh, math, sys, os
from mathutils import Vector, Matrix

out = sys.argv[1]; preview = sys.argv[2] if len(sys.argv) > 2 else None
bpy.ops.wm.read_factory_settings(use_empty=True)
scn = bpy.context.scene
PALETTE = {'Fur': (0.08, 0.06, 0.05), 'FurLight': (0.85, 0.8, 0.7), 'FurMid': (0.45, 0.22, 0.1), 'Nose': (0.03, 0.03, 0.03),
           'Eye': (0.05, 0.03, 0.02), 'Collar': (0.7, 0.1, 0.1), 'EarFlop': (0.081, 0.06, 0.05), 'EarUp': (0.082, 0.06, 0.05), 'Tongue': (0.8, 0.35, 0.38)}
PALETTE = {n: (c[0], c[1], c[2] + i * 0.001) for i, (n, c) in enumerate(PALETTE.items())}
M = {}
for n, c in PALETTE.items():
    m = bpy.data.materials.new(n); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']; b.inputs['Base Color'].default_value = (*c, 1)
    b.inputs['Roughness'].default_value = 0.25 if n in ('Eye', 'Nose') else 0.85
    M[n] = m

# ---------------- Skelett (vorne = -Y, oben = +Z) ----------------
arm = bpy.data.armatures.new('DogRig'); rig = bpy.data.objects.new('DogRig', arm)
scn.collection.objects.link(rig); bpy.context.view_layer.objects.active = rig
bpy.ops.object.mode_set(mode='EDIT')
def bone(name, h, t, parent=None):
    b = arm.edit_bones.new(name); b.head = Vector(h); b.tail = Vector(t)
    if parent: b.parent = arm.edit_bones[parent]
bone('root', (0, 0, 0), (0, -0.1, 0))
bone('pelvis', (0, 0.3, 0.56), (0, 0.04, 0.57), 'root')
bone('chest', (0, 0.04, 0.57), (0, -0.29, 0.6), 'pelvis')
bone('neck', (0, -0.27, 0.62), (0, -0.37, 0.75), 'chest')
bone('head', (0, -0.37, 0.75), (0, -0.62, 0.74), 'neck')
bone('tail1', (0, 0.33, 0.58), (0, 0.46, 0.55), 'pelvis')
bone('tail2', (0, 0.46, 0.55), (0, 0.56, 0.47), 'tail1')
bone('tail3', (0, 0.56, 0.47), (0, 0.62, 0.36), 'tail2')
for s, sx in (('l', 1), ('r', -1)):
    x = 0.085 * sx
    bone('fup_' + s, (x, -0.26, 0.52), (x, -0.23, 0.32), 'chest')
    bone('flo_' + s, (x, -0.23, 0.32), (x, -0.25, 0.09), 'fup_' + s)
    bone('fpaw_' + s, (x, -0.25, 0.09), (x, -0.31, 0.02), 'flo_' + s)
    bone('hup_' + s, (x, 0.27, 0.52), (x, 0.19, 0.31), 'pelvis')
    bone('hlo_' + s, (x, 0.19, 0.31), (x, 0.33, 0.13), 'hup_' + s)
    bone('hpaw_' + s, (x, 0.33, 0.13), (x, 0.3, 0.02), 'hlo_' + s)
    bone('ear_' + s, (0.06 * sx, -0.41, 0.83), (0.088 * sx, -0.42, 0.75), 'head')
bpy.ops.object.mode_set(mode='OBJECT')

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
def smooth(o):
    for f in o.data.polygons: f.use_smooth = True
    return o
def ellipsoid(name, c, r, seg=14, rings=8, rot=None):
    me = bpy.data.meshes.new(name); bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=seg, v_segments=rings, radius=1.0)
    for v in bm.verts:
        p = Vector((v.co.x * r[0], v.co.y * r[1], v.co.z * r[2]))
        if rot: p = rot @ p
        v.co = p + Vector(c)
    bm.to_mesh(me); bm.free(); return smooth(new_obj(name, me))
def rigid(o, bn):
    vg = o.vertex_groups.new(name=bn); vg.add(range(len(o.data.vertices)), 1.0, 'REPLACE'); return o

# ---------------- Körper als ein Skin-Netz ----------------
pts = []; edges = []
def add(p, r, link=None):
    pts.append((p, r)); i = len(pts) - 1
    if link is not None: edges.append((link, i))
    return i
hip = add((0, 0.29, 0.56), (0.12, 0.13))
mid = add((0, 0.1, 0.565), (0.125, 0.13), hip)
ch = add((0, -0.13, 0.57), (0.135, 0.15), mid)
wi = add((0, -0.25, 0.585), (0.12, 0.135), ch)
nk1 = add((0, -0.33, 0.67), (0.082, 0.088), wi)
sk = add((0, -0.41, 0.775), (0.085, 0.085), nk1)
mz1 = add((0, -0.5, 0.75), (0.058, 0.058), sk)
mz2 = add((0, -0.58, 0.74), (0.043, 0.045), mz1)
t1 = add((0, 0.36, 0.575), (0.034, 0.034), hip)
t2 = add((0, 0.46, 0.55), (0.028, 0.028), t1)
t3 = add((0, 0.56, 0.47), (0.022, 0.022), t2)
t4 = add((0, 0.62, 0.36), (0.012, 0.012), t3)
for sx in (1, -1):
    x = 0.085 * sx
    a = add((x * 0.9, -0.24, 0.5), (0.075, 0.085), ch)
    b = add((x, -0.23, 0.32), (0.048, 0.048), a)
    c = add((x, -0.25, 0.1), (0.033, 0.033), b)
    add((x, -0.29, 0.03), (0.038, 0.028), c)
    a = add((x * 0.9, 0.25, 0.48), (0.09, 0.11), hip)
    b = add((x, 0.19, 0.31), (0.06, 0.06), a)
    c = add((x, 0.32, 0.13), (0.03, 0.032), b)
    add((x, 0.3, 0.03), (0.038, 0.028), c)
me = bpy.data.meshes.new('Body'); me.from_pydata([Vector(p[0]) for p in pts], edges, []); me.update()
body = new_obj('Body', me)
skm = body.modifiers.new('skin', 'SKIN'); skm.use_smooth_shade = True
for i, p in enumerate(pts): me.skin_vertices[''].data[i].radius = p[1]
me.skin_vertices[''].data[0].use_root = True
ss = body.modifiers.new('sub', 'SUBSURF'); ss.levels = 2
apply_all(body)
def sculpt(bm):
    for v in bm.verts:
        p = v.co
        # tiefe Brust, hochgezogener Bauch, Kruppe leicht abfallend
        if -0.3 < p.y < 0.02 and 0.36 < p.z < 0.56 and abs(p.x) < 0.14:
            k = math.sin((p.y + 0.3) / 0.32 * math.pi)
            p.z -= 0.09 * k * min(1, (0.56 - p.z) / 0.12) * min(1, (p.z - 0.36) / 0.06)
        if 0.06 < p.y < 0.24 and 0.42 < p.z < 0.53 and abs(p.x) < 0.13: p.z += 0.03 * math.sin((p.y - 0.06) / 0.18 * math.pi)
        # Schädel breiter, Schnauze schmaler, Stopp über den Augen
        if p.y < -0.36 and p.z > 0.68:
            if p.y > -0.47: p.x *= 1.1
            else: p.x *= 0.92
            if -0.47 < p.y < -0.43 and p.z > 0.8: p.z += 0.012                  # Stirnabsatz
        # leichtes Fellrauschen
        n = math.sin(p.x * 90 + p.y * 40) * math.sin(p.z * 70 + p.y * 60)
        p += v.normal * 0.003 * n
bm_edit(body, sculpt)
def zone(c, n):
    x, y, z = c
    if z < 0.075 and (abs(y + 0.27) < 0.08 or abs(y - 0.31) < 0.08): return 1                  # Pfoten
    if y < -0.56 and z < 0.85: return 1                                                          # Schnauze
    if -0.36 < y < -0.08 and z < 0.5 and abs(x) < 0.07: return 1                                # Brustfleck
    if y < -0.27 and z < 0.68 and n[1] < -0.3 and abs(x) < 0.07: return 1                       # Kehle
    if y > 0.58: return 1                                                                         # Schwanzspitze
    if z < 0.3 and abs(x) > 0.05: return 2                                                       # Unterschenkel
    if -0.56 < y < -0.47 and 0.78 < z < 0.83 and abs(x) > 0.035: return 2                       # Backen
    if -0.5 < y < -0.44 and 0.86 < z and abs(x) > 0.02 and abs(x) < 0.05: return 2               # Augenbrauen
    return 0
body.data.materials.append(M['Fur'])
# ---------------- Kopfteile ----------------
tipY = min(v.co.y for v in body.data.vertices if v.co.z > 0.7 and abs(v.co.x) < 0.02)
tipZ = max(v.co.z for v in body.data.vertices if v.co.y < tipY + 0.02)
print('tip', tipY, tipZ)
nose = ellipsoid('Nose', (0, tipY + 0.008, tipZ - 0.012), (0.024, 0.018, 0.018)); nose.data.materials.append(M['Nose'])
eyes = []
for sx in (1, -1):
    e = ellipsoid('Eye', (0.04 * sx, -0.478, 0.8), (0.013, 0.011, 0.011), 10, 6); e.data.materials.append(M['Eye']); eyes.append(e)
tongue = ellipsoid('Tongue', (0, tipY + 0.05, tipZ - 0.06), (0.019, 0.03, 0.005), 10, 5, Matrix.Rotation(-0.6, 3, 'X')); tongue.data.materials.append(M['Tongue'])
flop = []; up = []
for sx in (1, -1):
    e = ellipsoid('EarFlop', (0, 0, 0), (0.011, 0.042, 0.065), 10, 8)
    bm_edit(e, lambda bm: [setattr(v, 'co', Matrix.Rotation(0.18 * sx, 3, 'Y') @ v.co + Vector((0.087 * sx, -0.415, 0.775))) for v in bm.verts])
    e.data.materials.append(M['EarFlop']); flop.append(e)
    u = bmesh.new(); bmesh.ops.create_cone(u, cap_ends=True, segments=10, radius1=0.04, radius2=0.004, depth=0.11)
    for v in u.verts: v.co = Vector((v.co.x, v.co.y * 0.35, v.co.z))
    for v in u.verts: v.co = Matrix.Rotation(-0.3 * sx, 3, 'Y') @ v.co + Vector((0.05 * sx, -0.4, 0.88))
    meU = bpy.data.meshes.new('EarUp'); u.to_mesh(meU); u.free(); uo = smooth(new_obj('EarUp', meU)); uo.data.materials.append(M['EarUp']); up.append(uo)
bpy.ops.mesh.primitive_torus_add(major_radius=0.074, minor_radius=0.011, location=(0, -0.335, 0.675), rotation=(math.radians(42), 0, 0), major_segments=20, minor_segments=6)
collar = bpy.context.active_object; collar.name = 'Collar'; collar.scale = (1, 1, 1.1); bpy.ops.object.transform_apply(scale=True, rotation=True); smooth(collar); collar.data.materials.append(M['Collar'])
# ---------------- Gewichte ----------------
select_only(body, rig); bpy.ops.object.parent_set(type='ARMATURE_AUTO')
for o in [nose, tongue] + eyes: rigid(o, 'head')
for o, s in zip(flop, 'lr'): rigid(o, 'ear_' + s)
for o, s in zip(up, 'lr'): rigid(o, 'ear_' + s)
rigid(collar, 'neck')
rest = [nose, tongue, collar] + eyes + flop + up
for o in rest: o.parent = rig; md = o.modifiers.new('arm', 'ARMATURE'); md.object = rig
select_only(*rest, body); bpy.ops.object.join(); dog = bpy.context.active_object; dog.name = 'Dog'
print('tris', sum(len(p.vertices) - 2 for p in dog.data.polygons))
if preview:
    cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); scn.collection.objects.link(cam)
    cam.location = (3, 0, 0.45); cam.rotation_euler = (math.radians(90), 0, math.radians(90)); cam.data.type = 'ORTHO'; cam.data.ortho_scale = 1.5
    if os.environ.get('VIEW') == 'persp': cam.data.type = 'PERSP'; cam.location = (2.6, -2.2, 0.8); cam.rotation_euler = (math.radians(84), 0, math.radians(50)); cam.data.lens = 85
    scn.camera = cam
    hide = set(os.environ.get('HIDE', 'EarUp').split(','))
    pv = dog.copy(); pv.data = dog.data.copy(); scn.collection.objects.link(pv); dog.hide_render = True
    def dropf(bm):
        names = [m.name for m in pv.data.materials]
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if names[f.material_index] in hide], context='FACES')
    bm_edit(pv, dropf)
    sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.rotation_euler = (math.radians(50), 0, math.radians(20)); sun.data.energy = 4; scn.collection.objects.link(sun)
    scn.render.engine = 'CYCLES'; scn.cycles.device = 'CPU'; scn.cycles.samples = 16; scn.cycles.use_denoising = False
    w = bpy.data.worlds.new('w'); scn.world = w; w.color = (0.8, 0.85, 0.9)
    scn.render.resolution_x, scn.render.resolution_y = 600, 450; scn.render.filepath = preview
    bpy.ops.render.render(write_still=True)
    bpy.data.objects.remove(pv)
select_only(rig, dog)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', use_selection=True, export_skins=True, export_animations=False,
                          export_yup=True, export_texcoords=False, export_materials='EXPORT')
print('ok', out)
