import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { ArtBatch } from './art-geometry.js';
import { ART, districtAt } from './art-config.js';

export function buildCityArt(scene, mat, shared) {
  const m = { ...shared, tower: mat('facade-graphite', '#3b5266'), stone: mat('warm-stone', '#8d9999'), glass: mat('facade-blue-glass', '#3d6377'), windows: mat('warm-office-windows', '#c3a77b', .22), copper: mat('port-oxidized-copper', '#9b6149'), teal: mat('port-container-teal', '#426e78'), pylon: mat('bridge-ivory', '#b3bfba'), island: mat('distant-island', '#6c8b91') };
  m.glass.specularColor.set(.4, .55, .64); m.glass.specularPower = 64; m.windows.specularColor.set(0, 0, 0);
  m.stone.specularColor.set(.035, .04, .045); m.pylon.specularColor.set(.04, .045, .05);
  const sections = [], detailRoots = [];
  let low = false;
  const minSafetyX = 14;
  const tower = (batch, material, x, z, w, d, h, bottom = -16, taper = .88) => {
    const outline = (y, scale) => [[-w * .4, -d * .5], [w * .4, -d * .5], [w * .5, -d * .4], [w * .5, d * .4], [w * .4, d * .5], [-w * .4, d * .5], [-w * .5, d * .4], [-w * .5, -d * .4]].map(([px, pz]) => [x + px * scale, y, z + pz * scale]);
    batch.loft(material, [outline(bottom, 1), outline(bottom + h * .8, 1), outline(bottom + h, taper)]);
  };
  for (let i = 0; i < 3; i++) {
    const root = new TransformNode(`district-${ART.districts[i].id}`, scene), detail = new TransformNode(`district-${i}-rich-detail`, scene); detail.parent = root; sections.push(root); detailRoots.push(detail);
    const b = new ArtBatch(scene, root, `district-${i}-structure`), d = new ArtBatch(scene, detail, `district-${i}-detail`);
    // Outside the rotated car/flight envelope, common rails carry the near-field rhythm.
    for (const side of [-1, 1]) {
      for (let z = 0; z < 1000; z += 12) {
        b.box(m.steel, .12, .78, .14, side * 14.05, .38, z);
        b.box(m.concrete, .18, .27, 12, side * 14.1, .67, z + 6);
        b.box(m.stripe, .13, .12, .27, side * 14, .72, z);
        if (z % 36 === 0) d.box(m.steel, .32, .055, .58, side * 13.95, .055, z + 1);
      }
      for (let z = 0; z < 1000; z += 100) {
        b.box(m.concrete, 2.4, 17, 3.8, side * 16.8, -10, z);
        b.beam(m.concrete, [side * 16.8, -4, z], [side * 14.2, -1.8, z], .7);
      }
      for (let z = 20; z < 1000; z += ART.districts[i].rhythm) {
        b.beam(m.steel, [side * 15.6, -.2, z], [side * 15.4, 7.8, z], .12);
        b.beam(m.steel, [side * 15.4, 7.8, z], [side * 14.35, 8.5, z], .11);
        b.box(m.stripe, .68, .08, .26, side * 14.5, 8.43, z);
        d.box(m.stone, .36, .7, .3, side * 15.5, .5, z);
      }
    }
    if (i === 0) {
      for (const side of [-1, 1]) b.box(m.concrete, 145, 3, 1000, side * 90, -17.5, 500);
      // Dense vertical city. Heights, setbacks and facade rhythms vary intentionally.
      for (let j = 0; j < 28; j++) {
        const side = j % 3 === 0 ? 1 : -1, z = 16 + j * 35, h = 28 + (j * 23 % 61), w = 14 + (j % 4) * 3, depth = 19 + j % 3 * 5, x = side * (36 + (j % 3) * 17);
        tower(b, j % 3 === 0 ? m.stone : j % 2 ? m.glass : m.tower, x, z, w, depth, h);
        b.box(m.stone, w + 3, 6, depth + 4, x, -11, z);
        if (j % 4 === 0) { tower(b, m.tower, x, z + depth * .13, w * .65, depth * .65, 11, h - 17, .72); d.beam(m.steel, [x, h - 7, z], [x, h + 5, z], .2); }
        for (let y = -7; y < h - 19; y += 6) {
          d.box(m.stone, w * .98, .19, depth + .1, x, y, z);
          for (let k = 0; k < 3; k++) if ((j + k + Math.round(y)) % 3 !== 0) d.box(m.windows, .055, 1.5, 2.2, x - side * w * .5 - side * .035, y + 1.4, z - depth * .3 + k * depth * .3);
        }
        if (j % 2 === 0) for (const offset of [-.28, 0, .28]) d.box(m.steel, .12, h - 1, .22, x - side * w * .505, h / 2 - 16, z + depth * offset);
      }
      for (let z = 80; z < 960; z += 160) {
        b.box(m.glass, .16, 2, 38, 15, 1.2, z); b.box(m.steel, .2, .13, 38, 15, 2.25, z);
        for (let q = -18; q < 20; q += 4) d.box(m.stone, .25, 2.2, .12, 15, 1.1, z + q);
      }
      // A curved, separated city distributor stays wholly outside the main flight corridor.
      for (let z = 0; z < 1000; z += 40) {
        const x = 47 + 6 * Math.sin(z / 190), yaw = Math.atan(6 / 190 * Math.cos(z / 190));
        d.box(m.concrete, 10, .75, 41, x, -4.5, z + 20, yaw); d.box(m.asphalt, 9, .06, 41, x, -4.08, z + 20, yaw);
        for (const side of [-1, 1]) d.box(m.steel, .2, .5, 41, x + side * 4.6, -3.8, z + 20, yaw);
        d.box(m.stripe, .1, .02, 12, x, -4.02, z + 20, yaw);
      }
    } else if (i === 1) {
      for (const side of [-1, 1]) b.box(m.concrete, 110, 2, 1000, side * 73, -17, 500);
      // Port interchange: horizontal warehouse masses, stacks, cranes and service road.
      for (let j = 0; j < 16; j++) {
        const z = j * 64 + 16, side = j % 2 ? 1 : -1, x = side * (50 + j % 3 * 15);
        b.box(j % 2 ? m.teal : m.stone, 28, 14, 42, x, -9, z);
        b.loft(m.stone, [[[x - 15, -2, z - 22], [x + 15, -2, z - 22], [x + 15, -.5, z - 22], [x - 15, -.5, z - 22]], [[x - 15, -2, z + 22], [x + 15, -2, z + 22], [x + 15, .8, z + 22], [x - 15, .8, z + 22]]]);
        for (let stack = 0; stack < 3; stack++) {
          const cx = side * (30 + stack * 5.5), cz = z + 22 + stack * 5;
          b.box(stack % 2 ? m.teal : m.copper, 4.6, 3.1 + stack * 2.8, 13, cx, -15 + (3.1 + stack * 2.8) / 2, cz);
          for (let k = -5; k <= 5; k += 1) d.box(m.steel, .045, 2.7 + stack * 2.8, .07, cx - side * 2.33, -13.5 + stack * 1.4, cz + k);
        }
        d.box(m.windows, .04, 2, 9, x - side * 14.03, -4, z);
      }
      for (let z = 100; z < 1000; z += 260) {
        const x = 79;
        for (const dz of [-9, 9]) { b.beam(m.copper, [x - 10, -15, z + dz], [x - 4, 31, z + dz], 1.1); b.beam(m.copper, [x + 10, -15, z + dz], [x + 4, 31, z + dz], 1.1); }
        b.box(m.copper, 49, 1.4, 2.3, x + 2, 31.5, z); b.box(m.steel, 2.6, 36, 1.2, x + 8, 11, z);
        for (let k = -20; k < 22; k += 6) { d.beam(m.steel, [x + k, 31, z], [x + k + 5, 34.5, z], .15); d.beam(m.steel, [x + k + 5, 34.5, z], [x + k + 6, 31, z], .15); }
        d.beam(m.steel, [x - 17, 30, z], [x - 17, -5, z], .08); d.box(m.stone, 3, 2.8, 3, x - 15, 27.5, z);
      }
      for (let z = 0; z < 1000; z += 32) {
        b.box(m.copper, .28, .9, 8, -15.4, .45, z + 4); d.box(m.stripe, .3, .15, 2, -15.4, .68, z + 2);
        d.box(m.concrete, 9, .7, 33, -37, -3.6, z + 16); d.box(m.asphalt, 8.6, .06, 33, -37, -3.2, z + 16);
        for (const x of [-41.4, -32.6]) d.box(m.steel, .18, .6, 33, x, -2.9, z + 16);
        d.box(m.stripe, .1, .02, 8, -37, -3.15, z + 12);
      }
    } else {
      // Split pylons and all stay cables remain outside |x|=18. No fake overhead beam.
      for (let z = 100; z < 1000; z += 300) {
        for (const side of [-1, 1]) {
          b.loft(m.pylon, [[[side * 19 - 1.5, -17, z - 2], [side * 19 + 1.5, -17, z - 2], [side * 19 + 1.5, -17, z + 2], [side * 19 - 1.5, -17, z + 2]], [[side * 22 - .75, 50, z - 1], [side * 22 + .75, 50, z - 1], [side * 22 + .75, 50, z + 1], [side * 22 - .75, 50, z + 1]]]);
          b.box(m.teal, 1, 7, 1.1, side * 22, 44, z - 1.01);
          for (let offset = -125; offset <= 125; offset += 25) if (offset) b.beam(m.stone, [side * 21.8, 44, z], [side * 18.2, -.5, z + offset], .095);
          for (let offset = -137; offset < 145; offset += 25) d.beam(m.steel, [side * 22, 48, z], [side * 18.4, -.5, z + offset], .055);
        }
      }
      for (let j = 0; j < 9; j++) {
        const x = -170 - j % 3 * 39, z = 80 + j * 115;
        tower(b, m.stone, x, z, 25, 22, 23 + j % 3 * 8, -17);
        for (let k = 0; k < 3; k++) d.box(m.glass, .08, 12, 3, x + 12.6, -4, z - 6 + k * 6);
      }
      for (const side of [-1, 1]) for (let z = 35; z < 1000; z += 80) { b.box(m.pylon, .16, 1.25, 14, side * 15, .6, z); d.box(m.teal, .17, .16, 14, side * 15, 1.27, z); }
      // Triangulated distant island profiles at the horizon, never within the route.
      for (let j = 0; j < 4; j++) { const z = 150 + j * 260; b.loft(m.island, [[[220, -17, z - 100], [390, -17, z - 100], [330, 18 + j * 5, z - 100]], [[240, -17, z + 120], [410, -17, z + 120], [360, 4, z + 120]]]); }
    }
    b.build(); d.build();
  }
  let district = districtAt(0), lastZ = 0;
  return {
    reflectionMeshes:sections.flatMap(r=>r.getChildMeshes()),
    setQuality(quality) { const next = quality === 'low'; if (next === low) return; low = next; for (const root of detailRoots) root.setEnabled(!low); },
    update(z) {
      lastZ = z; district = districtAt(z); const cycle = Math.floor(z / ART.cycle) * ART.cycle;
      for (let i = 0; i < sections.length; i++) { let local = cycle + i * ART.districtLength - z; if (local < -ART.districtLength - 160) local += ART.cycle; if (local >= ART.cycle - ART.districtLength - 160) local -= ART.cycle; sections[i].position.z = local; sections[i].setEnabled(local < 1250 && local + ART.districtLength > -160); }
    },
    snapshot: () => ({ district: district.id, name: district.name, z: lastZ, cycle: ART.cycle, minSceneryX: minSafetyX, richDetails: !low, visibleModules: sections.filter(r => r.isEnabled()).length, modulePositions: sections.map(r => r.position.z) }),
  };
}
