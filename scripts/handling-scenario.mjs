import { Simulation } from '../src/simulation.js';
import { handlingScenario } from '../src/scenarios.js';
const result = handlingScenario(new Simulation());
console.log(JSON.stringify({ maxima: result.maxima, landing: result.end.lastLanding, total: result.end.total, events: result.end.events, finalPose: { pitch: result.end.pitch, roll: result.end.roll, omega: result.end.angularVelocity } }, null, 2));
if (process.argv.includes('--write')) {
  const { writeFile } = await import('node:fs/promises');
  await writeFile(new URL('../docs/continuous-handling-trace.json', import.meta.url), JSON.stringify(result, null, 2));
}
