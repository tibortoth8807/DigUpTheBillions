/** Tiny synthesized sound effects with the Web Audio API - no audio files to license or download. */
export type SoundName = 'dig' | 'junk' | 'beep' | 'bark' | 'win' | 'lose' | 'click' | 'siren' | 'swing';

export class Sounds {
  muted = false;
  private ctx: AudioContext | null = null;

  /** Must be called from a user gesture (browser autoplay rules). */
  unlock(): void {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) this.ctx = new AudioCtx();
    }
    void this.ctx?.resume();
  }

  play(name: SoundName, warmth = 0): void {
    if (this.muted || !this.ctx) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;

    switch (name) {
      case 'click':
        this.tone(660, now, 0.05, 'square', 0.05);
        break;
      case 'dig':
        this.noise(now, 0.18, 500, 0.5);
        this.tone(90, now, 0.15, 'sine', 0.35, 50);
        break;
      case 'junk':
        this.noise(now, 0.15, 500, 0.4);
        this.tone(1200, now + 0.12, 0.08, 'triangle', 0.15);
        this.tone(1500, now + 0.2, 0.1, 'triangle', 0.12);
        break;
      case 'beep': {
        const count = warmth + 1;
        for (let i = 0; i < count; i++) {
          this.tone(500 + warmth * 260, now + i * (0.18 - warmth * 0.03), 0.07, 'square', 0.08);
        }
        break;
      }
      case 'bark':
        this.tone(520, now, 0.09, 'sawtooth', 0.12, 260);
        this.tone(560, now + 0.16, 0.09, 'sawtooth', 0.12, 280);
        break;
      case 'win':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, now + i * 0.11, 0.22, 'triangle', 0.18));
        this.noise(now + 0.45, 0.4, 3000, 0.08);
        break;
      case 'siren':
        // distant two-tone, quieter than the final one
        this.tone(780, now, 0.22, 'square', 0.03);
        this.tone(620, now + 0.25, 0.22, 'square', 0.03);
        break;
      case 'swing':
        this.noise(now, 0.12, 1800, 0.12);
        break;
      case 'lose':
        // two-tone siren
        for (let i = 0; i < 4; i++) {
          this.tone(i % 2 ? 620 : 780, now + i * 0.28, 0.26, 'square', 0.07);
        }
        break;
    }
  }

  private tone(freq: number, start: number, duration: number, type: OscillatorType, volume: number, endFreq?: number): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, start);
    if (endFreq) osc.frequency.exponentialRampToValueAtTime(endFreq, start + duration);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration + 0.02);
  }

  private noise(start: number, duration: number, cutoff: number, volume: number): void {
    const ctx = this.ctx!;
    const buffer = ctx.createBuffer(1, Math.floor(ctx.sampleRate * duration), ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    const source = ctx.createBufferSource();
    source.buffer = buffer;
    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = cutoff;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    source.connect(filter).connect(gain).connect(ctx.destination);
    source.start(start);
  }
}
