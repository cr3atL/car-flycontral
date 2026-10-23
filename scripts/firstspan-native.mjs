import {chromium}from'@playwright/test';
import {readFileSync,writeFileSync,mkdirSync}from'node:fs';
import {createHash}from'node:crypto';
import {roadX,groundCommand}from'./coastal-diagnostic.mjs';
import {bypassPath,pathCommand}from'./coastal-ground-diagnostic.mjs';

const mobile=process.argv.includes('--mobile'),production=process.argv.includes('--production'),width=Number(process.argv.find(x=>x.startsWith('--width='))?.split('=')[1]??844),scenario=process.argv.find(x=>x.startsWith('--scenario='))?.split('=')[1]??'main',tag=(mobile?'touch-'+width:'pc')+(scenario==='main'?'':'-'+scenario),mediaPrefix=`coastal-art-${production?'production-':''}native-${tag}`;
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:mobile?{width,height:width===667?375:390}:{width:1280,height:720},hasTouch:mobile,isMobile:mobile});
const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[],actions=[],phases=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});mkdirSync('docs/screenshots',{recursive:true});
let held=new Set(),touches=[],stick,jet,lastState,started=Date.now();
const state=async()=>lastState=await page.evaluate(()=>(window.__ROADSTER_READONLY__??window.__ROADSTER_DEV__).getState());
const compact=s=>({time:s.time,x:s.x,y:s.y,z:s.z,heading:s.heading,pitch:s.pitch,roll:s.roll,vx:s.vx,vy:s.vy,vz:s.vz,speed:s.speed,pressure:s.pressure,group:s.group,surface:s.surface,grounded:s.grounded,complete:s.complete,crashTimer:s.crashTimer,reason:s.reason});
async function input({throttle=0,steer=0,lift=false}={}){
 actions.push({wallMs:Date.now()-started,observed:lastState&&compact(lastState),input:{throttle,steer,lift}});
 if(!mobile){
  const next=new Set([throttle>.05?'KeyW':throttle<-.05?'KeyS':null,steer>.05?'KeyD':steer<-.05?'KeyA':null,lift?'Space':null].filter(Boolean));
  for(const k of held)if(!next.has(k))await page.keyboard.up(k);for(const k of next)if(!held.has(k))await page.keyboard.down(k);held=next;return;
 }
 const next=[];if(throttle||steer)next.push({id:1,x:stick.x+(steer?Math.sign(steer)*(5+43*Math.abs(steer)):0),y:stick.y-(throttle?Math.sign(throttle)*(5+43*Math.abs(throttle)):0),radiusX:5,radiusY:5,force:1});
 if(lift)next.push({id:2,...jet,radiusX:5,radiusY:5,force:1});
 const before=touches.map(p=>p.id),after=next.map(p=>p.id),ended=touches.filter(p=>!after.includes(p.id));
 // Chromium touchEnd names the points that ended, not the remaining contacts.
 if(ended.length)await cdp.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:ended});
 if(after.some(id=>!before.includes(id)))await cdp.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:next.map(p=>before.includes(p.id)?p:{...p,...(p.id===1?stick:jet)})});
 if(next.length)await cdp.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:next});touches=next;
}
async function until(test,timeout=30000){const at=Date.now();for(;;){const s=await state();if(s.crashTimer||s.events.some(e=>e.type==='reset'))throw Error('Actual crash/reset: '+JSON.stringify(compact(s)));if(test(s)||s.complete)return s;if(Date.now()-at>timeout)throw Error('Native wait timeout');await page.waitForTimeout(10);}}
async function hold(seconds,values){const at=(await state()).time;await input(values);return until(s=>s.time>=at+seconds);}
async function checkpoint(name){const s=await state();phases.push({name,wallMs:Date.now()-started,...s});}
async function driveTo(z,upper=false){
 for(let i=0;i<1700;i++){
  const s=await state();if(s.z>=z||s.complete)return;if(!s.grounded)throw Error('Unexpected departure in ground segment '+JSON.stringify(compact(s)));
  const speed=upper?18:s.z<185?25:s.z<285?17:8.5,look=upper?12:10,targetX=upper?30:roadX(s.z+look),cmd=groundCommand(s,targetX,s.z+look,speed);
  if(!mobile){const error=Math.atan2(Math.sin(Math.atan2(targetX-s.x,look)-s.heading),Math.cos(Math.atan2(targetX-s.x,look)-s.heading));cmd.steer=Math.abs(error)<.035?0:Math.sign(error);}
  await hold(.065,cmd);
 }throw Error('Ground controller exhausted');
}
async function drivePath(path,finish){
 const cursor={i:0};let group=null;
 for(let i=0;i<2200;i++){
  const s=await state();if(finish(s))return;if(!s.grounded)throw Error('Ground path left its surface: '+JSON.stringify(compact(s)));
  if(s.group!==group){group=s.group;phases.push({name:'ground-'+group,wallMs:Date.now()-started,...s});}
  const cmd=pathCommand(s,path,cursor,8);
  if(!mobile){const error=Math.atan2(Math.sin(Math.atan2(cmd.target.x-s.x,cmd.target.z-s.z)-s.heading),Math.cos(Math.atan2(cmd.target.x-s.x,cmd.target.z-s.z)-s.heading));cmd.steer=Math.abs(error)<.035?0:Math.sign(error);}
  await hold(.065,cmd);
 }throw Error('Ground path exhausted');
}
const hash=p=>createHash('sha256').update(readFileSync(p)).digest('hex');
const record={production,scenario,environment:'Windows / headless Microsoft Edge, normal real-time render loop. Native keyboard or two independent touch points. Read-only state feedback controller, not human play; no advance/setManual/state writes.',viewport:mobile?{width,height:width===667?375:390}:{width:1280,height:720},source:{simulation:hash('src/roadster/simulation.js'),geometry:hash('src/roadster/geometry.js'),config:hash('src/roadster/config.js'),main:hash('src/roadster/main.js'),layout:hash('public/assets/coastal-interchange-layout.json'),glb:hash('public/assets/coastal-interchange.glb')},phases,actions,errors};
try{
 await page.goto(`http://localhost:${production?4173:5173}/roadster.html${production?'?qa=1':''}`);await page.waitForFunction(()=>window.__ROADSTER_READONLY__||window.__ROADSTER_DEV__,{},{timeout:40000});
 record.bundle=await page.locator('script[type="module"][src]').first().getAttribute('src');
 if(production){const api=await page.evaluate(()=>({dev:!!window.__ROADSTER_DEV__,keys:Object.keys(window.__ROADSTER_READONLY__)}));if(api.dev||api.keys.join(',')!=='getState')throw Error('Production observer must be read-only without DEV controls');record.observer=api;}
 await page.click('#roadster-start');
 if(mobile){for(const [name,id]of[['stick','#roadster-stick'],['jet','#roadster-jet']]){const b=await page.locator(id).boundingBox();const p={x:b.x+b.width/2,y:b.y+b.height/2};if(name==='stick')stick=p;else jet=p;}}
 if(scenario==='ground'){
  await drivePath(bypassPath,s=>s.complete);await input();record.end=await state();record.pass=record.end.complete&&record.end.events.every(e=>e.type!=='takeoff'&&e.type!=='landing');
 }else if(scenario==='recovery'){
  await input({throttle:1});await until(s=>!s.grounded);await input({throttle:-1});await until(s=>s.grounded&&s.group==='recovery');await hold(.6,{throttle:-1});await checkpoint('lower-contact');
  const s=await state(),returnTop=(await import('./coastal-diagnostic.mjs')).layout.surfaces.filter(f=>f.group==='return-top').map(f=>f.polygon.reduce((p,[x,z])=>({x:p.x+x/4,z:p.z+z/4}),{x:0,z:0}));
  const path=[{x:s.x,z:s.z},{x:0,z:150},{x:-22,z:150},{x:-28,z:130},{x:-28,z:110},{x:-28,z:48},...returnTop,{x:0,z:24}];
  await drivePath(path,s=>s.group==='start'&&s.z<30);await input();record.end=await state();record.pass=record.end.grounded&&record.end.group==='start'&&record.end.events.filter(e=>e.type==='takeoff').length===1&&record.end.events.filter(e=>e.type==='landing').length===1;
 }else{
 await input({throttle:1});await until(s=>s.z>=100);await checkpoint('first-approach');await hold(.45,{throttle:1,lift:true});await checkpoint('first-flight');await input({throttle:1});await until(s=>s.grounded&&s.group==='landing');await checkpoint('bridge-contact');
 await driveTo(314);await checkpoint('upper-approach');
 await hold(.25,{throttle:1,lift:true});await hold(.4,{throttle:1,steer:1,lift:true});await hold(.35,{throttle:1,lift:true});await hold(.4,{throttle:1});await hold(.5,{throttle:-1});await input();await until(s=>s.grounded&&s.group==='high');await checkpoint('upper-contact');
 await driveTo(515,true);await input();await page.waitForTimeout(50);record.end=await state();record.pass=record.end.complete&&record.end.grounded&&record.end.group==='far'&&record.end.visits.high>0&&record.end.visits.landing>0;
 }
 await page.screenshot({path:`docs/screenshots/${mediaPrefix}-complete.png`});
 if(production&&scenario==='main'){
  await page.goto('http://localhost:4173/roadster.html');await page.waitForFunction(()=>!document.getElementById('roadster-start').disabled);
  record.ordinaryEntry=await page.evaluate(()=>({readonly:!!window.__ROADSTER_READONLY__,dev:!!window.__ROADSTER_DEV__,bundle:document.querySelector('script[type="module"][src]').getAttribute('src')}));
  if(record.ordinaryEntry.readonly||record.ordinaryEntry.dev)throw Error('Ordinary production entry exposes diagnostics');
 }
}catch(e){await input().catch(()=>{});record.pass=false;record.failure=String(e);record.end=await state().catch(()=>null);await page.screenshot({path:`docs/screenshots/${mediaPrefix}-failure.png`}).catch(()=>{});}
record.wallMs=Date.now()-started;const output=`docs/${mediaPrefix}.json`;writeFileSync(output,JSON.stringify(record,null,2));console.log(JSON.stringify({path:output,pass:record.pass,failure:record.failure,wallMs:record.wallMs,phases:phases.map(p=>({name:p.name,...compact(p)})),end:record.end&&compact(record.end),errors}));await browser.close();if(!record.pass)process.exitCode=1;
