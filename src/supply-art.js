import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { SUPPLY } from './supply-config.js';
/** Shared label/materials; a bounded pool, visibly different from the thin score rings. */
export function supplyFactory(scene) {
  const material = new StandardMaterial('pressure-ring-lime', scene); material.diffuseColor = Color3.FromHexString('#b7da91'); material.emissiveColor = material.diffuseColor.scale(.35); material.specularColor.set(.1,.15,.1);
  const label = new StandardMaterial('pressure-ring-label', scene), texture = new DynamicTexture('pressure-label-atlas', {width:256,height:96},scene,true);
  const c=texture.getContext();c.fillStyle='#193d39';c.fillRect(0,0,256,96);c.strokeStyle='#b7da91';c.lineWidth=3;c.strokeRect(2,2,252,92);c.fillStyle='#d2edab';c.fillRect(14,30,23,43);c.fillRect(20,18,11,16);c.fillStyle='#193d39';c.fillRect(18,49,15,7);c.font='bold 32px sans-serif';c.textBaseline='middle';c.fillStyle='#e0f3c5';c.fillText('+30 气压',48,49);texture.update(false);label.diffuseTexture=texture;label.emissiveColor.set(.5,.5,.5);label.backFaceCulling=false;
  return (name,parent) => {
    const root=new TransformNode(name,scene);if(parent)root.parent=parent;
    const ring=MeshBuilder.CreateTorus('pressure-hoop',{diameter:SUPPLY.radius*2,thickness:.19,tessellation:32},scene);ring.rotation.x=Math.PI/2;ring.parent=root;ring.material=material;
    const bottle=MeshBuilder.CreateCylinder('pressure-bottle',{diameter:.5,height:.85,tessellation:10},scene);bottle.position.set(SUPPLY.radius+.25,0,0);bottle.parent=root;bottle.material=material;
    const cap=MeshBuilder.CreateCylinder('pressure-bottle-neck',{diameter:.23,height:.22,tessellation:8},scene);cap.position.set(SUPPLY.radius+.25,.52,0);cap.parent=root;cap.material=material;
    const tag=MeshBuilder.CreatePlane('pressure-label',{width:2.8,height:1.05},scene);tag.position.set(0,SUPPLY.radius+.7,0);tag.parent=root;tag.material=label;tag.billboardMode=Mesh.BILLBOARDMODE_ALL;
    for(const mesh of root.getChildMeshes())mesh.isPickable=false;return root;
  };
}
