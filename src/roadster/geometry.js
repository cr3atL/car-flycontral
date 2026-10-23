import { ROADSTER as C } from './config.js';

const EPS = 1e-7;
const shapeCache = new WeakMap(), layoutCache = new WeakMap();
const cross = (a, b, p) => (b.x-a.x)*(p.z-a.z)-(b.z-a.z)*(p.x-a.x);
const signedArea = p => p.reduce((sum,a,i) => { const b=p[(i+1)%p.length]; return sum+a.x*b.z-b.x*a.z; },0)/2;
export const polygonArea = p => Math.abs(signedArea(p));

export function polygon(r) {
  if (Array.isArray(r)) return r.map(p => Array.isArray(p)?{x:p[0],z:p[1]}:p);
  if (!shapeCache.has(r)) {
    const points=r.polygon ? polygon(r.polygon) : [
      {x:r.xmin,z:r.zmin},{x:r.xmax,z:r.zmin},
      {x:r.xmax,z:r.zmax},{x:r.xmin,z:r.zmax}
    ];
    shapeCache.set(r,{points,sign:signedArea(points)>=0?1:-1});
  }
  return shapeCache.get(r).points;
}

export function inside(r,x,z,margin=0) {
  if (x<r.xmin+Math.min(0,margin)-EPS||x>r.xmax-Math.min(0,margin)+EPS||
      z<r.zmin+Math.min(0,margin)-EPS||z>r.zmax-Math.min(0,margin)+EPS) return false;
  const points=polygon(r),sign=shapeCache.get(r)?.sign??(signedArea(points)>=0?1:-1),p={x,z};
  return points.every((a,i) => {
    const b=points[(i+1)%points.length];
    return cross(a,b,p)*sign>=margin*Math.hypot(b.x-a.x,b.z-a.z)-EPS;
  });
}

export const topAt=(s,x,z)=>s.top+(s.slope??0)*(z-(s.origin_z??0))+(s.slopeX??0)*(x-(s.origin_x??0));
export const slopeVelocity=(s,vx,vz)=>(s.slopeX??0)*vx+(s.slope??0)*vz;
export const surfaceGroup=s=>s?.group??s?.id??null;

export function footprint(s,margin=0) {
  const c=Math.cos(s.heading),n=Math.sin(s.heading),w=C.halfWidth+margin,l=C.halfLength+margin;
  return [[-1,-1],[-1,1],[1,1],[1,-1]].map(([a,b])=>({x:s.x+a*w*c+b*l*n,z:s.z-a*w*n+b*l*c}));
}
export function polygonBounds(p) {
  return {xmin:Math.min(...p.map(p=>p.x)),xmax:Math.max(...p.map(p=>p.x)),zmin:Math.min(...p.map(p=>p.z)),zmax:Math.max(...p.map(p=>p.z))};
}
export const footprintBounds=s=>polygonBounds(footprint(s));
export const overlaps=(a,b)=>a.xmax>b.xmin+EPS&&a.xmin<b.xmax-EPS&&a.zmax>b.zmin+EPS&&a.zmin<b.zmax-EPS;

function halfPlane(subject,a,b,sign,keepInside=true) {
  const out=[]; if (!subject.length) return out;
  const distance=p=>cross(a,b,p)*sign*(keepInside?1:-1);
  for(let i=0;i<subject.length;i++) {
    const p=subject[i],q=subject[(i+1)%subject.length],dp=distance(p),dq=distance(q),pin=dp>=-EPS,qin=dq>=-EPS;
    if(pin)out.push(p);
    if(pin!==qin){const t=dp/(dp-dq);out.push({x:p.x+(q.x-p.x)*t,z:p.z+(q.z-p.z)*t});}
  }
  return out;
}
export function intersection(a,b) {
  let out=polygon(a);const clip=polygon(b),sign=signedArea(clip)>=0?1:-1;
  for(let i=0;i<clip.length&&out.length;i++)out=halfPlane(out,clip[i],clip[(i+1)%clip.length],sign);
  return polygonArea(out)>EPS?out:[];
}
export function contactPolygon(body,surface) {
  const points=Array.isArray(body)?body:footprint(body);
  return overlaps(polygonBounds(points),surface)?intersection(points,surface):[];
}

function subtract(subject,clip) {
  const result=[],sign=signedArea(clip)>=0?1:-1;let remaining=subject;
  for(let i=0;i<clip.length&&remaining.length;i++) {
    const a=clip[i],b=clip[(i+1)%clip.length],outside=halfPlane(remaining,a,b,sign,false);
    if(polygonArea(outside)>EPS)result.push(outside);
    remaining=halfPlane(remaining,a,b,sign);
  }
  return result;
}

function spatial(layout) {
  if(!layoutCache.has(layout)) {
    const cells=new Map(),size=16;
    for(const s of layout.surfaces)for(let x=Math.floor(s.xmin/size);x<=Math.floor(s.xmax/size);x++)for(let z=Math.floor(s.zmin/size);z<=Math.floor(s.zmax/size);z++) {
      const key=x+':'+z;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(s);
    }
    layoutCache.set(layout,{cells,size});
  }
  return layoutCache.get(layout);
}
export function querySurfaces(layout,bounds) {
  const {cells,size}=spatial(layout),found=new Set();
  for(let x=Math.floor(bounds.xmin/size);x<=Math.floor(bounds.xmax/size);x++)for(let z=Math.floor(bounds.zmin/size);z<=Math.floor(bounds.zmax/size);z++)for(const s of cells.get(x+':'+z)??[])found.add(s);
  return [...found];
}
export function surfaceAt(layout,x,z,ceiling=Infinity) {
  const {cells,size}=spatial(layout);let best=null,height=-Infinity;
  for(const s of cells.get(Math.floor(x/size)+':'+Math.floor(z/size))??[]) {
    const y=topAt(s,x,z);if(y>height&&y<=ceiling+.05&&inside(s,x,z)){best=s;height=y;}
  }
  return best;
}

export function supported(layout,s,surface,margin=0) {
  const height=topAt(surface,s.x,s.z),points=footprint(s,margin),candidates=querySurfaces(layout,polygonBounds(points));
  const matches=p=>{const target=topAt(surface,p.x,p.z),hit=surfaceAt(layout,p.x,p.z,target+.35);return !!hit&&Math.abs(topAt(hit,p.x,p.z)-target)<.45;};
  const count=points.filter(matches).length;
  let safe=false,coverage=0;
  if(count===4) {
    const supporting=candidates.filter(face=>{const clipped=contactPolygon(points,face);return clipped.length&&clipped.every(p=>Math.abs(topAt(face,p.x,p.z)-topAt(surface,p.x,p.z))<.45);});
    if(supporting.some(face=>points.every(p=>inside(face,p.x,p.z))))safe=true;
    else {
      let uncovered=[points];
      for(const face of supporting){uncovered=uncovered.flatMap(piece=>subtract(piece,polygon(face)));if(!uncovered.length)break;}
      const area=polygonArea(points),missing=uncovered.reduce((sum,p)=>sum+polygonArea(p),0);coverage=Math.max(0,1-missing/area);safe=missing<1e-4;
    }
    if(safe)coverage=1;
  }
  return {safe,count,height,coverage};
}
