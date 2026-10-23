"""Offline asset inspection only: this is not a Babylon gameplay screenshot.

Imports the MCP-authored GLB in a separate background Blender, without saves.
"""
import bpy
import sys
from pathlib import Path
from mathutils import Vector

root = Path('D:/project/car-flycontral')
coast = '--coast' in sys.argv
scene = bpy.data.scenes.new('Supervisor_FirstSpan_Car_Inspection')
bpy.context.window.scene = scene
try:
    scene.render.engine = 'CYCLES'
except TypeError as error:
    raise RuntimeError('CPU inspection renderer unavailable: '+str(error))
scene.cycles.samples = 16
bpy.ops.import_scene.gltf(filepath=str(root/('public/assets/firstspan-coast.glb' if coast else 'public/assets/roadster-gt.glb')))
plane = bpy.data.meshes.new('inspection-ground')
plane.from_pydata([(-100,-100,0),(100,-100,0),(100,100,0),(-100,100,0)],[],[(0,1,2,3)])
obj = bpy.data.objects.new('inspection-ground',plane)
scene.collection.objects.link(obj)
if coast:
    obj.location.z = -8
    obj.scale = (10,10,1)
mat = bpy.data.materials.new('inspection-asphalt')
mat.use_nodes = True
bs = next(n for n in mat.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
bs.inputs['Base Color'].default_value = (.015,.095,.15,1) if coast else (.075,.085,.095,1)
bs.inputs['Roughness'].default_value = .75
plane.materials.append(mat)
world = bpy.data.worlds.new('inspection-sky')
world.use_nodes = True
env = world.node_tree.nodes.new('ShaderNodeTexEnvironment')
env.image = bpy.data.images.load(str(root/'public/assets/firstspan/kloppenheim_06_puresky_1k.hdr'))
bg = next(n for n in world.node_tree.nodes if n.type=='BACKGROUND')
world.node_tree.links.new(env.outputs['Color'],bg.inputs['Color'])
bg.inputs['Strength'].default_value = .7
scene.world = world
types = bpy.types.Light.bl_rna.properties['type'].enum_items
light = bpy.data.lights.new('inspection-sun',next(i.identifier for i in types if i.identifier=='SUN'))
light.energy = 2
light.color = (1,.87,.69)
sun = bpy.data.objects.new('inspection-sun',light)
scene.collection.objects.link(sun)
sun.rotation_euler = Vector((-.48,.68,-.55)).to_track_quat('-Z','Y').to_euler()
cam = bpy.data.objects.new('inspection-camera',bpy.data.cameras.new('inspection-camera'))
scene.collection.objects.link(cam)
cam.location = (15,-100,15) if coast else (5.8,8.5,3.5)
cam.rotation_euler = (Vector((85,-140,2) if coast else (0,0,.67))-cam.location).to_track_quat('-Z','Y').to_euler()
cam.data.lens = 40 if coast else 58
scene.camera = cam
scene.render.resolution_x = 1280
scene.render.resolution_y = 720
scene.render.resolution_percentage = 100
formats = scene.render.image_settings.bl_rna.properties['file_format'].enum_items
scene.render.image_settings.file_format = next(i.identifier for i in formats if i.identifier=='PNG')
scene.render.filepath = str(root/('docs/screenshots/coastal-art-coast-v4-inspection.png' if coast else 'docs/screenshots/coastal-art-car-v2-inspection.png'))
bpy.ops.render.render(write_still=True)
print('SUPERVISOR_ASSET_INSPECTION_RENDERED')
