import {CONFIG as C} from './config.js';
const smooth=t=>t*t*(3-2*t);
/** Main propulsion only. Descent reserve and rotation never use this factor. */
export function ceilingAuthority(y,vy) {
  if(y<=C.ceilingSoft)return 1;
  if(vy<=0)return 0;
  return 1-smooth(Math.min(1,(y-C.ceilingSoft)/(C.ceilingTop-C.ceilingSoft)));
}
/** A progressive aerodynamic brake removes upward inertia, with no position clamp.
 * Small internal steps near the upper edge resolve its stopping distance. */
export function ceilingStep(y,vy,up,dt) {
  const ay=up-C.gravity-C.verticalDrag*vy;
  if(y<C.ceilingSoft&&y+vy*dt+ay*dt*dt/2<=C.ceilingSoft)
    return {y:y+vy*dt+ay*dt*dt/2,vy:vy+ay*dt,brake:0};
  let remaining=dt,brakeImpulse=0;
  while(remaining>1e-12){
    const distance=Math.max(1e-8,C.ceilingTop-y),progress=Math.max(0,Math.min(1,(y-C.ceilingSoft)/(C.ceilingTop-C.ceilingSoft)));
    const brake=vy>0?vy*vy*progress/(2*distance):0;
    const h=vy>0?Math.min(remaining,y<C.ceilingSoft?Math.max(1e-9,(C.ceilingSoft-y)/vy):distance/(8*Math.max(vy,1))):remaining;
    const a=up-C.gravity-C.verticalDrag*vy-brake;
    y+=vy*h+a*h*h/2;vy+=a*h;brakeImpulse+=brake*h;remaining-=h;
  }
  return {y,vy,brake:brakeImpulse/dt};
}
