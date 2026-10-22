import { chromium } from '@playwright/test';
import { writeFileSync, mkdirSync } from 'node:fs';
// Native keyboard / Chromium touch events only. The DEV hook is read-only here.
const mobile=process.argv.includes('--mobile'), route=process.argv.find(v=>v.startsWith('--route='))?.split('=')[1]??'direct', repeats=Number(process.argv.find(v=>v.startsWith('--repeats='))?.split('=')[1]??1),width=Number(process.argv.find(v=>v.startsWith('--width='))?.split('=')[1]??915),height=width===667?375:412,tag=mobile?`mobile-${width}`:'pc';
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:mobile?{width,height}:{width:1280,height:720},hasTouch:mobile,isMobile:mobile});
const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[];page.on('pageerror',e=>errors.push(e.message));
const results=[];mkdirSync('docs/screenshots',{recursive:true});
let held=new Set(),touches=[],stick,jet,actions=[],trialAt=Date.now(),lastState;
const state=async()=>lastState=await page.evaluate(()=>window.__ROADSTER_DEV__.getState());
const compact=s=>({time:s.time,x:s.x,y:s.y,z:s.z,heading:s.heading,pitch:s.pitch,roll:s.roll,vx:s.vx,vy:s.vy,vz:s.vz,speed:s.speed,pressure:s.pressure,grounded:s.grounded,surface:s.surface,visits:s.visits,complete:s.complete,events:s.events,reason:s.reason});
async function controls({throttle=0,steer=0,lift=false}={}){
 actions.push({wallMs:Date.now()-trialAt,observedTime:lastState?.time,input:{throttle,steer,lift},observed:lastState&&compact(lastState)});
 if(!mobile){const next=new Set([throttle>0?'KeyW':throttle<0?'KeyS':null,steer>0?'KeyD':steer<0?'KeyA':null,lift?'Space':null].filter(Boolean));for(const k of held)if(!next.has(k))await page.keyboard.up(k);for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=next;return;}
 const next=[];if(throttle||steer)next.push({id:1,x:stick.x+steer*55,y:stick.y-throttle*55,radiusX:5,radiusY:5,force:1});if(lift)next.push({id:2,x:jet.x,y:jet.y,radiusX:5,radiusY:5,force:1});
 // Start each pointer in its target before moving the captured stick beyond its bounds.
 const before=touches.map(p=>p.id),after=next.map(p=>p.id),removed=before.some(id=>!after.includes(id)),added=after.some(id=>!before.includes(id));
 if(removed){const ended=touches.filter(p=>!after.includes(p.id));await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:ended});touches=touches.filter(p=>after.includes(p.id));}
 if(added){const start=next.map(p=>before.includes(p.id)?p:{...p,x:p.id===1?stick.x:jet.x,y:p.id===1?stick.y:jet.y});await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:start});}
 if(next.length)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:next});touches=next;
}
async function until(test,{timeout=20000}={}){const at=Date.now();for(;;){const s=await state();if(test(s)||s.complete)return s;if(s.crashTimer||s.events?.some(e=>e.type==='reset'))throw Error('crash/reset: '+JSON.stringify(compact(s)));if(Date.now()-at>timeout)throw Error('native wait timeout '+JSON.stringify(compact(s)));await page.waitForTimeout(12);}}
async function forTime(seconds,input){const at=(await state()).time;await controls(input);return until(s=>s.time>=at+seconds);}
async function stop(){await controls();await page.waitForTimeout(50);}
async function exit(){
 // Observe then issue ordinary short steering/throttle pulses. No pose or velocity writes.
 for(let i=0;i<130;i++){const s=await state();if(s.complete)return s;if(s.crashTimer)throw Error('crashed driving to exit');const desired=Math.atan2(-s.x,Math.max(6,220-s.z)),error=Math.atan2(Math.sin(desired-s.heading),Math.cos(desired-s.heading));
  const steer=Math.abs(error)<.035?0:Math.sign(error);await forTime(.09,{throttle:1,steer});
 }throw Error('exit timeout');
}
async function aimFromPlatform(){
 let reached=false;
 for(let i=0;i<90;i++){const s=await state(),desired=Math.atan2(-s.x,175-s.z),err=Math.atan2(Math.sin(desired-s.heading),Math.cos(desired-s.heading));if(Math.abs(err)<.1)reached=true;
  if(reached){await controls({throttle:-1});await until(s=>s.speed<.1);await stop();return;}
  await forTime(.06,{throttle:s.speed>5?-1:1,steer:Math.sign(err)});
 }throw Error('platform aiming timeout');
}
for(let trial=1;trial<=repeats;trial++){
 actions=[];trialAt=Date.now();const log={mobile,viewport:mobile?{width,height}:{width:1280,height:720},route,trial,method:'Automated native real-time keyboard / two independent touch pointers; read-only state feedback steers after platform / toward exit. Not manual human usability evidence. No advance/setManual/state writes.',phases:[],actions,errors};
 try{
  held=new Set();touches=[];await page.goto('http://127.0.0.1:5173/roadster.html');await page.waitForFunction(()=>window.__ROADSTER_DEV__,{},{timeout:30000});await page.click('#roadster-start');
  if(mobile)for(const [name,id]of[['stick','#roadster-stick'],['jet','#roadster-jet']]){const r=await page.locator(id).boundingBox();if(name==='stick')stick={x:r.x+r.width/2,y:r.y+r.height/2};else jet={x:r.x+r.width/2,y:r.y+r.height/2};}
  if(route==='return'){
   await controls({throttle:1});await until(s=>!s.grounded);await controls({throttle:-1});await until(s=>s.grounded&&s.surface==='recovery');await forTime(1,{throttle:-1});await stop();log.phases.push({name:'lower-contact',...compact(await state())});
   for(const [x,z]of [[0,172],[-30,172],[-49,153],[-63,130],[-64,112],[-64,36],[-64,23.5],[-53,20],[-35,20],[-5,20]]){
    for(let i=0;i<1300;i++){const s=await state();if(Math.hypot(x-s.x,z-s.z)<2.8)break;if(s.crashTimer||!s.grounded)throw Error('left ground during return '+JSON.stringify(compact(s)));const desired=Math.atan2(x-s.x,z-s.z),err=Math.atan2(Math.sin(desired-s.heading),Math.cos(desired-s.heading)),speed=Math.abs(err)>.45?3.5:7;await forTime(.06,{throttle:s.speed>speed?-1:1,steer:Math.abs(err)<.035?0:Math.sign(err)});}
    log.phases.push({name:`ground-waypoint-${x}-${z}`,...compact(await state())});
   }
  }else{
  await controls({throttle:1});await until(s=>s.z>=(route==='direct'?108:route==='low'||route==='change'?70:80));await stop();log.phases.push({name:'launch',...compact(await state())});
  if(route==='direct'){await forTime(.5,{throttle:1,lift:true});await controls({throttle:1});await until(s=>s.complete);}
  else if(route==='change'){
   await forTime(1,{steer:-1,lift:true});await forTime(.25,{steer:-1});await forTime(.35,{throttle:-1,steer:-1});await forTime(.2,{throttle:-1});const before=await state();log.phases.push({name:'predicted-low-before-change',prediction:before.prediction,...compact(before)});if(before.prediction?.surface!=='low')throw Error('initial prediction did not show low platform');
   await forTime(.3,{steer:-1,lift:true});await forTime(.6,{steer:-1});for(let i=0;i<130;i++){const s=await state();if(s.grounded)break;await forTime(.05,{throttle:-1,lift:s.y<5&&s.vy< -14});}await stop();log.phases.push({name:'changed-to-lower-road',...compact(await state())});
  }
  else{
   const sign=route==='low'?-1:1;await forTime(1,{steer:sign,lift:true});await forTime(.25,{steer:sign});await forTime(route==='low'?.35:.65,{throttle:-1,steer:sign});await controls({throttle:-1});await until(s=>s.grounded&&s.surface===route&&s.speed<.1);await stop();log.phases.push({name:'platform-contact',...compact(await state())});
   await controls();await until(s=>s.pressure>99.9);await aimFromPlatform();log.phases.push({name:'second-launch',...compact(await state())});
   const lift=route==='low'?.9:.7,push=route==='low'?2.4:2.1;await forTime(lift,{throttle:1,lift:true});await forTime(push-lift,{throttle:1});await controls({throttle:-1});await until(s=>s.grounded&&s.surface==='far');await forTime(.6,{throttle:-1});await stop();log.phases.push({name:'far-contact',...compact(await state())});await exit();
  }}
  await stop();const end=await state();log.end=compact(end);log.pass=route==='return'?end.surface==='start'&&end.grounded:route==='change'?end.surface==='recovery'&&end.grounded&&end.visits.low===0:!!end.complete&&(route==='direct'||end.visits?.[route]>0);await page.screenshot({path:`docs/screenshots/roadster-native-${tag}-${route}-${trial}.png`});
 }catch(e){await stop().catch(()=>{});log.pass=false;log.failure=String(e);log.end=compact(await state().catch(()=>({})));await page.screenshot({path:`docs/screenshots/roadster-native-${tag}-${route}-${trial}-failure.png`}).catch(()=>{});}
 log.wallMs=Date.now()-trialAt;results.push(log);writeFileSync(`docs/roadster-native-${tag}-${route}.json`,JSON.stringify(results,null,2));console.log(JSON.stringify({trial,route,mobile,pass:log.pass,failure:log.failure,phases:log.phases.map(p=>({name:p.name,x:p.x,z:p.z,heading:p.heading,speed:p.speed})),end:log.end}));if(!log.pass)break;
}
await browser.close();if(results.some(r=>!r.pass)||results.length!==repeats)process.exitCode=1;
