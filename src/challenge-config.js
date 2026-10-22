import { SCORE } from './score-config.js';
export { scoreTier } from './score-config.js';
export const CHALLENGE = Object.freeze({
  duration: 90, countdown: 3, resumeCountdown: 2, repairs: 2,
  leadSeconds: 4, minLeadDistance: 150, minimumPressure: .72,
  recoveryQuiet: 6, landingQuiet: 2.2, lastSpawn: 81, safeEnding: 86,
  obstaclePoints: SCORE.points.obstacle, ringPoints: SCORE.points.ring, grazePoints: SCORE.points.graze, grazeClearance: .65,
  ratings: SCORE.ratings,
});
export const GROUPS = Object.freeze([
  { id: 1, at: 6, type: 'wall', label: '第一跳 · 越过矮墙', tutorial: true, soft: true, height: .65, launch: 34, hold: .025, ringX: null },
  { id: 2, at: 12, type: 'tutorialRoll', label: '第二跳 · 短按感受转动', tutorial: true, launch: 34, hold: .025, ringX: null },
  { id:3,at:24,offset:150,type:'wall',layout:'fleet',supply:true,label:'施工车阵 · 短喷越车',launch:38,hold:.025,ringX:0 },
  { id:4,at:32,offset:435,type:'double',layout:'stagger',label:'错列车阵 → 第二道矮栏',launch:42,hold:.55,ringX:0 },
  { id:5,at:41,offset:805,type:'gap',layout:'bridge',supply:true,label:'断桥补气 · 再喷可追高环',launch:30,hold:.8,ringX:0 },
  { id:6,at:55,offset:1330,type:'ceiling',layout:'lowbridge',label:'有限低桥 · 点按短喷',launch:34,hold:.025,ringX:0 },
  { id:7,at:63,offset:1640,type:'showcase',layout:'showcase',label:'开放表演 · 高环可选',launch:38,hold:.025,ringX:0 },
  { id:8,at:71,offset:1950,type:'gate',layout:'gate',label:'升降闸 · 短喷收势',launch:38,hold:.025,ringX:0 },
  { id:9,at:79,offset:2240,type:'gapCeiling',layout:'final',label:'最后组合 · 车阵 → 缺口 → 低桥',launch:38,hold:.55,ringX:0 },
]);
export function ratingFor(score) { return CHALLENGE.ratings.findLast(r => score >= r.min) ?? CHALLENGE.ratings[0]; }
