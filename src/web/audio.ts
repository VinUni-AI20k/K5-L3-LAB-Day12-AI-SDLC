// All sound is synthesised with WebAudio (no audio files, nothing to license). Volume comes from the saved settings.
type Sfx = "pickup" | "lit" | "pulse" | "hit" | "jump" | "dash" | "win" | "lose" | "shade" | "tick" | "charm" | "steal";

const PENTA = [0, 2, 4, 7, 9]; // major pentatonic degrees
const ROOTS: Record<1 | 2 | 3, number> = { 1: 220, 2: 196, 3: 174.61 }; // A3, G3, F3

export class GameAudio {
  private ctx?: AudioContext;
  private master?: GainNode;
  private musicTimer?: number;
  private volume = 0.7;

  /** Create the context on the first user gesture (browsers block it before that). */
  init(): void {
    if (this.ctx) { void this.ctx.resume(); return; }
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.ctx = new Ctor();
      this.master = this.ctx.createGain();
      this.master.connect(this.ctx.destination);
      this.setVolume(this.volume);
    } catch {
      this.ctx = undefined; // no audio available: the game stays silent
    }
  }

  setVolume(v: number): void {
    this.volume = v;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(v * 0.6, this.ctx.currentTime, 0.02);
  }

  private tone(freq: number, dur: number, type: OscillatorType, gain: number, slideTo?: number, delay = 0): void {
    if (!this.ctx || !this.master) return;
    const t0 = this.ctx.currentTime + delay;
    const o = this.ctx.createOscillator();
    const g = this.ctx.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, t0 + dur);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(this.master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  private noise(dur: number, gain: number, lowpass: number): void {
    if (!this.ctx || !this.master) return;
    const n = Math.floor(this.ctx.sampleRate * dur);
    const buf = this.ctx.createBuffer(1, n, this.ctx.sampleRate);
    const d = buf.getChannelData(0);
    for (let i = 0; i < n; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / n);
    const src = this.ctx.createBufferSource();
    src.buffer = buf;
    const f = this.ctx.createBiquadFilter();
    f.type = "lowpass";
    f.frequency.value = lowpass;
    const g = this.ctx.createGain();
    g.gain.value = gain;
    src.connect(f).connect(g).connect(this.master);
    src.start();
  }

  sfx(name: Sfx): void {
    if (!this.ctx) return;
    switch (name) {
      case "pickup": this.tone(880, 0.12, "sine", 0.25, 1320); break;
      case "lit": [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.5, "triangle", 0.25, undefined, i * 0.09)); break;
      case "pulse": this.tone(300, 0.45, "sine", 0.35, 1200); this.noise(0.3, 0.12, 3000); break;
      case "hit": this.tone(160, 0.35, "sawtooth", 0.3, 60); this.noise(0.2, 0.2, 800); break;
      case "jump": this.tone(330, 0.15, "square", 0.1, 660); break;
      case "dash": this.noise(0.18, 0.18, 2500); this.tone(500, 0.15, "triangle", 0.1, 900); break;
      case "win": [523, 659, 784, 1047, 1319].forEach((f, i) => this.tone(f, 0.6, "triangle", 0.28, undefined, i * 0.14)); break;
      case "lose": [392, 349, 311, 262].forEach((f, i) => this.tone(f, 0.7, "sawtooth", 0.15, undefined, i * 0.22)); break;
      case "shade": this.tone(110, 0.8, "sawtooth", 0.18, 70); break;
      case "tick": this.tone(1000, 0.08, "square", 0.12); break;
      case "charm": this.tone(660, 0.3, "triangle", 0.25, 1320); this.tone(990, 0.3, "triangle", 0.2, 1980, 0.1); break;
      case "steal": this.tone(700, 0.4, "triangle", 0.25, 200); break;
    }
  }

  /** Soft night music: a drone plus a slow random pentatonic melody, different root per night. */
  startMusic(night: 1 | 2 | 3): void {
    this.stopMusic();
    if (!this.ctx) return;
    const root = ROOTS[night];
    let beat = 0;
    const play = (): void => {
      if (beat % 8 === 0) this.tone(root / 2, 3.6, "sine", 0.12);
      if (beat % 2 === 0) {
        const deg = PENTA[Math.floor(Math.random() * PENTA.length)]!;
        this.tone(root * 2 ** (deg / 12) * (beat % 8 === 4 ? 2 : 1), 1.2, "triangle", 0.07);
      }
      beat++;
    };
    play();
    this.musicTimer = window.setInterval(play, 450);
  }

  stopMusic(): void {
    if (this.musicTimer !== undefined) window.clearInterval(this.musicTimer);
    this.musicTimer = undefined;
  }
}
