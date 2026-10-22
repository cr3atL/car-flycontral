import{MeshBuilder}from'@babylonjs/core/Meshes/meshBuilder.js';
import{Mesh}from'@babylonjs/core/Meshes/mesh.js';
import{StandardMaterial}from'@babylonjs/core/Materials/standardMaterial.js';
import{DynamicTexture}from'@babylonjs/core/Materials/Textures/dynamicTexture.js';
import{Vector3,Quaternion}from'@babylonjs/core/Maths/math.vector.js';
import{Color3}from'@babylonjs/core/Maths/math.color.js';
const clamp=(v,a=0,b=1)=>Math.max(a,Math.min(b,v));
export class FlightEffects{
 constructor(scene){
  const tex=new DynamicTexture('soft-cold-mist',{width:64,height:64},scene,false),c=tex.getContext(),g=c.createRadialGradient(32,32,0,32,32,31);g.addColorStop(0,'rgba(236,253,255,.8)');g.addColorStop(.35,'rgba(223,245,249,.36)');g.addColorStop(1,'rgba(223,245,249,0)');c.fillStyle=g;c.fillRect(0,0,64,64);tex.hasAlpha=true;tex.update(false);
  const material=new StandardMaterial('mist-billboard',scene);material.diffuseTexture=tex;material.emissiveTexture=tex;material.useAlphaFromDiffuseTexture=true;material.emissiveColor.set(.7,.85,.9);material.disableLighting=true;material.backFaceCulling=false;
  this.mistMaterial=material;this.dustMaterial=new StandardMaterial('low-road-dust',scene);this.dustMaterial.diffuseTexture=tex;this.dustMaterial.emissiveTexture=tex;this.dustMaterial.useAlphaFromDiffuseTexture=true;this.dustMaterial.emissiveColor.set(.82,.76,.65);this.dustMaterial.disableLighting=true;this.dustMaterial.backFaceCulling=false;
  this.pool=Array.from({length:48},(_,i)=>{const mesh=MeshBuilder.CreatePlane('pooled-mist-'+i,{size:1},scene);mesh.material=material;mesh.billboardMode=Mesh.BILLBOARDMODE_ALL;mesh.isPickable=false;mesh.setEnabled(false);return{mesh,end:-1};});
  this.arcMat=new StandardMaterial('real-turn-light-arc',scene);this.arcMat.emissiveColor.set(.5,.95,1);this.arcMat.disableLighting=true;this.arcMat.alpha=.65;
  const path=Array.from({length:33},(_,i)=>{const a=i/32*Math.PI*1.4;return new Vector3(Math.cos(a)*2.2,Math.sin(a)*2.2,0);});
  this.arcs=Array.from({length:3},()=>{const mesh=MeshBuilder.CreateTube('pooled-turn-arc',{path,radius:.024,tessellation:5},scene);mesh.material=this.arcMat;mesh.rotationQuaternion=new Quaternion();mesh.setEnabled(false);mesh.isPickable=false;return{mesh,end:-1};});
  this.seed=15;this.reset();
 }
 random(){this.seed=(this.seed*1664525+1013904223)>>>0;return this.seed/4294967296;}
 reset(){for(const p of this.pool){p.end=-1;p.mesh.setEnabled(false);}for(const a of this.arcs){a.end=-1;a.mesh.setEnabled(false);}this.lastTime=0;this.lastStunt=-99;this.lastLand=-99;this.budget=0;this.cursor=0;this.peak=0;this.dustCount=0;}
 spawn(now,values,cap){const atCap=this.pool.filter(p=>p.end>now).length>=cap;const p=atCap?(values.dust?this.pool.find(p=>p.end>now&&!p.dust):null):this.pool.find(p=>p.end<=now);if(!p)return false;Object.assign(p,{at:now,end:now+values.life,...values});p.mesh.material=values.dust?this.dustMaterial:this.mistMaterial;p.mesh.setEnabled(true);return true;}
 update(s,jets,attitude,quality,groundAt,wheelContacts){
  if(this.score!==s.score||s.time<this.lastTime){this.reset();this.score=s.score;}
  const now=s.time,dt=Math.max(0,Math.min(.1,now-this.lastTime));this.lastTime=now;const cap=quality==='low'?16:48,active=jets.filter(j=>j.strength>.04&&!s.crashTimer),sum=active.reduce((v,j)=>v+j.strength,0);
  this.budget+=dt*Math.min(52,sum*11);
  while(this.budget>=1&&active.length){this.budget--;const j=active[this.cursor++%active.length],v=j.worldExhaust;this.spawn(now,{x:j.port.position.x,y:j.port.position.y,z:s.z+j.port.position.z,vx:v.x*(3+j.strength*5),vy:v.y*(3+j.strength*5)+.6,vz:s.speed*.62+v.z*(3+j.strength*5),size:.15+j.strength*.1,life:.32+Math.min(1,j.strength)*.16,dust:false},cap);}
  if(!active.length)this.budget=0;
  const events=s.events.filter(e=>e.type==='stunt'&&e.time>this.lastStunt);for(const e of events){this.lastStunt=Math.max(this.lastStunt,e.time);if(now-e.time>.25)continue;const a=this.arcs.find(a=>a.end<=now)||this.arcs[0];a.at=e.time;a.end=e.time+.26;a.axis=e.axis;a.mesh.setEnabled(true);}
  if(s.lastLanding&&s.lastLanding.time>this.lastLand){this.lastLand=s.lastLanding.time;const e=s.lastLanding;if(now-e.time<.18&&e.grade<3)for(const w of wheelContacts){if(!groundAt(w.z)||Math.abs(w.y)>.16)continue;for(let i=0;i<(e.grade===2?5:4);i++){const emitted=this.spawn(now,{x:w.x,y:.045,z:w.z,vx:(this.random()-.5)*(3+e.impact*.5),vy:.15+this.random()*.12,vz:s.speed*.10+(this.random()-.5)*1.2,size:e.grade===2?.52:.4,life:e.grade===2?.72:.6,dust:true},cap);if(emitted)this.dustCount++;}}}
  for(const p of this.pool){if(p.end<=now){p.mesh.setEnabled(false);continue;}const age=now-p.at,fade=1-age/(p.end-p.at),size=p.size+age*(p.dust?2.2:.8),height=size*(p.dust?.4:1);p.mesh.position.set(p.x+p.vx*age,Math.max(.03,p.y+p.vy*age-(p.dust?.4:0)*age*age)+(p.dust?height/2:0),p.z+p.vz*age-s.z);p.mesh.scaling.set(size*(p.dust?3:1),height,1);p.mesh.visibility=fade*(p.dust?.78:.32);}
  for(const a of this.arcs){if(a.end<=now){a.mesh.setEnabled(false);continue;}const axisQ=Quaternion.FromEulerAngles(a.axis==='yaw'?Math.PI/2:0,a.axis==='pitch'?Math.PI/2:0,0);a.mesh.rotationQuaternion.copyFrom(attitude.multiply(axisQ));a.mesh.position.set(s.x,s.y+.76,0);a.mesh.visibility=clamp((a.end-now)/.26);}
  this.peak=Math.max(this.peak,this.pool.filter(p=>p.end>now).length);
 }
 snapshot(){return{capacity:this.pool.length,active:this.pool.filter(p=>p.end>this.lastTime).length,arcs:this.arcs.filter(a=>a.end>this.lastTime).length,arcCapacity:3,peak:this.peak,dustEmitted:this.dustCount};}
}
