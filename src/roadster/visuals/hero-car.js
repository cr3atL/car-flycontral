import {SceneLoader} from '@babylonjs/core/Loading/sceneLoader.js';
import {Quaternion,Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {Color3} from '@babylonjs/core/Maths/math.color.js';
import {Material} from '@babylonjs/core/Materials/material.js';

export async function loadHeroCar(scene,body,car){
 const asset=await SceneLoader.ImportMeshAsync(null,'./assets/','roadster-gt.glb',scene);
 const root=asset.meshes.find(m=>m.name==='__root__');root.rotationQuaternion=Quaternion.Identity();root.scaling.setAll(1);root.parent=body;
 const wheels=asset.transformNodes.filter(n=>/^GT_Wheel_/.test(n.name)),bases=new Map();
 for(const wheel of wheels){
  wheel.computeWorldMatrix(true);const scale=new Vector3(),rotation=new Quaternion(),position=new Vector3();wheel.getWorldMatrix().decompose(scale,rotation,position);
  wheel.parent=car;wheel.position.copyFrom(position);wheel.scaling.copyFrom(scale);wheel.rotationQuaternion=rotation.clone();bases.set(wheel,rotation);
 }
 for(const mesh of asset.meshes){mesh.isPickable=false;mesh.receiveShadows=true;mesh.sideOrientation=Material.CounterClockWiseSideOrientation;if(mesh.material){mesh.material.backFaceCulling=false;mesh.material.sideOrientation=Material.CounterClockWiseSideOrientation;}}
 for(const m of asset.meshes)if(m.material?.name.includes('Crimson_Clearcoat')){m.material.albedoColor=new Color3(.52,.015,.026);m.material.metallic=.32;}
 let spin=0;
 return{meshes:asset.meshes,wheels,update:(s,dt)=>{const rolling=s.grounded?s.vx*Math.sin(s.heading)+s.vz*Math.cos(s.heading):s.speed;spin+=rolling*dt/.42;for(const w of wheels)w.rotationQuaternion=Quaternion.FromEulerAngles(spin,w.name.startsWith('GT_Wheel_F')?s.steerAngle:0,0).multiply(bases.get(w));},snapshot:()=>({asset:'roadster-gt.glb',meshes:asset.meshes.length,wheelPivots:wheels.length,wheels:wheels.map(w=>({name:w.name,position:w.position.asArray(),rotation:w.rotationQuaternion.asArray()})),triangles:asset.meshes.reduce((n,m)=>n+m.getTotalIndices()/3,0),mode:'Blender MCP curved 3D geometry'})};
}
