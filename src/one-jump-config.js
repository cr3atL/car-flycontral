export const ONE_JUMP=Object.freeze({
 launch:{start:55,end:85},fleetZ:120,
 trucks:[-10,-5,0,5,10].map((x,i)=>({id:'work-truck-'+i,x,z:120,color:i%2?'#a6a791':'#b67932'})),
 ring:{id:'work-pressure',x:0,y:11.5,z:139,radius:7.5,points:30},
 landing:{start:165,end:430,halfWidth:7}
});
export const constructionBoxes=ONE_JUMP.trucks.flatMap(t=>[
 {id:t.id+'-chassis',x:t.x,z:t.z,width:3.6,depth:8.4,bottom:.15,top:1.05,part:'chassis',truck:t.id},
 {id:t.id+'-cab',x:t.x,z:t.z+2.55,width:3.5,depth:3.1,bottom:1.05,top:2.5,part:'cab',truck:t.id},
 {id:t.id+'-load',x:t.x,z:t.z-1.55,width:3.1,depth:4.6,bottom:1.05,top:1.95,part:'load',truck:t.id}
]);
export const fleetEnd=Math.max(...constructionBoxes.map(b=>b.z+b.depth/2));
