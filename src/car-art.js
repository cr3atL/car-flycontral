import { suspensionY } from './presentation-model.js';
import { Vector3 } from '@babylonjs/core/Maths/math.vector.js';
import { MeshBuilder } from '@babylonjs/core/Meshes/meshBuilder.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { ArtBatch } from './art-geometry.js';
import { ART } from './art-config.js';

export function buildCarArt(scene, body, mat, steel, black) {
  const paint = mat('crimson-pearl-paint', '#620d27'), glass = mat('smoked-blue-glass', '#142c3c');
  paint.specularColor.set(.58, .4, .43); paint.specularPower = 80; paint.emissiveColor.set(.025, .003, .008);
  glass.specularColor.set(.23, .34, .43); glass.specularPower = 112; glass.emissiveColor.set(.012, .027, .035);
  const rubber = mat('satin-rubber', '#111a20'), rim = mat('brushed-titanium', '#9aa8af'), inset = mat('carbon-insets', '#1a2931');
  rubber.specularColor.set(.08, .09, .1); rubber.specularPower = 14; rim.specularColor.set(.8, .85, .9); rim.specularPower = 72; rim.backFaceCulling = false;
  const tail = mat('ruby-led', '#ff3553', .85), white = mat('ice-led', '#d4f0e9', .8), sheen = mat('glass-sky-reflection', '#6b8e9d', .06);
  for (const m of [paint, glass, inset, sheen]) m.backFaceCulling = false;
  const shell = new ArtBatch(scene, body, 'car-shell');
  const section = (z, w, bottom, shoulder, top) => [[-w * .91, bottom, z], [w * .91, bottom, z], [w, shoulder - .14, z], [w * .98, shoulder, z], [w * .71, top, z], [0, top + .035, z], [-w * .71, top, z], [-w * .98, shoulder, z], [-w, shoulder - .14, z]];
  shell.loft(paint, [section(-2.08, .9, -.34, -.03, .03), section(-1.77, 1.04, -.4, .14, .19), section(-1.28, 1.11, -.4, .18, .26), section(-.65, 1.025, -.38, .13, .21), section(.1, 1.015, -.38, .11, .19), section(.85, 1.05, -.37, .13, .18), section(1.23, 1.09, -.37, .16, .18), section(1.78, .99, -.33, .02, .05), section(2.07, .87, -.29, -.07, -.04)]);
  // One continuous, tapered canopy, subdivided by a painted roof and A/C pillars.
  const canopy = (z, w, base, top) => [[-w, base, z], [w, base, z], [w * .81, top, z], [-w * .81, top, z]];
  shell.loft(glass, [canopy(-1.16, .72, .2, .25), canopy(-.56, .69, .22, .72), canopy(.08, .67, .22, .77), canopy(.45, .67, .2, .68), canopy(.98, .72, .17, .22)]);
  shell.quad(paint, [-.55, .725, -.56], [.55, .725, -.56], [.54, .785, .1], [-.54, .785, .1]);
  for (const side of [-1, 1]) {
    shell.beam(paint, [side * .55, .73, -.56], [side * .71, .25, -1.13], .055);
    shell.beam(paint, [side * .54, .78, .12], [side * .7, .23, .96], .045);
    shell.beam(paint, [side * .68, .225, -.97], [side * .7, .2, .9], .03);
    shell.beam(inset, [side * .66, .23, -.23], [side * .55, .74, -.2], .035);
    // Reflection slivers are geometry, not an alpha-sorted transparent windshield.
    shell.quad(sheen, [side * .58, .707, .29], [side * .5, .715, .29], [side * .66, .272, .9], [side * .7, .252, .9]);
    shell.beam(paint, [side * .7, .28, .43], [side * .97, .27, .53], .055);
    shell.loft(inset, [canopy(.45, .12, .25, .29).map(v => [v[0] + side * 1.0, v[1], v[2]]), canopy(.66, .13, .25, .3).map(v => [v[0] + side * 1.0, v[1], v[2]])]);
    // Wheel arch surfaces follow a real arc around the preserved wheel centres.
    for (const z of [-1.28, 1.18]) {
      for (let i = 0; i < 16; i++) {
        const a = i / 16 * Math.PI, b = (i + 1) / 16 * Math.PI;
        const p = (angle, x, radius) => [side * x, -.4 + Math.sin(angle) * radius, z + Math.cos(angle) * radius];
        shell.quad(paint, p(a, .86, .57), p(b, .86, .57), p(b, 1.12, .51), p(a, 1.12, .51));
        shell.quad(inset, p(a, 1.125, .51), p(b, 1.125, .51), p(b, 1.125, .465), p(a, 1.125, .465));
      }
    }
    shell.loft(inset, [[[side * .91, -.42, -.73], [side * 1.13, -.4, -.73], [side * 1.12, -.25, -.73], [side * 1.03, -.27, -.73]], [[side * .91, -.42, .62], [side * 1.12, -.41, .62], [side * 1.08, -.29, .62], [side * 1.01, -.28, .62]]]);
    // Shoulder sculpting catches the sunset and remains legible from the chase view.
    shell.beam(paint, [side * .82, .2, -1.65], [side * .93, .29, -1.08], .085);
    shell.beam(inset, [side * 1.021, -.04, -.65], [side * 1.019, -.1, .53], .04);
    shell.box(rim, .105, .018, .2, side * 1.025, .05, -.22);
    shell.loft(inset, [canopy(1.91, .3, -.2, -.13).map(v => [v[0] + side * .57, v[1], v[2]]), canopy(2.08, .23, -.2, -.14).map(v => [v[0] + side * .57, v[1], v[2]])]);
    shell.beam(white, [side * .37, .04, 1.99], [side * .87, .025, 1.91], .055);
    shell.beam(white, [side * .87, .025, 1.91], [side * .93, -.055, 1.76], .035);
    shell.beam(tail, [side * .18, .055, -2.09], [side * .88, .035, -2.04], .065);
    shell.beam(tail, [side * .88, .035, -2.04], [side * .98, -.07, -1.91], .045);
  }
  shell.box(inset, 1.72, .16, 3.45, 0, -.43, -.02);
  shell.loft(inset, [section(1.82, 1.02, -.38, -.29, -.28), section(2.1, .97, -.37, -.32, -.3)]);
  shell.loft(inset, [section(-2.1, .94, -.46, -.29, -.25), section(-1.72, .85, -.48, -.37, -.35)]);
  for (const x of [-.77, -.4, 0, .4, .77]) shell.quad(inset, [x, -.5, -2.1], [x, -.27, -2.1], [x, -.36, -1.68], [x, -.49, -1.68]);
  shell.box(inset, 1.43, .105, .035, 0, -.14, -2.102);
  shell.box(rim, .31, .045, .014, 0, -.13, -2.126);
  shell.box(tail, .22, .025, .02, 0, .065, -2.102);
  shell.build();

  const wheelRoots = [], wheelSpins = [], carDetails = new TransformNode('car-rich-detail', scene); carDetails.parent = body;
  for (const side of [-1, 1]) for (const z of [-1.28, 1.18]) {
    const steer = new TransformNode('wheel-steering', scene); steer.parent = body;
    const spin = new TransformNode('wheel-spin', scene); spin.parent = steer; wheelRoots.push({ node: steer, front: z > 0 }); wheelSpins.push(spin);
    const profile = [[.24, -.15], [.31, -.15], [.35, -.1], [.36, -.055], [.36, .055], [.35, .1], [.31, .15], [.24, .15]].map(([r, h]) => new Vector3(r, h, 0));
    const tyre = MeshBuilder.CreateLathe('rounded-tire', { shape: profile, tessellation: 24, closed: true, cap: Mesh.CAP_ALL }, scene); tyre.parent = spin; tyre.rotation.z = Math.PI / 2; tyre.material = rubber;
    const spokes = new ArtBatch(scene, spin, 'wheel-alloy');
    for (let i = 0; i < 5; i++) {
      const a = i * Math.PI * 2 / 5, outX = side * .157;
      const p = (r, angle) => [outX, Math.cos(angle) * r, Math.sin(angle) * r];
      spokes.quad(rim, p(.065, a - .15), p(.065, a + .17), p(.25, a + .1), p(.25, a - .04));
      spokes.quad(rim, p(.13, a + .04), p(.13, a + .13), p(.25, a + .45), p(.25, a + .35));
    }
    const hub = MeshBuilder.CreateCylinder('alloy-hub', { diameter: .14, height: .325, tessellation: 12 }, scene); hub.rotation.z = Math.PI / 2; hub.parent = spin; hub.material = rim;
    const rimRing = MeshBuilder.CreateTorus('alloy-ring', { diameter: .51, thickness: .035, tessellation: 24 }, scene); rimRing.rotation.z = Math.PI / 2; rimRing.position.x = side * .151; rimRing.parent = spin; rimRing.material = rim;
    const spokeMeshes = spokes.build();
    const merged = Mesh.MergeMeshes([hub, rimRing, ...spokeMeshes], true, true); if (merged) { merged.parent = spin; merged.material = rim; merged.isPickable = false; }
    const brake = MeshBuilder.CreateCylinder('brake-disc', { diameter: .43, height: .015, tessellation: 16 }, scene); brake.parent = steer; brake.rotation.z = Math.PI / 2; brake.position.x = side * .12; brake.material = inset;
    // Fine detail is local to each wheel so the detail switch does not stop rotation.
    const bolts = new TransformNode('rim-bolts', scene); bolts.parent = spin; const detail = new ArtBatch(scene, bolts, 'wheel-detail');
    for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; detail.box(inset, .012, .025, .025, side * .169, Math.cos(a) * .07, Math.sin(a) * .07); }
    detail.build();
    const caliper = new ArtBatch(scene, carDetails, 'brake-caliper'); caliper.box(paint, .065, .18, .1, side * 1.14, -.38, z + .17); caliper.build();
    wheelRoots.at(-1).detail = bolts;
    steer.position.set(side * 1.01, -.4, z);
  }
  const fins = [];
  for (const side of [-1, 1]) { const node = new TransformNode('active-side-fin', scene); node.parent = body; node.position.set(side * 1.04, -.25, -.55); const b = new ArtBatch(scene, node, 'active-fin'); b.loft(steel, [[[0, 0, -.4], [side * .3, .015, -.28], [side * .28, .05, -.24], [0, .04, -.4]], [[0, 0, .35], [side * .19, .015, .25], [side * .18, .05, .24], [0, .04, .35]]]); b.build(); fins.push(node); }
  const wing = new TransformNode('active-aero-wing', scene); wing.parent = body; wing.position.set(0, .31, -1.74);
  const aero = new ArtBatch(scene, wing, 'aero-wing'); aero.loft(inset, [[[-.97, 0, -.15], [.97, 0, -.15], [.97, .045, -.08], [-.97, .045, -.08]], [[-.91, -.015, .18], [.91, -.015, .18], [.91, .02, .18], [-.91, .02, .18]]]); aero.build();
  const struts = new ArtBatch(scene, body, 'aero-struts'); for (const x of [-.6, .6]) struts.box(inset, .035, .13, .055, x, .28, -1.74); struts.build();
  let lastTime = 0, lastZ = 0, wheelAngle = 0, spinRate = 0, low = false;
  let compression=0;return { paint,glass,white,tail,rim, fins, wing,
    wheelContacts(absoluteZ){return wheelRoots.map(w=>{w.node.computeWorldMatrix(true);const p=w.node.getAbsolutePosition();return{x:p.x,y:p.y-ART.wheelRadius,z:p.z+absoluteZ};});},
    setQuality(quality) { const next = quality === 'low'; if (low === next) return; low = next; carDetails.setEnabled(!low); for (const w of wheelRoots) w.detail.setEnabled(!low); },
    update(s) {
      const dt = Math.max(0, Math.min(.1, s.time - lastTime));
      if (s.time < lastTime) { wheelAngle = 0; spinRate = 0; }
      else if (s.grounded) { spinRate = s.speed / ART.wheelRadius; wheelAngle += Math.max(0, Math.min(10, s.z - lastZ)) / ART.wheelRadius; }
      else { spinRate *= Math.exp(-dt * .24); wheelAngle += spinRate * dt; }
      wheelAngle %= Math.PI * 2; lastTime = s.time; lastZ = s.z;
      for (const spin of wheelSpins) spin.rotation.x = wheelAngle;
      compression=0;for(const w of wheelRoots){w.node.rotation.y=w.front?s.heading*.65:0;const y=suspensionY(s,w.node.position.x,w.node.position.z,ART.wheelRadius);w.node.position.y=y;compression+=Math.max(0,y+.4)/4;}
    },
    snapshot: () => ({compression,wheelLocalY:wheelRoots.map(w=>w.node.position.y),wheelAngle, spinRate, wheelRadius: ART.wheelRadius, richDetails: !low, bodyMeshes: body.getChildMeshes().length }),
  };
}
