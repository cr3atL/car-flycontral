"""Live Blender MCP construction. Visual-only sample; immutable road layout is never written."""
import bpy,bmesh,math,random,json
from pathlib import Path
from mathutils import Vector,Euler
ROOT=Path('D:/project/car-flycontral');OLD=bpy.context.window.scene
NAME='FirstSpan_Coast_Source_v5'
if bpy.data.scenes.get(NAME):raise RuntimeError('Inspect existing scene before rebuilding')
scene=bpy.data.scenes.new(NAME);scene['construction']='Live Blender MCP';scene['task']='firstspan-art';bpy.context.window.scene=scene
rng=random.Random(28314);groups={}
def xyz(p):return(p[0],-p[2],p[1])
def noise(x,y,z):return math.sin(x*1.19+z*.83)*math.cos(y*1.71-z*.43)+.43*math.sin(x*3.17-y*2.4+z*1.1)
def coast(z):return 73+6*math.sin(z*.061)+3.2*math.sin(z*.173)+2.4*math.sin(z*.37+.5)
def mat(name,color,rough=.8):
 m=bpy.data.materials.new('FS_'+name);m.use_nodes=True;b=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED');b.inputs['Base Color'].default_value=(*color,1);b.inputs['Roughness'].default_value=rough
 node=m.node_tree.nodes.new('ShaderNodeVertexColor');node.layer_name='Col';m.node_tree.links.new(node.outputs['Color'],b.inputs['Base Color']);return m
mats={'rock':mat('Fractured_Warm_Limestone',(.48,.40,.28)), 'green':mat('Coastal_Shrub',(.10,.18,.045)), 'soil':mat('Coastal_Earth',(.18,.14,.065)), 'trunk':mat('Weathered_Wood',(.17,.105,.05)), 'mark':mat('Quiet_Route_Paint',(.055,.33,.38),.8)}
def batch(key,verts,faces,colors):
 v,f,c=groups.setdefault(key,[[],[],[]]);off=len(v);v.extend(verts);f.extend(tuple(off+i for i in face)for face in faces);c.extend(colors)
def rock_color(p,shade=1):
 x,y,z=p;variation=.065*noise(x*.27,y*.48,z*.24)+.018*noise(x*2,y,z*2);wet=max(0,min(1,(-6.2-y+.25*math.sin(z*.6))/1.5));v=(.40+variation)*shade*(1-.67*wet)
 return(v*1.12,v*.99,v*.76,1)
def stone(cx,cy,cz,sx,sy,sz,seed):
 # Convex hull of clipped, skewed cuboid corners: broad fracture faces, no latitude rings.
 rr=random.Random(seed);pts=[];rot=Euler((rr.uniform(-.55,.55),rr.uniform(-.8,.8),rr.uniform(-1.2,1.2))).to_matrix()
 for ax in[-1,1]:
  for ay in[-1,1]:
   for az in[-1,1]:
    for cut in range(3):
     p=[ax*rr.uniform(.72,1.02),ay*rr.uniform(.65,1.02),az*rr.uniform(.7,1.02)];p[cut]*=rr.uniform(.48,.76)
     q=rot@Vector(p);pts.append((cx+q.x*sx,cy+q.y*sy,cz+q.z*sz))
 bm=bmesh.new()
 for p in pts:bm.verts.new(p)
 bmesh.ops.convex_hull(bm,input=list(bm.verts))
 bmesh.ops.bevel(bm,geom=list(bm.edges),offset=.065,segments=1,affect='EDGES')
 bm.verts.index_update()
 v=[tuple(p.co)for p in bm.verts];f=[tuple(p.index for p in face.verts)for face in bm.faces];bm.free()
 batch('rock',v,f,[rock_color(p,.92+rr.random()*.14)for p in v])
def shrub(cx,cy,cz,r,h,seed):
 rr=random.Random(seed);N=14;rows=9;v=[]
 for j in range(rows):
  a=-math.pi/2+math.pi*j/(rows-1)
  for i in range(N):
   q=2*math.pi*i/N;k=1+.12*noise(math.cos(q)*2,math.sin(a)*2,math.sin(q)*2+seed)
   v.append((cx+math.cos(a)*math.cos(q)*r*k,cy+h*.50*(1+math.sin(a))*k,cz+math.cos(a)*math.sin(q)*r*.82*k))
 f=[(j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i)for j in range(rows-1)for i in range(N)]
 batch('green',v,f,[(.055*(t:=rr.uniform(.65,1.45)),.115*t,.023*t,1)for p in v])
def tree(cx,cy,cz,h,seed):
 rr=random.Random(seed);v=[];N=8
 for y,r,xoff in[(0,.16,0),(h*.65,.09,.35),(h*.9,.04,.55)]:
  for i in range(N):a=2*math.pi*i/N;v.append((cx+xoff+math.cos(a)*r,cy+y,cz+math.sin(a)*r))
 batch('trunk',v,[(j*N+i,j*N+(i+1)%N,(j+1)*N+(i+1)%N,(j+1)*N+i)for j in range(2)for i in range(N)],[(.12,.073,.032,1)]*len(v))
 for k in range(7):
  a=k*2.4;r=h*rr.uniform(.13,.25);shrub(cx+.4+math.cos(a)*h*.17,cy+h*rr.uniform(.48,.72),cz+math.sin(a)*h*.17,r,h*rr.uniform(.35,.53),seed+k)
foam=[];terrain=[];tri=[]
try:
 # Jagged shoreline and variable cliff benches, triangulated with staggered stations.
 offsets=[-10,-5,-2,0,2.3,5.6,10,17,28,45,72,100];heights=[-11,-9.3,-7.4,-4.4,-.2,3.2,6.1,7.8,8.4,9.1,9.5,10]
 profile=list(zip(offsets,heights));offsets=[-10+j*.9 for j in range(45)]+[32+j*2.8 for j in range(12)]+[72,86,100]
 def profile_height(x):
  for a,b in zip(profile,profile[1:]):
   if x<=b[0]:return a[1]+(b[1]-a[1])*(x-a[0])/(b[0]-a[0])
  return profile[-1][1]
 heights=[profile_height(x)for x in offsets];N=159;M=len(offsets)
 for i in range(N):
  z=62+268*i/(N-1)
  for j,(dx,h)in enumerate(zip(offsets,heights)):
   zz=z if i in[0,N-1] else z+.45*math.sin(j*2.1+i*.83)
   x=coast(zz)+dx+.25*noise(dx*.27,0,zz*.15)
   # Vertical fractures interrupt the old continuous horizontal strata.
   y=h+(1.8 if dx<8 else .5)*noise(x*.14,dx*.11,zz*.16)+(.55 if dx<8 else .19)*math.sin(zz*.49+dx*.6)
   terrain.append((x,y,zz))
 for i in range(N-1):
  for j in range(M-1):
   a=i*M+j;b=a+M
   tri.extend([(a,b,b+1),(a,b+1,a+1)]if(i+j)%2 else[(a,b,a+1),(b,b+1,a+1)])
 batch('rock',terrain,tri,[rock_color(p)for p in terrain])
 def ground(x,z):
  # Exact barycentric interpolation of the exported terrain triangles, not an approximate formula.
  near=max(0,min(N-2,int((z-62)/268*(N-1))))
  for i in range(max(0,near-2),min(N-1,near+3)):
   for a,b,c in tri[i*(M-1)*2:(i+1)*(M-1)*2]:
    A,B,C=terrain[a],terrain[b],terrain[c];den=(B[2]-C[2])*(A[0]-C[0])+(C[0]-B[0])*(A[2]-C[2])
    u=((B[2]-C[2])*(x-C[0])+(C[0]-B[0])*(z-C[2]))/den;v=((C[2]-A[2])*(x-C[0])+(A[0]-C[0])*(z-C[2]))/den
    if min(u,v,1-u-v)>-1e-5:return A[1]*u+B[1]*v+C[1]*(1-u-v)
  raise RuntimeError('Plant root outside terrain '+str((x,z)))
 # Soil and grass follow the very same terrain triangles, with irregular margins.
 for key,limit,col in[('soil',4,(.20,.15,.075,1)),('green',5.5,(.07,.13,.032,1))]:
  v=[];f=[]
  for face in tri:
   p=[terrain[k]for k in face];cx=sum(q[0]for q in p)/3;cz=sum(q[2]for q in p)/3;h=sum(q[1]for q in p)/3
   patch=noise(cx*.08,0,cz*.11)
   if h>limit and (key=='soil' or patch>-.45):
    n=len(v);v.extend((x,y+(.025 if key=='soil'else .045),z)for x,y,z in p);f.append((n,n+1,n+2))
  batch(key,v,f,[tuple(c*(.86+.12*noise(x*.1,y,z*.12))if i<3 else c for i,c in enumerate(col))for x,y,z in v])
 for i in range(71):
  z=rng.uniform(65,325);edge=coast(z);scale=rng.choice([.5,.8,1.4,2.3]);sx=rng.uniform(1.1,2.6)*scale;sy=rng.uniform(1.2,3.2)*scale;sz=rng.uniform(1.1,3.8)*scale
  x=edge+rng.uniform(-3.5,3);y=-6.1+sy*.45+rng.uniform(-1.5,1.2)
  stone(x,y,z,sx,sy,sz,410+i)
  if i%10==0:foam.append([x,z,max(sx,sz)*.8,sy*1.2])
 for i in range(26):
  z=rng.uniform(65,325);x=coast(z)+rng.uniform(-7,-1);stone(x,-7.7,z,rng.uniform(.25,1.3),rng.uniform(.3,.9),rng.uniform(.4,1.9),800+i)
 # Clumps instead of evenly spaced individual umbrellas; every root samples the actual mesh.
 roots=[]
 for i in range(285):
  z=rng.uniform(65,325);x=coast(z)+rng.uniform(6,47);y=ground(x,z);r=rng.uniform(.45,1.7)
  shrub(x,y-.13,z,r,r*rng.uniform(.9,1.7),1200+i);roots.append([x,y,z])
 for z in[75,91,111,136,158,181,211,233,259,285,311]:
  x=coast(z)+rng.uniform(16,34);tree(x,ground(x,z)-.10,z,rng.uniform(3.5,5.5),int(z))
 for x,z,s in[(-83,143,5),(-119,174,7)]:stone(x,-8,z,s,s*.65,s*.8,1700+int(z));foam.append([x,z,s*.85,s*.65])
 for z in[91,147]:
  v=[(-.50,.021,z-.85),(-.16,.021,z-.85),(-.16,.021,z+.15),(-.48,.021,z+.15),(0,.021,z+.95),(.48,.021,z+.15),(.16,.021,z+.15),(.16,.021,z-.85),(.50,.021,z-.85)]
  batch('mark',v,[tuple(range(len(v)))],[(.035,.27,.31,1)]*len(v))
 for key,(verts,faces,colors)in groups.items():
  me=bpy.data.meshes.new('FS_'+key+'_mesh');me.from_pydata([xyz(p)for p in verts],[],faces);me.materials.append(mats[key]);me.update();ob=bpy.data.objects.new('FS_'+key,me);scene.collection.objects.link(ob)
  col=me.color_attributes.new(name='Col',type='FLOAT_COLOR',domain='POINT')
  for i,c in enumerate(colors):col.data[i].color=c
  for poly in me.polygons:poly.use_smooth=key in['green','trunk']
 shore={'shoreBand':[62,335],'foamContacts':foam+[[0,88,1.2,8.2],[0,187,1.2,8.2]],'nonCollision':True,'constructedVia':'Live Blender MCP'}
 (ROOT/'public/assets/firstspan/shore-contacts.json').write_text(json.dumps(shore,indent=2),encoding='utf8')
 manifest=shore|{'coastAsset':'firstspan-coast.glb'};(ROOT/'public/assets/firstspan/visual-manifest.json').write_text(json.dumps(manifest,indent=2),encoding='utf8')
 (ROOT/'assets/blender/firstspan-coast-roots.json').write_text(json.dumps({'rootMethod':'Exact barycentric interpolation of exported terrain triangles; shrub base buried 0.13m','roots':roots},indent=2),encoding='utf8')
 exec(compile((ROOT/'assets/blender/export_firstspan_scene.py').read_text(encoding='utf-8-sig'),'export_firstspan_scene.py','exec'));export_firstspan(NAME,'firstspan-coast')
finally:bpy.context.window.scene=OLD
