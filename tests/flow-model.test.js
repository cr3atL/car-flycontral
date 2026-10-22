import test from 'node:test';
import assert from 'node:assert/strict';
import {FlowModel} from '../src/flow-model.js';
import {GameSession} from '../src/challenge.js';
import {ratingFor} from '../src/challenge-config.js';
import {SCORE} from '../src/score-config.js';
const storage=value=>({value,getItem(){return this.value;},setItem(k,v){assert.equal(k,SCORE.bestKey);this.value=v;}});
function finish(old,score,reason='time',pending=0){const store=storage(old),s=new GameSession(store),m=new FlowModel();m.start(s.best);s.start('challenge');s.sim.score.total=score;s.sim.score.base=pending;s.stats.highestCombo=725;s.stats.groups=4;s.stats.precision=3;s.elapsed=90;s.finish(reason);return{view:m.result(s.result),session:s,store};}
test('first actual record has no invented historical delta',()=>{const {view,store}=finish(null,6500);assert.equal(view.record,'新纪录');assert.equal(store.value,'6500');assert.equal(view.grade,'B');});
test('new record compares current total with pre-finish record',()=>{const {view,session}=finish('6000',7100);assert.equal(session.best,7100);assert.equal(view.record,'新纪录  +1,100');assert.equal(view.score,7100);assert.deepEqual(view.stats,[['最高连击','725'],['精准落地','3'],['通过组','4 / 9']]);});
test('non-record and tie use actual best and never combo as score',()=>{assert.equal(finish('12000',7000).view.record,'距最佳 5,000  ·  最佳 12,000');assert.equal(finish('12000',12000).view.record,'距最佳 0  ·  最佳 12,000');});
test('zero with no previous record has no best claim',()=>{assert.equal(finish(null,0).view.record,'');});
test('unbanked points and repair exhaustion appear only when applicable',()=>{assert.equal(finish(null,0).view.notes,'');const r=finish(null,7000,'repairs',250).view;assert.equal(r.notes,'修复机会用尽 · 250 未落地入账');assert.equal(r.score,7000);});
test('a missing snapshot cannot produce a fabricated record delta',()=>{const {session}=finish('6000',7100);assert.doesNotMatch(new FlowModel().result(session.result).record,/新纪录|\+/);});
test('each challenge keeps an independent record snapshot',()=>{const m=new FlowModel();m.start(6000);const first=finish('6000',7100).session.result;assert.equal(m.result(first).record,'新纪录  +1,100');m.start(7100);const second=finish('7100',7500).session.result;assert.equal(m.result(second).record,'新纪录  +400');});
test('all existing inclusive grade boundaries retain their unique labels',()=>{const expected=[[0,'C','初次升空'],[6000,'B','渐入佳境'],[12000,'A','空中好手'],[20000,'S','特技大师'],[32000,'SS','极限驾驶者'],[45000,'SSS','不可能的驾驶']];for(let i=0;i<expected.length;i++){const [min,grade,label]=expected[i];assert.equal(ratingFor(min).grade,grade);assert.equal(ratingFor(min).label,label);if(i)assert.equal(ratingFor(min-1).grade,expected[i-1][1]);}});
test('Sprint frozen at final landing plus two seconds reaches ending without changing sim time',()=>{const m=new FlowModel(),landing={time:10};assert.equal(m.endingAge(landing,12,true,false,1000),2);assert.ok(m.endingAge(landing,12,true,false,1540)>=2.53);assert.equal(m.endingAge(landing,12,true,true,9000),2.54);m.start(0);assert.equal(m.endingAge({time:0},.2,false,false,9100),.2);});
