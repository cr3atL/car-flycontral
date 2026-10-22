/** Uses the existing bounded audio pool. Landing impact keeps the first beat. */
export class ParkingAudio{
 constructor(audio){this.audio=audio;this.score=null;this.played=new Set();}
 update(s,session){if(this.score!==s.score){this.score=s.score;this.played.clear();}if(session.mode!=='parking'||session.paused||session.phase!=='running')return;const p=session.parking;if(p.triggerAt===null)return;const age=s.time-p.triggerAt;
  const cue=(id,at,fn)=>{if(age>=at&&!this.played.has(id)){this.played.add(id);fn();}};
  cue('tension',.2,()=>this.audio.tone(150,.035,.16,0,.7));cue('launch',.3,()=>{this.audio.tone(110,.055,.25,0,2.4);this.audio.tone(330,.025,.2,.06,.6);});
  if(p.wallBroken)cue('impact',0,()=>{this.audio.tone(58,.1,.3,0,.55);this.audio.tone(175,.06,.24,.035,.4);this.audio.tone(620,.035,.18,.1,.3);});
  if(p.wallBroken)cue('bridge',1.14,()=>{this.audio.tone(135,.045,.3,0,1.8);this.audio.tone(260,.035,.25,.22,.7);});if(p.open)cue('lock',0,()=>this.audio.tone(92,.065,.18));
 }
}
