import{TransformNode}from'@babylonjs/core/Meshes/transformNode.js';
import{SPRINT as P}from'./sprint-config.js';
import{buildOneJumpArt}from'./one-jump-art.js';
import{SUPPLY}from'./supply-config.js';
export function buildSprintArt(scene,helpers){
 const{box,mat,steel,black,cyan,yellow,makeSupply}=helpers,root=new TransformNode('three-section-course',scene);
 const first=buildOneJumpArt(scene,{...helpers,layout:{launch:P.sections[0].launch,landing:P.sections[0].pad,trucks:P.trucks,ring:null},boxes:P.boxes.filter(b=>b.truck)});first.root.parent=root;
 const concrete=mat('sprint-bridge-concrete','#697c82'),beam=mat('sprint-bridge-steel','#3e5967');
 const structure=[];for(const b of P.boxes.filter(b=>!b.truck)){const m=box(b.id,b.width,b.top-b.bottom,b.depth,b.x,(b.top+b.bottom)/2,b.z,b.part==='rail'?yellow:b.part==='roof'?concrete:beam,root);m.receiveShadows=true;structure.push(m);}
 for(const d of P.sections.slice(1)){
  for(let z=d.launch.start;z<=d.launch.end;z+=10)for(const side of[-1,1]){const m=box('sprint-launch-chevron',2.5,.025,.35,side*1.1,.04,z,yellow,root);m.rotation.y=side*.45;}
  for(const x of[-6,6])box('sprint-launch-edge',.12,.025,d.launch.end-d.launch.start,x,.04,(d.launch.start+d.launch.end)/2,yellow,root);
  for(const x of[-d.pad.halfWidth,d.pad.halfWidth])box('sprint-landing-guide',.16,.025,d.pad.end-d.pad.start,x,.035,(d.pad.start+d.pad.end)/2,cyan,root);
 }
 for(const z of[P.gap.start,P.gap.end]){box('sprint-real-platform-edge',26,.12,.5,0,-.06,z,yellow,root);for(const x of[-12.6,12.6]){box('sprint-platform-beacon',.22,2,.22,x,1,z,steel,root);box('sprint-platform-light',.3,.25,.3,x,2,z,cyan,root);}}
 for(const z of[1013.7,1016.3])for(let x=-12;x<=12;x+=1.2){const m=box('sprint-rail-band',.4,.8,.035,x,.53,z,black,root);m.rotation.z=-.3;}
 for(const z of[1074.98,1115.02])for(let x=-8.6;x<9;x+=1){const m=box('sprint-roof-stripe',.4,.5,.025,x,9.4,z,yellow,root);m.rotation.z=-.3;}
 const ring=makeSupply('sprint-high-ring',root);ring.scaling.setAll(P.ring.radius/SUPPLY.radius);ring.position.set(P.ring.x,P.ring.y,P.ring.z);
 for(const z of[350,450,830,900,1230,1270,1310])for(const x of[-12.7,12.7]){box('sprint-road-post',.18,1.4,.18,x,.7,z,steel,root);box('sprint-road-lamp',.2,.12,.3,x,1.43,z,cyan,root);}
 for(const x of[-10,-5,0,5,10])box('sprint-finish-stripe',2,.025,.8,x,.035,P.end,yellow,root);
 const exitCyan=mat('sprint-exit-cyan','#86ffec',.9),exitAmber=mat('sprint-exit-amber','#ffd487',.9);for(const m of[exitCyan,exitAmber]){m.disableLighting=true;m.alpha=.8;}for(let z=1150;z<=1350;z+=25)for(const side of[-1,1]){const material=z<1250?exitCyan:exitAmber;box('sprint-open-gate-edge',.22,5,.14,side*13.35,2.5,z,material,root);box('sprint-open-gate-outside-arm',1.4,.16,.14,side*14,5,z,material,root);box('sprint-exit-contrast-board',.4,1.2,.10,side*13.5,1.1,z,black,root);for(const y of[.75,1.15,1.55])box('sprint-exit-board-light',.42,.14,.12,side*13.5,y,z,material,root);}
 root.setEnabled(false);return{root,casters:[...first.casters,...structure],update(z,state,enabled){root.setEnabled(enabled);root.position.z=-z;ring.setEnabled(!state?.ringCrossed);}};
}
