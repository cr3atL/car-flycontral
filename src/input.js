import { CONFIG as C } from './config.js';
const keySteer=new Set(['KeyA','KeyD','ArrowLeft','ArrowRight']);
const stuntKeys=new Set(['KeyW','KeyS','KeyQ','KeyE']);
const clamp=v=>Math.max(-1,Math.min(1,v));
export function steerValue(offset,width){return Math.abs(offset)<=C.touchDeadzone?0:Math.sign(offset)*Math.min(1,(Math.abs(offset)-C.touchDeadzone)/Math.max(1,width*.25-C.touchDeadzone));}
export function stuntVector(dx,dy){const axis=v=>Math.abs(v)<=C.touchDeadzone?0:Math.sign(v)*Math.min(1,(Math.abs(v)-C.touchDeadzone)/(C.touchFullTravel-C.touchDeadzone));return{roll:-axis(dx),pitch:axis(dy)};}
export class InputController{
 constructor({steer,boost,stunt,onPause,enabled}){
  this.keys=new Set();this.pointers=new Map();this.steer=0;this.boost=false;this.roll=0;this.pitch=0;this.boostPressed=false;this.elements={steer,boost,stunt};
  window.addEventListener('keydown',e=>{
   if(e.code==='Escape'){e.preventDefault();if(!e.repeat)onPause(e);return;}
   if(!(keySteer.has(e.code)||e.code==='Space'||stuntKeys.has(e.code))||e.target instanceof HTMLInputElement||!enabled())return;
   e.preventDefault();if(e.repeat&&!this.keys.has(e.code))return;
   if(e.code==='Space'&&!e.repeat&&!this.keys.has(e.code))this.boostPressed=true;
   this.keys.add(e.code);this.update();
  });
  window.addEventListener('keyup',e=>{this.keys.delete(e.code);this.update();});
  for(const[kind,el]of Object.entries(this.elements)){
   el.addEventListener('pointerdown',e=>{
    e.preventDefault();if(!enabled()||[...this.pointers.values()].some(p=>p.kind===kind))return;
    const r=el.getBoundingClientRect(),offset=e.clientX-(r.left+r.width/2),base=kind==='steer'?steerValue(offset,r.width):0;
    this.pointers.set(e.pointerId,{kind,x:e.clientX,y:e.clientY,dx:0,dy:0,value:base,center:r.left+r.width/2,width:r.width,roll:0,pitch:0});
    if(kind==='boost')this.boostPressed=true;
    el.setPointerCapture(e.pointerId);el.classList.add('pressed');this.update();
   });
   el.addEventListener('pointermove',e=>{
    const p=this.pointers.get(e.pointerId);if(!p)return;e.preventDefault();p.dx=e.clientX-p.x;p.dy=e.clientY-p.y;
    if(kind==='steer')p.value=steerValue(e.clientX-p.center,p.width);
    if(kind==='stunt')Object.assign(p,stuntVector(p.dx,p.dy));
    this.update();
   });
   const release=e=>{
    const p=this.pointers.get(e.pointerId);if(!p)return;
    if(p.kind==='boost'&&e.type!=='pointerup')this.boostPressed=false;
    this.pointers.delete(e.pointerId);el.classList.remove('pressed');
    if(el.hasPointerCapture(e.pointerId))el.releasePointerCapture(e.pointerId);this.update();
   };
   for(const type of ['pointerup','pointercancel','lostpointercapture'])el.addEventListener(type,release);
   el.addEventListener('contextmenu',e=>e.preventDefault());
  }
 }
 update(){
  const touch=kind=>[...this.pointers.values()].find(p=>p.kind===kind),stunt=touch('stunt');
  this.steer=touch('steer')?.value??Number(this.keys.has('KeyD')||this.keys.has('ArrowRight'))-Number(this.keys.has('KeyA')||this.keys.has('ArrowLeft'));
  this.boost=this.keys.has('Space')||!!touch('boost');
  this.roll=stunt?.roll??Number(this.keys.has('KeyQ'))-Number(this.keys.has('KeyE'));
  this.pitch=stunt?.pitch??Number(this.keys.has('KeyS'))-Number(this.keys.has('KeyW'));
  this.elements.boost.classList.toggle('pressed',this.boost);document.querySelector('#stick').style.transform='translateX('+this.steer*35+'px)';
  const el=this.elements.stunt;el.classList.toggle('controlling',!!(this.roll||this.pitch));el.style.setProperty('--input-x',String(-this.roll*9)+'px');el.style.setProperty('--input-y',String(this.pitch*9)+'px');
  const label=document.getElementById('stunt-vector');if(label)label.textContent=[this.roll?(this.roll>0?'左滚':'右滚')+' '+Math.round(Math.abs(this.roll)*100)+'%':'',this.pitch?(this.pitch<0?'后翻':'前翻')+' '+Math.round(Math.abs(this.pitch)*100)+'%':''].filter(Boolean).join(' / ')||'回中 / 松手收势';
 }
 clear(){const old=[...this.pointers];this.pointers.clear();this.keys.clear();this.boostPressed=false;for(const[id,p]of old){const el=this.elements[p.kind];if(el.hasPointerCapture(id))el.releasePointerCapture(id);}Object.values(this.elements).forEach(el=>el.classList.remove('pressed'));this.update();}
 consumeBoostPress(){const value=this.boostPressed;this.boostPressed=false;return value;}
 snapshot(){return{steer:this.steer,boost:this.boost,roll:this.roll,pitch:this.pitch,boostPressed:this.boostPressed,keys:[...this.keys],pointers:[...this.pointers].map(([id,p])=>({id,...p}))};}
}
