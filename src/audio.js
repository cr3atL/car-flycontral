import { FEEDBACK as F } from './feedback-config.js';
import { FlightAudio } from './flight-audio.js';
/** One lazy context, a fixed oscillator/gain pool, and a measured post-master signal. */
export class ScoreAudio {
  constructor(enabled = true) {
    this.enabled = enabled; this.context = null; this.voices = []; this.flight=new FlightAudio(this);this.blocked = false; this.unsupported = false; this.suspending = Promise.resolve();
    this.createdContexts = 0; this.peakVoices = 0; this.played = 0; this.dropped = 0; this.generation = 0;
    this.maxPeak = 0; this.peak = 0; this.rms = 0; this.nonzeroFrames = 0; this.clippedFrames = 0; this.lastEnvelope = null;
  }
  async unlock(trusted) {
    if (!trusted || !this.enabled || this.unsupported) return false;
    const generation = this.generation;
    try {
      if (!this.context) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        if (!AudioContext) { this.blocked = true; this.unsupported = true; return false; }
        this.context = new AudioContext({ latencyHint: 'interactive' }); this.createdContexts++;
        this.master = this.context.createGain(); this.master.gain.value = F.audioGain;
        this.analyser = this.context.createAnalyser(); this.analyser.fftSize = 512;
        this.master.connect(this.analyser); this.analyser.connect(this.context.destination); this.samples = new Float32Array(512);
        for (let i = 0; i < F.voices; i++) {
          const oscillator = this.context.createOscillator(), gain = this.context.createGain();
          oscillator.type = 'sine'; gain.gain.value = 0; oscillator.connect(gain); gain.connect(this.master); oscillator.start();
          this.voices.push({ oscillator, gain, until: 0 });
        }
      }
      await this.suspending;
      if (generation !== this.generation || !this.enabled) return false;
      if (this.context.state !== 'running') await this.context.resume();
      if (generation !== this.generation || !this.enabled) { this.stop(); return false; }
      this.blocked = this.context.state !== 'running';
      this.master.gain.setValueAtTime(this.enabled ? F.audioGain : 0, this.context.currentTime);
      return this.context.state === 'running';
    } catch { this.blocked = true; return false; }
  }
  setEnabled(value, trusted = false) { this.enabled = Boolean(value); this.stop(); if (value) this.unlock(trusted); }
  stop() {
    this.flight.stop();
    this.generation++;
    if (!this.context) return;
    const t = this.context.currentTime;
    this.master.gain.cancelScheduledValues(t); this.master.gain.setValueAtTime(0, t);
    for (const v of this.voices) { v.gain.gain.cancelScheduledValues(t); v.gain.gain.setValueAtTime(0, t); v.oscillator.frequency.cancelScheduledValues(t); v.until = 0; }
    if (this.context.state === 'running') this.suspending = this.context.suspend().catch(() => {});
  }
  tone(frequency, gain, seconds, offset = 0, glide = 1.04, attack = .008) {
    if (!this.enabled || this.blocked || this.context?.state !== 'running') return;
    const now = this.context.currentTime, voice = this.voices.find(v => v.until <= now);
    if (!voice) { this.dropped++; return; }
    const at = now + Math.min(.36, offset), duration = Math.min(F.maxToneSeconds, seconds), amplitude = Math.min(F.maxToneGain, gain);
    this.master.gain.setValueAtTime(F.audioGain, now);
    voice.oscillator.frequency.cancelScheduledValues(now); voice.oscillator.frequency.setValueAtTime(frequency, at); voice.oscillator.frequency.exponentialRampToValueAtTime(frequency * glide, at + duration);
    const envelope = voice.gain.gain; envelope.cancelScheduledValues(now); envelope.setValueAtTime(0, now); envelope.setValueAtTime(0, at); envelope.linearRampToValueAtTime(amplitude, at + attack); envelope.exponentialRampToValueAtTime(.0001, at + duration); envelope.setValueAtTime(0, at + duration + .005);
    voice.until = at + duration + .008; this.played++; this.peakVoices = Math.max(this.peakVoices, this.voices.filter(v => v.until > now).length);
    this.lastEnvelope = { frequency, amplitude, glide, attack, duration, at, end: voice.until };
  }
  play(event) {
    if(event.type==='supply'){if(event.amount<.1){this.tone(330,.012,.07);return;}this.tone(390,.035,.16);this.tone(585,.025,.12,.08);return;}
    if(event.type==='buffer'){this.tone(280,.025,.15);return;}
    if (event.type === 'action') {
      if (event.upgrade) { const notes = event.upgrade === 4 ? [660, 990, 1320] : [480 + event.upgrade * 70, 720 + event.upgrade * 70]; notes.forEach((n, i) => this.tone(n, .09, .18, i * .05)); }
      else this.tone(430 + event.tier * 75, .075, .12);
    } else if (event.type === 'bank') {
      if (event.amount) [660, 880, 1320].forEach((n, i) => this.tone(n, .075, .24, .27+i*.045));
    } else if (event.type === 'crash') { this.tone(92, .085, .24); this.tone(64, .06, .2, .05); }
    else if (event.type === 'pass') this.tone(520, .035, .08);
  }
  analyse() {
    if (!this.analyser || this.context.state !== 'running') { this.peak = this.rms = 0; return; }
    this.analyser.getFloatTimeDomainData(this.samples); let peak = 0, sum = 0;
    for (const x of this.samples) { peak = Math.max(peak, Math.abs(x)); sum += x * x; }
    this.peak = peak; this.rms = Math.sqrt(sum / this.samples.length); this.maxPeak = Math.max(this.maxPeak, peak);
    if (peak > .00005) this.nonzeroFrames++; if (peak >= .98) this.clippedFrames++;
  }
  snapshot() { return { flight:this.flight.snapshot(), enabled: this.enabled, state: this.blocked ? 'blocked' : this.context?.state ?? 'locked', contexts: this.createdContexts, voices: this.voices.length, active: this.context ? this.voices.filter(v => v.until > this.context.currentTime).length : 0, peakVoices: this.peakVoices, played: this.played, dropped: this.dropped, peak: this.peak, rms: this.rms, maxPeak: this.maxPeak, nonzeroFrames: this.nonzeroFrames, clippedFrames: this.clippedFrames, lastEnvelope: this.lastEnvelope }; }
}
