import bpy, sys, math
from mathutils import Vector
args = sys.argv[sys.argv.index('--') + 1:]
out = args[0]; files = args[1:]
bpy.ops.wm.read_factory_settings(use_empty=True)
for f in files: bpy.ops.import_scene.gltf(filepath=f)
sc = bpy.context.scene
import os, bmesh
HIDE = set(x for x in os.environ.get('HIDE', '').split(',') if x)
for o in list(sc.objects):
    if o.type == 'MESH' and 'lod1' in o.name.lower(): bpy.data.objects.remove(o, do_unlink=True); continue
    if o.type == 'MESH' and HIDE:
        print('OBJ', o.name, len(o.material_slots), len(o.data.materials))
        bm = bmesh.new(); bm.from_mesh(o.data)
        dl = [f for f in bm.faces if f.material_index < len(o.material_slots) and o.material_slots[f.material_index].material and o.material_slots[f.material_index].material.name.split('.')[0] in HIDE]
        bmesh.ops.delete(bm, geom=dl, context='FACES'); bm.to_mesh(o.data); bm.free()
sc.render.engine = 'CYCLES'; sc.cycles.samples = 24; sc.cycles.use_denoising = True; sc.cycles.device = 'CPU'
sc.render.resolution_x = 900; sc.render.resolution_y = 900
w = bpy.data.worlds.new('w'); sc.world = w; w.use_nodes = True; w.node_tree.nodes['Background'].inputs[0].default_value = (0.6, 0.7, 0.9, 1); w.node_tree.nodes['Background'].inputs[1].default_value = 0.8
mins = Vector((1e9,)*3); maxs = Vector((-1e9,)*3)
for o in sc.objects:
    if o.type == 'MESH':
        for c in o.bound_box:
            p = o.matrix_world @ Vector(c); mins = Vector(map(min, mins, p)); maxs = Vector(map(max, maxs, p))
ctr = (mins + maxs) / 2; size = (maxs - mins).length
yaw = float(args[-1]) if False else 0
cam = bpy.data.objects.new('cam', bpy.data.cameras.new('cam')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.lens = 70
d = size * 1.5
import os; V_=[float(x) for x in os.environ.get("CAMV","0.75,-0.55,0.25").split(",")]; d*=float(os.environ.get("CAMD","1")); ctr+=Vector([float(x) for x in os.environ.get("CTRO","0,0,0").split(",")]); cam.location = ctr + Vector((d * V_[0], d * V_[1], d * V_[2]))
if os.environ.get('LOOK'):
    ctr = Vector([float(x) for x in os.environ['LOOK'].split(',')]); cam.location = Vector([float(x) for x in os.environ['POS'].split(',')])
cam.rotation_euler = (ctr - cam.location).to_track_quat('-Z', 'Y').to_euler()
sun = bpy.data.objects.new('sun', bpy.data.lights.new('sun', 'SUN')); sun.data.energy = 4; sun.rotation_euler = (0.7, 0.2, 0.8); sc.collection.objects.link(sun)
sc.render.filepath = out
bpy.ops.render.render(write_still=True)
