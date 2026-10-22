import{ROADSTER as C}from'./config.js';import{inside,topAt,footprintBounds,overlaps,surfaceAt,supported,footprint}from'./geometry.js';
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v)),mix=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt)),angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
export class RoadsterSimulation{
 constructor(layout){this.layout=layout;this.restart();}
 restart(){this.events=[];this.visits={low:0,high:0,far:0};this.checkpoint={...this.layout.spawn,surface:'start'};this.time=0;this.recover(false);this.complete=false;this.crashes=0;this.resets=0;this.landingCount=0;this.flight=0;this.lastLanding=null;this.seen={drive:false,lift:false,steer:false,brake:false};}
 recover(record=true){this.recoveryNotice=record?{reason:this.reason||'手动复位',time:this.time}:null;const p=this.checkpoint;Object.assign(this,{x:p.x,y:p.y??topAt(this.layout.surfaces.find(s=>s.id===p.surface)??{top:0},p.x,p.z),z:p.z,vx:0,vy:0,vz:0,heading:p.heading??0,reference:p.heading??0,steerAngle:0,pitch:0,roll:0,pressure:100,grounded:true,surfaceId:p.surface??'start',groundAge:0,refillAge:0,crashTimer:0,reason:'',reverse:false,previousThrottle:0,jets:{lift:0,forward:0,side:0,brake:0},forces:{lift:0,forward:0,side:0,brake:0,cost:0},input:{throttle:0,steer:0,lift:false},lastLanding:null,departureSurface:null});if(record){this.resets++;this.emit('reset',{checkpoint:p.surface});}}
 emit(type,data={}){if(this.forecast)return;this.events.push({type,time:this.time,x:this.x,y:this.y,z:this.z,pressure:this.pressure,...data});if(this.events.length>400)this.events.shift();}
 crash(reason){if(this.crashTimer)return;this.reason=reason;this.crashTimer=C.crashDelay;this.crashes++;this.jets={lift:0,forward:0,side:0,brake:0};this.forces={...this.jets,cost:0};this.input={throttle:0,steer:0,lift:false};this.emit('crash',{reason});}
 get speed(){return Math.hypot(this.vx,this.vz);}
 step(dt){if(this.complete)return;if(!(dt>0&&dt<=.05))throw Error('Roadster step must be0..50ms');this.time+=dt;if(this.crashTimer){this.crashTimer=Math.max(0,this.crashTimer-dt);if(!this.crashTimer)this.recover();return;}
  const prev={x:this.x,y:this.y,z:this.z},wasGround=this.grounded,oldSurface=this.surfaceId,t=clamp(this.input.throttle,-1,1),turn=clamp(this.input.steer,-1,1),lift=!!this.input.lift;this.seen.drive||=t>0;this.seen.lift||=lift;this.seen.steer||=!!turn;this.seen.brake||=t<0;
  const requests={lift:lift?C.lift:0,forward:!this.grounded&&t>0?C.forward*t:0,side:!this.grounded?C.side*turn:0,brake:!this.grounded&&t<0&&this.speed>.015?C.airBrake*-t:0};
  for(const k of Object.keys(this.jets)){this.jets[k]=mix(this.jets[k],requests[k],C.jetResponse,dt);if(!requests[k]&&Math.abs(this.jets[k])<.002)this.jets[k]=0;}
  const requestedCost=this.jets.lift/C.lift*C.liftCost+this.jets.forward/C.forward*C.forwardCost+Math.abs(this.jets.side)/C.side*C.sideCost+this.jets.brake/C.airBrake*C.brakeCost,ratio=requestedCost?Math.min(1,this.pressure/(requestedCost*dt)):0;
  this.forces={...Object.fromEntries(Object.entries(this.jets).map(([k,v])=>[k,v*ratio])),cost:requestedCost*ratio};this.pressure=Math.max(0,this.pressure-this.forces.cost*dt);
  let ax=0,az=0;
  if(this.grounded){
   const dx=Math.sin(this.heading),dz=Math.cos(this.heading),rightX=dz,rightZ=-dx;let longitudinal=this.vx*dx+this.vz*dz,lateral=this.vx*rightX+this.vz*rightZ;
   if(t<-.05&&this.previousThrottle>=-.05)this.reverse=Math.abs(longitudinal)<.12;
   if(t>=-.05)this.reverse=false;
   if(t>0){if(longitudinal<-.05)longitudinal=Math.min(0,longitudinal+C.brake*t*dt);else longitudinal+=C.motor*t*Math.max(0,1-longitudinal/55)*dt;}
   else if(t<0){if(this.reverse)longitudinal-=C.reverseMotor*-t*Math.max(0,1+longitudinal/C.reverseMax)*dt;else longitudinal=Math.max(0,longitudinal-C.brake*-t*dt);}
   const drag=C.rolling+C.groundDrag*longitudinal*longitudinal;longitudinal=Math.sign(longitudinal)*Math.max(0,Math.abs(longitudinal)-drag*dt);lateral*=Math.exp(-C.lateralGrip*dt);
   const maxSteer=C.steerHigh+(C.steerLow-C.steerHigh)/(1+(Math.abs(longitudinal)/12)**2);this.steerAngle=mix(this.steerAngle,turn*maxSteer,C.steerResponse,dt);this.heading=angle(this.heading+longitudinal/C.wheelbase*Math.tan(this.steerAngle)*dt);
   const c=Math.cos(this.heading),n=Math.sin(this.heading);this.vx=longitudinal*n+lateral*c;this.vz=longitudinal*c-lateral*n;this.reference=this.heading;
  }else{
   if(this.speed>C.referenceSpeed)this.reference=angle(this.reference+angle(Math.atan2(this.vx,this.vz)-this.reference)*(1-Math.exp(-2.5*dt)));
   const f=this.forces,h=this.speed;ax=Math.sin(this.reference)*f.forward+Math.cos(this.reference)*f.side;az=Math.cos(this.reference)*f.forward-Math.sin(this.reference)*f.side;
   const retained=h>.000001?Math.max(0,1-C.airDrag*dt-f.brake*dt/h):0;this.vx=this.vx*retained+ax*dt;this.vz=this.vz*retained+az*dt;this.heading=angle(this.heading+angle(this.reference-this.heading)*(1-Math.exp(-C.headingResponse*dt)));
  }
  this.previousThrottle=t;this.x+=this.vx*dt;this.z+=this.vz*dt;
  if(this.grounded){const surface=surfaceAt(this.layout,this.x,this.z,this.y+.5),support=surface&&supported(this.layout,this,surface);if(!surface||!support||support.count<3||Math.abs(support.height-this.y)>.65||this.forces.lift>C.gravity+.3){this.grounded=false;this.surfaceId=null;this.groundAge=0;this.flight++;this.emit('takeoff',{from:surface?.id??null,vx:this.vx,vz:this.vz});}else{this.surfaceId=surface.id;this.y=support.height;this.vy=this.vz*(surface.slope??0);}}
  if(!this.grounded){const ay=this.forces.lift-C.gravity;this.y+=this.vy*dt+ay*dt*dt/2;this.vy+=ay*dt;}
  const bounds=footprintBounds(this),bodyTop=this.y+C.height;
  // While clearing a ledge, the unsupported rear overhang must not hit the slab
  // just departed. This grace ends as soon as the body clears its top or bounds.
  if(wasGround&&!this.grounded)this.departureSurface=oldSurface;
  if(this.departureSurface){const slab=this.layout.surfaces.find(s=>s.id===this.departureSurface);if(!slab||!overlaps(bounds,slab)||this.y>topAt(slab,this.x,this.z)+.1)this.departureSurface=null;}
  for(const b of this.layout.colliders??[])if(overlaps(bounds,b)&&bodyTop>b.ymin&&this.y<b.ymax){this.crash('碰到出口结构');return;}
  let landed=null;
  if(!this.grounded&&this.vy<0){for(const surface of this.layout.surfaces){const top=topAt(surface,this.x,this.z),oldTop=topAt(surface,prev.x,prev.z);if(prev.y>=oldTop-.035&&this.y<=top&&inside(surface,this.x,this.z)&&(!landed||top>landed.top))landed={surface,top};}}
  if(landed&&supported(this.layout,this,landed.surface).count<3)landed=null;
  if(landed){const impact=Math.max(0,-this.vy),support=supported(this.layout,this,landed.surface);if(impact>C.crashImpact){this.crash('下降冲击过大');return;}this.y=landed.top;this.vy=0;this.grounded=true;this.surfaceId=landed.surface.id;this.groundAge=0;this.refillAge=0;this.landingCount++;this.lastLanding={time:this.time,surface:this.surfaceId,impact,safe:support.safe,flight:this.flight};if(this.surfaceId in this.visits)this.visits[this.surfaceId]++;this.emit('landing',this.lastLanding);}
  else if(!this.grounded){for(const surface of this.layout.surfaces){if(surface.id===this.departureSurface)continue;const top=topAt(surface,this.x,this.z),bottom=top-surface.depth;if(overlaps(bounds,surface)&&this.y<top-.08&&bodyTop>bottom&&prev.y+C.height>=bottom-.3){this.crash(this.vy>0?'碰到平台底面':'碰到平台侧面');return;}}}
  if(this.grounded){this.groundAge+=dt;const surface=this.layout.surfaces.find(s=>s.id===this.surfaceId)??surfaceAt(this.layout,this.x,this.z,this.y+.5);if(surface){this.surfaceId=surface.id;const support=supported(this.layout,this,surface);if(!lift&&this.forces.cost<.01&&['lift','forward','side','brake'].every(k=>Math.abs(this.forces[k])<.02)){this.refillAge+=dt;if(this.refillAge>=C.refillDelay){const fast=this.layout.refillZones?.some(r=>r.surface===surface.id&&inside(r,this.x,this.z));this.pressure=Math.min(100,this.pressure+(fast?C.fastRecharge:C.recharge)*dt);}}else this.refillAge=0;
   const cp=this.layout.checkpoints?.find(p=>p.surface===surface.id);if(!this.forecast&&cp&&support.safe&&this.groundAge>C.checkpointDelay&&inside(surface,this.x,this.z,2.3)&&this.speed<12)this.checkpoint={...cp,y:topAt(surface,cp.x,cp.z)};
    if(surface.id===this.layout.exit.surface&&this.visits.far>0&&prev.z<this.layout.exit.z&&this.z>=this.layout.exit.z&&this.x>=this.layout.exit.xmin&&this.x<=this.layout.exit.xmax){this.complete=true;this.emit('complete',{visits:{...this.visits}});}
   }}else this.refillAge=0;
  const b=this.layout.bounds;if(this.x<b.xmin||this.x>b.xmax||this.z<b.zmin||this.z>b.zmax||this.y<b.ymin)this.crash('驶出试验场');
  this.pitch=mix(this.pitch,this.grounded?Math.atan(this.vz*(this.layout.surfaces.find(s=>s.id===this.surfaceId)?.slope??0)/Math.max(1,this.speed)):clamp(-t*.12+this.vy*.004,-.2,.2),8,dt);this.roll=mix(this.roll,clamp(-turn*(this.grounded?this.speed*.007:.16),-.22,.22),7,dt);
 }
 predict(){if(this.grounded||this.crashTimer)return null;const g=Object.assign(Object.create(RoadsterSimulation.prototype),this,{forecast:true,input:{...this.input},jets:{...this.jets},forces:{...this.forces},visits:{...this.visits},seen:{...this.seen},events:[]}),trace=[{x:g.x,y:g.y,z:g.z}],start=g.time;for(let i=0;i<C.predictionSeconds/C.step;i++){g.step(C.step);if(i%18===0)trace.push({x:g.x,y:g.y,z:g.z});if(g.crashTimer)return{trace,x:g.x,y:g.y,z:g.z,time:g.time-start,safe:false,reason:g.reason,surface:null,heading:g.heading};if(g.grounded){const surface=g.layout.surfaces.find(s=>s.id===g.surfaceId),safe=!!surface&&supported(g.layout,g,surface).safe;return{trace,x:g.x,y:g.y,z:g.z,time:g.time-start,safe,reason:!safe?'落点靠近边缘':g.lastLanding.impact>C.dangerImpact?'预计下降冲击较大':'',impact:g.lastLanding.impact,surface:g.surfaceId,heading:g.heading,corners:footprint(g)};}}return{trace,x:g.x,y:g.y,z:g.z,time:C.predictionSeconds,safe:false,reason:'尚无安全落点',surface:null,heading:g.heading};}
 snapshot(){return{time:this.time,x:this.x,y:this.y,z:this.z,vx:this.vx,vy:this.vy,vz:this.vz,speed:this.speed,heading:this.heading,pitch:this.pitch,roll:this.roll,reference:this.reference,pressure:this.pressure,grounded:this.grounded,surface:this.surfaceId,input:{...this.input},jets:{...this.jets},forces:{...this.forces},reverse:this.reverse,checkpoint:{...this.checkpoint},visits:{...this.visits},complete:this.complete,crashTimer:this.crashTimer,reason:this.reason,recoveryNotice:this.recoveryNotice,landingCount:this.landingCount,lastLanding:this.lastLanding&&{...this.lastLanding},events:this.events.map(e=>({...e}))};}
}
