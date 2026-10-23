import {polygon,footprint,topAt} from './geometry.js';
import {ROADSTER as C} from './config.js';
const EPS=1e-8,SKIN=.0015,cache=new WeakMap();
const dot=(a,b)=>a.x*b.x+a.y*b.y+a.z*b.z;
const sub=(a,b)=>({x:a.x-b.x,y:a.y-b.y,z:a.z-b.z});
const cross=(a,b)=>({x:a.y*b.z-a.z*b.y,y:a.z*b.x-a.x*b.z,z:a.x*b.y-a.y*b.x});
const length=a=>Math.hypot(a.x,a.y,a.z);
const scale=(a,k)=>({x:a.x*k,y:a.y*k,z:a.z*k});
const add=(a,b)=>({x:a.x+b.x,y:a.y+b.y,z:a.z+b.z});
const range=(vertices,n)=>{let min=Infinity,max=-Infinity;for(const p of vertices){const v=dot(p,n);min=Math.min(min,v);max=Math.max(max,v);}return{min,max};};

function solid(shape){
 if(cache.has(shape))return cache.get(shape);
 const p=polygon(shape),road=shape.ymax===undefined&&shape.top!==undefined,vertices=[];
 for(const a of p){const top=road?topAt(shape,a.x,a.z):shape.ymax,bottom=road?top-shape.depth:shape.ymin;vertices.push({x:a.x,y:bottom,z:a.z},{x:a.x,y:top,z:a.z});}
 const edges=[{x:0,y:1,z:0}],normals=[{x:-(shape.slopeX??0),y:1,z:-(shape.slope??0)}];
 for(let i=0;i<p.length;i++){const j=(i+1)%p.length,edge=sub(vertices[j*2+1],vertices[i*2+1]);edges.push(edge);normals.push({x:-edge.z,y:0,z:edge.x});}
 const out={vertices,edges,normals,bounds:{xmin:shape.xmin,xmax:shape.xmax,zmin:shape.zmin,zmax:shape.zmax,ymin:Math.min(...vertices.map(p=>p.y)),ymax:Math.max(...vertices.map(p=>p.y))}};cache.set(shape,out);return out;
}
function bodyVertices(s){return footprint(s).flatMap(p=>[{...p,y:s.y},{...p,y:s.y+C.height}]);}
function axesFor(s,obj){
 const body=[{x:Math.cos(s.heading),y:0,z:-Math.sin(s.heading)},{x:Math.sin(s.heading),y:0,z:Math.cos(s.heading)},{x:0,y:1,z:0}],axes=[];
 function push(n){const l=length(n);if(l<EPS)return;n=scale(n,1/l);if(!axes.some(a=>Math.abs(dot(a,n))>1-1e-8))axes.push(n);}
 body.forEach(push);obj.normals.forEach(push);for(const a of body)for(const b of obj.edges)push(cross(a,b));return axes;
}

/** Continuous OBB/convex-prism SAT. The prism keeps its real polygon and sloped top. */
export function sweepPrism(start,end,shape){
 const obj=solid(shape),vertices=bodyVertices(start),move=sub(end,start);let enter=0,exit=1,normal=null,overlapping=true,depth=Infinity,mtv=null;
 for(const n of axesFor(start,obj)){
  const a=range(vertices,n),b=range(obj.vertices,n),v=dot(move,n),gap=Math.max(b.min-a.max,a.min-b.max);
  if(gap>EPS)overlapping=false;
  if(gap<=EPS){const negative=a.max-b.min,positive=b.max-a.min,d=Math.min(negative,positive);if(d<depth){depth=d;mtv=scale(n,negative<positive?-1:1);}}
  if(Math.abs(v)<EPS){if(gap>EPS)return null;continue;}
  const t1=(b.min-a.max)/v,t2=(b.max-a.min)/v,first=Math.min(t1,t2),last=Math.max(t1,t2);
  if(first>enter){enter=first;normal=scale(n,v>0?-1:1);}exit=Math.min(exit,last);if(enter>exit+EPS)return null;
 }
 if(overlapping){
  if(depth<SKIN&&dot(move,mtv)>=-EPS)return null;
  return{time:0,normal:mtv,depth:Math.max(0,depth),embedded:true,shape};
 }
 if(!normal||enter<0||enter>1||exit<0)return null;
 return{time:enter,normal,depth:0,embedded:false,shape};
}

/** Move to contact, remove only inward motion, then consume remaining time along the surface. */
export function moveAgainstSolids(start,target,velocity,shapes){
 let position={x:start.x,y:start.y,z:start.z},remaining=sub(target,start),v={...velocity};const contacts=[];
 for(let pass=0;pass<6;pass++){
  const end=add(position,remaining);let first=null;
  for(const shape of shapes){
   const b=solid(shape).bounds;
   const radius=C.halfWidth+C.halfLength;
   if(Math.max(position.x,end.x)+radius<b.xmin||Math.min(position.x,end.x)-radius>b.xmax||Math.max(position.z,end.z)+radius<b.zmin||Math.min(position.z,end.z)-radius>b.zmax||Math.max(position.y,end.y)+C.height<b.ymin||Math.min(position.y,end.y)>b.ymax)continue;
   const hit=sweepPrism({...position,heading:target.heading??start.heading},{...end,heading:target.heading??start.heading},shape);
   if(hit&&(!first||hit.time<first.time-EPS||(hit.time===first.time&&hit.depth>first.depth)))first=hit;
  }
  if(!first){position=end;break;}
  const n=first.normal,impact=Math.max(0,-dot(v,n));
  if(first.embedded)position=add(position,scale(n,first.depth+SKIN));
  else{const t=Math.max(0,first.time-SKIN/Math.max(SKIN,length(remaining)));position=add(position,scale(remaining,t));remaining=scale(remaining,1-first.time);}
  const inward=dot(remaining,n);if(inward<0)remaining=sub(remaining,scale(n,inward));
  const incoming=dot(v,n);if(incoming<0)v=sub(v,scale(n,incoming));
  const friction=1-Math.min(.035,impact*.0015);v=scale(v,friction);remaining=scale(remaining,friction);
  contacts.push({id:first.shape.id,normal:n,impact,position:{...position},kind:first.shape.kind??(first.shape.top!==undefined?'road':'obstacle')});
  if(length(remaining)<EPS)break;
 }
 return{...position,vx:v.x,vy:v.y,vz:v.z,contacts};
}
