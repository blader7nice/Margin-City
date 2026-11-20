"""MM-01 v1 — modelled after the approved character lineup concept art (docs/design/reference/character_lineup_concept.png).

Concept cues kept: tall (~2.0 m), lean, long dark charcoal-brown greatcoat to the calves with a high upturned collar,
dark-red patterned lining visible in the open skirt, shoulder harness with brass buckles and red light strips, belt,
black gloves, tall riding boots. Face: HALF-HUMAN / HALF-CYBERNETIC — his right side (-X) carries conforming metal
plates over the temple, eye socket and jaw, a glowing implant eye, red seams and cables into the collar. His left side
is human: swept-back dark wavy hair, stubble, a stern brow. No helmet, no visor.

Material naming contract with the game (src/render/gltfInspector.ts):
  mm_eye       — implant eye; the game drives its colour with MM-01's state (patrol / suspicious / chase)
  cyber_red    — fixed red accents (temple, harness LEDs)
  coat / coat_lining / leather / skin / hair — fabric detail in src/render/fabric.ts
Extra bones: coat.L, coat.R, coat.B (coat tails with secondary motion baked into the clips).
The game finds the vision-cone origin from the 'mm_eye' primitive's bind-pose centre (no helper nodes needed).

Run: python tools/blender/make_mm01.py out.glb   (bpy module)
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

OUT = sys.argv[-1] if sys.argv[-1].endswith('.glb') else 'mm01.glb'
rnd = random.Random(1)
C.reset_scene()
S = 1.12  # skeleton height scale (≈2.0 m)
X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)

M = {
    'skin': C.material('skin', 0xB98E7A, 0.58),
    'stubble': C.material('stubble', 0x3B302A, 0.9),
    'hair': C.material('hair', 0x17120F, 0.55),
    'eyes_white': C.material('eyes_white', 0xE6DED6, 0.3),
    'iris': C.material('iris', 0x3A2A20, 0.3),
    'pupil': C.material('pupil', 0x0A0806, 0.2),
    'lip': C.material('lip', 0x8A5A50, 0.55),
    'metal': C.material('cyber_metal', 0x454B53, 0.32, metal=1.0),
    'metal_dark': C.material('cyber_metal_dark', 0x23272C, 0.4, metal=1.0),
    'cable': C.material('cable', 0x2C4448, 0.45, metal=0.6),
    'red': C.material('cyber_red', 0xFF2A1A, 0.4, emit=0xFF2A1A, emit_strength=3.5),
    'eye': C.material('mm_eye', 0xFFFFFF, 0.2, emit=0xFFFFFF, emit_strength=5.0),
    'coat': C.material('coat', 0x2E2724, 0.78),
    'lining': C.material('coat_lining', 0x5A1414, 0.7),
    'leather': C.material('leather', 0x1E1714, 0.42),
    'glove': C.material('glove', 0x111012, 0.4),
    'trousers': C.material('trousers', 0x1A1A1E, 0.85),
    'boot': C.material('boot', 0x15100D, 0.28),
    'brass': C.material('brass', 0xB08A4A, 0.35, metal=1.0),
}

bones = C.humanoid_bones(S, shoulder=0.205, hip=0.1)
bones.update({
    'coat.L': ((0.13, 0.0, 1.06), (0.2, 0.0, 0.34), 'hips'),
    'coat.R': ((-0.13, 0.0, 1.06), (-0.2, 0.0, 0.34), 'hips'),
    'coat.B': ((0.0, 0.12, 1.06), (0.0, 0.21, 0.34), 'hips'),
})
rig = C.Rig('MM01', bones)
parts = []
P = parts.append

# ------------------------------------------------------------------ head: angular adult male
HC = Vector((0, -0.006, 1.842))
RX, RY, RZ = 0.088, 0.104, 0.122


def head_shape(p):
    q = p - HC
    x, y, z = q.x, q.y, q.z
    if z < 0:
        k = min(1.0, -z / RZ)
        x *= 1 - 0.13 * k ** 2.2  # square jaw
        y *= 1 - 0.05 * k
        if y < 0 and z < -0.07:
            y -= 0.012 * min(1, (-z - 0.07) / 0.04) * max(0.0, 1 - abs(x) / 0.05)  # chin
    if y < -0.055:
        y = -0.055 + (y + 0.055) * 0.78
    if 0.0 < z < 0.04 and y < -0.04:
        x *= 1.03  # cheekbones
    return HC + Vector((x, y, z))


head = C.blob('head', HC, (RX, RY, RZ), M['skin'], (44, 30))
C.deform(head, head_shape)
P(head)
dg = bpy.context.evaluated_depsgraph_get()
bvh = BVHTree.FromObject(head, dg)


def face_y(x, z):
    hit = bvh.ray_cast(Vector((x, -1.0, z)), Vector((0, 1, 0)))
    return hit[0].y if hit[0] else HC.y - RY


def shell(name, mat, keep, scale=1.01, thick=0.0):
    sh = C.dup_mesh(head, name, mat)
    C.delete_faces(sh, lambda c: not keep(c - HC))
    for v in sh.data.vertices:
        v.co = HC + (v.co - HC) * scale
    if thick:
        sh = C.solidify(sh, thick, offset=1.0)
    for p in sh.data.polygons:
        p.use_smooth = True
    return sh


EZ = HC.z + 0.008
# --- cybernetic half (his right, -X): plates conform to the skull
P(shell('plateTemple', M['metal'], lambda c: c.x < -0.03 and -0.012 < c.z < 0.07 and c.y < 0.05 and not (abs(c.x + 0.034) < 0.016 and abs(c.z - 0.008) < 0.012), 1.012, 0.004))
P(shell('plateJaw', M['metal'], lambda c: c.x < -0.045 and -0.105 < c.z < -0.025 and c.y < 0.035, 1.012, 0.004))
P(shell('plateUnder', M['metal_dark'], lambda c: c.x < -0.025 and -0.03 < c.z < -0.008 and c.y < -0.02, 1.006, 0.003))
# implant eye + socket ring
ex = -0.034
ey = face_y(ex, EZ) + 0.004
P(C.blob('eyeImplant', (ex, ey - 0.006, EZ), (0.0125, 0.008, 0.0115), M['eye'], (16, 10)))
ring = [(ex + math.cos(a) * 0.018, face_y(ex + math.cos(a) * 0.018, EZ + math.sin(a) * 0.016) - 0.006, EZ + math.sin(a) * 0.016) for a in (i / 12 * math.tau for i in range(12))]
P(C.skin_mesh('eyeRing', ring, [(i, (i + 1) % 12) for i in range(12)], [(0.0035, 0.0035)] * 12, M['metal_dark'], subdiv=1))
# red seams (fixed accents): temple bar, brow seam, cheek seam
P(C.rounded_box('redTemple', (-RX * 0.97, HC.y - 0.012, HC.z + 0.05), (0.008, 0.042, 0.009), M['red'], 0.003, rot=Euler((0.5, 0, 0))))
P(C.skin_mesh('redBrow', [(-0.016, face_y(-0.016, EZ + 0.03) - 0.005, EZ + 0.03), (-0.05, face_y(-0.05, EZ + 0.034) - 0.005, EZ + 0.034), (-0.07, face_y(-0.07, EZ + 0.03) - 0.004, EZ + 0.03)], [(0, 1), (1, 2)], [(0.0022, 0.0022)] * 3, M['red'], subdiv=1))
P(C.skin_mesh('redCheek', [(-0.05, face_y(-0.05, HC.z - 0.03) - 0.006, HC.z - 0.03), (-0.068, face_y(-0.068, HC.z - 0.06) - 0.005, HC.z - 0.06)], [(0, 1)], [(0.0018, 0.0018)] * 2, M['red'], subdiv=1))
# rivets
for k, (rx_, rz_) in enumerate(((-0.075, 0.04), (-0.082, 0.0), (-0.07, -0.05), (-0.058, -0.085))):
    P(C.blob(f'rivet{k}', (rx_, face_y(rx_, HC.z + rz_) - 0.005, HC.z + rz_), (0.0045, 0.003, 0.0045), M['brass'], (8, 6)))
# cables from the jaw plate behind the ear into the collar
for k, dz in enumerate((0.0, 0.016, 0.032)):
    pts = [(-0.07, HC.y + 0.01 + dz * 0.3, HC.z - 0.085 - dz * 0.3), (-0.078, HC.y + 0.035, HC.z - 0.13), (-0.07, HC.y + 0.05, 1.67), (-0.06, HC.y + 0.045, 1.6)]
    P(C.skin_mesh(f'cable{k}', pts, [(0, 1), (1, 2), (2, 3)], [(0.006, 0.006)] * 4, M['cable'], subdiv=1))

# --- human half (his left, +X)
hx = 0.034
hy = face_y(hx, EZ) + 0.008
P(C.blob('eyeW', (hx, hy, EZ), (0.0165, 0.0125, 0.0112), M['eyes_white'], (18, 12)))
P(C.blob('iris', (hx - 0.002, hy - 0.0095, EZ - 0.0005), (0.0085, 0.004, 0.0088), M['iris'], (12, 8)))
P(C.blob('pupil', (hx - 0.002, hy - 0.0122, EZ - 0.0005), (0.0042, 0.002, 0.0044), M['pupil'], (10, 6)))
P(C.blob('lid', (hx, hy - 0.002, EZ + 0.0095), (0.0185, 0.012, 0.0065), M['skin'], (14, 8), rot=Euler((0.25, 0, -0.12))))
P(C.blob('lidLow', (hx, hy - 0.002, EZ - 0.0105), (0.017, 0.01, 0.004), M['skin'], (12, 8)))
# stern brows: low, angled down toward the nose
P(C.skin_mesh('browL', [(0.012, face_y(0.012, EZ + 0.022) - 0.004, EZ + 0.02), (0.035, face_y(0.035, EZ + 0.028) - 0.005, EZ + 0.028), (0.058, face_y(0.058, EZ + 0.026) - 0.003, EZ + 0.026)], [(0, 1), (1, 2)], [(0.0055, 0.004), (0.0058, 0.0042), (0.004, 0.003)], M['hair'], subdiv=1))
# nose: long, straight
ny = face_y(0, HC.z - 0.01)
P(C.blob('nose', (0, ny - 0.006, HC.z - 0.012), (0.011, 0.016, 0.034), M['skin'], (14, 10)))
P(C.blob('noseTip', (0, ny - 0.016, HC.z - 0.038), (0.012, 0.011, 0.01), M['skin'], (12, 8)))
# thin, straight mouth, corners slightly down
mz = HC.z - 0.066
mouth = [(mx, face_y(mx, mz - 0.003 * (abs(mx) / 0.024) ** 2) + 0.001, mz - 0.003 * (abs(mx) / 0.024) ** 2) for mx in (-0.024, -0.012, 0.0, 0.012, 0.024)]
P(C.skin_mesh('mouth', mouth, [(i, i + 1) for i in range(4)], [(0.0026, 0.0018)] * 5, M['lip'], subdiv=1))
# stubble shell: jaw, chin and upper lip (human side + chin; the cyber jaw is plated)
P(shell('stubble', M['stubble'], lambda c: c.x > -0.045 and c.y < 0.04 and ((-0.122 < c.z < -0.045) or (-0.06 < c.z < -0.045 and abs(c.x) < 0.03) or (c.z < -0.035 and abs(c.x) > 0.055)) and not (abs(c.x) < 0.026 and -0.075 < c.z < -0.058 and c.y < -0.06), 1.004))
P(C.blob('ear', (RX * 0.97, HC.y + 0.01, HC.z - 0.004), (0.012, 0.02, 0.03), M['skin'], (12, 10)))
P(C.blob('earImplant', (-RX * 0.98, HC.y + 0.012, HC.z - 0.004), (0.014, 0.022, 0.028), M['metal_dark'], (12, 10)))
P(C.skin_mesh('neck', [(0, 0.008, 1.6), (0, 0.004, 1.76)], [(0, 1)], [(0.05, 0.048), (0.047, 0.045)], M['skin'], subdiv=1))

# --- hair: dark, wavy, swept back, short at the sides
cap = C.dup_mesh(head, 'hairCap', M['hair'])
C.delete_faces(cap, lambda c: (c - HC).z < 0.0 or ((c - HC).y < -0.058 and (c - HC).z < 0.085) or ((c - HC).x < -0.06 and (c - HC).z < 0.07))
for v in cap.data.vertices:
    v.co = HC + (v.co - HC) * 1.03 + Vector((0, 0.004, 0.006))
P(cap)
n = 0
for i in range(260):
    if n >= 48:
        break
    th = rnd.uniform(0.05, math.pi * 0.42)
    ph = rnd.uniform(0, math.tau)
    d = Vector((math.sin(th) * math.cos(ph), math.sin(th) * math.sin(ph), math.cos(th)))
    pos = HC + Vector((d.x * RX * 1.0, d.y * RY * 1.0, d.z * RZ * 0.99 + 0.012))
    rel = pos - HC
    if rel.y < -0.06 and rel.z < 0.09:
        continue
    r = rnd.uniform(0.016, 0.022)
    # flat lock lying on the skull, combed back: local Y = surface tangent pointing back, local Z = surface normal
    nrm = d.normalized()
    tang = (Vector((0, 1, 0)) - nrm * nrm.y)
    tang = tang.normalized() if tang.length > 1e-4 else Vector((0, 1, 0))
    tang.rotate(Euler((0, 0, 0)))
    side = tang.cross(nrm)
    from mathutils import Matrix
    rotm = Matrix((side, tang, nrm)).transposed() @ Matrix.Rotation(rnd.uniform(-0.25, 0.25), 3, 'Z')
    P(C.blob(f'lock{n}', pos, (r, r * 3.6, r * 0.5), M['hair'], (10, 8), seed=i, noise=0.06, rot=rotm.to_euler()))
    n += 1
for i in range(4):  # loose strands falling on the forehead (concept)
    fx = -0.03 + i * 0.022
    fz = HC.z + 0.075 - i % 2 * 0.012
    P(C.blob(f'strand{i}', (fx, face_y(fx, fz) - 0.006, fz), (0.008, 0.008, 0.03), M['hair'], (8, 6), seed=50 + i, noise=0.1, rot=Euler((0.2, 0.3 * (i - 1.5), 0.25 * (i - 1.5)))))

# ------------------------------------------------------------------ coat
COAT_Z0 = 0.3


def coat_cut(c):
    if c.z < COAT_Z0 + 0.01:
        return True
    # open skirt below the belt: the split widens toward the hem
    if c.z < 1.14 and c.y < -0.05 and abs(c.x) < 0.03 + (1.14 - c.z) * 0.1:
        return True
    # V of the lapels above the chest
    if c.z > 1.46 and c.y < -0.05 and abs(c.x) < 0.02 + (c.z - 1.46) * 0.6:
        return True
    return False


coat = C.skin_mesh('coatBody',
                   [(0, 0.012, 0.29), (0, 0.01, 0.62), (0, 0.004, 0.95), (0, 0.0, 1.18), (0, 0.004, 1.42), (0, 0.01, 1.6), (0, 0.012, 1.67)],
                   [(i, i + 1) for i in range(6)],
                   [(0.32, 0.27), (0.27, 0.215), (0.22, 0.165), (0.188, 0.138), (0.208, 0.148), (0.215, 0.138), (0.11, 0.1)], M['coat'], subdiv=2)
C.delete_faces(coat, coat_cut)
coat.data.materials.append(M['lining'])
coat = C.solidify(coat, 0.012, offset=-1.0, material_offset=1)
P(coat)
# sleeves + cuffs with straps
for sx in (1, -1):
    P(C.skin_mesh(f'sleeve{sx}', [(0.15 * sx, 0.006, 1.6), (0.215 * sx, 0.004, 1.585), (0.226 * sx, 0.0, 1.277), (0.236 * sx, -0.01, 1.02)],
                  [(0, 1), (1, 2), (2, 3)], [(0.078, 0.078), (0.077, 0.077), (0.068, 0.068), (0.066, 0.066)], M['coat'], subdiv=2))
    cuff = C.open_tube(f'sleeveCuff{sx}', [(1.04, 0.071, 0.071, -0.01), (1.1, 0.073, 0.073, -0.008)], M['leather'], 20)
    for v in cuff.data.vertices:
        v.co.x += 0.235 * sx
    P(C.solidify(cuff, 0.006, offset=1.0))
# collar: high, upturned, open at the front
collar = C.open_tube('collar', [(1.6, 0.12, 0.11, 0.012), (1.66, 0.126, 0.116, 0.018), (1.74, 0.148, 0.134, 0.028)], M['coat'], 36,
                     cut=lambda c: c.y < -0.05 and abs(c.x) < 0.05 + (c.z - 1.6) * 0.55)
collar.data.materials.append(M['lining'])
P(C.solidify(collar, 0.016, offset=-1.0, material_offset=1))
# lapels
for sx in (1, -1):
    P(C.skin_mesh(f'lapel{sx}', [(0.03 * sx, -0.152, 1.47), (0.085 * sx, -0.148, 1.56), (0.11 * sx, -0.11, 1.63)], [(0, 1), (1, 2)], [(0.032, 0.008), (0.04, 0.008), (0.03, 0.008)], M['coat'], subdiv=1))
# harness: two shoulder straps to the belt, brass buckles, red LEDs
for sx in (1, -1):
    pts = [(0.13 * sx, 0.1, 1.62), (0.14 * sx, -0.05, 1.655), (0.13 * sx, -0.148, 1.56), (0.115 * sx, -0.158, 1.38), (0.1 * sx, -0.148, 1.19)]
    P(C.skin_mesh(f'strap{sx}', pts, [(i, i + 1) for i in range(4)], [(0.024, 0.006)] * 5, M['leather'], subdiv=1))
    for k, z in enumerate((1.46, 1.3)):
        P(C.rounded_box(f'buckle{sx}_{k}', (0.12 * sx, -0.166, z), (0.04, 0.008, 0.026), M['brass'], 0.003))
    leds = (1.53,) if sx < 0 else ()
    for k, z in enumerate(leds):
        P(C.rounded_box(f'led{sx}_{k}', (0.125 * sx, -0.166, z), (0.012, 0.006, 0.045), M['red'], 0.003))
P(C.solidify(C.open_tube('belt', [(1.15, 0.196, 0.146, 0.0), (1.2, 0.196, 0.146, 0.0)], M['leather'], 40), 0.006, offset=1.0))
P(C.rounded_box('beltBuckle', (0, -0.155, 1.175), (0.06, 0.01, 0.045), M['brass'], 0.004))
P(C.rounded_box('collarLed', (-0.1, -0.1, 1.66), (0.03, 0.006, 0.01), M['red'], 0.003, rot=Euler((0, 0, 0.6))))

# ------------------------------------------------------------------ legs: trousers + tall boots
P(C.skin_mesh('trousers',
              [(0, 0.0, 1.12), (0.1, 0.0, 1.0), (0.1, -0.01, 0.6), (-0.1, 0.0, 1.0), (-0.1, -0.01, 0.6)],
              [(0, 1), (1, 2), (0, 3), (3, 4)],
              [(0.17, 0.12), (0.095, 0.095), (0.075, 0.075), (0.095, 0.095), (0.075, 0.075)], M['trousers'], subdiv=2))
for sx in (1, -1):
    x = 0.1 * sx
    P(C.skin_mesh(f'bootShaft{sx}', [(x, -0.01, 0.64), (x, -0.005, 0.42), (x, 0.005, 0.15)], [(0, 1), (1, 2)], [(0.072, 0.074), (0.066, 0.066), (0.056, 0.058)], M['boot'], subdiv=2))
    P(C.rounded_box(f'bootFoot{sx}', (x, -0.07, 0.055), (0.105, 0.29, 0.1), M['boot'], 0.04))
    P(C.blob(f'bootToe{sx}', (x, -0.19, 0.045), (0.05, 0.055, 0.04), M['boot'], (16, 10)))
    P(C.rounded_box(f'bootSole{sx}', (x, -0.07, 0.012), (0.112, 0.31, 0.024), M['leather'], 0.008))
    P(C.rounded_box(f'bootHeel{sx}', (x, 0.045, 0.03), (0.08, 0.07, 0.04), M['leather'], 0.008))

# ------------------------------------------------------------------ gloves
for sx in (1, -1):
    gx = 0.238 * sx
    P(C.blob(f'palm{sx}', (gx, -0.016, 0.935), (0.026, 0.042, 0.055), M['glove'], (14, 10)))
    P(C.blob(f'fingers{sx}', (gx, -0.02, 0.875), (0.022, 0.036, 0.038), M['glove'], (12, 8)))
    P(C.blob(f'thumb{sx}', (gx - 0.012 * sx, -0.048, 0.94), (0.011, 0.012, 0.028), M['glove'], (10, 8), rot=Euler((0.4, 0, 0))))

# ------------------------------------------------------------------ skinning
RIGID = {
    'head': 'head', 'plate': 'head', 'eye': 'head', 'red': 'head', 'rivet': 'head', 'iris': 'head', 'pupil': 'head', 'lid': 'head',
    'brow': 'head', 'nose': 'head', 'mouth': 'head', 'stubble': 'head', 'ear': 'head', 'hairCap': 'head', 'lock': 'head', 'strand': 'head',
    'collarLed': 'chest', 'lapel': 'chest', 'strap': 'chest', 'buckle': 'chest', 'led': 'chest', 'belt': 'hips', 'beltBuckle': 'hips',
    'collar': 'neck',
}
for sx, side in ((1, 'L'), (-1, 'R')):
    for pref in ('bootFoot', 'bootToe', 'bootSole', 'bootHeel'):
        RIGID[f'{pref}{sx}'] = f'foot.{side}'
    for pref in ('palm', 'fingers', 'thumb'):
        RIGID[f'{pref}{sx}'] = f'hand.{side}'
    RIGID[f'sleeveCuff{sx}'] = f'forearm.{side}'
GROUPS = {
    'coatBody': {'hips': 1, 'spine': 1, 'chest': 1, 'neck': 0.3, 'coat': 1},
    'sleeve': {'upperarm': 1, 'forearm': 1, 'hand': 0.4, 'chest': 0.35},
    'trousers': {'hips': 1, 'thigh': 1, 'shin': 1},
    'bootShaft': {'shin': 1, 'foot': 0.3},
    'cable': {'head': 1, 'neck': 1, 'chest': 0.3},
    'neck': {'neck': 1, 'head': 0.4, 'chest': 0.4},
}
rig.skin(parts, RIGID, C.default_region(arm_min_x=0.15, torso_max_x=0.23), GROUPS)

# ------------------------------------------------------------------ animation
G = C.gait
T = math.tau


def behind_back(p):
    p = dict(p)
    # solved numerically (tools: hand.L ≈ (0.05, 0.16, 1.10) — hands meet behind the back at the belt)
    p.update(shoulder=(-0.65, -0.65), armOut=(-0.05, -0.05), armTwist=(0.8, 0.8), elbow=(0.8, 0.8), wrist=(0.2, 0.2))
    return p


def coat_tails(thL, thR, flare=0.0, sway=0.0):
    return {'coat.L': [(X, -thL * 0.55 + flare)], 'coat.R': [(X, -thR * 0.55 + flare)], 'coat.B': [(X, flare * 1.3 + sway)]}


def walk(t):
    p = behind_back(G(t, 0.36, 0.5, 0.0, 0.02, 0.018, 0.0))
    lag = G((t - 0.07) % 1.0, 0.36, 0.5, 0.0, 0.0, 0.0, 0.0)['thigh']
    p['extra'] = coat_tails(lag[0], lag[1], 0.04, math.sin(t * T * 2) * 0.03)
    p['torsoTwist'] = p['torsoTwist'] * 0.4
    return p


def run(t):
    p = G(t, 0.82, 1.3, 0.85, 0.24, 0.05, 1.3)
    lag = G((t - 0.09) % 1.0, 0.82, 1.3, 0.0, 0.0, 0.0, 0.0)['thigh']
    p['extra'] = coat_tails(lag[0], lag[1], 0.38, math.sin(t * T * 2) * 0.08)
    p['armOut'] = 0.12
    return p


def idle(t):
    p = behind_back({'breath': math.sin(t * T) * 0.018, 'hipsY': math.sin(t * T) * 0.003, 'headTilt': 0.06})
    p['extra'] = coat_tails(0, 0, 0.02, math.sin(t * T) * 0.01)
    return p


def consult(t):
    # Hand to the temple implant: "consulting MIRROR forecast"
    p = idle(t)
    # right fingertips to the temple implant (solved numerically), left hand stays behind the back
    p.update(shoulder=(-0.65, 2.4), armOut=(-0.05, 0.6), armTwist=(0.8, 1.2), elbow=(0.8, 2.4), wrist=(0.2, 0.3), headTilt=0.1 + math.sin(t * T) * 0.02, headRoll=-0.1)
    return p


def grab(t):
    k = min(1.0, t * 1.6)
    p = {'shoulder': (-0.65 * (1 - k) + 0.9 * k, -0.65 * (1 - k) + 1.45 * k), 'armOut': (0.1 * k - 0.05 * (1 - k), 0.05), 'armTwist': (0.8 * (1 - k), 0.8 * (1 - k)),
         'elbow': (0.8 * (1 - k) + 0.5 * k, 0.8 * (1 - k) + 0.15 * k), 'lean': 0.18 * k, 'thigh': (0.25 * k, -0.1 * k), 'knee': (0.3 * k, 0.15 * k)}
    p['extra'] = coat_tails(0.25 * k, -0.1 * k, 0.1 * k)
    return p


rig.action('Idle', 90, idle)
rig.action('Walk', 32, walk)
rig.action('Run', 18, run)
rig.action('Consult', 60, consult)
rig.action('Grab', 14, grab, loop=False)
rig.rest_pose()

body = C.join_all(parts, 'MM01Mesh')
C.bake_ao_to_vertex_colors(body, samples=48, distance=0.25)
C.export_glb(OUT)
print('EXPORTED', OUT, 'verts', len(body.data.vertices), 'locks', n, 'actions', len(bpy.data.actions))
