import{CONFIG as C}from'./config.js';
const clamp=v=>Math.max(0,Math.min(1,v));
/** Observes delivered acceleration. Never applies forces or changes velocity. */
export class DriveFeedback{
 reset(){this.event=null;this.lastLanding=-99;this.intensity=0;this.cameraGain=0;this.gain=0;this.source=null;}
 constructor(){this.reset();}
 update(s,context={}){
  const mode=context.mode??'sprint',eligible=s.grounded&&!s.launchArmed&&!s.crashTimer;
  if(mode==='sprint'){
   const e=s.events.filter(e=>e.type==='sprint-motor-start').at(-1);if(e&&e.time!==this.event?.time)this.event={...e,x:s.x,source:'sprint-electric',accelerated:false};
   const live=eligible&&context.motor&&context.motor.flight===s.flightId&&context.motor.landing===this.event?.landing;
   if(live&&(s.forces.extraMotor||0)>0&&(s.forces.forwardAcceleration||0)>0)this.event.accelerated=true;
   const age=this.event?s.time-this.event.landing-.53:99,gain=clamp((s.speed-C.cruise)/(C.cruise*.1)),force=clamp((s.forces.extraMotor||0)/8),window=live&&this.event.accelerated&&age>=0?Math.min(1,age/.12,(context.motor.end-s.time)/.25):0;
   this.intensity=eligible?clamp(Math.max(gain,force*.65)*window):0;this.cameraGain=this.intensity>0?gain:0;this.gain=Math.max(0,s.speed-C.cruise);this.source=this.intensity>0?'sprint-electric':null;
  }else{
   const e=s.lastLanding;if(e&&e.time>this.lastLanding){this.lastLanding=e.time;this.event=e.grade===0?{time:e.time,landing:e.time,flight:e.flight,x:e.x??s.x,entrySpeed:e.speed??s.speed,source:'ground-recovery',accelerated:false}:null;}
   const live=eligible&&this.event?.flight===s.flightId,age=this.event?s.time-this.event.landing-.53:99;
   this.gain=live?Math.max(0,s.speed-this.event.entrySpeed):0;const force=Math.max(0,s.forces.groundMotor||0),delivered=force>.03&&(s.forces.forwardAcceleration||0)>0&&this.gain>.02;
   if(live&&delivered)this.event.accelerated=true;const margin=this.event?Math.max(.4,C.cruise-this.event.entrySpeed):1,gain=clamp(this.gain/margin),window=live&&delivered&&this.event.accelerated&&age>=0&&age<1.2?Math.min(1,age/.12,(1.2-age)/.25):0;
   this.intensity=clamp(Math.max(gain,clamp(force/C.acceleration)*.65)*window);this.cameraGain=this.intensity>0?gain:0;this.source=this.intensity>0?'ground-recovery':null;
  }
  return this;
 }
}
