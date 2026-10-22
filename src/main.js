import {FlowModel,formatScore} from './flow-model.js';
import{HudModel,HUD_TIMING,hudNumber,forecastHeading}from'./hud-model.js';
import {SPRINT as P} from './sprint-config.js';
import './style.css';
import './pc-hud.css';
import './flow-ui.css';
import { ONE_JUMP as J } from './one-jump-config.js';
import { CONFIG as C } from './config.js';
import { nearbyWalls } from './simulation.js';
import { InputController } from './input.js';
import { createWorld } from './world.js';
import { handlingScenario } from './scenarios.js';
import { GameSession } from './challenge.js';
import { CHALLENGE as H } from './challenge-config.js';
import { challengePilotTick } from './challenge-scenario.js';
import { ScoreFeedback } from './feedback.js';
import { SCORE } from './score-config.js';
const STUNT_LABEL={left:'左侧滚',right:'右侧滚',front:'前空翻',back:'后空翻'};
const $ = id => document.getElementById(id);
function setText(id, value) { const el = $(id), s = String(value); if (el.textContent === s) return; if (el.childNodes.length === 1 && el.firstChild.nodeType === 3) el.firstChild.data = s; else el.textContent = s; }
let storage = null; try { storage = window.localStorage; } catch { /* Session-only scores remain usable. */ }
const session = new GameSession(storage), sim = session.sim;
let manual = false, accumulator = 0, wasCrashed = false, timeScale = 1;
let lastResult = null, menuLeaving = false, menuFadeTimer;
const flowModel = new FlowModel();
const drawCosts = import.meta.env.DEV ? { world: 0, hud: 0, scene: 0, feedback: 0 } : null;
let pilotMemory = { launched: new Set() };
let world;
try { world = createWorld($('game')); }
catch (error) { $('fatal').classList.remove('hidden'); setText('fatal', `无法启动3D画面，请使用支持WebGL的浏览器。${error.message}`); throw error; }
const { engine, scene } = world;
const feedback = new ScoreFeedback(storage, world),hudModel=new HudModel();
const input=new InputController({steer:$('steer-zone'),boost:$('boost'),stunt:$('stunt-zone'),onPause:event=>togglePause(event),enabled:()=>session.playable&&!sim.crashTimer});
function clearInput(options) { input.clear(); sim.clearInput(options); }
function start(mode) { flowModel.start(session.best);lastResult=null;$('result-details').open=false;hudModel.reset();clearInput(); session.start(mode); feedback.reset(0, 0); accumulator = 0; wasCrashed = false; pilotMemory = { launched: new Set() }; updateHud(); }
function reset(event) { start(session.mode); feedback.unlock(event); }
function menu() { menuLeaving=false;clearTimeout(menuFadeTimer);$('menu').classList.remove('leaving');hudModel.reset();clearInput(); session.menu(); feedback.reset(sim.time, sim.score.total); accumulator = 0; updateHud();$('start-challenge').focus({preventScroll:true}); }
function togglePause(event) {
  if (!['running', 'countdown'].includes(session.phase)) return;
  if (session.paused && !session.resuming) resume(event); else { clearInput({ preservePulse: true }); session.setPaused(true); feedback.suspend(); }
}
function resume(event) { if (document.hidden) return; clearInput({ preservePulse: true }); session.resume(); feedback.unlock(event); }
const startFromUI = (mode, event) => {
  if(session.phase==='menu'){menuLeaving=true;$('menu').classList.add('leaving');clearTimeout(menuFadeTimer);menuFadeTimer=setTimeout(()=>{menuLeaving=false;$('menu').classList.remove('leaving');updateHud();},220);}
  start(mode); $('menu').inert=true;feedback.unlock(event);$('game').focus({preventScroll:true});
};
for(const button of document.querySelectorAll('[data-open-settings]'))button.addEventListener('click',()=>$('settings-dialog').showModal());
$('open-help').addEventListener('click',()=>{setText('help-launch',$('launch-instructions').textContent);setText('help-rotation',$('rotation-instructions').textContent);$('help-dialog').showModal();});
for(const id of ['settings-dialog','help-dialog'])$(id).addEventListener('click',e=>{if(e.target===$(id)){const r=$(id).getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)$(id).close();}});
window.addEventListener('keydown',e=>{if(e.code==='Escape'&&document.querySelector('dialog[open]'))e.stopImmediatePropagation();},true);
$('quick-retry').addEventListener('click',reset);$('quick-menu').addEventListener('click',menu);
$('start-sprint').addEventListener('click',e=>startFromUI('sprint',e));$('start-challenge').addEventListener('click', e => startFromUI('challenge', e)); $('start-practice').addEventListener('click', e => startFromUI('practice', e));
$('retry').addEventListener('click', e => startFromUI('challenge', e)); $('result-menu').addEventListener('click', menu); $('pause-menu').addEventListener('click', menu);
$('pause').addEventListener('click', togglePause); $('reset').addEventListener('click', reset); $('restart').addEventListener('click', reset); $('resume').addEventListener('click', resume);
$('jump-retry').addEventListener('click',reset);$('pc-retry').addEventListener('click',reset);window.addEventListener('keydown',e=>{if(e.code==='KeyR'&&!e.repeat&&session.mode!=='challenge'&&session.phase==='running'&&!session.paused){e.preventDefault();reset(e);}});
$('assist').addEventListener('change', e => { sim.assist = e.target.checked; }); $('portrait-continue').addEventListener('click', () => $('portrait').classList.add('dismissed'));
function interrupt() { clearInput({ preservePulse: true }); session.setPaused(true); feedback.suspend(); accumulator = 0; }
window.addEventListener('blur', interrupt); window.addEventListener('pagehide', interrupt);
document.addEventListener('visibilitychange', () => { if (document.hidden) interrupt(); });
window.addEventListener('resize', () => { engine.resize(); clearInput({ preservePulse: true }); }); window.addEventListener('orientationchange', interrupt);
function tick(dt) {
  const phase = session.phase;
  if (session.playable && input.consumeBoostPress()) sim.queueBoostPress();
  session.tick(dt);
  if (phase !== session.phase) { clearInput(); if (session.phase === 'results') feedback.reset(sim.time, sim.score.total); }
  if (sim.crashTimer > 0 && !wasCrashed) clearInput(); wasCrashed = sim.crashTimer > 0;
}
function updateHud() {
  const mobile=matchMedia('(pointer:coarse)').matches||innerWidth<=950;document.body.classList.toggle('pc-hud',!mobile);
  const practice=session.mode==='practice'?session.oneJump.state:null,sprint=session.mode==='sprint'?session.sprint:null;
  const challenge = session.mode === 'challenge', active = ['countdown', 'running'].includes(session.phase);
  document.body.dataset.phase = session.phase;
  $('menu').inert=session.phase!=='menu';$('results').inert=session.phase!=='results';
  $('menu').classList.toggle('hidden', session.phase !== 'menu'&&!menuLeaving); $('results').classList.toggle('hidden', session.phase !== 'results');
  $('overlay').classList.toggle('hidden', !active || !session.paused || session.resuming);
  const counting = active && !session.paused && session.phase === 'countdown';
  $('countdown').classList.toggle('hidden', !counting && !session.resuming);
  setText('countdown', session.resuming ? Math.ceil(session.resumeRemaining) : Math.ceil(session.countdown));
  $('menu-best').hidden=session.best<=0;setText('menu-best', `${session.storageAvailable ? '最佳' : '本次会话最佳'} ${formatScore(session.best)}`);
  setText('remaining', challenge ? Math.max(0, H.duration - session.elapsed).toFixed(1) : '∞');
  setText('race-progress', challenge ? `${session.stats.groups} / 9 组 · 修复 ${H.repairs - session.stats.repairsUsed}` : sprint?`${sprint.sections.filter(q=>q.completed).length} / 3 段`:'自由练习');
  document.querySelector('.race-clock').classList.toggle('closing', challenge && session.elapsed >= 82);
  setText('mode-label', challenge ? '90 SECOND CHALLENGE' : sprint?'THREE SECTION SPRINT':'ONE JUMP / 施工车阵');
  setText('race-status',challenge ? session.tutorial.complete ? '黄色起飞 / 罐形环补气 / 青环得分' : '新手引导 · 一次只学一个目标' : sprint?'车阵 → 断桥补气 → 桥下收势 · R从头': '本轮一跳体验 · 真实穿环/接地 · R重试');
  setText('speed',Math.round(sim.speed*3.6)); setText('energy-label',Math.max(0,sim.mainPressure)<1&&sim.mainPressure>.00001 ? sim.mainPressure.toFixed(1)+' /100' : Math.floor(sim.mainPressure+1e-6)+' /100');
  document.querySelector('.energy').style.setProperty('--sprint-supply',world.getVehicleFeedback().supplyPulse.toFixed(3));
  $('energy-fill').style.transform='scaleX('+sim.energy+')';document.querySelector('.energy').classList.toggle('low',sim.energy<.12);
  const freshSupply=sim.supplyNotice&&sim.time-sim.supplyNotice.at>.1&&sim.time-sim.supplyNotice.at<1.5;
  const sameSupply=sim.supplyNotice?sim.events.filter(e=>e.type==='supply'&&e.time===sim.supplyNotice.at).reduce((v,e)=>v+e.amount,0):0;
  const supplyText=sameSupply>=.1?'实际补气 +'+sameSupply.toFixed(sameSupply<10?1:0):sim.energy>.995?'补至满气':sim.airSupplyUsed>=60?'本次补给已达60':'本次补气少于0.1';
  setText('energy-note',freshSupply?supplyText+' · 已补'+sim.airSupplyUsed.toFixed(1)+'/60':sim.grounded?'真实地面回充 25点/秒':sim.mainPressure<1e-6?'主气压用尽 · 松手仍可制动':'当前耗气 '+sim.forces.mainPointsRate.toFixed(1)+' 点/秒');
  const phases={driving:'持续',braking:'制动',leveling:'缓回正',idle:'停止',ground:'接地'};
  setText('steer-caption',sim.grounded?'地面左右转向':'空中左右平转');setText('steer-mode',sim.grounded?'按住两侧 / 拖动':'按住两侧 / 拖动平转');
  setText('launch-instructions',mobile?'右下推进：点按完整脉冲，按住持续推进。':'A/D地面转向。空格轻点完整脉冲，按住持续推进。Esc暂停；R重试练习/三段。');
  setText('rotation-instructions',mobile?'左区空中左右平转；右区左右侧滚、上下前后翻、斜向双轴。回中或松手制动，提前留出落地时间。':'空中按住A/D平转、Q/E侧滚、W/S前后翻；可同时组合。松手先刹转速，提前留出落地时间。');
  setText('rotation-state',sim.grounded?'按住旋转 · 松手收势':'滚:'+phases[sim.attitude.roll.mode]+' 翻:'+phases[sim.attitude.pitch.mode]+' 平:'+phases[sim.attitude.yaw.mode]+(sim.buffer.active?' · 垂直缓冲':''));
  const altitude=Math.max(0,sim.y).toFixed(1)+' ';if($('altitude').firstChild.data!==altitude)$('altitude').firstChild.data=altitude;
  const ending=challenge&&!sim.grounded&&H.duration-session.elapsed<(sim.releasePrediction??sim.prediction).time+.7;
  $('flight-info').classList.toggle('warn',!sim.grounded&&((sim.releasePrediction??sim.prediction).time<1.4||ending)||!!sim.crashTimer);$('stunt-zone').classList.toggle('air',!sim.grounded);
  setText('state',sim.crashTimer?'安全修复中':sim.grounded?'地面巡航':sim.maneuverActive?'持续旋转':sim.buffer.active?'着陆缓冲':sim.stuntLabel?'收势中':sim.thrusting?'推进飞行':'惯性滑行');
  const group=challenge?(session.groups.find(g=>g.status==='active')??session.groups.find(g=>g.status==='preview'&&g.z>sim.z)):null;
  const wall=!challenge&&nearbyWalls(sim.z).filter(w=>w.z>sim.z).sort((a,b)=>a.z-b.z)[0];
  const distance=Math.round((group?.z??wall?.z??sim.z+999)-sim.z);
  let action=sim.grounded?'起飞后按住旋转，松手收势':sim.mainPressure<1e-6?'气压用尽 · 松手收势':sim.maneuverActive?([sim.attitude.roll,sim.attitude.pitch,sim.attitude.yaw].filter(a=>a.active).length>1?'多轴持续旋转':'按住持续旋转'):sim.stuntLabel||'惯性滑行 · 缓冲就绪';
  let cue=sim.grounded?(mobile?'右区：左右侧滚 / 上下翻转\n斜拖双轴；左区：左右平转\n回中 / 松手制动':'空中A/D平转 · Q/E侧滚 · W/S翻转'):'松手后约 '+(sim.releasePrediction??sim.prediction).time.toFixed(1)+' 秒接地 · 不必凑满一圈';
  if(challenge&&!session.tutorial.complete){
    const stage=session.tutorial.stage;
    if(stage==='accelerate'){action='车辆自动前进，左右调整方向';cue='先感受向前惯性，前方黄色区域再起飞';}
    else if(stage==='first-jump'&&sim.grounded){action=distance<=group?.launch+3?'现在点按推进':'到黄色区域点按推进';cue='只飞越矮墙，不需要特技';}
    else if(stage==='first-jump'){action='越过矮墙，松手等落地';cue='独立缓冲会提前减速，保持向前';}
    else if(stage==='recharge'){action='落地成功 · 地面回气';cue='下一跳短按感受转动，再松手';}
    else if(stage==='single-roll'&&sim.grounded){action=distance<=group?.launch+3?'现在点按推进':'到黄色区域点按推进';cue=mobile?'离地后右区轻拖一下，再松手':'离地后短按Q，再松手';}
    else if(stage==='single-roll'&&!sim.maneuverActive){action=session.tutorial.shortPractice?'松手收势，再等落地':(mobile?'轻拖感受转动，再松手':'短按感受转动，再松手');cue='不要求转完一圈；松手先刹转速';}
    else if(stage==='repeat'&&sim.grounded){action='再起飞，按住感受持续旋转';cue=mobile?'右区拖动保持约一秒，然后回中或松手':'按住Q约一秒，然后松手';}
    else if(stage==='repeat'){action=sim.maneuverActive?'按住多久，就转多久':'松手收势 · 保持向前';cue='提前松手，留出回正和落地时间';}
  }else if(sim.grounded&&group&&distance< -3){action=group.ceiling?'桥下直行 · 松开推进':'继续向前 · 看清下一段';cue=group.ceiling?'低位穿出桥架，再准备下一跳':'已越过起跳点，不必重复起飞';}
  else if(sim.grounded&&group){action=distance<=group.launch+3?(group.hold>=.5?'现在推进约'+group.hold.toFixed(2)+'秒 · ':'现在点按推进 · ')+group.label:'前方 '+distance+'m · '+group.label;cue=group.hold>=.5?'黄区推进约'+group.hold.toFixed(2)+'秒，再松开 · 环可放弃':group.ceiling?'黄区点按短喷 · 注意有限桥顶':'黄区点按越车 · 下一组已在前方';}
  else if(challenge&&sim.grounded&&!group){action='回充直道 · 留出落地时间';cue='可以安全驾驶，或用持续输入自由表演';}
  else if(!challenge&&sim.grounded&&wall&&distance<125){action=distance<=36?'现在点按推进 · 低墙':'低墙 '+distance+'m · 靠近黄箭头再起飞';cue='先越墙，再等实际落地';}
  if(!sim.grounded){
    const screen=world.getLandingScreen();
    if(!(sim.releasePrediction??sim.prediction).safe)cue='预计落点没有安全路面 · 调整路线';
    else if(screen&&!screen.visible)cue='松手落点在画面'+(screen.y>innerHeight?'下方 ↓':'前方 ↑')+' · 约 '+(sim.releasePrediction??sim.prediction).time.toFixed(1)+'秒接地';
    if((sim.releasePrediction??sim.prediction).time<1.4&&sim.maneuverActive){action='尽快松手收势';cue='仍在响应旋转输入，姿态不稳可能撞地';}
    if(ending){action='松手收势 · 比赛即将结束';cue='余时 '+(H.duration-session.elapsed).toFixed(1)+'秒 / 松手接地约 '+(sim.releasePrediction??sim.prediction).time.toFixed(1)+'秒';}
    if(sim.notice&&sim.time-sim.notice.at<1.1)cue=sim.notice.text;
  }
  if(sim.crashTimer){action='即将返回当前安全路段';cue=challenge&&!session.tutorial.complete?'教学失误不扣修复 · 比赛计时继续':'已入账保留 · 重新准备';}
  if(practice){
    if(sim.grounded&&!practice.result&&!sim.crashTimer){action=sim.z<J.launch.start?'前方黄区 · 准备越过施工车阵':sim.z<J.launch.end?'黄区推进约1秒，然后松开':'起飞稍晚 · 留意施工车辆';cue=mobile?'升空后松推进，再双拇指自由控制':'升空后松推进 · A/D平转，Q/E侧滚，W/S翻转';}
    else if(!sim.grounded&&!sim.crashTimer){action=(sim.releasePrediction??sim.prediction).time<1.4?'松手收势 · 宽直道落地':practice.ringCrossed?'补气已发生 · 自由收势':practice.cleared?'车阵已越过 · 前方气罐环':'飞越施工车阵 · 保持向前';cue=practice.ringCrossed?'气罐环实际补'+practice.ringActual.toFixed(1)+' · 本次实际补'+practice.actualSupply.toFixed(1):sim.z>J.ring.z+5?'未穿环也先安全落地，R可重试':mobile?'左区平转，右区滚/翻；不必同时三轴':'按住多久就转多久，提前松手刹转';if(!(sim.releasePrediction??sim.prediction).safe)cue='当前落点不安全 · 先收势避开车辆';}
    if(practice.result){action=practice.result.complete?'一跳完成 · 已真实补气并落地':'已落地 · 再试完整一跳';cue=practice.result.complete?'车阵 → 自由特技 → 气罐环 → 宽直道':'黄区起飞、穿气罐环，再安全落地';}
    if(sim.crashTimer){action='碰撞 · 可立即重试';cue='车辆与碰撞一致，R或按钮再来';}
  }
  if(sprint){const d=P.sections[sprint.current],q=sprint.sections[sprint.current],landingAge=sim.lastLanding?sim.time-sim.lastLanding.time:99;
    if(sim.crashTimer){action='本段失误 · 即将从安全起点重试';cue=sprint.reason+' · 前段已入账保留';}
    else if(sprint.complete){action=sprint.continuous&&sprint.sections.every(q=>q.completed)?'连续三段完成 · 冲出直道': '三段练习结束 · 可重跑连贯路线';cue=sprint.sections.every(q=>q.landing?.grade===0)?'连续三次精准 · R从头再跑':'真实接地入账 · R从第一段重跑';}
    else if(sim.grounded){
      if(landingAge<.53&&q.landing){action=q.landing.grade===0?(landingAge<.18?'精准接地 · 稳住轮胎':sprint.pending||sprint.motor?'精准落地 · 顺势加速':'精准落地'):(q.landing.label+' · 稳住轮胎');cue=q.landing.grade===0?'首拍接地 → 电驱顺势 → 看清下一段':'按真实等级入账 · 继续看路';}
      else if(sprint.motor){action='精准落地 · 顺势加速';cue=sprint.current<2?'前方'+P.sections[sprint.current+1].name+' · 先读路':'冲出桥架阴影 · 直道释放';}
      else if(q.landing){action=sprint.current===2?'冲出桥架 · 直道释放':'前方'+P.sections[sprint.current+1].name+' · 留意黄色起飞区';cue='保持向前 · 有足够直道看清下一段';}
      else if(sim.z<d.launch.start){action='第'+d.id+'段 · 前方'+d.name;cue=d.id===2?'直接越过断桥；再喷可追高位补气环':'黄色区域再推进 · 看清去向';}
      else if(sim.z<=d.launch.end){action=d.id===1?'短喷约0.5秒 · 越过车阵':d.id===2?'推进约0.8秒 · 越过断桥':'短喷约0.5秒 · 越栏后收推';cue=mobile?'推进后松开，左右两区可自由组合':'起飞可自由三轴 · 提前松手收势';}
      else{action='留意前方障碍 · 可R从头练习';cue='落地之外仍按真实路面与姿态判定';}
    }else{action=(sim.releasePrediction??sim.prediction).time<.7?'准备真实接地 · 松手收势':d.id===2?'越过断桥 · 再喷可追高位环':d.id===3?'越栏后收推 · 前方桥架':'飞越施工车阵';cue=d.id===2?(sprint.ringCrossed?'高位环实际补'+sprint.ringActual.toFixed(1):'高位环可放弃 · 远平台才是主路线'):'按住多久转多久 · 松手制动';if(!(sim.releasePrediction??sim.prediction).safe)cue='当前预计落点不安全 · 看清平台边缘';}
  }
  const lp=sim.releasePrediction,a=lp?.assessment,last=sim.lastLanding,showForecast=!sim.grounded&&!sim.crashTimer&&a,showLanding=sim.grounded&&last&&sim.time-last.time<2.5&&(!sim.crashTimer||last.grade===3);
  $('landing-feedback').classList.toggle('hidden',!active||!(showForecast||showLanding));
  if(showForecast||showLanding){const r=showForecast?a:last.assessment;$('landing-feedback').dataset.tone=r.tone;setText('landing-caption',showForecast?'松手后的预计落点 · '+Math.max(0,lp.time-(sim.time-sim.releasePredictionAt)).toFixed(1)+'秒':last.label+(last.padHit?' · 命中落地区':''));setText('landing-pose','姿态 '+(r.checks.pose?'稳':r.angle.toFixed(0)+'°'));setText('landing-direction','方向 '+(r.checks.direction?'正':r.headingError.toFixed(0)+'°'));setText('landing-settle',r.checks.settled?'收势 稳':'收势 '+Math.max(...Object.values(r.omega).map(Math.abs)).toFixed(1)+'rad/s');setText('landing-reason',showForecast?(lp.hazard??r.reason??'按当前趋势可精准'):(r.reason??(last.padHit?'车已摆正 · 准备下一跳':'车已摆正 · 准备下一跳')));}
  $('jump-retry').classList.toggle('hidden',session.paused||!(practice&&(practice.result||sim.crashTimer)||sprint&&(sprint.complete||sim.crashTimer)));setText('jump-retry',sprint?'重跑三段 · R':'再来一跳 · R');setText('action',action);setText('cue',cue);
  const hv=hudModel.update(sim,session);feedback.setHudView(hv,!mobile);document.body.dataset.hudState=hv.active?hv.state:'inactive';
  if(mobile)document.querySelector('.pressure-caption').textContent='主气压 / 100点';
  if(!mobile){
    setText('remaining',hv.clock);document.querySelector('.pressure-caption').textContent='气压';$('remaining').setAttribute('aria-label',hv.clockLabel+' '+hv.clock);setText('energy-label',Math.floor(sim.mainPressure+1e-6));
    const repairs=$('pc-repairs');repairs.hidden=hv.repairs===null;setText('repair-count',hv.repairs??'');repairs.setAttribute('aria-label','剩余修复 '+(hv.repairs??''));
    const segments=$('route-segments');if(segments.children.length!==hv.segments.length)segments.replaceChildren(...hv.segments.map(()=>document.createElement('i')));hv.segments.forEach((state,i)=>segments.children[i].className=state);segments.hidden=!hv.segments.length;segments.setAttribute('aria-label',hv.segments.filter(s=>s==='done').length+' / '+hv.segments.length);
    const place=(el,x,y)=>{const half=el.offsetWidth/2;el.style.left=Math.max(innerWidth*.03+half,Math.min(innerWidth*.97-half,x))+'px';el.style.top=Math.max(innerHeight*.20,Math.min(innerHeight*.78,y))+'px';};
    const target=hv.target&&world.projectPoint(hv.target.x,.7,hv.target.z);$('pc-ground-target').hidden=!target?.visible;if(target?.visible){setText('pc-ground-target',hv.target.label+' · '+Math.round(hv.target.distance)+'m');place($('pc-ground-target'),target.x,target.y-20);}
    const prompt=hv.prompt||hv.teaching;$('pc-prompt').hidden=!hv.active||!prompt||hv.state==='landing'||hv.state==='impact'||hv.state==='bank'||hv.state==='crash';setText('pc-prompt',prompt);const promptPoint=world.projectPoint(sim.x,.05,sim.z+12);place($('pc-prompt'),promptPoint.x,promptPoint.y-15);
    $('pc-landing').hidden=!hv.active||!hv.landing.visible;$('pc-landing').dataset.tone=hv.landing.tone;$('pc-touchdown-time').hidden=!hv.landing.caption;setText('pc-touchdown-time',hv.landing.caption??'');setText('pc-touchdown-reason',hv.landing.reason);
    $('pc-retry').hidden=!hv.retry;setText('pc-retry',hv.retryLabel);
    const projection=$('pc-projection'),lp=hv.landing.prediction,pp=hv.landing.visible?{...world.getLandingScreen()}:null,vehicle=world.projectPoint(sim.x,sim.y+.76,sim.z),blocked=pp&&(Math.abs(pp.x-vehicle.x)<110&&Math.abs(pp.y-vehicle.y)<110||!pp.visible||pp.y>innerHeight*.78);
    projection.toggleAttribute('hidden',!hv.active||!hv.landing.visible||!blocked);
    if(pp&&blocked){const angle=forecastHeading(lp)*180/Math.PI,side=pp.x<innerWidth*.76?1:-1,ax=Math.max(innerWidth*.12,Math.min(innerWidth*.77,pp.x+side*150)),ay=Math.max(innerHeight*.30,Math.min(innerHeight*.67,pp.y-65));projection.setAttribute('viewBox',`0 0 ${innerWidth} ${innerHeight}`);projection.dataset.tone=hv.landing.tone;projection.dataset.heading=angle.toFixed(4);$('pc-projection-car').setAttribute('transform',`translate(${ax} ${ay}) rotate(${angle})`);$('pc-projection-link').setAttribute('d',`M${ax-Math.sin(angle*Math.PI/180)*40} ${ay+Math.cos(angle*Math.PI/180)*40} L${pp.x} ${pp.y}`);$('pc-projection-point').setAttribute('cx',pp.x);$('pc-projection-point').setAttribute('cy',pp.y);}
    const amount=hv.supply;setText('pc-supply',amount>0?'+'+(amount<.01?'<0.01':amount<.1?amount.toFixed(2):amount<10?Number(amount.toFixed(1)):Number(amount.toFixed(0))):'');
  }
  const endingAge=flowModel.endingAge(sim.lastLanding,sim.time,Boolean(sprint?.complete),session.paused,performance.now());
  const quick=active&&!session.paused&&hv.retry&&endingAge>=HUD_TIMING.impact+HUD_TIMING.result&&Boolean(practice?.result||sprint?.complete);
  $('quick-result').hidden=!quick;document.body.dataset.quick=String(quick);
  if(quick){setText('quick-title',sprint?(sprint.continuous&&sprint.sections.every(q=>q.completed)?'连续三段完成':'三段练习结束'):practice.result.complete?'一跳完成':'已落地');setText('quick-note',sim.lastLanding?.reason??'');$('quick-note').hidden=!sim.lastLanding?.reason;setText('quick-score',formatScore(sim.score.total));setText('quick-retry',sprint?'重跑三段':'再来一跳');}
  if (session.result && lastResult !== session.result) {
    const v=flowModel.result(session.result);
    setText('result-reason','90秒挑战');setText('result-grade',v.grade);setText('result-title',v.label);setText('result-score',formatScore(v.score));
    $('results').dataset.grade=v.grade;
    const stats=(id,rows)=>$(id).replaceChildren(...rows.map(([label,value])=>{const row=document.createElement('span'),b=document.createElement('b'),name=document.createElement('small');name.textContent=label;b.textContent=value;row.append(b,name);return row;}));
    stats('result-stats',v.stats);stats('result-detail-stats',v.details);
    setText('result-best',v.record);$('result-best').hidden=!v.record;$('result-best').classList.toggle('new-record',session.result.newBest);
    setText('result-note',v.notes);$('result-note').hidden=!v.notes;
    lastResult = session.result;$('retry').focus({preventScroll:true});
  }
}
function draw(dt, frameMs = 16.7) {
  const a = import.meta.env.DEV ? performance.now() : 0;
  world.setQuality(feedback.quality.effective, feedback.quality.reduced); world.setImpact(feedback.impact(sim.time,sim.lastLanding)); world.update(sim, session.paused ? 0 : dt, session);
  const b = import.meta.env.DEV ? performance.now() : 0; updateHud();
  const c = import.meta.env.DEV ? performance.now() : 0; scene.render();
  const d = import.meta.env.DEV ? performance.now() : 0; feedback.update(sim, session, frameMs);
  if (import.meta.env.DEV) { drawCosts.world = b - a; drawCosts.hud = c - b; drawCosts.scene = d - c; drawCosts.feedback = performance.now() - d; }
}
engine.runRenderLoop(() => {
  const frameDt = Math.min(engine.getDeltaTime() / 1000, .1);
  if (!manual) {
    accumulator += frameDt * timeScale;
    sim.input = session.playable ? { steer: sim.grounded?input.steer:0, boost: input.boost, pitch: input.pitch, roll: input.roll, yaw: sim.grounded?0:input.steer } : { steer: 0, boost: false, pitch: 0, roll: 0, yaw: 0 };
    while (accumulator >= C.step) { tick(C.step); accumulator -= C.step; }
  }
  draw(frameDt, engine.getDeltaTime());
});
if (import.meta.env.DEV) {
  window.__FLIGHT_DEV__ = {
    inspectCar: view => { if (view !== null && !['front', 'rear', 'side'].includes(view)) throw new Error('front/rear/side/null'); world.inspectCar(view); document.body.classList.toggle('art-inspection', view !== null); draw(0); },
    config: C, challengeConfig: H, scoreConfig: SCORE, getDrawCosts: () => ({ ...drawCosts }),
    getState: () => ({ ...sim.snapshot(), ...{ paused: session.paused, resumeRemaining: session.resumeRemaining }, session: session.snapshot(), feedback: feedback.snapshot(), art: world.getArtState(), manual, timeScale, controls: input.snapshot(), nozzles: world.getNozzleState(), floor: world.getFloorLayout(), meshCount: scene.meshes.length, drawCalls: world.instrumentation.drawCallsCounter.current, frameTime: world.instrumentation.frameTimeCounter.current, fps: engine.getFps(), graphics: engine.getGlInfo(), camera: { x: world.camera.position.x, y: world.camera.position.y, z: world.camera.position.z, roll: world.camera.rotation.z } }),
    reset: () => start('practice'), startChallenge: () => start('challenge'), startPractice: () => start('practice'), startSprint:()=>start('sprint'),menu,
    setTimeScale: value => { if (![1, 2, 3, 4].includes(value)) throw new Error('Test timeScale: 1,2,3,4 only'); timeScale = value; },
    setManual: value => { manual = Boolean(value); accumulator = 0; clearInput(); },
    advance: (seconds, values = {}) => {
      if (!manual) throw new Error('Use manual mode'); if (!Number.isFinite(seconds) || seconds < 0 || seconds > 120) throw new Error('0..120 seconds only');
      sim.input = { steer: values.steer ?? 0, boost: values.boost ?? false, roll: values.roll ?? 0, pitch: values.pitch ?? 0, yaw: values.yaw ?? 0 };
      for (let i = 0; i < Math.round(seconds / C.step); i++) tick(C.step);
      draw(1); return sim.snapshot();
    },
    advanceWithPilot: (seconds, options = {}) => {
      if (!manual || session.mode !== 'challenge' || seconds < 0 || seconds > 100) throw new Error('Challenge manual mode, 0..100 seconds');
      for (let i = 0; i < Math.round(seconds / C.step); i++) { challengePilotTick(session, pilotMemory, options); tick(C.step); }
      draw(1); return session.snapshot();
    },
    runHandlingScenario: () => { if (!manual || session.paused || session.mode !== 'practice') throw new Error('Use practice/manual mode'); const result = handlingScenario(sim); draw(1); return result; },
    pause: () => { clearInput({ preservePulse: true }); session.setPaused(true); feedback.suspend(); }, resume,
  };
}
