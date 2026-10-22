import test from 'node:test';
import assert from 'node:assert/strict';
import { NullEngine } from '@babylonjs/core/Engines/nullEngine.js';
import { Scene } from '@babylonjs/core/scene.js';
import { StandardMaterial } from '@babylonjs/core/Materials/standardMaterial.js';
import { TransformNode } from '@babylonjs/core/Meshes/transformNode.js';
import { Color3 } from '@babylonjs/core/Maths/math.color.js';
import { buildCarArt } from '../src/car-art.js';
import { buildCityArt } from '../src/city-art.js';
const fixture = () => { const engine = new NullEngine(), scene = new Scene(engine); const mat = (n, color) => { const m = new StandardMaterial(n, scene); m.diffuseColor = Color3.FromHexString(color); return m; }; return { engine, scene, mat }; };
test('car builds with compatible attributes, wheel alloys remain at preserved axle centres', () => {
  const { engine, scene, mat } = fixture(), body = new TransformNode('body', scene); const car = buildCarArt(scene, body, mat, mat('steel', '#445566'), mat('black', '#101820'));
  const pivots = scene.transformNodes.filter(n => n.name === 'wheel-steering'); assert.equal(pivots.length, 4);
  for (const node of pivots) {
    assert.equal(Math.abs(node.position.x), 1.01); assert.equal(node.position.y, -.4); assert.ok([-1.28, 1.18].includes(node.position.z));
    const alloy = node.getChildMeshes().find(m => m.name.includes('merged')); assert.ok(alloy); alloy.computeWorldMatrix(true);
    const center = alloy.getBoundingInfo().boundingBox.centerWorld; assert.ok(Math.abs(center.x - node.position.x) < .02); assert.ok(Math.abs(center.z - node.position.z) < .02);
  }
  car.update({ time: .1, z: 2, speed: 20, grounded: true, heading: 0 }); const before = car.snapshot().wheelAngle; assert.ok(before > 0);
  car.update({ time: .1, z: 2, speed: 20, grounded: true, heading: 0 }); assert.equal(car.snapshot().wheelAngle, before);
  const enabled = () => scene.meshes.filter(m => m.isEnabled()).length; const rich = enabled(); car.setQuality('low'); assert.ok(enabled() < rich); car.setQuality('rich'); assert.equal(enabled(), rich); engine.dispose();
});
test('all scenery stays outside rotated flight corridor; district boundaries and cycle retain the rear module', () => {
  const { engine, scene, mat } = fixture(); const shared = Object.fromEntries(['asphalt', 'concrete', 'stripe', 'steel'].map(n => [n, mat(n, '#556677')])); const city = buildCityArt(scene, mat, shared);
  for (const mesh of scene.meshes) { const p = mesh.getVerticesData('position'); for (let i = 0; i < p.length; i += 3) assert.ok(Math.abs(p[i]) >= 13.6, `${mesh.name}: x ${p[i]}`); assert.ok(mesh.getVerticesData('normal').every(Number.isFinite)); }
  for (const boundary of [1000, 2000, 3000, 6000]) {
    city.update(boundary - 1); const before = city.snapshot(); city.update(boundary); const exact = city.snapshot(); city.update(boundary + 1); const after = city.snapshot();
    assert.ok(exact.visibleModules >= 2); for (let i = 0; i < 3; i++) { assert.equal(exact.modulePositions[i], before.modulePositions[i] - 1); assert.equal(after.modulePositions[i], exact.modulePositions[i] - 1); }
  }
  const meshes = scene.meshes.length, materials = scene.materials.length; for (let i = 0; i < 200; i++) city.update(i * 299); assert.equal(scene.meshes.length, meshes); assert.equal(scene.materials.length, materials);
  city.update(3000); assert.equal(city.snapshot().modulePositions[2], -1000); assert.equal(city.snapshot().district, 'civic'); engine.dispose();
});
