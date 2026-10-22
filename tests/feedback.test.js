import test from 'node:test';
import assert from 'node:assert/strict';
import { Score } from '../src/scoring.js';
import { SCORE } from '../src/score-config.js';
import { STUNTS } from '../src/config.js';
import { FeedbackTimeline, EffectQuality, valueAt } from '../src/feedback-model.js';
import { GameSession } from '../src/challenge.js';

test('ordinary combo, ring/graze, repeats, capped multiplier and independent obstacle points', () => {
  const s = new Score(); s.complete(STUNTS.left); s.complete(STUNTS.back);
  assert.equal(s.pending, 2025); s.addObstacle(); assert.equal(s.pending, 2025); assert.equal(s.total, 100);
  assert.equal(s.settle(1.2), 2430); assert.equal(s.total, 2530);
  s.complete(STUNTS.left); s.complete(STUNTS.back); s.bonus('ring', '环'); assert.equal(s.pending, 3600);
  s.bonus('graze', '擦障'); assert.equal(s.pending, 5250); s.complete(STUNTS.front); assert.equal(s.multiplier, 3);
  const repeat = new Score(); for (let i = 0; i < 4; i++) repeat.complete(STUNTS.left);
  assert.deepEqual(repeat.records.map(r => r.points), [600, 300, 150, 150]);
});
test('versioned best neither reads nor overwrites the old score scale', () => {
  const data = new Map([['crimson-lift-best-v1', '99999'], ['crimson-lift-best-score', '88888']]);
  const storage = { getItem: k => data.get(k), setItem: (k, v) => data.set(k, v) };
  const g = new GameSession(storage); assert.equal(g.best, 0); g.start(); g.sim.score.total = 2430; g.finish('time');
  assert.equal(data.get(SCORE.bestKey), '2430'); assert.equal(data.get('crimson-lift-best-v1'), '99999'); assert.equal(data.get('crimson-lift-best-score'), '88888');
});
test('staggered stable rows and only strongest newly crossed celebration, with no replay', () => {
  const s = new Score(), t = new FeedbackTimeline(); s.complete(STUNTS.left, { time: 1 }); s.complete(STUNTS.back, { time: 1 });
  t.ingest(s.journal, 1); const first = t.tick(1); assert.deepEqual(first.map(e => e.upgrade), [1]);
  assert.deepEqual(t.rows.map(r => r.visibleAt), [1, 1.11]); assert.equal(t.snapshot(1).rows[1].shown, false);
  assert.deepEqual(t.tick(1.12).map(e => e.upgrade), [4]); assert.equal(t.bursts, 2);
  t.ingest(s.journal, 1.2); assert.equal(t.tick(1.2).length, 0); assert.equal(t.rows.length, 2);
  s.addObstacle({ time: 1.3 }); t.ingest(s.journal, 1.3); assert.equal(t.amount, 2025); assert.equal(t.deadline, 3);
  assert.equal(t.snapshot(2.999).visible, true); assert.equal(t.snapshot(3).visible, false);
  s.settle(1.2, { time: 3.2, grade: 0, position: { x: 2, z: 100 } }); t.ingest(s.journal, 3.2);
  assert.equal(t.bursts, 2); assert.equal(t.amount, 2430); assert.equal(t.snapshot(5.2).visible, false);
  assert.equal(valueAt(t.total, 3.8), 2530);
});
test('paused clocks freeze, queued sounds mute, stale events and reset never replay', () => {
  const s = new Score(), t = new FeedbackTimeline(); s.complete(STUNTS.left, { time: 1 }); s.complete(STUNTS.back, { time: 1 }); t.ingest(s.journal, 1);
  t.tick(1); const frozen = t.snapshot(1); t.muteQueued(); assert.deepEqual(t.snapshot(1), frozen);
  assert.equal(t.tick(1.12)[0].audio, false); assert.equal(t.tick(1.12).length, 0);
  const stale = new FeedbackTimeline(); s.settle(1.2, { time: 2 }); stale.ingest(s.journal, 5);
  assert.equal(stale.tick(5).length, 0); assert.equal(stale.snapshot(5).visible, false); assert.equal(valueAt(stale.total, 5), 2430);
  t.reset(); assert.equal(t.rows.length, 0); assert.equal(t.tick(6).length, 0);
});
test('rows, journal and signal queues remain bounded over many chains', () => {
  const s = new Score(), t = new FeedbackTimeline();
  for (let i = 0; i < 200; i++) { const time = i * .01; s.complete(STUNTS.left, { time }); if (i % 6 === 5) s.settle(1.2, { time }); t.ingest(s.journal, time); }
  assert.ok(s.journal.length <= 64); assert.ok(t.rows.length <= 4); assert.ok(t.signals.length <= 16); assert.ok(t.upgradeKeys.size <= 100);
});
test('auto quality tolerates isolated stalls, downgrades noisy sustained slowness and recovers with hysteresis', () => {
  const q = new EffectQuality(); for (let i = 0; i < 120; i++) q.observe(i === 40 ? 90 : 16.7); assert.equal(q.effective, 'rich');
  const noisy = [30, 31, 16, 33, 26]; for (let i = 0; i < 400; i++) q.observe(noisy[i % noisy.length]); assert.equal(q.effective, 'low'); assert.equal(q.switches, 1);
  for (let i = 0; i < 300; i++) q.observe(16); assert.equal(q.effective, 'low');
  for (let i = 0; i < 400; i++) q.observe(16); assert.equal(q.effective, 'rich'); assert.equal(q.switches, 2);
  q.mode = 'low'; assert.equal(q.effective, 'low'); q.mode = 'rich'; q.reduced = true; assert.equal(q.effective, 'low');
});
