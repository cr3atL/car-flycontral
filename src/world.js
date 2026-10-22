import{courseBoxes}from'./challenge-course.js';
import{VehicleFeedback}from'./vehicle-feedback.js';
import {buildSprintArt} from './sprint-art.js';
import {SPRINT as P} from './sprint-config.js';
import { ShadowGenerator } from '@babylonjs/core/Lights/Shadows/shadowGenerator.js';
import '@babylonjs/core/Lights/Shadows/shadowGeneratorSceneComponent.js';
import { buildOneJumpArt } from './one-jump-art.js';
import { FlightEffects } from './flight-effects.js';
import { ReflectionProbe } from '@babylonjs/core/Probes/reflectionProbe.js';
import { Engine } from '@babylonjs/core/Engines/engine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { Color3, Color4 } from '@babylonjs/core/Maths/math.color.js';
import { Vector3, Quaternion, Matrix } from '@babylonjs/core/Maths/math.vector.js';
import { HemisphericLight } from '@babylonjs/core/Lights/hemisphericLight.js';
import { DirectionalLight } from '@babylonjs/core/Lights/directionalLight.js';
import { FreeCamera } from '@babylonjs/core/Cameras/freeCamera.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
import { ShaderMaterial } from '@babylonjs/core/Materials/shaderMaterial.js';
import { SceneInstrumentation } from '@babylonjs/core/Instrumentation/sceneInstrumentation.js';
import { DynamicTexture } from '@babylonjs/core/Materials/Textures/dynamicTexture.js';
import { CONFIG as C } from './config.js';
import { secondsToGround } from './simulation.js';
import { GROUPS } from './challenge-config.js';
import { buildGroup, gateBottom } from './challenge.js';
import { buildCarArt } from './car-art.js';
import { buildCityArt } from './city-art.js';
import { ART } from './art-config.js';
import { supplyFactory } from './supply-art.js';
import { nearbySupplies,SUPPLY } from './supply-config.js';

export function createWorld(canvas) {
  const engine = new Engine(canvas, true, { stencil: false, powerPreference: 'high-performance', preserveDrawingBuffer: false });
  const scene = new Scene(engine); scene.clearColor = new Color4(0.55, 0.65, 0.70, 1);
  scene.fogMode = Scene.FOGMODE_EXP2; scene.fogDensity = 0.0015; scene.fogColor = new Color3(0.62, 0.67, 0.68);
  const camera = new FreeCamera('chase', new Vector3(0, 5.1, -12.8), scene);
  camera.minZ = 0.2; camera.maxZ = 1700; camera.fov = 0.87; camera.inputs.clear();
  const hemi = new HemisphericLight('sky-light', new Vector3(0.1, 1, 0), scene); hemi.intensity = 0.58; hemi.groundColor = new Color3(0.27, 0.3, 0.36);
  const sunLight = new DirectionalLight('sunlight', new Vector3(.42, -.35, -.85), scene); sunLight.diffuse = new Color3(1, 0.76, 0.56); sunLight.intensity = 1.65;sunLight.position.set(-18,26,24);sunLight.shadowFrustumSize=65;sunLight.shadowMinZ=.1;sunLight.shadowMaxZ=120;
  const realShadow=new ShadowGenerator(1024,sunLight);realShadow.usePercentageCloserFiltering=true;realShadow.filteringQuality=ShadowGenerator.QUALITY_MEDIUM;realShadow.bias=.001;realShadow.normalBias=.025;realShadow.setDarkness(.24);
  const mat = (name, hex, emissive = 0) => {
    const m = new StandardMaterial(name, scene); m.diffuseColor = Color3.FromHexString(hex); m.specularColor = new Color3(0.12, 0.16, 0.19);
    if (emissive) m.emissiveColor = m.diffuseColor.scale(emissive); return m;
  };
  const asphalt = mat('blue-grey-asphalt', '#293b48'), concrete = mat('concrete', '#747f84'), stripe = mat('lane-paint', '#e5e1cc', 0.15);
  asphalt.specularColor.set(.035, .045, .05); concrete.specularColor.set(.035, .04, .045);
  // One tiny seeded texture, generated once. Rendering detail, never physical road geometry.
  const grain = new DynamicTexture('procedural-asphalt-grain', { width: 128, height: 128 }, scene, true); grain.anisotropicFilteringLevel = 2;
  const grainContext = grain.getContext(), pixels = grainContext.createImageData(128, 128); let noiseSeed = 71;
  for (let i = 0; i < pixels.data.length; i += 4) { noiseSeed = (noiseSeed * 1664525 + 1013904223) >>> 0; const c = 244 + (noiseSeed >>> 24) % 12; pixels.data[i] = pixels.data[i + 1] = pixels.data[i + 2] = c; pixels.data[i + 3] = 255; }
  grainContext.putImageData(pixels, 0, 0); grain.update(false); asphalt.diffuseTexture = grain;
  const steel = mat('steel', '#334856'), cyan = mat('landing-cyan', '#64dedb', 0.7), yellow = mat('warning-yellow', '#ffd36e', 0.25), black = mat('warning-black', '#26323b');
  const seaMat = mat('calm-sea', '#6e9baf', 0.2); seaMat.specularColor = new Color3(0.6, 0.6, 0.5); seaMat.specularPower = 64;
  const box = (name, w, h, d, x, y, z, material, parent) => {
    const m = MeshBuilder.CreateBox(name, { width: w, height: h, depth: d }, scene); m.position.set(x, y, z); m.material = material; if (parent) m.parent = parent; return m;
  };
  const mergeStatic = root => {
    const groups = new Map();
    for (const mesh of root.getChildMeshes()) { const list = groups.get(mesh.material) ?? []; list.push(mesh); groups.set(mesh.material, list); }
    for (const [material, meshes] of groups) {
      const merged = Mesh.MergeMeshes(meshes, true, true);
      if (merged) { merged.name = `${root.name}-${material.name}`; merged.parent = root; merged.isPickable = false; }
    }
  };
  const sky = MeshBuilder.CreateSphere('gradient-sky', { diameter: 2500, segments: 16, sideOrientation: Mesh.BACKSIDE }, scene);
  const skyMat = new ShaderMaterial('sunset-gradient', scene, {
    vertexSource: 'precision highp float; attribute vec3 position; uniform mat4 worldViewProjection; varying vec3 p; void main(){p=position; gl_Position=worldViewProjection*vec4(position,1.0);}',
    fragmentSource: 'precision highp float; varying vec3 p; void main(){float h=normalize(p).y; vec3 c=mix(vec3(.96,.72,.52),vec3(.36,.55,.68),smoothstep(-.08,.65,h)); gl_FragColor=vec4(c,1.);}',
  }, { attributes: ['position'], uniforms: ['worldViewProjection'] });
  sky.material = skyMat; sky.applyFog = false; sky.isPickable = false; sky.infiniteDistance = true;
  const sun = MeshBuilder.CreateSphere('sun-disc', { diameter: 44, segments: 24 }, scene); sun.position.set(-260, 110, 1000); sun.material = mat('warm-sun', '#ffe4ac', 1); sun.applyFog = false;
  box('sea', 2400, 1, 2400, 0, -17, 500, seaMat);
  const cityArt = buildCityArt(scene, mat, { asphalt, concrete, stripe, steel });
  // Both asphalt AND concrete/paint are removed from the same physical gaps.
  // Four bounded batches; rebuild only when a committed gap changes.
  const floorRoot = new TransformNode('driving-surface', scene); let floorKey = '', floorLayout = { gaps: [], solids: [] };
  const unitBox = VertexData.CreateBox({ size: 1 });
  const batchBoxes = (name, boxes, material, parent) => {
    const positions = [], normals = [], indices = [], uvs = [];
    for (const [w, h, d, x, y, z] of boxes) {
      const base = positions.length / 3;
      for (let i = 0; i < unitBox.positions.length; i += 3) { const px = unitBox.positions[i] * w + x, pz = unitBox.positions[i + 2] * d + z; positions.push(px, unitBox.positions[i + 1] * h + y, pz); uvs.push(px / 3, pz / 3); }
      normals.push(...unitBox.normals); for (const i of unitBox.indices) indices.push(base + i);
    }
    if (!boxes.length) return;
    const m = new Mesh(name, scene), data = new VertexData(); data.positions = positions; data.normals = normals; data.uvs = uvs; data.indices = indices; data.applyToMesh(m); m.material = material; m.parent = parent; m.isPickable = false; m.receiveShadows=true;
  };
  const refreshFloor = (mode, groups) => {
    const gaps = mode==='sprint'?[P.gap]:mode === 'challenge' ? groups.filter(g => g.gap && Number.isFinite(g.z)).map(g => g.gap).sort((a, b) => a.start - b.start) : [];
    const key = `${mode}:${gaps.map(g => `${g.start},${g.end}`).join(';')}`; if (key === floorKey) return; floorKey = key;
    floorRoot.getChildMeshes().forEach(m => m.dispose());
    const start = mode === 'challenge' ? -200 : -600, end = mode === 'challenge' ? 5300 : 2400;
    const solids = []; let cursor = start;
    for (const gap of gaps) { solids.push([cursor, gap.start]); cursor = gap.end; } solids.push([cursor, end]);
    floorLayout = { gaps: gaps.map(g => ({ ...g })), solids: solids.map(s => [...s]) };
    const deck = [], road = [], paint = [], joints = [];
    for (const [a, b] of solids) {
      const length = b - a; if (length <= 0) continue;
      deck.push([27, 1.2, length, 0, -.64, (a + b) / 2]); road.push([26, .08, length, 0, -.04, (a + b) / 2]);
      for (const x of [-12.2, 12.2]) paint.push([.12, .02, length, x, .015, (a + b) / 2]);
      for (let z = Math.ceil(a / 12) * 12 + 3; z + 2.4 < b; z += 12) for (const x of [-4.3, 4.3]) paint.push([.16, .025, 4.8, x, .02, z]);
      for (let z = Math.ceil(a / 30) * 30; z < b; z += 30) joints.push([26, .015, .14, 0, .01, z]);
    }
    batchBoxes('floor-deck', deck, concrete, floorRoot); batchBoxes('floor-asphalt', road, asphalt, floorRoot); batchBoxes('floor-paint', paint, stripe, floorRoot); batchBoxes('floor-joints', joints, steel, floorRoot);
  };
  const makeSupply=supplyFactory(scene);
  const practiceSupplies=Array.from({length:6},(_,i)=>makeSupply(`practice-pressure-${i}`));
  const workOrange=mat('flow-truck-orange','#b97934'),workGrey=mat('flow-load-grey','#9d9f87'),workGlass=mat('flow-truck-window','#244451');
  const challengeVisuals = GROUPS.map(def => {
    const g = buildGroup(def, 0, 0), root = new TransformNode(`challenge-${g.id}`, scene);
    for(const b of courseBoxes(g,0)){
      if(g.ceiling?.moving&&b.id==='roof')continue;
      const solid=box('course-solid-'+b.id,b.width,b.top-b.bottom,b.depth,b.x,(b.top+b.bottom)/2,b.z,b.part==='truck'?workOrange:b.part==='pillar'?steel:b.part==='roof'?concrete:yellow,root);solid.metadata={collider:{...b}};
      if(b.part==='truck'){
        box('truck-load',b.width*.82,.25,b.depth*.48,b.x,b.top-.125,b.z-b.depth*.16,workGrey,root);
        box('truck-window',b.width*.78,.46,.025,b.x,b.top-.45,b.z-b.depth/2-.015,workGlass,root);
        for(const side of[-1,1])for(const dz of[-b.depth*.3,b.depth*.3]){const wheel=MeshBuilder.CreateCylinder('flow-truck-wheel',{diameter:.8,height:.24,tessellation:10},scene);wheel.rotation.z=Math.PI/2;wheel.position.set(b.x+side*(b.width/2-.05),.42,b.z+dz);wheel.material=black;wheel.parent=root;}
      }else if(b.part==='barrier')for(let x=b.x-b.width/2+.5;x<b.x+b.width/2;x+=1.2){const band=box('hazard-stripe',.42,(b.top-b.bottom)*.8,.035,x,(b.top+b.bottom)/2,b.z-b.depth/2-.02,black,root);band.rotation.z=-.28;}
    }
    for (const offset of [10, 0, -10]) for (const x of [-1, 1]) { const arrow = box('launch-chevron', 2, .025, .3, x, .035, -def.launch - offset, yellow, root); arrow.rotation.y = x * .5; }
    if (g.gap) for (const edge of [g.gap.start, g.gap.end]) { box('gap-warning-edge', 27, .1, .6, 0, -.02, edge, yellow, root); for (const x of [-12.8, 12.8]) box('gap-beacon', .18, 2.5, .3, x, 1.25, edge, cyan, root); }
    for (const x of [g.pad.x-g.pad.halfWidth,g.pad.x+g.pad.halfWidth]) box('precision-pad-guide', .1, .025, g.pad.end - g.pad.start, x, .035, (g.pad.start + g.pad.end) / 2, cyan, root);
    mergeStatic(root);for(const m of root.getChildMeshes())realShadow.addShadowCaster(m,false);
    let gate;
    if (g.ceiling?.moving) gate = box('moving-gate',g.ceiling.width??27.2,1,g.ceiling.end-g.ceiling.start, 0, 6.5, g.ceiling.start + 1, yellow, root);
    const rings = g.rings.map(r => { const m = MeshBuilder.CreateTorus('optional-reward-ring', { diameter: r.radius * 2, thickness: .12, tessellation: 32 }, scene); m.rotation.x = Math.PI / 2; m.position.set(r.x, r.y, r.z); m.parent = root; m.material = cyan; return m; });
    const supplies=(g.supplies??[]).map(r=>{const v=makeSupply(`challenge-pressure-${g.id}`,root);v.position.set(r.x,r.y,r.z);v.scaling.setAll(r.radius/SUPPLY.radius);return v;});
    root.setEnabled(false); return { id: g.id, root, gate, rings, supplies };
  });
  const obstacles = [];
  for (let lap = 0; lap < 2; lap++) for (const offset of C.wallOffsets) {
    const root = new TransformNode('low-wall', scene);
    box('solid-warning-wall', C.wallHalfWidth * 2, C.wallHeight, C.wallDepth, 0, C.wallHeight / 2, 0, yellow, root);
    for (let x = -6.5; x <= 6.5; x += 1.1) {
      const band = box('black-hazard-stripe', 0.38, 1.03, 0.03, x, 0.59, -0.766, black, root); band.rotation.z = -0.28;
    }
    for (const x of [-7.3, 7.3]) { box('wall-lamp-base', 0.28, 1.8, 0.28, x, 0.9, 0, steel, root); box('amber-marker', 0.22, 0.25, 0.22, x, 1.9, 0, yellow, root); }
    for (const delta of [-56, -44, -32]) {
      // Clearly marked launch approach; not collision geometry.
      const arrow = box('launch-mark', 2.2, 0.025, 0.35, 0, 0.035, delta, yellow, root); arrow.rotation.y = 0.5;
      const other = box('launch-mark', 2.2, 0.025, 0.35, -1.9, 0.035, delta, yellow, root); other.rotation.y = -0.5;
    }
    for (const x of [-9, 9]) box('landing-pad-outline', 0.12, 0.025, 65, x, 0.03, 55, cyan, root);
    mergeStatic(root);
    obstacles.push({ root, offset: lap * C.trackPeriod + offset });
  }
  const jumpArt=buildOneJumpArt(scene,{box,mat,mergeStatic,steel,black,cyan,yellow,makeSupply});for(const mesh of jumpArt.casters)realShadow.addShadowCaster(mesh,false);
  const sprintArt=buildSprintArt(scene,{box,mat,mergeStatic,steel,black,cyan,yellow,makeSupply});for(const mesh of sprintArt.casters)realShadow.addShadowCaster(mesh,false);
  const car = new TransformNode('car-position', scene), body = new TransformNode('car-attitude', scene); body.parent = car;
  const carArt = buildCarArt(scene, body, mat, steel, black);
  const { fins, wing } = carArt;const flightEffects=new FlightEffects(scene);for(const mesh of body.getChildMeshes()){realShadow.addShadowCaster(mesh,false);mesh.receiveShadows=true;} const coldJets = [];const vehicleFeedback=new VehicleFeedback(scene,{carArt,body,dustMaterial:flightEffects.dustMaterial,speedCanvas:document.getElementById('speed-canvas')});
  const paintReflection=new ReflectionProbe('local-sunset-reflection',128,scene);paintReflection.position.set(0,2,0);paintReflection.renderList=[sky,sun,...cityArt.reflectionMeshes];paintReflection.refreshRate=0;paintReflection.cubeTexture.level=.26;carArt.paint.reflectionTexture=paintReflection.cubeTexture;carArt.glass.reflectionTexture=paintReflection.cubeTexture;
  const portMetal = mat('nozzle-gunmetal', '#354958'); portMetal.specularColor.set(.22, .27, .3);
  const mist = mat('cold-gas-mist', '#e5f8fb', 0.3); mist.alpha = 0.18; mist.backFaceCulling = false;
  const coreMat=mat('cold-cyan-core','#a9fff3',.65);coreMat.alpha=.42;coreMat.backFaceCulling=false;
  const addColdJet = (name, anchor, exhaust, channel, sign = 0, localDirection = false) => {
    const port = MeshBuilder.CreateCylinder(`${name}-port`, { diameter: 0.19, height: 0.12, tessellation: 8 }, scene); port.material = portMetal; port.rotationQuaternion = new Quaternion();
    const plume = MeshBuilder.CreateCylinder(`${name}-mist`, { diameterTop: 0.13, diameterBottom: 0.5, height: 1, tessellation: 10 }, scene); plume.material = mist; plume.rotationQuaternion = new Quaternion(); plume.isPickable = false;
    const core=MeshBuilder.CreateCylinder(name+'-cyan-core',{diameterTop:.055,diameterBottom:.16,height:1,tessellation:8},scene);core.material=coreMat;core.rotationQuaternion=new Quaternion();core.isPickable=false;
    coldJets.push({ core,strength:0,worldExhaust:new Vector3(),anchor: new Vector3(...anchor), exhaust: new Vector3(...exhaust), port, plume, channel, sign, localDirection });
  };
  for (const side of [-1, 1]) {
    addColdJet('forward', [side * 0.63, -0.27, -2.12], [0, 0, -1], 'forward');
    for (const z of [-1.25, 1.25]) addColdJet('lift-vector', [side * 0.82, -0.3, z], [0, -1, 0], 'up');
    addColdJet('lateral', [side * 1.1, -0.08, 0], [side, 0, 0], 'lateral', -side);
    for (const sign of [-1, 1]) addColdJet('roll-trim', [side * 0.96, 0.05, -0.3], [0, -side * sign, 0], 'roll', sign, true);
  }
  for (const z of [-1.65, 1.65]) for (const sign of [-1, 1]) addColdJet('pitch-trim', [0, -0.16, z], [0, Math.sign(z) * sign, 0], 'pitch', sign, true);
  for(const z of [-1.6,1.6])for(const sign of [-1,1])addColdJet('yaw-trim',[0,-.1,z],[-Math.sign(z)*sign,0,0],'yaw',sign,true);
  for (const x of [-0.46, 0.46]) {
    const fan = MeshBuilder.CreateCylinder('electric-suction-fan', { diameter: 0.6, height: 0.06, tessellation: 12 }, scene); fan.parent = body; fan.position.set(x, -0.51, 0.2); fan.material = black;
  }
  const shadow = MeshBuilder.CreateDisc('contact-shadow', { radius: 1, tessellation: 24 }, scene); shadow.rotation.x = Math.PI / 2; shadow.scaling.set(1.35, 2.4, 1); const sm = mat('shadow', '#182b32'); sm.alpha = 0.25; shadow.material = sm;
  const marker = MeshBuilder.CreateTorus('predicted-landing-ring', { diameter: 3.3, thickness: 0.07, tessellation: 40 }, scene); marker.material = cyan;
  const unsafeMarker=new TransformNode('unsafe-release-landing',scene),unsafeMat=mat('unsafe-landing-red','#ff6874',1);
  for(let i=0;i<8;i++){const path=Array.from({length:9},(_,j)=>{const a=i*Math.PI/4+.10+j/8*.52;return new Vector3(Math.cos(a)*1.65,0,Math.sin(a)*1.65);}),part=MeshBuilder.CreateTube('broken-unsafe-landing-'+i,{path,radius:.055,tessellation:5},scene);part.parent=unsafeMarker;part.material=unsafeMat;part.isPickable=false;}unsafeMarker.setEnabled(false);
  let visualBank = 0, visualAir = 0;
  const attitudeQ = new Quaternion(), anchorWorld = new Vector3(), directionWorld = new Vector3(), up = Vector3.Up();
  const lookTarget = new Vector3(0, 1.4, 13), impactTarget = new Vector3(), projectionSource = new Vector3(), projectionResult = new Vector3();
  let inspection = null, currentQuality = 'rich', reducedMotion = false;
  const inspectionTarget = new Vector3(0, .8, 0);
  let cameraImpact = 0,lastAppliedImpact=0, currentZ = 0, currentX=0,currentY=0,lastCarHeight=0,cameraLift=0,vehicleFov=0,feedbackScore=null,feedbackMode=null,forecast=null, projectionViewport, projectionWidth = 0, projectionHeight = 0; const projected = { x: 0, y: 0, visible: false };
  const update = (s, dt, session) => {
    currentZ = s.z; currentX=s.x;currentY=s.y;forecast=s.releasePrediction??s.prediction;
    const mode = session?.mode ?? 'practice', levelGroups = session?.groups ?? [],oneJump=mode==='practice'&&!!session?.oneJump;
    const feedbackActive=session?.phase==='running'&&!(mode==='sprint'&&session?.sprint?.complete);mist.alpha=.30;coreMat.alpha=.75;jumpArt.update(s.z,session?.oneJump?.state,oneJump);sprintArt.update(s.z,session?.sprint,mode==='sprint');
    refreshFloor(mode, levelGroups); floorRoot.position.z = mode === 'practice' ? -(s.z%600) : -s.z;
    for (const v of challengeVisuals) {
      const g = levelGroups.find(g => g.id === v.id && Number.isFinite(g.z));
      v.root.setEnabled(mode === 'challenge' && !!g && ['preview','active','passed','failed'].includes(g.status) && g.z - s.z > -180 && g.z - s.z < 1300);
      if (!g) continue; v.root.position.z = g.z - s.z;
      if (v.gate) { const bottom = gateBottom(g, session.elapsed); v.gate.scaling.y = 12 - bottom; v.gate.position.y = (12 + bottom) / 2; }
      v.rings.forEach((m, i) => m.setEnabled(!g.rings[i].collected));
      v.supplies.forEach((m,i)=>m.setEnabled(!g.supplies[i].collected));
    }
    const nearby=nearbySupplies(s.z);practiceSupplies.forEach((v,i)=>{const r=nearby[i];v.setEnabled(mode==='practice'&&!oneJump&&!s.claimedSupplies.has(r.id)&&r.z-s.z>-20&&r.z-s.z<900);v.position.set(r.x,r.y,r.z-s.z);});
    cityArt.update(s.z);
    const cycle = Math.floor((s.z - 100) / (C.trackPeriod * 2));
    obstacles.forEach(({ root, offset }) => {
      let z = cycle * C.trackPeriod * 2 + offset - s.z;
      if (z < -100) z += C.trackPeriod * 2;
      root.position.z = z; root.setEnabled(mode === 'practice' && !oneJump && z < 1300);
    });
    car.position.set(s.x, s.y + C.carCenterHeight, 0);
    const visualResponse = 1 - Math.exp(-dt * 7);
    visualBank += ((s.grounded ? -s.heading * 0.25 : s.attitude.roll.active ? 0 : -s.forces.lateral * .012) - visualBank) * visualResponse;
    visualAir += ((s.grounded ? 0 : 1) - visualAir) * visualResponse;
    body.rotation.set(s.pitch, s.heading + s.yaw, s.roll + visualBank);
    Quaternion.FromEulerAnglesToRef(body.rotation.x, body.rotation.y, body.rotation.z, attitudeQ);carArt.update(s);
    coldJets.forEach((j, i) => {
      const value = s.forces[j.channel] || 0;
      const strength = j.sign && Math.sign(value) !== j.sign ? 0 : Math.abs(value) / (j.channel === 'up' ? 32 : j.channel === 'forward' ? 2.4 : j.channel === 'lateral' ? 6 : 26);
      j.anchor.rotateByQuaternionToRef(attitudeQ, anchorWorld); anchorWorld.addInPlace(car.position);
      if (j.localDirection) j.exhaust.rotateByQuaternionToRef(attitudeQ, directionWorld); else directionWorld.copyFrom(j.exhaust);
      Quaternion.FromUnitVectorsToRef(up, directionWorld, j.port.rotationQuaternion); j.port.position.copyFrom(anchorWorld);
      j.strength=strength;j.worldExhaust.copyFrom(directionWorld);
      j.plume.setEnabled(feedbackActive && strength > 0.025 && !s.crashTimer);
      const length = (0.22 + Math.min(1.5, strength) * 0.95) * (1 + Math.sin(s.time * 29 + i) * 0.08)*1.85;
      j.plume.scaling.set(0.65 + Math.min(1, strength) * 0.4, length, 0.65 + Math.min(1, strength) * 0.4);
      j.plume.position.copyFrom(anchorWorld).addInPlace(directionWorld.scale(length * 0.5 + 0.08));
      Quaternion.FromUnitVectorsToRef(up, directionWorld.negate(), j.plume.rotationQuaternion);
      j.core.setEnabled(feedbackActive&&strength>.04&&!s.crashTimer);j.core.position.copyFrom(j.plume.position);j.core.rotationQuaternion.copyFrom(j.plume.rotationQuaternion);j.core.scaling.set(1.1,length*.58,1.1);j.core.visibility=Math.min(1,strength);
    });
    fins.forEach((fin, i) => { fin.rotation.z = visualAir * 0.35 * (i === 0 ? -1 : 1); });
    wing.rotation.x = 0.12 + s.speed / C.cruise * 0.12 + (s.heavyTimer > 0 ? 0.3 : 0);
    shadow.position.set(s.x, 0.045, 0); sm.alpha = Math.max(0.06, 0.24 - s.y * 0.012);
    shadow.setEnabled(false);if(feedbackActive&&!s.crashTimer)flightEffects.update(s,coldJets,attitudeQ,currentQuality,z=>s.hasGround(z),carArt.wheelContacts(s.z));else flightEffects.reset();vehicleFeedback.update(s,feedbackActive,reducedMotion,{mode,motor:session?.sprint?.motor});
    const landingVisible=!s.grounded&&!s.crashTimer&&session?.phase==='running',landingDanger=forecast?.assessment?.tone==='danger'||!forecast?.safe;marker.setEnabled(landingVisible&&!landingDanger);unsafeMarker.setEnabled(landingVisible&&landingDanger);marker.position.set(forecast.x,.08,forecast.z-s.z);unsafeMarker.position.copyFrom(marker.position);marker.material=forecast?.assessment?.grade===0?cyan:yellow;
    if (s.crashTimer) body.rotation.z += 0.6;
    camera.position.y-=lastAppliedImpact;cameraLift=mode==='sprint'&&!reducedMotion&&s.y<25?Math.max(s.y-1.4,Math.min(s.y+1.4,cameraLift+(s.y-cameraLift)*(1-Math.exp(-dt/.18)))):s.y;const climb=cameraLift-lastCarHeight;lastCarHeight=cameraLift;camera.position.y+=climb;lookTarget.y+=climb;
    const smoothing = 1 - Math.exp(-dt * 3.5);
    camera.position.x += (s.x * 0.84 - camera.position.x) * smoothing;
    camera.position.y += ((mode==='sprint'?4.4:5.1) + cameraLift - Math.min(1,s.forces.up/34)*.14 - camera.position.y) * smoothing;
    camera.position.z += ((mode==='sprint'?-13.4:-12.8) - visualAir * 1.2 - Math.min(1,s.speed/C.cruise)*.6 - camera.position.z) * smoothing;
    const fovTarget=!reducedMotion&&feedbackActive?Math.PI/60*vehicleFeedback.drive.cameraGain:0;if(!feedbackActive||s.crashTimer||!s.grounded||s.launchArmed||feedbackScore!==s.score||feedbackMode!==mode)vehicleFov=0;feedbackScore=s.score;feedbackMode=mode;vehicleFov+=(fovTarget-vehicleFov)*(1-Math.exp(-dt/(fovTarget>vehicleFov?.2:.35)));camera.fov += ((reducedMotion ? .87 : .83 + (mode==='sprint'?Math.min(1,s.speed/C.cruise):s.speed/C.cruise) * .09 + vehicleFov) - camera.fov) * smoothing;
    lookTarget.x += (s.x * 0.88 + s.vx * 0.22 - lookTarget.x) * smoothing;
    lookTarget.y += (1.35 + cameraLift - lookTarget.y) * smoothing;
    camera.position.y+=cameraImpact;lastAppliedImpact=cameraImpact;impactTarget.copyFrom(lookTarget); impactTarget.y += cameraImpact*.3; camera.setTarget(impactTarget);
    if (import.meta.env.DEV && inspection) { const p = inspection === 'front' ? [5.8, 3.1, 6.7] : inspection === 'rear' ? [5.6, 2.9, -6.6] : [7.2, 1.8, .4]; camera.position.set(...p); camera.fov = .64; camera.setTarget(inspectionTarget); }
    scene.updateTransformMatrix(true);
  };
  const instrumentation = new SceneInstrumentation(scene); instrumentation.captureFrameTime = true;
  const getNozzleState = () => coldJets.map(j => ({ channel: j.channel, sign: j.sign, active: j.plume.isEnabled(),strength:j.strength,core:j.core.isEnabled(), exhaust: j.exhaust.asArray(), position: j.port.position.asArray() }));
  const projectPoint = (x, y, absoluteZ) => {
    projectionSource.set(x, y, absoluteZ - currentZ);
    if (projectionWidth !== canvas.clientWidth || projectionHeight !== canvas.clientHeight) { projectionWidth = canvas.clientWidth; projectionHeight = canvas.clientHeight; projectionViewport = camera.viewport.toGlobal(projectionWidth, projectionHeight); }
    Vector3.ProjectToRef(projectionSource, Matrix.IdentityReadOnly, scene.getTransformMatrix(), projectionViewport, projectionResult);
    projected.x = projectionResult.x; projected.y = projectionResult.y; projected.visible = projectionResult.z >= 0 && projectionResult.z <= 1 && projected.x>=0 && projected.x<=projectionWidth && projected.y>=0 && projected.y<=projectionHeight; return projected;
  };
  let sizeWidth = 0, sizeHeight = 0, sizeDpr = 0, sizeQuality = '';
  const setQuality = (quality, reduced) => {
    reducedMotion = reduced;
    const w = canvas.clientWidth, h = canvas.clientHeight, dpr = window.devicePixelRatio || 1;
    if (w !== sizeWidth || h !== sizeHeight || dpr !== sizeDpr || quality !== sizeQuality) {
      sizeWidth = w; sizeHeight = h; sizeDpr = dpr; sizeQuality = quality;
      const density = Math.min(quality === 'rich' ? Math.min(dpr, ART.pixelDensity.rich) : ART.pixelDensity.low, Math.sqrt(ART.maxRenderPixels[quality] / Math.max(1, w * h)));
      engine.setHardwareScalingLevel(1 / density);
    }
    if (quality !== currentQuality) { currentQuality = quality; cityArt.setQuality(quality); carArt.setQuality(quality); }
  };
  const getArtState = () => { const active = scene.getActiveMeshes(); let activeVertices = 0; for (let i = 0; i < active.length; i++) activeVertices += active.data[i].getTotalVertices(); return { presentation:{landingMarker:{visible:marker.isEnabled()||unsafeMarker.isEnabled(),broken:unsafeMarker.isEnabled(),tone:forecast?.assessment?.tone??null,x:forecast?.x,z:forecast?.z},vehicleVisuals:vehicleFeedback.snapshot(),vehicleFov,sprintVisuals:vehicleFeedback.snapshot(),sprintFov:vehicleFov,reflectionProbes:scene.reflectionProbes.length,reflectionSize:128,realShadow:true,sprintVisible:sprintArt.root.isEnabled(),shadowCasters:realShadow.getShadowMap().renderList.length,effects:flightEffects.snapshot(),courseVisible:jumpArt.root.isEnabled()}, environment: cityArt.snapshot(), car: carArt.snapshot(), quality: currentQuality, reducedMotion, materials: scene.materials.length, textures: scene.textures.length, geometries: scene.geometries.length, vertices: scene.getTotalVertices(), activeVertices, activeTriangles: scene.getActiveIndices() / 3, activeMeshes: active.length, renderWidth: engine.getRenderWidth(), renderHeight: engine.getRenderHeight(), cssWidth: sizeWidth, cssHeight: sizeHeight, pixelDensity: 1 / engine.getHardwareScalingLevel(), projectedOrigin: { ...projectPoint(0, .78, currentZ) }, fov: camera.fov, inspection, vehicleScreen:{...projectPoint(currentX,currentY+C.carCenterHeight,currentZ)}, landingScreen:forecast?{...projectPoint(forecast.x,0,forecast.z)}:null }; };
  return { engine, scene, camera, update, setQuality,getVehicleFeedback:()=>vehicleFeedback.snapshot(),getSprintFeedback:()=>vehicleFeedback.snapshot(), getLandingScreen:()=>forecast?projectPoint(forecast.x,0,forecast.z):null, ...(import.meta.env.DEV ? { getArtState, inspectCar: view => { inspection = view; } } : {}), instrumentation, getNozzleState, projectPoint, setImpact: v => { cameraImpact = v; }, getFloorLayout: () => structuredClone(floorLayout) };
}
