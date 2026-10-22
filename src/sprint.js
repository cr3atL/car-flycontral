import {SPRINT as P} from './sprint-config.js';
import {CONFIG as C} from './config.js';
import {bodyExtents,contactHeight} from './simulation.js';
const inPad=(d,x,z)=>Math.abs(x)<d.pad.halfWidth&&z>d.pad.start&&z<d.pad.end;
export class Sprint{
 constructor(sim){this.sim=sim;this.reset();this.environment={hasGround:z=>!(z>P.gap.start&&z<P.gap.end),remaining:()=>Infinity,precisionAt:(x,z)=>inPad(P.sections[this.current],x,z),isLandingSafe:(x,z)=>this.safe(x,z),collide:(s,p)=>this.collide(s,p),forecastCollide:(s,p)=>this.collide(s,p,true),onEvent:e=>this.onEvent(e),onCrash:r=>this.onCrash(r),recovery:()=>({z:P.sections[this.current].retryZ,energy:1}),motorAcceleration:s=>this.motorAcceleration(s)};}
 reset(){this.current=0;this.attempt=0;this.nearSeen=new Set();this.continuous=true;this.complete=false;this.endedAt=null;this.reason=null;this.sections=P.sections.map(d=>({id:d.id,cleared:false,clearedFlight:null,bankedObstacle:false,completed:false,landing:null,rewarded:false,attempt:0}));this.ringCrossed=false;this.ringActual=0;this.pending=null;this.motor=null;this.lastAcceleration=0;this.events=[];this.finalLanding=null;}
 emit(type,values={}){const e={type,time:this.sim.time,section:this.current+1,...values};this.events.push(e);if(this.events.length>80)this.events.shift();this.sim.emit(e);}
 safe(x,z){return Math.abs(x)<C.roadHalfWidth-C.carHalfWidth&&[-C.carHalfLength,0,C.carHalfLength].every(d=>this.environment.hasGround(z+d))&&!P.boxes.some(b=>b.bottom<1.5&&Math.abs(x-b.x)<b.width/2+C.carHalfWidth&&Math.abs(z-b.z)<b.depth/2+C.carHalfLength);}
 onCrash(reason){this.continuous=false;this.reason=reason;this.pending=this.motor=null;this.finalLanding=null;this.lastAcceleration=0;this.sections[this.current].completed=false;this.sections[this.current].rewarded=false;}
 onEvent(e){const s=this.sim,q=this.sections[this.current],d=P.sections[this.current];
  if(e.type==='takeoff'){this.pending=this.motor=null;this.lastAcceleration=0;}
  if(e.type==='recovery'){this.attempt++;q.attempt++;q.cleared=false;q.clearedFlight=null;q.landing=null;this.nearSeen.clear();s.supplyNotice=null;this.reason=null;this.ringCrossed=false;this.ringActual=0;this.pending=this.motor=null;s.predictionAt=-99;}
  if(e.type==='supply'&&e.source==='pressure-ring')this.ringActual+=e.amount;
  if(e.type==='landing'&&e.grade<3&&this.current===2&&q.clearedFlight===e.flight)this.finalLanding=e.time;
  if(e.type==='landing'&&e.grade<3&&q.cleared&&q.clearedFlight===e.flight&&inPad(d,e.x,e.z)){
   q.completed=true;q.landing={...e};this.emit('sprint-section-landed',{flight:e.flight,grade:e.grade});
   if(e.airTime>=.8&&e.grade===0&&!q.rewarded)this.pending={section:this.current,flight:e.flight,landing:e.time,stable:0};
   if(this.current===2)this.finalLanding=e.time;
  }
 }
 update(dt){const s=this.sim;if(this.complete||s.crashTimer)return;
  if(this.pending){const p=this.pending;
   if(!s.grounded||s.flightId!==p.flight||s.launchArmed){this.pending=null;}
   else{p.stable+=dt;
    if(s.time-p.landing>=P.motor.delay-1e-8){if(p.stable>=P.motor.stable-1e-8){this.motor={...p,start:s.time,end:s.time+P.motor.duration};this.sections[p.section].rewarded=true;this.emit('sprint-motor-start',{flight:p.flight,landing:p.landing});}this.pending=null;}
   }
  }
  if(this.motor&&(!s.grounded||s.launchArmed||s.time>=this.motor.end)){this.emit('sprint-motor-end',{flight:this.motor.flight});this.motor=null;this.lastAcceleration=0;}
  const q=this.sections[this.current];if(this.current<2&&s.z>=P.sections[this.current+1].start){if(!q.completed)this.continuous=false;this.current++;s.predictionAt=-99;}
  if(this.finalLanding!==null&&s.time>=this.finalLanding+2&&s.z>=P.end){this.complete=true;this.continuous=this.continuous&&this.sections.every(q=>q.completed);this.endedAt=s.time;this.pending=this.motor=null;this.lastAcceleration=0;this.emit('sprint-complete',{continuous:this.continuous&&this.sections.every(q=>q.completed),precision:this.sections.filter(q=>q.landing?.grade===0).length});}
 }
 motorAcceleration(s){this.lastAcceleration=0;if(!this.motor||!s.grounded||s.crashTimer||s.launchArmed||s.time>=this.motor.end)return 0;const unload=Math.min(1,(this.motor.end-s.time)/P.motor.unload),target=C.cruise*P.motor.target;this.lastAcceleration=Math.max(0,Math.min(P.motor.acceleration,(target-s.speed)*6))*unload;return this.lastAcceleration;}
 collide(s,p,forecast=false){const e=bodyExtents(s.pitch,s.roll,s.yaw+s.heading),bottom=Math.min(p.prevY-p.prevContact,s.y-contactHeight(s.pitch,s.roll)),top=Math.max(p.prevY+C.carCenterHeight+(p.prevHalfY??e.halfY),s.y+C.carCenterHeight+e.halfY),minX=Math.min(p.prevX-(p.prevHalfX??e.halfX),s.x-e.halfX),maxX=Math.max(p.prevX+(p.prevHalfX??e.halfX),s.x+e.halfX);
  if(!s.invulnerable)for(const b of P.boxes)if(p.prevZ-(p.prevHalfZ??e.halfZ)<=b.z+b.depth/2&&s.z+e.halfZ>=b.z-b.depth/2&&minX<b.x+b.width/2&&maxX>b.x-b.width/2&&bottom<b.top&&top>b.bottom){s.crash(b.part==='roof'?'碰到检修架横梁':b.part==='pillar'?'碰到检修架立柱':'碰到施工障碍');return;}
  if(!forecast&&!s.grounded)for(const b of P.boxes){const key=b.truck?'fleet':b.id,over=p.prevZ-(p.prevHalfZ??e.halfZ)<=b.z+b.depth/2&&s.z+e.halfZ>=b.z-b.depth/2&&minX<b.x+b.width/2&&maxX>b.x-b.width/2,clearance=bottom>=b.top?bottom-b.top:b.bottom>=top?b.bottom-top:Infinity;if(over&&clearance>=0&&clearance<1.2&&!this.nearSeen.has(key)){this.nearSeen.add(key);this.emit('sprint-near-pass',{structure:key,clearance});}}
  if(s.y<-15){s.crash('未到达断桥远端平台');return;}
  if(!s.grounded&&s.z+e.halfZ>P.gap.end&&s.z-e.halfZ<P.gap.end&&bottom<-.05){s.crash('碰到远端平台边缘');return;}
  if(forecast)return;
  const q=this.sections[this.current],d=P.sections[this.current];if(!q.cleared&&!s.grounded&&s.z-e.halfZ>d.obstacleEnd&&p.prevZ<=d.obstacleEnd+5){q.cleared=true;q.clearedFlight=s.flightId;if(!q.bankedObstacle){q.bankedObstacle=true;s.score.addObstacle({time:s.time,label:d.name+'通过'});}this.emit('sprint-clear');}
  const r=P.ring;if(!this.ringCrossed&&!s.grounded&&p.prevZ<=r.z&&s.z>r.z&&Math.hypot(s.x-r.x,s.y+C.carCenterHeight-r.y)<r.radius-.9){this.ringCrossed=true;s.receiveSupply('pressure-ring',r.points,r.id+':'+this.attempt,{kind:'ring',origin:{x:r.x,y:r.y,z:r.z,radius:r.radius}});this.emit('sprint-ring');}
 }
 snapshot(){return structuredClone({current:this.current,attempt:this.attempt,continuous:this.continuous,complete:this.complete,endedAt:this.endedAt,reason:this.reason,sections:this.sections,ringCrossed:this.ringCrossed,ringActual:this.ringActual,pending:this.pending,motor:this.motor,lastAcceleration:this.lastAcceleration,events:this.events,finalLanding:this.finalLanding});}
}
