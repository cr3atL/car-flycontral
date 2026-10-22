import{ParkingEscape}from'./parking.js';
import{flowGeometry,courseBoxes,courseCollision,gateHeight}from'./challenge-course.js';
import {Sprint} from './sprint.js';
import { OneJump } from './one-jump.js';
import { Simulation, contactHeight, bodyExtents } from './simulation.js';
import { CONFIG as C } from './config.js';
import { CHALLENGE as H, GROUPS, ratingFor } from './challenge-config.js';
import { SCORE } from './score-config.js';
import { SUPPLY } from './supply-config.js';
const overlap = (a, b, lo, hi) => a <= hi && b >= lo;
export const gateBottom=gateHeight;
export function buildGroup(def, z, time) {
  const g = { ...def, z, spawnTime: time, status: 'active', rings: [], supplies: [], grazed: false, collided: false, walls: [], ceiling: null, gap: null };
  if(def.layout){Object.assign(g,flowGeometry(def,z));const solids=courseBoxes(g,time);g.bounds={start:Math.min(z,...solids.map(b=>b.z-b.depth/2)),end:Math.max(z,...solids.map(b=>b.z+b.depth/2),g.gap?.end??z)};g.end=g.bounds.end+C.carHalfLength;g.rewardEnd=Math.max(g.end,...g.rings.map(r=>r.z+C.carHalfLength));return g;}
  if (['wall', 'double', 'ceiling', 'gate'].includes(g.type)) g.walls.push({ z, height: def.height, depth: 1.5 });
  if (g.type === 'double') g.walls.push({ z: z + 45, height: def.height, depth: 1.5 });
  if (g.type === 'ceiling') g.ceiling = { start: z - 4, end: z + 40, bottom: 9.2 };
  if (g.type === 'gate') g.ceiling = { start: z + 16, end: z + 18, moving: true, top: 12 };
  if (g.type === 'gap' || g.type === 'gapCeiling') g.gap = { start: z, end: z + def.length };
  if (g.type === 'gapCeiling') g.ceiling = { start: z + def.length + 8, end: z + 65, bottom: 10 };
  g.end = Math.max(z + 2, ...g.walls.map(w => w.z + w.depth / 2), g.gap?.end ?? z, g.ceiling?.end ?? z) + C.carHalfLength;
  if (def.ringX !== null) g.rings.push({ id: `ring-${g.id}`, x: def.ringX, y: 5.5, z: g.gap ? z + 12 : z - 12, radius: 2.35, collected: false });
  if (def.supply) g.supplies.push({ id: `pressure-${g.id}`, x: 0, y: 5, z: g.gap ? z + 15 : z + 4, radius: SUPPLY.radius, collected: false });
  g.pad = { x: def.ringX ?? 0, halfWidth: 3, start: g.end + 3, end: g.end + 90 };
  return g;
}
export class GameSession {
  constructor(storage = null) {
    this.sim = new Simulation(); this.oneJump=new OneJump(this.sim);this.sprint=new Sprint(this.sim);this.parking=new ParkingEscape(this.sim); this.storage = storage; this.best = 0; this.storageAvailable = true;
    try { const n = Number(storage?.getItem(SCORE.bestKey)); if (Number.isFinite(n) && n > 0) this.best = Math.round(n); if (!storage) this.storageAvailable = false; } catch { this.storageAvailable = false; }
    this.phase = 'menu'; this.mode = 'challenge'; this.paused = false; this.resuming = false; this.resumeRemaining = 0; this.countdown = 0;
    this.elapsed = 0; this.groups = []; this.nextGroup = 0; this.result = null; this.resetStats();
    this.environment = { hasGround: z => this.hasGround(z), collide: (s, prev) => this.collide(s, prev),forecastCollide:(s,p)=>this.collide(s,p,true,s.time-this.sim.time), remaining: () => H.duration - this.elapsed, precisionAt: (x,z) => this.groups.some(g => g.pad && ['active','passed'].includes(g.status) && Math.abs(x-g.pad.x)<g.pad.halfWidth && z>g.pad.start && z<g.pad.end), isLandingSafe: (x,z) => this.hasGround(z) && !this.groups.some(g=>g.walls?.some(w=>Math.abs(z-w.z)<C.carHalfLength+w.depth/2)), recovery: () => ({ z: this.recoveryZ, energy: 1 }), onCrash: (reason, context) => this.onCrash(reason, context), onEvent: e => this.onEvent(e) };
  }
  resetStats() { this.tutorial = { stage: 'accelerate', firstLanding: null, rollLanding: null, repeatLanding: null, complete: false, retry: false, shortPractice: false, heldPractice: false }; this.stats = { actions: 0, groups: 0, obstacleScore: 0, bankedTricks: 0, rings: 0, grazes: 0, precision: 0, precisionPads: 0, highestCombo: 0, repairsUsed: 0, crashes: 0, tutorialMistakes: 0, skipped: 0 }; this.lastLandingAt = -10; this.nextAllowedAt = 0; this.recoveryZ = 0;this.routeAnchor=null; }
  start(mode = 'challenge') {
    this.mode = mode; this.sim.reset(); this.sim.environment = mode === 'challenge' ? this.environment : mode==='sprint'?this.sprint.environment:mode==='parking'?this.parking.environment:this.oneJump.environment;
    if(mode==='parking'){this.sim.speed=C.practiceSpeed;this.sim.z=-40;this.parking.reset();}
    if(mode==='sprint'){this.sim.speed=C.practiceSpeed;this.sprint.reset();}
    if (mode === 'practice') {this.sim.speed = C.practiceSpeed;this.oneJump.reset();}
    this.phase = mode === 'challenge' ? 'countdown' : 'running'; this.countdown = mode === 'challenge' ? H.countdown : 0;
    this.elapsed = 0; this.paused = false; this.resuming = false; this.resumeRemaining = 0; this.groups = []; this.nextGroup = 0; this.result = null; this.resetStats();
    if (mode === 'challenge') { this.groups.push(buildGroup(GROUPS[0], 120, 0)); this.nextGroup = 1; }
  }
  menu() { if(this.mode==='sprint'){this.sprint.pending=this.sprint.motor=null;this.sprint.lastAcceleration=0;}this.sim.clearInput(); this.phase = 'menu'; this.paused = false; this.resuming = false; this.resumeRemaining = 0; }
  get playable() { return this.phase === 'running' && !this.paused && !this.resuming && !(this.mode==='sprint'&&this.sprint.complete)&&!(this.mode==='parking'&&this.parking.complete); }
  setPaused(value) { if (!['running', 'countdown'].includes(this.phase)) return; this.paused = value; this.resuming = false; this.resumeRemaining = 0; this.sim.clearInput({ preservePulse: true }); }
  resume() { if (!this.paused) return; this.resuming = true; this.resumeRemaining = H.resumeCountdown; this.sim.clearInput({ preservePulse: true }); }
  tick(dt) {
    if (this.resuming) { this.resumeRemaining = Math.max(0, this.resumeRemaining - dt); if (this.resumeRemaining < 1e-8) { this.resuming = false; this.paused = false; } return; }
    if (this.paused || this.phase === 'menu' || this.phase === 'results') return;
    if (this.phase === 'countdown') { this.countdown = Math.max(0, this.countdown - dt); if (this.countdown < 1e-8) { this.phase = 'running'; this.sim.clearInput(); } return; }
    if(this.mode==='parking'){if(this.parking.complete){this.sim.clearInput();return;}this.sim.step(dt);this.parking.update(dt);return;}
    if(this.mode==='sprint'){if(this.sprint.complete){this.sim.clearInput();return;}this.sim.step(dt);this.sprint.update(dt);return;}
    if (this.mode === 'practice') { this.sim.step(dt); return; }
    if (this.elapsed >= H.duration - 1e-8) { this.finish('time'); return; }
    this.schedule(); this.sim.step(Math.min(dt, H.duration - this.elapsed));
    this.elapsed = Math.min(H.duration, this.elapsed + dt);
    if (this.elapsed >= H.duration - 1e-8 && this.phase === 'running') this.finish('time');
  }
  schedule() {
    const s = this.sim, first = this.groups.find(g=>g.id===1), second = this.groups.find(g=>g.id===2);
    if (!this.tutorial.complete) {
      if (this.elapsed >= 4 && this.tutorial.stage==='accelerate') this.tutorial.stage='first-jump';
      if (first?.status==='passed' && this.tutorial.firstLanding!==null && !second && s.grounded && !s.crashTimer && this.elapsed>=Math.max(10,this.tutorial.firstLanding+1) && s.energy>=.82) { const g=buildGroup(GROUPS[1],s.z+85,this.elapsed);this.groups.push(g);this.nextGroup=2;this.tutorial.stage='single-roll';s.predictionAt=-99; }
      if (second?.status==='active' && s.grounded && !s.crashTimer && s.z>second.z+140) { Object.assign(second,buildGroup(GROUPS[1],s.z+85,this.elapsed)); s.predictionAt=-99; }
      if (this.tutorial.repeatLanding!==null && this.elapsed>=20) { this.tutorial.complete=true;this.tutorial.stage='complete'; }
      else if (this.tutorial.rollLanding!==null) this.tutorial.stage='repeat';
      if (!this.tutorial.complete) return;
    }
    if(this.routeAnchor===null){this.routeAnchor={z:s.z,time:this.elapsed};for(const def of GROUPS.slice(2)){const g=buildGroup(def,s.z+def.offset,this.elapsed);g.status='preview';g.spawnZ=s.z;g.spawnPressure=s.energy;g.visibleSince=this.elapsed;this.groups.push(g);}this.nextGroup=GROUPS.length;s.predictionAt=-99;}
    // Visible committed geometry never moves. Reward state activates on approach,
    // independently of landing/air state; physical solids exist even in preview.
    for(const g of this.groups)if(g.status==='preview'&&s.z>=g.z-Math.max(110,s.speed*3)){g.status='active';g.activatedAt=this.elapsed;}

  }
  hasGround(z) { return !this.groups.some(g => g.gap && Number.isFinite(g.z) && z > g.gap.start && z < g.gap.end); }
  onEvent(e) {
    if (this.mode !== 'challenge' || this.phase !== 'running') return;
    if(e.type==='rotation-release'&&Math.abs(e.delta)>.05){if(e.duration<.45)this.tutorial.shortPractice=true;if(e.duration>=.75)this.tutorial.heldPractice=true;}
    if (e.type === 'stunt') this.stats.actions++;
    if (e.type === 'recovery' && this.tutorial.retry) { const g=this.groups.find(g=>g.status==='retry'); if(g)g.status='active';this.tutorial.retry=false; }
    if (e.type === 'supply') { this.stats.supplied=(this.stats.supplied??0)+e.amount; }
    if (e.type === 'landing') {
      this.lastLandingAt = this.elapsed;
      const first=this.groups.find(g=>g.id===1),second=this.groups.find(g=>g.id===2);
      if(e.grade<3 && first?.status==='passed' && this.tutorial.firstLanding===null){this.tutorial.firstLanding=this.elapsed;this.tutorial.stage='recharge';}
      if(e.grade<3 && second?.status==='active' && this.tutorial.shortPractice){this.passGroup(second);this.tutorial.rollLanding=this.elapsed;this.tutorial.stage='repeat';}
      else if(e.grade<3 && this.tutorial.rollLanding!==null && this.tutorial.repeatLanding===null && this.tutorial.heldPractice)this.tutorial.repeatLanding=this.elapsed;
      if (e.grade < 3) {
        const earned = Math.round(this.sim.score.pending * C.landingFactors[e.grade]);
        this.stats.bankedTricks += earned; this.stats.highestCombo = Math.max(this.stats.highestCombo, earned);
        if(e.grade===0)this.stats.precision++;if(e.padHit)this.stats.precisionPads++;
      }
    }
  }
  onCrash(reason, context = {}) {
    this.stats.crashes++;
    const g = this.groups.find(g => g.id === context.groupId && g.status === 'active') ?? this.groups.find(g => g.status === 'active');
    const soft = !this.tutorial.complete || context.soft === true;
    if (!this.tutorial.complete) { this.stats.tutorialMistakes++; if(g && g.status!=='passed') {g.status='retry';g.collided=false;g.attempt=(g.attempt??0)+1;} this.tutorial.retry=true;this.recoveryZ=g?.id===1 && g.status!=='passed' ? g.z-g.launch-25 : this.sim.z+35;this.nextAllowedAt=this.elapsed+3;return; }
    if (g) { g.status = 'failed'; g.collided = true; }
    this.recoveryZ = Math.max(this.sim.z + 100, (g?.end ?? this.sim.z) + 100);
    this.nextAllowedAt = this.elapsed + H.recoveryQuiet;
    if (soft) this.stats.tutorialMistakes++;
    else if (this.stats.repairsUsed < H.repairs) this.stats.repairsUsed++;
    else this.finish('crashes');
  }
  collide(s,prev,forecast=false,ahead=0){
    if(this.phase!=='running')return;
    if(s.y<-5){s.crash('坠入断路缺口');return;}
    const bottom=s.y-contactHeight(s.pitch,s.roll);
    for(const g of this.groups){
      if(!Number.isFinite(g.z)||g.status==='retry')continue;
      const reach=C.carHalfLength+C.carHalfWidth+C.carCenterHeight,near=!g.bounds||s.z+reach>=g.bounds.start&&prev.prevZ-reach<=g.bounds.end;
      const hit=near?courseCollision(s,prev,g,this.elapsed+ahead):null;
      if(hit){s.crash(g.soft?'教学软路障 · 本次不消耗修复':hit.reason,{groupId:g.id,soft:g.soft});return;}
      if(forecast||!['active','passed'].includes(g.status))continue;
      if(!s.grounded)for(const b of courseBoxes(g,this.elapsed))if(['truck','barrier'].includes(b.part)&&prev.prevZ<b.z&&s.z>=b.z&&Math.abs(s.x-b.x)<b.width/2+C.carHalfWidth&&bottom>b.top+.04&&bottom-b.top<H.grazeClearance)this.reward(g,'graze');
      for(const ring of g.rings)if(!ring.collected&&!s.grounded&&prev.prevZ<=ring.z&&s.z>ring.z&&Math.hypot(s.x-ring.x,s.y+C.carCenterHeight-ring.y)<ring.radius-.9){ring.collected=true;this.reward(g,'ring');}
      if(g.gap&&prev.prevZ<g.gap.end&&s.z>=g.gap.end&&bottom>.04&&bottom<H.grazeClearance)this.reward(g,'graze');
      for(const ring of g.supplies??[])if(!ring.collected&&!s.grounded&&prev.prevZ<=ring.z&&s.z>ring.z&&Math.hypot(s.x-ring.x,s.y+C.carCenterHeight-ring.y)<ring.radius-.9){ring.collected=true;s.receiveSupply('pressure-ring',SUPPLY.points,ring.id,{kind:'ring',origin:{x:ring.x,y:ring.y,z:ring.z,radius:ring.radius}});}
      if(g.status==='active'&&g.type!=='tutorialRoll'&&prev.prevZ<=g.end&&s.z>g.end&&!s.crashTimer)this.passGroup(g);
    }
  }

  passGroup(g) { if(g.status==='passed')return;g.status='passed';this.stats.groups++;this.stats.obstacleScore+=H.obstaclePoints;this.sim.score.addObstacle({time:this.sim.time,label:`第${g.id}组通过`}); }
  reward(g, kind) {
    if (kind === 'graze') { if (g.grazed) return; g.grazed = true; this.stats.grazes++; }
    else this.stats.rings++;
    this.sim.score.bonus(kind, kind === 'ring' ? '穿过奖励环' : '贴身飞越', kind === 'ring' ? H.ringPoints : H.grazePoints, { time: this.sim.time });
    this.sim.notify(kind === 'ring' ? '穿过奖励环' : '贴身飞越', `待结算 ${Math.round(this.sim.score.pending)} · 落地入账`, 'stunt');
  }
  finish(reason) {
    if (this.phase === 'results') return;
    const unbanked = this.sim.score.pending;
    this.sim.score.clearChain(); this.sim.clearInput(); this.phase = 'results'; this.paused = false; this.resuming = false;
    const score = this.sim.score.total, previousBest = this.best; this.best = Math.max(this.best, score);
    try { this.storage?.setItem(SCORE.bestKey, String(this.best)); } catch { this.storageAvailable = false; }
    this.result = { reason, score, elapsed: this.elapsed, unbanked: Math.round(unbanked), rating: ratingFor(score), stats: { ...this.stats }, best: this.best, newBest: score > previousBest };
  }
  snapshot() { return { parking:this.mode==='parking'?this.parking.snapshot():null, phase: this.phase, mode: this.mode, elapsed: this.elapsed, remaining: Math.max(0, H.duration - this.elapsed), countdown: this.countdown, paused: this.paused, resumeRemaining: this.resumeRemaining, resuming: this.resuming, sprint:this.mode==='sprint'?this.sprint.snapshot():null,practice:this.mode==='practice'?this.oneJump.snapshot():null, stats: { ...this.stats }, tutorial: { ...this.tutorial }, routeAnchor:this.routeAnchor,nextGroup: this.nextGroup, groups: structuredClone(this.groups), result: this.result, best: this.best, storageAvailable: this.storageAvailable }; }
}
