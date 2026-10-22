import { GameSession } from './challenge.js';
import { CONFIG as C } from './config.js';
/** Fixed-step actual held inputs, never calls score/reward or moves the car. */
export function challengePilotTick(session,memory,{combo=false,rewards=false}={}){
 const s=session.sim;s.input={boost:false,steer:0,roll:0,pitch:0};memory.launched??=new Set();if(!session.playable)return;
 const g=session.groups.find(g=>g.status==='active');
 if(rewards&&g&&!g.tutorial&&s.grounded){const target=g.ringX??0;s.input.steer=Math.max(-.7,Math.min(.7,(target-s.x)*.55-s.vx*.35));}
 const token=g&&g.id+':'+(g.attempt??0);
 if(g&&!memory.launched.has(token)&&s.grounded&&g.z-s.z<=g.launch){memory.launched.add(token);memory.launchTime=s.time;memory.hold=combo&&!g.tutorial&&!g.ceiling?1.5:g.hold;memory.rotate=g.id===2?'short':combo&&!g.tutorial&&!g.ceiling?'dual':null;s.queueBoostPress();}
 if(session.tutorial.stage==='repeat'&&!memory.repeatDone&&session.elapsed>=16&&s.grounded&&s.energy>=.82){memory.repeatDone=true;memory.launchTime=s.time;memory.hold=.025;memory.rotate='hold';s.queueBoostPress();}
 const t=s.time-(memory.launchTime??-99);if(t<memory.hold)s.input.boost=true;
 if(!s.grounded){
  if(memory.rotate==='short'&&t>=.3&&t<.45)s.input.roll=1;
  if(memory.rotate==='hold'&&t>=.25&&t<1.4)s.input.roll=1;
  if(memory.rotate==='dual'&&t>=.3&&t<(g?.ceiling?1.35:1.65)){s.input.roll=1;s.input.pitch=g?.ceiling?0:-1;}
 }
}
export function runChallengeScenario(options={}){
 const session=new GameSession();session.start();const memory={launched:new Set()},trace=[];
 for(let i=0;i<94/C.step&&session.phase!=='results';i++){const controlGrounded=session.sim.grounded;challengePilotTick(session,memory,options);session.tick(C.step);if(i%12===0)trace.push({controlGrounded,elapsed:session.elapsed,z:session.sim.z,y:session.sim.y,vy:session.sim.vy,pressure:session.sim.mainPressure,score:session.sim.score.total,pending:session.sim.score.pending,stage:session.tutorial.stage,buffer:{...session.sim.buffer},input:{...session.sim.input},omega:{roll:session.sim.attitude.roll.omega,pitch:session.sim.attitude.pitch.omega},group:session.groups.find(g=>g.status==='active')?.id});}
 return{result:session.result,tutorial:session.tutorial,groups:session.snapshot().groups,trace,events:session.sim.events,ledger:session.sim.ledger};
}
