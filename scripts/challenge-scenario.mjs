import { runChallengeScenario } from '../src/challenge-scenario.js';
const routes = { safe: {}, rewards: { rewards: true }, dual: { combo: true }, dualRewards: { combo: true, rewards: true } };
const variants = Object.fromEntries(Object.entries(routes).map(([name, options]) => [name, runChallengeScenario(options)]));
console.log(JSON.stringify(Object.fromEntries(Object.entries(variants).map(([name, v]) => [name, { result: v.result, groups: v.groups.map(g => ({ id: g.id, status: g.status, spawnTime: g.spawnTime, z: g.z, end: g.end })) }])), null, 2));
if (process.argv.includes('--write')) { const { writeFile } = await import('node:fs/promises'); await writeFile(new URL('../docs/continuous-challenge-trace.json', import.meta.url), JSON.stringify(variants, null, 2)); }
