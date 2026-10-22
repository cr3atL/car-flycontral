import test from 'node:test';
import assert from 'node:assert/strict';
import { Simulation, contactHeight, landingGrade } from '../src/simulation.js';
import { CONFIG as C, STUNTS } from '../src/config.js';
import { Score } from '../src/scoring.js';
import { stuntVector } from '../src/input.js';
import { handlingScenario } from '../src/scenarios.js';
const run=(s,t)=>{for(let i=0;i<Math.round(t/C.step);i++)s.step(C.step);};
test('continuous dual held-input trace is physically continuous and banks only real events',()=>{const r=handlingScenario(new Simulation());assert.equal(r.end.landingCount,1);assert.equal(r.end.crashes,0);assert.ok(r.maxima.angleStep<.06);assert.ok(r.maxima.omegaStep<.3);assert.ok(r.end.events.filter(e=>e.type==='stunt').some(e=>e.axis==='roll'));assert.ok(r.end.events.filter(e=>e.type==='stunt').some(e=>e.axis==='pitch'));});
test('contact preserves actual pose, velocity and omega; bounce cannot bank twice',()=>{
 const s=new Simulation();s.grounded=false;s.settledFlight=false;s.pitch=.2;s.roll=.1;s.vy=-5;s.attitude.roll.omega=.6;s.score.complete(STUNTS.left);s.land(5);
 assert.equal(s.pitch,.2);assert.equal(s.roll,.1);assert.equal(s.vy,-5);assert.equal(s.attitude.roll.omega,.6);const total=s.score.total;run(s,1);assert.equal(s.landingCount,1);assert.equal(s.score.total,total);
});
test('rotated contact volume and genuine bad attitude remain physical collisions',()=>{
 assert.equal(contactHeight(0,0),0);assert.ok(contactHeight(Math.PI/2,0)>1.3);const s=new Simulation();s.grounded=false;s.settledFlight=false;s.airTime=.5;s.pitch=1.2;s.y=contactHeight(s.pitch,s.roll)+.005;s.vy=-2;run(s,C.step);assert.equal(s.lastLanding.grade,3);assert.equal(s.crashes,1);
});
test('score categories, shared roll repetition and landing factors retain their meanings',()=>{
 for(let i=0;i<3;i++)assert.equal(landingGrade(C.landingAngles[i],C.landingSpeeds[i]),i);assert.equal(landingGrade(0,0,true),3);
 const s=new Score();s.complete(STUNTS.left);s.complete(STUNTS.right);s.complete(STUNTS.left);assert.equal(s.pending,1050);
 const q=new Score();q.complete(STUNTS.left);q.complete(STUNTS.back);assert.equal(q.pending,2025);assert.equal(q.settle(1.2),2430);
});
test('touch deadzone and independent continuous axis magnitude',()=>{assert.equal(Math.abs(stuntVector(6,6).roll),0);assert.ok(Math.abs(stuntVector(-16,0).roll-.26666666666666666)<1e-8);assert.deepEqual(stuntVector(-38,-38),{roll:1,pitch:-1});assert.deepEqual(stuntVector(38,38),{roll:-1,pitch:1});});
test('real ground charges 25 per second; denied air pulse cannot secretly buy sustained force',()=>{
 const s=new Simulation();s.energy=0;run(s,2);assert.ok(Math.abs(s.mainPressure-50)<1e-7);
 s.queueBoostPress();run(s,.2);s.energy=.05;s.input.boost=true;s.holdAuthorized=false;s.cooldown=0;s.queueBoostPress();run(s,.7);assert.equal(s.holdAuthorized,false);assert.ok(s.jets.up<.001);assert.ok(s.mainPressure<=5);
});
test('deterministic bounded practice, swept walls and road edges retain collisions',()=>{
 const a=new Simulation(),b=new Simulation();run(a,5);run(b,5);assert.deepEqual(a.snapshot(),b.snapshot());a.z=316;a.speed=C.cruise;run(a,.2);assert.equal(a.crashes,1);
 const e=new Simulation();e.x=C.roadHalfWidth;run(e,C.step);assert.equal(e.crashes,1);run(b,240);assert.ok(b.events.length<=120);assert.ok(b.ledger.length<=320);assert.ok(b.passedWalls.size<=30);
});
