import {chromium}from'@playwright/test';
import {readFileSync,writeFileSync,mkdirSync}from'node:fs';
import {createHash}from'node:crypto';
import {roadX,groundCommand}from'./coastal-diagnostic.mjs';
import {bypassPath,pathCommand}from'./coastal-ground-diagnostic.mjs';

const mobile=process.argv.includes('--mobile'),production=process.argv.includes('--production'),width=Number(process.argv.find(x=>x.startsWith('--width='))?.split('=')[1]??844),scenario=process.argv.find(x=>x.startsWith('--scenario='))?.split('=')[1]??'main',tag=(mobile?'touch-'+width:'pc')+(scenario==='main'?'':'-'+scenario),mediaPrefix=`coastal-art-controls-${tag}`;
const browser=await chromium.launch({channel:'msedge',headless:true}),context=await browser.newContext({viewport:mobile?{width,height:width===667?375:390}:{width:1280,height:720},hasTouch:mobile,isMobile:mobile});
const page=await context.newPage(),cdp=await context.newCDPSession(page),errors=[],actions=[],phases=[];
page.on('pageerror',e=>errors.push(e.message));page.on('console',m=>{if(m.type()==='error')errors.push(m.text());});mkdirSync('docs/screenshots',{recursive:true});
let command={};let held=new Set(),touches=[],stick,jet,lastState,started=Date.now();
const state=async()=>lastState=await page.evaluate(()=>(window.__ROADSTER_READONLY__??window.__ROADSTER_DEV__).getState());
const compact=s=>({time:s.time,x:s.x,y:s.y,z:s.z,heading:s.heading,pitch:s.pitch,roll:s.roll,vx:s.vx,vy:s.vy,vz:s.vz,speed:s.speed,pressure:s.pressure,group:s.group,surface:s.surface,grounded:s.grounded,complete:s.complete,crashTimer:s.crashTimer,reason:s.reason});
async function input({throttle=0,steer=0,lift=false}={}){
 command={throttle,steer,lift};actions.push({wallMs:Date.now()-started,observed:lastState&&compact(lastState),input:{throttle,steer,lift}});
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

const record={method:'Actual production render loop. Native keyboard/CDP touch. Read-only getState observations; no simulation stepping/state injection.',viewport:mobile?{width,height:width===667?375:390}:{width:1280,height:720},actions,phases,errors};
const resetCount=s=>s.events.filter(e=>e.type==='reset').length;
async function restart(){await input();await page.keyboard.press('Escape');await page.click('#roadster-restart');await page.waitForTimeout(100);}
function check(value,message){if(!value)throw Error(message);}
try{
 await page.goto('http://localhost:4173/roadster.html?qa=1');await page.waitForFunction(()=>window.__ROADSTER_READONLY__,{},{timeout:40000});
 record.observer=await page.evaluate(()=>({dev:!!window.__ROADSTER_DEV__,keys:Object.keys(window.__ROADSTER_READONLY__)}));check(!record.observer.dev&&record.observer.keys.join(',')==='getState','Read-only production observer');await page.click('#roadster-start');
 if(mobile){for(const [name,id]of[['stick','#roadster-stick'],['jet','#roadster-jet']]){const b=await page.locator(id).boundingBox();const p={x:b.x+b.width/2,y:b.y+b.height/2};if(name==='stick')stick=p;else jet=p;}}
 await hold(1.3,{throttle:1});await checkpoint('forward');const forward=await state();check(forward.vz>5,'Forward motor accelerates');
 await input({throttle:-1});await until(s=>s.vz< -3);await checkpoint('continuous-reverse');const reverse=await state();check(reverse.controls.throttle===-1,'S/down stayed held through zero');check(resetCount(reverse)===0,'No automatic recovery during reversal');
 await hold(.6,{throttle:-1});const cam=await state();check(Math.abs(Math.atan2(Math.sin(cam.world.camera.heading-cam.heading),Math.cos(cam.world.camera.heading-cam.heading)))<.25,'Reverse camera stays behind body');record.reverse={forwardV:forward.vz,reverseV:reverse.vz,cameraHeading:cam.world.camera.heading,bodyHeading:cam.heading};
 await restart();const before=await state(),r0=resetCount(before);await input({throttle:1,steer:1});await until(s=>!!s.lastContact,15000);await checkpoint('guard-contact');
 await hold(1.4,{throttle:1});const contact=await state();check(contact.crashTimer===0&&resetCount(contact)===r0,'Guard pressure does not trigger recovery');check(contact.grounded,'Scraping rail retains ground support');
 await input({throttle:-1});await until(s=>s.vx*Math.sin(s.heading)+s.vz*Math.cos(s.heading)<-2);await checkpoint('guard-reverse-escape');const escape=await state();check(escape.crashTimer===0&&resetCount(escape)===r0,'Contact permits reverse escape');record.contact={id:contact.lastContact.id,contactPosition:{x:contact.x,z:contact.z},escapePosition:{x:escape.x,z:escape.z},grounded:escape.grounded};
 await restart();await input({throttle:1});await until(s=>s.z>=100);await checkpoint('first-approach');await hold(.45,{throttle:1,lift:true});await checkpoint('first-flight');check(!(await state()).grounded,'First span airborne');
 await input({throttle:1});await until(s=>s.grounded&&s.landingCount>0);await checkpoint('first-landing');const landed=await state();check(!landed.crashTimer,'First span landing keeps control');check(landed.world.hero.wheelPivots===4,'Four model wheel pivots');check(landed.world.visuals.coast==='firstspan-coast.glb','Current coast active');record.end=landed;await input();await page.screenshot({path:`docs/screenshots/${mediaPrefix}-complete.png`});record.pass=errors.length===0;
}catch(e){record.pass=false;record.failure=String(e);record.end=await state().catch(()=>null);await page.screenshot({path:`docs/screenshots/${mediaPrefix}-failure.png`}).catch(()=>{});}
await input().catch(()=>{});record.wallMs=Date.now()-started;writeFileSync(`docs/${mediaPrefix}.json`,JSON.stringify(record,null,2));console.log(JSON.stringify({pass:record.pass,failure:record.failure,reverse:record.reverse,contact:record.contact,end:record.end&&compact(record.end),errors,wallMs:record.wallMs}));await browser.close();if(!record.pass)process.exitCode=1;
