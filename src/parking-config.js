export const PARKING=Object.freeze({
  launch:{start:68,end:94,hold:1},
  rack:{z:145,depth:8,y:14.6,slope:.12,angle:35*Math.PI/180,halfWidth:2,halfHeight:1.6,outerWidth:10,outerHeight:5.2,bypass:6.8,scrape:.32,baseWidth:11,baseTop:8},
  ring:{id:'parking-pressure',x:0,y:15,z:165,radius:9.8,points:30},
  plate:{start:216,end:314,halfWidth:11,coreStart:220,coreEnd:310,coreHalfWidth:10.5,heavyEnergy:80,wheelsDown:.45},
  cart:{x:-8,y:2.3,z:280,halfDepth:1.6,fireAt:.3,flight:.62,hitY:5.5},
  wall:{z:360,depth:2,halfWidth:13,top:16},
  bridge:{start:372,end:440,begin:1.1,locked:2},
  retryAt:330,exit:510,exitClearance:25,checkpoint:-40,localCheckpoint:160,localLaunch:{start:176,end:194,hold:.7},
});
