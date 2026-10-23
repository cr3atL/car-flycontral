import {ShaderMaterial} from '@babylonjs/core/Materials/shaderMaterial.js';
import {Vector3} from '@babylonjs/core/Maths/math.vector.js';

// Smooth atmospheric sky; the downloaded local HDR continues to illuminate and reflect.
// A small HDR contribution keeps its sky color without magnifying 64/128px IBL texels.
export function applySky(scene,mesh,environment){
 const vertexSource=`precision highp float;attribute vec3 position;uniform mat4 worldViewProjection;varying vec3 direction;void main(){direction=position;gl_Position=worldViewProjection*vec4(position,1.);}`;
 const fragmentSource=`precision highp float;varying vec3 direction;uniform samplerCube environmentSampler;uniform vec3 sunDirection;
 float hash(vec2 p){return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453);}
 float noise(vec2 p){vec2 i=floor(p),f=fract(p);f=f*f*(3.-2.*f);return mix(mix(hash(i),hash(i+vec2(1,0)),f.x),mix(hash(i+vec2(0,1)),hash(i+vec2(1)),f.x),f.y);}
 void main(){vec3 d=normalize(direction);float height=max(0.,d.y);vec3 color=mix(vec3(.48,.66,.78),vec3(.045,.25,.55),pow(height,.45));
 vec2 uv=d.xz/(.32+height);float cloud=noise(uv*1.4)*.6+noise(uv*3.3+7.)*.28+noise(uv*7.4)*.12;float wisps=smoothstep(.68,.86,cloud)*smoothstep(.02,.25,height)*.33;color=mix(color,vec3(.83,.86,.86),wisps);
 vec3 hdr=textureCube(environmentSampler,d).rgb;hdr=hdr/(vec3(1.)+hdr);color=mix(color,hdr*vec3(.65,.85,1.),.04);
 float sun=max(0.,dot(d,normalize(sunDirection)));color+=vec3(1.,.78,.46)*pow(sun,160.)*.14;color=mix(color,vec3(1.,.91,.70),smoothstep(.99965,.9999,sun));gl_FragColor=vec4(pow(color,vec3(1./2.2)),1.);}`;
 const material=new ShaderMaterial('firstspan-atmospheric-sky',scene,{vertexSource,fragmentSource},{attributes:['position'],uniforms:['worldViewProjection','sunDirection'],samplers:['environmentSampler']});material.backFaceCulling=false;material.disableDepthWrite=true;material.setTexture('environmentSampler',environment);material.setVector3('sunDirection',new Vector3(.48,.55,.68).normalize());mesh.material=material;mesh.applyFog=false;
}
