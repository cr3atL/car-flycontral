import {ONE_JUMP,constructionBoxes} from './one-jump-config.js';
export const SPRINT=Object.freeze({
 end:1350,gap:{start:560,end:650},ring:{id:'sprint-high-pressure',x:0,y:17.5,z:625,radius:5,points:30},
 motor:{delay:.18,stable:.12,duration:1.2,unload:.25,acceleration:8,target:1.10,fovDelay:.53},
 sections:[
  {id:1,name:'施工车阵',start:0,launch:{start:115,end:140},pad:{start:220,end:285,halfWidth:7},obstacleEnd:174.2,retryZ:0,hold:.55},
  {id:2,name:'断桥补气',start:400,launch:{start:530,end:555},pad:{start:660,end:760,halfWidth:8},obstacleEnd:650,retryZ:400,hold:.8},
  {id:3,name:'桥下收势',start:850,launch:{start:970,end:990},pad:{start:1075,end:1210,halfWidth:7},obstacleEnd:1016.25,retryZ:850,hold:.55}
 ],
 trucks:ONE_JUMP.trucks.map(t=>({...t,z:t.z+50})),
 boxes:[...constructionBoxes.map(b=>({...b,z:b.z+50})),
 {id:'sprint-rail',x:0,z:1015,width:26,depth:2.5,bottom:0,top:1.05,part:'rail'},
 {id:'sprint-roof',x:0,z:1095,width:18,depth:40,bottom:9,top:9.8,part:'roof'},
 ...[-8.5,8.5].flatMap(x=>[1075,1115].map(z=>({id:`sprint-pillar-${x}-${z}`,x,z,width:1,depth:1,bottom:0,top:9,part:'pillar'})))],
});
