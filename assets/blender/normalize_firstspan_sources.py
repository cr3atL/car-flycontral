"""Pack MCP-authored scene libraries as ordinary independent .blend projects.
No modeling here. Runs in a fresh factory/background process, never the user's live project.
"""
import bpy
from pathlib import Path
root=Path('D:/project/car-flycontral/assets/blender')
for stem in['roadster-gt','firstspan-coast']:
 bpy.ops.wm.read_factory_settings(use_empty=True)
 defaults=list(bpy.data.scenes)
 with bpy.data.libraries.load(str(root/(stem+'-library.blend')),link=False)as(src,dst):dst.scenes=list(src.scenes)
 scene=dst.scenes[0]
 for window in bpy.context.window_manager.windows:window.scene=scene
 for old in defaults:
  if old!=scene:bpy.data.scenes.remove(old)
 scene['source_workflow']='Geometry created and exported in live Blender MCP; this clean process only packed the saved scene library.'
 bpy.ops.wm.save_as_mainfile(filepath=str(root/(stem+'.blend')))
 print('PACKED_MCP_SOURCE',stem,scene.name,len(scene.objects))
