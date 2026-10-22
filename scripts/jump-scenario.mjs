import {GameSession} from '../src/challenge.js';
import {CONFIG as C} from '../src/config.js';
import {writeFileSync} from 'node:fs';
function route({launch=70,turn=0,hold=1,assist=true}){
 const g=new GameSession();g.start('practice');g.sim.assist=assist;let at=null;const trace=[];
 for(let i=0;i<4000;i++){const s=g.sim;if(at===null&&s.z>=launch){at=s.time;s.queueBoostPress();}const age=at===null?-1:s.time-at,r=age>=.45&&age<.45+turn;s.input={steer:0,boost:age>=0&&age<hold,roll:r?1:0,pitch:r?-1:0,yaw:r?1:0};g.tick(C.step);if(i%12===0)trace.push({time:s.time,z:s.z,y:s.y,main:s.mainPressure,supply:s.airSupplyUsed,pitch:s.pitch,roll:s.roll,yaw:s.yaw,input:{...s.input}});if(g.oneJump.state.result||s.crashTimer)break;}
 return{launch,turn,hold,assist,practice:g.oneJump.snapshot(),crashes:g.sim.crashes,total:g.sim.score.total,events:g.sim.events,ledger:g.sim.ledger,trace};
}
const routes=[55,70,85].flatMap(launch=>[0,1.2].map(turn=>route({launch,turn}))),assistOff=route({turn:1.2,assist:false}),missedRing=route({hold:2.5});
for(const r of routes)if(!r.practice.result?.complete||r.crashes)throw Error('normal route failed');if(!assistOff.crashes||assistOff.practice.result?.complete)throw Error('assist off unexpectedly hides bad pose');if(missedRing.practice.ringCrossed||missedRing.practice.result?.complete)throw Error('missed ring awarded objective');
writeFileSync('docs/jump-scenarios.json',JSON.stringify({method:'120Hz fixed-step ordinary input routes, no position/pose/pressure/reward writes. Assist-off is an explicit setting fixture. Not native speed or real hardware.',routes,assistOff,missedRing},null,2));console.log(JSON.stringify(routes.map(r=>({launch:r.launch,turn:r.turn,ring:r.practice.ringActual,grade:r.practice.landing.grade,z:r.practice.landing.z})),null,2));
