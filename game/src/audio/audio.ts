/**
 * Procedural WebAudio soundscape (no audio files → zero download, no licensing).
 * Rain on tall windows, the hall's low drone, footsteps, MM-01's heavy precise steps,
 * and tension stings tied to his state. Placeholder quality — a real sound pass is a later milestone.
 */
export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private tension!: GainNode;
  private tensionOsc: OscillatorNode[] = [];
  private pulse!: GainNode;
  private noiseBuf!: AudioBuffer;
  private pulseT = 0;
  private klaxonT = 0;
  private alarm = false;
  private creakT = 0;
  enabled = true;

  start(): void {
    if (this.ctx) return;
    const AC = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AC) return;
    const ctx = new AC();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = 0.7;
    this.master.connect(ctx.destination);
    // noise buffer
    const len = ctx.sampleRate * 2;
    this.noiseBuf = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;

    // Rain: filtered noise with slow gusts.
    const rain = ctx.createBufferSource();
    rain.buffer = this.noiseBuf;
    rain.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 1400;
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 300;
    const rg = ctx.createGain();
    rg.gain.value = 0.06;
    const gust = ctx.createOscillator();
    gust.frequency.value = 0.07;
    const gustG = ctx.createGain();
    gustG.gain.value = 0.025;
    gust.connect(gustG).connect(rg.gain);
    rain.connect(hp).connect(lp).connect(rg).connect(this.master);
    rain.start();
    gust.start();

    // Hall drone: two detuned low tones through a lowpass.
    const droneG = ctx.createGain();
    droneG.gain.value = 0.05;
    const dlp = ctx.createBiquadFilter();
    dlp.type = 'lowpass';
    dlp.frequency.value = 260;
    for (const f of [55, 55.4, 82.4]) {
      const o = ctx.createOscillator();
      o.type = 'sawtooth';
      o.frequency.value = f;
      o.connect(dlp);
      o.start();
    }
    dlp.connect(droneG).connect(this.master);

    // Tension bed: dissonant fifth that fades in with suspicion.
    this.tension = ctx.createGain();
    this.tension.gain.value = 0;
    const tlp = ctx.createBiquadFilter();
    tlp.type = 'lowpass';
    tlp.frequency.value = 900;
    for (const f of [146.8, 155.6, 220]) {
      const o = ctx.createOscillator();
      o.type = 'triangle';
      o.frequency.value = f;
      o.connect(tlp);
      o.start();
      this.tensionOsc.push(o);
    }
    tlp.connect(this.tension).connect(this.master);
    this.pulse = ctx.createGain();
    this.pulse.gain.value = 0;
    this.pulse.connect(this.master);
  }

  resume(): void {
    void this.ctx?.resume();
  }

  private burst(freq: number, q: number, gain: number, dur: number, type: BiquadFilterType = 'bandpass', pan = 0): void {
    const ctx = this.ctx;
    if (!ctx || !this.enabled) return;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = ctx.createGain();
    const t = ctx.currentTime;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.005);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    const p = ctx.createStereoPanner();
    p.pan.value = Math.max(-1, Math.min(1, pan));
    src.connect(f).connect(g).connect(p).connect(this.master);
    src.start(t, Math.random() * 1.5, dur + 0.05);
  }

  private tone(freq: number, gain: number, dur: number, type: OscillatorType = 'sine', slide = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const o = ctx.createOscillator();
    o.type = type;
    const t = ctx.currentTime;
    o.frequency.setValueAtTime(freq, t);
    if (slide) o.frequency.exponentialRampToValueAtTime(freq * slide, t + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(gain, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    o.connect(g).connect(this.master);
    o.start(t);
    o.stop(t + dur + 0.05);
  }

  leonStep(run: boolean, crouch: boolean, pan: number): void {
    this.burst(run ? 2200 : 1600, 1.2, crouch ? 0.03 : run ? 0.16 : 0.08, run ? 0.09 : 0.07, 'bandpass', pan);
    this.burst(180, 0.7, crouch ? 0.02 : 0.06, 0.08, 'lowpass', pan);
  }
  land(speed: number): void {
    this.burst(140, 0.8, Math.min(0.5, 0.1 + speed * 0.03), 0.22, 'lowpass');
    this.burst(2400, 1, 0.05, 0.08);
  }
  guardStep(dist: number, pan: number): void {
    const v = Math.max(0, 1 - dist / 22);
    if (v <= 0) return;
    this.burst(110, 0.9, 0.22 * v, 0.2, 'lowpass', pan);
    this.burst(3600, 6, 0.05 * v, 0.05, 'bandpass', pan); // metallic tick of the heel implant
  }
  sting(kind: 'suspicious' | 'chase' | 'search' | 'calm' | 'caught' | 'reveal' | 'hide' | 'checkpoint' | 'finish'): void {
    switch (kind) {
      case 'suspicious':
        this.tone(740, 0.08, 0.6, 'sine', 0.94);
        this.tone(1110, 0.04, 0.5, 'sine', 0.94);
        break;
      case 'chase':
        this.tone(98, 0.25, 0.9, 'sawtooth', 0.7);
        this.tone(1480, 0.05, 0.4, 'square', 0.5);
        break;
      case 'search':
        this.tone(523, 0.05, 0.8, 'triangle', 1.02);
        break;
      case 'calm':
        this.tone(392, 0.04, 1.2, 'sine', 1);
        break;
      case 'caught':
        this.tone(70, 0.35, 1.4, 'sawtooth', 0.6);
        this.burst(400, 0.5, 0.2, 0.6, 'lowpass');
        break;
      case 'reveal':
        this.tone(61.7, 0.3, 3.0, 'sawtooth', 0.98);
        this.tone(1975, 0.03, 2.4, 'sine', 0.99);
        break;
      case 'hide':
        this.burst(900, 2, 0.08, 0.18);
        break;
      case 'checkpoint':
        this.tone(659, 0.03, 0.8);
        this.tone(988, 0.02, 1.0);
        break;
      case 'finish':
        this.tone(196, 0.12, 3.5, 'triangle');
        this.tone(293.7, 0.08, 3.5, 'triangle');
        this.tone(392, 0.06, 3.5, 'sine');
        break;
    }
  }

  setAlarm(on: boolean): void {
    this.alarm = on;
  }
  slam(): void {
    this.burst(90, 0.7, 0.5, 0.5, 'lowpass');
    this.burst(1800, 3, 0.12, 0.2);
  }
  whoosh(): void {
    this.burst(900, 0.6, 0.12, 0.35, 'bandpass');
  }
  clank(): void {
    this.burst(2600, 8, 0.12, 0.15);
    this.burst(420, 2, 0.16, 0.25);
  }
  rumble(): void {
    this.burst(160, 1.2, 0.06, 0.18, 'lowpass');
  }
  /** Called every frame while the cages move. */
  creak(dt: number): void {
    this.creakT -= dt;
    if (this.creakT <= 0) {
      this.creakT = 0.22;
      this.burst(1200 + Math.random() * 600, 12, 0.05, 0.18);
      this.burst(220, 3, 0.05, 0.2, 'bandpass');
    }
  }
  mirrorBlip(): void {
    this.tone(1320, 0.05, 0.12, 'square');
    setTimeout(() => this.tone(1760, 0.05, 0.12, 'square'), 110);
  }

  update(dt: number, suspicion: number, chase: boolean): void {
    if (!this.ctx) return;
    if (this.alarm) {
      this.klaxonT -= dt;
      if (this.klaxonT <= 0) {
        this.klaxonT = 1.1;
        this.tone(440, 0.09, 0.5, 'sawtooth', 0.75);
      }
    }
    const t = this.ctx.currentTime;
    this.tension.gain.setTargetAtTime(Math.min(0.06, suspicion * 0.05) + (chase ? 0.03 : 0), t, 0.3);
    if (chase) {
      this.pulseT -= dt;
      if (this.pulseT <= 0) {
        this.pulseT = 0.42;
        this.tone(73.4, 0.22, 0.3, 'sine', 0.8);
      }
    }
  }
}
