import { FEEDBACK as F } from './feedback-config.js';
const colors = ['#f0f5f5', '#95f5db', '#c2a1ff', '#ffd36e'];
export class FeedbackParticles {
  constructor(canvas) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d', { alpha: true });
    this.pool = Array.from({ length: F.particles }, () => ({ end: -1 })); this.rings = Array.from({ length: F.rings }, () => ({ end: -1 }));
    this.peak = 0; this.ringPeak = 0; this.emitted = 0; this.seed = 17; this.width = 0; this.height = 0; this.dirty = false;
  }
  random() { this.seed = (1664525 * this.seed + 1013904223) >>> 0; return this.seed / 4294967296; }
  clear() { for (const p of this.pool) p.end = -1; for (const r of this.rings) r.end = -1; this.ctx?.clearRect(0, 0, this.width, this.height); this.dirty = false; }
  limit(quality) { return quality === 'low' ? F.lowParticles : this.width < 1000 ? F.mobileParticles : F.particles; }
  resize(quality) {
    const width = window.innerWidth, height = window.innerHeight, dpr = quality === 'low' ? 1 : Math.min(1.25, window.devicePixelRatio || 1);
    if (width === this.width && height === this.height && dpr === this.dpr) return;
    this.width = width; this.height = height; this.dpr = dpr; this.canvas.width = Math.round(width * dpr); this.canvas.height = Math.round(height * dpr); this.ctx?.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  emit(event, now, quality, anchor) {
    const low = quality === 'low', limit = this.limit(quality);
    if (event.type === 'crash') this.clear();
    const count = event.type === 'action' ? low ? 3 : F.actionParticles + (event.upgrade ? event.upgrade === 4 ? F.rgbParticles : F.upgradeParticles : 0) : event.type === 'bank' ? 0 : event.type === 'crash' ? low ? 3 : 12 : 0;
    for (let i = 0; i < count; i++) {
      if (this.pool.filter(p => p.end > now).length >= limit) break;
      const p = this.pool.find(p => p.end <= now); if (!p) break;
      const a = this.random() * Math.PI * 2, world = event.type === 'bank' && !!event.position;
      Object.assign(p, { at: now, end: Math.min(event.end, now + (low ? .35 : .55 + this.random() * .22)), world, x: world ? event.position.x + (i % 2 ? .9 : -.9) : anchor.x, y: world ? .08 : anchor.y, z: event.position?.z ?? 0,
        vx: Math.cos(a) * (world ? event.grade === 2 ? 4 : 2.8 : 30 + this.random() * 65), vy: world ? event.grade === 2 ? .5 + this.random() * .5 : 1 + this.random() * 1.3 : Math.sin(a) * 55 - 18, vz: world ? (this.random() - .5) * 4 : 0, radius: low ? 1.4 : 1.2 + this.random() * 1.8, tier: event.tier ?? 0, heavy: event.grade === 2, dust: world, index: i }); this.emitted++;
    }
    if (((event.upgrade && event.type !== 'bank') || event.type === 'crash') && (!low || event.type === 'bank')) {
      const r = this.rings.find(r => r.end <= now);
      if (r) Object.assign(r, { at: now, end: Math.min(event.end, now + (low ? .25 : .5)), x: event.position?.x ?? anchor.x, z: event.position?.z ?? 0, y: event.position ? .06 : anchor.y, world: !!event.position, tier: event.tier ?? 0, heavy: event.grade === 2, crash: event.type === 'crash' });
    }
    this.peak = Math.max(this.peak, this.pool.filter(p => p.end > now).length); this.ringPeak = Math.max(this.ringPeak, this.rings.filter(p => p.end > now).length);
  }
  draw(now, quality, project) {
    if (!this.ctx) return; this.resize(quality); const live = this.pool.some(p => p.end > now) || this.rings.some(r => r.end > now);
    this.canvas.style.visibility = live ? 'visible' : 'hidden'; if (!live && !this.dirty) return;
    const c = this.ctx; c.clearRect(0, 0, this.width, this.height); this.dirty = live;
    const cap = this.limit(quality); let rendered = 0;
    for (const p of this.pool) {
      if (p.end <= now) continue; if (rendered++ >= cap) { p.end = -1; continue; }
      const age = now - p.at, fade = Math.max(0, (p.end - now) / (p.end - p.at)); let x, y;
      if (p.world) { const v = project(p.x + p.vx * age, Math.max(.03, p.y + p.vy * age - 2.8 * age * age), p.z + p.vz * age); if (!v.visible) continue; x = v.x; y = v.y; }
      else { x = Math.max(this.width * .5, Math.min(this.width * .81, p.x + p.vx * age)); y = Math.max(this.height * .15, Math.min(this.height * .53, p.y + p.vy * age + 18 * age * age)); }
      c.globalAlpha = fade * (p.dust ? p.heavy ? .42 : .28 : .85); c.fillStyle = p.dust ? p.heavy ? '#edba83' : '#cfe3e2' : p.tier === 4 ? `hsl(${((quality === 'low' ? 0 : now * 120) + p.index * 31) % 360} 90% 74%)` : colors[p.tier];
      c.beginPath(); c.arc(x, y, p.radius * (p.dust ? 1.4 + age * 2 : 1), 0, Math.PI * 2); c.fill();
    }
    for (const r of this.rings) {
      if (r.end <= now) continue; const age = now - r.at, fade = Math.max(0, (r.end - now) / (r.end - r.at)); let x = r.x, y = r.y, rx = 15 + age * 110, ry = rx;
      if (r.world) { const v = project(r.x, .06, r.z); if (!v.visible) continue; x = v.x; y = v.y; const right = project(r.x + 1.4 + age * 5, .06, r.z); rx = Math.min(160, Math.abs(right.x - x)); ry = rx * .23; }
      c.globalAlpha = fade * .6; c.strokeStyle = r.crash ? '#ff9a98' : r.heavy ? '#ffc184' : r.tier === 4 ? `hsl(${quality === 'low' ? 160 : now * 180 % 360} 90% 75%)` : colors[r.tier]; c.lineWidth = r.heavy ? 2 : 1.3; c.beginPath(); c.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2); c.stroke();
    }
    c.globalAlpha = 1;
  }
  snapshot(now) { return { capacity: this.pool.length, active: this.pool.filter(p => p.end > now).length, heavy: this.pool.filter(p => p.end > now && p.heavy).length, ringCapacity: this.rings.length, rings: this.rings.filter(p => p.end > now).length, peak: this.peak, ringPeak: this.ringPeak, emitted: this.emitted, dpr: this.dpr, worldParticles: this.pool.filter(p => p.end > now && p.world).map(p => ({ x: p.x, z: p.z, at: p.at })) }; }
}
