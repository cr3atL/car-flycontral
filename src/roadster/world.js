import'@babylonjs/loaders/glTF/index.js';import{Engine}from'@babylonjs/core/Engines/engine.js';import{Scene}from'@babylonjs/core/scene.js';import{SceneLoader}from'@babylonjs/core/Loading/sceneLoader.js';import{Vector3,Quaternion}from'@babylonjs/core/Maths/math.vector.js';import{Color3,Color4}from'@babylonjs/core/Maths/math.color.js';import{FreeCamera}from'@babylonjs/core/Cameras/freeCamera.js';import{HemisphericLight}from'@babylonjs/core/Lights/hemisphericLight.js';import{DirectionalLight}from'@babylonjs/core/Lights/directionalLight.js';import{MeshBuilder}from'@babylonjs/core/Meshes/meshBuilder.js';import{StandardMaterial}from'@babylonjs/core/Materials/standardMaterial.js';import{TransformNode}from'@babylonjs/core/Meshes/transformNode.js';import{ROADSTER as C}from'./config.js';
import{ShadowGenerator}from'@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import'@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
const approach=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt)),angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
export async function createRoadsterWorld(canvas,layout){
 const engine=new Engine(canvas,true,{preserveDrawingBuffer:false,stencil:false}),scene=new Scene(engine);scene.useRightHandedSystem=false;scene.clearColor=new Color4(.55,.76,.9,1);scene.fogMode=Scene.FOGMODE_EXP2;scene.fogDensity=.00045;scene.fogColor=new Color3(.64,.8,.9);
 const camera=new FreeCamera('roadster-follow',new Vector3(0,5,-5),scene);camera.inputs.clear();camera.minZ=.1;camera.maxZ=1800;camera.fov=.88;scene.activeCamera=camera;
 const hemi=new HemisphericLight('roadster-sky',new Vector3(.2,1,.2),scene);hemi.intensity=.8;hemi.diffuse=new Color3(.83,.91,1);hemi.groundColor=new Color3(.5,.49,.46);const sun=new DirectionalLight('roadster-sun',new Vector3(.4,-1,.5),scene);sun.intensity=1.55;sun.diffuse=new Color3(1,.94,.84);
 const asset=await SceneLoader.ImportMeshAsync(null,'./assets/',layout?.asset??'coastal-interchange.glb',scene);
 // AUTO inserts Ry(pi)*Sz(-1), which mirrors X in our authored world coordinates.
 const gltfRoot=asset.meshes.find(m=>m.name==='__root__');if(gltfRoot){gltfRoot.rotationQuaternion=Quaternion.Identity();gltfRoot.scaling.set(1,1,1);gltfRoot.computeWorldMatrix(true);}for(const m of asset.meshes)if(m.material)m.material.backFaceCulling=false;
 const mat=(n,c,glow=0)=>{const m=new StandardMaterial(n,scene);m.diffuseColor=Color3.FromHexString(c).toLinearSpace();m.specularColor.set(.18,.22,.25);m.emissiveColor=m.diffuseColor.scale(glow);return m;},paint=mat('roadster-original-red','#862536'),glass=mat('roadster-glass','#192d39'),rubber=mat('roadster-rubber','#172229'),accent=mat('roadster-copper','#d2a66d'),jetMat=mat('roadster-jet','#a3f0e8',.9),headlamp=mat('roadster-headlamp','#ffe8be',.7),tailLamp=mat('roadster-tail-lamp','#ed6e61',.6);
 const car=new TransformNode('roadster-original-car',scene),body=new TransformNode('roadster-suspension',scene);body.parent=car;
 sun.position.set(-24,60,-30);sun.shadowMinZ=1;sun.shadowMaxZ=160;sun.shadowFrustumSize=80;sun.autoCalcShadowZBounds=false;
 const shadow=new ShadowGenerator(1024,sun);shadow.usePercentageCloserFiltering=true;shadow.filteringQuality=ShadowGenerator.QUALITY_LOW;shadow.bias=.001;shadow.normalBias=.03;shadow.setDarkness(.25);for(const mesh of asset.meshes)mesh.receiveShadows=true;
 const box=(n,w,h,d,x,y,z,m,parent=body)=>{const mesh=MeshBuilder.CreateBox(n,{width:w,height:h,depth:d},scene);mesh.position.set(x,y,z);mesh.material=m;mesh.parent=parent;return mesh;};
 box('roadster-chassis',1.9,.43,3.8,0,.6,0,paint);box('roadster-cabin',1.46,.4,1.7,0,1.05,-.3,glass);box('roadster-roof',1.4,.08,1.25,0,1.3,-.4,paint);
 box('roadster-windshield',1.42,.44,.08,0,1.1,.51,glass).rotation.x=-.42;
 box('roadster-hood',1.75,.14,1.25,0,.88,1.18,paint);box('roadster-front-splitter',2,.1,.25,0,.42,1.9,accent);box('roadster-rear-bar',1.95,.08,.15,0,.75,-1.9,paint);
 for(const x of[-.61,.61]){box('roadster-headlight',.48,.075,.045,x,.77,1.91,headlamp);box('roadster-taillight',.5,.07,.045,x,.76,-1.91,tailLamp);}
 const wheels=[];for(const x of[-1,1])for(const z of[-1.2,1.2]){const m=MeshBuilder.CreateCylinder('roadster-wheel',{diameter:.84,height:.28,tessellation:14},scene);m.rotation.z=Math.PI/2;m.position.set(x,.43,z);m.parent=car;m.material=rubber;wheels.push(m);}
 const jets=[];for(const [kind,x,y,z,dir]of[['lift',-.72,.22,-.8,[0,-1,0]],['lift',.72,.22,-.8,[0,-1,0]],['forward',0,.65,-2,[0,0,-1]],['brake',0,.65,2,[0,0,1]],['side',-1.1,.65,0,[-1,0,0]],['side',1.1,.65,0,[1,0,0]]]){const m=MeshBuilder.CreateSphere('roadster-'+kind+'-jet',{diameter:.18,segments:8},scene);m.parent=car;m.position.set(x,y,z);m.material=jetMat;jets.push({kind,m,x,y,z,dir});}
 for(const mesh of car.getChildMeshes())shadow.addShadowCaster(mesh,false);
 const trajectory=MeshBuilder.CreateLines('roadster-trajectory',{points:[Vector3.Zero(),new Vector3(0,.01,0)],updatable:true},scene);trajectory.color=new Color3(.8,.95,.91);trajectory.isPickable=false;
 const landing=MeshBuilder.CreateLines('roadster-landing-footprint',{points:Array.from({length:5},()=>Vector3.Zero()),updatable:true},scene);landing.color=new Color3(.7,.95,.8);landing.isPickable=false;
 let traceMesh=trajectory,cameraHeading=0,lastLanding=-1,impactAt=-99,impactPower=0,ready=false,lastPrediction=null;
 const target=new Vector3();
 function update(s,dt,prediction){
  if(s.lastLanding&&s.lastLanding.time!==lastLanding){lastLanding=s.lastLanding.time;impactAt=s.time;impactPower=Math.min(1,s.lastLanding.impact/14);}
  const age=s.time-impactAt,dip=age>=0&&age<.5?Math.sin(Math.PI*Math.min(1,age/.5))*.19*impactPower:0;
  car.position.set(s.x,s.y,s.z);car.rotation.y=s.heading;body.rotation.set(s.pitch,0,s.roll);body.position.y=-dip;sun.position.set(s.x-24,s.y+60,s.z-30);
  for(const w of wheels)w.rotation.x+=s.speed*dt/.42;
  for(const j of jets){
   const f=s.forces[j.kind],on=j.kind==='side'?Math.abs(f)>.1&&(j.x<0?f>0:f<0):f>.1;j.m.setEnabled(on);
   if(!on)continue;
   const amount=Math.min(1,Math.abs(f)/(j.kind==='lift'?C.lift:j.kind==='side'?C.side:j.kind==='brake'?C.airBrake:C.forward));
   if(j.kind==='lift'){j.m.scaling.set(.8,1+amount*5,.8);j.m.position.set(j.x,j.y-amount*.6,j.z);j.m.rotation.set(0,0,0);}
   else{
    const basis=j.kind==='brake'&&s.speed>.1?Math.atan2(s.vx,s.vz):s.reference,local=angle(basis-s.heading);
    const dx=j.kind==='side'?j.dir[0]*Math.cos(local):j.dir[2]*Math.sin(local),dz=j.kind==='side'?-j.dir[0]*Math.sin(local):j.dir[2]*Math.cos(local);
    j.m.scaling.set(.8,.8,1+amount*6);j.m.position.set(j.x+dx*amount*.5,j.y,j.z+dz*amount*.5);j.m.rotation.y=Math.atan2(dx,dz);
   }
  }
  const desired=s.speed>4?Math.atan2(s.vx,s.vz):s.heading,headingStep=angle(desired-cameraHeading)*(1-Math.exp(-2*dt));cameraHeading=angle(cameraHeading+Math.max(-1.1*dt,Math.min(1.1*dt,headingStep)));
  const previewIn=Math.max(0,Math.min(1,(s.z-278)/24)),previewOut=Math.max(0,Math.min(1,(365-s.z)/20)),climbView=previewIn*previewIn*(3-2*previewIn)*previewOut;
  const distance=11+Math.min(3,s.speed*.08),baseHeight=5.2+Math.min(1.2,Math.max(0,s.vy)*.05);
  const height=baseHeight+Math.max(0,10.6-s.y-baseHeight)*climbView,px=s.x-Math.sin(cameraHeading)*distance,pz=s.z-Math.cos(cameraHeading)*distance;
  if(!ready){camera.position.set(px,s.y+height,pz);ready=true;}else{camera.position.x=approach(camera.position.x,px,5,dt);camera.position.y=approach(camera.position.y,s.y+height-dip*.6,6,dt);camera.position.z=approach(camera.position.z,pz,5,dt);}
  const ahead=5+Math.min(3,s.speed*.1);target.set(s.x+Math.sin(cameraHeading)*ahead,s.y+1.1+climbView*2.6,s.z+Math.cos(cameraHeading)*ahead);camera.setTarget(target);
  traceMesh.setEnabled(!!prediction);landing.setEnabled(!!prediction);if(prediction&&prediction!==lastPrediction){lastPrediction=prediction;const points=prediction.trace.map(p=>new Vector3(p.x,p.y+.1,p.z));traceMesh.dispose();traceMesh=MeshBuilder.CreateLines('roadster-trajectory',{points:points.length>1?points:[points[0],points[0].add(new Vector3(0,.01,0))]},scene);traceMesh.color=prediction.safe?new Color3(.65,.91,.8):new Color3(1,.6,.4);traceMesh.alpha=.65;
   const c=Math.cos(prediction.heading),n=Math.sin(prediction.heading),corners=[[-1,-1],[-1,1],[1,1],[1,-1],[-1,-1]].map(([a,b])=>new Vector3(prediction.x+a*C.halfWidth*c+b*C.halfLength*n,prediction.y+.08,prediction.z-a*C.halfWidth*n+b*C.halfLength*c));MeshBuilder.CreateLines('roadster-landing-footprint',{points:corners,instance:landing});landing.color=prediction.safe?new Color3(.6,.96,.78):new Color3(1,.5,.32);landing.visibility=prediction.impact>C.dangerImpact?.5+.5*Math.sin(s.time*16):1;
  }
 }
 return{engine,scene,update,resetCamera:(heading=0)=>{cameraHeading=heading;ready=false;lastLanding=-1;impactAt=-99;},snapshot:()=>({asset:layout?.asset??'coastal-interchange.glb',meshes:scene.meshes.length,rightHanded:scene.useRightHandedSystem,camera:{x:camera.position.x,y:camera.position.y,z:camera.position.z},assetMeshes:asset.meshes.length})};
}
