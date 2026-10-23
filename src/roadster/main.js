import { surfaceAt,topAt } from './geometry.js';
import './style.css';
import { ROADSTER as C } from './config.js';
import { RoadsterSimulation } from './simulation.js';
import { RoadsterInput } from './input.js';
import { createRoadsterWorld } from './world.js';
import { RoadsterAudio } from './audio.js';

const $=id=>document.getElementById('roadster-'+id);
const text=(id,v)=>{if($(id).textContent!==String(v))$(id).textContent=v;};
let sim,world,input,paused=false,started=false,manual=false,accumulator=0,prediction=null,predictedAt=-1,predictedInput='',wasCrash=false;
const audio=new RoadsterAudio();
const mobile=()=>matchMedia('(pointer:coarse)').matches||innerWidth<=950;
const portrait=()=>innerHeight>innerWidth;
const labels={start:'起点',runway:'主直道',landing:'接收道路',curve:'沿海缓弯',apron:'检修区',high:'上层高架',ramp:'下坡',far:'出口道路',recovery:'恢复道路','ground-bypass':'沿岸绕行','lower-bypass':'下层道路','return-ramp':'回程坡道','return-top':'返回主路'};
function pause(){if(!started||paused)return;paused=true;accumulator=0;input.clear();sim.input={throttle:0,steer:0,lift:false};audio.silence();renderHud();}
function resume(){input.clear();if(portrait())return;paused=false;accumulator=0;audio.unlock();$('canvas').focus({preventScroll:true});renderHud();}
function restart(){input.clear();sim.restart();world.resetCamera(sim.heading);prediction=null;predictedAt=-1;paused=false;started=true;accumulator=0;audio.lastLanding=-1;renderHud();$('canvas').focus({preventScroll:true});audio.unlock();}
function reset(){input.clear();sim.recover();world.resetCamera(sim.heading);prediction=null;predictedAt=-1;accumulator=0;audio.lastLanding=sim.lastLanding?.time??-1;}
function menu(){input.clear();started=false;paused=false;accumulator=0;audio.silence();renderHud();$('start').focus({preventScroll:true});}
function guidance(){
  if(!started||paused||sim.complete)return '';
  const lift=mobile()?'喷气':'空格',brake=mobile()?'摇杆后推':'S';
  if(!sim.seen.drive)return mobile()?'摇杆前推加速 · 右侧喷气':'W油门 · 空格喷气';
  if(!sim.grounded){
    if(sim.z>310&&sim.z<398)return `${brake}反推减速，微调落点`;
    return sim.seen.brake?'':`${brake}反推减速，${lift}缓冲下降`;
  }
  if((sim.group==='runway'||sim.group==='start')&&sim.z>78&&sim.z<111)return `80–100km/h · 断口前短按${lift}`;
  if(sim.group==='curve')return '松油门，顺着弯道转向';
  if(sim.group==='apron')return `20–40km/h · 按住${lift}，向右微调上高架`;
  if(sim.group==='recovery')return '沿回程坡道返回，或复位重试';
  return '';
}
function renderHud(){
  if(!sim)return;
  Object.assign(document.body.dataset,{phase:!started?'menu':sim.complete?'complete':paused?'paused':'running',surface:sim.surfaceId??'air',group:sim.group??'air',route:sim.surface?.route??'air',grounded:String(sim.grounded)});
  $('menu').hidden=started;$('overlay').hidden=!started||!paused;$('finish').hidden=!started||!sim.complete||paused;
  $('rotate').hidden=!portrait();$('hud').style.visibility=started?'visible':'hidden';$('touch').style.visibility=started&&!sim.complete&&!paused?'visible':'hidden';
  text('speed',Math.round(sim.speed*3.6));text('pressure',Math.floor(sim.pressure));$('pressure-fill').style.transform=`scaleX(${sim.pressure/100})`;
  $('pressure').closest('.roadster-pressure').classList.toggle('low',sim.pressure<20);
  $('forecast').hidden=!started||paused||sim.grounded||!prediction;
  if(prediction){
    const hard=prediction.impact>C.dangerImpact||/下降冲击/.test(prediction.reason),destination=labels[prediction.group??prediction.surface]??'';
    const risk=prediction.reason?.startsWith('碰到')||prediction.reason?.startsWith('驶出')?'预计'+prediction.reason:prediction.reason;
    const message=hard?(mobile()?'下降较快 · 点喷缓冲':'下降较快 · 空格点喷缓冲'):risk||`${prediction.time.toFixed(1)}s`;
    $('forecast').classList.toggle('danger',!prediction.safe||hard);text('forecast',(destination?destination+' · ':'')+message);
  }
  const below=surfaceAt(sim.layout,sim.x,sim.z,sim.y+.05);
  $('height').hidden=sim.grounded||!started;
  text('height',`${below?'离地 '+Math.max(0,sim.y-topAt(below,sim.x,sim.z)).toFixed(1)+'m':'下方无路面'}${sim.vy< -3?' · ↓'+Math.abs(sim.vy).toFixed(0)+'m/s':''}`);
  text('tip',guidance());text('menu-help',mobile()?'左摇杆油门、方向、制动 · 右侧按住喷气':'W 油门 · S 制动 · A D 方向 · 空格喷气');
  const contact=sim.crashTimer?sim.reason:sim.recoveryNotice&&sim.time-sim.recoveryNotice.time<3?'已复位 · '+sim.recoveryNotice.reason:sim.lastLanding&&sim.time-sim.lastLanding.time<.75?(sim.lastLanding.impact>C.dangerImpact?'重接地':'接地'):'';
  $('contact').hidden=!contact;text('contact',contact);
  text('help',mobile()?'左摇杆前推油门，后推制动，左右方向。停稳后回中再后推倒车。右侧按住喷气。空中后推只减水平速度，下降较快时点喷缓冲。':'W油门，A/D方向，S制动。停稳后松开S，再按倒车。空中S反推减水平速度，空格抬升或缓冲下降。R复位。');
}
function draw(dt){
  if(!sim||!world)return;
  const sig=JSON.stringify(sim.input);
  if(!sim.grounded&&!paused&&(sim.time-predictedAt>.1||sig!==predictedInput)){prediction=sim.predict();predictedAt=sim.time;predictedInput=sig;}else if(sim.grounded)prediction=null;
  world.update(sim,dt,prediction);renderHud();world.scene.render();audio.update(sim,started&&!paused&&!sim.crashTimer&&!sim.complete);
}
async function init(){
  try{
    const response=await fetch('./assets/coastal-interchange-layout.json');if(!response.ok)throw Error('layout unavailable');
    const layout=await response.json();sim=new RoadsterSimulation(layout);world=await createRoadsterWorld($('canvas'),layout);
    input=new RoadsterInput({stick:$('stick'),jet:$('jet'),onPause:()=>paused?resume():pause(),onReset:reset,enabled:()=>started&&!paused&&!portrait()&&!sim.crashTimer&&!sim.complete});
    $('start').disabled=false;text('start','开始驾驶');$('start').addEventListener('click',restart);$('pause').addEventListener('click',pause);
    $('resume').addEventListener('click',resume);$('reset').addEventListener('click',()=>{reset();resume();});$('restart').addEventListener('click',restart);
    $('menu-button').addEventListener('click',menu);$('again').addEventListener('click',restart);$('finish-menu').addEventListener('click',menu);
    $('sound').addEventListener('change',e=>{audio.enabled=e.target.checked;if(audio.enabled)audio.unlock();else audio.silence();});
    const interrupt=()=>{input.clear();pause();};window.addEventListener('blur',interrupt);document.addEventListener('visibilitychange',()=>{if(document.hidden)interrupt();});
    window.addEventListener('resize',()=>{world.engine.resize();input.clear();if(portrait())pause();renderHud();});
    world.engine.runRenderLoop(()=>{
      const dt=Math.min(.08,world.engine.getDeltaTime()/1000);
      if(!manual&&started&&!paused&&!portrait()&&!sim.complete){sim.input={...input.value};accumulator+=dt;while(accumulator>=C.step){sim.step(C.step);accumulator-=C.step;if(sim.crashTimer&&!wasCrash){input.clear();wasCrash=true;}if(!sim.crashTimer)wasCrash=false;}}
      draw(paused?0:dt);
    });renderHud();
    const observe=()=>structuredClone({...sim.snapshot(),paused,manual,controls:input.snapshot(),prediction,world:world.snapshot(),layout:{version:layout.version,name:layout.name,asset:layout.asset,surfaces:layout.surfaces.length}});
    if(new URLSearchParams(location.search).has('qa'))Object.defineProperty(window,'__ROADSTER_READONLY__',{value:Object.freeze({getState:observe})});
    if(import.meta.env.DEV)window.__ROADSTER_DEV__={
      getState:observe,
      setManual:v=>{manual=!!v;input.clear();accumulator=0;},
      advance:(seconds,values={})=>{if(!manual||seconds<0||seconds>60)throw Error('Use manual fixed-step diagnostics');sim.input={throttle:0,steer:0,lift:false,...values};for(let i=0;i<Math.round(seconds/C.step);i++)sim.step(C.step);draw(0);return sim.snapshot();},restart,reset
    };
  }catch(e){$('error').hidden=false;text('error','场地载入失败，请重试');console.error(e);}
}
init();
