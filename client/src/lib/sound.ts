/**
 * Web Audio API Sound Effects Synthesizer
 * Zero network dependencies, zero asset loading, ultra-low latency.
 * Fully compatible with iOS Safari, Android Chrome, and Telegram WebApp.
 */

class SoundManager {
  private ctx: AudioContext | null = null;
  private enabled: boolean = true;

  constructor() {
    // Load persisted sound setting
    try {
      const saved = localStorage.getItem('clicketoken_sfx_enabled');
      if (saved !== null) {
        this.enabled = saved === 'true';
      }
    } catch {
      this.enabled = true;
    }
  }

  private getContext(): AudioContext | null {
    if (!this.enabled) return null;
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public isSoundEnabled(): boolean {
    return this.enabled;
  }

  public setSoundEnabled(enabled: boolean) {
    this.enabled = enabled;
    try {
      localStorage.setItem('clicketoken_sfx_enabled', String(enabled));
    } catch {}
  }

  public toggleSound(): boolean {
    const next = !this.enabled;
    this.setSoundEnabled(next);
    if (next) {
      this.playCoinTap();
    }
    return next;
  }

  public playClick() {
    this.playCoinTap();
  }

  /**
   * 1. Soft Tactile Coin Tap
   * Snappy acoustic pop with quick exponential frequency decay (540Hz -> 1080Hz)
   */
  public playCoinTap() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      // Pitch envelope: pleasant bell-like micro click
      osc.frequency.setValueAtTime(560, now);
      osc.frequency.exponentialRampToValueAtTime(1120, now + 0.02);
      osc.frequency.exponentialRampToValueAtTime(280, now + 0.05);

      gain.gain.setValueAtTime(0.25, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.07);
    } catch {}
  }

  /**
   * 2. Supersonic Jet Whoosh & Sonic Boom
   * Filtered noise sweep + low punch on ring pass
   */
  public playRingPass() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;

      // Tone punch
      const osc = ctx.createOscillator();
      const oscGain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(220, now);
      osc.frequency.exponentialRampToValueAtTime(880, now + 0.15);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.35);

      oscGain.gain.setValueAtTime(0.3, now);
      oscGain.gain.exponentialRampToValueAtTime(0.001, now + 0.35);

      osc.connect(oscGain);
      oscGain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.36);

      // Noise whoosh
      const bufferSize = ctx.sampleRate * 0.3;
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }

      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(600, now);
      filter.frequency.exponentialRampToValueAtTime(3200, now + 0.15);
      filter.frequency.exponentialRampToValueAtTime(400, now + 0.3);
      filter.Q.value = 3.0;

      const noiseGain = ctx.createGain();
      noiseGain.gain.setValueAtTime(0.25, now);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      whiteNoise.connect(filter);
      filter.connect(noiseGain);
      noiseGain.connect(ctx.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.32);
    } catch {}
  }

  /**
   * 3. Rocket Collision Crunch & Warning Alarm
   */
  public playRocketHit() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(140, now);
      osc.frequency.exponentialRampToValueAtTime(45, now + 0.25);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.3);
    } catch {}
  }

  /**
   * 4. Roulette Wheel Mechanical Tick
   */
  public playWheelTick() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'triangle';
      osc.frequency.setValueAtTime(1400, now);
      osc.frequency.exponentialRampToValueAtTime(300, now + 0.02);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.03);
    } catch {}
  }

  /**
   * 5. Victory Fanfare (Celebratory Major Arpeggio)
   * C5 -> E5 -> G5 -> C6
   */
  public playVictoryFanfare() {
    const ctx = this.getContext();
    if (!ctx) return;

    try {
      const notes = [523.25, 659.25, 783.99, 1046.5]; // C5, E5, G5, C6
      const now = ctx.currentTime;

      notes.forEach((freq, idx) => {
        const noteStart = now + idx * 0.1;
        const noteDuration = idx === notes.length - 1 ? 0.6 : 0.15;

        const osc = ctx.createOscillator();
        const gain = ctx.createGain();

        osc.type = 'sine';
        osc.frequency.setValueAtTime(freq, noteStart);

        gain.gain.setValueAtTime(0, noteStart);
        gain.gain.linearRampToValueAtTime(0.25, noteStart + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.001, noteStart + noteDuration);

        osc.connect(gain);
        gain.connect(ctx.destination);

        osc.start(noteStart);
        osc.stop(noteStart + noteDuration + 0.05);
      });
    } catch {}
  }

  /**
   * 6. Penalty Kick Impact
   */
  public playPenaltyKick() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(180, now);
      osc.frequency.exponentialRampToValueAtTime(40, now + 0.18);

      gain.gain.setValueAtTime(0.4, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.2);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.21);
    } catch {}
  }

  /**
   * 7. Case Roulette Tick
   */
  public playCaseTick() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(950, now);
      osc.frequency.exponentialRampToValueAtTime(220, now + 0.02);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.025);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now);
      osc.stop(now + 0.03);
    } catch {}
  }

  public playSuccess() {
    this.playVictoryFanfare();
  }

  public playPop() {
    this.playCaseTick();
  }

  public playWhoosh() {
    this.playRingPass();
  }

  public playScratch() {
    const ctx = this.getContext();
    if (!ctx) return;
    try {
      const now = ctx.currentTime;
      const bufferSize = Math.floor(ctx.sampleRate * 0.04);
      const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const output = noiseBuffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1;
      }
      const whiteNoise = ctx.createBufferSource();
      whiteNoise.buffer = noiseBuffer;

      const filter = ctx.createBiquadFilter();
      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(2500 + Math.random() * 800, now);
      filter.Q.value = 4.0;

      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.08, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);

      whiteNoise.connect(filter);
      filter.connect(gain);
      gain.connect(ctx.destination);

      whiteNoise.start(now);
      whiteNoise.stop(now + 0.04);
    } catch {}
  }

  // ----------------------------------------------------
  // Procedural Synthwave / Cyberpunk Ambient BGM
  // ----------------------------------------------------

  private bgmPlaying: boolean = false;
  private bgmTimer: any = null;
  private bgmStep: number = 0;
  private bgmMasterGain: GainNode | null = null;

  public isBgmPlaying(): boolean {
    return this.bgmPlaying;
  }

  public setBgmEnabled(enabled: boolean) {
    if (enabled && !this.bgmPlaying) {
      this.startBgm();
    } else if (!enabled && this.bgmPlaying) {
      this.stopBgm();
    }
  }

  public toggleBgm(): boolean {
    if (this.bgmPlaying) {
      this.stopBgm();
      return false;
    } else {
      this.startBgm();
      return true;
    }
  }

  public startBgm() {
    const ctx = this.getContext();
    if (!ctx) return;
    if (this.bgmPlaying) return;

    this.bgmPlaying = true;
    try {
      localStorage.setItem('clicketoken_bgm_enabled', 'true');
    } catch {}

    // Master BGM gain
    if (!this.bgmMasterGain) {
      this.bgmMasterGain = ctx.createGain();
      this.bgmMasterGain.gain.setValueAtTime(0.12, ctx.currentTime);
      this.bgmMasterGain.connect(ctx.destination);
    }

    // Synthwave Arpeggio pattern in A minor (A minor / F maj7 / C maj / G)
    // Notes: A2, C3, E3, A3, B3, C4, E4, G4
    const chords = [
      { bass: 55, arp: [220, 261.63, 329.63, 440, 329.63, 261.63, 220, 164.81] }, // Am
      { bass: 43.65, arp: [174.61, 220, 261.63, 349.23, 261.63, 220, 174.61, 130.81] }, // F
      { bass: 65.41, arp: [261.63, 329.63, 392, 523.25, 392, 329.63, 261.63, 196] }, // C
      { bass: 48.99, arp: [196, 246.94, 293.66, 392, 293.66, 246.94, 196, 146.83] }, // G
    ];

    const stepDuration = 220; // ms per 16th note arpeggio
    this.bgmStep = 0;

    const playBgmTick = () => {
      if (!this.bgmPlaying) return;
      const actx = this.getContext();
      if (!actx || !this.bgmMasterGain) return;

      const chordIdx = Math.floor(this.bgmStep / 8) % chords.length;
      const noteIdx = this.bgmStep % 8;
      const currentChord = chords[chordIdx];

      const now = actx.currentTime;

      // Play deep analog bass drone at start of chord
      if (noteIdx === 0) {
        try {
          const bassOsc = actx.createOscillator();
          const bassFilter = actx.createBiquadFilter();
          const bassGain = actx.createGain();

          bassOsc.type = 'sawtooth';
          bassOsc.frequency.setValueAtTime(currentChord.bass, now);

          bassFilter.type = 'lowpass';
          bassFilter.frequency.setValueAtTime(140, now);
          bassFilter.frequency.exponentialRampToValueAtTime(320, now + 0.4);
          bassFilter.frequency.exponentialRampToValueAtTime(120, now + 1.6);

          bassGain.gain.setValueAtTime(0, now);
          bassGain.gain.linearRampToValueAtTime(0.22, now + 0.08);
          bassGain.gain.exponentialRampToValueAtTime(0.001, now + 1.7);

          bassOsc.connect(bassFilter);
          bassFilter.connect(bassGain);
          bassGain.connect(this.bgmMasterGain);

          bassOsc.start(now);
          bassOsc.stop(now + 1.75);
        } catch {}
      }

      // Play neon arpeggio pluck
      try {
        const arpFreq = currentChord.arp[noteIdx];
        const arpOsc = actx.createOscillator();
        const arpFilter = actx.createBiquadFilter();
        const arpGain = actx.createGain();

        arpOsc.type = 'triangle';
        arpOsc.frequency.setValueAtTime(arpFreq, now);

        arpFilter.type = 'lowpass';
        arpFilter.frequency.setValueAtTime(1200, now);
        arpFilter.frequency.exponentialRampToValueAtTime(450, now + 0.2);

        arpGain.gain.setValueAtTime(0, now);
        arpGain.gain.linearRampToValueAtTime(0.18, now + 0.015);
        arpGain.gain.exponentialRampToValueAtTime(0.001, now + 0.22);

        arpOsc.connect(arpFilter);
        arpFilter.connect(arpGain);
        arpGain.connect(this.bgmMasterGain);

        arpOsc.start(now);
        arpOsc.stop(now + 0.25);
      } catch {}

      this.bgmStep++;
    };

    // Trigger initial tick and loop
    playBgmTick();
    this.bgmTimer = setInterval(playBgmTick, stepDuration);
  }

  public stopBgm() {
    this.bgmPlaying = false;
    if (this.bgmTimer) {
      clearInterval(this.bgmTimer);
      this.bgmTimer = null;
    }
    try {
      localStorage.setItem('clicketoken_bgm_enabled', 'false');
    } catch {}
  }
}

export const soundManager = new SoundManager();
