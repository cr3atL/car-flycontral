import test from 'node:test';
import assert from 'node:assert/strict';
import { inside, topAt, supported, intersection, polygonArea, contactPolygon } from '../src/roadster/geometry.js';
import { RoadsterSimulation } from '../src/roadster/simulation.js';
import { ROADSTER as C } from '../src/roadster/config.js';

// Deliberately small analytic fixtures, never runtime track generation.
const rect=(id,xmin,xmax,zmin,zmax,top=0,extra={})=>({id,xmin,xmax,zmin,zmax,top,depth:1,group:id,route:'main',...extra});
const layout=(surfaces,extra={})=>({version:2,surfaces,spawn:{x:0,y:0,z:5,heading:0},bounds:{xmin:-200,xmax:200,zmin:-100,zmax:1000,ymin:-100},exit:{surface:'far',xmin:-8,xmax:8,z:900},checkpoints:[],...extra});
const run=(s,seconds,input={})=>{s.input={throttle:0,steer:0,lift:false,...input};for(let i=0;i<Math.round(seconds/C.step)&&!s.complete&&!s.crashTimer;i++)s.step(C.step);};

test('convex road containment respects winding and perpendicular margin',()=>{
  const vertices=[[0,0],[8,0],[10,4],[2,4]];
  for(const polygon of[vertices,[...vertices].reverse()]){
    const face=rect('skew',0,10,0,4,0,{polygon});
    assert.equal(inside(face,.5,3),false); // in AABB, outside authored shape
    assert.equal(inside(face,5,2,1.5),true);
    assert.equal(inside(face,5,.2,.5),false);
  }
});
test('polygon intersection has known area and rejects an AABB-only overlap',()=>{
  const a=rect('a',0,4,0,4),b=rect('b',2,6,2,6);
  assert.ok(Math.abs(polygonArea(intersection(a,b))-4)<1e-8);
  const sliver=rect('diagonal',0,11,0,20,5,{polygon:[[0,0],[1,0],[11,20],[10,20]]});
  assert.equal(contactPolygon({x:1,z:15,heading:0},sliver).length,0);
  assert.ok(contactPolygon({x:8,z:15,heading:0},sliver).length>0);
});
test('dual slope plane uses both independent origins',()=>{
  assert.equal(topAt({top:8,slope:-.1,slopeX:.25,origin_x:10,origin_z:20},14,30),8);
});
test('full footprint spans multiple small faces without a seam penalty',()=>{
  const surfaces=Array.from({length:12},(_,i)=>rect('tile-'+i,-6,6,i*1.5,(i+1)*1.5,0,{group:'curve',polygon:[[-6,i*1.5],[6,i*1.5],[6,(i+1)*1.5],[-6,(i+1)*1.5]]}));
  const world=layout(surfaces),state={x:0,z:8.9,heading:.2};
  const support=supported(world,state,surfaces[5],.35);
  assert.equal(support.count,4);assert.equal(support.safe,true);assert.equal(support.coverage,1);
});
test('four supported corners cannot hide an uncovered strip in the footprint',()=>{
  const faces=[rect('left',-10,-.3,-10,20),rect('right',.3,10,-10,20)];
  const support=supported(layout(faces),{x:0,z:5,heading:0},faces[0]);
  assert.equal(support.count,4);assert.equal(support.safe,false);assert.ok(support.coverage<.8);
});
test('air collisions use actual road polygon, not its bounding rectangle',()=>{
  const face=rect('diagonal',0,11,0,20,5,{depth:3,polygon:[[0,0],[1,0],[11,20],[10,20]]});
  for(const [x,collision]of[[1,false],[8,true]]){
    const s=new RoadsterSimulation(layout([face]));Object.assign(s,{x,z:15,y:3,vy:0,grounded:false,surfaceId:null});run(s,.05);
    assert.equal(s.crashTimer,0);assert.equal(!!s.lastContact,collision);
  }
});
test('polygon guardrail also rejects AABB-only overlaps',()=>{
  const guard=rect('rail',0,11,0,20,0,{ymin:0,ymax:6,polygon:[[0,0],[1,0],[11,20],[10,20]]});
  const s=new RoadsterSimulation(layout([rect('road',-20,20,-20,50)],{colliders:[guard]}));s.x=1;s.z=15;run(s,.1);assert.equal(s.crashTimer,0);
  s.x=8;run(s,.1);assert.equal(s.crashTimer,0);assert.equal(s.lastContact?.id,'rail');
});
test('ground driving crosses flat/downhill/flat without fictitious flight',()=>{
  const surfaces=[rect('flat',-8,8,0,20,8),rect('ramp',-8,8,20,100,8,{slope:-.1,origin_z:20}),rect('far',-8,8,100,180)];
  const s=new RoadsterSimulation(layout(surfaces,{spawn:{x:0,y:8,z:10,heading:0}}));
  for(let i=0;i<1000&&s.z<130;i++){run(s,C.step,{throttle:1});assert.ok(s.grounded);assert.ok(Math.abs(s.y-topAt(s.surface,s.x,s.z))<1e-7);}
  assert.equal(s.surfaceId,'far');assert.equal(s.flight,0);assert.equal(s.landingCount,0);assert.equal(s.crashes,0);
});
test('cross-slope ground velocity inherits slopeX as well as slopeZ',()=>{
  const face=rect('bank',-20,80,-10,10,0,{slopeX:.1,origin_x:0});
  const s=new RoadsterSimulation(layout([face],{spawn:{x:0,y:0,z:0,heading:Math.PI/2}}));run(s,2,{throttle:1});
  assert.ok(s.grounded);assert.ok(Math.abs(s.y-s.x*.1)<1e-8);assert.ok(Math.abs(s.vy-s.vx*.1)<1e-8);assert.equal(s.flight,0);
});
test('landing impact is relative to the downhill tangent and preserves horizontal motion',()=>{
  const face=rect('ramp',-10,10,0,100,10,{slope:-.1,origin_z:0}),s=new RoadsterSimulation(layout([face]));
  Object.assign(s,{x:0,z:40,y:6.005,vx:0,vz:20,vy:-2,grounded:false,surfaceId:null,heading:.1,reference:0});run(s,.1);
  assert.ok(s.grounded);assert.ok(s.lastLanding.impact<1);assert.ok(s.speed>19);assert.ok(Math.abs(s.vy+s.vz*.1)<1e-8);
});
test('moving safe contact activates only the current group checkpoint',()=>{
  const face=rect('apron-piece-1',-14,14,0,80,0,{group:'apron'}),high=rect('high-piece-1',20,40,90,150,8,{group:'high'});
  const s=new RoadsterSimulation(layout([face,high],{checkpoints:[{surface:'apron',x:0,z:30,heading:0},{surface:'high',x:30,z:120,heading:0}]}));
  s.vz=20;run(s,.8);assert.equal(s.checkpoint.surface,'apron-piece-1');assert.ok(s.speed>12);
  s.recover();assert.equal(s.surfaceId,'apron-piece-1');assert.equal(s.pressure,100);assert.equal(s.speed,0);
});
test('checkpoint activation spans sampled faces instead of requiring one tiny quad',()=>{
 const faces=Array.from({length:40},(_,i)=>rect('curve-piece-'+i,-8,8,i,i+1,0,{group:'curve'}));
 const s=new RoadsterSimulation(layout(faces,{checkpoints:[{surface:'curve',x:0,z:12,heading:0}]}));
 s.vz=8;run(s,1);assert.ok(s.checkpoint.surface.startsWith('curve-piece-'));assert.equal(s.checkpoint.z,12);s.recover();assert.equal(s.group,'curve');assert.equal(s.z,12);
});
test('ground contact underneath the high deck cannot activate its checkpoint',()=>{
 const lower=rect('lower-road',20,40,330,395,0,{group:'lower-bypass',route:'ground-bypass'}),upper=rect('high',20,40,338,393,8,{group:'high',route:'upper'});
 const s=new RoadsterSimulation(layout([lower,upper],{spawn:{x:30,y:0,z:350,heading:0},checkpoints:[{surface:'high',x:30,z:366,heading:0}]}));
 run(s,1,{throttle:1});assert.equal(s.group,'lower-bypass');assert.equal(s.checkpoint.surface,'lower-road');assert.equal(s.checkpoint.y,0);
});
test('continuous ground bypass can finish without a fabricated far landing event',()=>{
  const s=new RoadsterSimulation(layout([rect('lower',-8,8,0,40,0,{route:'ground-bypass'}),rect('exit-piece',-8,8,40,100,0,{group:'far',route:'ground-bypass'})],{exit:{surface:'far',xmin:-8,xmax:8,z:70}}));
  run(s,6,{throttle:1});assert.equal(s.complete,true);assert.equal(s.landingCount,0);assert.equal(s.flight,0);
});
test('flight above the exit is not completed by previous grounded contact',()=>{
  const s=new RoadsterSimulation(layout([rect('far',-8,8,0,100)],{exit:{surface:'far',xmin:-8,xmax:8,z:70}}));
  Object.assign(s,{z:69,y:4,vz:12,grounded:false,surfaceId:null,groundContacts:['far']});run(s,.2);assert.ok(s.z>70);assert.equal(s.complete,false);
});
test('lift responds immediately and reaches ninety percent in the specified build interval',()=>{
  const s=new RoadsterSimulation(layout([rect('start',-20,20,-20,100)]));run(s,C.step,{lift:true});assert.ok(s.forces.lift>0);
  run(s,.14,{lift:true});assert.ok(s.forces.lift<C.lift*.9);run(s,.07,{lift:true});assert.ok(s.forces.lift>C.lift*.9);
});
test('moving through a marked refill strip gains more gas without stopping or an air reward',()=>{
  const face=rect('high',-10,10,0,100,8),fast=layout([face],{spawn:{x:0,y:8,z:10,heading:0},refillZones:[{surface:'high',xmin:-5,xmax:5,zmin:0,zmax:80}]}),slow={...fast,refillZones:[]};
  const a=new RoadsterSimulation(fast),b=new RoadsterSimulation(slow);for(const s of[a,b]){s.pressure=40;s.vz=10;run(s,1.3);assert.ok(s.z>20);assert.ok(s.grounded);assert.equal(s.landingCount,0);}
  assert.ok(a.pressure>b.pressure+15);assert.ok(a.speed>8);
});
test('coastal reverse thrust dissipates horizontal energy for different headings without stopping gravity',()=>{
 for(const heading of[-2,0,1.5]){
  const s=new RoadsterSimulation(layout([rect('road',-100,100,-100,200)]));
  Object.assign(s,{y:70,grounded:false,surfaceId:null,vx:8,vz:14,heading,reference:heading});let energy=s.speed*s.speed;
  for(let i=0;i<240;i++){run(s,C.step,{throttle:-1});const next=s.speed*s.speed;assert.ok(next<=energy+1e-9);assert.ok(s.vx*8+s.vz*14>=-1e-9);energy=next;}
  assert.ok(s.speed<1e-5);assert.ok(s.y<50);assert.ok(s.vy< -20);
 }
});
test('held-input prediction lands across dense seams and leaves the source untouched',()=>{
  const faces=Array.from({length:30},(_,i)=>rect('dense-'+i,-8,8,-10+i,-9+i,0,{group:'curve'}));
  const s=new RoadsterSimulation(layout(faces));Object.assign(s,{x:0,z:5,y:3,vy:-1,grounded:false,surfaceId:null});
  const before=JSON.stringify(s.snapshot()),p=s.predict();assert.equal(JSON.stringify(s.snapshot()),before);assert.equal(p.group,'curve');assert.equal(p.safe,true);
  while(!s.grounded&&!s.crashTimer)run(s,C.step);assert.ok(Math.abs(s.z-p.z)<1e-8);assert.equal(s.group,p.group);
});
