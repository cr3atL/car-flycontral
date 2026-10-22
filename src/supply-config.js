import { CONFIG as C } from './config.js';
export const SUPPLY = Object.freeze({ radius: 3.6, points: C.supplyRing, period: 1200, practice: [{ z: 350, y: 5 }, { z: 795, y: 5 }] });
export function nearbySupplies(z) { const lap = Math.floor(z / SUPPLY.period); return [lap - 1, lap, lap + 1].flatMap(l => SUPPLY.practice.map((r, i) => ({ id: `gas:${l}:${i}`, x: 0, y: r.y, z: l * SUPPLY.period + r.z, radius: SUPPLY.radius }))); }
