"""Finalize the MCP-authored saved scene after the live camera capture transport timed out.
Road/collision geometry is not changed. Remove duplicate leaf backfaces and save a normal source file.
"""
import bpy,bmesh,json,contextlib,io
from pathlib import Path
ROOT=Path('D:/project/car-flycontral')
s=bpy.data.scenes['Coastal_Interchange_v1'];bpy.context.window.scene=s
assert sum('surface_id'in o for o in s.objects)==154
leaf=bpy.data.objects['CI_batch_leaf'];bm=bmesh.new();bm.from_mesh(leaf.data);bm.verts.ensure_lookup_table()
seen=set();removed=0
for f in list(bm.faces):
    key=tuple(sorted(v.index for v in f.verts))
    if key in seen:bm.faces.remove(f);removed+=1
    else:seen.add(key)
bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(leaf.data);bm.free();leaf.data.validate()
formats=[i.identifier for i in bpy.ops.export_scene.gltf.get_rna_type().properties['export_format'].enum_items]
if not formats:
    import ast,re
    try:bpy.ops.export_scene.gltf(export_format='__QUERY_VALID_FORMATS__')
    except TypeError as error:formats=list(ast.literal_eval(re.search(r'not found in (\(.*\))',str(error)).group(1)))
fmt=next(i for i in formats if i=='GLB')
with contextlib.redirect_stdout(io.StringIO()):
    bpy.ops.export_scene.gltf(filepath=str(ROOT/'public/assets/coastal-interchange.glb'),export_format=fmt,use_active_scene=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
s.camera=bpy.data.objects['CI_Overview']
for other in list(bpy.data.scenes):
    if other!=s and not len(other.objects):bpy.data.scenes.remove(other)
bpy.ops.wm.save_as_mainfile(filepath=str(ROOT/'assets/blender/coastal-interchange.blend'))
print(json.dumps({'source':'Blender MCP authored','postprocess':'duplicate leaf backfaces removed; normal editable .blend save','roadGeometryChanged':False,'duplicateLeafFacesRemoved':removed,'scenes':[v.name for v in bpy.data.scenes]}))
