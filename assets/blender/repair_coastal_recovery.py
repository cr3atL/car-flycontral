"""Repair the saved MCP scene in a separate Blender process after live capture timed out."""
import bpy
from pathlib import Path
ROOT=Path('D:/project/car-flycontral')
old=bpy.data.scenes.get('Coastal_Interchange_v1')
if not old:raise RuntimeError('MCP-authored source scene missing')
assert all(o.name.startswith('CI_')for o in old.objects)
temporary=bpy.data.scenes.new('CI_RepairStaging');bpy.context.window.scene=temporary
for ob in list(old.objects):bpy.data.objects.remove(ob,do_unlink=True)
bpy.data.scenes.remove(old)
# Reclaim only now-unused datablocks from this standalone game source so
# regenerated surface names remain stable rather than gaining .001 suffixes.
bpy.data.orphans_purge(do_local_ids=True,do_linked_ids=False,do_recursive=True)
exec(compile((ROOT/'assets/blender/build_coastal_interchange.py').read_text(encoding='utf-8'),'build_coastal_interchange.py','exec'))
exec(compile((ROOT/'assets/blender/finalize_coastal_source.py').read_text(encoding='utf-8'),'finalize_coastal_source.py','exec'))
