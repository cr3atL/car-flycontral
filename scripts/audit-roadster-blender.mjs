import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const asset='public/assets/roadster-lab.glb';
const bytes=fs.readFileSync(asset);
assert.equal(bytes.readUInt32LE(0),0x46546c67);
assert.equal(bytes.readUInt32LE(8),bytes.length);
const jsonLength=bytes.readUInt32LE(12);
const gltf=JSON.parse(bytes.subarray(20,20+jsonLength).toString());
const binStart=28+jsonLength;
const layout=JSON.parse(fs.readFileSync('public/assets/roadster-lab-layout.json','utf8'));
const near=(a,b)=>assert.ok(Math.abs(a-b)<.0001,`${a} differs from ${b}`);
const surfaces=[];
for(const s of layout.surfaces){
 const mesh=gltf.meshes.find(m=>m.name===`RL_${s.id}_mesh`);
 assert.ok(mesh,`Missing exported surface ${s.id}`);
 const a=gltf.accessors[mesh.primitives[0].attributes.POSITION];
 assert.equal(a.componentType,5126);assert.equal(a.type,'VEC3');
 const v=gltf.bufferViews[a.bufferView],offset=binStart+(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??12;
 const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(let i=0;i<a.count;i++)for(let axis=0;axis<3;axis++){
  const n=bytes.readFloatLE(offset+i*stride+axis*4);assert.ok(Number.isFinite(n));
  min[axis]=Math.min(min[axis],n);max[axis]=Math.max(max[axis],n);
 }
 const top=z=>s.top+(s.slope??0)*(z-(s.origin_z??0));
 near(min[0],s.xmin);near(max[0],s.xmax);near(min[2],s.zmin);near(max[2],s.zmax);
 near(min[1],Math.min(top(s.zmin),top(s.zmax))-s.depth);
 near(max[1],Math.max(top(s.zmin),top(s.zmax)));
 surfaces.push({id:s.id,vertices:a.count,min,max});
}
const hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
const result={source:'Live Blender MCP',checks:'Actual binary vertex bounds match all nine layout surfaces including sloped return road',asset,bytes:bytes.length,sha256:hash(asset),blendSha256:hash('assets/blender/roadster-lab.blend'),layoutSha256:hash('public/assets/roadster-lab-layout.json'),meshes:gltf.meshes.length,surfaces};
fs.writeFileSync('docs/roadster-blender-validation.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify({surfaces:surfaces.length,meshes:result.meshes,bytes:result.bytes,sha256:result.sha256}));
