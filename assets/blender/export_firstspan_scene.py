"""Live-MCP export helper; no geometry creation, no save of the active user file."""
import bpy,json,re
from pathlib import Path
from mathutils import Vector
def export_firstspan(name,stem):
 old=bpy.context.window.scene;selected=list(bpy.context.selected_objects);active=bpy.context.view_layer.objects.active
 scene=bpy.data.scenes[name]
 try:
  bpy.context.window.scene=scene;bpy.ops.object.select_all(action='SELECT')
  prop=bpy.ops.export_scene.gltf.get_rna_type().properties['export_format']
  formats=[i.identifier for i in prop.enum_items]
  fmt=next((x for x in formats if x=='GLB'),None)or prop.default
  if not fmt:fmt=re.search(r"export_format='([^']+)'",bpy.ops.export_scene.gltf.__doc__).group(1)
  bpy.ops.export_scene.gltf(filepath=f'D:/project/car-flycontral/public/assets/{stem}.glb',export_format=fmt,use_selection=True,use_active_scene=True,export_yup=True,export_apply=True)
  bpy.data.libraries.write(f'D:/project/car-flycontral/assets/blender/{stem}-library.blend',{scene},fake_user=True)
  bpy.context.view_layer.update()
  points=[ob.matrix_world@Vector(v.co)for ob in scene.objects if ob.type=='MESH'for v in ob.data.vertices]
  report={'constructedVia':'Live Blender MCP','scene':name,'meshes':sum(o.type=='MESH'for o in scene.objects),'triangles':sum(sum(len(p.vertices)-2 for p in o.data.polygons)for o in scene.objects if o.type=='MESH'),'blenderBounds':{'min':[min(p[i]for p in points)for i in range(3)],'max':[max(p[i]for p in points)for i in range(3)]},'materials':sorted({m.name for o in scene.objects if o.type=='MESH'for m in o.data.materials if m}),'sourceFileUnchanged':bpy.data.filepath}
  Path(f'D:/project/car-flycontral/assets/blender/{stem}-mcp-report.json').write_text(json.dumps(report,indent=2),encoding='utf8');print(json.dumps(report))
 finally:
  bpy.context.window.scene=old;bpy.ops.object.select_all(action='DESELECT')
  for ob in selected:
   if ob.name in bpy.context.view_layer.objects:ob.select_set(True)
  if active and active.name in bpy.context.view_layer.objects:bpy.context.view_layer.objects.active=active
