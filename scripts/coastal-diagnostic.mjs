import {readFileSync,writeFileSync}from'node:fs';
import {RoadsterSimulation}from'../src/roadster/simulation.js';
import {ROADSTER as C}from'../src/roadster/config.js';
export const layout=JSON.parse(readFileSync('public/assets/coastal-interchange-layout.json','utf8'));
export const fresh=()=>new RoadsterSimulation(layout);
export function advance(s,seconds,input={}){s.input={throttle:0,steer:0,lift:false,...input};for(let i=0;i<Math.round(seconds/C.step)&&!s.complete&&!s.crashTimer;i++)s.step(C.step);}
export function until(s,test,input={},max=40){s.input={throttle:0,steer:0,lift:false,...input};for(let i=0;i<max/C.step&&!test(s)&&!s.complete&&!s.crashTimer;i++)s.step(C.step);return s;}
export function roadX(z){if(z<204)return 0;if(z<284){const t=(z-204)/80;return 20*t*t*(3-2*t);}return z<338?20:30;}
export function groundCommand(s,targetX,targetZ,speed){
 const desired=Math.atan2(targetX-s.x,targetZ-s.z),error=Math.atan2(Math.sin(desired-s.heading),Math.cos(desired-s.heading));
 const max=C.coastalSteerHigh+(C.steerLow-C.coastalSteerHigh)/(1+(s.speed/9)**2);
 const steer=Math.max(-1,Math.min(1,Math.atan2(2*C.wheelbase*Math.sin(error),Math.max(5,Math.hypot(targetX-s.x,targetZ-s.z)))/max));
 return{throttle:s.speed>speed+.5?-1:s.speed<speed-.5?1:0,steer,lift:false};
}
export function mainRoute({launch=100,short=.45,upperLift=1.1,side=.6,brake=.5}={}){
 const s=fresh(),phases=[];until(s,s=>s.z>=launch,{throttle:1});advance(s,short,{throttle:1,lift:true});until(s,s=>s.grounded&&s.group==='landing',{throttle:1});phases.push({name:'bridge-contact',...s.snapshot()});
 for(let i=0;i<6000&&!s.crashTimer&&s.z<314;i++){
  const speed=s.z<185?25:s.z<285?17:8.5,targetZ=s.z+10,targetX=roadX(targetZ);
  advance(s,C.step,groundCommand(s,targetX,targetZ,speed));
 }phases.push({name:'upper-approach',...s.snapshot()});
 const at=s.time,old=s.landingCount;
 for(let i=0;i<1600&&!s.crashTimer&&s.landingCount===old;i++){
  const t=s.time-at;advance(s,C.step,{throttle:t<1.4?1:t<1.4+brake?-1:0,steer:t>.25&&t<.25+side?1:0,lift:t<upperLift});
 }phases.push({name:'upper-contact',...s.snapshot()});
 for(let i=0;i<6000&&!s.crashTimer&&!s.complete;i++)advance(s,C.step,groundCommand(s,30,s.z+12,18));
 return{s,phases};
}
if(process.argv[1]?.endsWith('coastal-diagnostic.mjs')){
 const records=[];for(const upperLift of[1,1.1,1.2])for(const side of[.4,.6]){const r=mainRoute({upperLift,side});records.push({options:{upperLift,side},complete:r.s.complete,crashes:r.s.crashes,phases:r.phases,end:r.s.snapshot()});}
 writeFileSync('docs/coastal-main-diagnostic.json',JSON.stringify({method:'Legal fixed-step controls from actual normal spawn against real coastal layout; no position/velocity/gas/completion injection. Diagnostic feedback control, not native or human play.',records},null,2));
 console.log(JSON.stringify(records.map(r=>({options:r.options,complete:r.complete,crash:r.end.reason,phases:r.phases.map(p=>({name:p.name,x:p.x,y:p.y,z:p.z,head:p.heading,speed:p.speed,group:p.group,gas:p.pressure,impact:p.lastLanding?.impact}))})),null,2));
}
