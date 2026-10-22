import test from'node:test';import assert from'node:assert/strict';import{Simulation,bodyExtents,contactHeight}from'../src/simulation.js';import{CONFIG as C}from'../src/config.js';import{steerValue}from'../src/input.js';import{NullEngine}from'@babylonjs/core/Engines/nullEngine.js';import{Scene}from'@babylonjs/core/scene.js';import{MeshBuilder}from'@babylonjs/core/Meshes/meshBuilder.js';
function fly(control,assist=true){const s=new Simulation();s.assist=assist;s.environment={hasGround:()=>true};s.queueBoostPress();const trace=[];for(let i=0;i<3600&&!s.landingCount&&!s.crashes;i++){s.input={boost:s.time<1.5,steer:0,roll:0,pitch:0,yaw:0,...control(s)};s.step(C.step);trace.push({t:s.time,y:s.y,x:s.x,vx:s.vx,yaw:s.yaw,omega:s.attitude.yaw.omega,mode:s.attitude.yaw.mode,input:{...s.input},forces:{...s.forces}});}return{s,trace};}
test('yaw short press is partial; long hold completes real circles without changing forward trajectory',()=>{
 const short=fly(s=>({yaw:s.time>=.6&&s.time<.75?-1:0}));assert.equal(short.s.events.filter(e=>e.type==='stunt').length,0);assert.ok(short.s.lastLanding.grade<2);
 const long=fly(s=>({yaw:s.time>=.6&&s.time<3.1?1:0}));assert.ok(long.s.events.filter(e=>e.type==='stunt').length>=2);assert.ok(long.s.events.filter(e=>e.type==='stunt').every(e=>e.axis==='yaw'&&Math.abs(e.omega)>6));assert.ok(long.trace.every(t=>t.x===0&&t.vx===0));assert.ok(long.s.lastLanding.grade<2);
});
test('yaw reversal brakes through zero; both directions share category and repeat20/10',()=>{
 const r=fly(s=>({boost:s.time<2.5,yaw:s.time>=.6&&s.time<2.1?1:s.time>=2.1&&s.time<4.3?-1:0}));const before=r.trace.find(t=>t.t>=2.1),mid=r.trace.find(t=>t.t>=2.25),after=r.trace.find(t=>t.t>=2.8);assert.ok(before.omega>6&&mid.omega>0&&mid.omega<before.omega&&after.omega<-6);const stunts=r.s.events.filter(e=>e.type==='stunt');assert.ok(stunts.some(e=>e.name==='yawRight')&&stunts.some(e=>e.name==='yawLeft'));assert.deepEqual(r.s.ledger.filter(e=>e.source==='stunt:yaw').slice(0,2).map(e=>e.requested),[20,10]);
});
test('yaw partial same direction resumes across zero; alternating partial arcs never farm',()=>{
 const r=fly(s=>{const t=s.time-.6;return{yaw:t>=0&&t<3&&t%.9<.3?1:0};});assert.equal(r.s.events.filter(e=>e.type==='stunt').length,1);
 const j=fly(s=>({yaw:s.time>=.6&&s.time<3.6?(Math.floor((s.time-.6)/.3)%2?-1:1):0}));assert.equal(j.s.events.filter(e=>e.type==='stunt').length,0);
});
test('three continuous axes output and incur actual integrated costs; yaw has no hidden lateral force',()=>{
 const r=fly(s=>({roll:s.time>=.6&&s.time<1.95?1:0,pitch:s.time>=.6&&s.time<1.95?-1:0,yaw:s.time>=.6&&s.time<1.95?1:0}));const t=r.trace.find(t=>t.t>=1.4);for(const axis of ['roll','pitch','yaw']){assert.ok(Math.abs(t.forces[axis])>1);const integral=r.trace.filter(t=>t.t>=.6&&t.t<1.96).reduce((sum,t)=>sum+(Math.abs(t.input[axis])>.1?Math.abs(t.forces[axis])*C.rotationGas[axis]*C.step:0),0),ledger=r.s.ledger.filter(e=>e.source==='rotation:'+axis).reduce((sum,e)=>sum+e.actual,0);assert.ok(Math.abs(integral-ledger)<1e-6);}assert.ok(r.trace.every(t=>t.forces.lateral===0));assert.ok(r.s.lastLanding.grade<2);assert.equal(r.s.events.filter(e=>e.type==='stunt').length,3);
});
test('three-axis OBB footprint matches actual renderer matrices',()=>{
 const engine=new NullEngine(),scene=new Scene(engine),box=MeshBuilder.CreateBox('proxy',{width:C.carHalfWidth*2,height:C.carCenterHeight*2,depth:C.carHalfLength*2},scene);
 for(const[pitch,roll,yaw]of [[0,0,0],[.3,.7,-.9],[1.2,-2,.5],[Math.PI/2,0,Math.PI/2],[2,2,2],[0,0,Math.PI/2]]){box.rotation.set(pitch,yaw,roll);box.computeWorldMatrix(true);const b=box.getBoundingInfo().boundingBox.extendSizeWorld,e=bodyExtents(pitch,roll,yaw);for(const[k,axis]of [['halfX','x'],['halfY','y'],['halfZ','z']])assert.ok(Math.abs(e[k]-b[axis])<1e-6);assert.ok(Math.abs(e.halfY-C.carCenterHeight-contactHeight(pitch,roll))<1e-8);}scene.dispose();engine.dispose();
});
test('landing heading/rate boundaries are physical rule fixtures; land never snaps yaw or omega',()=>{
 for(const[yaw,omega,expected]of [[0,0,0],[.6,0,1],[Math.PI/2,0,2],[Math.PI,0,3],[0,6,3]]){const s=new Simulation();s.grounded=false;s.settledFlight=false;s.yaw=yaw;s.attitude.yaw.omega=omega;s.land(3.8);assert.equal(s.lastLanding.grade,expected);assert.equal(s.yaw,yaw);assert.equal(s.attitude.yaw.omega,omega);}
});
test('assist off also disables yaw return; independent yaw braking remains',()=>{
 const yes=fly(s=>({yaw:s.time>=.6&&s.time<1?1:0}),true),no=fly(s=>({yaw:s.time>=.6&&s.time<1?1:0}),false);assert.ok(yes.trace.some(t=>t.mode==='leveling'));assert.ok(no.trace.every(t=>t.mode!=='leveling'));assert.ok(no.trace.some(t=>t.mode==='braking'));assert.ok(yes.s.lastLanding.grade<2);assert.ok(no.s.lastLanding.grade>=2);
});
test('left control absolute center is zero even with noncenter start; deadzone and opposite motion agree',()=>{for(const width of [140,158]){assert.equal(steerValue(0,width),0);assert.equal(steerValue(7,width),0);assert.ok(steerValue(-49,width)<-.9);assert.ok(steerValue(20,width)>0);assert.equal(steerValue(-20,width),-steerValue(20,width));}});
