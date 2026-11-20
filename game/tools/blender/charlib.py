"""Shared character toolkit for Margin City (Blender 5.x, scripted).

One style, one pipeline for every character (Leon, MM-01, later Dave and Kate):
  - shared humanoid armature (same bone names → shared animation clips and game code),
  - clothing built as layered shells (Skin modifier + Subdivision), shaped per character,
  - stylised faces assembled from shaped primitives,
  - region-aware automatic skin weights,
  - baked ambient occlusion into vertex colours (Cycles) → soft contact shadows in the browser for free,
  - named materials (the game enhances 'knit', 'canvas', 'wool', 'leather' with procedural micro-detail),
  - GLB export with one animation per NLA track.
Conventions: Z up, character faces -Y, character's left = +X.
"""
import math

import bpy  # noqa: F401  (must be imported before bmesh/mathutils when run as a module)
import bmesh
from mathutils import Matrix, Quaternion, Vector

TAU = math.pi * 2
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)


def reset_scene(fps=30):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.context.scene.render.fps = fps
    return bpy.context.scene


def srgb(h):
    c = [((h >> 16) & 255) / 255, ((h >> 8) & 255) / 255, (h & 255) / 255]
    return tuple(x / 12.92 if x <= 0.04045 else ((x + 0.055) / 1.055) ** 2.4 for x in c)


def material(name, hexcol, rough=0.8, metal=0.0, emit=None, emit_strength=0.0):
    m = bpy.data.materials.new(name)
    m.use_nodes = True
    bsdf = m.node_tree.nodes.get('Principled BSDF')
    bsdf.inputs['Base Color'].default_value = (*srgb(hexcol), 1.0)
    bsdf.inputs['Roughness'].default_value = rough
    bsdf.inputs['Metallic'].default_value = metal
    if emit is not None:
        bsdf.inputs['Emission Color'].default_value = (*srgb(emit), 1.0)
        bsdf.inputs['Emission Strength'].default_value = emit_strength
    return m


def link(obj):
    bpy.context.scene.collection.objects.link(obj)
    return obj


def dup_mesh(obj, name, mat=None):
    """Independent copy of a mesh object (optionally re-materialed) — used for conforming shells."""
    new = obj.copy()
    new.data = obj.data.copy()
    new.name = name
    new.modifiers.clear()
    link(new)
    if mat is not None:
        new.data.materials.clear()
        new.data.materials.append(mat)
        for p in new.data.polygons:
            p.material_index = 0
    return new


def solidify(obj, thickness, offset=-1.0, material_offset=0):
    sol = obj.modifiers.new('sol', 'SOLIDIFY')
    sol.thickness = thickness
    sol.offset = offset
    sol.material_offset = material_offset
    name = obj.name
    return evaluated_copy(obj, name)


def open_tube(name, rings, mat, segs=32, cut=None, smooth=True):
    """Open (uncapped) tube through rings [(z, rx, ry, cy), ...]; cut(center) -> True removes a face."""
    bm = bmesh.new()
    rows = []
    for z, rx, ry, cy in rings:
        rows.append([bm.verts.new((math.cos(a) * rx, cy + math.sin(a) * ry, z)) for a in (i / segs * TAU for i in range(segs))])
    for r0, r1 in zip(rows, rows[1:]):
        for i in range(segs):
            j = (i + 1) % segs
            bm.faces.new((r0[i], r0[j], r1[j], r1[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if cut:
        bmesh.ops.delete(bm, geom=[f for f in bm.faces if cut(f.calc_center_median())], context='FACES')
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    for p in obj.data.polygons:
        p.use_smooth = smooth
    return obj


def evaluated_copy(obj, name):
    dg = bpy.context.evaluated_depsgraph_get()
    me = bpy.data.meshes.new_from_object(obj.evaluated_get(dg))
    new = bpy.data.objects.new(name, me)
    link(new)
    bpy.data.objects.remove(obj)
    return new


def skin_mesh(name, verts, edges, radii, mat, subdiv=2, solidify=0.0, smooth=True):
    """Organic tube network: vertices + edges + per-vertex (rx, ry) radii → smooth mesh."""
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
    out = evaluated_copy(obj, name)
    if solidify:
        sol = out.modifiers.new('sol', 'SOLIDIFY')
        sol.thickness = solidify
        out = evaluated_copy(out, name)
    out.data.materials.append(mat)
    for p in out.data.polygons:
        p.use_smooth = smooth
    return out


def delete_faces(obj, pred):
    bm = bmesh.new()
    bm.from_mesh(obj.data)
    dead = [f for f in bm.faces if pred(f.calc_center_median())]
    bmesh.ops.delete(bm, geom=dead, context='FACES')
    bm.to_mesh(obj.data)
    bm.free()


def deform(obj, fn):
    for v in obj.data.vertices:
        v.co = Vector(fn(Vector(v.co)))


def blob(name, loc, scale, mat, segs=(24, 16), seed=0, noise=0.0, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_uvsphere(bm, u_segments=segs[0], v_segments=segs[1], radius=1.0)
    R = rot.to_matrix() if rot is not None else None
    for v in bm.verts:
        n = math.sin(v.co.x * 9.1 + seed) * math.sin(v.co.y * 7.3 + seed * 2) * math.sin(v.co.z * 8.7 + seed * 3)
        v.co *= 1.0 + noise * n
        v.co = Vector((v.co.x * scale[0], v.co.y * scale[1], v.co.z * scale[2]))
        if R is not None:
            v.co = R @ v.co
        v.co += Vector(loc)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    return obj


def rounded_box(name, loc, size, mat, bevel=0.03, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cube(bm, size=1.0)
    for v in bm.verts:
        v.co = Vector((v.co.x * size[0], v.co.y * size[1], v.co.z * size[2]))
    bmesh.ops.bevel(bm, geom=list(bm.edges), offset=bevel, segments=3, affect='EDGES')
    R = rot.to_matrix() if rot is not None else None
    for v in bm.verts:
        if R is not None:
            v.co = R @ v.co
        v.co += Vector(loc)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    for p in me.polygons:
        p.use_smooth = True
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    return obj


def cylinder(name, loc, radius, depth, mat, segs=24, rot=None):
    bm = bmesh.new()
    bmesh.ops.create_cone(bm, cap_ends=True, segments=segs, radius1=radius, radius2=radius, depth=depth)
    R = rot.to_matrix() if rot is not None else None
    for v in bm.verts:
        if R is not None:
            v.co = R @ v.co
        v.co += Vector(loc)
    me = bpy.data.meshes.new(name)
    bm.to_mesh(me)
    bm.free()
    obj = link(bpy.data.objects.new(name, me))
    obj.data.materials.append(mat)
    return obj


def tube(name, pts, radius, mat, subdiv=1):
    """A strap / cord along points."""
    edges = [(i, i + 1) for i in range(len(pts) - 1)]
    radii = [r if isinstance(r, tuple) else (radius, radius) for r in [radius] * len(pts)]
    return skin_mesh(name, pts, edges, radii, mat, subdiv=subdiv)


# ---------------------------------------------------------------------------- armature
def humanoid_bones(h=1.0, shoulder=0.19, hip=0.09):
    """Shared bone set (names are the game contract). h scales the whole skeleton."""
    s = h
    B = {
        'hips': ((0, 0, 0.95 * s), (0, 0, 1.08 * s), None),
        'spine': ((0, 0, 1.08 * s), (0, 0, 1.27 * s), 'hips'),
        'chest': ((0, 0, 1.27 * s), (0, 0, 1.45 * s), 'spine'),
        'neck': ((0, 0, 1.45 * s), (0, 0, 1.53 * s), 'chest'),
        'head': ((0, 0, 1.53 * s), (0, 0, 1.78 * s), 'neck'),
    }
    for side, sx in (('L', 1), ('R', -1)):
        B.update({
            f'upperarm.{side}': ((shoulder * sx, 0, 1.415 * s), ((shoulder + 0.02) * sx, 0, 1.14 * s), 'chest'),
            f'forearm.{side}': (((shoulder + 0.02) * sx, 0, 1.14 * s), ((shoulder + 0.03) * sx, -0.01, 0.89 * s), f'upperarm.{side}'),
            f'hand.{side}': (((shoulder + 0.03) * sx, -0.01, 0.89 * s), ((shoulder + 0.03) * sx, -0.015, 0.79 * s), f'forearm.{side}'),
            f'thigh.{side}': ((hip * sx, 0, 0.93 * s), (hip * sx, -0.01, 0.52 * s), 'hips'),
            f'shin.{side}': ((hip * sx, -0.01, 0.52 * s), (hip * sx, 0.01, 0.1 * s), f'thigh.{side}'),
            f'foot.{side}': ((hip * sx, 0.01, 0.1 * s), (hip * sx, -0.14, 0.03 * s), f'shin.{side}'),
        })
    return B


class Rig:
    def __init__(self, name, bones):
        self.bones = bones
        data = bpy.data.armatures.new(name + 'Rig')
        self.obj = bpy.data.objects.new(name, data)
        link(self.obj)
        bpy.context.view_layer.objects.active = self.obj
        self.obj.select_set(True)
        bpy.ops.object.mode_set(mode='EDIT')
        for bname, (h, t, parent) in bones.items():
            b = data.edit_bones.new(bname)
            b.head = h
            b.tail = t
            b.roll = 0
            if parent:
                b.parent = data.edit_bones[parent]
                b.use_connect = (Vector(data.edit_bones[parent].tail) - Vector(h)).length < 1e-4
        bpy.ops.object.mode_set(mode='OBJECT')
        self.rest = {b.name: b.matrix_local.to_3x3() for b in data.bones}
        self.seg = {b.name: (Vector(b.head_local), Vector(b.tail_local)) for b in data.bones}
        for pb in self.obj.pose.bones:
            pb.rotation_mode = 'QUATERNION'

    # ---- weights
    def skin(self, parts, rigid, region, groups=None):
        """Automatic, region-aware weights.
        rigid:  {object name prefix: bone} -> 100% to one bone (props, hands, boots, head parts).
        region: region(bone, co) -> bool, the default anatomical filter.
        groups: {object name prefix: {bone prefix: multiplier}} -> garment-specific bone sets, e.g. a coat body
                that may only follow hips/spine/chest (1.0) and a little of the thighs (0.2), never the arms.
        """
        groups = groups or {}
        for obj in parts:
            for bname in self.bones:
                obj.vertex_groups.new(name=bname)
            rb = next((b for p, b in rigid.items() if obj.name.startswith(p)), None)
            grp = next((g for p, g in groups.items() if obj.name.startswith(p)), None)
            for v in obj.data.vertices:
                if rb:
                    obj.vertex_groups[rb].add([v.index], 1.0, 'REPLACE')
                    continue
                p = v.co
                cands = []
                for b in self.bones:
                    if grp is not None:
                        mult = next((m for bp, m in grp.items() if b.startswith(bp)), 0.0)
                        if mult <= 0 or (b.endswith('.L') and p.x < -0.02) or (b.endswith('.R') and p.x > 0.02):
                            continue
                    else:
                        if not region(b, p):
                            continue
                        mult = 1.0
                    cands.append((seg_dist(p, *self.seg[b]), b, mult))
                cands.sort(key=lambda t: t[0])
                ds = cands[:3]
                if not ds:
                    ds = [(0.1, 'hips', 1.0)]
                ws = [(m / max(d, 0.012) ** 4, b) for d, b, m in ds]
                tot = sum(w for w, _ in ws)
                for w, b in ws:
                    if w / tot > 0.02:
                        obj.vertex_groups[b].add([v.index], w / tot, 'REPLACE')
            mod = obj.modifiers.new('rig', 'ARMATURE')
            mod.object = self.obj
            obj.parent = self.obj

    # ---- posing
    def set_rot(self, bone, rots):
        q = Quaternion()
        for axis, ang in rots:
            q = Quaternion(Vector(axis), ang) @ q
        rest = self.rest[bone]
        m = rest.inverted() @ q.to_matrix() @ rest
        self.obj.pose.bones[bone].rotation_quaternion = m.to_quaternion()

    def pose(self, p):
        g = p.get
        self.set_rot('hips', [(Z, g('hipsTwist', 0)), (Y, g('hipsRoll', 0))])
        self.obj.pose.bones['hips'].location = (0, g('hipsY', 0), 0)
        self.set_rot('spine', [(X, g('lean', 0) * 0.5), (Z, g('torsoTwist', 0))])
        self.set_rot('chest', [(X, g('lean', 0) * 0.5 + g('breath', 0))])
        self.set_rot('neck', [(X, g('neck', 0))])
        self.set_rot('head', [(X, g('headTilt', 0)), (Z, g('headTurn', 0)), (Y, g('headRoll', 0))])
        for side, sgn in (('L', 1), ('R', -1)):
            i = 0 if side == 'L' else 1
            self.set_rot(f'thigh.{side}', [(X, -g('thigh', (0, 0))[i])])
            self.set_rot(f'shin.{side}', [(X, g('knee', (0, 0))[i])])
            self.set_rot(f'foot.{side}', [(X, g('ankle', (0, 0))[i])])
            arm_out = g('armOut', 0.08)
            arm_out = arm_out[i] if isinstance(arm_out, tuple) else arm_out
            twist = g('armTwist', (0, 0))[i]
            self.set_rot(f'upperarm.{side}', [(Z, -sgn * twist), (Y, -sgn * arm_out), (X, -g('shoulder', (0, 0))[i])])
            self.set_rot(f'forearm.{side}', [(X, -g('elbow', (0.25, 0.25))[i]), (Z, -sgn * g('foreTwist', (0, 0))[i])])
            self.set_rot(f'hand.{side}', [(X, -g('wrist', (0.1, 0.1))[i])])
        # character-specific extra bones (coat tails, etc.): {'bone': [(axis, angle), ...]}
        for bone, rots in g('extra', {}).items():
            if bone in self.rest:
                self.set_rot(bone, rots)

    def action(self, name, frames, fn, loop=True):
        arm = self.obj
        act = bpy.data.actions.new(name)
        arm.animation_data_create()
        arm.animation_data.action = act
        for f in range(frames + (1 if loop else 0)):
            t = (f % frames) / frames if loop else f / max(1, frames - 1)
            for pb in arm.pose.bones:
                pb.rotation_quaternion = Quaternion()
                pb.location = (0, 0, 0)
            self.pose(fn(t))
            for pb in arm.pose.bones:
                pb.keyframe_insert('rotation_quaternion', frame=f)
                pb.keyframe_insert('location', frame=f)
        act.use_fake_user = True
        track = arm.animation_data.nla_tracks.new()
        track.name = name
        track.strips.new(name, 0, act)
        arm.animation_data.action = None
        return act

    def rest_pose(self):
        for pb in self.obj.pose.bones:
            pb.rotation_quaternion = Quaternion()
            pb.location = (0, 0, 0)


def seg_dist(p, a, b):
    ab = b - a
    t = max(0.0, min(1.0, (p - a).dot(ab) / ab.length_squared))
    return (a + ab * t - p).length


def default_region(arm_min_x=0.135, torso_max_x=0.215):
    ARM = ('upperarm', 'forearm', 'hand')
    LEG = ('thigh', 'shin', 'foot')
    TORSO = ('hips', 'spine', 'chest', 'neck', 'head')

    def region(bone, p):
        x, z = p.x, p.z
        if bone.endswith('.L') and x < -0.02:
            return False
        if bone.endswith('.R') and x > 0.02:
            return False
        if bone.startswith(ARM):
            return abs(x) > arm_min_x and z > 0.75
        if bone.startswith(LEG):
            return z < 1.0 and abs(x) < 0.24
        if bone.startswith(TORSO):
            return abs(x) < torso_max_x or z > 1.36
        return True

    return region


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


# ---------------------------------------------------------------------------- finishing
def join_all(parts, name):
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:
        o.select_set(True)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    parts[0].name = name
    return parts[0]


def bake_ao_to_vertex_colors(obj, samples=48, distance=0.25):
    """Bake ambient occlusion into a colour attribute (exported as glTF COLOR_0)."""
    scene = bpy.context.scene
    if scene.world is None:
        scene.world = bpy.data.worlds.new('World')
    scene.world.light_settings.distance = distance
    scene.render.engine = 'CYCLES'
    scene.cycles.device = 'CPU'
    scene.cycles.samples = samples
    me = obj.data
    attr = me.color_attributes.new(name='AO', type='BYTE_COLOR', domain='CORNER')
    me.color_attributes.active_color = attr
    me.color_attributes.render_color_index = me.color_attributes.find('AO')
    bpy.ops.object.select_all(action='DESELECT')
    obj.select_set(True)
    bpy.context.view_layer.objects.active = obj
    scene.render.bake.target = 'VERTEX_COLORS'
    bpy.ops.object.bake(type='AO')
    # Soften: AO in the 0.35..1 range (stylised, never pitch black).
    for d in attr.data:
        c = d.color
        v = 0.35 + 0.65 * c[0]
        d.color = (v, v, v, 1.0)


def export_glb(path):
    kw = dict(
        filepath=path,
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
    try:
        bpy.ops.export_scene.gltf(**kw, export_vertex_color='ACTIVE')
    except TypeError:
        bpy.ops.export_scene.gltf(**kw, export_colors=True)
