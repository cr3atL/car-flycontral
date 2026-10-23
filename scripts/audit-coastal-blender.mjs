import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const file='public/assets/coastal-interchange.glb',bytes=fs.readFileSync(file);
assert.equal(bytes.readUInt32LE(0),0x46546c67);
assert.equal(bytes.readUInt32LE(8),bytes.length);
const size=bytes.readUInt32LE(12),gltf=JSON.parse(bytes.subarray(20,20+size).toString()),bin=28+size;
const layout=JSON.parse(fs.readFileSync('public/assets/coastal-interchange-layout.json','utf8'));
const epsilon=1e-4,close=(a,b)=>Math.abs(a-b)<epsilon;
function positions(mesh){
 const result=[];
 for(const p of mesh.primitives){
  const a=gltf.accessors[p.attributes.POSITION],v=gltf.bufferViews[a.bufferView];
  assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');
  const offset=bin+(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??12;
  for(let i=0;i<a.count;i++)result.push([0,1,2].map(axis=>bytes.readFloatLE(offset+i*stride+axis*4)));
 }
 assert.ok(result.every(p=>p.every(Number.isFinite)));
 return result;
}
const report=[];
for(const s of layout.surfaces){
 const corners=s.polygon;
 const crosses=corners.map((a,i)=>{const b=corners[(i+1)%corners.length],c=corners[(i+2)%corners.length];return (b[0]-a[0])*(c[1]-b[1])-(b[1]-a[1])*(c[0]-b[0]);});
 assert.ok(!crosses.some(v=>v>1e-7)||!crosses.some(v=>v< -1e-7),`${s.id}: collider polygon must be convex`);
 const mesh=gltf.meshes.find(m=>m.name===`CI_surface_${s.id}_mesh`);assert.ok(mesh,`Missing ${s.id}`);
 const actual=positions(mesh),height=(x,z)=>s.top+(s.slope??0)*(z-(s.origin_z??0))+(s.slopeX??0)*(x-(s.origin_x??0));
 const expected=[0,-s.depth].flatMap(dy=>s.polygon.map(([x,z])=>[x,height(x,z)+dy,z]));
 for(const p of actual)assert.ok(expected.some(q=>p.every((v,i)=>close(v,q[i]))),`${s.id}: extra or shifted point ${p}`);
 for(const p of expected)assert.ok(actual.some(q=>p.every((v,i)=>close(v,q[i]))),`${s.id}: missing polygon corner ${p}`);
 const min=[0,1,2].map(i=>Math.min(...actual.map(p=>p[i]))),max=[0,1,2].map(i=>Math.max(...actual.map(p=>p[i])));
 assert.ok(close(min[0],s.xmin)&&close(max[0],s.xmax)&&close(min[2],s.zmin)&&close(max[2],s.zmax),`${s.id}: bbox`);
 report.push({id:s.id,group:s.group,route:s.route,positions:actual.length,min,max});
}
assert.equal(layout.surfaces.find(s=>s.id==='runway').zmax,110);
assert.equal(layout.surfaces.find(s=>s.id==='landing').zmin,134);
assert.equal(layout.surfaces.find(s=>s.id==='high').top,8);
assert.equal(layout.surfaces.find(s=>s.id==='ramp').slope,-.1);
assert.equal(layout.surfaces.find(s=>s.id==='far').zmin,473);
// Validate actual mesh bounds and final-plane height independently of runtime geometry helpers.
const ramp=layout.surfaces.find(s=>s.id==='ramp');assert.ok(close(ramp.top+ramp.slope*(473-ramp.origin_z),0));
for(const group of ['curve','ground-bypass','lower-bypass','return-top']){
 const list=layout.surfaces.filter(s=>s.group===group);
 for(let i=0;i<list.length-1;i++){
  const a=list[i].polygon,b=list[i+1].polygon;
  assert.ok(a[3].every((v,j)=>close(v,b[0][j]))&&a[2].every((v,j)=>close(v,b[1][j])),`${group}: disconnected seam ${i}`);
 }
}
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const result={createdWith:'Live Blender MCP',checks:'Actual GLB binary vertices equal all collider polygon top/bottom corners. Same-source curved-road seams and high-ramp-far elevation verified independently of runtime.',file,bytes:bytes.length,sha256:hash(file),layoutSha256:hash('public/assets/coastal-interchange-layout.json'),meshCount:gltf.meshes.length,materials:gltf.materials.length,embeddedImages:gltf.images?.length??0,colliders:layout.colliders.length,surfaces:report};
fs.writeFileSync('docs/coastal-blender-validation.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({surfaces:report.length,colliders:result.colliders,meshCount:result.meshCount,embeddedImages:result.embeddedImages,bytes:result.bytes,sha256:result.sha256}));
