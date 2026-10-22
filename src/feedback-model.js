import { FEEDBACK as F } from './feedback-config.js';
import { scoreTier } from './score-config.js';
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
export const easeOut = t => 1 - (1 - clamp(t)) ** 3;
export function valueAt(tween, now) { return tween.from + (tween.to - tween.from) * easeOut((now - tween.at) / Math.max(.001, tween.duration)); }
export class EffectQuality {
  constructor(mode = 'auto', reduced = false) { this.mode = mode; this.reduced = reduced; this.auto = 'rich'; this.slow = 0; this.fast = 0; this.average = 0; this.clock = 0; this.lastSwitch = -99; this.switches = 0; }
  get effective() { return this.reduced || this.mode === 'low' ? 'low' : this.mode === 'rich' ? 'rich' : this.auto; }
  observe(frameMs) {
    const dt = Math.min(.1, Math.max(0, frameMs / 1000)); this.clock += dt;
    this.average = this.average ? this.average * .9 + frameMs * .1 : frameMs;
    this.slow = this.average > F.slowFrame ? this.slow + dt : Math.max(0, this.slow - dt * .5); this.fast = this.average < F.fastFrame ? this.fast + dt : 0;
    if (this.mode !== 'auto' || this.clock - this.lastSwitch < F.qualityHold) return;
    const next = this.auto === 'rich' && this.slow >= F.slowSeconds ? 'low' : this.auto === 'low' && this.fast >= F.fastSeconds ? 'rich' : this.auto;
    if (next !== this.auto) { this.auto = next; this.lastSwitch = this.clock; this.switches++; this.slow = this.fast = 0; }
  }
  snapshot() { return { mode: this.mode, reduced: this.reduced, effective: this.effective, average: this.average, switches: this.switches }; }
}
export class FeedbackTimeline {
  constructor() { this.reset(); }
  reset(now = 0, total = 0) {
    this.cursor = -1; this.chainId = -1; this.rows = []; this.signals = []; this.lastAt = -99; this.deadline = -99;
    this.kind = ''; this.amount = 0; this.base = 0; this.multiplier = 1; this.factor = 1; this.grade = 0;
    this.number = { from: 0, to: 0, at: now, duration: .001 }; this.total = { from: total, to: total, at: now, duration: .001 };
    this.bankAt = -99; this.punchAt = -99; this.passAt = -99; this.passAmount = 0; this.impactAt = -99; this.impactGrade = 0;
    this.upgradeKeys = new Set(); this.upgradeCounts = [0, 0, 0, 0, 0]; this.bursts = 0; this.actionsPresented = 0;
  }
  muteQueued() { for (const s of this.signals) s.audio = false; }
  signal(signal) { this.signals.push(signal); if (this.signals.length > F.maxSignals) this.signals.shift(); }
  ingest(journal, now) {
    for (const e of journal) {
      if (e.id <= this.cursor) continue; this.cursor = e.id;
      if (now - e.time >= F.duration) { if (e.total !== undefined) this.total = { from: e.total, to: e.total, at: now, duration: .001 }; continue; }
      if (e.type === 'pass') {
        this.total = { from: valueAt(this.total, now), to: e.total, at: now, duration: .32 }; this.passAt = e.time; this.passAmount = e.amount;
        this.signal({ type: 'pass', at: e.time, end: e.time + .65, audio: true }); continue;
      }
      if (e.type === 'score' && this.chainId !== e.chainId) { this.chainId = e.chainId; this.rows = []; }
      const upgrades = (e.upgrades ?? []).filter(tier => { const key = `${e.chainId}:${tier}`; if (this.upgradeKeys.has(key)) return false; this.upgradeKeys.add(key); this.upgradeCounts[tier]++; return true; });
      if (this.upgradeKeys.size > 100) this.upgradeKeys = new Set([...this.upgradeKeys].slice(-40));
      const highest = upgrades.length ? Math.max(...upgrades) : 0;
      this.lastAt = e.time; this.deadline = e.time + F.duration; this.punchAt = e.time;
      if (e.type === 'score') {
        this.kind = 'score'; this.amount = e.pending; this.base = e.base; this.multiplier = e.multiplier;
        const visibleAt = Math.max(e.time, (this.rows.at(-1)?.visibleAt ?? e.time - F.rowStagger) + F.rowStagger);
        this.rows.push({ ...e.record, visibleAt }); this.rows = this.rows.slice(-F.maxRows);
        this.signal({ type: 'action', at: visibleAt, end: this.deadline, tier: scoreTier(e.pending).index, upgrade: highest, audio: true });
        if (highest) this.bursts++; this.number = { from: valueAt(this.number, now), to: e.pending, at: now, duration: Math.min(F.numberDuration, this.deadline - now) };
      } else if (e.type === 'bank') {
        if (this.chainId !== e.chainId || !e.records.length) this.rows = e.records.map(r => ({ ...r, visibleAt: e.time - .25 }));
        this.chainId = e.chainId;
        this.kind = 'bank'; this.amount = e.amount; this.base = e.base; this.multiplier = e.multiplier; this.factor = e.factor; this.grade = e.grade; this.bankAt = e.time;
        this.impactAt = e.time; this.impactGrade = e.grade;
        this.number = { from: valueAt(this.number, now), to: e.amount, at: now, duration: F.numberDuration };
        this.total = { from: valueAt(this.total, now), to: e.total, at: now + (e.amount ? .16 : 0), duration: .36 };
        this.signal({ type: 'bank', at: e.time, end: this.deadline, amount: e.amount, grade: e.grade, tier: scoreTier(e.amount).index, upgrade: highest, position: e.position, audio: true });
        if (highest) this.bursts++;
      } else if (e.type === 'crash') {
        this.kind = 'crash'; this.amount = 0; this.rows = []; this.signals = []; this.impactAt = e.time; this.impactGrade = 3;
        this.signal({ type: 'crash', at: e.time, end: this.deadline, audio: true });
      }
    }
  }
  tick(now) {
    const due = [];
    this.signals = this.signals.filter(s => { if (s.at <= now) { if (now < s.end && now - s.at < .35) { due.push(s); if (s.type === 'action') this.actionsPresented++; } return false; } return now < s.end; });
    return due;
  }
  snapshot(now) { return { kind: this.kind, amount: this.amount, displayed: valueAt(this.number, now), total: valueAt(this.total, now), visible: now < this.deadline, deadline: this.deadline, rows: this.rows.map(r => ({ ...r, shown: r.visibleAt <= now && now < this.deadline })), queue: this.signals.length, upgradeCounts: [...this.upgradeCounts], bursts: this.bursts, actionsPresented: this.actionsPresented }; }
}
