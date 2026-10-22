/** One suspension dip and recovery. Never changes the physical car. */
export function landingDip(now,landing,low=false){
  if(low||!landing||landing.grade>=3)return 0;
  const age=now-landing.time;if(age<=0||age>=.53)return 0;
  const amount=Math.min(.56,.36+Math.min(1,landing.impact/10)*.13+(landing.grade===2?.08:0));
  if(age<.055)return -amount*(1-(1-age/.055)**3);
  if(age<.13)return -amount;
  const recovery=(age-.13)/.4;
  return -amount*(1-recovery*recovery*(3-2*recovery));
}
export function suspensionY(s,x,z,radius){
  const pitch=s.pitch||0,roll=s.roll||0,wrap=a=>Math.atan2(Math.sin(a),Math.cos(a));
  if(!s.grounded||Math.abs(wrap(pitch))>=.5||Math.abs(wrap(roll))>=.5)return -.4;
  const cp=Math.cos(pitch),sp=Math.sin(pitch),cr=Math.cos(roll),sr=Math.sin(roll);
  return Math.max(-.55,Math.min(-.18,(radius-((s.y||0)+.76)+sp*z-cp*sr*x)/(cp*cr)));
}
