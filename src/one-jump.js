import{ONE_JUMP as J,constructionBoxes,fleetEnd}from'./one-jump-config.js';
import{CONFIG as C}from'./config.js';
import{bodyExtents,contactHeight}from'./simulation.js';
export class OneJump{
 constructor(sim){this.sim=sim;this.reset();this.environment={hasGround:()=>true,remaining:()=>Infinity,precisionAt:(x,z)=>Math.abs(x)<J.landing.halfWidth&&z>J.landing.start&&z<J.landing.end,isLandingSafe:(x,z)=>Math.abs(x)<C.roadHalfWidth-C.carHalfWidth&&!constructionBoxes.some(b=>Math.abs(z-b.z)<b.depth/2+C.carHalfLength&&Math.abs(x-b.x)<b.width/2+C.carHalfWidth),collide:(s,p)=>this.collide(s,p),forecastCollide:(s,p)=>this.collide(s,p,true),onEvent:e=>this.onEvent(e),onCrash:reason=>{this.state.stage='crash';this.state.reason=reason;},recovery:()=>({z:0,energy:1})};}
 reset(attempt=0){this.state={attempt,stage:'approach',flight:null,cleared:false,ringCrossed:false,ringActual:0,actualSupply:0,landing:null,result:null,reason:null};}
 onEvent(e){const q=this.state;if(e.type==='recovery'){this.reset(q.attempt+1);return;}
  if(e.type==='takeoff'){Object.assign(q,{stage:'flight',flight:e.flight,startZ:this.sim.z,cleared:false,ringCrossed:false,ringActual:0,actualSupply:0,landing:null,result:null});}
  if(e.type==='supply'&&q.flight===this.sim.flightId){q.actualSupply+=e.amount;if(e.source==='pressure-ring')q.ringActual+=e.amount;}
  if(e.type==='landing'&&q.flight===e.flight){q.landing={...e};q.stage=e.grade===3?'crash':'landed';q.result={complete:e.grade<3&&q.cleared&&q.ringCrossed&&q.actualSupply>0&&this.sim.z>J.landing.start&&this.sim.z<J.landing.end&&Math.abs(this.sim.x)<J.landing.halfWidth,grade:e.grade,at:e.time,actualSupply:q.actualSupply};}
 }
 collide(s,p,forecast=false){
  const e=bodyExtents(s.pitch,s.roll,s.yaw+s.heading),bottom=Math.min(p.prevY-p.prevContact,s.y-contactHeight(s.pitch,s.roll)),top=Math.max(p.prevY+2*C.carCenterHeight+p.prevContact,s.y+2*C.carCenterHeight+contactHeight(s.pitch,s.roll)),minX=Math.min(p.prevX??s.x,s.x)-e.halfX,maxX=Math.max(p.prevX??s.x,s.x)+e.halfX;
  if(!s.invulnerable)for(const b of constructionBoxes)if(p.prevZ-(p.prevHalfZ??e.halfZ)<=b.z+b.depth/2&&s.z+e.halfZ>=b.z-b.depth/2&&minX<b.x+b.width/2&&maxX>b.x-b.width/2&&bottom<b.top&&top>b.bottom){s.crash('碰到施工车辆 · R或按钮立即重试');return;}
  if(forecast)return;
  const q=this.state;
  if(!q.cleared&&!s.grounded&&q.flight===s.flightId&&p.prevZ<=fleetEnd+3&&s.z-e.halfZ>fleetEnd){q.cleared=true;s.score.addObstacle({time:s.time,label:'越过施工车阵'});s.emit({type:'practice-clear',time:s.time});}
  const r=J.ring;if(!q.ringCrossed&&!s.grounded&&q.flight===s.flightId&&p.prevZ<=r.z&&s.z>r.z&&Math.hypot(s.x-r.x,s.y+C.carCenterHeight-r.y)<r.radius-.9){q.ringCrossed=true;s.receiveSupply('pressure-ring',r.points,r.id+':'+q.attempt,{kind:'ring',origin:{x:r.x,y:r.y,z:r.z,radius:r.radius}});s.emit({type:'practice-ring',time:s.time});}
 }
 snapshot(){return structuredClone(this.state);}
}
