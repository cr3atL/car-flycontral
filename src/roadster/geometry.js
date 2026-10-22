import{ROADSTER as C}from'./config.js';
export const inside=(r,x,z,margin=0)=>x>=r.xmin+margin&&x<=r.xmax-margin&&z>=r.zmin+margin&&z<=r.zmax-margin;
export const topAt=(s,x,z)=>s.top+(s.slope??0)*(z-(s.origin_z??0));
export function footprint(s){const c=Math.cos(s.heading),n=Math.sin(s.heading);return[-1,1].flatMap(a=>[-1,1].map(b=>({x:s.x+a*C.halfWidth*c+b*C.halfLength*n,z:s.z-a*C.halfWidth*n+b*C.halfLength*c})));}
export function footprintBounds(s){const p=footprint(s);return{xmin:Math.min(...p.map(p=>p.x)),xmax:Math.max(...p.map(p=>p.x)),zmin:Math.min(...p.map(p=>p.z)),zmax:Math.max(...p.map(p=>p.z))};}
export const overlaps=(a,b)=>a.xmax>b.xmin&&a.xmin<b.xmax&&a.zmax>b.zmin&&a.zmin<b.zmax;
export function surfaceAt(layout,x,z,ceiling=Infinity){return layout.surfaces.filter(s=>inside(s,x,z)&&topAt(s,x,z)<=ceiling+.05).sort((a,b)=>topAt(b,x,z)-topAt(a,x,z))[0]??null;}
export function supported(layout,s,surface){const height=topAt(surface,s.x,s.z),points=footprint(s);const count=points.filter(p=>{const hit=surfaceAt(layout,p.x,p.z,height+.4);return hit&&Math.abs(topAt(hit,p.x,p.z)-height)<.45;}).length;return{safe:count===4,count,height};}
