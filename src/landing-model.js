import{CONFIG as C}from'./config.js';
const clamp=v=>Math.max(-1,Math.min(1,v)),eps=1e-8;
export const LANDING_LABELS=['精准落地','稳定落地','重落地','撞毁'];
export function landingGrade(angle,speed,roof=false){if(roof)return 3;for(let i=0;i<3;i++)if(angle<=C.landingAngles[i]+eps&&speed<=C.landingSpeeds[i]+eps)return i;return 3;}
/** The same contact-sample rule serves actual settlement and read-only forecasts. */
export function assessLanding({pitch=0,roll=0,yaw=0,omega={},impact=0,safe=true}){
 const upY=Math.cos(pitch)*Math.cos(roll),angle=Math.acos(clamp(upY))*180/Math.PI,forwardX=Math.sin(yaw)*Math.cos(pitch),forwardZ=Math.cos(yaw)*Math.cos(pitch),headingError=Math.acos(clamp(forwardZ/Math.max(.00001,Math.hypot(forwardX,forwardZ))))*180/Math.PI;
 const pose=upY>0&&angle<=C.landingAngles[0]+eps,direction=headingError<=C.landingHeadingAngles[0]+eps,settled=['pitch','roll','yaw'].every(n=>Math.abs(omega[n]??0)<=C.precisionAngularRates[n]+eps),descent=impact<=C.landingSpeeds[0]+eps;
 const headingGrade=C.landingHeadingAngles.findIndex((limit,i)=>headingError<=limit+eps&&Math.abs(omega.yaw??0)<=C.landingYawRates[i]+eps);
 let grade=Math.max(landingGrade(angle,impact,upY<=0),headingGrade<0?3:headingGrade);if(grade===0&&!settled)grade=1;if(!safe)grade=3;
 const reason=!safe?'无安全地面':!pose?'倾斜过大':!direction?'方向未对齐':!settled?'仍在旋转':!descent?'下降过快':null;
 return{grade,label:LANDING_LABELS[grade],angle,headingError,impact,omega:{pitch:omega.pitch??0,roll:omega.roll??0,yaw:omega.yaw??0},checks:{pose,direction,settled,descent,safe},reason,tone:!safe||grade===3?'danger':grade===0?'precise':'adjust'};
}
