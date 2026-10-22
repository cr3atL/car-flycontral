import{CONFIG as C}from'./config.js';
/** Real held dual axes, release and physical landing. */
export function handlingScenario(sim){
 sim.reset();sim.assist=true;const trace=[],maxima={angleStep:0,omegaStep:0,velocityStep:0,airborneVelocityStep:0};let previous=null;
 for(let i=0;i<1200&&!sim.landingCount&&!sim.crashes;i++){
  sim.input={steer:0,boost:sim.time<1.5,roll:sim.time>=.6&&sim.time<1.95?1:0,pitch:sim.time>=.6&&sim.time<1.95?-1:0};sim.step(C.step);const s=sim.snapshot();
  if(previous){maxima.angleStep=Math.max(maxima.angleStep,Math.abs(s.roll-previous.roll),Math.abs(s.pitch-previous.pitch));maxima.omegaStep=Math.max(maxima.omegaStep,Math.abs(s.angularVelocity.roll-previous.angularVelocity.roll),Math.abs(s.angularVelocity.pitch-previous.angularVelocity.pitch));maxima.velocityStep=Math.max(maxima.velocityStep,Math.abs(s.vy-previous.vy));if(!s.grounded&&!previous.grounded)maxima.airborneVelocityStep=Math.max(maxima.airborneVelocityStep,Math.abs(s.vy-previous.vy));}
  if(i%6===0)trace.push(s);previous=s;
 }
 return{trace,maxima,end:sim.snapshot()};
}
