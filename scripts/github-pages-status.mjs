import {execFileSync} from 'node:child_process';
import fs from 'node:fs';

// Credentials stay in memory and are sent only to GitHub's API.
const raw = execFileSync('git', ['credential', 'fill'], {
  input: 'protocol=https\nhost=github.com\nusername=cr3atL\n\n', encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe']
});
const credential = Object.fromEntries(raw.trim().split(/\r?\n/).map(l=>{const i=l.indexOf('=');return [l.slice(0,i),l.slice(i+1)];}));
async function get(endpoint) {
  const r=await fetch('https://api.github.com'+endpoint,{headers:{Authorization:`Bearer ${credential.password}`,Accept:'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'}});
  if(!r.ok) throw new Error(`GitHub ${r.status}: ${endpoint}`);
  return r.json();
}
const user=await get('/user');
if(user.login.toLowerCase()!=='cr3atl')throw new Error('Unexpected GitHub account');
const repo=await get('/repos/cr3atL/car-flycontral');
if(!repo.permissions?.push)throw new Error('No repository push permission');
const sha=process.argv[2]??execFileSync('git',['rev-parse','HEAD'],{encoding:'utf8'}).trim();
const runs=await get('/repos/cr3atL/car-flycontral/actions/workflows/pages.yml/runs?per_page=15');
const matching=runs.workflow_runs.filter(r=>r.head_sha===sha);
const result={account:{login:user.login,id:user.id},repository:repo.full_name,push:repo.permissions.push,sha,runs:[]};
for(const r of matching) {
  const jobs=await get(`/repos/cr3atL/car-flycontral/actions/runs/${r.id}/jobs`);
  result.runs.push({id:r.id,url:r.html_url,status:r.status,conclusion:r.conclusion,event:r.event,createdAt:r.created_at,
    jobs:jobs.jobs.map(j=>({name:j.name,status:j.status,conclusion:j.conclusion,steps:j.steps.map(s=>({name:s.name,status:s.status,conclusion:s.conclusion}))}))});
}
if(process.argv[3])fs.writeFileSync(process.argv[3],JSON.stringify(result,null,2)+'\n');
console.log(JSON.stringify(result,null,2));
