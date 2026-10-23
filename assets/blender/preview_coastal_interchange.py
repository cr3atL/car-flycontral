"""Offline camera QA of the scene already authored by live Blender MCP; no game geometry edits."""
import bpy, json
from pathlib import Path

ROOT=Path('D:/project/car-flycontral')
s=bpy.data.scenes.get('Coastal_Interchange_v1')
if not s:raise RuntimeError('Expected MCP-authored scene is absent')
bpy.context.window.scene=s
engines=[v.identifier for v in s.render.bl_rna.properties['engine'].enum_items]
choice=next((v for v in engines if 'WORKBENCH'in v),None)
if choice:s.render.engine=choice
else:
    try:s.render.engine='BLENDER_WORKBENCH'
    except TypeError as e:raise RuntimeError(str(e))
shade=s.display.shading
def enum(owner,key,requested):
    values=[v.identifier for v in owner.bl_rna.properties[key].enum_items]
    if requested not in values:raise RuntimeError(f'{key}: {values}')
    setattr(owner,key,requested)
enum(shade,'light','STUDIO');enum(shade,'color_type','MATERIAL')
shade.show_shadows=True;shade.show_cavity=True;shade.show_specular_highlight=True
enum(s.render.image_settings,'file_format','PNG')
s.render.resolution_percentage=100
views=[('Overview',1500,950),('BridgeChase',1200,750),('ApronChase',1200,750),('UpperChase',1200,750)]
for camera,w,h in views:
    s.camera=bpy.data.objects['CI_'+camera];s.render.resolution_x=w;s.render.resolution_y=h
    s.render.filepath=str(ROOT/'assets/blender'/('coastal-interchange-'+camera.lower()+'.png'))
    bpy.ops.render.render(write_still=True)
print(json.dumps({'source':'Blender MCP-authored .blend','cameraPreviews':[v[0]for v in views],'surfaces':sum('surface_id'in o for o in s.objects),'engine':s.render.engine}))
