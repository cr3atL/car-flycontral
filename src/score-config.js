// Score rules and presentation thresholds are separate from flight tuning.
export const SCORE = Object.freeze({
  version: 5, bestKey: 'crimson-lift-best-score-v5-continuous-yaw',
  points: Object.freeze({ roll: 600, yaw: 600, front: 750, back: 750, ring: 450, graze: 300, obstacle: 100 }),
  repeat: Object.freeze([1, .5, .25]), multiplierStep: .5, multiplierMax: 3,
  tiers: Object.freeze([
    { min: 0, name: '漂亮', color: '#f0f5f5' }, { min: 300, name: '精彩的', color: '#95f5db' },
    { min: 700, name: '惊人的', color: '#c2a1ff' }, { min: 1200, name: '不可思议的', color: '#ffd36e' },
    { min: 2000, name: '不可能的', color: 'rgb' },
  ]),
  ratings: Object.freeze([
    { min: 0, grade: 'C', label: '初次升空' }, { min: 6000, grade: 'B', label: '渐入佳境' },
    { min: 12000, grade: 'A', label: '空中好手' }, { min: 20000, grade: 'S', label: '特技大师' },
    { min: 32000, grade: 'SS', label: '极限驾驶者' }, { min: 45000, grade: 'SSS', label: '不可能的驾驶' },
  ]),
});
export function scoreTier(score) { const index = Math.max(0, SCORE.tiers.findLastIndex(t => score >= t.min)); return { ...SCORE.tiers[index], index }; }
