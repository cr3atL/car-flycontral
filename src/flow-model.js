// Presentation only: snapshot the record before GameSession.finish replaces it.
export class FlowModel {
  start(best) { this.previousBest = Number.isFinite(best) ? Math.max(0, best) : 0; this.ending = null; }
  endingAge(landing, simTime, frozen, paused, now) {
    if (!landing) { this.ending = null; return 0; }
    const age = Math.max(0, simTime - landing.time);
    if (this.ending?.landing !== landing) this.ending = {landing, age, at: now};
    const e = this.ending, dt = Math.max(0, (now - e.at) / 1000); e.at = now;
    e.age = frozen ? Math.max(age, e.age + (paused ? 0 : dt)) : age;
    return e.age;
  }
  result(result) {
    const previous = this.previousBest ?? null;
    const newRecord = result.newBest && previous !== null && result.score > previous;
    return {
      grade: result.rating.grade,
      label: result.rating.label,
      score: result.score,
      record: newRecord
        ? previous > 0 ? `新纪录  +${formatScore(result.score - previous)}` : '新纪录'
        : result.best > 0 ? `距最佳 ${formatScore(Math.max(0, result.best - result.score))}  ·  最佳 ${formatScore(result.best)}` : '',
      stats: [
        ['最高连击', formatScore(result.stats.highestCombo)],
        ['精准落地', String(result.stats.precision)],
        ['通过组', `${result.stats.groups} / 9`],
      ],
      notes: [result.reason !== 'time' ? '修复机会用尽' : '', result.unbanked > 0 ? `${formatScore(result.unbanked)} 未落地入账` : ''].filter(Boolean).join(' · '),
      details: [
        ['完整动作', result.stats.actions], ['命中落地区', result.stats.precisionPads],
        ['障碍分', formatScore(result.stats.obstacleScore)], ['落地入账', formatScore(result.stats.bankedTricks)],
        ['修复使用', `${result.stats.repairsUsed} / 2`], ['驾驶时间', `${result.elapsed.toFixed(1)}s`],
      ],
    };
  }
}
export function formatScore(score) { return Math.round(score).toLocaleString('zh-CN'); }
