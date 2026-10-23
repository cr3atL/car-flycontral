import{writeFileSync}from'node:fs';
import{fresh,layout,advance,groundCommand,roadX}from'./coastal-diagnostic.mjs';

const centres=group=>layout.surfaces.filter(s=>s.group===group).map(s=>s.polygon.reduce((p,[x,z])=>({x:p.x+x/s.polygon.length,z:p.z+z/s.polygon.length}),{x:0,z:0}));
export const bypassPath=[{x:0,z:12},{x:0,z:62},...centres('ground-bypass'),...Array.from({length:23},(_,i)=>{const z=200+i*4.5;return{x:roadX(z),z};}),...centres('lower-bypass'),{x:30,z:505},{x:30,z:515}];
export function pathCommand(s,path,cursor,speed=8){
 let nearest=null;
 for(let i=cursor.i;i<Math.min(path.length-1,cursor.i+10);i++){
  const a=path[i],b=path[i+1],dx=b.x-a.x,dz=b.z-a.z,l2=dx*dx+dz*dz,t=Math.max(0,Math.min(1,((s.x-a.x)*dx+(s.z-a.z)*dz)/l2)),x=a.x+dx*t,z=a.z+dz*t,d=Math.hypot(s.x-x,s.z-z);
  if(!nearest||d<nearest.d)nearest={i,t,x,z,d};
 }
 cursor.i=nearest.i;let from={x:nearest.x,z:nearest.z},distance=8,target=from;
 for(let i=nearest.i+1;i<path.length;i++){
  const to=path[i],len=Math.hypot(to.x-from.x,to.z-from.z);
  if(len>=distance){target={x:from.x+(to.x-from.x)*distance/len,z:from.z+(to.z-from.z)*distance/len};break;}
  distance-=len;from=to;target=to;
 }
 return{...groundCommand(s,target.x,target.z,speed),target,index:cursor.i};
}
export function bypassRoute(){const s=fresh(),cursor={i:0},phases=[],seen=new Set();for(let i=0;i<30000&&!s.complete&&!s.crashTimer;i++){
 const command=pathCommand(s,bypassPath,cursor);advance(s,1/120,command);if(!seen.has(s.group)){seen.add(s.group);phases.push(s.snapshot());}
 if(!s.grounded)break;
 }return{s,phases,cursor};}
if(process.argv[1]?.endsWith('coastal-ground-diagnostic.mjs')){const r=bypassRoute();writeFileSync('docs/coastal-ground-diagnostic.json',JSON.stringify({method:'Legal fixed-step from normal spawn, no lift and actual coastal road geometry. Diagnostic feedback only.',phases:r.phases,end:r.s.snapshot()},null,2));console.log(JSON.stringify({complete:r.s.complete,reason:r.s.reason,x:r.s.x,y:r.s.y,z:r.s.z,group:r.s.group,flight:r.s.flight,phases:r.phases.map(s=>({group:s.group,x:s.x,z:s.z,time:s.time}))}));}
