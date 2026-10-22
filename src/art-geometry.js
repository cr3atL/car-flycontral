import { Mesh } from '@babylonjs/core/Meshes/mesh.js';
import { VertexData } from '@babylonjs/core/Meshes/mesh.vertexData.js';
// Append geometry at build time; one mesh per shared material. No runtime rebuilding.
export class ArtBatch {
  constructor(scene, parent, name) { this.scene = scene; this.parent = parent; this.name = name; this.groups = new Map(); }
  add(material, positions, indices, normals) {
    let g = this.groups.get(material); if (!g) { g = { positions: [], indices: [], normals: [] }; this.groups.set(material, g); }
    if (!normals) { normals = []; VertexData.ComputeNormals(positions, indices, normals); }
    const base = g.positions.length / 3; g.positions.push(...positions); g.normals.push(...normals); for (const i of indices) g.indices.push(i + base);
  }
  box(material, w, h, d, x, y, z, yaw = 0) {
    const b = VertexData.CreateBox({ width: w, height: h, depth: d });
    const c = Math.cos(yaw), s = Math.sin(yaw);
    for (let i = 0; i < b.positions.length; i += 3) { const px = b.positions[i], pz = b.positions[i + 2]; b.positions[i] = x + px * c + pz * s; b.positions[i + 1] += y; b.positions[i + 2] = z + pz * c - px * s; const nx = b.normals[i], nz = b.normals[i + 2]; b.normals[i] = nx * c + nz * s; b.normals[i + 2] = nz * c - nx * s; }
    this.add(material, b.positions, b.indices, b.normals);
  }
  quad(material, a, b, c, d) { this.add(material, [...a, ...b, ...c, ...d], [0, 1, 2, 0, 2, 3]); }
  beam(material, a, b, width = .2) {
    const dy = b[1] - a[1], dz = b[2] - a[2], dx = b[0] - a[0], length = Math.hypot(dx, dy, dz); if (!length) return;
    // A square prism oriented along the vector, robust even for vertical beams.
    const f = [dx / length, dy / length, dz / length], u = Math.abs(f[1]) > .95 ? [1, 0, 0] : [f[2], 0, -f[0]], n = Math.hypot(...u); for (let i = 0; i < 3; i++) u[i] *= width / (2 * n);
    const v = [f[1] * u[2] - f[2] * u[1], f[2] * u[0] - f[0] * u[2], f[0] * u[1] - f[1] * u[0]];
    const p = []; for (const end of [a, b]) for (const [us, vs] of [[-1, -1], [1, -1], [1, 1], [-1, 1]]) p.push(end[0] + us * u[0] + vs * v[0], end[1] + us * u[1] + vs * v[1], end[2] + us * u[2] + vs * v[2]);
    this.add(material, p, [0, 2, 1, 0, 3, 2, 4, 5, 6, 4, 6, 7, 0, 1, 5, 0, 5, 4, 1, 2, 6, 1, 6, 5, 2, 3, 7, 2, 7, 6, 3, 0, 4, 3, 4, 7]);
  }
  loft(material, rings) {
    const positions = rings.flat(2), n = rings[0].length, indices = [];
    for (let j = 0; j < rings.length - 1; j++) for (let k = 0; k < n; k++) { const a = j * n + k, b = j * n + (k + 1) % n; indices.push(a, b, b + n, a, b + n, a + n); }
    for (let k = 1; k < n - 1; k++) { indices.push(0, k + 1, k); const a = (rings.length - 1) * n; indices.push(a, a + k, a + k + 1); }
    const normals = []; VertexData.ComputeNormals(positions, indices, normals);
    const center = [0, 0, 0]; for (let i = 0; i < positions.length; i++) center[i % 3] += positions[i] / (positions.length / 3);
    let outward = 0; for (let i = 0; i < positions.length; i++) outward += (positions[i] - center[i % 3]) * normals[i];
    if (outward < 0) { for (let i = 0; i < indices.length; i += 3) [indices[i + 1], indices[i + 2]] = [indices[i + 2], indices[i + 1]]; VertexData.ComputeNormals(positions, indices, normals); }
    this.add(material, positions, indices, normals);
  }
  build() {
    const meshes = [];
    for (const [material, g] of this.groups) { const m = new Mesh(`${this.name}-${material.name}`, this.scene), v = new VertexData(); v.positions = g.positions; v.normals = g.normals; v.uvs = new Float32Array(g.positions.length / 3 * 2); v.indices = g.indices; v.applyToMesh(m); m.material = material; m.parent = this.parent; m.isPickable = false; meshes.push(m); }
    this.groups.clear(); return meshes;
  }
}
