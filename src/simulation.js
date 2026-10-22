import{assessLanding}from'./landing-model.js';
export{landingGrade}from'./landing-model.js';
import { CONFIG as C, STUNTS } from './config.js';
import { Score } from './scoring.js';
import { nearbySupplies, SUPPLY } from './supply-config.js';
const TAU = Math.PI * 2, axes = ['pitch', 'roll', 'yaw'];
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const approach = (v, target, response, dt) => v + (target - v) * (1 - Math.exp(-response * dt));
export const wrapAngle = a => Math.atan2(Math.sin(a), Math.cos(a));
export function secondsToGround(y, vy) { return (vy + Math.sqrt(vy * vy + 2 * C.gravity * Math.max(0, y))) / C.gravity; }
export function contactHeight(pitch, roll) { return Math.abs(Math.cos(pitch) * Math.sin(roll)) * C.carHalfWidth + Math.abs(Math.cos(pitch) * Math.cos(roll)) * C.carCenterHeight + Math.abs(Math.sin(pitch)) * C.carHalfLength - C.carCenterHeight; }
/** OBB extents for renderer order Ry(yaw)*Rx(pitch)*Rz(roll). */
export function bodyExtents(pitch,roll,yaw=0){
 const cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll),cy=Math.cos(yaw),sy=Math.sin(yaw),w=C.carHalfWidth,h=C.carCenterHeight,l=C.carHalfLength;
 return{halfX:Math.abs(cy*cr+sy*sp*sr)*w+Math.abs(-cy*sr+sy*sp*cr)*h+Math.abs(sy*cp)*l,halfY:Math.abs(cp*sr)*w+Math.abs(cp*cr)*h+Math.abs(sp)*l,halfZ:Math.abs(-sy*cr+cy*sp*sr)*w+Math.abs(sy*sr+cy*sp*cr)*h+Math.abs(cy*cp)*l};
}
export function nearbyWalls(z) { const lap = Math.floor(z / C.trackPeriod); return [lap - 1, lap, lap + 1].flatMap(l => C.wallOffsets.map((offset, i) => ({ id: `${l}:${i}`, z: l * C.trackPeriod + offset }))); }
const axisState = () => ({ omega: 0, targetOmega: 0, active: false, direction: 0, command: 0, mode: 'idle', releasedAt: -99, pressedAt: 0, drivenTime: 0, pressAngle: 0, spent: 0, tracker: { direction: 0, progress: 0, retreat: 0, eligible: false } });
const pulseForce = (elapsed, duration, power) => elapsed >= 0 && elapsed < duration ? power * clamp(elapsed / C.pulseRamp, 0, 1) * clamp((duration - elapsed) / C.pulseRamp, 0, 1) : 0;
/** Independent descent brake. Returns force only; never sets velocity or pose. */
export function bufferForce(height, vy) {
  if (vy >= 0) return 0;
  const down = -vy, desired = Math.sqrt(C.bufferTouchSpeed ** 2 + 2 * C.bufferBrake * Math.max(0, height - C.bufferMargin));
  const feed = C.bufferBrake * clamp(height / C.bufferMargin, 0, 1);
  const braking = clamp((down - desired) * C.bufferResponse + feed, 0, Math.min(C.bufferBrake, Math.max(0, (down - C.bufferTouchSpeed) * C.bufferResponse)));
  return Math.max(0, C.gravity + C.verticalDrag * vy + braking);
}
export class Simulation {
  constructor() { this.assist = true; this.reset(); }
  reset() {
    Object.assign(this, { x: 0, y: 0, z: 0, vx: 0, vy: 0, speed: 0, heading: 0, energy: 1, pitch: 0, roll: 0, yaw: 0, grounded: true, thrusting: false, time: 0, airTime: 0, lastAirTime: 0, landingCount: 0, crashes: 0, crashTimer: 0, invulnerable: 0, heavyTimer: 0, popup: null, lastLanding: null, pulseElapsed: 0, pulseDuration: 0, pulsePower: 0, cooldown: 0, launchArmed: false, boostWasDown: false, boostRequested: false, holdAuthorized: false, flightId: 0, airSupplyUsed: 0, supplyCounts: {}, supplySequence:0,lastActionEnd: -99, notice: null, supplyNotice: null, settledFlight: true });
    this.attitude = { pitch: axisState(), roll: axisState(), yaw: axisState() }; this.buffer = { armed: false, active: false, startedAt: null };
    this.jets = { up: 0, forward: 0, lateral: 0, pitch: 0, roll: 0, yaw: 0 }; this.forces = { ...this.jets, normal: C.gravity, netVertical: 0, mainUp: 0, bufferUp: 0, reserveTorque: 0, gasRate: 0, authority: 1, flare: false };
    this.score = new Score(); this.events = []; this.ledger = []; this.passedWalls = new Set(); this.claimedSupplies = new Set(); this.input = { steer: 0, boost: false, pitch: 0, roll: 0, yaw: 0 };
    this.prediction = { time: 0, z: 0, x: 0, safe: true }; this.predictionAt = -99;this.releasePrediction={...this.prediction,assessment:null};this.releasePredictionAt=-99; this.guidance = '收动作 · 准备落地';
  }
  get pressure() { return this.energy; }
  get mainPressure() { return this.energy * 100; }
  get maneuverActive() { return axes.some(n=>this.attitude[n].active); }
  get stuntLabel() { return axes.filter(n=>Math.abs(this.attitude[n].omega)>.1||this.attitude[n].active).map(n=>(n==='roll'?'侧滚':n==='yaw'?'平转':'翻转')+' '+({driving:'持续',braking:'制动',leveling:'缓回正',idle:'滑行'}[this.attitude[n].mode]??'接地')).join(' / '); }
  emit(event) { this.events.push(event); if (this.events.length > 120) this.events.shift(); this.environment?.onEvent?.(event); }
  account(kind, requested, actual, source) {
    const continuous = kind === 'ground' || kind === 'cost' && (['sustain', 'micro'].includes(source)||source.startsWith('rotation:'));
    const previous = continuous && this.ledger.slice(-4).find(e => e.kind === kind && e.source === source && e.flight === this.flightId && Math.floor(e.time * 10) === Math.floor(this.time * 10));
    if (previous) { previous.requested += requested; previous.actual += actual; previous.through = this.time; previous.main = this.mainPressure; }
    else this.ledger.push({ time: this.time, through: this.time, flight: this.flightId, kind, source, requested, actual, main: this.mainPressure, supplied: this.airSupplyUsed });
    if (this.ledger.length > 320) this.ledger.shift();
  }
  spend(points, source) { if (this.mainPressure + 1e-8 < points) return false; this.energy = Math.max(0, this.energy - points / 100); this.account('cost', points, points, source); return true; }
  receiveSupply(source, requested, id = null, observation = {}) {
    if (this.grounded || this.settledFlight || (id !== null && this.claimedSupplies.has(id))) return 0;
    if (id !== null) { this.claimedSupplies.add(id); if (this.claimedSupplies.size > 80) this.claimedSupplies = new Set([...this.claimedSupplies].slice(-40)); }
    const actual = Math.max(0, Math.min(requested, 100 - this.mainPressure, C.flightSupplyCap - this.airSupplyUsed));
    this.energy = Math.min(1, this.energy + actual / 100); this.airSupplyUsed += actual; this.account('supply', requested, actual, source);
    this.supplyNotice = { amount: actual, source, at: this.time }; this.emit({ type: 'supply', amount: actual, requested, source, id, time: this.time, sequence:++this.supplySequence, flight:this.flightId,kind:observation.kind??(source==='pressure-ring'?'ring':'local'),position:{x:this.x,y:this.y+C.carCenterHeight,z:this.z},origin:observation.origin?{...observation.origin}:{x:this.x,y:this.y+C.carCenterHeight,z:this.z,radius:1.6} }); return actual;
  }
  notify(label, detail = '', kind = 'info', amount) { this.popup = { label, detail, kind, amount, at: this.time }; }
  explain(reason) { this.notice = { text: reason, at: this.time }; return false; }
  clearInput({preservePulse=false}={}){
    this.input={steer:0,boost:false,pitch:0,roll:0,yaw:0};this.boostWasDown=this.boostRequested=false;this.holdAuthorized=false;
    if(!preservePulse){this.pulseDuration=0;this.launchArmed=false;}
  }
  queueBoostPress(){this.boostRequested=true;}
  beginFlight() {
    this.grounded = false; this.airTime = 0; this.flightId++; this.settledFlight = false; this.airSupplyUsed = 0; this.supplyCounts = {}; this.score.clearChain(); this.buffer = { armed: true, active: false, startedAt: null }; this.launchArmed = false; this.predictionAt = -99;
    for(const name of axes)this.attitude[name].tracker={direction:0,progress:0,retreat:0,eligible:false};this.prediction=this.predictLanding();this.predictionAt=this.time;this.emit({ type: 'takeoff', flight: this.flightId, time: this.time });
  }
  predictLanding() {
    if (this.grounded) return { time: 0, z: this.z, x: this.x, safe: this.hasGround(this.z) };
    // Release-now forecast mirrors the physical integrator, including residual jet
    // force. Ignoring that force shortened high-flight forecasts by ~15 metres.
    // This bounded solver is cached for 75 ms, never run once per physics step.
    const dt=C.step, solve=(allowBuffer, nominalSafe=true)=>{
      let y=this.y,vy=this.vy,z=this.z,speed=this.speed,x=this.x,vx=this.vx,up=this.jets.up,forward=this.jets.forward,lateral=this.jets.lateral,active=this.buffer.active;
      for(let i=0;i<Math.ceil(40/dt);i++){
        let paid=active?0:pulseForce(this.pulseElapsed+i*dt,this.pulseDuration,this.pulsePower);
        const need=Math.max(0,(vy*vy-C.bufferTouchSpeed**2)/(2*C.bufferBrake));
        if(allowBuffer&&!active&&this.buffer.armed&&nominalSafe&&vy<-C.bufferTouchSpeed-.1&&y<=need+C.bufferMargin)active=true;
        if(active)paid=0;
        up=active?bufferForce(Math.max(0,y),vy):approach(up,paid,C.jetResponse,dt);
        forward=approach(forward,paid>0?1.2:0,C.jetResponse,dt);lateral=approach(lateral,0,C.jetResponse,dt);
        speed=Math.max(0,speed+(forward-speed*C.airForwardDrag)*dt);z+=speed*dt;
        const ax=lateral-vx*C.airDrag;x+=vx*dt+ax*dt*dt/2;vx+=ax*dt;
        const ay=up-C.gravity-C.verticalDrag*vy;y+=vy*dt+ay*dt*dt/2;vy+=ay*dt;
        if(y<=0&&vy<0)return{time:(i+1)*dt,z,x,buffered:active};
      }
      return{time:40,z,x,buffered:active};
    };
    const nominal=solve(false), nominalSafe=this.hasGround(nominal.z),p=solve(true,nominalSafe);
    // Check the complete wheel footprint rather than painting a safe target at
    // a platform edge. The extra temporal margin is used only for race gating.
    p.safe=nominalSafe&&[-C.carHalfLength,0,C.carHalfLength].every(d=>this.hasGround(p.z+d))&&Math.abs(p.x)<=C.roadHalfWidth-C.carHalfWidth&&(this.environment?.isLandingSafe?.(p.x,p.z)!==false);
    return p;
  }
  /** Read-only release-now projection. It never supplies the control/buffer clock. */
  predictReleaseLanding(){
    if(this.grounded)return{time:0,x:this.x,z:this.z,safe:this.hasGround(this.z),assessment:null};
    const start=this.time,trajectory=this.predictLanding(),g=Object.assign(Object.create(Simulation.prototype),this);
    g._forecastOnly=true;g.attitude=structuredClone(this.attitude);g.jets={...this.jets};g.forces={...this.forces};g.buffer={...this.buffer};g.input={boost:false,steer:0,pitch:0,roll:0,yaw:0};g.boostRequested=false;g.holdAuthorized=false;g.boostWasDown=false;g.events=[];g.ledger=[];g.passedWalls=new Set();g.claimedSupplies=new Set();g.supplyCounts={...this.supplyCounts};g.score={pending:0,addObstacle(){}};
    g.observeTurn=g.account=g.emit=g.notify=g.explain=g.receiveSupply=()=>{};
    g.prediction={...trajectory};g.predictionAt=start;g.predictLanding=()=>({...trajectory,time:Math.max(0,trajectory.time-(g.time-start))});
    g.environment={hasGround:z=>this.hasGround(z),isLandingSafe:(x,z)=>this.environment?.isLandingSafe?.(x,z),collide:this.environment?.forecastCollide?(s,p)=>this.environment.forecastCollide(s,p):undefined};
    let sample=null,hazard=null;g.crash=reason=>{hazard=reason;g.crashTimer=1;};
    const contact=impact=>{const safe=[-C.carHalfLength,0,C.carHalfLength].every(d=>this.hasGround(g.z+d))&&Math.abs(g.x)<=C.roadHalfWidth-bodyExtents(g.pitch,g.roll,g.yaw+g.heading).halfX&&this.environment?.isLandingSafe?.(g.x,g.z)!==false;return{time:g.time-start,x:g.x,z:g.z,y:g.y,buffered:g.buffer.active,safe,assessment:assessLanding({pitch:g.pitch,roll:g.roll,yaw:g.yaw+g.heading,omega:Object.fromEntries(axes.map(n=>[n,g.attitude[n].omega])),impact,safe}),padHit:this.environment?.precisionAt?.(g.x,g.z)===true};};
    g.land=impact=>{sample=contact(impact);g.grounded=true;};
    for(let i=0;i<Math.ceil(40/C.step);i++){
      const previous=contactHeight(g.pitch,g.roll);g.step(C.step);
      if(sample)return sample;
      if(hazard){const p=contact(Math.max(0,-g.vy));p.safe=false;p.hazard=hazard;p.assessment=assessLanding({...p.assessment,pitch:g.pitch,roll:g.roll,yaw:g.yaw+g.heading,impact:p.assessment.impact,safe:false});return p;}
      if(g.y<=contactHeight(g.pitch,g.roll)&&g.vy<0&&!this.hasGround(g.z)){const p=contact((contactHeight(g.pitch,g.roll)-previous)/C.step-g.vy);p.safe=false;p.assessment=assessLanding({pitch:g.pitch,roll:g.roll,yaw:g.yaw+g.heading,omega:p.assessment.omega,impact:p.assessment.impact,safe:false});return p;}
    }
    return{time:40,x:g.x,z:g.z,safe:false,assessment:assessLanding({safe:false})};
  }
  hasGround(z) { return this.environment?.hasGround?.(z) !== false; }
  /** Player torque, passive braking and gentle late-flight leveling are distinct. */
  controlRotation(dt) {
    const proposals={};let required=0;
    for(const name of axes){
      const a=this.attitude[name],command=clamp(this.input[name]||0,-1,1),held=Math.abs(command)>.015;
      if(a.command===0&&held){a.pressedAt=this.time;a.pressAngle=this[name];a.drivenTime=0;}
      if(a.command!==0&&!held){a.releasedAt=this.time;if(a.drivenTime>0)this.emit({type:'rotation-release',axis:name,duration:this.time-a.pressedAt,drivenTime:a.drivenTime,delta:this[name]-a.pressAngle,time:this.time});}
      a.command=held?command:0;a.active=false;
      const drive=!this.grounded&&held&&this.mainPressure>1e-7;
      const landingSoon=this.vy<0&&this.prediction.time-(this.time-this.predictionAt)<C.levelWindow;
      const level=!this.grounded&&!held&&this.assist&&this.time-a.releasedAt>C.levelDelay&&landingSoon&&(Math.abs(a.omega)<C.levelEntrySpeed||a.mode==='leveling');
      let target=0,mode='idle';
      if(drive){
        a.targetOmega=command*C.angularSpeed;target=clamp((a.targetOmega-a.omega)*C.driveResponse,-C.angularAcceleration,C.angularAcceleration);
        if(this.vy>0&&this.y<.65)target*=.3+.7*clamp(this.y/.65,0,1);
        mode='driving';a.drivenTime+=dt;this.lastActionEnd=this.time;
      }else if(level&&(Math.abs(wrapAngle(this[name]))>.008||Math.abs(a.omega)>.04)){
        a.targetOmega=clamp(-wrapAngle(this[name])*C.levelResponse,-C.levelSpeed,C.levelSpeed);
        target=clamp((a.targetOmega-a.omega)*C.levelDamping,-C.levelAcceleration,C.levelAcceleration);mode='leveling';
      }else{
        a.targetOmega=0;target=clamp(-a.omega*C.brakeResponse,-C.brakeAcceleration,C.brakeAcceleration);
        mode=this.grounded?'ground':Math.abs(a.omega)>.04?'braking':'idle';
      }
      let jet=approach(this.jets[name],target,C.jetResponse,dt);
      // Braking reserve only removes kinetic energy; it cannot reverse the car
      // or sustain a held input after the main tank empties.
      if(!drive&&!level&&jet*a.omega>0)jet=0;
      if(this.grounded)jet=0;
      proposals[name]={jet,drive,mode};if(drive)required+=Math.abs(jet)*C.rotationGas[name]*dt;
    }
    const ratio=required?Math.min(1,this.mainPressure/required):1;
    for(const name of axes){
      const a=this.attitude[name],p=proposals[name];this.jets[name]=p.jet*(p.drive?ratio:1);
      if(p.drive){const cost=Math.abs(this.jets[name])*C.rotationGas[name]*dt;this.energy=Math.max(0,this.energy-cost/100);if(cost)this.account('cost',cost,cost,'rotation:'+name);a.active=ratio>0;a.spent+=cost;}
      a.mode=p.mode;a.direction=Math.sign(a.command);
      if(p.mode==='leveling'||p.mode==='ground')a.tracker={direction:0,progress:0,retreat:0,eligible:false};
    }
    return required*ratio/dt;
  }
  observeTurn(name,before){
    const a=this.attitude[name],delta=this[name]-before,sign=Math.sign(delta),tracker=a.tracker;
    if(!sign||!['driving','braking','idle'].includes(a.mode))return;
    const driven=a.active&&Math.sign(a.command)===sign;
    if(!tracker.eligible){
      if(!driven)return;
      Object.assign(tracker,{direction:sign,progress:0,retreat:0,eligible:true});
    }
    const advance=tracker.direction*delta;
    tracker.progress+=advance;
    tracker.retreat=Math.max(0,(tracker.retreat??0)-advance);
    // Net signed angle prevents tiny braking noise and partial backtracking
    // from adding fake travel. A genuine driven reversal starts at its pivot.
    if(tracker.retreat>C.turnReverseTolerance){
      if(driven&&sign!==tracker.direction)Object.assign(tracker,{direction:sign,progress:tracker.retreat,retreat:0});
      else {tracker.eligible=false;tracker.progress=0;return;}
    }
    while(tracker.progress>=TAU){
      tracker.progress-=TAU;
      const direction=tracker.direction,key=name==='roll'?(direction>0?'left':'right'):name==='yaw'?(direction<0?'yawLeft':'yawRight'):(direction>0?'front':'back'),def=STUNTS[key],count=this.supplyCounts[def.category]??0;
      this.supplyCounts[def.category]=count+1;this.score.complete(def,{time:this.time});
      this.emit({type:'stunt',name:key,axis:name,angle:this[name],progress:TAU,omega:a.omega,time:this.time,source:a.mode==='driving'?'player-drive':'braking-inertia'});
      this.receiveSupply('stunt:'+def.category,C.supplyValues[Math.min(2,count)]);
      this.notify(def.label+'完成','真实转角计分 · 松手会收势','stunt');
    }
  }
  crash(reason, context) {
    if (this.crashTimer > 0) return; this.environment?.onCrash?.(reason, context); this.crashes++; this.crashTimer = C.crashRecovery; this.score.cancel({ time: this.time }); this.clearInput(); this.buffer.armed = this.buffer.active = false; this.settledFlight = true; this.notify('撞毁 · 连击中断', reason, 'crash'); this.emit({ type: 'crash', reason, time: this.time });
  }
  recover() {
    const r = this.environment?.recovery?.(this); this.z = r?.z ?? (Math.floor(this.z / C.trackPeriod) + 1) * C.trackPeriod;
    this.x = this.y = this.vx = this.vy = this.pitch = this.roll = this.yaw = this.heading = 0; this.attitude = { pitch: axisState(), roll: axisState(), yaw: axisState() }; for (const k of Object.keys(this.jets)) this.jets[k] = 0;
    this.grounded = true; this.speed = C.recoverySpeed; this.energy = r?.energy ?? C.recoveryEnergy; this.invulnerable = .5; this.airTime = 0; this.clearInput(); this.buffer = { armed: false, active: false, startedAt: null }; this.settledFlight = true; this.emit({ type: 'recovery', time: this.time });
  }
  land(impact) {
    if (this.grounded || this.settledFlight) return;
    const assessment=assessLanding({pitch:this.pitch,roll:this.roll,yaw:this.yaw+this.heading,omega:Object.fromEntries(axes.map(n=>[n,this.attitude[n].omega])),impact}),{grade,angle,headingError}=assessment;
    const padHit=this.environment?.precisionAt?.(this.x,this.z)===true;
    const labels = ['精准落地', '稳定落地', '重落地', '撞毁']; this.landingCount++; this.lastAirTime = this.airTime;
    this.lastLanding = { x:this.x,z:this.z,speed:this.speed,grade,assessment,reason:assessment.reason,padHit, label: labels[grade], angle, impact, contactHeight: contactHeight(this.pitch, this.roll), airTime: this.airTime, time: this.time, pitch: this.pitch, roll: this.roll, yaw: this.yaw, headingError, omegaYaw: this.attitude.yaw.omega, omegaPitch: this.attitude.pitch.omega, omegaRoll: this.attitude.roll.omega, pressure: this.pressure, buffered: this.buffer.active, flight: this.flightId };
    this.emit({ type: 'landing', ...this.lastLanding }); this.grounded = true; this.airTime = 0; this.settledFlight = true; this.buffer.armed = false; this.buffer.active = false; this.pulseDuration = 0; this.launchArmed = false; for (const a of Object.values(this.attitude)) a.active = false;
    // Physical momentum is untouched. Springs and tyre torques act on later steps.
    if (grade === 3) { this.crash(assessment.reason??'姿态或接近速度超出安全范围'); return; }
    const earned = this.score.settle(C.landingFactors[grade], { time: this.time, grade, position: { x: this.x, z: this.z } }); this.notify(labels[grade], `×${C.landingFactors[grade]} · +${earned} 已入账`, grade === 2 ? 'heavy' : 'land', earned); if (grade === 2) this.heavyTimer = 1.4;
  }
  step(dt) {
    if (!(dt > 0) || dt > .05) throw new Error('Use simulation steps <= .05s'); this.time += dt;
    if (this.crashTimer > 0) { this.crashTimer = Math.max(0, this.crashTimer - dt); if (!this.crashTimer) this.recover(); return; }
    const prevX=this.x, prevZ = this.z, prevY = this.y, prevContact = contactHeight(this.pitch, this.roll), prevExtents=bodyExtents(this.pitch,this.roll,this.yaw+this.heading);
    if (this.grounded && !this.hasGround(this.z)) this.beginFlight();
    this.invulnerable = Math.max(0, this.invulnerable - dt); this.cooldown = Math.max(0, this.cooldown - dt); this.heavyTimer = Math.max(0, this.heavyTimer - dt);
    const pressed = this.boostRequested || this.input.boost && !this.boostWasDown; this.boostRequested = false; this.boostWasDown = this.input.boost;
    if (pressed && !this.cooldown) {
      if (this.buffer.active) this.explain('着陆缓冲中 · 不能重新起飞');
      else { const ground = this.grounded, cost = ground ? C.launchCost : C.airPulseCost; if (this.spend(cost, ground ? 'ground-pulse' : 'air-pulse')) { this.pulseElapsed = 0; this.pulseDuration = ground ? C.launchPulseTime : C.airPulseTime; this.pulsePower = ground ? C.launchAcceleration : C.airPulseAcceleration; this.cooldown = C.pulseCooldown; this.launchArmed = ground;this.holdAuthorized=true; this.notify(ground ? '冷气脉冲起飞' : '空中短喷', ground ? '离地后按住Q / 拖动保持' : '短喷已提交 · 保留惯性', 'launch'); this.predictionAt = -99; this.emit({ type: 'pulse', cost, ground, time: this.time }); } else this.explain(`主气压不足${cost} · 未提交喷气`); }
    }
    if(!this.input.boost)this.holdAuthorized=false;
    const steer = clamp(this.input.steer || 0, -1, 1); this.heading = this.grounded ? approach(this.heading, steer * C.groundHeading, C.headingResponse, dt) : this.heading * Math.exp(-.6 * dt);
    const pulseActive = this.pulseElapsed < this.pulseDuration;
    let paidUp = this.buffer.active ? 0 : pulseForce(this.pulseElapsed, this.pulseDuration, this.pulsePower); if (this.pulseElapsed < this.pulseDuration) this.pulseElapsed = Math.min(this.pulseDuration, this.pulseElapsed + dt);
    let mainRate = 0;
    if (!this.grounded && !this.buffer.active && this.input.boost && this.holdAuthorized && this.pulseElapsed >= this.pulseDuration && !pulseActive) { const ratio = Math.min(1, this.mainPressure / (C.sustainedCost * dt)); paidUp = C.sustainedUp * ratio; if (ratio > 0) { const cost = C.sustainedCost * dt * ratio; this.energy = Math.max(0, this.energy - cost / 100); mainRate += cost / dt; this.account('cost', cost, cost, 'sustain'); } }
    if (!this.grounded && this.time - this.predictionAt >= .075) { this.prediction = this.predictLanding(); this.predictionAt = this.time; }
    const need = Math.max(0, (this.vy ** 2 - C.bufferTouchSpeed ** 2) / (2 * C.bufferBrake));
    if (!this.grounded && this.buffer.armed && !this.buffer.active && this.vy < -C.bufferTouchSpeed - .1 && this.y - prevContact <= need + C.bufferMargin && this.prediction.safe) { this.buffer.active = true; this.buffer.startedAt = this.time; this.pulseDuration = this.pulseElapsed = 0; paidUp = 0; this.emit({ type: 'buffer', time: this.time, height: this.y, vy: this.vy }); }
    let lateral=0;
    if(!this.grounded&&this.energy>0){
      const request=Math.abs(steer)>.02?clamp((steer*C.airLateralSpeed-this.vx)*1.7,-C.airLateralAccel,C.airLateralAccel)*(Math.abs(this.input.roll)>.05?.65:1):0;
      const rate=Math.abs(steer)*C.microCost,used=Math.min(this.mainPressure,rate*dt);lateral=request*(rate?used/(rate*dt):0);this.energy=Math.max(0,this.energy-used/100);mainRate+=used/dt;if(used)this.account('cost',used,used,'micro');
    }
    const target={up:paidUp+(this.buffer.active?bufferForce(Math.max(0,this.y-prevContact),this.vy):0),forward:!this.grounded&&paidUp>0?1.2:0,lateral};
    const rotationRate=this.controlRotation(dt);mainRate+=rotationRate;
    for(const name of ['up','forward','lateral'])this.jets[name]=approach(this.jets[name],target[name],C.jetResponse,dt);
    // Independent buffer is the actual upward force, never a main-tank authority multiplier.
    if (this.buffer.active) this.jets.up = target.up;
    const groundMotor = this.grounded ? clamp((C.cruise - this.speed) * 2.1, -2, C.acceleration) : 0;
    const extraMotor=this.grounded&&!this.launchArmed?(this.environment?.motorAcceleration?.(this)??0):0;
    const forwardAcceleration = groundMotor + extraMotor + this.jets.forward - (this.grounded ? 0 : this.speed * C.airForwardDrag) - (this.heavyTimer > 0 ? 3.8 : 0); this.speed = Math.max(0, this.speed + forwardAcceleration * dt);
    const groundLateral = this.grounded ? clamp((Math.sin(this.heading) * this.speed - this.vx) * C.groundGrip, -C.groundLateralAccel, C.groundLateralAccel) : 0;
    const lateralAcceleration = groundLateral + this.jets.lateral - (this.grounded ? 0 : this.vx * C.airDrag); this.x += this.vx * dt + lateralAcceleration * dt * dt / 2; this.vx += lateralAcceleration * dt; this.z += this.speed * dt;
    const normal = this.grounded ? Math.max(0, C.gravity - this.jets.up + C.contactSpring * (prevContact - this.y) - C.contactDamping * this.vy) : 0;
    const netVertical = this.jets.up - C.gravity - (this.grounded ? 0 : C.verticalDrag * this.vy) + normal; this.y += this.vy * dt + netVertical * dt * dt / 2; this.vy += netVertical * dt;
    this.forces = { ...this.jets, normal, netVertical, lateralAcceleration, forwardAcceleration, groundMotor, extraMotor, grip: this.grounded ? 1 : 0, downforce: 0, gasRate: mainRate / 100, mainPointsRate: mainRate, authority: this.energy > 0 ? 1 : 0, flare: this.buffer.active, mainUp: paidUp, bufferUp: this.buffer.active ? this.jets.up : 0, rotationPointsRate: rotationRate, reserveTorque: axes.reduce((v,n)=>v+(!this.attitude[n].active?Math.abs(this.jets[n]):0),0) };
    this.thrusting = this.jets.up > .5;
    if (this.grounded && this.launchArmed && this.y > .02 && this.vy > .3) this.beginFlight();
    for(const name of axes){const before=this[name],a=this.attitude[name],groundTorque=this.grounded?-wrapAngle(this[name])*70-a.omega*15:0,accel=this.jets[name]+groundTorque-a.omega*C.angularDrag;this[name]+=a.omega*dt+accel*dt*dt/2;a.omega+=accel*dt;if(!this.grounded)this.observeTurn(name,before);}
    if (!this.grounded) this.airTime += dt;
    else if (this.hasGround(this.z) && this.y <= contactHeight(this.pitch, this.roll) + .035 && normal > 0 && !this.launchArmed) { const charge = Math.min(1 - this.energy, C.rechargePerSecond * dt); this.energy += charge; if (charge > 0) this.account('ground', charge * 100, charge * 100, 'real-contact'); }
    const extents=bodyExtents(this.pitch,this.roll,this.yaw+this.heading);
    if (Math.abs(this.x) > C.roadHalfWidth - extents.halfX && !this.invulnerable) { this.crash('驶出高架边界'); return; }
    for (const wall of this.environment ? [] : nearbyWalls(this.z)) {
      if (prevZ - prevExtents.halfZ <= wall.z + C.wallDepth / 2 && this.z + extents.halfZ >= wall.z - C.wallDepth / 2 && Math.abs(this.x) < C.wallHalfWidth + extents.halfX && Math.min(prevY-prevContact, this.y-contactHeight(this.pitch,this.roll)) < C.wallHeight && !this.invulnerable) { this.crash('低墙碰撞'); return; }
      if (prevZ <= wall.z + C.carHalfLength && this.z > wall.z + C.carHalfLength && !this.passedWalls.has(wall.id)) { this.passedWalls.add(wall.id); this.score.addObstacle({ time: this.time }); }
    }
    if (!this.environment && !this.grounded) for (const ring of nearbySupplies(this.z)) if (prevZ <= ring.z && this.z > ring.z && Math.hypot(this.x - ring.x, this.y + C.carCenterHeight - ring.y) < ring.radius - .9) this.receiveSupply('pressure-ring', SUPPLY.points, ring.id,{kind:'ring',origin:{x:ring.x,y:ring.y,z:ring.z,radius:ring.radius}});
    const contact = contactHeight(this.pitch, this.roll), contactApproach = (contact - prevContact) / dt - this.vy;
    this.environment?.collide?.(this, { prevX, prevZ, prevY, prevContact, prevHalfX:prevExtents.halfX,prevHalfY:prevExtents.halfY,prevHalfZ:prevExtents.halfZ }); if (this.crashTimer) return;
    if (!this.grounded && this.hasGround(this.z) && this.y <= contact && contactApproach > 0 && this.airTime > .1) this.land(contactApproach);
    if(!this._forecastOnly&&!this.grounded&&this.time-this.releasePredictionAt>=.075){this.releasePrediction=this.predictReleaseLanding();this.releasePredictionAt=this.time;}
    const forecast = { ...this.prediction, time: Math.max(0, this.prediction.time - (this.time - this.predictionAt)) };
    this.guidance=this.mainPressure<1e-6?'主气压用尽 · 松手收势':forecast.time<1.4?'尽快松手 · 准备落地':this.maneuverActive?'持续控制中 · 松手制动':this.stuntLabel||'松手滑行 · 缓冲就绪';
    if (this.passedWalls.size > 30) this.passedWalls = new Set([...this.passedWalls].slice(-15));
  }
  snapshot() { return { assist: this.assist, time: this.time, x: this.x, y: this.y, z: this.z, vx: this.vx, vy: this.vy, speed: this.speed, heading: this.heading, energy: this.energy, pressure: this.pressure, mainPressure: this.mainPressure, grounded: this.grounded, pitch: this.pitch, roll: this.roll, yaw: this.yaw, bodyExtents: bodyExtents(this.pitch,this.roll,this.yaw+this.heading), angularVelocity: { pitch: this.attitude.pitch.omega, roll: this.attitude.roll.omega, yaw: this.attitude.yaw.omega }, attitude: structuredClone(this.attitude), forces: { ...this.forces }, jets: { ...this.jets }, pulseRemaining: Math.max(0, this.pulseDuration - this.pulseElapsed), maneuverActive: this.maneuverActive, stuntLabel: this.stuntLabel, buffer: { ...this.buffer }, flightId: this.flightId, airSupplyUsed: this.airSupplyUsed, supplyCounts: { ...this.supplyCounts }, prediction: { ...this.prediction }, releasePrediction:structuredClone(this.releasePrediction), guidance: this.guidance, notice: this.notice && { ...this.notice }, supplyNotice: this.supplyNotice && { ...this.supplyNotice }, pending: this.score.pending, total: this.score.total, landingCount: this.landingCount, lastLanding: this.lastLanding && { ...this.lastLanding }, popup: this.popup && { ...this.popup }, crashTimer: this.crashTimer, crashes: this.crashes, thrusting: this.thrusting, input: { ...this.input }, events: this.events.map(e => ({ ...e })), ledger: this.ledger.map(e => ({ ...e })) }; }
}
