const clamp=v=>Math.max(0,Math.min(1,v));
/** A single fixed sound graph, driven only by measured simulation forces. */
export class FlightAudio {
  constructor(owner){this.owner=owner;this.graph=null;this.levels={engine:0,jet:0,brake:0};this.lastLanding=-99;this.lastNear=-99;this.windContribution=0;this.landings=0;}
  create(){
    const c=this.owner.context;if(!c||this.graph)return;
    const buffer=c.createBuffer(1,c.sampleRate*2,c.sampleRate),data=buffer.getChannelData(0);let seed=71,soft=0;
    for(let i=0;i<data.length;i++){seed=(seed*1664525+1013904223)>>>0;soft=soft*.62+((seed/4294967296)*2-1)*.38;data[i]=soft;}
    const noise=c.createBufferSource();noise.buffer=buffer;noise.loop=true;
    const jetFilter=c.createBiquadFilter(),brakeFilter=c.createBiquadFilter();jetFilter.type='lowpass';jetFilter.frequency.value=1900;jetFilter.Q.value=.45;brakeFilter.type='bandpass';brakeFilter.frequency.value=620;brakeFilter.Q.value=.55;
    const jet=c.createGain(),brake=c.createGain(),engine=c.createGain(),hum=c.createOscillator(),humFilter=c.createBiquadFilter();hum.type='triangle';hum.frequency.value=42;humFilter.type='lowpass';humFilter.frequency.value=170;
    for(const gain of[jet,brake,engine]){gain.gain.value=0;gain.connect(this.owner.master);}
    noise.connect(jetFilter);noise.connect(brakeFilter);jetFilter.connect(jet);brakeFilter.connect(brake);hum.connect(humFilter);humFilter.connect(engine);noise.start();hum.start();
    this.graph={noise,hum,jetFilter,brakeFilter,humFilter,jet,brake,engine};
  }
  stop(){this.windContribution=0;if(this.graph){const t=this.owner.context.currentTime;for(const name of['engine','jet','brake']){this.graph[name].gain.cancelScheduledValues(t);this.graph[name].gain.setValueAtTime(0,t);}}this.levels={engine:0,jet:0,brake:0};}
  reset(){this.stop();this.lastLanding=-99;this.lastNear=-99;this.windContribution=0;}
  update(s,active,sprint=false){
    if(!active||!this.owner.enabled||this.owner.context?.state!=='running'){this.stop();return;}
    this.create();const g=this.graph,t=this.owner.context.currentTime;
    const turn=['roll','pitch','yaw'].reduce((v,a)=>v+Math.abs(s.forces[a]||0)/26,0),up=clamp(Math.abs(s.forces.up||0)/34);
    const near=sprint?s.events.filter(e=>e.type==='sprint-near-pass').at(-1):null;if(near)this.lastNear=Math.max(this.lastNear,near.time);const nearHiss=sprint?Math.max(0,1-(s.time-this.lastNear)/.12)*.09:0;this.windContribution=sprint?clamp(s.speed/50)**2*(s.grounded?.015:.035):0;
    const braking=Object.values(s.attitude).reduce((v,a)=>v+(a.mode==='braking'?Math.min(1,Math.abs(a.omega)/6):0),0);
    const landingAge=s.lastLanding&&s.lastLanding.grade<3?s.time-s.lastLanding.time:99,duck=landingAge>=0&&landingAge<.18?.08:landingAge<.3?.08+(landingAge-.18)/.12*.92:1,tire=landingAge>=0&&landingAge<.12?.32*(1-landingAge/.12)**2:0;
    this.levels={engine:s.grounded&&!s.crashTimer?clamp(s.speed/45)*.055*duck:0,jet:!s.crashTimer?(clamp(up*.8+turn*.23)*.24+this.windContribution)*duck:0,brake:!s.crashTimer?clamp(braking*.3)*.11*duck+tire+nearHiss:0};
    for(const name of['engine','jet','brake'])g[name].gain.setTargetAtTime(this.levels[name],t,landingAge>=0&&landingAge<.18?.012:name==='jet'?.045:.065);
    g.hum.frequency.setTargetAtTime(35+Math.max(0,s.speed)*1.4+Math.max(0,s.forces.extraMotor||0)*4,t,.12);g.jetFilter.frequency.setTargetAtTime(850+up*1100+clamp(turn)*400,t,.05);
    if(s.lastLanding&&s.lastLanding.time>this.lastLanding){this.lastLanding=s.lastLanding.time;if(s.time-s.lastLanding.time<.2&&s.lastLanding.grade<3){const e=s.lastLanding;this.owner.tone(e.grade===2?92:110,.22,.13,0,e.grade===2?38/92:45/110,.002);this.owner.tone(178,.12,.065,.008,.65,.0015);this.landings++;}}
  }
  snapshot(){return{windContribution:this.windContribution,graphs:this.graph?1:0,continuousSources:this.graph?2:0,nodes:this.graph?8:0,levels:{...this.levels},landings:this.landings};}
}
