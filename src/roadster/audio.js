import { ROADSTER as C } from './config.js';
export class RoadsterAudio {
 constructor(){this.enabled=true;this.context=null;this.lastLanding=-1;}
 async unlock(){
  if(!this.enabled)return;
  try{
   if(!this.context){
    const Audio=window.AudioContext||window.webkitAudioContext;if(!Audio)return;
    const a=this.context=new Audio(),master=this.master=a.createGain();master.gain.value=.22;master.connect(a.destination);this.channels={};
    for(const[k,f]of[['lift',105],['side',185],['brake',145],['forward',115],['wind',65]]){
     const o=a.createOscillator(),g=a.createGain();o.type=k==='wind'?'triangle':'sawtooth';o.frequency.value=f;g.gain.value=0;o.connect(g);g.connect(master);o.start();this.channels[k]={o,g};
    }
   }
   if(this.context.state!=='running')await this.context.resume();
  }catch{}
 }
 update(s,active){
  const a=this.context;if(!a||a.state!=='running')return;const t=a.currentTime;
  for(const[k,v]of Object.entries(this.channels)){
   const force=k==='wind'?Math.min(1,s.speed/40):k==='lift'?s.forces.lift/C.lift:k==='side'?Math.abs(s.forces.side)/C.side:k==='brake'?s.forces.brake/C.airBrake:s.forces.forward/C.forward;
   v.g.gain.setTargetAtTime(active&&this.enabled?force*(k==='wind'?.018:k==='forward'?.025:.035):0,t,k==='lift'?.015:.04);
   v.o.frequency.setTargetAtTime((k==='lift'?85:k==='brake'?120:140)+force*75,t,.05);
  }
  if(active&&this.enabled&&s.lastLanding&&s.lastLanding.time!==this.lastLanding){
   this.lastLanding=s.lastLanding.time;const o=a.createOscillator(),g=a.createGain();o.type='triangle';o.frequency.setValueAtTime(95,t);o.frequency.exponentialRampToValueAtTime(45,t+.16);g.gain.setValueAtTime(Math.min(.3,.05+s.lastLanding.impact*.013),t);g.gain.exponentialRampToValueAtTime(.001,t+.24);o.connect(g);g.connect(this.master);o.start();o.stop(t+.25);
  }
 }
 silence(){if(this.context)for(const v of Object.values(this.channels))v.g.gain.setTargetAtTime(0,this.context.currentTime,.015);}
}
