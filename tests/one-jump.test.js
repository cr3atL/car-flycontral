import test from 'node:test';
import assert from 'node:assert/strict';
import {GameSession} from '../src/challenge.js';
import {CONFIG as C} from '../src/config.js';
import {landingDip,suspensionY} from '../src/presentation-model.js';
import {constructionBoxes} from '../src/one-jump-config.js';
const run=(launch,turn=0)=>{const g=new GameSession();g.start('practice');let at=null;for(let i=0;i<1800;i++){const s=g.sim;if(at===null&&s.z>=launch){at=s.time;s.queueBoostPress();}const age=at===null?-1:s.time-at;const rotating=age>=.45&&age<.45+turn;s.input={boost:age>=0&&age<1,roll:rotating?1:0,pitch:rotating?-1:0,yaw:rotating?1:0,steer:0};g.tick(C.step);if(g.oneJump.state.result||s.crashTimer)return g;}return g;};
for(const z of[55,70,85])for(const turn of[0,1.2])test(`one jump physical route launch ${z}, three-axis hold ${turn}`,()=>{const g=run(z,turn),q=g.oneJump.state;assert.equal(q.result?.complete,true);assert.equal(q.landing.grade,0);assert.equal(q.cleared,true);assert.equal(q.ringCrossed,true);assert.ok(q.ringActual>0);assert.ok(q.actualSupply<=60+1e-8);assert.ok(q.landing.z>165);if(turn)assert.equal(g.sim.events.filter(e=>e.type==='stunt').length,3);});
test('construction array occupies physical lanes and cannot be driven through',()=>{assert.equal(constructionBoxes.length,15);for(const x of[-10,-5,0,5,10]){const g=new GameSession();g.start('practice');g.sim.x=x;for(let i=0;i<700&&!g.sim.crashTimer;i++)g.tick(C.step);assert.ok(g.sim.crashTimer>0);assert.match(g.oneJump.state.reason,/施工车辆/);assert.equal(g.oneJump.state.cleared,false);assert.equal(g.oneJump.state.ringCrossed,false);}});
test('rendered tire bottoms stay on real road after 360n plus small angles',async()=>{
 const {NullEngine}=await import('@babylonjs/core/Engines/nullEngine.js'),{Scene}=await import('@babylonjs/core/scene.js'),{TransformNode}=await import('@babylonjs/core/Meshes/transformNode.js'),{StandardMaterial}=await import('@babylonjs/core/Materials/standardMaterial.js'),{buildCarArt}=await import('../src/car-art.js');
 const engine=new NullEngine(),scene=new Scene(engine),body=new TransformNode('body',scene),mat=n=>new StandardMaterial(n,scene),car=buildCarArt(scene,body,mat,mat('steel'),mat('black'));
 for(const pitch of[-.04,0,.04])for(const roll of[-.04,0,.04])for(const n of[-3,-1,0,1,4]){const state={grounded:true,y:-.03,time:1,z:200,speed:30,heading:0,pitch:pitch+n*Math.PI*2,roll:roll-n*Math.PI*2};body.position.set(0,state.y+.76,0);body.rotation.set(state.pitch,0,state.roll);body.computeWorldMatrix(true);car.update(state);for(const w of car.wheelContacts(state.z))assert.ok(Math.abs(w.y)<1e-6,JSON.stringify({pitch,roll,n,w}));}
 assert.equal(suspensionY({grounded:false},0,0,.36),-.4);engine.dispose();
});
test('camera landing response is one bounded dip; pause uses simulation time, low motion has none',()=>{const e={time:1,impact:4,grade:0};assert.equal(landingDip(.9,e),0);assert.equal(landingDip(1,e),0);assert.equal(landingDip(1.6,e),0);assert.ok(landingDip(1.075,e)<-.4);assert.equal(landingDip(1.21,e,true),0);assert.equal(landingDip(1.21,{...e,grade:3}),0);for(let t=1;t<1.42;t+=.01)assert.ok(landingDip(t,e)>=-.56&&landingDip(t,e)<=0);});
