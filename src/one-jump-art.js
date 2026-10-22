import{TransformNode}from'@babylonjs/core/Meshes/transformNode.js';
import{MeshBuilder}from'@babylonjs/core/Meshes/meshBuilder.js';
import{ONE_JUMP as BASE,constructionBoxes as BASE_BOXES}from'./one-jump-config.js';
import{SUPPLY}from'./supply-config.js';
export function buildOneJumpArt(scene,{box,mat,mergeStatic,steel,black,cyan,yellow,makeSupply,layout=BASE,boxes=BASE_BOXES}){
 const J=layout,constructionBoxes=boxes;
 const root=new TransformNode('one-jump-course',scene),fleet=new TransformNode('construction-fleet',scene);fleet.parent=root;
 const orange=mat('work-orange','#b97934'),grey=mat('work-grey','#a1a58b'),rubber=mat('work-rubber','#202a30'),glass=mat('work-windshield','#243c49'),amber=mat('work-amber','#ffc66d',.6),red=mat('work-tail-red','#e73e38',.7);
 for(const b of constructionBoxes){const t=J.trucks.find(t=>t.id===b.truck);box(b.id,b.width,b.top-b.bottom,b.depth,b.x,(b.top+b.bottom)/2,b.z,b.part==='chassis'?steel:b.part==='load'?grey:J.trucks.indexOf(t)%2?grey:orange,fleet);}
 for(const t of J.trucks){
  for(const side of[-1,1])for(const z of[-2.6,2.6]){const w=MeshBuilder.CreateCylinder('work-wheel',{diameter:.88,height:.34,tessellation:12},scene);w.rotation.z=Math.PI/2;w.position.set(t.x+side*1.6,.46,t.z+z);w.material=rubber;w.parent=fleet;}
  box('work-front-window',2.9,.64,.025,t.x,1.99,t.z+4.1,glass,fleet);
  for(const side of[-1,1]){box('work-side-window',.025,.64,1.7,t.x+side*1.752,1.99,t.z+2.7,glass,fleet);box('work-rear-tail',.45,.16,.026,t.x+side*1.16,.65,t.z-4.21,red,fleet);box('work-beacon',.38,.12,.3,t.x+side*.9,2.42,t.z+2.7,amber,fleet);}
  for(let i=0;i<6;i++){const band=box('work-rear-hazard',.3,.5,.028,t.x-1.35+i*.54,.75,t.z-4.215,i%2?black:yellow,fleet);band.rotation.z=-.3;}
 }
 mergeStatic(fleet);
 for(let z=J.launch.start;z<=J.launch.end;z+=10)for(const side of[-1,1]){const m=box('jump-launch-chevron',2.5,.025,.35,side*1.1,.04,z,yellow,root);m.rotation.y=side*.45;}
 for(const x of[-6,6])box('launch-zone-edge',.1,.025,J.launch.end-J.launch.start,x,.04,(J.launch.start+J.launch.end)/2,yellow,root);
 for(const x of[-J.landing.halfWidth,J.landing.halfWidth])box('wide-landing-guide',.15,.025,J.landing.end-J.landing.start,x,.035,(J.landing.start+J.landing.end)/2,cyan,root);
 for(const x of[-13.7,13.7])for(const z of[52,82,112,145]){box('work-side-post',.22,1,.22,x,.5,z,steel,root);box('work-side-light',.24,.15,.24,x,1.04,z,amber,root);}
 const ring=J.ring?makeSupply('one-jump-pressure',root):null;if(ring){ring.scaling.setAll(J.ring.radius/SUPPLY.radius);ring.position.set(J.ring.x,J.ring.y,J.ring.z);}/* guides remain fixed bounded meshes */
 // mergeStatic only merges direct/material children; do not merge the animated label/ring/fleet twice.
 return{root,fleet,ring,casters:fleet.getChildMeshes(),update(z,state,enabled){root.setEnabled(enabled);root.position.z=-z;ring?.setEnabled(!state?.ringCrossed);}};
}
