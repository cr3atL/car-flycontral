import fs from 'node:fs';
import crypto from 'node:crypto';
import assert from 'node:assert/strict';
const base='https://cr3atl.github.io/car-flycontral/';
const manifest=JSON.parse(fs.readFileSync('docs/coastal-art-relative-production-files.json','utf8'));
const actions=JSON.parse(fs.readFileSync('docs/coastal-art-actions.json','utf8'));
assert(actions.runs.some(r=>r.conclusion==='success'&&r.jobs.every(j=>j.conclusion==='success')),'Pages deployment must succeed before verification');
const sha=b=>crypto.createHash('sha256').update(b).digest('hex');
const results=[];
let cursor=0;
await Promise.all(Array.from({length:6},async()=>{
  while(cursor<manifest.files.length){
    const expected=manifest.files[cursor++];
    const response=await fetch(new URL(expected.path,base),{cache:'no-store'});
    const b=Buffer.from(await response.arrayBuffer());
    const actual=sha(b);
    let kind=actual===expected.sha256?'exact':'mismatch';
    if(kind==='mismatch'&&/\.(html|json)$/.test(expected.path)){
      const local=fs.readFileSync('dist/'+expected.path,'utf8');
      if(b.toString('utf8').replace(/\r/g,'')===local.replace(/\r/g,'')){
        if(expected.path.endsWith('.json')) assert.deepEqual(JSON.parse(b.toString('utf8')),JSON.parse(local));
        kind='CRLF-only';
      }
    }
    results.push({path:expected.path,status:response.status,expected:expected.sha256,actual,bytes:b.length,kind,pass:response.ok&&kind!=='mismatch'});
  }
}));
results.sort((a,b)=>a.path.localeCompare(b.path));
const report={date:new Date().toISOString(),base,commit:actions.sha,account:actions.account,actions:actions.runs,
  resources:{total:results.length,passed:results.filter(r=>r.pass).length,exact:results.filter(r=>r.kind==='exact').length,lineEndingsOnly:results.filter(r=>r.kind==='CRLF-only').map(r=>r.path)},
  results,pass:results.every(r=>r.pass),ordinaryOnlinePlay:'Pending supervisor browser check'};
fs.writeFileSync('docs/coastal-art-deployment.json',JSON.stringify(report,null,2)+'\n');
console.log(JSON.stringify({commit:report.commit,resources:report.resources,failed:results.filter(r=>!r.pass).slice(0,8),pass:report.pass},null,2));
if(!report.pass)process.exitCode=1;
