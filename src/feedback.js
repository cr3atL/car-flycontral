import{hudNumber}from'./hud-model.js';
import { FEEDBACK as F } from './feedback-config.js';
import { FeedbackTimeline, EffectQuality, valueAt, easeOut } from './feedback-model.js';
import { scoreTier } from './score-config.js';
import { ScoreAudio } from './audio.js';
import { FeedbackParticles } from './particles.js';
import { landingDip } from './presentation-model.js';
const $ = id => document.getElementById(id);
const clamp = (x, a = 0, b = 1) => Math.max(a, Math.min(b, x));
const text = (element, value) => { const s = String(value); if (element.textContent === s) return; if (element.childNodes.length === 1 && element.firstChild.nodeType === 3) element.firstChild.data = s; else element.textContent = s; };
export class ScoreFeedback {
  constructor(storage, world) {
    this.storage = storage; this.world = world; this.preferences = { sound: true, quality: 'auto' };
    try { const saved = JSON.parse(storage?.getItem(F.preferencesKey) ?? 'null'); if (typeof saved?.sound === 'boolean') this.preferences.sound = saved.sound; if (['auto', 'rich', 'low'].includes(saved?.quality)) this.preferences.quality = saved.quality; } catch { /* Optional settings stay usable in memory. */ }
    this.motion = window.matchMedia('(prefers-reduced-motion: reduce)'); this.quality = new EffectQuality(this.preferences.quality, this.motion.matches);
    this.motion.addEventListener('change', () => { this.quality.reduced = this.motion.matches; this.syncSettings(); });
    this.audio = new ScoreAudio(this.preferences.sound); this.timeline = new FeedbackTimeline(); this.particles = new FeedbackParticles($('feedback-canvas'));
    this.phase = 'menu'; this.paused = false; this.lastSequence = -1; this.lastScore = null; this.now = 0;
    this.rowSlots = Array.from({ length: F.maxRows }, () => {
      const row = document.createElement('div'); row.className = 'score-row'; const name = document.createElement('span'), points = document.createElement('b'), multiplier = document.createElement('small'); row.append(name, points, multiplier); $('action-records').append(row); return { row, name, points, multiplier, id: null };
    });
    this.anchor = { x: innerWidth * .72, y: innerHeight * .4 }; this.target = { x: innerWidth * .83, y: 45 };
    for (const el of document.querySelectorAll('[data-sound]')) el.addEventListener('change', e => { this.preferences.sound = e.target.checked; this.audio.setEnabled(e.target.checked, e.isTrusted); this.saveSettings(); });
    for (const el of document.querySelectorAll('[data-effects]')) el.addEventListener('change', e => { this.preferences.quality = e.target.value; this.quality.mode = e.target.value; this.saveSettings(); });
    this.syncSettings(); this.reset();
  }
  setHudView(view,desktop){this.hudView=view;this.desktop=desktop;}
  saveSettings() { try { this.storage?.setItem(F.preferencesKey, JSON.stringify(this.preferences)); } catch { /* No modal or gameplay failure. */ } this.syncSettings(); }
  syncSettings() { for (const el of document.querySelectorAll('[data-sound]')) el.checked = this.preferences.sound; for (const el of document.querySelectorAll('[data-effects]')) el.value = this.preferences.quality; for (const el of document.querySelectorAll('[data-motion-note]')) el.textContent = this.quality.reduced ? '已尊重系统“减弱动态效果”' : '自动档会在持续低帧率时精简效果'; }
  unlock(event) { this.audio.unlock(Boolean(event?.isTrusted)); }
  reset(now = 0, total = 0) { this.timeline.reset(now, total); this.particles.clear(); this.audio.stop();this.audio.flight.reset();this.lastLanding=null; this.lastSupplyAt=-99;this.lastBufferAt=-99; this.lastScore = null; this.lastSequence = -1; this.now = now; for (const slot of this.rowSlots) { slot.id = null; slot.row.style.display = 'none'; } $('combo').style.opacity = 0; $('bank-flight').style.opacity = 0; $('obstacle-toast').style.opacity = 0; }
  suspend() { this.audio.stop(); this.timeline.muteQueued(); }
  anchors() { const rect=$('combo').getBoundingClientRect(),a=this.desktop&&!rect.width?$('pc-score-area').getBoundingClientRect():rect,b=$('total').getBoundingClientRect(); this.anchor.x = a.left + a.width * .5; this.anchor.y = a.top + 45; this.target.x = b.left + b.width * .5; this.target.y = b.top + b.height * .5; $('obstacle-toast').style.left = `${b.right}px`; $('obstacle-toast').style.top = `${b.bottom + 8}px`; }
  impact(now,landing=this.lastLanding) {return landingDip(now,landing,this.quality.reduced);}
  update(sim, session, frameMs) {
    const now = sim.time; this.now = now;this.lastLanding=sim.lastLanding;
    if (session.phase !== this.phase) { if (['menu', 'results'].includes(session.phase)) this.reset(now, sim.score.total); this.phase = session.phase; }
    if (session.phase === 'running') {
      if (this.lastScore !== sim.score) this.timeline.reset(now, 0);
      if (this.lastScore !== sim.score || this.lastSequence !== sim.score.sequence) { this.timeline.ingest(sim.score.journal, now); this.lastSequence = sim.score.sequence; this.lastScore = sim.score; }
      if (session.paused && !session.resuming && !this.paused) this.suspend();
      if (!session.paused) {
        if(sim.supplyNotice&&sim.supplyNotice.at>this.lastSupplyAt){this.lastSupplyAt=sim.supplyNotice.at;if(now-sim.supplyNotice.at<.3)this.audio.play({type:'supply',amount:sim.events.filter(e=>e.type==='supply'&&Math.abs(e.time-sim.supplyNotice.at)<.0001).reduce((v,e)=>v+e.amount,0)});}
        if(sim.buffer.startedAt!==null&&sim.buffer.startedAt>this.lastBufferAt){this.lastBufferAt=sim.buffer.startedAt;if(now-sim.buffer.startedAt<.3)this.audio.play({type:'buffer'});}
        this.quality.observe(frameMs);
        const due = this.timeline.tick(now); if (due.length) this.anchors();
        for (const e of due) { this.particles.emit(e, now, this.quality.effective, this.anchor); if (e.audio) this.audio.play(e); }
      } else {this.lastSupplyAt=sim.supplyNotice?.at??this.lastSupplyAt;this.lastBufferAt=sim.buffer.startedAt??this.lastBufferAt;}
    }
    this.audio.flight.update(sim,session.phase==='running'&&!session.paused&&!(session.mode==='sprint'&&session.sprint.complete),session.mode==='sprint');this.paused = session.paused;
    this.render(now); this.particles.draw(now, this.quality.effective, (x, y, z) => this.world.projectPoint(x, y, z)); this.audio.analyse();
  }
  render(now) {
    if(this.hudView){this.renderDesktop(now);return;}
    const t = this.timeline, low = this.quality.effective === 'low', visible = now < t.deadline && !(t.kind==='bank'&&now-t.bankAt<.18);
    const tier = scoreTier(t.amount), pane = $('combo');pane.removeAttribute('aria-hidden');
    pane.className = `${t.kind} ${tier.index === 4 ? 'is-rgb' : ''} ${t.kind === 'bank' && t.grade === 2 ? 'heavy' : ''} ${t.kind === 'bank' && !t.amount ? 'no-points' : ''}`;
    pane.style.opacity = visible ? clamp((t.deadline - now) / (F.duration - F.hold)) : 0;
    pane.style.visibility = visible ? 'visible' : 'hidden';
    pane.style.setProperty('--rgb-phase', low ? '45%' : `${now / 1.5 * 100 % 250}%`);
    const punchAge = now - t.punchAt; $('pending').style.transform = low || punchAge < 0 || punchAge > .35 ? 'scale(1)' : `scale(${1 + Math.sin(punchAge / .35 * Math.PI) * .14 * Math.exp(-punchAge * 3)})`;
    $('pending').classList.toggle('rgb', tier.index === 4); $('pending').style.color = tier.index === 4 ? '' : tier.color;
    const number = Math.max(0, Math.round(low ? t.amount : valueAt(t.number, now)));
    if (t.kind === 'score') { text($('combo-label'), `${tier.name} · 空中连击`); text($('pending'), number); text($('combo-detail'), `待结算 · 基础${t.base} ×${t.multiplier.toFixed(2)}`); }
    else if (t.kind === 'bank') { text($('combo-label'), ['精准落地', '稳定落地', '重落地'][t.grade] ?? '落地'); text($('pending'), `+${number}`); text($('combo-detail'), t.amount ? `×${t.factor.toFixed(1)} · ${t.amount} 已入账${this.lastLanding?.time===t.bankAt&&this.lastLanding.reason?' · '+this.lastLanding.reason:''}` : (this.lastLanding?.time===t.bankAt?this.lastLanding.reason:null)??'安全接地 · 继续回充'); }
    else if (t.kind === 'crash') { text($('combo-label'), '连击中断'); text($('pending'), '重试'); text($('combo-detail'), '当前待结算清除 · 已入账保留'); }
    const ids = new Set(t.rows.map(r => r.id));
    for (const slot of this.rowSlots) if (!ids.has(slot.id)) { slot.id = null; slot.row.style.display = 'none'; }
    for (let index = 0; index < t.rows.length; index++) {
      const r = t.rows[index]; let slot = this.rowSlots.find(s => s.id === r.id);
      if (!slot) { slot = this.rowSlots.find(s => s.id === null); if (!slot) continue; slot.id = r.id; const rt = scoreTier(r.tierScore); text(slot.name, r.label); text(slot.points, `+${r.points}`); text(slot.multiplier, `连击×${r.multiplier.toFixed(2)}`); slot.row.className = `score-row${rt.index === 4 ? ' rgb' : ''}`; slot.row.style.color = rt.index === 4 ? '' : rt.color; }
      const age = now - r.visibleAt; slot.row.style.display = visible && age >= 0 ? 'flex' : 'none'; slot.row.style.order = index;
      const progress = low ? 1 : easeOut(age / .18); slot.row.style.opacity = clamp(progress); slot.row.style.transform = `translateX(${(1 - progress) * 13}px) scale(${low ? 1 : 1 + Math.sin(clamp(age / .22) * Math.PI) * .025})`;
    }
    const total = Math.max(0, Math.round(low ? t.total.to : valueAt(t.total, now))); text($('total'), String(total).padStart(5, '0'));
    const bankAge = now - t.bankAt-.18, passAge = now - t.passAt;
    $('total').style.setProperty('--bank-glow', String(t.amount && bankAge >= 0 && bankAge < .75 ? (1 - bankAge / .75) : passAge >= 0 && passAge < .4 ? .25 : 0));
    const fly = $('bank-flight'), flying = !low && t.kind === 'bank' && t.amount > 0 && bankAge >= .08 && bankAge < F.bankDuration + .08;
    fly.style.opacity = flying ? Math.sin(clamp((bankAge - .08) / F.bankDuration) * Math.PI) : 0;
    if (flying) { this.anchors(); const p = easeOut((bankAge - .08) / F.bankDuration); text(fly, `+${t.amount}`); fly.className = tier.index === 4 ? 'rgb' : ''; fly.style.setProperty('--rgb-phase', `${now / 1.5 * 100 % 250}%`); fly.style.transform = `translate(${this.anchor.x + (this.target.x - this.anchor.x) * p}px,${this.anchor.y + (this.target.y - this.anchor.y) * p - Math.sin(p * Math.PI) * 25}px) scale(${1 - p * .45})`; }
    const passVisible = passAge >= 0 && passAge < .8;
    $('obstacle-toast').style.opacity = passVisible ? clamp((.8 - passAge) / .2) : 0; $('obstacle-toast').style.visibility = passVisible ? 'visible' : 'hidden'; if (t.passAmount) text($('obstacle-toast'), `+${t.passAmount} 障碍通过 · 已入账`);
  }
  renderDesktop(now){
    const v=this.hudView,c=v.combo,pane=$('combo'),tier=c.tier,low=this.quality.effective==='low',visible=c.visible;
    pane.setAttribute('aria-hidden',String(!visible));pane.className=`${v.state==='bank'||v.state==='result'?'bank':v.state==='crash'?'crash':'score'} ${tier.index===4?'is-rgb':''} ${c.weak?'preparing':''} ${c.countVisible?'':'result-only'}`;pane.style.opacity=visible?(c.weak?.34:1):0;pane.style.visibility=visible?'visible':'hidden';pane.style.setProperty('--rgb-phase',low?'45%':`${now/1.5*100%250}%`);
    text($('combo-label'),c.label+((v.state==='bank'||v.state==='result')&&c.reason?' · '+c.reason:(v.state==='air'&&c.multiplier>1?' ×'+c.multiplier:'')));text($('pending'),(v.state==='bank'?'+':'')+hudNumber(c.displayed));$('pending').style.transform='none';$('pending').classList.toggle('rgb',tier.index===4);$('pending').style.color=tier.index===4?'':tier.color;text($('combo-detail'),c.formula);
    for(let i=0;i<this.rowSlots.length;i++){const slot=this.rowSlots[i],r=(this.desktop?c.rows:c.rows.slice(-2))[i];if(!visible||!r){slot.row.style.display='none';slot.id=null;continue;}const rt=scoreTier(r.tierScore),age=now-r.visibleAt,progress=low?1:easeOut(age/.18);slot.id='pc:'+r.id;text(slot.name,r.label);text(slot.points,'+'+hudNumber(r.points));text(slot.multiplier,'');slot.row.className='score-row'+(rt.index===4?' rgb':'');slot.row.style.color=rt.index===4?'':rt.color;slot.row.style.display='flex';slot.row.style.order=i;slot.row.style.opacity=clamp(progress);slot.row.style.transform=`translateX(${(1-progress)*10}px)`;}
    text($('total'),hudNumber(v.displayedTotal));$('total').style.setProperty('--bank-glow',c.transfer!==null?Math.sin(c.transfer*Math.PI):0);
    const fly=$('bank-flight'),flying=visible&&c.transfer!==null&&!low;fly.style.opacity=flying?Math.sin(c.transfer*Math.PI):0;if(flying){this.anchors();const p=c.transfer;text(fly,'+'+hudNumber(c.amount));fly.className=tier.index===4?'rgb':'';fly.style.setProperty('--rgb-phase',`${now/1.5*100%250}%`);fly.style.transform=`translate(${this.anchor.x+(this.target.x-this.anchor.x)*p}px,${this.anchor.y+(this.target.y-this.anchor.y)*p}px) scale(${1-p*.4})`;}
    $('obstacle-toast').style.opacity=0;$('obstacle-toast').style.visibility='hidden';
  }
  snapshot() { return { hud:this.hudView??null,timeline: this.timeline.snapshot(this.now), particles: this.particles.snapshot(this.now), audio: this.audio.snapshot(), quality: this.quality.snapshot(), cameraImpact: this.impact(this.now), rowNodes: this.rowSlots.length, preferences: { ...this.preferences } }; }
}
