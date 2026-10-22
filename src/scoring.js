import { SCORE, scoreTier } from './score-config.js';
export class Score {
  constructor() { this.total = 0; this.serial = 0; this.sequence = 0; this.chainId = 0; this.journal = []; this.clearChain(); }
  clearChain() { this.base = 0; this.counts = {}; this.records = []; this.seenTiers = new Set([0]); this.chainId++; }
  publish(event) { this.journal.push({ ...event, id: this.sequence++, chainId: this.chainId }); if (this.journal.length > 64) this.journal.shift(); }
  upgrades(value) { const result = []; for (let i = 1; i <= scoreTier(value).index; i++) if (!this.seenTiers.has(i)) { this.seenTiers.add(i); result.push(i); } return result; }
  record(label, points, time) {
    const record = { id: this.serial++, label, points, multiplier: this.multiplier, tierScore: this.pending };
    this.records.push(record); this.records = this.records.slice(-4);
    this.publish({ type: 'score', time, record, base: this.base, pending: this.pending, multiplier: this.multiplier, upgrades: this.upgrades(this.pending) });
  }
  complete(stunt, { time = 0 } = {}) {
    const count = this.counts[stunt.category] ?? 0;
    const points = SCORE.points[stunt.category] * SCORE.repeat[Math.min(count, SCORE.repeat.length - 1)];
    this.counts[stunt.category] = count + 1; this.base += points; this.record(stunt.label, points, time); return points;
  }
  bonus(category, label, points = SCORE.points[category], { time = 0 } = {}) {
    this.counts[category] = (this.counts[category] ?? 0) + 1; this.base += points; this.record(label, points, time);
  }
  addObstacle({ time = 0, label = '障碍通过' } = {}) { this.total += SCORE.points.obstacle; this.publish({ type: 'pass', time, amount: SCORE.points.obstacle, total: this.total, label }); }
  get multiplier() { return Math.min(SCORE.multiplierMax, 1 + Math.max(0, Object.keys(this.counts).length - 1) * SCORE.multiplierStep); }
  get pending() { return this.base * this.multiplier; }
  settle(factor, { time = 0, grade = 0, position = null } = {}) {
    const earned = Math.round(this.pending * factor); this.total += earned;
    this.publish({ type: 'bank', time, amount: earned, total: this.total, base: this.base, pending: this.pending, multiplier: this.multiplier, factor, grade, position, records: this.records.map(r => ({ ...r })), upgrades: this.upgrades(earned) });
    this.clearChain(); return earned;
  }
  cancel({ time = 0 } = {}) { this.publish({ type: 'crash', time, amount: this.pending, total: this.total }); this.clearChain(); }
}
