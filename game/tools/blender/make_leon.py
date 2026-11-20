"""Build an ORIGINAL stylised, skinned Leon test character in Blender and export it as GLB with skeletal clips.

Purpose: prove the production pipeline Blender → glTF 2.0 (skin + animations) → three.js.
Everything is generated here (no third-party assets): body via Skin modifier + Subdivision, custom
distance-based skin weights, 18-bone armature, 12 keyframed animation clips.

Run with Blender as a Python module (bpy) or inside Blender:
  python tools/blender/make_leon.py public/models/leon.glb
  blender -b -P tools/blender/make_leon.py -- public/models/leon.glb
Conventions (Blender): Z up, character faces -Y, character's left = +X. The glTF exporter converts to Y-up.
"""
import math
import sys

import bpy  # must be imported before bmesh/mathutils when running as a Python module
import bmesh
from mathutils import Quaternion, Vector

OUT = sys.argv[-1] if sys.argv[-1].endswith('.glb') else 'leon.glb'
FPS = 30

bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
scene.render.fps = FPS

# ------------------------------------------------------------------ materials
def material(name, rgb, rough=0.8, metal=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*rgb, 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    return m

def srgb(h):
    c = [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)

M_SKIN = material('skin', srgb(0xD9A47C), 0.65)
M_JACKET = material('jacket', srgb(0x31465C), 0.85)
M_TROUSERS = material('trousers', srgb(0x2A2B31), 0.85)
M_HAIR = material('hair', srgb(0x2A1C13), 0.75)
M_SHOE = material('shoes', srgb(0x5B3A22), 0.6)
M_SOLE = material('sole', srgb(0xD8CFBF), 0.8)
M_BAG = material('backpack', srgb(0x6B5134), 0.75)
M_SCARF = material('scarf', srgb(0xC9802F), 0.92)
M_DARK = material('eyes', srgb(0x111111), 0.3)
M_HOOD = material('hood', srgb(0x8A8F8C), 0.9)

# ------------------------------------------------------------------ armature
BONES = {
    # name: (head, tail, parent)
    'hips': ((0, 0, 0.95), (0, 0, 1.08), None),
    'spine': ((0, 0, 1.08), (0, 0, 1.27), 'hips'),
    'chest': ((0, 0, 1.27), (0, 0, 1.45), 'spine'),
    'neck': ((0, 0, 1.45), (0, 0, 1.53), 'chest'),
    'head': ((0, 0, 1.53), (0, 0, 1.78), 'neck'),
}
for side, sx in (('L', 1), ('R', -1)):
    BONES.update({
        f'upperarm.{side}': ((0.19 * sx, 0, 1.415), (0.21 * sx, 0, 1.14), 'chest'),
        f'forearm.{side}': ((0.21 * sx, 0, 1.14), (0.22 * sx, -0.01, 0.89), f'upperarm.{side}'),
        f'hand.{side}': ((0.22 * sx, -0.01, 0.89), (0.22 * sx, -0.015, 0.79), f'forearm.{side}'),
        f'thigh.{side}': ((0.09 * sx, 0, 0.93), (0.09 * sx, -0.01, 0.52), 'hips'),
        f'shin.{side}': ((0.09 * sx, -0.01, 0.52), (0.09 * sx, 0.01, 0.1), f'thigh.{side}'),
        f'foot.{side}': ((0.09 * sx, 0.01, 0.1), (0.09 * sx, -0.14, 0.03), f'shin.{side}'),
    })

arm_data = bpy.data.armatures.new('LeonRig')
arm = bpy.data.objects.new('Leon', arm_data)
scene.collection.objects.link(arm)
bpy.context.view_layer.objects.active = arm
arm.select_set(True)
bpy.ops.object.mode_set(mode='EDIT')
for name, (h, t, parent) in BONES.items():
    b = arm_data.edit_bones.new(name)
    b.head = h
    b.tail = t
    b.roll = 0
    if parent:
        b.parent = arm_data.edit_bones[parent]
        b.use_connect = (Vector(arm_data.edit_bones[parent].tail) - Vector(h)).length < 1e-4
bpy.ops.object.mode_set(mode='OBJECT')
REST = {b.name: b.matrix_local.to_3x3() for b in arm_data.bones}
SEG = {b.name: (Vector(b.head_local), Vector(b.tail_local)) for b in arm_data.bones}

# ------------------------------------------------------------------ geometry helpers
def link(obj):
    scene.collection.objects.link(obj)
    return obj

def evaluated_copy(obj, name):
    """Apply modifiers by evaluating the depsgraph (no operator context needed)."""
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    new = bpy.data.objects.new(name, me)
    link(new)
    bpy.data.objects.remove(obj)
    return new

def skin_mesh(name, verts, edges, radii, subdiv=2):
    me = bpy.data.meshes.new(name)
    me.from_pydata(verts, edges, [])
    obj = link(bpy.data.objects.new(name, me))
    obj.modifiers.new('skin', 'SKIN')
    sv = me.skin_vertices[0].data
    for i, r in enumerate(radii):
        sv[i].radius = r
    sv[0].use_root = True
    sub = obj.modifiers.new('sub', 'SUBSURF')
    sub.levels = subdiv
    sub.render_levels = subdiv
    return evaluated_copy(obj, name)

def blob(name, loc, scale, mat, segs=(24, 16), seed=0, noise=0.0):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs[0], v_segments=segs[1], radius=1.0)
    for v in bm.verts:
        n = math.sin(v.co.x * 9.1 + seed) * math.sin(v.co.y * 7.3 + seed * 2) * math.sin(v.co.z * 8.7 + seed * 3)
        v.co *= 1.0 + noise * n
        v.co.x *= scale[0]
        v.co.y *= scale[1]
        v.co.z *= scale[2]
        v.co += Vector(loc)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    return obj

def rounded_box(name, loc, size, mat, bevel=0.03):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2])) + Vector(loc)
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=3, affect='EDGES')
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    return obj

# ------------------------------------------------------------------ body (one continuous skinned surface)
V = [
    (0, 0, 0.93), (0, 0, 1.08), (0, 0.005, 1.29), (0, 0.01, 1.42), (0, 0.0, 1.5),  # 0..4 torso, neck
    (0.19, 0, 1.41), (0.21, 0, 1.14), (0.22, -0.01, 0.9),  # 5..7 left arm
    (-0.19, 0, 1.41), (-0.21, 0, 1.14), (-0.22, -0.01, 0.9),  # 8..10 right arm
    (0.09, 0, 0.9), (0.09, -0.01, 0.52), (0.09, 0.01, 0.11),  # 11..13 left leg
    (-0.09, 0, 0.9), (-0.09, -0.01, 0.52), (-0.09, 0.01, 0.11),  # 14..16 right leg
    (0.22, -0.015, 0.8), (-0.22, -0.015, 0.8),  # 17,18 hands
]
E = [(0, 1), (1, 2), (2, 3), (3, 4), (3, 5), (5, 6), (6, 7), (3, 8), (8, 9), (9, 10), (0, 11), (11, 12), (12, 13), (0, 14), (14, 15), (15, 16), (7, 17), (10, 18)]
R = [
    (0.155, 0.11), (0.15, 0.105), (0.175, 0.115), (0.17, 0.11), (0.05, 0.05),
    (0.068, 0.068), (0.056, 0.056), (0.046, 0.046),
    (0.068, 0.068), (0.056, 0.056), (0.046, 0.046),
    (0.085, 0.085), (0.064, 0.064), (0.05, 0.05),
    (0.085, 0.085), (0.064, 0.064), (0.05, 0.05),
    (0.04, 0.03), (0.04, 0.03),
]
body = skin_mesh('body', V, E, R, subdiv=2)
for m in (M_JACKET, M_TROUSERS, M_SKIN):
    body.data.materials.append(m)
for p in body.data.polygons:
    c = p.center
    if c.z > 1.47 or (abs(c.x) > 0.17 and c.z < 0.86):
        p.material_index = 2  # neck + hands
    elif c.z < 0.9 and abs(c.x) < 0.17:
        p.material_index = 1  # trousers
    else:
        p.material_index = 0  # jacket
    p.use_smooth = True

parts = [body]
# head, nose, ears, eyes, brows, hair
parts.append(blob('head', (0, -0.005, 1.63), (0.105, 0.115, 0.125), M_SKIN, (32, 20)))
parts.append(blob('nose', (0, -0.118, 1.615), (0.022, 0.025, 0.028), M_SKIN, (12, 8)))
for sx in (1, -1):
    parts.append(blob(f'ear{sx}', (0.104 * sx, 0.0, 1.63), (0.014, 0.024, 0.03), M_SKIN, (10, 8)))
    parts.append(blob(f'eye{sx}', (0.04 * sx, -0.103, 1.645), (0.013, 0.008, 0.015), M_DARK, (10, 8)))
    parts.append(rounded_box(f'brow{sx}', (0.042 * sx, -0.108, 1.672), (0.045, 0.012, 0.01), M_HAIR, 0.004))
parts.append(blob('hair', (0, 0.01, 1.69), (0.118, 0.128, 0.09), M_HAIR, (28, 16), seed=3, noise=0.12))
for i, (x, y, z, r) in enumerate([(0.03, -0.06, 1.75, 0.05), (-0.05, -0.04, 1.745, 0.048), (0.07, 0.0, 1.72, 0.045), (-0.07, 0.03, 1.715, 0.046), (0.0, 0.07, 1.73, 0.05)]):
    parts.append(blob(f'tuft{i}', (x, y, z), (r * 1.2, r * 1.1, r * 0.7), M_HAIR, (12, 8), seed=i, noise=0.1))
# hood collar + scarf wrap
parts.append(blob('hood', (0, 0.025, 1.47), (0.12, 0.11, 0.05), M_HOOD, (20, 10)))
parts.append(blob('scarf', (0, -0.005, 1.5), (0.085, 0.08, 0.04), M_SCARF, (20, 10), seed=5, noise=0.08))
# backpack + straps
parts.append(rounded_box('bag', (0, 0.17, 1.25), (0.27, 0.13, 0.34), M_BAG, 0.04))
parts.append(rounded_box('bagPocket', (0, 0.245, 1.15), (0.2, 0.05, 0.12), M_BAG, 0.02))
for sx in (1, -1):
    parts.append(rounded_box(f'strap{sx}', (0.09 * sx, -0.0, 1.3), (0.035, 0.24, 0.32), M_BAG, 0.01))
# shoes
for sx in (1, -1):
    parts.append(rounded_box(f'shoe{sx}', (0.09 * sx, -0.045, 0.045), (0.1, 0.24, 0.085), M_SHOE, 0.035))
    parts.append(rounded_box(f'sole{sx}', (0.09 * sx, -0.045, 0.006), (0.105, 0.25, 0.022), M_SOLE, 0.008))

# ------------------------------------------------------------------ skin weights
def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (a + ab * t - p).length

RIGID = {
    'head': 'head', 'nose': 'head', 'ear1': 'head', 'ear-1': 'head', 'eye1': 'head', 'eye-1': 'head', 'brow1': 'head', 'brow-1': 'head', 'hair': 'head',
    'hood': 'neck', 'scarf': 'neck', 'bag': 'chest', 'bagPocket': 'chest', 'strap1': 'chest', 'strap-1': 'chest',
    'shoe1': 'foot.L', 'shoe-1': 'foot.R', 'sole1': 'foot.L', 'sole-1': 'foot.R',
}

ARM = ('upperarm', 'forearm', 'hand')
LEG = ('thigh', 'shin', 'foot')
TORSO = ('hips', 'spine', 'chest', 'neck', 'head')

def side_ok(bone, p):
    """Region rules keep weights local (avoids torso 'sheets' stretching to a raised arm)."""
    x, z = p.x, p.z
    if bone.endswith('.L') and x < -0.02:
        return False
    if bone.endswith('.R') and x > 0.02:
        return False
    if bone.startswith(ARM):
        return abs(x) > 0.135 and z > 0.75
    if bone.startswith(LEG):
        return z < 1.0 and abs(x) < 0.2
    if bone.startswith(TORSO):
        return abs(x) < 0.215 or z > 1.36
    return True

for obj in parts:
    for bname in BONES:
        obj.vertex_groups.new(name=bname)
    rigid = RIGID.get(obj.name) or (obj.name.startswith('tuft') and 'head')
    for v in obj.data.vertices:
        if rigid:
            obj.vertex_groups[rigid].add([v.index], 1.0, 'REPLACE')
            continue
        p = v.co
        ds = sorted(((seg_dist(p, *SEG[b]), b) for b in BONES if side_ok(b, p)), key=lambda t: t[0])[:3]
        ws = [(1.0 / max(d, 0.012) ** 4, b) for d, b in ds]
        tot = sum(w for w, _ in ws)
        for w, b in ws:
            if w / tot > 0.02:
                obj.vertex_groups[b].add([v.index], w / tot, 'REPLACE')
    mod = obj.modifiers.new('rig', 'ARMATURE')
    mod.object = arm
    obj.parent = arm

# ------------------------------------------------------------------ animation
for pb in arm.pose.bones:
    pb.rotation_mode = 'QUATERNION'

def q_world(axis, angle):
    return Quaternion(Vector(axis), angle)

def set_rot(bone, rots):
    """rots: list of (axis, angle) in armature space, applied in order; converted to the bone's rest frame."""
    q = Quaternion()
    for axis, ang in rots:
        q = q_world(axis, ang) @ q
    rest = REST[bone]
    m = rest.inverted() @ q.to_matrix() @ rest
    arm.pose.bones[bone].rotation_quaternion = m.to_quaternion()

X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)

def pose(p):
    """p: dict of high-level pose params. Sign conventions documented inline (positive = natural direction)."""
    g = p.get
    set_rot('hips', [(Z, g('hipsTwist', 0))])
    arm.pose.bones['hips'].location = (0, g('hipsY', 0), 0)  # bone-local Y = up along the hips bone
    set_rot('spine', [(X, g('lean', 0) * 0.5), (Z, g('torsoTwist', 0))])
    set_rot('chest', [(X, g('lean', 0) * 0.5 + g('breath', 0))])
    set_rot('neck', [(X, g('neck', 0))])
    set_rot('head', [(X, g('headTilt', 0)), (Z, g('headTurn', 0))])
    for side, sgn in (('L', 1), ('R', -1)):
        i = 0 if side == 'L' else 1
        set_rot(f'thigh.{side}', [(X, -g('thigh', (0, 0))[i])])  # + = forward
        set_rot(f'shin.{side}', [(X, g('knee', (0, 0))[i])])  # + = bend
        set_rot(f'foot.{side}', [(X, g('ankle', (0, 0))[i])])
        set_rot(f'upperarm.{side}', [(Y, -sgn * g('armOut', 0.08)), (X, -g('shoulder', (0, 0))[i])])  # + = forward
        set_rot(f'forearm.{side}', [(X, -g('elbow', (0.25, 0.25))[i])])  # + = bend forward
        set_rot(f'hand.{side}', [(X, -0.1)])

def key_all(frame):
    for pb in arm.pose.bones:
        pb.keyframe_insert('rotation_quaternion', frame=frame)
        pb.keyframe_insert('location', frame=frame)

def make_action(name, frames, fn, loop=True):
    act = bpy.data.actions.new(name)
    arm.animation_data_create()
    arm.animation_data.action = act
    for f in range(frames + (1 if loop else 0)):
        t = (f % frames) / frames if loop else f / max(1, frames - 1)
        for pb in arm.pose.bones:
            pb.rotation_quaternion = Quaternion()
            pb.location = (0, 0, 0)
        pose(fn(t))
        key_all(f)
    act.use_fake_user = True
    track = arm.animation_data.nla_tracks.new()
    track.name = name
    track.strips.new(name, 0, act)
    arm.animation_data.action = None
    return act

TAU = math.pi * 2

def gait(t, amp, knee_amp, arm_amp, lean, bob, elbow):
    ph = t * TAU
    sL, sR = math.sin(ph), math.sin(ph + math.pi)
    cL, cR = math.cos(ph), math.cos(ph + math.pi)
    return {
        'thigh': (sL * amp, sR * amp),
        'knee': (0.1 + max(0, -cL) * knee_amp + max(0, sL) * 0.15, 0.1 + max(0, -cR) * knee_amp + max(0, sR) * 0.15),
        'ankle': (-(0.1 + max(0, -cL) * knee_amp) * 0.3, -(0.1 + max(0, -cR) * knee_amp) * 0.3),
        'shoulder': (sR * arm_amp, sL * arm_amp),
        'elbow': (elbow, elbow),
        'lean': lean,
        'hipsY': -abs(math.cos(ph)) * bob,
        'hipsTwist': math.sin(ph) * 0.08,
        'torsoTwist': -math.sin(ph) * 0.12,
        'headTilt': -lean * 0.4,
    }

def crouch_base(p, k=1.0):
    p = dict(p)
    th = p.get('thigh', (0, 0))
    kn = p.get('knee', (0, 0))
    p['thigh'] = (th[0] + 1.05 * k, th[1] + 1.05 * k)
    p['knee'] = (kn[0] + 1.75 * k, kn[1] + 1.75 * k)
    p['ankle'] = (-0.5 * k, -0.5 * k)
    p['lean'] = p.get('lean', 0) + 0.45 * k
    p['hipsY'] = p.get('hipsY', 0) - 0.34 * k
    p['elbow'] = (0.8, 0.8)
    p['armOut'] = 0.18
    return p

make_action('Idle', 60, lambda t: {'breath': math.sin(t * TAU) * 0.025, 'headTurn': math.sin(t * TAU) * 0.08, 'shoulder': (0.03, 0.03), 'hipsY': math.sin(t * TAU * 2) * 0.004})
make_action('Walk', 20, lambda t: gait(t, 0.5, 0.75, 0.42, 0.06, 0.035, 0.3))
make_action('Run', 16, lambda t: gait(t, 0.92, 1.4, 0.85, 0.28, 0.06, 1.2))
make_action('CrouchIdle', 60, lambda t: crouch_base({'breath': math.sin(t * TAU) * 0.02}))
make_action('CrouchWalk', 28, lambda t: crouch_base(gait(t, 0.35, 0.4, 0.2, 0.0, 0.02, 0.8)))
make_action('Push', 30, lambda t: {**gait(t, 0.3, 0.5, 0.0, 0.55, 0.02, 0.4), 'shoulder': (1.35, 1.25), 'elbow': (0.35, 0.4), 'armOut': 0.12, 'hipsY': -0.05})
make_action('JumpUp', 12, lambda t: {'thigh': (0.95, 0.35), 'knee': (1.45, 0.6), 'shoulder': (0.9, -0.5), 'elbow': (0.9, 0.5), 'lean': 0.15})
make_action('Fall', 20, lambda t: {'thigh': (0.45 + math.sin(t * TAU) * 0.08, -0.1), 'knee': (0.5, 0.25), 'shoulder': (1.2, 0.8), 'armOut': 0.45 + math.sin(t * TAU) * 0.1, 'elbow': (0.3, 0.3), 'lean': 0.15})
make_action('Slide', 12, lambda t: {'thigh': (1.35, 0.5), 'knee': (0.25, 1.9), 'shoulder': (-0.6, -0.9), 'elbow': (0.6, 0.4), 'armOut': 0.35, 'lean': -0.35, 'hipsY': -0.5})
make_action('Mantle', 14, lambda t: {'shoulder': (2.9 - 2.3 * t, 2.9 - 2.3 * t), 'elbow': (0.2 + 1.4 * t, 0.2 + 1.4 * t), 'thigh': (1.3, 0.2 + 0.9 * t), 'knee': (1.8, 0.4 + 1.2 * t), 'lean': 0.1 + 0.55 * t}, loop=False)
make_action('Hide', 60, lambda t: crouch_base({'breath': math.sin(t * TAU) * 0.03, 'shoulder': (-0.15, -0.15), 'headTurn': math.sin(t * TAU) * 0.3}, 0.4))
make_action('Caught', 20, lambda t: {'shoulder': (2.3, 2.1), 'elbow': (0.6, 0.5), 'lean': -0.25, 'armOut': 0.4, 'headTilt': 0.2})

# Join all parts into one skinned mesh: the exporter emits one primitive per material (fewer draw calls).
bpy.ops.object.select_all(action='DESELECT')
for o in parts:
    o.select_set(True)
bpy.context.view_layer.objects.active = body
bpy.ops.object.join()
body.name = 'LeonMesh'
parts = [body]

# rest pose
for pb in arm.pose.bones:
    pb.rotation_quaternion = Quaternion()
    pb.location = (0, 0, 0)

bpy.ops.export_scene.gltf(
    filepath=OUT,
    export_format='GLB',
    export_animations=True,
    export_animation_mode='NLA_TRACKS',
    export_skins=True,
    export_yup=True,
    export_apply=False,
    export_materials='EXPORT',
    export_force_sampling=True,
    export_frame_step=1,
    export_optimize_animation_size=True,
)
tri = sum(len(o.data.loop_triangles) if o.data.calc_loop_triangles() is None else 0 for o in parts)
print('EXPORTED', OUT, 'parts', len(parts), 'actions', len(bpy.data.actions), 'tris', tri)
