import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
const files=[];
function visit(dir){for(const f of fs.readdirSync(dir,{withFileTypes:true})){const p=path.posix.join(dir,f.name);if(f.isDirectory())visit(p);else{const b=fs.readFileSync(p);files.push({path:p.slice(5),bytes:b.length,sha256:crypto.createHash('sha256').update(b).digest('hex')});}}}
visit('dist');
const record={date:new Date().toISOString(),command:'npm run build -- --base=./',exitCode:0,
  note:'Independent release build with the same relative base as GitHub Actions. Prior 6L2jcyue candidate used the default root base; historical receipts remain unchanged.',
  files,totalBytes:files.reduce((s,f)=>s+f.bytes,0)};
fs.writeFileSync('docs/coastal-art-relative-production-files.json',JSON.stringify(record,null,2)+'\n');
console.log(JSON.stringify({files:files.length,bytes:record.totalBytes,bundle:files.find(f=>/roadster-.*\.js$/.test(f.path))},null,2));
