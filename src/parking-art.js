import{SUPPLY}from'./supply-config.js';
import{TransformNode}from'@babylonjs/core/Meshes/transformNode.js';
import{MeshBuilder}from'@babylonjs/core/Meshes/meshBuilder.js';
import{PARKING as P}from'./parking-config.js';import{cartPosition}from'./parking.js';
const clamp=v=>Math.max(0,Math.min(1,v));
export function buildParkingArt(scene,{box,mat,steel,black,yellow,cyan,makeSupply}){
 const root=new TransformNode('parking-atrium',scene),slab=mat('parking-concrete','#8d9290'),dark=mat('parking-deck','#4a5354'),orange=mat('parking-machine-orange','#e2a136'),red=mat('parking-wall-red','#a64b3b'),light=mat('parking-light','#d9f3e8',.8),mint=mat('parking-exit','#73edbe',.7);
 const platePaint=mat('parking-plate-yellow','#c8ad53',.05),glass=mat('parking-cleaner-glass','#29434a');platePaint.specularColor.set(.05,.05,.05);
 const b=(name,w,h,d,x,y,z,m=slab,parent=root)=>box('parking-'+name,w,h,d,x,y,z,m,parent);
 // Raised galleries form an open atrium, leaving the driving corridor unobstructed.
 for(const x of[-18,18])for(const z of[20,110,220,320,420,525]){b('column',2.1,24,2.1,x,12,z);for(const y of[7,15,23])b('gallery',10,.55,92,x+Math.sign(x)*3,y,z,dark);b('light-strip',.25,.3,58,x-Math.sign(x)*1.2,8.7,z,light);}
 for(const z of[25,120,230,350,525])b('cross-member',39,1.1,1,0,24,z,steel);
 // Early road markings make the two viable lanes visible before takeoff.
 function arrows(x,z,colour){for(let i=0;i<3;i++){const a=b('arrow',.45,.025,3,x-.9,.025,z+i*5,colour),c=b('arrow',.45,.025,3,x+.9,.025,z+i*5,colour);a.rotation.y=-.6;c.rotation.y=.6;}}
 arrows(0,65,yellow);arrows(-8,40,light);arrows(8,40,light);arrows(0,176,yellow);
 for(const [start,end]of[[P.launch.start,P.launch.end],[P.localLaunch.start,P.localLaunch.end]])for(const x of[-11,11])b('launch-line',1,.028,end-start,x,.027,(start+end)/2,yellow);
 const rack=new TransformNode('parking-tilted-rack',scene);rack.parent=root;rack.position.set(0,P.rack.y,P.rack.z);rack.rotation.z=P.rack.angle;
 b('rack-mechanism-base',P.rack.baseWidth,P.rack.baseTop,P.rack.depth,0,P.rack.baseTop/2,P.rack.z,steel);
 for(let i=0;i<6;i++)b('base-hazard',.6,.3,.12,-4.5+i*1.8,3,P.rack.z-P.rack.depth/2-.08,i%2?black:yellow);
 const r=P.rack,w=r.outerWidth,h=r.outerHeight,aw=r.halfWidth*2,ah=r.halfHeight*2;
 for(const sign of[-1,1]){b('rack-side',(w-aw)/2,h,r.depth,sign*(w+aw)/4,0,0,steel,rack);b('rack-cap',aw,(h-ah)/2,r.depth,0,sign*(h+ah)/4,0,steel,rack);for(const z of[-r.depth/2-.04,r.depth/2+.04]){b('rack-lit-side',.12,ah,.08,sign*aw/2,0,z,yellow,rack);b('rack-lit-edge',aw,.1,.08,0,sign*ah/2,z,yellow,rack);}}
 const guards=[-1,1].map(sign=>{const g=b('breakable-guard',.12,ah*.7,.2,sign*(aw/2+.05),0,-r.depth/2-.12,orange,rack);return g;});
 for(const m of rack.getChildMeshes()){const positions=m.getVerticesData('position');for(let i=0;i<positions.length;i+=3){positions[i]+=Math.sin(r.angle)*r.slope*positions[i+2];positions[i+1]+=Math.cos(r.angle)*r.slope*positions[i+2];}m.position.x+=Math.sin(r.angle)*r.slope*m.position.z;m.position.y+=Math.cos(r.angle)*r.slope*m.position.z;m.setVerticesData('position',positions);m.refreshBoundingInfo();}
 // Visible receiver deck is continuous ground; no invisible mid-air landing gate.
 b('receiver',24,.14,88,0,-.08,207,dark);
 const ring=makeSupply('parking-main-pressure');ring.parent=root;ring.position.set(P.ring.x,P.ring.y,P.ring.z);ring.scaling.setAll(P.ring.radius/SUPPLY.radius);
 const plate=new TransformNode('parking-pressure-slab',scene);plate.parent=root;plate.position.z=(P.plate.start+P.plate.end)/2;
 b('plate-body',22,.25,P.plate.end-P.plate.start,0,-.08,0,orange,plate);
 for(const x of[-10,10])b('plate-edge',.28,.04,90,x,.07,0,black,plate);
 for(let z=-40;z<=40;z+=10){b('plate-rib',19,.05,.15,0,.14,z,black,plate);}
 b('plate-core',P.plate.coreHalfWidth*2,.03,P.plate.coreEnd-P.plate.coreStart,0,.1,(P.plate.coreStart+P.plate.coreEnd)/2-(P.plate.start+P.plate.end)/2,platePaint,plate);arrows(0,240,yellow);
 // One exposed mechanical chain visually connects the slab to the launch cradle.
 const links=[];for(let z=264;z<280;z+=4){links.push(b('pull-rod',.24,.24,5,-11,.6,z,steel));b('link-pivot',.7,.7,.7,-11,.6,z,orange);}
 const cradle=new TransformNode('parking-cart-cradle',scene);cradle.parent=root;cradle.position.set(P.cart.x,.5,P.cart.z);
 b('cradle',4,.35,6,0,0,0,steel,cradle);b('cradle-arm',1.2,.5,8,0,-.4,0,orange,cradle);
 const cart=new TransformNode('parking-cleaning-cart',scene);cart.parent=root;
 b('cleaner-body',3,1.4,3.8,0,0,0,orange,cart);b('cleaner-cabin',2,1.5,1.8,0,1.3,.5,orange,cart);b('cleaner-window',1.8,.8,.05,0,1.5,1.42,glass,cart);b('cleaner-beacon',.35,.25,.35,0,2.2,.5,mint,cart);b('cleaner-brush',3.8,.4,1,0,-.65,2.2,black,cart);
 for(const x of[-1.5,1.5])for(const z of[-1.1,1.1]){const wheel=MeshBuilder.CreateCylinder('parking-cart-wheel',{diameter:.9,height:.4,tessellation:10},scene);wheel.parent=cart;wheel.rotation.z=Math.PI/2;wheel.position.set(x,-.5,z);wheel.material=black;}
 const trail=Array.from({length:4},()=>b('cart-flight-streak',.2,.2,3,0,0,0,yellow));
 const wallParts=[];for(let x=-11;x<=11;x+=4.4)for(let y=2;y<16;y+=4){const m=b('wall-panel',4.3,3.9,2,x,y,P.wall.z,red);wallParts.push({m,x,y,z:P.wall.z});}
 for(const x of[-13,13])b('wall-frame',1,18,3,x,9,P.wall.z,steel);
 // The orange folded maintenance bridge becomes collision-ground only when locked.
 const hinge=new TransformNode('parking-bridge-hinge',scene);hinge.parent=root;hinge.position.set(0,-.08,P.bridge.start);
 b('bridge-deck',26,.3,P.bridge.end-P.bridge.start,0,0,(P.bridge.end-P.bridge.start)/2,orange,hinge);
 for(const x of[-12.5,12.5]){b('bridge-rail',.25,1.2,68,x,.65,34,steel,hinge);b('bridge-edge',.14,.04,68,x,.19,34,mint,hinge);}
 for(let z=4;z<68;z+=8)b('bridge-joint',25,.035,.3,0,.18,z,black,hinge);
 b('exit-arch',27,1.2,1,0,7,P.exit,mint);for(const x of[-13,13])b('exit-post',1.2,8,1,x,4,P.exit,mint);arrows(0,520,mint);
 // Clearly marked forward transfer returns to the local receiver, without reversing.
 for(const x of[-10,10])b('maintenance-return',2,.03,12,x,.025,P.retryAt-8,yellow);
 root.setEnabled(false);
 function update(s,p,active){root.setEnabled(active);if(!active)return;root.position.z=-s.z;
  const age=p.triggerAt===null?-1:s.time-p.triggerAt,lightAge=p.lightAt===null?99:s.time-p.lightAt;
  plate.position.y=age>=0?-.14*Math.sin(Math.min(1,age/.2)*Math.PI/2):lightAge<1.1?-.08*Math.sin(lightAge/1.1*Math.PI):0;
  links.forEach((m,i)=>m.position.y=.6+(age>=0&&age<.5?.12*Math.sin(age*30+i):0));
  cradle.rotation.x=age>=0?-.6*Math.sin(Math.min(1,Math.max(0,(age-.15)/.35))*Math.PI):lightAge<1.1?-.23*Math.sin(lightAge/1.1*Math.PI):0;
  if(age<P.cart.fireAt){cart.position.set(P.cart.x,P.cart.y+cradle.rotation.x*-2,P.cart.z);cart.rotation.set(0,0,0);cart.setEnabled(true);}else if(!p.wallBroken){const c=cartPosition(age);cart.position.set(c.x,c.y,c.z);cart.rotation.x=-(age-P.cart.fireAt)*3;cart.rotation.z=(age-P.cart.fireAt)*1.5;}else{cart.setEnabled(true);cart.position.set(-10,1,P.wall.z+6);cart.rotation.set(.35,.5,1.1);}
  trail.forEach((m,i)=>{const t=age-(i+1)*.035;m.setEnabled(age>P.cart.fireAt&&!p.wallBroken&&t>P.cart.fireAt);if(m.isEnabled()){const c=cartPosition(t);m.position.set(c.x,c.y,c.z);m.rotation.y=Math.atan2(-P.cart.x,P.wall.z-P.cart.z);}});
  const hit=p.hitAt===null?-1:s.time-p.hitAt;wallParts.forEach(({m,x,y,z},i)=>{m.setEnabled(hit<2.2);if(hit<0){m.position.set(x,y,z);m.rotation.set(0,0,0);}else{const dx=(i%2?1:-1)*(3+i%4),t=Math.min(hit,2.2);m.position.set(x+dx*t,y+(3+i%3)*t-7*t*t,z+9*t+i*.1);m.rotation.set(t*(i%3),t*.8,t*.5);}});
  const deployed=p.wallBroken?clamp((age-P.bridge.begin)/(P.bridge.locked-P.bridge.begin)):0;hinge.rotation.x=-(1-deployed)*Math.PI/2;
  guards.forEach((g,i)=>{g.setEnabled(!p.scraped||age<0&&s.z<P.rack.z+20);g.rotation.y=p.scraped?(i?1:-1)*.8:0;});ring.setEnabled(!p.ringCrossed);
 }
 return{root,update,casters:root.getChildMeshes()};
}
