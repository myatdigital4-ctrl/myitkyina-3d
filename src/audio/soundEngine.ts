// Zero-dependency Procedural Web Audio Synthesizer & E-Bike Music Player for Myitkyina Open World

export type MusicTrackId = 'off' | 'sample1' | 'sample2' | 'custom';

export const MUSIC_TRACK_LABELS: Record<MusicTrackId, string> = {
  off: 'သီချင်းပိတ်ထားသည် (Music Off)',
  sample1: '🎵 သီချင်း (၁) — မြစ်ကြီးနား မနောမြေ (Manau Groove)',
  sample2: '🎵 သီချင်း (၂) — စီတာပူ လေပြည် (Sitapu E-Bike Pop)',
  custom: '🎵 ကိုယ်ပိုင်သီချင်း (Custom Song)',
};

class SoundEngine {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;
  private lastStepTime: number = 0;

  // Built-in E-Bike & Festival Music Sequencer + Custom Audio File Player
  private currentTrack: MusicTrackId = 'off';
  private seqTimer: number | null = null;
  private stepIdx: number = 0;
  private customAudio: HTMLAudioElement | null = null;
  private customSongName: string = 'ကိုယ်ပိုင်သီချင်း (Custom MP3)';

  // Volume buses (set from the Settings menu)
  private musicBus: GainNode | null = null;
  private sfxBus: GainNode | null = null;
  private musicVolume = 0.7;
  private sfxVolume = 0.85;

  public setVolumes(music: number, sfx: number) {
    this.musicVolume = music;
    this.sfxVolume = sfx;
    if (this.musicBus) this.musicBus.gain.value = music;
    if (this.sfxBus) this.sfxBus.gain.value = sfx;
    if (this.customAudio) this.customAudio.volume = 0.9 * music;
  }

  private ensureContext(): AudioContext | null {
    if (this.isMuted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        this.musicBus = this.ctx.createGain();
        this.musicBus.gain.value = this.musicVolume;
        this.musicBus.connect(this.ctx.destination);
        this.sfxBus = this.ctx.createGain();
        this.sfxBus.gain.value = this.sfxVolume;
        this.sfxBus.connect(this.ctx.destination);
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public setMuted(muted: boolean) {
    this.isMuted = muted;
    if (muted) {
      if (this.customAudio) this.customAudio.pause();
    } else if (this.currentTrack === 'custom' && this.customAudio) {
      this.customAudio.play().catch(() => {});
    }
  }

  public getMuted(): boolean {
    return this.isMuted;
  }

  public getCurrentTrack(): MusicTrackId {
    return this.currentTrack;
  }

  public getCurrentTrackLabel(): string {
    if (this.currentTrack === 'custom') {
      return `🎵 ${this.customSongName}`;
    }
    return MUSIC_TRACK_LABELS[this.currentTrack];
  }

  public hasCustomSong(): boolean {
    return Boolean(this.customAudio);
  }

  // Load a user-selected MP3 / WAV / M4A file for the E-Bike Music Player
  public loadCustomSongFile(file: File) {
    if (typeof window === 'undefined') return;
    if (this.customAudio) {
      this.customAudio.pause();
      URL.revokeObjectURL(this.customAudio.src);
    }
    const url = URL.createObjectURL(file);
    const audio = new Audio(url);
    audio.loop = true;
    audio.volume = 0.9 * this.musicVolume;
    this.customAudio = audio;
    this.customSongName = file.name.replace(/\.[^/.]+$/, '').slice(0, 28) || 'Custom Song';
    this.playMusicTrack('custom');
  }

  public playMusicTrack(track: MusicTrackId) {
    if (this.seqTimer !== null && typeof window !== 'undefined') {
      window.clearInterval(this.seqTimer);
      this.seqTimer = null;
    }
    if (this.customAudio) {
      this.customAudio.pause();
    }

    this.currentTrack = track;
    this.stepIdx = 0;

    if (track === 'off') {
      return;
    }

    if (track === 'custom') {
      if (this.customAudio && !this.isMuted) {
        this.customAudio.currentTime = 0;
        this.customAudio.play().catch(() => {});
      }
      return;
    }

    // Start procedural multi-instrument music loop for Sample 1 or Sample 2
    this.ensureContext();
    const stepMs = track === 'sample1' ? 210 : 190; // ~142 BPM eighth-notes / ~158 BPM
    if (typeof window !== 'undefined') {
      this.playSequencerStep();
      this.seqTimer = window.setInterval(() => {
        this.playSequencerStep();
      }, stepMs);
    }
  }

  public cycleMusicTrack(): MusicTrackId {
    const order: MusicTrackId[] = this.customAudio
      ? ['sample1', 'sample2', 'custom', 'off']
      : ['sample1', 'sample2', 'off'];
    const idx = order.indexOf(this.currentTrack);
    const next = order[(idx + 1) % order.length];
    this.playMusicTrack(next);
    return next;
  }

  private playSequencerStep() {
    if (this.isMuted || (this.currentTrack !== 'sample1' && this.currentTrack !== 'sample2')) {
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const step = this.stepIdx % 32;
    this.stepIdx++;

    if (this.currentTrack === 'sample1') {
      // =====================================================================
      // SAMPLE SONG 1: "မြစ်ကြီးနား မနောမြေ" (Traditional Kachin Manau Groove)
      // Joyful Highland Pentatonic Bamboo Flute + Warm Gong Bass + Festival Drum
      // =====================================================================
      const melody = [
        523.25, 659.25, 783.99, 880.0, 1046.5, 880.0, 783.99, 659.25,
        587.33, 659.25, 783.99, 659.25, 587.33, 523.25, 440.0, 523.25,
        659.25, 783.99, 880.0, 1046.5, 1174.66, 1046.5, 880.0, 783.99,
        659.25, 783.99, 659.25, 587.33, 523.25, 523.25, 0, 523.25,
      ];
      const bass = [
        130.81, 0, 130.81, 196.0, 146.83, 0, 146.83, 220.0,
        164.81, 0, 164.81, 246.94, 130.81, 196.0, 130.81, 0,
      ];

      const leadFreq = melody[step];
      if (leadFreq > 0) {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(leadFreq, now);
        // Gentle flute vibrato
        osc.frequency.exponentialRampToValueAtTime(leadFreq * 1.008, now + 0.16);

        gain.gain.setValueAtTime(0.001, now);
        gain.gain.linearRampToValueAtTime(0.075, now + 0.025);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.19);

        osc.connect(gain);
        gain.connect(this.musicBus ?? ctx.destination);
        osc.start(now);
        osc.stop(now + 0.2);
      }

      const bassFreq = bass[step % 16];
      if (bassFreq > 0) {
        const bOsc = ctx.createOscillator();
        const bGain = ctx.createGain();
        bOsc.type = 'sine';
        bOsc.frequency.setValueAtTime(bassFreq, now);
        bOsc.frequency.exponentialRampToValueAtTime(bassFreq * 0.85, now + 0.18);

        bGain.gain.setValueAtTime(0.09, now);
        bGain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

        bOsc.connect(bGain);
        bGain.connect(this.musicBus ?? ctx.destination);
        bOsc.start(now);
        bOsc.stop(now + 0.2);
      }

      // Ceremonial Gong shimmer on every 8th beat
      if (step % 8 === 0) {
        const gOsc = ctx.createOscillator();
        const gGain = ctx.createGain();
        gOsc.type = 'sine';
        gOsc.frequency.setValueAtTime(261.63, now);
        gGain.gain.setValueAtTime(0.055, now);
        gGain.gain.exponentialRampToValueAtTime(0.0005, now + 0.55);
        gOsc.connect(gGain);
        gGain.connect(this.musicBus ?? ctx.destination);
        gOsc.start(now);
        gOsc.stop(now + 0.58);
      }
    } else {
      // =====================================================================
      // SAMPLE SONG 2: "စီတာပူ လေပြည်" (Sitapu E-Bike Modern Chill Pop Beat)
      // Catchy Synth-Guitar Pluck + Warm Sub-Bass + Crisp Riding Groove
      // =====================================================================
      const popMelody = [
        659.25, 0, 783.99, 880.0, 0, 783.99, 659.25, 587.33,
        523.25, 587.33, 659.25, 0, 783.99, 0, 659.25, 0,
        698.46, 0, 880.0, 1046.5, 0, 880.0, 783.99, 659.25,
        587.33, 659.25, 783.99, 659.25, 523.25, 0, 523.25, 0,
      ];
      const popBass = [
        110.0, 110.0, 0, 110.0, 130.81, 130.81, 0, 130.81,
        146.83, 146.83, 0, 146.83, 130.81, 0, 196.0, 0,
      ];

      const note = popMelody[step];
      if (note > 0) {
        const osc = ctx.createOscillator();
        const filter = ctx.createBiquadFilter();
        const gain = ctx.createGain();

        osc.type = 'sawtooth';
        osc.frequency.setValueAtTime(note, now);

        filter.type = 'lowpass';
        filter.frequency.setValueAtTime(2200, now);
        filter.frequency.exponentialRampToValueAtTime(480, now + 0.16);

        gain.gain.setValueAtTime(0.06, now);
        gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.17);

        osc.connect(filter);
        filter.connect(gain);
        gain.connect(this.musicBus ?? ctx.destination);
        osc.start(now);
        osc.stop(now + 0.18);
      }

      const sub = popBass[step % 16];
      if (sub > 0) {
        const sOsc = ctx.createOscillator();
        const sGain = ctx.createGain();
        sOsc.type = 'triangle';
        sOsc.frequency.setValueAtTime(sub, now);
        sGain.gain.setValueAtTime(0.085, now);
        sGain.gain.exponentialRampToValueAtTime(0.001, now + 0.16);
        sOsc.connect(sGain);
        sGain.connect(this.musicBus ?? ctx.destination);
        sOsc.start(now);
        sOsc.stop(now + 0.17);
      }

      // Kick drum pulse on 4-on-the-floor beats
      if (step % 4 === 0) {
        const kOsc = ctx.createOscillator();
        const kGain = ctx.createGain();
        kOsc.type = 'sine';
        kOsc.frequency.setValueAtTime(125, now);
        kOsc.frequency.exponentialRampToValueAtTime(38, now + 0.11);
        kGain.gain.setValueAtTime(0.11, now);
        kGain.gain.exponentialRampToValueAtTime(0.001, now + 0.12);
        kOsc.connect(kGain);
        kGain.connect(this.musicBus ?? ctx.destination);
        kOsc.start(now);
        kOsc.stop(now + 0.13);
      }
    }
  }

  // Kachin Manau Sacred Gong & Drum strike
  public playManauGong() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const freqs = [110, 165, 247.5, 330, 462];
    freqs.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(f, now);
      osc.frequency.exponentialRampToValueAtTime(f * 0.985, now + 1.8);

      const peak = 0.16 / (idx + 1);
      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(peak, now + 0.03);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.9 - idx * 0.2);

      osc.connect(gain);
      gain.connect(this.sfxBus ?? ctx.destination);
      osc.start(now);
      osc.stop(now + 2.0);
    });
  }

  // Jade Crystal Collect Chime (Pentatonic highland scale)
  public playJadeCollect(combo: number = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const scale = [523.25, 587.33, 659.25, 783.99, 880, 1046.5];
    const baseFreq = scale[Math.min(combo - 1, scale.length - 1)];

    [baseFreq, baseFreq * 1.5].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.055);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.02, now + i * 0.055 + 0.35);

      gain.gain.setValueAtTime(0.001, now + i * 0.055);
      gain.gain.linearRampToValueAtTime(0.14, now + i * 0.055 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.055 + 0.42);

      osc.connect(gain);
      gain.connect(this.sfxBus ?? ctx.destination);
      osc.start(now + i * 0.055);
      osc.stop(now + i * 0.055 + 0.45);
    });
  }

  // Kachin Nhtu Sword Slash / Dash Whoosh
  public playSwordSlash() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(680, now);
    osc.frequency.exponentialRampToValueAtTime(140, now + 0.18);

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(1200, now);
    filter.frequency.exponentialRampToValueAtTime(320, now + 0.18);

    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus ?? ctx.destination);
    osc.start(now);
    osc.stop(now + 0.2);
  }

  // Heavy Impact / Smuggler Hit
  public playHeavyImpact() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(155, now);
    osc.frequency.exponentialRampToValueAtTime(36, now + 0.24);

    gain.gain.setValueAtTime(0.28, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.25);

    osc.connect(gain);
    gain.connect(this.sfxBus ?? ctx.destination);
    osc.start(now);
    osc.stop(now + 0.26);
  }

  // Player Damage Alert
  public playDamageTaken() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(190, now);
    osc.frequency.linearRampToValueAtTime(95, now + 0.22);

    gain.gain.setValueAtTime(0.2, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.24);

    osc.connect(gain);
    gain.connect(this.sfxBus ?? ctx.destination);
    osc.start(now);
    osc.stop(now + 0.25);
  }

  // Jump Sound
  /** Two-tone scooter horn (beep-beep) */
  public playHorn() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    for (const [t, f] of [
      [0, 420],
      [0.18, 420],
    ] as [number, number][]) {
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.0001, now + t);
      gain.gain.exponentialRampToValueAtTime(0.12, now + t + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + t + 0.15);
      for (const mult of [1, 1.26]) {
        const osc = ctx.createOscillator();
        osc.type = 'square';
        osc.frequency.setValueAtTime(f * mult, now + t);
        osc.connect(gain);
        osc.start(now + t);
        osc.stop(now + t + 0.16);
      }
      gain.connect(this.sfxBus ?? ctx.destination);
    }
  }

  public playJump() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(180, now);
    osc.frequency.exponentialRampToValueAtTime(390, now + 0.14);

    gain.gain.setValueAtTime(0.1, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxBus ?? ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Subtle Footstep / Vehicle Engine Pulse (Whisper-quiet electric hum for AIMA E-Bike!)
  public playStepOrEngine(isVehicle: boolean, speedRatio: number, isElectricBike: boolean = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const interval = isVehicle ? (isElectricBike ? 0.16 : 0.09) : Math.max(0.22, 0.42 - speedRatio * 0.18);
    if (now - this.lastStepTime < interval) return;
    this.lastStepTime = now;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    if (isVehicle) {
      if (isElectricBike) {
        // Whisper-quiet smooth electric motor hum (never noisy combustion engine sound!)
        osc.type = 'sine';
        const base = 220 + speedRatio * 180;
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.linearRampToValueAtTime(base * 1.02, now + 0.12);
        gain.gain.setValueAtTime(0.008, now);
        gain.gain.exponentialRampToValueAtTime(0.0005, now + 0.13);
      } else {
        osc.type = 'sawtooth';
        const base = 52 + speedRatio * 68;
        osc.frequency.setValueAtTime(base, now);
        osc.frequency.linearRampToValueAtTime(base * 1.05, now + 0.08);
        gain.gain.setValueAtTime(0.035, now);
        gain.gain.exponentialRampToValueAtTime(0.001, now + 0.085);
      }
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(95 + Math.random() * 20, now);
      osc.frequency.exponentialRampToValueAtTime(48, now + 0.06);
      gain.gain.setValueAtTime(0.04, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.065);
    }

    osc.connect(gain);
    gain.connect(this.sfxBus ?? ctx.destination);
    osc.start(now);
    osc.stop(now + 0.14);
  }

  // Quest Completed Celebration Fanfare
  public playQuestComplete() {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [392.0, 493.88, 587.33, 783.99];
    notes.forEach((n, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const start = now + idx * 0.09;
      osc.frequency.setValueAtTime(n, start);
      gain.gain.setValueAtTime(0.001, start);
      gain.gain.linearRampToValueAtTime(0.16, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.55);

      osc.connect(gain);
      gain.connect(this.sfxBus ?? ctx.destination);
      osc.start(start);
      osc.stop(start + 0.6);
    });
  }

  // Subtle rhythmic drum & flute cue when a new Manau Dance beat enters the target zone
  public playManauBeatCue(key: 'left' | 'up' | 'down' | 'right') {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const pitchMap: Record<'left' | 'up' | 'down' | 'right', number> = {
      left: 523.25, // C5
      up: 783.99, // G5
      down: 392.0, // G4
      right: 659.25, // E5
    };
    const freq = pitchMap[key];

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(freq, now);
    osc.frequency.exponentialRampToValueAtTime(freq * 0.96, now + 0.14);

    gain.gain.setValueAtTime(0.001, now);
    gain.gain.linearRampToValueAtTime(0.055, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.15);

    osc.connect(gain);
    gain.connect(this.sfxBus ?? ctx.destination);
    osc.start(now);
    osc.stop(now + 0.16);
  }

  // Traditional Kachin Gong + Pentatonic Flute Chime when player hits a rhythm beat
  public playRhythmHit(rating: 'PERFECT' | 'GOOD' | 'MISS', streak: number = 1) {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    if (rating === 'MISS') {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(165, now);
      osc.frequency.linearRampToValueAtTime(110, now + 0.18);
      gain.gain.setValueAtTime(0.11, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.19);
      osc.connect(gain);
      gain.connect(this.sfxBus ?? ctx.destination);
      osc.start(now);
      osc.stop(now + 0.2);
      return;
    }

    const scale = [523.25, 587.33, 659.25, 783.99, 880.0, 1046.5, 1174.66, 1318.5];
    const baseFreq = scale[Math.min(Math.max(0, streak - 1), scale.length - 1)];
    const chord = rating === 'PERFECT' ? [baseFreq, baseFreq * 1.25, baseFreq * 1.5] : [baseFreq, baseFreq * 1.5];

    chord.forEach((f, idx) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = idx === 0 ? 'triangle' : 'sine';
      const t0 = now + idx * 0.04;
      osc.frequency.setValueAtTime(f, t0);
      osc.frequency.exponentialRampToValueAtTime(f * 1.01, t0 + 0.32);

      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(rating === 'PERFECT' ? 0.13 : 0.09, t0 + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0005, t0 + 0.36);

      osc.connect(gain);
      gain.connect(this.sfxBus ?? ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.38);
    });
  }

  // Water splash sound for casting fishing rod & landing fish in Ayeyarwady River
  public playSplash(big = false) {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    const dur = big ? 0.45 : 0.25;
    const bufferSize = Math.floor(ctx.sampleRate * dur);
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * Math.exp(-i / (bufferSize * 0.32));
    }

    const noise = ctx.createBufferSource();
    noise.buffer = buffer;

    const filter = ctx.createBiquadFilter();
    filter.type = 'bandpass';
    filter.frequency.setValueAtTime(big ? 620 : 950, now);
    filter.frequency.exponentialRampToValueAtTime(280, now + dur);
    filter.Q.value = 1.8;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(big ? 0.22 : 0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + dur);

    noise.connect(filter);
    filter.connect(gain);
    gain.connect(this.sfxBus ?? ctx.destination);
    noise.start(now);
    noise.stop(now + dur);
  }

  // Urgent twin bell chime when an Ayeyarwady river fish bites the hook
  public playFishBiteAlert() {
    const ctx = this.ensureContext();
    if (!ctx) return;

    const now = ctx.currentTime;
    [880, 1174.66].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      const t0 = now + i * 0.09;
      osc.frequency.setValueAtTime(freq, t0);
      osc.frequency.exponentialRampToValueAtTime(freq * 1.12, t0 + 0.08);
      gain.gain.setValueAtTime(0.001, t0);
      gain.gain.linearRampToValueAtTime(0.16, t0 + 0.015);
      gain.gain.exponentialRampToValueAtTime(0.001, t0 + 0.14);
      osc.connect(gain);
      gain.connect(this.sfxBus ?? ctx.destination);
      osc.start(t0);
      osc.stop(t0 + 0.15);
    });
  }
}

export const soundEngine = new SoundEngine();

