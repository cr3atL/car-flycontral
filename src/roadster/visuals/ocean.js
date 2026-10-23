import {ShaderMaterial} from '@babylonjs/core/Materials/shaderMaterial.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';

const vertexSource=`precision highp float;
attribute vec3 position;
uniform mat4 world,worldViewProjection;
varying vec3 worldPos;
void main(){worldPos=(world*vec4(position,1.)).xyz;gl_Position=worldViewProjection*vec4(position,1.);}`;
const fragmentSource=`precision highp float;
varying vec3 worldPos;
uniform float time;
uniform vec3 eye,sunDirection;
uniform samplerCube environmentSampler;
uniform vec4 contacts[16];
float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
vec3 aces(vec3 c){return clamp((c*(2.51*c+.03))/(c*(2.43*c+.59)+.14),0.,1.);}
void main(){
 vec2 p=worldPos.xz;vec2 slope=vec2(0.);
 for(int i=0;i<7;i++){float k=float(i);vec2 d=normalize(vec2(cos(k*2.17+.3),sin(k*2.17+.3)));float f=.65+k*.52;slope+=d*cos(dot(p,d)*f+time*(.8+k*.19))*(.022+.006*k);}
 slope+=vec2(noise(p*3.+time*.11)-.5,noise(p.yx*3.4-time*.13)-.5)*.09;
 vec3 N=normalize(vec3(-slope.x,1.,-slope.y)),V=normalize(eye-worldPos),L=normalize(sunDirection),H=normalize(V+L);
 float shore=73.+6.*sin(p.y*.061)+3.2*sin(p.y*.173)+2.4*sin(p.y*.37+.5),distanceToShore=max(0.,shore-p.x);
 float shallow=exp(-distanceToShore*.065);
 vec3 water=mix(vec3(.005,.045,.115),vec3(.012,.18,.20),shallow);
 float fresnel=.025+.975*pow(1.-max(dot(N,V),0.),5.);
 vec3 R=reflect(-V,N);vec3 sky=textureCube(environmentSampler,R).rgb;
 sky=sky/(1.+dot(sky,vec3(.2126,.7152,.0722))*.4)*vec3(.18,.40,.62);
 vec3 color=mix(water*(.7+.3*max(dot(N,L),0.)),sky*.18,clamp(fresnel,0.,.72));
 float spec=pow(max(dot(N,H),0.),360.)*smoothstep(.62,.85,noise(p*3.7-time*.32));color+=vec3(1.,.86,.62)*spec*.70;
 float band=smoothstep(60.,75.,p.y)*(1.-smoothstep(320.,335.,p.y));
 float foam=exp(-pow((distanceToShore-1.-.35*sin(time*.7+p.y*.3))/.8,2.))*band;
 float shade=1.;
 for(int i=0;i<16;i++){
  vec4 a=contacts[i];if(a.z<.01)continue;vec2 delta=p-a.xy;float d=length(delta);
  float edge=abs(d-a.z-.22*sin(time*.8+atan(delta.y,delta.x)*3.));foam=max(foam,exp(-edge*edge*3.)*(.4+.6*noise(p*1.6-time*.17)));
  vec2 ray=normalize(-L.xz);float along=dot(delta,ray),across=abs(dot(delta,vec2(-ray.y,ray.x)));float reach=a.w*length(L.xz)/max(.1,L.y);
  shade*=1.-.32*smoothstep(0.,.4,along)*(1.-smoothstep(reach-.8,reach,along))*(1.-smoothstep(a.z,a.z+.6,across));
 }
 // Actual bridge plan projected along the same sunlight; no random white-water streaks.
 vec2 deck=p+L.xz/max(.1,L.y)*8.;float deckMask=(1.-step(6.,abs(deck.x)))*(1.-step(110.,deck.y));deckMask=max(deckMask,(1.-step(9.,abs(deck.x)))*step(134.,deck.y)*(1.-step(204.,deck.y)));
 color*=shade*(1.-deckMask*.24);foam*=.5+.5*noise(p*2.+time*.1);color=mix(color,vec3(.48,.61,.60),clamp(foam*.76,0.,.8));
 float fog=1.-exp(-length(eye-worldPos)*.00065);color=mix(color,vec3(.38,.53,.65),fog);
 gl_FragColor=vec4(pow(aces(color),vec3(1./2.2)),1.);
}`;

export function createOcean(scene,mesh,environment,sunDirection,anchors=[]){
 const mat=new ShaderMaterial('firstspan-dynamic-ocean',scene,{vertexSource,fragmentSource},{attributes:['position'],uniforms:['world','worldViewProjection','time','eye','sunDirection','contacts'],samplers:['environmentSampler']});
 mat.backFaceCulling=false;mat.setTexture('environmentSampler',environment);mat.setVector3('sunDirection',sunDirection);
 const contacts=new Float32Array(64);anchors.slice(0,16).forEach((a,i)=>contacts.set(a,i*4));mat.setArray4('contacts',Array.from(contacts));mesh.material=mat;mesh.isPickable=false;
 let time=0;
 return{update:dt=>{time+=dt;mat.setFloat('time',time);mat.setVector3('eye',scene.activeCamera?.position??Vector3.Zero());},snapshot:()=>({type:'animated multi-wave HDR reflection',time,contacts:anchors.length})};
}
