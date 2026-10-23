import fs from 'node:fs';
import crypto from 'node:crypto';
import {intersection,polygonArea,topAt} from '../src/roadster/geometry.js';
const hash=b=>crypto.createHash('sha256').update(b).digest('hex');
function glb(path){const data=fs.readFileSync(path),len=data.readUInt32LE(12),j=JSON.parse(data.subarray(20,20+len)),bin=data.subarray(28+len);return{data,j,bin};}
function accessor(g,id){const a=g.j.accessors[id],v=g.j.bufferViews[a.bufferView],n={SCALAR:1,VEC2:2,VEC3:3,VEC4:4}[a.type],bytes={5126:4,5125:4,5123:2,5121:1}[a.componentType],read={5126:'readFloatLE',5125:'readUInt32LE',5123:'readUInt16LE',5121:'readUInt8'}[a.componentType],start=(v.byteOffset??0)+(a.byteOffset??0),stride=v.byteStride??bytes*n;return Array.from({length:a.count},(_,i)=>Array.from({length:n},(_,k)=>g.bin[read](start+i*stride+k*bytes)));}
const reports=[];
for(const stem of['roadster-gt','firstspan-coast']){
 const g=glb('public/assets/'+stem+'.glb'),meshes=new Set(g.j.nodes.flatMap(n=>n.mesh===undefined?[]:[n.mesh])),materials=new Set(g.j.meshes.flatMap(m=>m.primitives.flatMap(p=>p.material===undefined?[]:[p.material])));
 reports.push({asset:stem+'.glb',sha256:hash(g.data),bytes:g.data.length,scenes:g.j.scenes.map(s=>s.name),nodes:g.j.nodes.length,meshes:g.j.meshes.length,referencedMeshes:meshes.size,materials:g.j.materials.length,referencedMaterials:materials.size,triangles:g.j.meshes.reduce((sum,m)=>sum+m.primitives.reduce((n,p)=>n+g.j.accessors[p.indices].count/3,0),0),allCoastPrimitivesHaveVertexColors:stem==='firstspan-coast'?g.j.meshes.every(m=>m.primitives.every(p=>p.attributes.COLOR_0!==undefined)):undefined,wheelPivots:g.j.nodes.filter(n=>/^GT_Wheel_/.test(n.name)).map(n=>({name:n.name,translation:n.translation})),foreignNodes:g.j.nodes.filter(n=>!new RegExp(stem==='roadster-gt'?'^GT_':'^FS_').test(n.name)).map(n=>n.name)});
}
const g=glb('public/assets/firstspan-coast.glb'),layout=JSON.parse(fs.readFileSync('public/assets/coastal-interchange-layout.json'));let checked=0;const overlaps=[];
for(const mesh of g.j.meshes){if(/^FS_mark/.test(mesh.name))continue;
 for(const p of mesh.primitives){const v=accessor(g,p.attributes.POSITION),idx=accessor(g,p.indices).flat();
  for(let i=0;i<idx.length;i+=3){const t=idx.slice(i,i+3).map(k=>({x:v[k][0],y:v[k][1],z:v[k][2]}));checked++;const xmin=Math.min(...t.map(p=>p.x)),xmax=Math.max(...t.map(p=>p.x)),zmin=Math.min(...t.map(p=>p.z)),zmax=Math.max(...t.map(p=>p.z));
   for(const road of layout.surfaces){if(xmax<road.xmin||xmin>road.xmax||zmax<road.zmin||zmin>road.zmax)continue;const q=intersection(t,road);if(!q.length)continue;
    const[A,B,C]=t,den=(B.z-C.z)*(A.x-C.x)+(C.x-B.x)*(A.z-C.z);if(Math.abs(den)<1e-9)continue;
    const gap=q.map(p=>{const u=((B.z-C.z)*(p.x-C.x)+(C.x-B.x)*(p.z-C.z))/den,w=((C.z-A.z)*(p.x-C.x)+(A.x-C.x)*(p.z-C.z))/den;return A.y*u+B.y*w+C.y*(1-u-w)-topAt(road,p.x,p.z);});
    if(Math.max(...gap)>=-.12&&Math.min(...gap)<=3)overlaps.push({mesh:mesh.name,triangle:i/3,road:road.id,gap:[Math.min(...gap),Math.max(...gap)]});
   }
  }
 }
}
const baseline=JSON.parse(fs.readFileSync('docs/coastal-art-supervisor-baseline.json'));const changed=baseline.files.filter(f=>hash(fs.readFileSync(f.path))!==f.sha256).map(f=>f.path);
const result={assets:reports,coastRoadClearance:{method:'Exact nonvertical projected triangle/convex road polygon intersection, linear height range in driving envelope top-0.12m to top+3m; route paint excluded',trianglesChecked:checked,overlaps},preservation:{baseline:baseline.head,total:baseline.files.length,changed,unchanged:baseline.files.length-changed.length,layoutSurfaces:layout.surfaces.length,layoutColliders:layout.colliders.length,originalTrackGLBSha256:hash(fs.readFileSync('public/assets/coastal-interchange.glb'))}};
fs.writeFileSync('docs/coastal-art-final-audit.json',JSON.stringify(result,null,2)+'\n');console.log(JSON.stringify(result,null,2));
