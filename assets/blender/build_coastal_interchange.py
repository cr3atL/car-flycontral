"""Run through Blender MCP in the live Blender. Source coordinates x/right,y/up,z/forward."""
import bpy, bmesh, math, json, random, ast, re
from pathlib import Path
from mathutils import Vector

ROOT = Path('D:/project/car-flycontral')
OUT = ROOT / 'public/assets'
SRC = ROOT / 'assets/blender'
NAME = 'Coastal_Interchange_v1'
PREFIX = 'CI_'
if bpy.data.scenes.get(NAME):
    raise RuntimeError('Coastal scene already exists: inspect it before rebuilding')
scene = bpy.data.scenes.new(NAME)
bpy.context.window.scene = scene
scene.unit_settings.system = 'METRIC'
scene.unit_settings.scale_length = 1
scene['construction'] = 'Built through live Blender MCP; source and collider polygons share vertices'
scene['game_coordinates'] = 'Blender=(x,-z,y); glTF emits x,y,z; Babylon loader root identity'
rng = random.Random(731041)
def xyz(p): return (p[0], -p[2], p[1])

def mat(name, color, rough=.75, metal=0, emission=0):
    m=bpy.data.materials.new(PREFIX+name); m.use_nodes=True
    bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
    bs.inputs['Base Color'].default_value=(*color,1)
    bs.inputs['Roughness'].default_value=rough
    bs.inputs['Metallic'].default_value=metal
    if emission:
        bs.inputs['Emission Color'].default_value=(*color,1)
        bs.inputs['Emission Strength'].default_value=emission
    m.diffuse_color=(*color,1)
    return m
mats={
 'asphalt':mat('Asphalt031',(.24,.26,.29)),
 'concrete':mat('WarmConcrete',(.56,.56,.51)),
 'edge':mat('EdgeWhite',(.86,.88,.83)),
 'amber':mat('TakeoffAmber',(.98,.48,.055),.6,0,.12),
 'cyan':mat('RouteCyan',(.035,.59,.76),.45,.1,.22),
 'blue':mat('RechargeBlue',(.035,.31,.62),.5,.1,.12),
 'rail':mat('Guardrail',(.42,.48,.49),.37,.55),
 'dark':mat('StructureDark',(.105,.14,.16)),
 'rock':mat('CoastRock',(.39,.40,.34)),
 'rockLight':mat('CoastRockSun',(.54,.51,.4)),
 'sand':mat('Sand',(.65,.59,.43)),
 'green':mat('CoastalGreen',(.22,.31,.12)),
 'leaf':mat('PalmLeaf',(.13,.26,.12)),
 'trunk':mat('PalmTrunk',(.32,.25,.16)),
 'water':mat('BayWater',(.028,.24,.34),.25,.3),
 'foam':mat('SeaFoam',(.45,.72,.73),.6),
 'glass':mat('SkylineGlass',(.25,.4,.47),.34,.25),
 'building':mat('SkylineStone',(.48,.55,.56)),
 'red':mat('ScaleCarRed',(.63,.025,.02),.3,.25),
}
texture_dir=ROOT/'assets/third-party/ambientcg-asphalt031/source'
road=mats['asphalt']; nodes=road.node_tree.nodes; links=road.node_tree.links
bs=next(n for n in nodes if n.type=='BSDF_PRINCIPLED')
for suffix,normal in [('Color',False),('NormalGL',True)]:
    img=bpy.data.images.load(str(texture_dir/f'Asphalt031_1K-JPG_{suffix}.jpg'),check_existing=False)
    img.name=PREFIX+'Asphalt031_'+suffix+'_512'
    img.scale(512,512)
    img.filepath_raw=str(SRC/f'coastal-asphalt-{suffix.lower()}-512.png')
    img.file_format='PNG'; img.save(); img.pack()
    tex=nodes.new('ShaderNodeTexImage');tex.image=img;tex.extension='REPEAT'
    if normal:
        img.colorspace_settings.name='Non-Color'
        n=nodes.new('ShaderNodeNormalMap');n.inputs['Strength'].default_value=.3
        links.new(tex.outputs['Color'],n.inputs['Color']);links.new(n.outputs['Normal'],bs.inputs['Normal'])
    else: links.new(tex.outputs['Color'],bs.inputs['Base Color'])

def mesh_obj(name,verts,faces,material,uv=True):
    mesh=bpy.data.meshes.new(PREFIX+name+'_mesh')
    mesh.from_pydata([xyz(v) for v in verts],[],faces);mesh.update()
    bm=bmesh.new();bm.from_mesh(mesh);bmesh.ops.recalc_face_normals(bm,faces=bm.faces);bm.to_mesh(mesh);bm.free()
    if uv:
        layer=mesh.uv_layers.new(name='RoadWorldUV')
        for face in mesh.polygons:
            for li in face.loop_indices:
                p=verts[mesh.loops[li].vertex_index]
                layer.data[li].uv=(p[0]/6,p[2]/6)
    ob=bpy.data.objects.new(PREFIX+name,mesh);scene.collection.objects.link(ob)
    mesh.materials.append(mats[material]);return ob

# Material batches keep repeated noninteractive props inexpensive in the engine.
batches={k:[[],[]] for k in mats}
def batch(name,verts,faces):
    v,f=batches[name];off=len(v);v.extend(verts);f.extend([tuple(off+i for i in face) for face in faces])
def box(name,x,y,z,w,h,d,material,heading=0,batched=True):
    c,s=math.cos(heading),math.sin(heading)
    verts=[]
    for dy in (-h/2,h/2):
        for dz in (-d/2,d/2):
            for dx in (-w/2,w/2):verts.append((x+dx*c+dz*s,y+dy,z-dx*s+dz*c))
    faces=[(0,2,3,1),(4,5,7,6),(0,1,5,4),(2,6,7,3),(0,4,6,2),(1,3,7,5)]
    if batched:batch(material,verts,faces);return
    return mesh_obj(name,verts,faces,material)
def beam(a,b,r,material,sides=8):
    va,vb=Vector(a),Vector(b);direction=(vb-va).normalized()
    basis=direction.cross(Vector((0,1,0)))
    if basis.length<.001:basis=direction.cross(Vector((1,0,0)))
    basis.normalize();other=direction.cross(basis).normalized()
    verts=[tuple(p+r*(basis*math.cos(i*2*math.pi/sides)+other*math.sin(i*2*math.pi/sides))) for p in (va,vb) for i in range(sides)]
    faces=[tuple(range(sides-1,-1,-1)),tuple(range(sides,2*sides))]
    faces += [(i,(i+1)%sides,(i+1)%sides+sides,i+sides) for i in range(sides)]
    batch(material,verts,faces)

surfaces=[];colliders=[];centerlines={}
def prism_surface(s):
    poly=s['polygon']
    def height(x,z):return s['top']+s.get('slope',0)*(z-s.get('origin_z',0))+s.get('slopeX',0)*(x-s.get('origin_x',0))
    verts=[(x,height(x,z)+dy,z) for dy in (-s['depth'],0) for x,z in poly]
    n=len(poly);faces=[tuple(range(n-1,-1,-1)),tuple(range(n,2*n))]
    faces += [(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    ob=mesh_obj('surface_'+s['id'],verts,faces,'asphalt')
    # Asphalt on top, warm concrete on slab sides and underside.
    ob.data.materials.append(mats['concrete'])
    for p in ob.data.polygons:p.material_index=0 if p.index==1 else 1
    ob['surface_id']=s['id'];ob['route']=s['route'];ob['group']=s['group']
    ob['collision_source']='coastal-interchange-layout.json'
def surface(sid,poly,y,group,route='main',slope=0,origin_z=0):
    s=dict(id=sid,polygon=[[round(x,6),round(z,6)]for x,z in poly],xmin=min(p[0]for p in poly),xmax=max(p[0]for p in poly),zmin=min(p[1]for p in poly),zmax=max(p[1]for p in poly),top=y,depth=.8,material='road',group=group,route=route)
    if slope:s.update(slope=slope,origin_z=origin_z)
    surfaces.append(s);prism_surface(s);return s
def rect(sid,x0,x1,z0,z1,y,group,route='main',slope=0,origin_z=0):
    return surface(sid,[(x0,z0),(x1,z0),(x1,z1),(x0,z1)],y,group,route,slope,origin_z)
def ribbon(group,points,width,route='main',prefix=None):
    centerlines[group]=points
    strips=[]
    for i,p in enumerate(points):
        a=points[max(0,i-1)];b=points[min(len(points)-1,i+1)]
        dx,dz=b[0]-a[0],b[2]-a[2];length=math.hypot(dx,dz);rx,rz=dz/length,-dx/length
        w=width[i]if isinstance(width,list)else width
        strips.append([(p[0]-rx*w/2,p[2]-rz*w/2),(p[0]+rx*w/2,p[2]+rz*w/2)])
    for i in range(len(points)-1):
        a,b=points[i:i+2];poly=[strips[i][0],strips[i][1],strips[i+1][1],strips[i+1][0]]
        slope=(b[1]-a[1])/(b[2]-a[2])if abs(b[2]-a[2])>.0001 else 0
        surface((prefix or group)+'-'+str(i).zfill(3),poly,a[1],group,route,slope,a[2])
    return strips

rect('start',-6,6,0,30,0,'start')
rect('runway',-6,6,30,110,0,'runway')
rect('landing',-9,9,134,204,0,'landing')
curve=[]
for i in range(41):
    t=i/40;curve.append((20*(3*t*t-2*t*t*t),0,204+80*t))
curve_width=[18-4*min(1,i/10)for i in range(41)]
curve_edges=ribbon('curve',curve,curve_width)
rect('apron',6,34,284,324,0,'apron')
rect('high',20,40,338,393,8,'high','upper')
rect('ramp',20,40,393,473,8,'ramp','upper',-.1,393)
rect('far',21,39,473,523,0,'far')
rect('recovery',-38,24,100,178,-5,'recovery','recovery')
rect('return-ramp',-34,-22,40,110,0,'return-ramp','recovery',-5/70,40)
# A broad level turnaround replaces the very tight offset ribbon: its inner
# offset folded into concave quads at both ends and broke convex collision.
rect('return-top',-34,6,14,40,0,'return-top','recovery')

def cubic(p0,p1,p2,p3,count=18):
    out=[]
    for i in range(count+1):
        t=i/count;u=1-t
        out.append(tuple(u*u*u*p0[j]+3*u*u*t*p1[j]+3*u*t*t*p2[j]+t*t*t*p3[j]for j in range(3)))
    return out
bypass=(cubic((0,0,74),(20,0,74),(58,0,94),(58,0,124),24)+cubic((58,0,124),(58,0,160),(35,0,194),(0,0,194),26)[1:])
bypass_edges=ribbon('ground-bypass',bypass,12,'ground-bypass')
lower=(cubic((20,0,304),(20,0,329),(-8,0,335),(-8,0,368),22)+cubic((-8,0,368),(-8,0,430),(-2,0,487),(30,0,493),32)[1:])
lower_edges=ribbon('lower-bypass',lower,12,'ground-bypass')

def rail_segment(name,a,b,side_height=1.0):
    # Thin real collider exactly where the visible rail sits.
    dx,dz=b[0]-a[0],b[2]-a[2];L=math.hypot(dx,dz)
    if L<.1:return
    mx,my,mz=(a[0]+b[0])/2,(a[1]+b[1])/2,(a[2]+b[2])/2
    h=math.atan2(dx,dz);c,s=math.cos(h),math.sin(h);th=.14
    box(name,mx,my+.86,mz,th,.2,L,'rail',h)
    for p in (a,b):beam((p[0],p[1],p[2]),(p[0],p[1]+1,p[2]),.055,'rail',6)
    poly=[(mx+sx*th/2*c+sz*L/2*s,mz-sx*th/2*s+sz*L/2*c)for sx,sz in [(-1,-1),(1,-1),(1,1),(-1,1)]]
    colliders.append(dict(id=name,polygon=poly,xmin=min(p[0]for p in poly),xmax=max(p[0]for p in poly),zmin=min(p[1]for p in poly),zmax=max(p[1]for p in poly),ymin=min(a[1],b[1]),ymax=max(a[1],b[1])+side_height,kind='guardrail'))
def straight_rails(group,x0,x1,z0,z1,y,slope=0,origin_z=0,openings=()):
    for side,x in [(-1,x0),(1,x1)]:
        z=z0
        while z<z1-.1:
            end=min(z+6,z1);mid=(z+end)/2
            if not any(side==s and lo<=mid<=hi for s,lo,hi in openings):
                rail_segment(f'{group}-rail-{side}-{z:.1f}',(x,y+slope*(z-origin_z),z),(x,y+slope*(end-origin_z),end))
            z=end
straight_rails('approach',-6,6,2,108,0,openings=[(1,62,102),(-1,16,46)])
straight_rails('landing',-9,9,138,204,0,openings=[(1,170,204)])
straight_rails('high',20,40,349,393,8)
straight_rails('ramp',20,40,393,473,8,-.1,393)
straight_rails('far',21,39,473,523,0,openings=[(-1,480,505)])
straight_rails('apron',6,34,289,318,0,openings=[(-1,289,318),(1,289,318)])
for group,points,edges in [('curve',curve,curve_edges),('bypass',bypass,bypass_edges),('lower',lower,lower_edges)]:
    for i in range(0,len(points)-1,3):
        if group!='curve' and (i<5 or i>len(points)-7):continue
        j=min(i+3,len(points)-1)
        for side in (0,1):
            a,b=edges[i][side],edges[j][side]
            rail_segment(f'{group}-rail-{side}-{i}',(a[0],points[i][1],a[1]),(b[0],points[j][1],b[1]))

# Lane markings, widening guides and minimal direction chevrons.
def arrow(x,y,z,heading=0,material='cyan',size=1):
    shape=[(-.18,-1.8),(.18,-1.8),(.18,.4),(.85,.4),(0,1.9),(-.85,.4),(-.18,.4)]
    c,s=math.cos(heading),math.sin(heading)
    batch(material,[(x+(u*c+v*s)*size,y+.028,z+(-u*s+v*c)*size)for u,v in shape],[tuple(range(7))])
for s in surfaces:
    poly=s['polygon']
    for a,b in [(poly[0],poly[-1]),(poly[1],poly[2])]:
        dx,dz=b[0]-a[0],b[1]-a[1];L=math.hypot(dx,dz);mx,mz=(a[0]+b[0])/2,(a[1]+b[1])/2
        my=s['top']+s.get('slope',0)*(mz-s.get('origin_z',0))+.018
        box('lane-edge',mx,my,mz,.13,.012,L,'edge',math.atan2(dx,dz))
for z in range(8,108,9):box('center-line',0,.025,z,.13,.012,3.3,'edge')
for z in range(140,204,9):box('center-line',0,.025,z,.13,.012,3.3,'edge')
for i in range(3,len(curve),6):
    p=curve[i];prev=curve[i-1];nxt=curve[min(len(curve)-1,i+1)];arrow(p[0],0,p[2],math.atan2(nxt[0]-prev[0],nxt[2]-prev[2]))
for x,z,y in [(0,40,0),(0,70,0),(0,91,0),(0,147,0),(0,177,0),(20,295,0),(30,359,8),(30,384,8),(30,490,0)]:arrow(x,y,z)
for i,z in enumerate([98,102,105,108]):box('takeoff-stripe',0,.035,z,11.6,.018,.32+i*.12,'amber')
box('gap-takeoff-edge',0,.045,109.7,12,.04,.5,'amber')
box('gap-receiving-edge',0,.045,134.3,18,.04,.5,'amber')
box('high-receiving-edge',30,8.045,338.3,20,.04,.5,'amber')
for z in range(308,322,4):arrow(20,0,z,.23,'amber',.8)
for z in [143,151,159,167]:
    box('recharge-low',0,.04,z,9,.025,.7,'blue');box('recharge-rim',0,.05,z-.4,9,.018,.08,'cyan')
for z in [351,358,365,372]:
    box('recharge-upper',30,8.04,z,12,.025,.8,'blue');box('recharge-rim',30,8.05,z-.45,12,.018,.08,'cyan')
for x,z,y in [(-23,153,-5),(-28,125,-5),(-28,92,-5/70*(92-40)),(-28,60,-5/70*(60-40))]:arrow(x,y,z,math.pi,'edge')
for x,z in [(-23,28),(-10,23)]:arrow(x,0,z,math.pi/2,'edge')
arrow(0,0,27,0,'edge')
box('finish-line',30,.045,510,17.7,.02,.45,'cyan')

# Structural modules: columns, cap beams and slender road lamps.
for x,z,y,width in [(0,12,0,12),(0,52,0,12),(0,88,0,12),(0,187,0,18),(7,235,0,14),(19,274,0,14),(20,302,0,28),(30,353,8,20),(30,383,8,20),(30,418,5.5,20),(30,453,2,20),(30,493,0,18)]:
    floor=-9;box('pier',x,(y-.8+floor)/2,z,2.2,y-.8-floor,3,'concrete')
    box('pier-cap',x,y-1.35,z,width*.85,1,2.8,'concrete')
for i in range(8,len(bypass)-6,8):
    x,y,z=bypass[i];box('bypass-pier',x,-4.9,z,1.8,7.2,2.3,'concrete')
for i in range(12,len(lower)-5,12):
    x,y,z=lower[i];box('lower-pier',x,-4.9,z,1.8,7.2,2.3,'concrete')
for x,z,y,side in [(6.9,z,0,1)for z in range(12,110,28)]+[(10,z,0,1)for z in range(149,204,27)]+[(41,z,8,1)for z in [353,381]]+[(41,430,4.3,1),(40,492,0,1)]:
    beam((x,y,z),(x,y+5.5,z),.07,'rail');beam((x,y+5.5,z),(x-1.7*side,y+5.8,z),.07,'rail')
    box('lamp-head',x-.95*side,y+5.8,z,1.7,.14,.4,'dark')
    box('lamp-face',x-.95*side,y+5.71,z,1.5,.025,.3,'edge')

# Coastland: layered low-frequency landform, never crossing playable road bounds.
coast=[]
for i in range(45):
    z=-80+i*17;edge=75+8*math.sin(i*.73)+5*math.sin(i*1.9)
    coast.append((edge,z,3+3*math.sin(i*.5)**2))
verts=[];faces=[]
for edge,z,h in coast:verts.extend([(edge,-9,z),(edge+2,h*.4,z),(edge+18,h,z),(edge+120,h+8,z)])
for i in range(len(coast)-1):
    for j in range(3):faces.append((i*4+j,i*4+j+1,(i+1)*4+j+1,(i+1)*4+j))
batch('rock',verts,faces)
for i in range(len(coast)-1):
    a,b=coast[i:i+2];batch('green',[(a[0]+18,a[2]+.04,a[1]),(a[0]+120,a[2]+8.04,a[1]),(b[0]+120,b[2]+8.04,b[1]),(b[0]+18,b[2]+.04,b[1])],[(0,1,2,3)])
def rock(cx,cy,cz,sx,sy,sz,seed):
    rr=random.Random(seed);N=9;verts=[]
    for y,radius in [(-.5,.85),(.15,1),(.72,.55)]:
        for i in range(N):
            a=i*2*math.pi/N;v=radius*rr.uniform(.8,1.2)
            verts.append((cx+math.cos(a)*sx*v,cy+y*sy+rr.uniform(-.12,.12)*sy,cz+math.sin(a)*sz*v))
    faces=[tuple(range(N-1,-1,-1)),tuple(range(2*N,3*N))]
    faces.extend((ring*N+i,ring*N+(i+1)%N,(ring+1)*N+(i+1)%N,(ring+1)*N+i)for ring in range(2)for i in range(N))
    batch('rockLight'if seed%3==0 else'rock',verts,faces)
for i,(edge,z,h)in enumerate(coast[::2]):
    rock(edge-3,-4,z,rng.uniform(7,15),rng.uniform(5,12),rng.uniform(8,17),100+i)
for i in range(14):rock(-75-rng.uniform(0,160),-8,20+i*37,rng.uniform(4,12),rng.uniform(2,6),rng.uniform(6,15),300+i)

# Ocean geometry deliberately uses an original material, with sparse foam strokes.
batch('water',[(-1000,-8,-700),(1200,-8,-700),(1200,-8,1500),(-1000,-8,1500)],[(0,3,2,1)])
for i in range(120):
    x=rng.uniform(-320,65);z=rng.uniform(-40,650);L=rng.uniform(.6,3.5)
    box('water-streak',x,-7.975,z,L,.008,rng.uniform(.025,.08),'foam')
for i,(edge,z,h)in enumerate(coast[::2]):
    for j in range(3):box('shore-foam',edge-rng.uniform(5,13),-7.94,z+j*2,rng.uniform(1,4),.02,.18,'foam',rng.uniform(-.5,.5))

def palm(x,y,z,h,heading):
    top=(x+.5*math.sin(heading),y+h,z+.5*math.cos(heading))
    beam((x,y,z),top,.14,'trunk',7)
    for k in range(7):
        a=k*2*math.pi/7+heading;dx,dz=math.cos(a),math.sin(a);tx,ty,tz=top
        verts=[(tx,ty,tz),(tx+dx*1.2-dz*.35,ty+.45,tz+dz*1.2+dx*.35),(tx+dx*3.5,ty-.75,tz+dz*3.5),(tx+dx*1.2+dz*.35,ty+.45,tz+dz*1.2-dx*.35)]
        batch('leaf',verts,[(0,1,2),(0,2,3)])
for i in range(32):
    z=40+i*15;x=96+9*math.sin(i*1.6);y=coast[min(44,max(0,round((z+80)/17)))][2]+1.5
    palm(x,y,z,rng.uniform(5,8),rng.random()*6.28)
# Apron service shelters kept outside the driving corridor.
for x,z in [(42,293),(47,309)]:
    box('service-shelter',x,1.3,z,6,2.6,6,'concrete')
    box('shelter-roof',x,2.8,z,7,.25,7,'dark')
    box('shelter-window',x-3.01,1.6,z,.025,1,3.4,'glass')
    box('service-cyan',x-3.03,2.4,z,.03,.12,5,'cyan')
for i in range(20):
    x=150+rng.uniform(-5,150);z=430+rng.uniform(0,350);h=rng.uniform(12,65)
    box('skyline',x,h/2+8,z,rng.uniform(9,20),h,rng.uniform(10,24),'glass'if i%3 else'building')

# Car-sized static scale reference in a roadside bay, not in the driving line.
box('scale-car-body',46,.62,298,1.9,.65,4.1,'red')
box('scale-car-cabin',46,1.13,297.7,1.6,.48,1.8,'dark')
for x in [44.98,47.02]:
    for z in [296.7,299.3]:box('scale-car-wheel',x,.38,z,.24,.65,.65,'dark')

for key,(verts,faces)in batches.items():
    if verts:mesh_obj('batch_'+key,verts,faces,key,uv=False)
world=bpy.data.worlds.new(PREFIX+'Sky');world.use_nodes=True
bg=next(n for n in world.node_tree.nodes if n.type=='BACKGROUND');bg.inputs['Color'].default_value=(.48,.64,.76,1);bg.inputs['Strength'].default_value=.7;scene.world=world
ld=bpy.data.lights.new(PREFIX+'Sun','SUN');ld.energy=2.7
sun=bpy.data.objects.new(PREFIX+'Sun',ld);scene.collection.objects.link(sun);sun.rotation_euler=(.45,-.5,-.7)
def camera(name,eye,target,ortho=None):
    data=bpy.data.cameras.new(PREFIX+name);ob=bpy.data.objects.new(PREFIX+name,data);scene.collection.objects.link(ob)
    ob.location=xyz(eye);ob.rotation_euler=(Vector(xyz(target))-ob.location).to_track_quat('-Z','Y').to_euler()
    if ortho:data.type='ORTHO';data.ortho_scale=ortho
    else:data.lens=31
    return ob
overview=camera('Overview',(-285,225,-65),(25,0,260),610)
camera('BridgeChase',(0,5,91),(0,1,153))
camera('ApronChase',(20,6,305),(30,9,356))
camera('UpperChase',(30,13,374),(30,5,438))
scene.camera=overview
scene.render.resolution_x=1600;scene.render.resolution_y=1000;scene.render.resolution_percentage=100

layout=dict(version=2,name='滨海立交试驾区',createdWith='Blender MCP',coordinates='x right,y up,z forward; Blender=(x,-z,y), imported glTF root identity',asset='coastal-interchange.glb',seaLevel=-8,
 surfaces=surfaces,colliders=colliders,
 refillZones=[dict(id='landing-refill',surface='landing',xmin=-4.5,xmax=4.5,zmin=142,zmax=171),dict(id='high-refill',surface='high',xmin=24,xmax=36,zmin=350,zmax=377)],
 spawn=dict(x=0,y=0,z=12,heading=0),exit=dict(xmin=21,xmax=39,z=510,surface='far'),bounds=dict(xmin=-90,xmax=140,zmin=-30,zmax=570,ymin=-12),
 checkpoints=[dict(surface='start',x=0,z=12,heading=0),dict(surface='landing',x=0,z=166,heading=0),dict(surface='apron',x=20,z=300,heading=0),dict(surface='high',x=30,z=366,heading=0),dict(surface='far',x=30,z=490,heading=0)],
 routeMarkers=[dict(id=1,x=0,y=0,z=20),dict(id=2,x=0,y=0,z=100),dict(id=3,x=0,y=0,z=155),dict(id=4,x=20,y=0,z=307),dict(id=5,x=30,y=8,z=359),dict(id=6,x=30,y=0,z=510)],
 sectionLabels=dict(start='起步',runway='跨桥',landing='接收道路',curve='沿海缓弯',apron='抬升入口',high='上层高架',ramp='下坡',far='出口',recovery='恢复道路',**{'ground-bypass':'沿岸绕行','lower-bypass':'下层道路','return-ramp':'回程坡道','return-top':'返回主路'}))
(OUT/'coastal-interchange-layout.json').write_text(json.dumps(layout,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
bpy.context.view_layer.update()
props=bpy.ops.export_scene.gltf.get_rna_type().properties
formats=[i.identifier for i in props['export_format'].enum_items]
if not formats:
    try:bpy.ops.export_scene.gltf(export_format='__QUERY_VALID_FORMATS__')
    except TypeError as error:formats=list(ast.literal_eval(re.search(r'not found in (\(.*\))',str(error)).group(1)))
fmt=next(i for i in formats if i=='GLB')
bpy.ops.export_scene.gltf(filepath=str(OUT/'coastal-interchange.glb'),export_format=fmt,use_active_scene=True,export_yup=True,export_extras=True,export_cameras=False,export_lights=False)
bpy.data.libraries.write(str(SRC/'coastal-interchange.blend'),{scene},fake_user=True,compress=True)
print(json.dumps(dict(scene=scene.name,surfaces=len(surfaces),colliders=len(colliders),objects=len(scene.objects),triangles=sum(sum(len(p.vertices)-2 for p in o.data.polygons)for o in scene.objects if o.type=='MESH'),glbBytes=(OUT/'coastal-interchange.glb').stat().st_size,blendBytes=(SRC/'coastal-interchange.blend').stat().st_size)))
