"""Start the already-installed local MCP bridge in this task's Blender instance.

No preference or project save, addon installation, or external endpoint is used.
Launch with this task's independent roadster-gt-library.blend.
"""
import addon_utils
import bpy

addon_utils.enable("blender_mcp", default_set=False, persistent=False)
server = getattr(bpy.types, "blendermcp_server", None)
if server is None or not server.running:
    bpy.ops.blendermcp.start_server()
print("FIRSTSPAN_MCP_READY", bpy.context.scene.name)
