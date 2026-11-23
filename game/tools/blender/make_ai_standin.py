"""Builds a stand-in for an AI image-to-3D export, to test the conform pipeline without any paid service.

Takes the raw Leon v2 export (tools/blender/out/leon_v2_raw.glb), drops its skeleton and animations, applies the rest
pose, joins everything into ONE mesh, unwraps it and bakes all materials into ONE base-colour texture — the typical
shape of a Tripo / Meshy / Rodin download (single textured mesh, no rig, arbitrary scale/orientation).

With --fused the parts are voxel-remeshed into ONE closed surface and the texture is re-baked onto it
(selected-to-active), which is what AI generators actually deliver (no separate garments, fused hands/props).

Run: python tools/blender/make_ai_standin.py <in_raw.glb> <out_static.glb> [--fused]
"""
import math
import sys

import bpy  # noqa: E402
from mathutils import Matrix  # noqa: E402

fused = '--fused' in sys.argv
args = [a for a in sys.argv if not a.startswith('--')]
src, out = args[-2], args[-1]
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath=src)
for a in list(bpy.data.actions):
    bpy.data.actions.remove(a)
# The glTF importer keeps helper shapes (bone display meshes) in a 'glTF_not_exported' collection: drop them.
for c in [c for c in bpy.data.collections if c.name.startswith('glTF_not_exported')]:
    for o in list(c.objects):
        bpy.data.objects.remove(o)
    bpy.data.collections.remove(c)
meshes = [o for o in bpy.data.objects if o.type == 'MESH']
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
bpy.ops.object.join()
obj = bpy.context.view_layer.objects.active
obj.name = 'AIStandin'
# AI downloads come in odd units/orientation: scale ×0.37 and rotate 90° so the conform step has work to do.
obj.matrix_world = Matrix.Rotation(math.radians(90), 4, 'Z') @ Matrix.Scale(0.37, 4) @ obj.matrix_world
bpy.ops.object.transform_apply(location=True, rotation=True, scale=True)
# One UV atlas + one baked base-colour texture.
bpy.ops.object.mode_set(mode='EDIT')
bpy.ops.mesh.select_all(action='SELECT')
bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003)
bpy.ops.object.mode_set(mode='OBJECT')
img = bpy.data.images.new('standin_basecolor', 2048, 2048)
for mat in obj.data.materials:
    nt = mat.node_tree
    bsdf = nt.nodes.get('Principled BSDF')
    # Bake base colour (incl. the AO vertex colour multiply, as an AI texture would have it baked in).
    tex = nt.nodes.new('ShaderNodeTexImage')
    tex.image = img
    nt.nodes.active = tex
    if bsdf is not None:
        bsdf.inputs['Metallic'].default_value = 0.0
scene = bpy.context.scene
scene.render.engine = 'CYCLES'
scene.cycles.device = 'CPU'
scene.cycles.samples = 4
scene.render.bake.use_pass_direct = False
scene.render.bake.use_pass_indirect = False
scene.render.bake.use_pass_color = True
scene.render.bake.margin = 4
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.context.view_layer.objects.active = obj
obj.hide_render = False
bpy.ops.object.bake(type='DIFFUSE')
if fused:
    # Voxel remesh a copy into one closed surface, decimate, unwrap, and bake the texture across.
    hi = obj
    lo = hi.copy()
    lo.data = hi.data.copy()
    lo.name = 'AIStandinFused'
    bpy.context.collection.objects.link(lo)
    rm = lo.modifiers.new('rm', 'REMESH')
    rm.mode = 'VOXEL'
    rm.voxel_size = 0.0045
    bpy.context.view_layer.objects.active = lo
    bpy.ops.object.select_all(action='DESELECT')
    lo.select_set(True)
    bpy.ops.object.modifier_apply(modifier='rm')
    dec = lo.modifiers.new('dec', 'DECIMATE')
    dec.ratio = min(1.0, 60000 / max(1, len(lo.data.polygons)))
    bpy.ops.object.modifier_apply(modifier='dec')
    lo.data.materials.clear()
    for uv in list(lo.data.uv_layers):
        lo.data.uv_layers.remove(uv)
    lo.data.uv_layers.new(name='UVMap')
    bpy.ops.object.mode_set(mode='EDIT')
    bpy.ops.mesh.select_all(action='SELECT')
    bpy.ops.uv.smart_project(angle_limit=math.radians(66), island_margin=0.003)
    bpy.ops.object.mode_set(mode='OBJECT')
    img2 = bpy.data.images.new('fused_basecolor', 2048, 2048)
    m2 = bpy.data.materials.new('ai_bake_target')
    m2.use_nodes = True
    tn = m2.node_tree.nodes.new('ShaderNodeTexImage')
    tn.image = img2
    m2.node_tree.nodes.active = tn
    lo.data.materials.append(m2)
    # the source must show the baked texture as its colour
    srcm = bpy.data.materials.new('ai_src')
    srcm.use_nodes = True
    sb = srcm.node_tree.nodes['Principled BSDF']
    st = srcm.node_tree.nodes.new('ShaderNodeTexImage')
    st.image = img
    srcm.node_tree.links.new(st.outputs['Color'], sb.inputs['Base Color'])
    hi.data.materials.clear()
    hi.data.materials.append(srcm)
    for p in hi.data.polygons:
        p.material_index = 0
    bpy.ops.object.select_all(action='DESELECT')
    hi.select_set(True)
    lo.select_set(True)
    bpy.context.view_layer.objects.active = lo
    scene.render.bake.use_selected_to_active = True
    scene.render.bake.cage_extrusion = 0.012
    bpy.ops.object.bake(type='DIFFUSE')
    bpy.data.objects.remove(hi)
    obj = lo
    img = img2
    print('FUSED polys', len(obj.data.polygons), 'islands-merged surface')

# Replace all materials with a single textured one.
mat = bpy.data.materials.new('ai_material')
mat.use_nodes = True
nt = mat.node_tree
bsdf = nt.nodes['Principled BSDF']
bsdf.inputs['Roughness'].default_value = 0.8
t = nt.nodes.new('ShaderNodeTexImage')
t.image = img
nt.links.new(t.outputs['Color'], bsdf.inputs['Base Color'])
obj.data.materials.clear()
obj.data.materials.append(mat)
for p in obj.data.polygons:
    p.material_index = 0
img.pack()
for attr in list(obj.data.color_attributes):
    obj.data.color_attributes.remove(attr)
bpy.ops.object.select_all(action='DESELECT')
obj.select_set(True)
bpy.ops.export_scene.gltf(filepath=out, export_format='GLB', export_animations=False, export_skins=False, use_selection=True)
print('STANDIN', out, 'verts', len(obj.data.vertices))
