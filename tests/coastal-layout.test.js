import test from'node:test';
import assert from'node:assert/strict';
import{readFileSync}from'node:fs';
import{surfaceAt,supported,topAt}from'../src/roadster/geometry.js';
const layout=JSON.parse(readFileSync(new URL('../public/assets/coastal-interchange-layout.json',import.meta.url),'utf8'));

test('exported coastal collision faces satisfy the promised convex, non-folded schema',()=>{
 assert.equal(layout.version,2);assert.equal(new Set(layout.surfaces.map(s=>s.id)).size,layout.surfaces.length);
 for(const s of[...layout.surfaces,...layout.colliders]){
  const p=s.polygon??[[s.xmin,s.zmin],[s.xmax,s.zmin],[s.xmax,s.zmax],[s.xmin,s.zmax]],turns=p.map((a,i)=>{const b=p[(i+1)%p.length],c=p[(i+2)%p.length];return(b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);});
  assert.ok(!(turns.some(v=>v>1e-5)&&turns.some(v=>v< -1e-5)),s.id+' folds or is concave');
  const area=Math.abs(p.reduce((a,v,i)=>a+v[0]*p[(i+1)%p.length][1]-v[1]*p[(i+1)%p.length][0],0))/2;
  assert.ok(area>1e-4,s.id+' has no area');
  for(const[x,z]of p)assert.ok(x>=s.xmin-1e-5&&x<=s.xmax+1e-5&&z>=s.zmin-1e-5&&z<=s.zmax+1e-5,s.id+' bounds mismatch');
 }
});
test('repaired return apron joins the real ramp with continuous full-footprint support',()=>{
 for(const state of[{x:-28,z:41,heading:Math.PI},{x:-25.6584,z:39.7638,heading:2.53044},{x:-18,z:29,heading:2},{x:-3,z:24,heading:Math.PI/2}]){
  const face=surfaceAt(layout,state.x,state.z,.5);assert.ok(face,'missing real return road at '+JSON.stringify(state));
  assert.ok(supported(layout,state,face).safe,'unsafe return join '+JSON.stringify(state));
 }
 const ramp=layout.surfaces.find(s=>s.group==='return-ramp'),apron=surfaceAt(layout,-28,39.999,.5);
 assert.ok(Math.abs(topAt(ramp,-28,40)-topAt(apron,-28,40))<1e-8);
});
