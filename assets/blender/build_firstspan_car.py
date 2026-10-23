"""Execute through live Blender MCP. Creates only this task's scene; never saves RX100."""
import bpy, math, json
from pathlib import Path
from mathutils import Vector

ROOT=Path('D:/project/car-flycontral')
SRC=ROOT/'assets/blender'; OUT=ROOT/'public/assets'; SRC.mkdir(exist_ok=True,parents=True)
old_scene=bpy.context.window.scene
old_selected=list(bpy.context.selected_objects);old_active=bpy.context.view_layer.objects.active
NAME='FirstSpan_GT_Source_v2'
if bpy.data.scenes.get(NAME): raise RuntimeError('Inspect existing FirstSpan scene before rebuilding')
scene=bpy.data.scenes.new(NAME);scene['construction']='Geometry constructed through live Blender MCP';scene['task']='firstspan-art'
scene.unit_settings.system='METRIC'
bpy.context.window.scene=scene

def xyz(p):return(p[0],-p[2],p[1])
def material(name,c,rough=.4,metal=0,coat=0,emission=0):
 m=bpy.data.materials.new('GT_'+name);m.use_nodes=True
 bs=next(n for n in m.node_tree.nodes if n.type=='BSDF_PRINCIPLED')
 for key,value in [('Base Color',(*c,1)),('Roughness',rough),('Metallic',metal),('Coat Weight',coat),('Coat Roughness',.12),('Emission Color',(*c,1)),('Emission Strength',emission)]:
  if bs.inputs.get(key):bs.inputs[key].default_value=value
 m.diffuse_color=(*c,1);return m
paint=material('Crimson_Clearcoat',(.36,.012,.023),.25,.52,.65)
glass=material('Smoked_Glass',(.012,.025,.037),.12,.35,.3)
rubber=material('Rubber',(.013,.016,.019),.86)
carbon=material('Carbon_Undertray',(.023,.027,.031),.52,.18)
alloy=material('Forged_Alloy',(.28,.32,.34),.24,.94)
rimdark=material('Rim_Inset',(.045,.051,.057),.38,.85)
disc=material('Brake_Disc',(.19,.20,.20),.48,.88)
caliper=material('Caliper',(.48,.23,.045),.34,.5)
tail=material('Tail_LED',(.65,.004,.008),.25,.1,0,2)
lamp=material('Head_LED',(.9,.78,.57),.25,.1,0,1.4)

root=bpy.data.objects.new('GT_ModelRoot',None);scene.collection.objects.link(root)
def mesh(name,verts,faces,mat,parent=root,smooth=True):
 me=bpy.data.meshes.new(name+'_mesh');me.from_pydata([xyz(p)for p in verts],[],faces);me.materials.append(mat);me.update()
 ob=bpy.data.objects.new(name,me);scene.collection.objects.link(ob);ob.parent=parent
 for p in me.polygons:p.use_smooth=smooth
 return ob
def apply(ob,mod):
 bpy.ops.object.select_all(action='DESELECT');ob.select_set(True);bpy.context.view_layer.objects.active=ob;bpy.ops.object.modifier_apply(modifier=mod.name)
def bevel(ob,width=.025,segments=3):
 mod=ob.modifiers.new('Manufactured edge','BEVEL');mod.width=width;mod.segments=segments;apply(ob,mod);return ob
def box(name,c,size,mat,parent=root,b=.015):
 x,y,z=c;w,h,d=[q/2 for q in size]
 v=[(x+a*w,y+k*h,z+j*d)for a,k,j in[(-1,-1,-1),(-1,-1,1),(-1,1,1),(-1,1,-1),(1,-1,-1),(1,-1,1),(1,1,1),(1,1,-1)]]
 ob=mesh(name,v,[(0,3,2,1),(4,5,6,7),(0,1,5,4),(3,7,6,2),(0,4,7,3),(1,2,6,5)],mat,parent)
 return bevel(ob,b,3)if b else ob
def ring(name,c,axis,r1,r2,depth,mat,parent=root,N=48):
 v=[]
 for off in[-depth/2,depth/2]:
  for radius in[r1,r2]:
   for i in range(N):
    a=2*math.pi*i/N;u=math.cos(a)*radius;w=math.sin(a)*radius
    p=(c[0]+off,c[1]+u,c[2]+w)if axis=='X'else(c[0]+u,c[1]+w,c[2]+off)if axis=='Z'else(c[0]+u,c[1]+off,c[2]+w)
    v.append(p)
 f=[]
 for i in range(N):
  j=(i+1)%N
  f.extend([(i,j,N+j,N+i),(2*N+i,3*N+i,3*N+j,2*N+j),(i,2*N+i,2*N+j,j),(N+i,N+j,3*N+j,3*N+i)])
 return mesh(name,v,f,mat,parent)

try:
 # Rounded, flared shell: longitudinal loft, not intersecting runtime boxes.
 stations=61;around=64;v=[]
 for j in range(stations):
  z=-1.95+3.9*j/(stations-1)
  haunch=math.exp(-((z+1.18)/.49)**2)+.8*math.exp(-((z-1.18)/.48)**2)
  width=.88+.10*math.sin(math.pi*j/(stations-1))+.075*haunch
  cy=.555+.035*math.cos(z*.9);ry=.275+.025*haunch
  for i in range(around):
   a=2*math.pi*i/around;x=width*math.cos(a);sn=math.sin(a)
   # The shoulder rises ABOVE the arch apex; the cut never severs the upper shell.
   y=cy+ry*(max(0,sn)**.5 if sn>=0 else sn)
   if sn>0:y+=.33*haunch*math.cos(a)**2*sn**.18
   v.append((x,y,z))
 f=[tuple(range(around-1,-1,-1)),tuple((stations-1)*around+i for i in range(around))]
 f.extend((j*around+i,j*around+(i+1)%around,(j+1)*around+(i+1)%around,(j+1)*around+i)for j in range(stations-1)for i in range(around))
 shell=mesh('GT_Curved_BodyShell',v,f,paint)
 # Wheel wells are openings in the continuous, volumetric body shell.
 for x in[-1,1]:
  for z in[-1.18,1.18]:
   bpy.ops.mesh.primitive_cylinder_add(vertices=64,radius=.465,depth=.72,location=xyz((x*.99,.43,z)),rotation=(0,math.pi/2,0))
   cutter=bpy.context.object;cutter.name='GT_temporary_arch_cut';cutter.data.materials.append(paint)
   mod=shell.modifiers.new('Open wheel arch','BOOLEAN')
   options=[e.identifier for e in mod.bl_rna.properties['operation'].enum_items];mod.operation=next(e for e in options if e=='DIFFERENCE')
   solvers=[e.identifier for e in mod.bl_rna.properties['solver'].enum_items];mod.solver='EXACT'if'EXACT'in solvers else solvers[0]
   mod.object=cutter;apply(shell,mod);bpy.data.objects.remove(cutter,do_unlink=True)
 # A dense coherent canopy surface; roof and pillars use the SAME surface function.
 profile=[(-1.04,.70,.835),(-.82,.70,1.05),(-.58,.66,1.255),(-.34,.65,1.305),(-.08,.65,1.30),(.12,.66,1.24),(.43,.71,1.005),(.70,.72,.835)]
 def cabin_profile(z):
  for i in range(len(profile)-1):
   if z<=profile[i+1][0]:break
  a,b=profile[i],profile[i+1];t=max(0,min(1,(z-a[0])/(b[0]-a[0])));q=t*t*(3-2*t)
  return a[1]+(b[1]-a[1])*q,a[2]+(b[2]-a[2])*q
 def cabin_point(z,u,offset=0):
  w,top=cabin_profile(z)
  return(w*u,.835+(top-.835)*max(0,1-u*u)**.55+offset,z)
 def surface(name,z0,z1,u0,u1,nz,nu,mat,offset=0):
  verts=[cabin_point(z0+(z1-z0)*j/nz,u0+(u1-u0)*i/nu,offset)for j in range(nz+1)for i in range(nu+1)]
  return mesh(name,verts,[(j*(nu+1)+i,j*(nu+1)+i+1,(j+1)*(nu+1)+i+1,(j+1)*(nu+1)+i)for j in range(nz)for i in range(nu)],mat)
 surface('GT_Low_Glass_Canopy',-1.04,.70,-1,1,84,32,glass)
 surface('GT_Roof_Crown',-.59,.10,-.73,.73,40,24,paint,.006)
 for z in[-.81,.40]:surface('GT_Structural_Pillar',z-.022,z+.022,-1,1,4,32,paint,.008)
 for sign in[-1,1]:
  box('GT_Side_Sill',(sign*.95,.30,0),(.14,.16,2.35),carbon,b=.025)
  box('GT_Mirror_Stem',(sign*.81,.95,.41),(.19,.035,.065),carbon,b=.012)
  box('GT_Mirror_Housing',(sign*.96,.97,.39),(.21,.10,.17),paint,b=.045)
 box('GT_Undertray',(0,.25,0),(1.63,.12,3.45),carbon,b=.04)
 box('GT_Front_Splitter',(0,.27,1.89),(1.98,.075,.24),carbon,b=.025)
 box('GT_Rear_Diffuser',(0,.29,-1.86),(1.67,.23,.27),carbon,b=.03)
 for x in[-.65,-.33,0,.33,.65]:box('GT_Diffuser_Fin',(x,.20,-1.83),(.035,.20,.32),carbon,b=.006)
 box('GT_Rear_Grille',(0,.51,-1.943),(1.5,.15,.04),carbon,b=.015)
 for x in[-.60,.60]:
  box('GT_Thin_Taillight',(x*.89,.687,-1.956),(.57,.025,.026),tail,b=.011)
  box('GT_Front_Headlight',(x,.77,1.90),(.43,.035,.06),lamp,b=.014)
  ring('GT_Forward_Brake_Nozzle',(x,.47,1.976),'Z',.086,.063,.035,alloy)
  ring('GT_Aft_Thrust_Nozzle',(x,.45,-1.985),'Z',.10,.073,.035,alloy)
  ring('GT_Lift_Nozzle',(x,.18,-.72),'Y',.102,.075,.03,alloy)
 # Wheels have their own actual rotation pivots; brake calipers stay with body.
 for x,side in[(-.99,'L'),(.99,'R')]:
  for z,end in[(1.18,'F'),(-1.18,'R')]:
   pivot=bpy.data.objects.new('GT_Wheel_'+end+side,None);scene.collection.objects.link(pivot);pivot.parent=root;pivot.location=xyz((x,.43,z));v=[]
   for i in range(56):
    a=2*math.pi*i/56
    for j in range(12):
     q=2*math.pi*j/12;r=.354+.066*math.cos(q);v.append((.14*math.sin(q),r*math.sin(a),r*math.cos(a)))
   mesh('GT_Tyre_'+end+side,v,[(i*12+j,i*12+(j+1)%12,((i+1)%56)*12+(j+1)%12,((i+1)%56)*12+j)for i in range(56)for j in range(12)],rubber,pivot)
   outer=.126*(1 if x>0 else-1)
   ring('GT_Rim_Lip_'+end+side,(outer,0,0),'X',.314,.288,.018,alloy,pivot)
   ring('GT_Rim_Barrel_'+end+side,(0,0,0),'X',.287,.267,.21,rimdark,pivot)
   ring('GT_Brake_Disc_'+end+side,(outer*.65,0,0),'X',.263,.07,.014,disc,pivot)
   ring('GT_Centre_Hub_'+end+side,(outer+.004,0,0),'X',.073,.014,.032,alloy,pivot,N=24)
   for k in range(7):
    a=k*2*math.pi/7;verts=[]
    for xx in[outer-.012,outer+.012]:
     for r,aa in[(.064,a-.13),(.30,a+.045),(.30,a+.12),(.064,a+.18)]:verts.append((xx,r*math.sin(aa),r*math.cos(aa)))
    mesh('GT_Spoke_'+end+side,verts,[(0,1,2,3),(7,6,5,4),(0,4,5,1),(1,5,6,2),(2,6,7,3),(3,7,4,0)],alloy,pivot)
   box('GT_Caliper_'+end+side,(x+(.085 if x>0 else-.085),.44,z+.19),(.10,.24,.12),caliper,b=.03)
 # The helper exports only this scene and its referenced resources.
 exec(compile((SRC/'export_firstspan_scene.py').read_text(encoding='utf-8-sig'),'export_firstspan_scene.py','exec'))
 export_firstspan(NAME,'roadster-gt')
finally:
 bpy.context.window.scene=old_scene
 bpy.ops.object.select_all(action='DESELECT')
 for ob in old_selected:
  if ob.name in bpy.context.view_layer.objects:ob.select_set(True)
 if old_active and old_active.name in bpy.context.view_layer.objects:bpy.context.view_layer.objects.active=old_active
