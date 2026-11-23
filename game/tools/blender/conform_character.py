"""Conform an AI-generated (or artist / scanned) character mesh to the game's character contract.

  input : any GLB / glTF / OBJ / FBX with ONE humanoid character (textured or not, rigged or not, any scale/orientation)
  output: GLB with our skeleton (shared bone names), automatic skin weights, the clip library (Leon or MM-01),
          the original textures, feet on the ground, facing the game's front, at the requested height.

Steps (all local, nothing is uploaded anywhere):
  1. import, drop helper objects / foreign rigs, join into one mesh, apply transforms
  2. orientation: up = Z; left-right axis from the widest chest slice (PCA); front from where the toes point
  3. scale to the target height, feet on z = 0, pelvis centred
  4. optional decimation to a triangle budget (UVs kept)
  5. landmarks from mesh slices → our humanoid skeleton (hands, shoulders, hips, head)
  6. skin weights: Blender bone heat ('automatic weights'); falls back to region-aware distance weights
  7. clips from tools/blender/clips.py → GLB

Run: python tools/blender/conform_character.py <in> <out.glb> --height 1.78 --clips leon [--max-tris 45000]
"""
import argparse
import math
import os
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Matrix, Vector  # noqa: E402

import charlib as C  # noqa: E402
import clips  # noqa: E402

argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else sys.argv[1:]
ap = argparse.ArgumentParser()
ap.add_argument('inp')
ap.add_argument('out')
ap.add_argument('--height', type=float, default=1.78)
ap.add_argument('--clips', choices=['leon', 'mm01'], default='leon')
ap.add_argument('--max-tris', type=int, default=45000)
ap.add_argument('--weights', choices=['auto', 'heat', 'distance'], default='auto')
args = ap.parse_args(argv)
report = {}

# ------------------------------------------------------------------ 1. import + join
bpy.ops.wm.read_factory_settings(use_empty=True)
ext = os.path.splitext(args.inp)[1].lower()
if ext in ('.glb', '.gltf'):
    bpy.ops.import_scene.gltf(filepath=args.inp)
elif ext == '.obj':
    bpy.ops.wm.obj_import(filepath=args.inp)
elif ext == '.fbx':
    bpy.ops.import_scene.fbx(filepath=args.inp)
else:
    raise SystemExit(f'unsupported input {ext}')
for c in [c for c in bpy.data.collections if c.name.startswith('glTF_not_exported')]:
    for o in list(c.objects):
        bpy.data.objects.remove(o)
    bpy.data.collections.remove(c)
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
if not meshes:
    raise SystemExit('no mesh in input')
for o in meshes:
    for m in list(o.modifiers):
        if m.type == 'ARMATURE':
            o.modifiers.remove(m)
    mw = o.matrix_world.copy()
    o.parent = None
    o.matrix_world = mw
    o.vertex_groups.clear()
for o in [o for o in bpy.data.objects if o.type != 'MESH']:
    bpy.data.objects.remove(o)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:
    o.select_set(True)
bpy.context.view_layer.objects.active = meshes[0]
if len(meshes) > 1:
    bpy.ops.object.join()
body = bpy.context.view_layer.objects.active
body.name = 'CharacterMesh'
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)


def verts():
    return [v.co.copy() for v in body.data.vertices]


# ------------------------------------------------------------------ 2. orientation
V = verts()
zs = [v.z for v in V]
z0, z1 = min(zs), max(zs)
H0 = z1 - z0


def slice_pts(lo, hi):
    return [v for v in V if z0 + lo * H0 <= v.z <= z0 + hi * H0]


chest = slice_pts(0.66, 0.74)
cx = sum(v.x for v in chest) / len(chest)
cy = sum(v.y for v in chest) / len(chest)
sxx = sum((v.x - cx) ** 2 for v in chest)
syy = sum((v.y - cy) ** 2 for v in chest)
sxy = sum((v.x - cx) * (v.y - cy) for v in chest)
ang = 0.5 * math.atan2(2 * sxy, sxx - syy)  # direction of the widest spread (left-right axis)
rot = Matrix.Rotation(-ang, 4, 'Z')
body.data.transform(rot)
V = verts()
# Front: toes point forward. Compare the foot slab with the ankle slab along Y; the game wants front = -Y.
foot = [v for v in V if v.z <= z0 + 0.04 * H0]
ankle = [v for v in V if z0 + 0.07 * H0 <= v.z <= z0 + 0.14 * H0]
fy = sum(v.y for v in foot) / max(1, len(foot)) - sum(v.y for v in ankle) / max(1, len(ankle))
if fy > 0:
    body.data.transform(Matrix.Rotation(math.pi, 4, 'Z'))
report['orientation_deg'] = round(math.degrees(-ang) + (180 if fy > 0 else 0), 1)

# ------------------------------------------------------------------ 3. scale + ground + centre
V = verts()
z0 = min(v.z for v in V)
H0 = max(v.z for v in V) - z0
k = args.height / H0
pelvis = [v for v in V if z0 + 0.45 * H0 <= v.z <= z0 + 0.58 * H0]
px = sum(v.x for v in pelvis) / len(pelvis)
py = sum(v.y for v in pelvis) / len(pelvis)
body.data.transform(Matrix.Scale(k, 4) @ Matrix.Translation((-px, -py, -z0)))
H = args.height
report['scale'] = round(k, 4)

# ------------------------------------------------------------------ 4. triangle budget
tris = sum(len(p.vertices) - 2 for p in body.data.polygons)
report['tris_in'] = tris
if tris > args.max_tris:
    dec = body.modifiers.new('dec', 'DECIMATE')
    dec.ratio = args.max_tris / tris
    bpy.ops.object.modifier_apply(modifier='dec')
body.data.update()
report['tris_out'] = sum(len(p.vertices) - 2 for p in body.data.polygons)

# Clean-up that bone heat needs: merge duplicates, drop degenerate faces / loose parts, consistent normals.
import bmesh  # noqa: E402

bm = bmesh.new()
bm.from_mesh(body.data)
bmesh.ops.remove_doubles(bm, verts=bm.verts, dist=0.0006 * H)
bmesh.ops.dissolve_degenerate(bm, edges=bm.edges, dist=0.0002 * H)
loose = [v for v in bm.verts if not v.link_faces]
bmesh.ops.delete(bm, geom=loose, context='VERTS')
bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
bm.to_mesh(body.data)
bm.free()
body.data.update()

# ------------------------------------------------------------------ 5. landmarks → skeleton
V = verts()


def extreme(lo, hi, side):
    # Outermost point of one side inside the plausible hand zone; |y| limit skips bags / props worn on the hip.
    pts = [v for v in V if lo * H <= v.z <= hi * H and v.x * side > 0 and abs(v.y) < 0.07 * H]
    return max(pts, key=lambda v: v.x * side) if pts else None


# Arms down / relaxed (concept-art pose): hands between 38 % and 56 % of the height, 9–17 % of the height out.
# A-pose / T-pose (what AI tools produce when asked): hands higher and further out — accepted if found there.
def find_hand(side):
    h = extreme(0.38, 0.56, side)
    if h is not None and 0.09 * H <= abs(h.x) <= 0.2 * H:
        return h
    a = extreme(0.56, 0.86, side)
    if a is not None and abs(a.x) > 0.22 * H:
        return a
    return None


handL = find_hand(1)
handR = find_hand(-1)
default_sx = 0.2 * H / 1.78
# The landmark is the OUTER surface of the sleeve/hand: the bone runs ~5.5 cm (scaled) further in.
ARM_R = 0.055 * H / 1.78
found = [abs(h.x) for h in (handL, handR) if h is not None and abs(h.x) < 0.2 * H]
shoulder_x = (min(found) - ARM_R - 0.02 * H / 1.78) if found else default_sx
shoulder_x = max(0.15 * H / 1.78, min(0.24 * H / 1.78, shoulder_x))
hip_x = 0.052 * H
s = H / 1.78
bones = C.humanoid_bones(s, shoulder=shoulder_x, hip=hip_x)
# Arm chain: shoulder → hand landmark (elbow at 52 % along, slightly behind).
for side, hand in (('L', handL), ('R', handR)):
    if hand is None:
        continue
    sh = Vector(bones[f'upperarm.{side}'][0])
    hz = max(hand.z + 0.04 * s, 0.4 * H)
    wrist = Vector((hand.x - math.copysign(ARM_R, hand.x), min(hand.y, 0.0), hz))
    elbow = sh.lerp(wrist, 0.52) + Vector((0, 0.02 * s, 0))
    tip = wrist + (wrist - elbow).normalized() * 0.09 * s
    bones[f'upperarm.{side}'] = (tuple(sh), tuple(elbow), 'chest')
    bones[f'forearm.{side}'] = (tuple(elbow), tuple(wrist), f'upperarm.{side}')
    bones[f'hand.{side}'] = (tuple(wrist), tuple(tip), f'forearm.{side}')
report['hands'] = [tuple(round(c, 3) for c in h) if h else None for h in (handL, handR)]
rig = C.Rig('Character', bones)

# ------------------------------------------------------------------ 6. weights
method = 'distance'
if args.weights in ('auto', 'heat'):
    bpy.ops.object.select_all(action='DESELECT')
    body.select_set(True)
    rig.obj.select_set(True)
    bpy.context.view_layer.objects.active = rig.obj
    try:
        bpy.ops.object.parent_set(type='ARMATURE_AUTO')
        lost = [v.index for v in body.data.vertices if not any(g.weight > 1e-4 for g in v.groups)]
        report['unweighted_after_heat'] = len(lost)
        method = 'heat' if len(lost) < 0.04 * len(body.data.vertices) else 'distance'
        if method == 'heat' and lost:
            from mathutils.kdtree import KDTree

            ok = [v for v in body.data.vertices if any(g.weight > 1e-4 for g in v.groups)]
            kd = KDTree(len(ok))
            for i, v in enumerate(ok):
                kd.insert(v.co, i)
            kd.balance()
            names = {g.index: g.name for g in body.vertex_groups}
            for vi in lost:
                _, j, _ = kd.find(body.data.vertices[vi].co)
                for g in ok[j].groups:
                    body.vertex_groups[names[g.group]].add([vi], g.weight, 'REPLACE')
    except RuntimeError as e:
        report['heat_error'] = str(e)
    if method != 'heat':
        body.parent = None
        for m in list(body.modifiers):
            body.modifiers.remove(m)
        body.vertex_groups.clear()
if method == 'distance':
    rig.skin([body], {}, C.default_region(arm_min_x=shoulder_x * 0.7, torso_max_x=shoulder_x * 1.1))
report['weights'] = method

# ------------------------------------------------------------------ 7. clips + export
(clips.leon_clips if args.clips == 'leon' else clips.mm01_clips)(rig)
C.export_glb(args.out)
report['actions'] = len(bpy.data.actions)
print('CONFORM', args.out, report)
