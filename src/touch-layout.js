export const TOUCH_LAYOUT_KEY='crimson-lift-touch-layout-v1';
export const TOUCH_DEFAULTS=Object.freeze({size:1,opacity:.32,left:18,right:18,bottom:18});
const limits={size:[1,1.12],opacity:[.18,.65],left:[12,42],right:[12,42],bottom:[12,36]};
export function touchPreferences(value={}){return Object.fromEntries(Object.entries(TOUCH_DEFAULTS).map(([k,v])=>[k,Number.isFinite(value?.[k])?Math.max(limits[k][0],Math.min(limits[k][1],value[k])):v]));}
export function touchGeometry(p,width,height){
  const scoreBottom=Math.min(148,height-210),size=Math.max(1,Math.min(p.size,(height-scoreBottom-p.bottom)/198)),bottom=Math.max(12,Math.min(p.bottom,height-scoreBottom-198*size));
  return{...p,size,bottom,left:Math.min(p.left,Math.max(12,width/2-158*size-12)),right:Math.min(p.right,Math.max(12,width/2-180*size-12))};
}
export class TouchLayout{
 constructor(storage,onChange){this.storage=storage;this.onChange=onChange;try{this.preferences=touchPreferences(JSON.parse(storage?.getItem(TOUCH_LAYOUT_KEY)??'{}'));}catch{this.preferences={...TOUCH_DEFAULTS};}
  this.controls=[...document.querySelectorAll('[data-touch-layout]')];
  for(const el of this.controls)el.addEventListener('input',()=>{this.preferences=touchPreferences({...this.preferences,[el.dataset.touchLayout]:Number(el.value)});this.onChange();this.apply();this.save();});
  document.getElementById('touch-layout-reset').addEventListener('click',()=>{this.preferences={...TOUCH_DEFAULTS};this.onChange();this.apply();this.save();});
  window.addEventListener('resize',()=>this.apply());this.apply();
 }
 save(){try{this.storage?.setItem(TOUCH_LAYOUT_KEY,JSON.stringify(this.preferences));}catch{/* Layout still works for this session. */}}
 apply(){const safe=getComputedStyle(document.getElementById('touch-controls')),p=touchGeometry(this.preferences,innerWidth-parseFloat(safe.paddingLeft)-parseFloat(safe.paddingRight),innerHeight-parseFloat(safe.paddingTop)-parseFloat(safe.paddingBottom)),style=document.documentElement.style;for(const[k,v]of Object.entries(p))style.setProperty('--touch-'+k,k==='size'||k==='opacity'?String(v):v+'px');for(const el of this.controls)el.value=String(this.preferences[el.dataset.touchLayout]);}
}
