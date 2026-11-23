"""Leon v2 — modelled after the approved character lineup concept art (docs/design/reference/character_lineup_concept.png).

Concept cues kept: curly brown hair, friendly face, oversized olive parka worn open over a cream cable-knit sweater,
grey hoodie hood behind the neck, brown leather messenger bag on a cross-body strap (bag on his left hip),
brass compass in his right hand (Dave's gift), baggy brown wool trousers with rolled cuffs, socks, chunky lace-up boots.
No scarf (the M02 scarf was a placeholder idea; the concept has none).

Run: python tools/blender/make_leon_v2.py out.glb   (bpy module)  — or —  blender -b -P make_leon_v2.py -- out.glb
"""
import math
import os
import random
import sys

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import bpy  # noqa: E402
from mathutils import Euler, Vector  # noqa: E402
from mathutils.bvhtree import BVHTree  # noqa: E402

import charlib as C  # noqa: E402

OUT = sys.argv[-1] if sys.argv[-1].endswith('.glb') else 'leon_v2.glb'
rnd = random.Random(23)
C.reset_scene()

# ------------------------------------------------------------------ palette (from the concept)
M = {
    'skin': C.material('skin', 0xD8AE98, 0.62),
    'hair': C.material('hair', 0x3E2616, 0.7),
    'eyes_white': C.material('eyes_white', 0xF4EFE8, 0.25),
    'iris': C.material('iris', 0x5A3A22, 0.3),
    'pupil': C.material('pupil', 0x120C08, 0.2),
    'highlight': C.material('highlight', 0xFFFFFF, 0.1, emit=0xFFFFFF, emit_strength=1.5),
    'lip': C.material('lip', 0x9A5444, 0.5),
    'knit': C.material('knit', 0xD9C9A6, 0.95),
    'canvas': C.material('canvas', 0x5C5E36, 0.9),
    'canvas_dark': C.material('canvas_dark', 0x4A4C2A, 0.92),
    'hood': C.material('hood', 0x8E8A82, 0.95),
    'cord': C.material('cord', 0xD9D2C4, 0.8),
    'wool': C.material('wool', 0x5A4232, 0.95),
    'sock': C.material('sock', 0x6E625A, 0.95),
    'leather': C.material('leather', 0x7A4A28, 0.55),
    'sole': C.material('sole', 0x2B1F17, 0.8),
    'lace': C.material('lace', 0xE6DCC8, 0.8),
    'bag': C.material('bag', 0x6E4426, 0.5),
    'brass': C.material('brass', 0xC9944A, 0.32, metal=1.0),
    'glass': C.material('compass_face', 0xF2E8D2, 0.2),
}

rig = C.Rig('Leon', C.humanoid_bones(1.0, shoulder=0.2, hip=0.092))
parts = []
P = parts.append

# ------------------------------------------------------------------ head
HC = Vector((0, -0.004, 1.645))
RX, RY, RZ = 0.103, 0.112, 0.13


def head_shape(p):
    q = p - HC
    x, y, z = q.x, q.y, q.z
    if z < 0:
        k = min(1.0, -z / RZ)
        x *= 1 - 0.24 * k ** 1.5
        y *= 1 - 0.08 * k
        if y < 0 and z < -0.05:
            y -= 0.008 * min(1, (-z - 0.05) / 0.06)  # chin
    if y < -0.06:
        y = -0.06 + (y + 0.06) * 0.82  # flatter face plane
    if y > 0.03:
        y *= 1.05  # fuller back of the head
    return HC + Vector((x, y, z))


head = C.blob('head', HC, (RX, RY, RZ), M['skin'], (40, 28))
C.deform(head, head_shape)
P(head)
dg = bpy.context.evaluated_depsgraph_get()
bvh = BVHTree.FromObject(head, dg)


def face_y(x, z):
    """Front surface depth of the head at (x, z) via ray cast."""
    hit = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
    return hit[0].y if hit[0] else HC.y - RY


# eyes (big, friendly, stylised)
for sx in (1, -1):
    ex, ez = 0.037 * sx, HC.z + 0.006
    fy = face_y(ex, ez)
    ey = fy + 0.011
    P(C.blob(f'eyeW{sx}', (ex, ey, ez), (0.021, 0.017, 0.0205), M['eyes_white'], (20, 14)))
    P(C.blob(f'iris{sx}', (ex - 0.002 * sx, ey - 0.0128, ez - 0.0015), (0.0128, 0.0062, 0.0135), M['iris'], (16, 10)))
    P(C.blob(f'pupil{sx}', (ex - 0.002 * sx, ey - 0.0172, ez - 0.0015), (0.0062, 0.003, 0.0066), M['pupil'], (12, 8)))
    P(C.blob(f'hl{sx}', (ex - 0.006 * sx + 0.004, ey - 0.0192, ez + 0.0048), (0.0029, 0.0015, 0.0029), M['highlight'], (8, 6)))
    # upper lid (skin) resting high: open, friendly gaze
    P(C.blob(f'lid{sx}', (ex, ey - 0.003, ez + 0.0175), (0.0225, 0.0135, 0.0068), M['skin'], (16, 10), rot=Euler((0.3, 0, 0))))
    # brows (thick, soft arch)
    bz = ez + 0.034
    by = face_y(0.04 * sx, bz) - 0.002
    P(C.skin_mesh(f'brow{sx}', [(0.016 * sx, by + 0.002, bz - 0.003), (0.038 * sx, by - 0.001, bz + 0.004), (0.058 * sx, by + 0.006, bz)], [(0, 1), (1, 2)], [(0.0055, 0.004), (0.006, 0.0045), (0.004, 0.003)], M['hair'], subdiv=1))
    # ears
    P(C.blob(f'ear{sx}', (RX * 0.98 * sx, HC.y + 0.006, HC.z - 0.006), (0.013, 0.021, 0.031), M['skin'], (12, 10)))
# nose
ny = face_y(0, HC.z - 0.018)
P(C.blob('nose', (0, ny - 0.008, HC.z - 0.016), (0.0135, 0.016, 0.024), M['skin'], (14, 10)))
P(C.blob('noseTip', (0, ny - 0.016, HC.z - 0.03), (0.0125, 0.0115, 0.0105), M['skin'], (12, 8)))
# smile
mz = HC.z - 0.052
mouth = []
for i, mx in enumerate((-0.026, -0.013, 0.0, 0.013, 0.026)):
    lift = 0.006 * (abs(mx) / 0.026) ** 1.6
    mouth.append((mx, face_y(mx, mz + lift) + 0.0015, mz + lift))
P(C.skin_mesh('mouth', mouth, [(i, i + 1) for i in range(4)], [(0.0034, 0.0026)] * 5, M['lip'], subdiv=1))
# neck
P(C.skin_mesh('neck', [(0, 0.005, 1.44), (0, 0.0, 1.56)], [(0, 1)], [(0.046, 0.044), (0.044, 0.042)], M['skin'], subdiv=1))

# ------------------------------------------------------------------ hair: curly volume
cap = C.blob('hairCap', HC + Vector((0, 0.008, 0.012)), (RX * 1.0, RY * 1.02, RZ * 1.0), M['hair'], (32, 20))
C.delete_faces(cap, lambda c: c.z < HC.z - 0.035 or (c.y < HC.y - 0.055 and c.z < HC.z + 0.05))
P(cap)
n_curls = 0
for i in range(420):
    if n_curls >= 170:
        break
    th = rnd.uniform(0, math.pi * 0.62)
    ph = rnd.uniform(0, math.tau)
    d = Vector((math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th)))
    pos = HC + Vector((d.x * RX * 1.05, d.y * RY * 1.06, d.z * RZ * 1.0 + 0.012))
    rel = pos - HC
    if rel.y < -0.05 and rel.z < 0.055:
        continue  # keep the face clear
    if abs(rel.x) > RX * 0.8 and rel.z < -0.01:
        continue  # above the ears only
    r = rnd.uniform(0.02, 0.034)
    rot = Euler((rnd.uniform(0, 3), rnd.uniform(0, 3), rnd.uniform(0, 3)))
    P(C.blob(f'curl{n_curls}', pos, (r * 1.25, r, r * 0.9), M['hair'], (10, 7), seed=i, noise=0.18, rot=rot))
    n_curls += 1
for i in range(17):  # loose fringe curls breaking the hairline over the forehead
    fx = -0.07 + i * 0.0088 + rnd.uniform(-0.004, 0.004)
    fz = HC.z + 0.052 + rnd.uniform(-0.006, 0.016) - 0.012 * (abs(fx) / 0.07) ** 2
    fy = face_y(fx, fz) - 0.004
    r = rnd.uniform(0.017, 0.026)
    P(C.blob(f'fringe{i}', (fx, fy, fz), (r, r * 0.8, r * 1.25), M['hair'], (10, 7), seed=100 + i, noise=0.22, rot=Euler((rnd.uniform(-0.6, 0.6), 0, rnd.uniform(-0.8, 0.8)))))

# ------------------------------------------------------------------ sweater (cream knit) — torso + sleeves
P(C.skin_mesh('sweater',
              [(0, 0, 0.9), (0, 0.0, 1.08), (0, 0.005, 1.3), (0, 0.01, 1.42), (0, 0.004, 1.49)],
              [(0, 1), (1, 2), (2, 3), (3, 4)],
              [(0.15, 0.11), (0.142, 0.104), (0.158, 0.112), (0.15, 0.104), (0.066, 0.062)], M['knit'], subdiv=2))
for sx in (1, -1):
    P(C.skin_mesh(f'sleeveKnit{sx}', [(0.15 * sx, 0, 1.42), (0.205 * sx, 0, 1.40), (0.222 * sx, 0, 1.14), (0.232 * sx, -0.01, 0.9)],
                  [(0, 1), (1, 2), (2, 3)], [(0.06, 0.06), (0.06, 0.06), (0.052, 0.052), (0.046, 0.046)], M['knit'], subdiv=2))
for sx in (1, -1):  # ribbed cuffs
    P(C.skin_mesh(f'cuffKnit{sx}', [(0.232 * sx, -0.01, 0.935), (0.233 * sx, -0.01, 0.89)], [(0, 1)], [(0.055, 0.055), (0.052, 0.052)], M['knit'], subdiv=1))
P(C.skin_mesh('collarKnit', [(0, 0.008, 1.465), (0, 0.006, 1.515)], [(0, 1)], [(0.074, 0.068), (0.066, 0.062)], M['knit'], subdiv=1))

# ------------------------------------------------------------------ parka (olive canvas), worn open
parka = C.skin_mesh('parka',
                    [(0, 0.004, 0.78), (0, 0.004, 0.93), (0, 0.004, 1.08), (0, 0.008, 1.3), (0, 0.012, 1.43), (0, 0.016, 1.505)],
                    [(0, 1), (1, 2), (2, 3), (3, 4), (4, 5)],
                    [(0.195, 0.165), (0.188, 0.158), (0.18, 0.15), (0.19, 0.148), (0.178, 0.136), (0.104, 0.098)], M['canvas'], subdiv=2, solidify=0.008)
C.delete_faces(parka, lambda c: (c.y < -0.075 and abs(c.x) < 0.058 and 0.76 < c.z < 1.55) or c.z < 0.775)
P(parka)
for sx in (1, -1):
    P(C.skin_mesh(f'sleeveParka{sx}', [(0.14 * sx, 0.004, 1.44), (0.21 * sx, 0.0, 1.42), (0.229 * sx, 0.0, 1.14), (0.236 * sx, -0.006, 0.975)],
                  [(0, 1), (1, 2), (2, 3)], [(0.085, 0.085), (0.085, 0.085), (0.08, 0.08), (0.077, 0.077)], M['canvas'], subdiv=2))
for sx in (1, -1):
    P(C.skin_mesh(f'parkaCuff{sx}', [(0.236 * sx, -0.006, 1.005), (0.237 * sx, -0.007, 0.968)], [(0, 1)], [(0.086, 0.086), (0.084, 0.084)], M['canvas_dark'], subdiv=1))
    P(C.rounded_box(f'pocket{sx}', (0.108 * sx, -0.16, 0.9), (0.105, 0.02, 0.075), M['canvas_dark'], 0.008))
    P(C.rounded_box(f'chestPocket{sx}', (0.098 * sx, -0.152, 1.27), (0.075, 0.016, 0.05), M['canvas_dark'], 0.006))
# hoodie hood bunched behind the neck + drawstrings
P(C.blob('hood', (0, 0.085, 1.475), (0.128, 0.074, 0.07), M['hood'], (24, 14), seed=4, noise=0.06))
P(C.skin_mesh('hoodRim', [(-0.08, -0.03, 1.49), (0, 0.06, 1.535), (0.08, -0.03, 1.49)], [(0, 1), (1, 2)], [(0.025, 0.025), (0.03, 0.03), (0.025, 0.025)], M['hood'], subdiv=2))
for sx in (1, -1):
    P(C.skin_mesh(f'cord{sx}', [(0.03 * sx, -0.11, 1.47), (0.033 * sx, -0.135, 1.38), (0.03 * sx, -0.14, 1.31)], [(0, 1), (1, 2)], [(0.005, 0.005)] * 3, M['cord'], subdiv=1))

# ------------------------------------------------------------------ trousers, socks, boots
P(C.skin_mesh('trousers',
              [(0, 0.0, 0.97), (0.092, 0.0, 0.88), (0.094, -0.008, 0.52), (0.096, 0.004, 0.24),
               (-0.092, 0.0, 0.88), (-0.094, -0.008, 0.52), (-0.096, 0.004, 0.24)],
              [(0, 1), (1, 2), (2, 3), (0, 4), (4, 5), (5, 6)],
              [(0.17, 0.122), (0.118, 0.118), (0.106, 0.106), (0.1, 0.1), (0.118, 0.118), (0.106, 0.106), (0.1, 0.1)], M['wool'], subdiv=2))
for sx in (1, -1):
    x = 0.096 * sx
    P(C.skin_mesh(f'cuffRoll{sx}', [(x, 0.004, 0.255), (x, 0.004, 0.2)], [(0, 1)], [(0.107, 0.107), (0.104, 0.104)], M['wool'], subdiv=1))
    P(C.skin_mesh(f'sock{sx}', [(x, 0.006, 0.21), (x, 0.006, 0.14)], [(0, 1)], [(0.054, 0.054), (0.056, 0.056)], M['sock'], subdiv=1))
    P(C.cylinder(f'bootShaft{sx}', (x, 0.004, 0.105), 0.064, 0.13, M['leather'], 28))
    P(C.skin_mesh(f'bootCollar{sx}', [(x, 0.004, 0.165), (x, 0.004, 0.18)], [(0, 1)], [(0.068, 0.068), (0.066, 0.066)], M['leather'], subdiv=1))
    P(C.rounded_box(f'bootFoot{sx}', (x, -0.06, 0.052), (0.118, 0.27, 0.092), M['leather'], 0.04))
    P(C.blob(f'bootToe{sx}', (x, -0.17, 0.05), (0.06, 0.06, 0.047), M['leather'], (16, 10)))
    P(C.rounded_box(f'bootSole{sx}', (x, -0.06, 0.016), (0.128, 0.3, 0.034), M['sole'], 0.012))
    for k in range(4):
        P(C.rounded_box(f'lace{sx}_{k}', (x, -0.072 - k * 0.022 + 0.0, 0.16 - k * 0.026), (0.062, 0.006, 0.008), M['lace'], 0.002))

# ------------------------------------------------------------------ hands
for sx in (1, -1):
    hx = 0.235 * sx
    P(C.blob(f'palm{sx}', (hx, -0.016, 0.835), (0.026, 0.038, 0.05), M['skin'], (14, 10)))
    P(C.blob(f'thumb{sx}', (hx - 0.012 * sx, -0.042, 0.85), (0.012, 0.013, 0.026), M['skin'], (10, 8), rot=Euler((0.4, 0, 0))))

# ------------------------------------------------------------------ messenger bag + strap, compass
# bag rides on the left hip, slightly behind it (clear of the swinging hand), broad face outward
BAG = Vector((0.2, 0.095, 0.82))
bag_rot = Euler((0, 0, -0.55))
def bag_pt(dx, dy, dz):
    v = Vector((dx, dy, dz))
    v.rotate(bag_rot)
    return BAG + v
P(C.rounded_box('bag', BAG, (0.075, 0.3, 0.24), M['bag'], 0.025, rot=bag_rot))
P(C.rounded_box('bagFlap', bag_pt(0.043, 0, 0.045), (0.014, 0.31, 0.16), M['bag'], 0.008, rot=bag_rot))
P(C.rounded_box('bagBuckle', bag_pt(0.053, 0, 0.0), (0.01, 0.04, 0.03), M['brass'], 0.003, rot=bag_rot))
P(C.skin_mesh('strapFront', [(-0.13, -0.135, 1.43), (-0.04, -0.168, 1.3), (0.08, -0.17, 1.12), (0.17, -0.08, 0.96), tuple(bag_pt(0.0, -0.13, 0.11))], [(0, 1), (1, 2), (2, 3), (3, 4)], [(0.017, 0.006)] * 5, M['bag'], subdiv=1))
P(C.skin_mesh('strapBack', [(-0.13, 0.09, 1.43), (-0.02, 0.15, 1.28), (0.12, 0.16, 1.1), tuple(bag_pt(0.0, 0.13, 0.11))], [(0, 1), (1, 2), (2, 3)], [(0.017, 0.006)] * 4, M['bag'], subdiv=1))
P(C.skin_mesh('strapShoulder', [(-0.13, -0.135, 1.43), (-0.15, -0.02, 1.47), (-0.13, 0.09, 1.43)], [(0, 1), (1, 2)], [(0.017, 0.007)] * 3, M['bag'], subdiv=1))
# compass in the right hand (case, open lid, face, needle)
cx, cy, cz = -0.245, -0.055, 0.805
P(C.cylinder('compassCase', (cx, cy, cz), 0.03, 0.013, M['brass'], 32, rot=Euler((math.pi / 2 - 0.5, 0, 0))))
P(C.cylinder('compassFace', (cx, cy - 0.006, cz + 0.003), 0.026, 0.004, M['glass'], 32, rot=Euler((math.pi / 2 - 0.5, 0, 0))))
P(C.cylinder('compassLid', (cx, cy + 0.012, cz + 0.03), 0.03, 0.006, M['brass'], 32, rot=Euler((math.pi / 2 + 0.6, 0, 0))))
P(C.skin_mesh('compassChain', [(cx, cy + 0.01, cz + 0.03), (cx + 0.01, cy + 0.02, cz + 0.075)], [(0, 1)], [(0.003, 0.003)] * 2, M['brass'], subdiv=1))

# ------------------------------------------------------------------ skinning
RIGID = {
    'head': 'head', 'eye': 'head', 'iris': 'head', 'pupil': 'head', 'hl': 'head', 'lid': 'head', 'brow': 'head', 'ear': 'head',
    'nose': 'head', 'mouth': 'head', 'hairCap': 'head', 'curl': 'head', 'fringe': 'head',
    'hood': 'chest', 'cord': 'chest', 'strap': 'chest', 'chestPocket': 'chest', 'collarKnit': 'neck',
    'bag': 'hips', 'pocket1': 'hips', 'pocket-1': 'hips',
    'compass': 'hand.R',
}
for sx, side in ((1, 'L'), (-1, 'R')):
    for pref in ('cuffRoll', 'sock'):
        RIGID[f'{pref}{sx}'] = f'shin.{side}'
    for pref in ('bootShaft', 'bootCollar', 'bootFoot', 'bootToe', 'bootSole', 'lace'):
        RIGID[f'{pref}{sx}'] = f'foot.{side}'
    for pref in ('palm', 'thumb'):
        RIGID[f'{pref}{sx}'] = f'hand.{side}'
    for pref in ('cuffKnit', 'parkaCuff'):
        RIGID[f'{pref}{sx}'] = f'forearm.{side}'
GROUPS = {
    # torso garments never follow the arms; the parka hem gets a little thigh motion
    'sweater': {'hips': 1, 'spine': 1, 'chest': 1, 'neck': 0.5},
    'parka': {'hips': 1, 'spine': 1, 'chest': 1, 'neck': 0.5, 'thigh': 0.03},
    # sleeves follow the arm chain, blending into the chest at the shoulder seam
    'sleeve': {'upperarm': 1, 'forearm': 1, 'hand': 0.4, 'chest': 0.35},
    'trousers': {'hips': 1, 'thigh': 1, 'shin': 1},
}
rig.skin(parts, RIGID, C.default_region(arm_min_x=0.14, torso_max_x=0.225), GROUPS)

# ------------------------------------------------------------------ animation (shared clip contract)
import clips  # noqa: E402

clips.leon_clips(rig)

body = C.join_all(parts, 'LeonMesh')
C.bake_ao_to_vertex_colors(body, samples=48, distance=0.22)
C.export_glb(OUT)
print('EXPORTED', OUT, 'verts', len(body.data.vertices), 'curls', n_curls, 'actions', len(bpy.data.actions))
