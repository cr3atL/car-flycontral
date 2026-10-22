import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { pathToFileURL } from 'node:url';
import { resolve } from 'node:path';

// Offline legal-input regression only. This does not operate the browser.
const baselinePath = 'docs/parking-supervisor-physics-before.json';
const fields = s => ({
  x:s.x,y:s.y,z:s.z,vx:s.vx,vy:s.vy,speed:s.speed,
  pitch:s.pitch,roll:s.roll,yaw:s.yaw,heading:s.heading,
  omega:Object.fromEntries(['pitch','roll','yaw'].map(n=>[n,s.attitude[n].omega])),
  pressure:s.mainPressure,supply:s.airSupplyUsed,total:s.score.total,
  pending:s.score.pending,grounded:s.grounded,crashes:s.crashes,
  buffer:{...s.buffer},landingCount:s.landingCount
});
function trace(Simulation, scenario) {
  const s=new Simulation();s.environment={hasGround:()=>true};const samples=[];
  for(let i=0;i<960;i++){
    const t=i/120;
    s.input={steer:0,boost:t>=1&&t<(scenario===2?1.35:1.9),pitch:0,roll:0,yaw:0};
    if(scenario===0&&t>=2&&t<2.6)Object.assign(s.input,{roll:1,pitch:-1,yaw:1});
    if(scenario===1&&t>=2&&t<2.4)Object.assign(s.input,{roll:-1,yaw:-1});
    if(scenario===1&&t>=2.4&&t<2.8)Object.assign(s.input,{roll:1,yaw:1});
    if(scenario===2&&t>=1.8&&t<2.1)s.input.pitch=1;
    s.step(1/120);
    if(i%12===11)samples.push(fields(s));
  }
  return samples;
}
if(process.argv.includes('--record')){
  const source=execFileSync('git',['show','9667aca:src/simulation.js'],{encoding:'utf8'}).replace(/from\s*(['"])(\.\/[^'"]+)\1/g,(_,q,p)=>'from '+JSON.stringify(pathToFileURL(resolve('src',p)).href));
  const {Simulation}=await import('data:text/javascript;base64,'+Buffer.from(source).toString('base64'));
  const records=[0,1,2].map(n=>trace(Simulation,n));
  await writeFile(baselinePath,JSON.stringify({commit:'9667aca',method:'Offline legal-input fixed-step flat-road diagnostic; not native play.',records},null,2)+'\n');
  console.log(JSON.stringify({recorded:240,baseline:baselinePath}));
}else{
  const baseline=JSON.parse(await readFile(baselinePath,'utf8'));
  const {Simulation}=await import('../src/simulation.js');
  const records=[0,1,2].map(n=>trace(Simulation,n));
  const mismatches=[];
  for(let r=0;r<records.length;r++)for(let n=0;n<records[r].length;n++)if(JSON.stringify(records[r][n])!==JSON.stringify(baseline.records[r][n]))mismatches.push({scenario:r,sample:n,before:baseline.records[r][n],after:records[r][n]});
  const report={baselineCommit:baseline.commit,method:baseline.method,samples:240,mismatches};
  await writeFile('docs/parking-supervisor-physics-comparison.json',JSON.stringify(report,null,2)+'\n');
  console.log(JSON.stringify({samples:240,mismatches:mismatches.length}));
  if(mismatches.length)process.exitCode=1;
}
