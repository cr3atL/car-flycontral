import{PARKING as K}from'./parking-config.js';
import{SPRINT as P}from'./sprint-config.js';
import{ONE_JUMP as J}from'./one-jump-config.js';
import{scoreTier}from'./score-config.js';
export const HUD_TIMING=Object.freeze({idle:2,impact:.53,formula:.48,transfer:.55,result:2,row:.11,landing:1.6});
const clamp=v=>Math.max(0,Math.min(1,v)),ease=v=>1-(1-clamp(v))**3;
export const hudNumber=n=>Math.max(0,Math.round(n)).toLocaleString('en-US').replaceAll(',',' ');
export const forecastHeading=p=>Math.atan2(Math.sin(p?.heading??0)*Math.cos(p?.pitch??0),Math.cos(p?.heading??0)*Math.cos(p?.pitch??0));
export function landingView(s){
 const p=s.releasePrediction??s.prediction,a=p?.assessment,time=Math.max(0,(p?.time??0)-Math.max(0,s.time-(s.releasePredictionAt??s.time))),danger=!!a&&(a.tone==='danger'||!p.safe);
 return{visible:!s.grounded&&!s.crashTimer&&!!a&&(danger||s.vy<0&&time<=HUD_TIMING.landing),time,caption:p?.safe?'松手 · '+time.toFixed(1)+'s后接地':null,danger,tone:a?.tone??'adjust',reason:p?.hazard??(!p?.safe?'无安全地面':a?.reason??'预计精准'),prediction:p};
}
const names={fleet:'施工车阵',stagger:'错列车阵',bridge:'断桥',lowbridge:'低桥',showcase:'开放路段',gate:'升降闸',final:'最终组合'};
export function nextObstacle(s,session){
 if(session.mode==='parking'){const p=session.parking;if(p.complete||p.triggerAt!==null&&!p.open)return null;if(p.localRetry&&!p.open&&s.grounded&&s.z<K.localLaunch.end)return{x:0,z:K.localLaunch.start,label:'维修黄区',distance:Math.max(0,K.localLaunch.start-s.z),hold:K.localLaunch.hold,launch:s.z>=K.localLaunch.start};const z=p.open?K.exit+K.exitClearance:s.z<K.rack.z?K.rack.z:s.z<K.ring.z?K.ring.z:K.plate.coreStart+25;return{x:0,z,label:p.open?'出口':s.z<K.rack.z?'倾斜停车架':s.z<K.ring.z?'空中补气':'重压板',distance:Math.max(0,z-s.z),hold:1,launch:s.z>=K.launch.start&&s.z<=K.launch.end};}

 if(session.mode==='challenge'){
  for(const g of session.groups.filter(g=>g.status==='active'||g.status==='preview'&&g.z>s.z)){
   let z=g.z,label=names[g.layout]??(g.type==='tutorialRoll'?'练习区':'矮墙');
   if(g.z<s.z){const next=(g.boxes??g.walls??[]).filter(b=>b.z>=s.z-1).sort((a,b)=>a.z-b.z)[0];if(next){z=next.z;label=next.part==='truck'?'施工车阵':'矮栏';}else if(g.ceiling&&s.z<g.ceiling.end){z=g.ceiling.end;label='低桥出口';}else continue;}
   const distance=Math.max(0,z-s.z);return{x:0,z,label,distance,hold:g.hold,launch:g.z-s.z>=g.launch-12&&g.z-s.z<=g.launch+3};
  }return null;
 }
 if(session.mode==='sprint'){
  let i=session.sprint.current;if(session.sprint.sections[i].cleared||s.z>P.sections[i].obstacleEnd)i++;if(i>=P.sections.length)return null;
  const d=P.sections[i],z=i===0?170:i===1?P.gap.start:1015;return{x:0,z,label:['施工车阵','断桥','桥下护栏'][i],distance:Math.max(0,z-s.z),hold:d.hold,launch:s.z>=d.launch.start&&s.z<=d.launch.end};
 }
 if(s.z<J.landing.start&&!session.oneJump?.state?.cleared)return{x:0,z:120,label:'施工车阵',distance:Math.max(0,120-s.z),hold:1,launch:s.z>=J.launch.start&&s.z<=J.launch.end};return null;
}
function lesson(s,session,launch){
 if(session.mode!=='challenge'||session.tutorial.complete)return'';
 const t=session.tutorial;if(t.stage==='accelerate')return'A / D';
 if(s.grounded)return launch||t.stage==='repeat'?'Space 推进':'';
 if(t.stage==='single-roll'&&!t.shortPractice)return'轻点 Q';if(t.stage==='repeat'&&!t.heldPractice)return'按住 Q';return'';
}
/** Presentation only. Consumes journal entries; never settles or writes gameplay state. */
export class HudModel{
 constructor(){this.reset();}
 reset(){this.score=null;this.mode=null;this.cursor=-1;this.chain=-1;this.rows=[];this.lastScore=-99;this.bank=null;this.crashAt=-99;this.view=null;}
 update(s,session){
  if(this.score!==s.score||this.mode!==session.mode){this.reset();this.score=s.score;this.mode=session.mode;}
  const now=s.time;
  for(const e of s.score.journal){if(e.id<=this.cursor)continue;this.cursor=e.id;
   if(e.type==='score'){if(this.chain!==e.chainId){this.rows=[];this.chain=e.chainId;}this.rows.push({...e.record,visibleAt:Math.max(e.time,(this.rows.at(-1)?.visibleAt??e.time-HUD_TIMING.row)+HUD_TIMING.row)});this.rows=this.rows.slice(-3);this.lastScore=e.time;this.bank=null;}
   else if(e.type==='bank'){this.bank={...e};this.rows=[];}
   else if(e.type==='crash'){this.bank=null;this.rows=[];this.crashAt=e.time;this.lastScore=-99;}
  }
  if(this.bank&&!s.grounded&&s.lastLanding&&s.flightId!==s.lastLanding.flight)this.bank=null;
  const active=session.phase==='running',landing=landingView(s),bankAge=this.bank?now-this.bank.time:99,landAge=s.lastLanding?now-s.lastLanding.time:99,impact=s.grounded&&s.lastLanding&&landAge+1e-8<HUD_TIMING.impact,result=s.grounded&&s.lastLanding&&s.lastLanding.grade<3&&landAge+1e-8>=HUD_TIMING.impact&&landAge<HUD_TIMING.impact+HUD_TIMING.result;
  const state=s.crashTimer||now-this.crashAt<1.4?'crash':!s.grounded?(landing.visible?'landing':'air'):impact?'impact':this.bank?.amount>0&&bankAge+1e-8>=HUD_TIMING.impact&&bankAge<HUD_TIMING.impact+HUD_TIMING.result?'bank':result?'result':'ground';
  const resultOnly=state==='result',retryEligible=session.mode==='parking'&&(session.parking.complete||s.crashTimer)||session.mode==='practice'&&(session.oneJump?.state?.result||s.crashTimer)||session.mode==='sprint'&&(session.sprint.complete||s.crashTimer),retry=active&&!!retryEligible&&(s.crashTimer?now-this.crashAt>=HUD_TIMING.impact:landAge+1e-8>=HUD_TIMING.impact);
  const comboFresh=now-this.lastScore<HUD_TIMING.idle&&s.score.pending>0,bankVisible=state==='bank',transferStart=HUD_TIMING.impact+HUD_TIMING.formula,progress=this.bank?ease((bankAge-transferStart)/HUD_TIMING.transfer):1;
  const displayedTotal=s.score.total-(this.bank?.amount??0)*(1-progress),target=nextObstacle(s,session),tier=scoreTier(bankVisible?this.bank.amount:s.score.pending),rows=state==='air'?this.rows.filter(r=>r.visibleAt<=now):[];
  const segments=session.mode==='challenge'?Array.from({length:9},(_,i)=>{const g=session.groups.find(g=>g.id===i+1);return g?.status==='passed'?'done':g?.status==='failed'?'failed':g?.status==='active'?'active':'waiting';}):session.mode==='sprint'?session.sprint.sections.map((q,i)=>q.completed?'done':i===session.sprint.current?'active':'waiting'):[];
  const seconds=session.mode==='challenge'?Math.ceil(Math.max(0,90-session.elapsed)):Math.floor(s.time),clock=`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;
  const supply=s.supplyNotice&&now-s.supplyNotice.at>=0&&now-s.supplyNotice.at<1.4?s.events.filter(e=>e.type==='supply'&&e.time===s.supplyNotice.at).reduce((n,e)=>n+e.amount,0):0;
  this.view={active,state,retry,retryLabel:session.mode==='parking'?'重玩停车场 · R':session.mode==='sprint'?'重跑三段 · R':'再来一跳 · R',clock,clockLabel:session.mode==='challenge'?'剩余时间':session.mode==='sprint'?'三段用时':'练习用时',segments,repairs:session.mode==='challenge'?Math.max(0,2-session.stats.repairsUsed):null,target:active&&state==='ground'?target:null,prompt:active&&state==='ground'&&target?.launch?(lesson(s,session,true)||(target.hold>=.4?'推进 '+target.hold+'s':'点按推进')):'',teaching:active&&!landing.visible?lesson(s,session,false):'',landing,combo:{visible:active&&(bankVisible||resultOnly||state==='crash'||(state==='air'||state==='landing')&&comboFresh),weak:state==='landing',multiplier:s.score.multiplier,countVisible:state!=='result'&&state!=='crash',label:bankVisible||resultOnly?['精准落地','稳定落地','重落地'][s.lastLanding?.grade??this.bank?.grade]:state==='crash'?'连击中断':tier.name,amount:bankVisible?this.bank.amount:s.score.pending,displayed:bankVisible?Math.round(this.bank.amount*ease((bankAge-HUD_TIMING.impact)/.24)):Math.round(s.score.pending),tier,rows,formula:bankVisible&&bankAge<transferStart?`${Number(this.bank.pending.toFixed(2)).toLocaleString('en-US').replaceAll(',',' ')} × ${this.bank.factor.toFixed(1)}`:'',reason:bankVisible||resultOnly?s.lastLanding?.reason??'':'',transfer:bankVisible&&this.bank.amount>0&&bankAge>=transferStart&&bankAge<transferStart+HUD_TIMING.transfer?progress:null},displayedTotal:Math.round(displayedTotal),supply};return this.view;
 }
}
