import test from'node:test';import assert from'node:assert/strict';
import{RoadsterSimulation}from'../src/roadster/simulation.js';import{ROADSTER as C}from'../src/roadster/config.js';import{stickAxes}from'../src/roadster/input.js';
import{footprint}from'../src/roadster/geometry.js';
const road={id:'road',group:'start',route:'main',xmin:-40,xmax:40,zmin:-100,zmax:180,top:0,depth:1};
const world=(colliders=[],surfaces=[road])=>({version:2,surfaces,colliders,spawn:{x:0,y:0,z:5,heading:0},exit:{surface:'far',xmin:-10,xmax:10,z:160},bounds:{xmin:-60,xmax:60,zmin:-110,zmax:200,ymin:-30},checkpoints:[]});
const run=(s,time,input={})=>{s.input={throttle:0,steer:0,lift:false,...input};for(let i=0;i<Math.round(time/C.step);i++)s.step(C.step);};
const noReset=s=>{assert.equal(s.crashTimer,0);assert.equal(s.resets,0);assert.ok(!s.events.some(e=>e.type==='reset'||e.type==='crash'));};
test('held negative throttle brakes through zero and reverses without a release',()=>{
 const s=new RoadsterSimulation(world());run(s,1.5,{throttle:1});let min=Infinity,negative=false;
 for(let i=0;i<240;i++){run(s,C.step,{throttle:-1});min=Math.min(min,Math.abs(s.vz));negative||=s.vz< -.3;assert.equal(s.input.throttle,-1);}
 assert.ok(min<.15);assert.ok(negative);assert.ok(s.vz< -3);noReset(s);
});
test('fixed downward joystick is the same continuous reverse request as the keyboard',()=>{
 const a=new RoadsterSimulation(world()),b=new RoadsterSimulation(world());for(const s of[a,b])run(s,1,{throttle:1});
 run(a,2,{throttle:-1});run(b,2,stickAxes(0,70));assert.equal(a.vz,b.vz);assert.equal(a.z,b.z);assert.ok(b.reverse);
});
test('air braking still stops horizontal velocity without reverse or vertical suspension',()=>{
 const s=new RoadsterSimulation(world());Object.assign(s,{y:70,z:40,grounded:false,surfaceId:null,vx:7,vz:12});run(s,2,{throttle:-1});assert.ok(s.speed<1e-6);assert.ok(s.vx>=0&&s.vz>=0);assert.ok(s.vy< -20);assert.ok(s.y<50);noReset(s);
});
test('head-on guard contact blocks and continuous reverse frees the car',()=>{
 const wall={id:'stop-wall',xmin:-15,xmax:15,zmin:20,zmax:20.15,ymin:0,ymax:3,kind:'guardrail'},s=new RoadsterSimulation(world([wall]));
 run(s,4,{throttle:1});assert.ok(s.z>17&&s.z<18);assert.ok(Math.max(...footprint(s).map(p=>p.z))<20.002);assert.ok(s.speed<.1);noReset(s);
 const hit=s.z;run(s,1,{throttle:-1});assert.ok(s.z<hit-1);assert.ok(s.vz< -2);noReset(s);
});
test('grazing a rail retains tangent motion and never teleports',()=>{
 const wall={id:'side-rail',xmin:4,xmax:4.14,zmin:-30,zmax:140,ymin:0,ymax:2},s=new RoadsterSimulation(world([wall]));
 Object.assign(s,{x:2.75,z:10,vx:5,vz:12});run(s,.8);assert.ok(s.z>18);assert.ok(s.vz>9);assert.ok(Math.max(...footprint(s).map(p=>p.x))<4.002);assert.equal(s.lastContact?.id,'side-rail');noReset(s);
});
test('sustained normal pressure does not accumulate penetration or reset',()=>{
 const wall={id:'long-rail',xmin:4,xmax:4.14,zmin:-30,zmax:140,ymin:0,ymax:2},s=new RoadsterSimulation(world([wall]));s.heading=Math.PI/2;
 run(s,6,{throttle:1});assert.ok(s.x>1.7&&s.x<2.1);assert.ok(s.grounded);noReset(s);const x=s.x;run(s,1,{throttle:-1});assert.ok(s.x<x-1);noReset(s);
});
test('sweep stops high-speed movement that would cross a thin convex wall in one step',()=>{
 const wall={id:'thin-triangle',polygon:[[4,-8],[7,0],[4,8]],xmin:4,xmax:7,zmin:-8,zmax:8,ymin:0,ymax:3},s=new RoadsterSimulation(world([wall]));Object.assign(s,{x:0,z:0,heading:Math.PI/2,vx:200,vz:0});s.step(.05);
 assert.ok(s.x<2);assert.ok(s.speed<1);assert.ok(Math.max(...footprint(s).map(p=>p.x))<4.003);noReset(s);
});
test('airborne platform side and underside block without a respawn timer',()=>{
 const platform={id:'high',xmin:10,xmax:30,zmin:0,zmax:80,top:8,depth:1,group:'high'},l=world([], [road,platform]);
 const side=new RoadsterSimulation(l);Object.assign(side,{x:7,y:7.5,z:30,heading:Math.PI/2,reference:Math.PI/2,vx:12,vy:0,grounded:false,surfaceId:null});run(side,.3);assert.ok(side.x<8.01);assert.ok(side.lastContact);noReset(side);
 const under=new RoadsterSimulation(l);Object.assign(under,{x:20,y:5,z:30,vy:12,grounded:false,surfaceId:null});run(under,.12);assert.ok(under.y+C.height<7.004);assert.ok(under.vy<=0);noReset(under);
});
test('very hard supported landing keeps the impact and control, without auto reset',()=>{
 const s=new RoadsterSimulation(world());Object.assign(s,{x:0,z:50,y:1,vy:-40,vz:10,grounded:false,surfaceId:null});run(s,.1);assert.ok(s.grounded);assert.ok(s.lastLanding.impact>40);assert.ok(s.speed>5);noReset(s);const z=s.z;run(s,.5,{throttle:1,steer:.2});assert.ok(s.z>z+2);noReset(s);
});
test('only actual map exit still automatically restores the safe checkpoint',()=>{
 const s=new RoadsterSimulation(world());Object.assign(s,{x:61,y:-31,grounded:false,surfaceId:null});run(s,.05);assert.ok(s.crashTimer>0);run(s,1.1);assert.equal(s.x,0);assert.equal(s.y,0);assert.equal(s.z,5);assert.equal(s.pressure,100);assert.equal(s.speed,0);assert.equal(s.resets,1);
});
