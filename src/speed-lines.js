/** Peripheral air streaks follow travelled distance. Centre and HUD stay clear. */
export class SpeedLines{
 constructor(canvas){this.canvas=canvas;this.ctx=canvas?.getContext('2d');this.active=0;this.strength=0;this.width=0;this.height=0;}
 draw(distance,strength,reduced=false){
  this.active=0;this.strength=reduced?0:Math.max(0,Math.min(1,strength));if(!this.ctx)return;
  const w=this.canvas.clientWidth,h=this.canvas.clientHeight,dpr=Math.min(1.25,globalThis.devicePixelRatio||1),c=this.ctx;
  if(w!==this.width||h!==this.height){this.width=w;this.height=h;this.canvas.width=Math.round(w*dpr);this.canvas.height=Math.round(h*dpr);c.setTransform(dpr,0,0,dpr,0,0);}
  c.clearRect(0,0,w,h);this.canvas.style.visibility=this.strength>.025?'visible':'hidden';if(this.strength<=.025)return;
  const cx=w*.5,cy=h*.40,band=w<950?24:45;
  for(const side of[-1,1]){const g=c.createLinearGradient(side<0?0:w,0,side<0?band:w-band,0);g.addColorStop(0,`rgba(116,255,228,${.18*this.strength})`);g.addColorStop(1,'rgba(116,255,228,0)');c.fillStyle=g;c.fillRect(side<0?0:w-band,0,band,h);}
  for(let i=0;i<36;i++){
   const side=i%2?1:-1,seed=((i*71)%101)/101,ey=h*(.10+.83*seed),ex=side<0?-w*.08:w*1.08,dx=ex-cx,dy=ey-cy,phase=(distance/20+i*.61803398875)%1,r=.61+phase*.57,length=.10+this.strength*.22,a=r-length;
   const x0=cx+dx*a,y0=cy+dy*a,x1=cx+dx*r,y1=cy+dy*r,g=c.createLinearGradient(x0,y0,x1,y1);g.addColorStop(0,'rgba(208,255,247,0)');g.addColorStop(.55,`rgba(152,255,232,${this.strength*.38})`);g.addColorStop(1,`rgba(232,255,253,${this.strength*.82})`);
   c.strokeStyle=g;c.lineWidth=(w<950?1.35:1.0)+this.strength*(i%4===0?2.1:1.1);c.lineCap='round';c.beginPath();c.moveTo(x0,y0);c.lineTo(x1,y1);c.stroke();this.active++;
  }
  c.clearRect(w*.245,0,w*.51,h);
  if(typeof document!=='undefined')for(const el of document.querySelectorAll('.topbar,.track-label,.dashboard,.desktop-help,#flight-info,#combo,#steer-zone,#stunt-zone,#boost')){const r=el.getBoundingClientRect();if(r.width&&r.height)c.clearRect(r.left-5,r.top-5,r.width+10,r.height+10);}
 }
 snapshot(){return{streaks:this.active,strength:this.strength,protectedCentre:[.245,.755]};}
}
