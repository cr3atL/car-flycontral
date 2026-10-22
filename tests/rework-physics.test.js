import test from 'node:test';
import assert from 'node:assert/strict';
import{Simulation,bufferForce}from'../src/simulation.js';
import{CONFIG as C}from'../src/config.js';
const run=(s,seconds,input={})=>{s.input={boost:false,roll:0,pitch:0,steer:0,...input};for(let i=0;i<Math.round(seconds/C.step);i++)s.step(C.step);};
function flight(inputAt,limit=40){const s=new Simulation();s.environment={hasGround:()=>true};s.queueBoostPress();const trace=[];for(let i=0;i<limit/C.step&&!s.landingCount&&!s.crashes;i++){s.input=inputAt(s);s.step(C.step);trace.push({time:s.time,y:s.y,vy:s.vy,roll:s.roll,pitch:s.pitch,omega:{roll:s.attitude.roll.omega,pitch:s.attitude.pitch.omega},input:{...s.input},modes:{roll:s.attitude.roll.mode,pitch:s.attitude.pitch.mode},main:s.mainPressure,forces:{...s.forces},buffer:s.buffer.active});}return{s,trace};}
const base=(s,roll=0,pitch=0)=>({boost:s.time<1.5,roll,pitch,steer:0});
test('A 80/150/300ms change actual angle, release brakes rather than finishing a circle',()=>{
 const angles=[];for(const duration of [.08,.15,.3]){const{s,trace}=flight(s=>base(s,s.time>=.6&&s.time<.6+duration?1:0));const stopped=trace.find(x=>x.time>=.6+duration+.6);angles.push(stopped.roll);assert.ok(Math.abs(stopped.omega.roll)<.1);assert.ok(stopped.roll<Math.PI*2);assert.equal(s.events.filter(e=>e.type==='stunt').length,0);assert.ok(s.lastLanding.grade<2);}assert.ok(angles[0]<angles[1]&&angles[1]<angles[2]);
});
test('B held rotation crosses circles without stopping and never sets angle/omega',()=>{
 const{s,trace}=flight(s=>base(s,s.time>=.6&&s.time<3.1?1:0));const circles=s.events.filter(e=>e.type==='stunt');assert.ok(circles.length>=2);assert.ok(circles.every(e=>Math.abs(e.omega)>6));for(let i=1;i<trace.length;i++){assert.ok(Math.abs(trace[i].roll-trace[i-1].roll)<.06);assert.ok(Math.abs(trace[i].omega.roll-trace[i-1].omega.roll)<.22);}assert.equal('currentAction'in s,false);assert.equal('nextAction'in s,false);
});
test('C actual full tank plus earned60 exhaustion brakes at zero, held input cannot continue driving',()=>{
 const s=new Simulation();s.environment={hasGround:()=>true};s.queueBoostPress();let peak=0,empty=null,afterStop=null,count=0;for(let i=0;i<5000&&!s.landingCount;i++){if(!empty){s.input={boost:true,roll:1,pitch:0,steer:0};}else{s.input={boost:false,roll:s.time-empty.time<1?1:0,pitch:0,steer:0};}s.step(C.step);peak=Math.max(peak,s.y);if(s.mainPressure<1e-7&&!empty){empty={time:s.time,omega:s.attitude.roll.omega};count=s.events.filter(e=>e.type==='stunt').length;}if(empty&&s.time-empty.time>.8&&!afterStop)afterStop={omega:s.attitude.roll.omega,active:s.attitude.roll.active,output:s.jets.roll};}
 assert.ok(peak>C.ceilingSoft&&peak<=C.ceilingTop);assert.equal(s.airSupplyUsed,60);assert.ok(empty.omega>5);assert.ok(Math.abs(afterStop.omega)<.1);assert.equal(afterStop.active,false);assert.ok(s.events.filter(e=>e.type==='stunt').length<=count+1);assert.equal(s.lastLanding.pressure,0);assert.ok(s.lastLanding.grade<2);assert.equal(s.crashes,0);
});
test('D reversal responds before a circle and crosses zero continuously; half-circle oscillation does not farm',()=>{
 const{s,trace}=flight(s=>base(s,s.time>=.6&&s.time<1.1?1:s.time>=1.1&&s.time<1.9?-1:0));const before=trace.find(t=>t.time>=1.1),mid=trace.find(t=>t.time>=1.25),after=trace.find(t=>t.time>=1.8);assert.ok(before.omega.roll>5);assert.ok(mid.omega.roll>0&&mid.omega.roll<before.omega.roll);assert.ok(after.omega.roll<-5);
 const jitter=flight(s=>base(s,s.time>=.6&&s.time<3.1?(Math.floor((s.time-.6)/.22)%2?-1:1):0));assert.equal(jitter.s.events.filter(e=>e.type==='stunt').length,0);
});
test('E both axes truly output simultaneously; release one leaves the other active',()=>{
 const{s,trace}=flight(s=>base(s,s.time>=.6&&s.time<1.3?1:0,s.time>=.6&&s.time<2.2?-1:0));const dual=trace.find(t=>t.time>=1.2),single=trace.find(t=>t.time>=1.9);assert.ok(dual.omega.roll>6&&dual.omega.pitch<-6);assert.ok(dual.forces.roll>0&&dual.forces.pitch<0);assert.ok(Math.abs(single.omega.roll)<.1&&single.omega.pitch<-6);assert.ok(s.events.some(e=>e.type==='stunt'&&e.name==='back'));
});
test('continuous rotation gas is actual output integral, no action prepayment, independent axes add',()=>{
 const{s,trace}=flight(s=>base(s,s.time>=.6&&s.time<1.95?1:0,s.time>=.6&&s.time<1.95?-1:0));
 for(const axis of ['roll','pitch']){const physical=trace.filter(t=>t.modes[axis]==='driving').reduce((sum,t)=>sum+Math.abs(t.forces[axis])*C.rotationGas[axis]*C.step,0),ledger=s.ledger.filter(e=>e.source==='rotation:'+axis).reduce((sum,e)=>sum+e.actual,0);assert.ok(Math.abs(physical-ledger)<1e-7);}
 assert.ok(s.ledger.every(e=>!e.source.startsWith('action:')));assert.equal(s.ledger.filter(e=>e.source==='ground-pulse').reduce((v,e)=>v+e.actual,0),18);
});
test('full turn credit includes legitimate braking inertia, never automatic leveling',()=>{
 let found=false;for(const hold of [1.12,1.14,1.16,1.18]){const{s,trace}=flight(s=>base(s,s.time>=.6&&s.time<.6+hold?1:0));assert.ok(s.events.filter(e=>e.type==='stunt').every(e=>['player-drive','braking-inertia'].includes(e.source)));if(s.events.some(e=>e.type==='stunt'&&e.source==='braking-inertia'))found=true;assert.ok(s.events.filter(e=>e.type==='stunt').length<=1);}assert.ok(found);
 const r=flight(s=>base(s,s.time>=.6&&s.time<1.45?1:0));assert.equal(r.s.events.filter(e=>e.type==='stunt').length,0);assert.ok(Math.abs(r.s.lastLanding.roll)>6); // Automatic shortest-path return may pass an upright angle; it grants nothing.
});
test('input remains authoritative while vertical buffer is active; late hold can genuinely collide',()=>{
 const{s,trace}=flight(s=>({boost:false,roll:s.time>.6?1:0,pitch:0,steer:0}));assert.ok(trace.some(t=>t.buffer&&t.modes.roll==='driving'&&Math.abs(t.forces.roll)>0));assert.ok(s.lastLanding.grade>=2||s.crashes>0);
});
test('independent buffer does not generate climb, movement or refill and actual landing preserves momentum',()=>{
 const{s,trace}=flight(s=>({boost:true,roll:0,pitch:0,steer:0}));assert.equal(s.lastLanding.pressure,0);assert.ok(s.lastLanding.impact<4.6);assert.ok(trace.filter(t=>t.buffer).every(t=>t.vy<0));for(const h of [2,80,333])for(const v of [-5,-30,-65])assert.ok(bufferForce(h,v)<=C.gravity+C.bufferBrake+.01);
 const before=s.score.total,flightId=s.flightId;run(s,1);assert.equal(s.landingCount,1);assert.equal(s.flightId,flightId);assert.equal(s.score.total,before);
});
test('full/partial/capped supply boundary fixtures: actual100/60, dedupe and category recurrence',()=>{
 const s=new Simulation();s.environment={hasGround:()=>true};s.queueBoostPress();run(s,.2);s.energy=.95;assert.ok(Math.abs(s.receiveSupply('ring',30,'a')-5)<1e-8);s.energy=1;assert.equal(s.receiveSupply('ring',30,'b'),0);s.energy=0;assert.equal(s.receiveSupply('ring',30,'b'),0);assert.equal(s.receiveSupply('ring',30,'c'),30);assert.equal(s.receiveSupply('ring',30,'d'),25);assert.equal(s.airSupplyUsed,60);
 const r=flight(s=>({boost:s.time<2,roll:s.time>=.6&&s.time<4.3?1:0,pitch:0,steer:0}));assert.deepEqual(r.s.ledger.filter(e=>e.kind==='supply').slice(0,3).map(e=>e.requested),[20,10,5]);
});
test('gap has no fictitious safe marker, buffer cannot create ground',()=>{const s=new Simulation();s.environment={hasGround:z=>!(z>0&&z<10000)};s.queueBoostPress();run(s,.8);assert.equal(s.predictLanding().safe,false);run(s,3);assert.equal(s.landingCount,0);assert.equal(s.buffer.active,false);});

test('R08 same-direction partial turns survive center/idle; real reversals do not sum absolute arcs',()=>{
 const r=flight(s=>{const t=s.time-.6;return base(s,t>=0&&t<3&&t%.9<.3?1:0);});const real=r.s.events.filter(e=>e.type==='stunt');assert.equal(real.length,1);assert.equal(real[0].name,'left');assert.ok(real[0].angle>=Math.PI*2);
 const reverse=flight(s=>{const t=s.time-.6;return base(s,t>=0&&t<3?(Math.floor(t/.3)%2?-1:1):0);});assert.equal(reverse.s.events.filter(e=>e.type==='stunt').length,0);
});
test('assist choice truly disables gentle leveling while independent vertical buffer and braking stay',()=>{
 const results=[];for(const assist of [true,false]){const s=new Simulation();s.assist=assist;s.environment={hasGround:()=>true};s.queueBoostPress();let leveled=false,braked=false,buffered=false;for(let i=0;i<1200&&!s.landingCount;i++){s.input=base(s,s.time>=.6&&s.time<.9?1:0);s.step(C.step);leveled ||=s.attitude.roll.mode==='leveling';braked ||=s.attitude.roll.mode==='braking';buffered ||=s.buffer.active;}results.push({leveled,braked,buffered,landing:s.lastLanding});}
 assert.equal(results[0].leveled,true);assert.equal(results[1].leveled,false);assert.ok(results.every(r=>r.braked&&r.buffered));assert.ok(results[0].landing.grade<2);assert.ok(results[1].landing.grade>=2);
});
