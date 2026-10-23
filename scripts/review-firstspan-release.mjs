import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';

const hash = b => crypto.createHash('sha256').update(b).digest('hex');
const read = p => JSON.parse(fs.readFileSync(p, 'utf8'));
const frozen = read('docs/coastal-art-candidate-freeze.json');
const checked = frozen.files.map(f => {
  const b = fs.readFileSync(f.path);
  assert.equal(b.length, f.bytes, f.path);
  assert.equal(hash(b), f.sha256, f.path);
  return f.path;
});
for (const f of frozen.roadsterBundles) assert.equal(hash(fs.readFileSync(f.path)), f.sha256, f.path);
for (const f of frozen.productionCopies) {
  assert.equal(hash(fs.readFileSync(f.path)), hash(fs.readFileSync(f.path.replace(/^dist\//, 'public/'))), f.path);
}
const baseline = read('docs/coastal-art-supervisor-baseline.json');
const changed = baseline.files.filter(f => hash(fs.readFileSync(f.path)) !== f.sha256).map(f => f.path);
assert.deepEqual(changed.sort(), ['src/roadster/main.js', 'src/roadster/simulation.js', 'src/roadster/world.js']);
assert.equal(hash(fs.readFileSync('public/assets/coastal-interchange.glb')), '2d827d96b66834ef3afd788f2cae10d6a7f4d8154087ce0daec44d6fa02966e7');
const layout = read('public/assets/coastal-interchange-layout.json');
assert.equal(layout.surfaces.length, 154);
assert.equal(layout.colliders.length, 182);

function inspect(file) {
  const b = fs.readFileSync(file);
  assert.equal(b.readUInt32LE(0), 0x46546c67);
  assert.equal(b.readUInt32LE(8), b.length);
  const len = b.readUInt32LE(12), j = JSON.parse(b.subarray(20, 20 + len)), bin = b.subarray(28 + len);
  const meshes = new Set(j.nodes.filter(n => n.mesh !== undefined).map(n => n.mesh));
  assert.equal(meshes.size, j.meshes.length);
  const bounds = {min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity]};
  const tr = (p, n) => {
    if (n.matrix) { const m = n.matrix; return [0, 1, 2].map(k => m[k]*p[0]+m[k+4]*p[1]+m[k+8]*p[2]+m[k+12]); }
    const s = n.scale ?? [1, 1, 1], q = n.rotation ?? [0, 0, 0, 1], t = n.translation ?? [0, 0, 0];
    const v = p.map((v, k) => v*s[k]);
    const uv = [q[1]*v[2]-q[2]*v[1], q[2]*v[0]-q[0]*v[2], q[0]*v[1]-q[1]*v[0]];
    const uuv = [q[1]*uv[2]-q[2]*uv[1], q[2]*uv[0]-q[0]*uv[2], q[0]*uv[1]-q[1]*uv[0]];
    return v.map((v,k) => v+2*(q[3]*uv[k]+uuv[k])+t[k]);
  };
  const walk = (id, ancestors) => {
    const n = j.nodes[id], chain = [n, ...ancestors];
    if (n.mesh !== undefined) for (const p of j.meshes[n.mesh].primitives) {
      const a = j.accessors[p.attributes.POSITION], v = j.bufferViews[a.bufferView];
      assert.equal(a.componentType, 5126);
      for (let i=0; i<a.count; i++) {
        const o = (v.byteOffset ?? 0)+(a.byteOffset ?? 0)+i*(v.byteStride ?? 12);
        let point = [0, 4, 8].map(k=>bin.readFloatLE(o+k));
        for (const node of chain) point = tr(point,node);
        point.forEach((x,k) => { assert(Number.isFinite(x)); bounds.min[k]=Math.min(bounds.min[k],x); bounds.max[k]=Math.max(bounds.max[k],x); });
      }
    }
    for (const child of n.children ?? []) walk(child,chain);
  };
  for (const root of j.scenes[j.scene ?? 0].nodes) walk(root,[]);
  return {file, bytes:b.length, sha256:hash(b), scenes:j.scenes.map(s=>s.name), meshes:meshes.size,
    materials:j.materials.length, triangles:j.meshes.reduce((a,m)=>a+m.primitives.reduce((a,p)=>a+j.accessors[p.indices].count/3,0),0), bounds};
}
const assets = ['roadster-gt','firstspan-coast'].map(n=>inspect(`public/assets/${n}.glb`));
const car=assets[0];
assert(car.bounds.min[0]>=-1.15 && car.bounds.max[0]<=1.15);
assert(car.bounds.min[2]>=-2.05 && car.bounds.max[2]<=2.05);
assert(car.bounds.min[1]>=-.01 && car.bounds.max[1]<=1.45);
const receipts = ['pc','touch-667','touch-844'].map(n=>{
  const f=`docs/coastal-art-production-native-${n}.json`, r=read(f);
  assert.equal(r.pass,true,f);
  assert.equal(r.ordinaryEntry.bundle,'/assets/roadster-6L2jcyue.js');
  return {file:f, pass:r.pass, bundle:r.ordinaryEntry.bundle};
});
const files=[];
function list(dir) { for (const f of fs.readdirSync(dir,{withFileTypes:true})) { const p=path.posix.join(dir,f.name); if(f.isDirectory())list(p);else {const b=fs.readFileSync(p);files.push({path:p.slice(5),bytes:b.length,sha256:hash(b)});} } }
list('dist');
fs.writeFileSync('docs/coastal-art-production-files.json',JSON.stringify({files,totalBytes:files.reduce((s,f)=>s+f.bytes,0)},null,2)+'\n');
const result={date:new Date().toISOString(),independentReview:true,freezeFilesVerified:checked.length,assets,
  baseline:{head:baseline.head,files:baseline.files.length,unchanged:baseline.files.length-changed.length,authorizedChanged:changed},
  geometry:{surfaces:layout.surfaces.length,colliders:layout.colliders.length,originalGLBUnchanged:true},
  receipts,productionFiles:files.length,bundles:frozen.roadsterBundles,pass:true};
fs.writeFileSync('docs/coastal-art-supervisor-final-review.json',JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
