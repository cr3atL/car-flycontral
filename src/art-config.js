// Rendering only. Gameplay dimensions, collisions and flight tuning live in config.js.
export const ART = Object.freeze({
  version: 1, districtLength: 1000, cycle: 3000,
  roadEnvelope: 13.6, sceneryBoundary: 14, farClip: 1600,
  // Engine uses CSS sizes (adaptToDeviceRatio=false). Density is explicit and DPR never divides it.
  pixelDensity: { rich: 1.25, low: .8 }, maxRenderPixels: { rich: 1600 * 900, low: 1280 * 720 },
  wheelRadius: .36,
  districts: [
    { id: 'civic', name: '天际高架', start: 0, end: 1000, palette: ['#263f51', '#607d89', '#b6b9ad', '#ebc58d'], rhythm: 48 },
    { id: 'port', name: '港湾互通', start: 1000, end: 2000, palette: ['#344e59', '#738184', '#b77957', '#ddac71'], rhythm: 64 },
    { id: 'coast', name: '海门大桥', start: 2000, end: 3000, palette: ['#427181', '#9cafaf', '#b1c3bd', '#e4c6a0'], rhythm: 80 },
  ],
  budget: { meshes: 220, draws: 125, materials: 40, vertices: 180000 },
});
export function districtAt(z) { return ART.districts[Math.floor(((z % ART.cycle) + ART.cycle) % ART.cycle / ART.districtLength)]; }
