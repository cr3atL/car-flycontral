import { ROADSTER as C } from './config.js';
import { inside, topAt, footprint, footprintBounds, overlaps, surfaceAt, surfaceGroup, slopeVelocity, supported, contactPolygon, querySurfaces } from './geometry.js';

const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const mix=(a,b,k,dt)=>a+(b-a)*(1-Math.exp(-k*dt));
const angle=a=>Math.atan2(Math.sin(a),Math.cos(a));
const matches=(surface,name)=>surface?.id===name||surfaceGroup(surface)===name;

export class RoadsterSimulation {
  constructor(layout) { this.layout=layout;this.coastal=(layout.version??1)>=2;this.restart(); }
  restart() {
    this.events=[];
    this.visits=Object.fromEntries(['low','high','far',...this.layout.surfaces.map(surfaceGroup)].map(id=>[id,0]));
    const spawn=this.layout.spawn,face=surfaceAt(this.layout,spawn.x,spawn.z,(spawn.y??0)+.1);
    this.checkpoint={...spawn,surface:face?.id??spawn.surface??'start'};
    this.time=0;this.recover(false);this.complete=false;this.crashes=0;this.resets=0;
    this.landingCount=0;this.flight=0;this.groundContacts=[];this.lastGroundGroup=surfaceGroup(face);
    this.seen={drive:false,lift:false,steer:false,brake:false};
  }
  recover(record=true) {
    this.recoveryNotice=record?{reason:this.reason||'手动复位',time:this.time}:null;
    const p=this.checkpoint,face=this.layout.surfaces.find(s=>s.id===p.surface)??surfaceAt(this.layout,p.x,p.z,(p.y??Infinity)+.1);
    Object.assign(this,{
      x:p.x,y:p.y??topAt(face??{top:0},p.x,p.z),z:p.z,vx:0,vy:0,vz:0,
      heading:p.heading??0,reference:p.heading??0,steerAngle:0,pitch:0,roll:0,
      pressure:100,grounded:true,surfaceId:face?.id??p.surface,groundAge:0,refillAge:0,
      crashTimer:0,reason:'',reverse:false,previousThrottle:0,
      jets:{lift:0,forward:0,side:0,brake:0},forces:{lift:0,forward:0,side:0,brake:0,cost:0},
      input:{throttle:0,steer:0,lift:false},lastLanding:null,departureSurface:null,departureIds:[]
    });
    this.lastGroundGroup=surfaceGroup(face);
    if(record){this.resets++;this.emit('reset',{checkpoint:p.surface,group:surfaceGroup(face)});}
  }
  emit(type,data={}) {
    if(this.forecast)return;
    this.events.push({type,time:this.time,x:this.x,y:this.y,z:this.z,pressure:this.pressure,...data});
    if(this.events.length>500)this.events.shift();
  }
  crash(reason) {
    if(this.crashTimer)return;
    this.reason=reason;this.crashTimer=C.crashDelay;this.crashes++;
    this.jets={lift:0,forward:0,side:0,brake:0};this.forces={...this.jets,cost:0};
    this.input={throttle:0,steer:0,lift:false};this.emit('crash',{reason});
  }
  get speed() { return Math.hypot(this.vx,this.vz); }
  get surface() { return this.layout.surfaces.find(s=>s.id===this.surfaceId)??null; }
  get group() { return surfaceGroup(this.surface); }

  step(dt) {
    if(this.complete)return;
    if(!(dt>0&&dt<=.05))throw Error('Roadster step must be 0..50ms');
    this.time+=dt;
    if(this.crashTimer){this.crashTimer=Math.max(0,this.crashTimer-dt);if(!this.crashTimer)this.recover();return;}
    const prev={x:this.x,y:this.y,z:this.z,heading:this.heading},wasGround=this.grounded,oldSurface=this.surface;
    const t=clamp(this.input.throttle,-1,1),turn=clamp(this.input.steer,-1,1),lift=!!this.input.lift;
    this.seen.drive||=t>0;this.seen.lift||=lift;this.seen.steer||=!!turn;this.seen.brake||=t<0;
    const sideInput=this.coastal?turn*Math.pow(Math.abs(turn),.3):turn;
    const requests={lift:lift?C.lift:0,forward:!this.grounded&&t>0?C.forward*t:0,
      side:!this.grounded?C.side*sideInput:0,brake:!this.grounded&&t<0&&this.speed>.015?C.airBrake*-t:0};
    for(const k of Object.keys(this.jets)) {
      const response=this.coastal&&k==='lift'&&requests.lift>this.jets.lift?C.liftResponse:C.jetResponse;
      this.jets[k]=mix(this.jets[k],requests[k],response,dt);
      if(!requests[k]&&Math.abs(this.jets[k])<.002)this.jets[k]=0;
    }
    const requestedCost=this.jets.lift/C.lift*C.liftCost+this.jets.forward/C.forward*C.forwardCost+
      Math.abs(this.jets.side)/C.side*C.sideCost+this.jets.brake/C.airBrake*C.brakeCost;
    const ratio=requestedCost?Math.min(1,this.pressure/(requestedCost*dt)):0;
    this.forces={...Object.fromEntries(Object.entries(this.jets).map(([k,v])=>[k,v*ratio])),cost:requestedCost*ratio};
    this.pressure=Math.max(0,this.pressure-this.forces.cost*dt);

    if(this.grounded) {
      const dx=Math.sin(this.heading),dz=Math.cos(this.heading),rightX=dz,rightZ=-dx;
      let longitudinal=this.vx*dx+this.vz*dz,lateral=this.vx*rightX+this.vz*rightZ;
      if(t<-.05&&this.previousThrottle>=-.05)this.reverse=Math.abs(longitudinal)<.12;
      if(t>=-.05)this.reverse=false;
      if(t>0){if(longitudinal<-.05)longitudinal=Math.min(0,longitudinal+C.brake*t*dt);else longitudinal+=C.motor*t*Math.max(0,1-longitudinal/(this.coastal?C.coastalMotorMax:55))*dt;}
      else if(t<0){if(this.reverse)longitudinal-=C.reverseMotor*-t*Math.max(0,1+longitudinal/C.reverseMax)*dt;else longitudinal=Math.max(0,longitudinal-C.brake*-t*dt);}
      const drag=C.rolling+C.groundDrag*longitudinal*longitudinal;
      longitudinal=Math.sign(longitudinal)*Math.max(0,Math.abs(longitudinal)-drag*dt);lateral*=Math.exp(-C.lateralGrip*dt);
      const maxSteer=this.coastal?C.coastalSteerHigh+(C.steerLow-C.coastalSteerHigh)/(1+(Math.abs(longitudinal)/9)**2):
        C.steerHigh+(C.steerLow-C.steerHigh)/(1+(Math.abs(longitudinal)/12)**2);
      this.steerAngle=mix(this.steerAngle,turn*maxSteer,C.steerResponse,dt);
      this.heading=angle(this.heading+longitudinal/C.wheelbase*Math.tan(this.steerAngle)*dt);
      const c=Math.cos(this.heading),n=Math.sin(this.heading);this.vx=longitudinal*n+lateral*c;this.vz=longitudinal*c-lateral*n;this.reference=this.heading;
    } else {
      if(this.speed>C.referenceSpeed)this.reference=angle(this.reference+angle(Math.atan2(this.vx,this.vz)-this.reference)*(1-Math.exp(-2.5*dt)));
      const f=this.forces,h=this.speed,ax=Math.sin(this.reference)*f.forward+Math.cos(this.reference)*f.side,
        az=Math.cos(this.reference)*f.forward-Math.sin(this.reference)*f.side;
      const retained=h>.000001?Math.max(0,1-C.airDrag*dt-f.brake*dt/h):0;
      this.vx=this.vx*retained+ax*dt;this.vz=this.vz*retained+az*dt;
      // Passive aerodynamic drag only removes lateral energy; it is not free jet assistance.
      if(this.coastal&&Math.abs(turn)<.05){const rx=Math.cos(this.heading),rz=-Math.sin(this.heading),lateral=(this.vx*rx+this.vz*rz)*(1-Math.exp(-C.airSideDrag*dt));this.vx-=lateral*rx;this.vz-=lateral*rz;}
      this.heading=angle(this.heading+angle(this.reference-this.heading)*(1-Math.exp(-C.headingResponse*dt)));
    }
    this.previousThrottle=t;this.x+=this.vx*dt;this.z+=this.vz*dt;

    let groundSurface=null;
    if(this.grounded) {
      const face=surfaceAt(this.layout,this.x,this.z,this.y+.6),support=face&&supported(this.layout,this,face);
      if(!support||support.count<3||Math.abs(support.height-this.y)>.65||this.forces.lift>C.gravity+.3) {
        this.grounded=false;this.surfaceId=null;this.groundAge=0;this.flight++;
        this.emit('takeoff',{from:oldSurface?.id??null,group:surfaceGroup(oldSurface),vx:this.vx,vz:this.vz});
      }else{groundSurface=face;this.surfaceId=face.id;this.y=support.height;this.vy=slopeVelocity(face,this.vx,this.vz);}
    }
    if(!this.grounded){const ay=this.forces.lift-C.gravity;this.y+=this.vy*dt+ay*dt*dt/2;this.vy+=ay*dt;}
    const body=footprint(this),bounds=footprintBounds(this),bodyTop=this.y+C.height,candidates=querySurfaces(this.layout,bounds);
    if(wasGround&&!this.grounded) {
      this.departureIds=querySurfaces(this.layout,footprintBounds(prev)).filter(s=>contactPolygon(prev,s).length&&Math.abs(topAt(s,prev.x,prev.z)-prev.y)<.65).map(s=>s.id);
    }
    this.departureIds=(this.departureIds??[]).filter(id=>{
      const s=this.layout.surfaces.find(s=>s.id===id);if(!s||!contactPolygon(body,s).length)return false;
      const top=topAt(s,this.x,this.z);return this.y<=top+.1&&bodyTop>=top-s.depth-.05;
    });
    this.departureSurface=this.departureIds[0]??null;
    for(const obstacle of this.layout.colliders??[]) {
      if(overlaps(bounds,obstacle)&&bodyTop>obstacle.ymin&&this.y<obstacle.ymax&&contactPolygon(body,obstacle).length){this.crash(obstacle.reason??(this.coastal?'碰到护栏或路障':'碰到出口结构'));return;}
    }
    let landed=null;
    if(!this.grounded)for(const face of candidates) {
      const top=topAt(face,this.x,this.z),oldTop=topAt(face,prev.x,prev.z),relative=this.vy-slopeVelocity(face,this.vx,this.vz);
      if(relative<0&&prev.y>=oldTop-.035&&this.y<=top&&inside(face,this.x,this.z)&&(!landed||top>landed.top))landed={surface:face,top,impact:-relative};
    }
    if(landed&&supported(this.layout,this,landed.surface).count<3)landed=null;
    if(landed) {
      const face=landed.surface,support=supported(this.layout,this,face),impact=Math.max(0,landed.impact);
      if(impact>C.crashImpact){this.crash('下降冲击过大');return;}
      this.y=landed.top;this.vy=slopeVelocity(face,this.vx,this.vz);this.grounded=true;
      this.surfaceId=face.id;groundSurface=face;this.groundAge=0;this.refillAge=0;this.landingCount++;
      const group=surfaceGroup(face);this.visits[face.id]=(this.visits[face.id]??0)+1;
      if(group!==face.id)this.visits[group]=(this.visits[group]??0)+1;
      this.lastLanding={time:this.time,surface:face.id,group,impact,safe:support.safe,flight:this.flight};this.emit('landing',this.lastLanding);
    }else if(!this.grounded) {
      for(const face of candidates) {
        if(this.departureIds.includes(face.id))continue;
        const contact=contactPolygon(body,face);if(!contact.length)continue;
        const centreTop=topAt(face,this.x,this.z);
        const hits=contact.some(p=>{const bottom=topAt(face,p.x,p.z)-face.depth;
          const side=this.y<centreTop-.08&&bodyTop>bottom;
          const underside=this.vy>0&&this.y<bottom&&bodyTop>bottom;
          return (side||underside)&&prev.y+C.height>=bottom-.3;
        });
        if(hits){this.crash(this.vy>0?'碰到道路底面':'碰到道路侧面');return;}
      }
    }
    if(this.grounded) {
      this.groundAge+=dt;groundSurface??=this.surface;
      if(groundSurface)this.updateGround(groundSurface,prev,dt,lift);
    }else this.refillAge=0;
    const b=this.layout.bounds;
    if(this.x<b.xmin||this.x>b.xmax||this.z<b.zmin||this.z>b.zmax||this.y<b.ymin)this.crash('驶出试驾区');
    const grade=groundSurface?slopeVelocity(groundSurface,Math.sin(this.heading),Math.cos(this.heading)):0;
    this.pitch=mix(this.pitch,this.grounded?Math.atan(grade):clamp(-t*.12+this.vy*.004,-.2,.2),8,dt);
    this.roll=mix(this.roll,clamp(-turn*(this.grounded?this.speed*.007:.16),-.22,.22),7,dt);
  }

  updateGround(face,prev,dt,lift) {
    const group=surfaceGroup(face),support=supported(this.layout,this,face);
    if(!this.groundContacts.includes(group))this.groundContacts=[...this.groundContacts,group];
    if(this.lastGroundGroup!==group){this.emit('ground-stage',{surface:face.id,group,route:face.route});this.lastGroundGroup=group;}
    if(!lift&&this.forces.cost<.01&&['lift','forward','side','brake'].every(k=>Math.abs(this.forces[k])<.02)) {
      this.refillAge+=dt;
      if(this.refillAge>=C.refillDelay){const fast=this.layout.refillZones?.some(r=>(!r.surface||matches(face,r.surface))&&(!r.group||r.group===group)&&inside(r,this.x,this.z));this.pressure=Math.min(100,this.pressure+(fast?C.fastRecharge:C.recharge)*dt);}
    }else this.refillAge=0;
    if(!this.forecast&&support.safe&&this.groundAge>C.checkpointDelay) {
      if(this.coastal&&this.speed<34&&supported(this.layout,this,face,.35).safe) {
        const eligible=(this.layout.checkpoints??[]).filter(p=>{
          const target=this.layout.surfaces.find(s=>s.id===p.surface),targetGroup=p.group??surfaceGroup(target)??p.surface;
          return (matches(face,p.surface)||targetGroup===group)&&Math.hypot(this.x-p.x,this.z-p.z)<(p.activationRadius??30);
        }).sort((a,b)=>Math.hypot(this.x-a.x,this.z-a.z)-Math.hypot(this.x-b.x,this.z-b.z));
        const cp=eligible[0];
        if(cp){const at=surfaceAt(this.layout,cp.x,cp.z,(cp.y??this.y)+.5);if(at&&surfaceGroup(at)===group&&supported(this.layout,{...cp,heading:cp.heading??0},at,.25).safe)this.checkpoint={...cp,surface:at.id,y:topAt(at,cp.x,cp.z)};}
      } else if(!this.coastal&&this.speed<12&&inside(face,this.x,this.z,2.3)) {
        const cp=this.layout.checkpoints?.find(p=>p.surface===face.id);if(cp)this.checkpoint={...cp,y:topAt(face,cp.x,cp.z)};
      }
    }
    const exit=this.layout.exit;
    if(matches(face,exit.surface)&&(this.coastal||this.visits.far>0)&&prev.z<exit.z&&this.z>=exit.z&&this.x>=exit.xmin&&this.x<=exit.xmax) {
      this.complete=true;this.emit('complete',{visits:{...this.visits},route:face.route,groundContacts:[...this.groundContacts]});
    }
  }

  predict() {
    if(this.grounded||this.crashTimer)return null;
    const g=Object.assign(Object.create(RoadsterSimulation.prototype),this,{forecast:true,input:{...this.input},jets:{...this.jets},forces:{...this.forces},visits:{...this.visits},seen:{...this.seen},events:[],departureIds:[...this.departureIds],groundContacts:[...this.groundContacts]});
    const trace=[{x:g.x,y:g.y,z:g.z}],start=g.time;
    const result=extra=>({trace,x:g.x,y:g.y,z:g.z,time:g.time-start,heading:g.heading,...extra});
    for(let i=0;i<C.predictionSeconds/C.step;i++) {
      g.step(C.step);if(i%18===0)trace.push({x:g.x,y:g.y,z:g.z});
      if(g.crashTimer)return result({safe:false,reason:g.reason,surface:null,group:null});
      if(g.grounded){const face=g.surface,safe=!!face&&supported(g.layout,g,face).safe;return result({safe,reason:!safe?'落点靠近边缘':g.lastLanding.impact>C.dangerImpact?'预计下降冲击较大':'',impact:g.lastLanding.impact,surface:g.surfaceId,group:surfaceGroup(face),corners:footprint(g)});}
    }
    return result({safe:false,reason:'尚无安全落点',surface:null,group:null});
  }
  snapshot() {
    return {time:this.time,x:this.x,y:this.y,z:this.z,vx:this.vx,vy:this.vy,vz:this.vz,speed:this.speed,
      heading:this.heading,pitch:this.pitch,roll:this.roll,reference:this.reference,pressure:this.pressure,
      grounded:this.grounded,surface:this.surfaceId,group:this.group,route:this.surface?.route,
      input:{...this.input},jets:{...this.jets},forces:{...this.forces},reverse:this.reverse,
      checkpoint:{...this.checkpoint},visits:{...this.visits},groundContacts:[...this.groundContacts],
      complete:this.complete,crashTimer:this.crashTimer,reason:this.reason,recoveryNotice:this.recoveryNotice,
      landingCount:this.landingCount,lastLanding:this.lastLanding&&{...this.lastLanding},events:this.events.map(e=>({...e}))};
  }
}
