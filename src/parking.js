import{PARKING as P}from'./parking-config.js';import{CONFIG as C}from'./config.js';
import{bodyExtents,contactHeight}from'./simulation.js';
const clamp=v=>Math.max(0,Math.min(1,v));
/** OBB projection into the inclined aperture's own plane, including yaw/pitch. */
export function rackClearance(s){
 const r=P.rack,a=r.angle,cu=Math.cos(a),su=Math.sin(a),cp=Math.cos(s.pitch),sp=Math.sin(s.pitch),cr=Math.cos(s.roll),sr=Math.sin(s.roll),cy=Math.cos(s.yaw+s.heading),sy=Math.sin(s.yaw+s.heading);
 const columns=[[cy*cr+sy*sp*sr,cp*sr,-sy*cr+cy*sp*sr],[-cy*sr+sy*sp*cr,cp*cr,sy*sr+cy*sp*cr],[sy*cp,-sp,cy*cp]].map(([x,y,z])=>[x,y-r.slope*z]),dims=[C.carHalfWidth,C.carCenterHeight,C.carHalfLength];
 const u=columns.reduce((n,[x,y],i)=>n+Math.abs(cu*x+su*y)*dims[i],0),v=columns.reduce((n,[x,y],i)=>n+Math.abs(-su*x+cu*y)*dims[i],0),dy=s.y+C.carCenterHeight-(r.y+(s.z-r.z)*r.slope);
 return{u:Math.abs(cu*s.x+su*dy)+u-r.halfWidth,v:Math.abs(-su*s.x+cu*dy)+v-r.halfHeight,outer:Math.abs(cu*s.x+su*dy)-u<=r.outerWidth/2&&Math.abs(-su*s.x+cu*dy)-v<=r.outerHeight/2,extent:{u,v}};
}
export function cartPosition(age){const t=Math.max(0,age-P.cart.fireAt),T=P.cart.flight;return{x:P.cart.x-P.cart.x*t/T,y:P.cart.y+(P.cart.hitY-P.cart.y+.5*C.gravity*T*T)*t/T-.5*C.gravity*t*t,z:P.cart.z+(P.wall.z-P.cart.z)*t/T};}
export class ParkingEscape{
 constructor(sim){this.sim=sim;this.reset();this.environment={hasGround:z=>this.hasGround(z),remaining:()=>Infinity,precisionAt:(x,z)=>this.inPlate(x,z),isLandingSafe:(x,z)=>this.hasGround(z)&&Math.abs(x)<C.roadHalfWidth-C.carHalfWidth&&(!this.wallBroken?z<P.wall.z-C.carHalfLength||z>P.wall.z+4:true),collide:(s,p)=>this.collide(s,p),forecastCollide:(s,p)=>this.collide(s,p,true),onEvent:e=>this.onEvent(e),onCrash:r=>this.onCrash(r),recovery:()=>({z:this.open?P.bridge.end+5:this.localRetry?P.localCheckpoint:P.checkpoint,energy:1})};}
 reset(){this.localRetry=false;this.phase='approach';this.open=false;this.wallBroken=false;this.complete=false;this.triggerAt=null;this.hitAt=null;this.lightAt=null;this.endedAt=null;this.attempt=0;this.rackPassed=false;this.scraped=false;this.ringCrossed=false;this.ringActual=0;this.flight=null;this.apex=0;this.preBufferDown=0;this.reason='';this.lastPress=null;this.pressedFlights=new Set();this.ringFlights=new Set();this.events=[];}
 emit(type,data={}){const e={type,time:this.sim.time,...data};this.events.push(e);if(this.events.length>100)this.events.shift();this.sim.emit(e);}
 inPlate(x,z){return Math.abs(x)<P.plate.coreHalfWidth&&z>=P.plate.coreStart&&z<=P.plate.coreEnd;}
 hasGround(z){return this.open||z<=P.bridge.start||z>=P.bridge.end;}
 onCrash(reason){this.reason=reason;if(this.sim.z>P.rack.z+15)this.localRetry=true;}
 onEvent(e){
  if(e.type==='takeoff'){this.flight=e.flight;this.apex=this.sim.y;this.preBufferDown=0;}
  if(e.type==='buffer')this.preBufferDown=Math.max(this.preBufferDown,-e.vy);
  if(e.type==='recovery'){this.attempt++;if(this.triggerAt===null){this.phase='approach';this.rackPassed=this.localRetry;this.scraped=false;this.ringCrossed=false;this.ringActual=0;this.lightAt=null;}this.reason='';}
  if(e.type==='landing'&&e.grade<3&&!this.open&&this.triggerAt===null&&this.inPlate(e.x,e.z)&&!this.pressedFlights.has(e.flight)){
   this.pressedFlights.add(e.flight);const energy=Math.max(this.preBufferDown**2/2,C.gravity*Math.max(0,this.apex-this.sim.y)),down=Math.cos(e.pitch)*Math.cos(e.roll),heavy=down>=P.plate.wheelsDown&&energy>=P.plate.heavyEnergy;
   this.lastPress={flight:e.flight,energy,preBufferDown:this.preBufferDown,apex:this.apex,grade:e.grade,x:e.x,z:e.z,heavy};
   if(heavy){this.triggerAt=this.sim.time;this.phase='firing';this.emit('parking-heavy',this.lastPress);}
   else{this.lightAt=this.sim.time;this.phase='light';this.reason=down<P.plate.wheelsDown?'轮胎朝下再落':'再重一点';this.emit('parking-light',this.lastPress);}
  }
 }
 update(){const s=this.sim;if(this.complete)return;
  if(!s.grounded){this.apex=Math.max(this.apex,s.y);if(!s.buffer.active)this.preBufferDown=Math.max(this.preBufferDown,-s.vy);}
  if(this.triggerAt!==null){const age=s.time-this.triggerAt;
   if(!this.wallBroken&&age>=P.cart.fireAt){const cart=cartPosition(age);if(cart.z+P.cart.halfDepth>=P.wall.z){this.wallBroken=true;this.hitAt=s.time;this.emit('parking-wall-hit',{cart});}}
   if(this.wallBroken&&!this.open&&age>=P.bridge.locked){this.open=true;this.phase='open';s.predictionAt=s.releasePredictionAt=-99;this.emit('parking-bridge-locked');}
  }
  if(this.phase==='light'&&s.time-this.lightAt>1.1)this.phase='approach';
  if(!this.open&&this.triggerAt===null&&s.z>P.retryAt&&!s.crashTimer){this.reason='维修回环 · 再重落一次';this.localRetry=true;s.recover();this.emit('parking-return');}
  if(this.open&&s.z>=P.exit+P.exitClearance&&s.grounded&&!s.crashTimer){this.complete=true;this.phase='complete';this.endedAt=s.time;s.clearInput();this.emit('parking-exit');}
 }
 collide(s,p,forecast=false){
  if(s.y< -12){s.crash('维修桥尚未锁定');return;}
  const e=bodyExtents(s.pitch,s.roll,s.yaw+s.heading),r=P.rack;
  if(!s.invulnerable&&Math.abs(s.x)<r.baseWidth/2+e.halfX&&s.z+e.halfZ>=r.z-r.depth/2&&p.prevZ-(p.prevHalfZ??e.halfZ)<=r.z+r.depth/2&&Math.min(p.prevY-p.prevContact,s.y-contactHeight(s.pitch,s.roll))<r.baseTop){s.crash('中线机械基座 · 从黄区起飞，或走侧面宽道');return;}
  if(!s.invulnerable&&s.z+e.halfZ>=r.z-r.depth/2&&p.prevZ-(p.prevHalfZ??e.halfZ)<=r.z+r.depth/2){
   const c=rackClearance(s),over=Math.max(c.u,c.v);if(c.outer&&over>r.scrape){s.crash(s.y<5?'停车架挡住中线 · 走侧面宽道或从黄区起飞':'停车架太窄 · 侧滚贴合倾角，或走侧面宽道');return;}
   if(c.outer&&over>0&&!forecast&&!this.scraped){this.scraped=true;s.speed*=.92;this.emit('parking-scrape',{overlap:over});}
  }
  if(!this.wallBroken&&s.z+e.halfZ>=P.wall.z-P.wall.depth/2&&p.prevZ-(p.prevHalfZ??e.halfZ)<=P.wall.z+P.wall.depth/2&&s.y-contactHeight(s.pitch,s.roll)<P.wall.top){s.crash('封路墙仍锁着 · 在黄压板重落地');return;}
  if(forecast)return;
  if(!this.rackPassed&&s.z-e.halfZ>r.z+r.depth/2){this.rackPassed=true;this.phase=this.triggerAt===null?'to-plate':this.phase;this.emit('parking-rack-clear',{route:Math.abs(s.x)>=r.bypass?'wide':'shortcut'});}
  const ring=P.ring;if(!s.grounded&&!this.ringFlights.has(s.flightId)&&p.prevZ<=ring.z&&s.z>ring.z&&Math.hypot(s.x-ring.x,s.y+C.carCenterHeight-ring.y)<ring.radius){this.ringFlights.add(s.flightId);this.ringCrossed=true;const actual=s.receiveSupply('pressure-ring',ring.points,ring.id+':'+s.flightId,{kind:'ring',origin:{...ring}});this.ringActual+=actual;this.emit('parking-ring',{actual});}
 }
 get hint(){const s=this.sim;if(this.complete)return'';if(s.z<0)return'飞过停车架，重压黄板弹车开路';if(s.crashTimer)return this.reason;if(this.open)return'新路线已锁定 · 继续向前';if(this.triggerAt!==null)return'';if(this.lightAt!==null&&s.time-this.lightAt<2)return this.reason;if(s.grounded&&this.localRetry&&s.z<=P.localLaunch.end)return s.z<P.localLaunch.start?'维修黄区在前方':'推进约0.7秒，再落黄板';if(s.grounded&&s.z>200)return'前方维修回环 · 再起飞重落';if(!s.grounded)return this.rackPassed?'松手收势 · 落在黄压板':'贴合斜架 · 侧面也能过';return s.z<P.launch.start?'选中间斜架或侧面宽道':s.z<=P.launch.end?'推进约1秒':'错过黄区 · 前方可快速重试';}
 snapshot(){return structuredClone({localRetry:this.localRetry,phase:this.phase,open:this.open,wallBroken:this.wallBroken,complete:this.complete,triggerAt:this.triggerAt,hitAt:this.hitAt,lightAt:this.lightAt,endedAt:this.endedAt,attempt:this.attempt,rackPassed:this.rackPassed,scraped:this.scraped,ringCrossed:this.ringCrossed,ringActual:this.ringActual,apex:this.apex,preBufferDown:this.preBufferDown,reason:this.reason,lastPress:this.lastPress,events:this.events});}
}
