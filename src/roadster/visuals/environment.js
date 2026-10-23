import {HDRCubeTexture} from '@babylonjs/core/Materials/Textures/hdrCubeTexture.js';
import {Color3} from '@babylonjs/core/Maths/math.color.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';
import {Plane} from '@babylonjs/core/Maths/math.plane.js';
import {Quaternion} from '@babylonjs/core/Maths/math.vector.js';
import {SceneLoader} from '@babylonjs/core/Loading/sceneLoader.js';
import {ImageProcessingConfiguration} from '@babylonjs/core/Materials/imageProcessingConfiguration.js';
import {Material} from '@babylonjs/core/Materials/material.js';
import '@babylonjs/core/Helpers/sceneHelpers.js';
import {applySky} from './sky.js';
import {createOcean} from './ocean.js';

export async function setupEnvironment(scene,baseAsset,sun,hemi,shadow,mobile){
 const spec=await(await fetch('./assets/firstspan/visual-manifest.json')).json();
 const env=await new Promise((resolve,reject)=>{const texture=new HDRCubeTexture('./assets/firstspan/kloppenheim_06_puresky_1k.hdr',scene,mobile?64:128,false,true,false,true,()=>resolve(texture),m=>reject(Error(m)));});
 scene.environmentTexture=env;scene.environmentIntensity=.65;
 const sky=scene.createDefaultSkybox(env,true,1600,.08,true);if(sky)applySky(scene,sky,env);
 scene.imageProcessingConfiguration.toneMappingEnabled=true;scene.imageProcessingConfiguration.toneMappingType=ImageProcessingConfiguration.TONEMAPPING_ACES;scene.imageProcessingConfiguration.exposure=1.05;scene.imageProcessingConfiguration.contrast=1.04;
 sun.direction.set(-.48,-.55,-.68);sun.intensity=2.5;sun.diffuse=new Color3(1,.87,.69);hemi.intensity=.65;hemi.diffuse=new Color3(.83,.88,1);hemi.groundColor=new Color3(.50,.38,.30);
 scene.fogDensity=.00065;scene.fogColor=new Color3(.62,.74,.82);
 const L=sun.direction.negate().normalize();let ocean=null;
 for(const m of baseAsset.meshes){
  if(m.name==='CI_batch_water')ocean=createOcean(scene,m,env,L,spec.foamContacts??[[0,88,1.2,8.2],[0,187,1.2,8.2]]);
  if(m.name==='CI_batch_foam')m.setEnabled(false);
  if(/CI_batch_city/.test(m.name)&&m.material){m.material.albedoColor=Color3.Lerp(m.material.albedoColor??new Color3(.4,.5,.6),new Color3(.55,.65,.72),.62);m.material.roughness=1;}
  if(/CI_batch_cyan/.test(m.name)&&m.material){m.material.emissiveColor?.scaleInPlace(.08);m.material.albedoColor?.scaleInPlace(.65);}
  if(/CI_batch_concrete|CI_surface_(?:runway|landing)/.test(m.name))shadow.addShadowCaster(m,false);
 }
 let coast=null;
 if(spec.coastAsset){
  coast=await SceneLoader.ImportMeshAsync(null,'./assets/',spec.coastAsset,scene);const root=coast.meshes.find(m=>m.name==='__root__');root.rotationQuaternion=Quaternion.Identity();root.scaling.setAll(1);
  for(const m of coast.meshes){m.receiveShadows=true;m.isPickable=false;m.sideOrientation=Material.CounterClockWiseSideOrientation;if(m.material)m.material.backFaceCulling=false;}
  for(const m of baseAsset.meshes.filter(m=>/^CI_batch_(?:rock|rockLight|green|leaf|trunk|cyan)$/.test(m.name))){
   for(const [tag,plane]of[['before',new Plane(0,0,1,-65)],['after',new Plane(0,0,-1,335)]]){
    const copy=m.clone('firstspan-preserved-'+tag+'-'+m.name,m.parent);copy.material=m.material.clone(copy.name+'-mat');copy.material.clipPlane=plane;copy.setEnabled(true);
   }m.setEnabled(false);
  }
 }
 return{update:dt=>ocean?.update(dt),snapshot:()=>({hdr:'local CC0 Kloppenheim 06 1K',ocean:ocean?.snapshot(),coast:spec.coastAsset??'MCP connection pending',quality:mobile?'mobile 64px IBL':'desktop 128px IBL',sun:L.asArray()})};
}
