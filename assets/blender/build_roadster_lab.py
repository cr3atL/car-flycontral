"""Run in the connected Blender through Blender MCP; game coordinates are x/up-y/forward-z."""
import bpy
import json
import math
import ast
import re
from pathlib import Path
from mathutils import Vector

ROOT = Path('D:/project/car-flycontral')
OUT = ROOT / 'public/assets'
SOURCE = ROOT / 'assets/blender'
OUT.mkdir(parents=True, exist_ok=True)
SOURCE.mkdir(parents=True, exist_ok=True)
SCENE_NAME = 'Roadster_Core_Lab_v1'
if bpy.data.scenes.get(SCENE_NAME):
    raise RuntimeError('Roadster lab already exists; inspect before rebuilding')
scene = bpy.data.scenes.new(SCENE_NAME)
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene.world = bpy.data.worlds.new('RL_Sky')
scene.world.use_nodes = True
background = next(n for n in scene.world.node_tree.nodes if n.type == 'BACKGROUND')
background.inputs['Color'].default_value = (0.32, 0.43, 0.53, 1)
background.inputs['Strength'].default_value = 0.6
scene['game_coordinates'] = 'glTF x=x, y=height, z=forward; Blender=(x,-z,y)'
scene['source'] = 'Constructed in live Blender using Blender MCP'

def xyz(p):
    return (p[0], -p[2], p[1])

def material(name, color, metallic=0, roughness=0.65, emission=0):
    m = bpy.data.materials.new('RL_' + name)
    m.use_nodes = True
    bsdf = next(n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED')
    bsdf.inputs['Base Color'].default_value = (*color, 1)
    bsdf.inputs['Metallic'].default_value = metallic
    bsdf.inputs['Roughness'].default_value = roughness
    if emission:
        bsdf.inputs['Emission Color'].default_value = (*color, 1)
        bsdf.inputs['Emission Strength'].default_value = emission
    m.diffuse_color = (*color, 1)
    return m

mats = {
    'road': material('Asphalt', (.075,.105,.135)),
    'low': material('LowPlatform', (.10,.24,.26), .12),
    'high': material('HighPlatform', (.22,.19,.29), .12),
    'lower': material('RecoveryRoad', (.17,.20,.22)),
    'white': material('Lane', (.77,.83,.84)),
    'cyan': material('AirRoute', (.04,.72,.83), .2, .4, .35),
    'amber': material('Edge', (1,.52,.08), .05),
    'green': material('Exit', (.14,.92,.43), .1, .4, .4),
    'dark': material('Structure', (.12,.16,.19), .25),
}

def prism(name, xmin,xmax,zmin,zmax,top,depth,mat,slope=0,origin_z=0):
    def height(z): return top + slope*(z-origin_z)
    gameverts = [(x,height(z)+dy,z) for dy in (-depth,0) for z in (zmin,zmax) for x in (xmin,xmax)]
    mesh = bpy.data.meshes.new('RL_' + name + '_mesh')
    mesh.from_pydata([xyz(p) for p in gameverts], [], [(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)])
    for polygon in mesh.polygons:
        polygon.flip()
    mesh.update()
    ob = bpy.data.objects.new('RL_' + name,mesh)
    scene.collection.objects.link(ob)
    ob.data.materials.append(mats[mat])
    return ob

surfaces = [
    dict(id='start',xmin=-15,xmax=15,zmin=0,zmax=30,top=0,depth=.8,material='road'),
    dict(id='runway',xmin=-7,xmax=7,zmin=30,zmax=130,top=0,depth=.8,material='road'),
    dict(id='far',xmin=-9,xmax=9,zmin=160,zmax=245,top=0,depth=.8,material='road'),
    dict(id='low',xmin=-36,xmax=-12,zmin=110,zmax=150,top=4,depth=1.2,material='low'),
    dict(id='high',xmin=14,xmax=44,zmin=126,zmax=162,top=10,depth=1.2,material='high'),
    dict(id='recovery',xmin=-60,xmax=60,zmin=120,zmax=190,top=-8,depth=.8,material='lower'),
    dict(id='return-bottom',xmin=-70,xmax=-60,zmin=120,zmax=136,top=-8,depth=.8,material='lower'),
    dict(id='return-ramp',xmin=-70,xmax=-58,zmin=25,zmax=120,top=0,depth=.8,material='lower',slope=-8/95,origin_z=25),
    dict(id='return-top',xmin=-70,xmax=-15,zmin=15,zmax=25,top=0,depth=.8,material='lower'),
]
for s in surfaces:
    ob = prism(s['id'],s['xmin'],s['xmax'],s['zmin'],s['zmax'],s['top'],s['depth'],s['material'],s.get('slope',0),s.get('origin_z',0))
    ob['surface_id'] = s['id']
    ob['collider'] = 'layout.surfaces'
    for side in ('left','right'):
        x = s['xmin']+.18 if side == 'left' else s['xmax']-.32
        prism(s['id']+'_'+side+'_edge',x,x+.14,s['zmin']+.15,s['zmax']-.15,s['top']+.012,.012,'amber' if s['id'] in ('low','high') else 'white',s.get('slope',0),s.get('origin_z',0))

for z0,z1 in ((32,125),(165,216)):
    for z in range(z0,z1,8):
        prism('dash_'+str(z),-.08,.08,z,z+3,.018,.018,'white')

def arrow(name,x,z,y,angle=0,color='cyan',length=4):
    shape=[(-.22,-length/2),(.22,-length/2),(.22,.55),(1.15,.55),(0,length/2),(-1.15,.55),(-.22,.55)]
    pts=[]
    for sx,sz in shape:
        rx=sx*math.cos(angle)+sz*math.sin(angle)
        rz=-sx*math.sin(angle)+sz*math.cos(angle)
        pts.append(xyz((x+rx,y,z+rz)))
    mesh=bpy.data.meshes.new('RL_'+name+'_mesh')
    mesh.from_pydata(pts,[],[tuple(reversed(range(len(pts))))])
    mesh.update()
    ob=bpy.data.objects.new('RL_'+name,mesh)
    scene.collection.objects.link(ob)
    ob.data.materials.append(mats[color])

for z in (88,105,120): arrow('runway_arrow_'+str(z),0,z,.025)
arrow('low_choice',-4.4,99,.025,-.55,length=3)
arrow('high_choice',4.4,99,.025,.55,length=3)
arrow('return_left',-49,128,-7.975,-math.pi/2,color='white')
for z in (106,70,40):
    y=(-8/95)*(z-25)+.025
    arrow('return_up_'+str(z),-64,z,y,math.pi,color='white')
arrow('return_to_start',-35,22,.025,math.pi/2,color='white')

refill_zones=[
    dict(id='low-refill',surface='low',xmin=-30,xmax=-18,zmin=124,zmax=136),
    dict(id='high-refill',surface='high',xmin=23,xmax=35,zmin=138,zmax=150),
]
for zone in refill_zones:
    s=next(s for s in surfaces if s['id']==zone['surface'])
    x0,x1,z0,z1=zone['xmin'],zone['xmax'],zone['zmin'],zone['zmax']
    y=s['top']+.025
    for n,b in enumerate(((x0,x1,z0,z0+.18),(x0,x1,z1-.18,z1),(x0,x0+.18,z0,z1),(x1-.18,x1,z0,z1))):
        prism(zone['id']+'_rim'+str(n),*b,y,.018,'cyan')
    # Three geometric bars are legible from the air without text labels.
    for n in range(3):
        prism(zone['id']+'_bar'+str(n),(x0+x1)/2-1.2+n*.9,(x0+x1)/2-.7+n*.9,(z0+z1)/2-1.2,(z0+z1)/2+1.2,y,.018,'cyan')

colliders=[]
for name,x0,x1 in [('exit-left',-12,-10),('exit-right',10,12)]:
    prism(name,x0,x1,219,221,7,7,'dark')
    prism(name+'-light',x0+.3,x1-.3,218.95,219,6.5,5.8,'green')
    colliders.append(dict(id=name,xmin=x0,xmax=x1,zmin=219,zmax=221,ymin=0,ymax=7))
prism('exit-header',-12,12,219,221,8,1,'green')
colliders.append(dict(id='exit-header',xmin=-12,xmax=12,zmin=219,zmax=221,ymin=7,ymax=8))
prism('finish-line',-8.8,8.8,220,220.5,.02,.02,'green')

sun_data=bpy.data.lights.new('RL_Sun','SUN')
sun_data.energy=2.5
sun=bpy.data.objects.new('RL_Sun',sun_data)
scene.collection.objects.link(sun)
sun.rotation_euler=(math.radians(30),math.radians(-20),math.radians(-35))
camera_data=bpy.data.cameras.new('RL_Overview')
camera=bpy.data.objects.new('RL_Overview',camera_data)
scene.collection.objects.link(camera)
camera.location=xyz((170,150,-90))
direction=Vector(xyz((-6,0,120)))-camera.location
camera.rotation_euler=direction.to_track_quat('-Z','Y').to_euler()
camera.data.type='ORTHO'
camera.data.ortho_scale=300
scene.camera=camera
scene.render.resolution_x=1400
scene.render.resolution_y=1000
scene.render.resolution_percentage=100

layout=dict(version=1,createdWith='Blender MCP',coordinates='x right, y up, z forward; use Babylon right handed scene or compensate loader root',asset='roadster-lab.glb',surfaces=surfaces,refillZones=refill_zones,colliders=colliders,spawn=dict(x=0,z=10,y=0,heading=0),exit=dict(xmin=-9,xmax=9,z=220,surface='far'),bounds=dict(xmin=-100,xmax=100,zmin=-30,zmax=285,ymin=-40),checkpoints=[dict(surface='start',x=0,z=12,heading=0),dict(surface='low',x=-24,z=130,heading=.65),dict(surface='high',x=29,z=144,heading=-.7),dict(surface='far',x=0,z=195,heading=0)])
(OUT/'roadster-lab-layout.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
bpy.context.view_layer.update()
gltf_props=bpy.ops.export_scene.gltf.get_rna_type().properties
formats=[i.identifier for i in gltf_props['export_format'].enum_items]
if not formats:
    try:
        bpy.ops.export_scene.gltf(export_format='__QUERY_VALID_FORMATS__')
    except TypeError as error:
        formats=list(ast.literal_eval(re.search(r'not found in (\(.*\))',str(error)).group(1)))
chosen=next(i for i in formats if i=='GLB')
bpy.ops.export_scene.gltf(filepath=str(OUT/'roadster-lab.glb'),export_format=chosen,use_active_scene=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
bpy.data.libraries.write(str(SOURCE/'roadster-lab.blend'),{scene},fake_user=True,compress=True)
print(json.dumps({'scene':scene.name,'objects':len(scene.objects),'surfaces':len(surfaces),'glbBytes':(OUT/'roadster-lab.glb').stat().st_size,'blendBytes':(SOURCE/'roadster-lab.blend').stat().st_size,'outputs':[str(OUT/'roadster-lab.glb'),str(OUT/'roadster-lab-layout.json'),str(SOURCE/'roadster-lab.blend')]},ensure_ascii=False))
