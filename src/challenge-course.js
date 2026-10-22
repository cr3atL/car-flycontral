import{CONFIG as C}from'./config.js';
import{bodyExtents,contactHeight}from'./simulation.js';
export const gateHeight=(g,time)=>8.5+1.3*(.5+.5*Math.sin((time-g.spawnTime)*Math.PI/4));
/** All dimensions are metres. These same finite solids feed drawing and OBB collision. */
export function flowGeometry(def,z){
 const boxes=[],add=(id,x,dz,width,depth,top,bottom=0,part='barrier')=>boxes.push({id:`${def.id}:${id}`,x,z:z+dz,width,depth,bottom,top,part}),fleet=(stagger,top)=>[-10.4,-5.2,0,5.2,10.4].forEach((x,i)=>add('truck-'+i,x,stagger[i],4.6,8.5,Array.isArray(top)?top[i]:top,.22,'truck'));
 let gap=null,ceiling=null;const rings=[],supplies=[];let padStart=60,padEnd=185;
 const ring=(dz,y,radius=3.2)=>rings.push({id:`ring-${def.id}`,x:0,y,z:z+dz,radius,collected:false});
 const supply=(dz,y,radius=4)=>supplies.push({id:`pressure-${def.id}`,x:0,y,z:z+dz,radius,collected:false});
 switch(def.layout){
  case'fleet':fleet([0,4,0,4,0],2);ring(3,3.7);supply(8,6.5,3.6);padStart=17;padEnd=155;break;
  case'stagger':fleet([0,8,16,8,0],[1.5,1.7,1.9,1.7,1.5]);add('second-rail',0,45,25.6,2,1.0);ring(18,7.8);padStart=56;padEnd=185;break;
  case'bridge':gap={start:z,end:z+85};supply(38,10.4,4.8);ring(110,17.5,4.2);padStart=89;padEnd=290;break;
  case'lowbridge':add('entry-rail',0,0,25.6,2,.85);ceiling={start:z-10,end:z+55,bottom:7.8,top:8.6,width:16,pillarX:8.7,pillarWidth:1.1};ring(9,3.6);padStart=38;padEnd=205;break;
  case'showcase':add('low-rail',0,0,25.6,2,.65);ring(112,18.5,4.2);padStart=42;padEnd=245;break;
  case'gate':add('entry-rail',0,0,25.6,2,.8);ceiling={start:z+18,end:z+20,moving:true,top:12,width:18,pillarX:9.7,pillarWidth:1.0};ring(5,3.6);padStart=35;padEnd=190;break;
  case'final':fleet([0,0,0,0,0],1.1);gap={start:z+30,end:z+66};ceiling={start:z+76,end:z+100,bottom:8.8,top:9.6,width:18,pillarX:9.7,pillarWidth:1.0};ring(42,6.1,3.6);padStart=70;padEnd=310;break;
 }
 return{boxes,gap,ceiling,rings,supplies,pad:{x:0,halfWidth:11.5,start:z+padStart,end:z+padEnd}};
}
export function courseBoxes(g,time){
 const boxes=[...(g.boxes??[]),...(g.walls??[]).map((w,i)=>({id:`wall-${i}`,x:w.x??0,z:w.z,width:w.width??27.2,depth:w.depth,bottom:0,top:w.height,part:'barrier'}))],c=g.ceiling;
 if(c){const bottom=c.moving?gateHeight(g,time):c.bottom,top=c.top??(c.moving?12:bottom+.6),width=c.width??27.2;boxes.push({id:'roof',x:0,z:(c.start+c.end)/2,width,depth:c.end-c.start,bottom,top,part:c.moving?'gate':'roof'});for(const x of[-1,1])for(const z of[c.start,c.end])boxes.push({id:'pillar',x:x*(c.pillarX??13.5),z,width:c.pillarWidth??.45,depth:.45,bottom:0,top:c.moving?12.5:top,part:'pillar'});}
 return boxes;
}
export function courseCollision(s,p,g,time){
 const e=bodyExtents(s.pitch,s.roll,s.yaw+s.heading),bottom=Math.min(p.prevY-p.prevContact,s.y-contactHeight(s.pitch,s.roll)),top=Math.max(p.prevY+C.carCenterHeight+(p.prevHalfY??e.halfY),s.y+C.carCenterHeight+e.halfY),minX=Math.min((p.prevX??s.x)-(p.prevHalfX??e.halfX),s.x-e.halfX),maxX=Math.max((p.prevX??s.x)+(p.prevHalfX??e.halfX),s.x+e.halfX);
 if(!s.invulnerable)for(const b of courseBoxes(g,time))if(p.prevZ-(p.prevHalfZ??e.halfZ)<=b.z+b.depth/2&&s.z+e.halfZ>=b.z-b.depth/2&&minX<b.x+b.width/2&&maxX>b.x-b.width/2&&bottom<b.top&&top>b.bottom)return{reason:b.part==='roof'?'触到有限桥顶':b.part==='gate'?'升降闸门接触':b.part==='pillar'?'碰到桥架立柱':b.part==='truck'?'施工车辆碰撞':'路障碰撞',box:b.id};
 if(g.gap&&p.prevZ<g.gap.end&&s.z+e.halfZ>=g.gap.end&&s.z-e.halfZ<g.gap.end&&bottom<-.18&&!s.invulnerable)return{reason:'低于落地平台边缘'};
 return null;
}
