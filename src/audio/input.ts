export interface InputDevice {
  id: string;
  label: string;
}

const FFT_SIZE = 2048;

/**
 * Browser audio input: any device the OS offers, so the built-in microphone, a USB audio
 * interface fed from the mixer, or a virtual device such as BlackHole all work the same way.
 *
 * Important details:
 *  - Browser "voice call" processing (echo cancellation, noise suppression, auto gain) is
 *    switched OFF. It would pump, gate and flatten music.
 *  - The signal is only analysed. It is never routed to the speakers (no feedback loop).
 */
export class AudioInput {
  /** Called when the active input disappears (e.g. a USB interface is unplugged). */
  onLost: (() => void) | null = null;
  deviceId = '';

  private ctx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private freq: Float32Array<ArrayBuffer> = new Float32Array(0);
  private wave: Float32Array<ArrayBuffer> = new Float32Array(0);

  get running(): boolean {
    return this.stream !== null && this.analyser !== null;
  }
  get sampleRate(): number {
    return this.ctx?.sampleRate ?? 48000;
  }
  get binCount(): number {
    return this.analyser?.frequencyBinCount ?? FFT_SIZE / 2;
  }

  /** Must first be called from a user gesture (browser autoplay policy). */
  async start(deviceId = ''): Promise<void> {
    const ctx = this.ctx ?? new AudioContext({ latencyHint: 'interactive' });
    this.ctx = ctx;
    if (ctx.state !== 'running') await ctx.resume();

    this.releaseStream();
    const stream = await this.openStream(deviceId);
    const track = stream.getAudioTracks()[0];
    if (!track) {
      stream.getTracks().forEach((t) => t.stop());
      throw new Error('The selected device has no audio track.');
    }
    track.addEventListener('ended', () => {
      if (this.stream === stream) {
        this.releaseStream();
        this.onLost?.();
      }
    });

    const analyser = this.analyser ?? this.createAnalyser(ctx);
    this.source = ctx.createMediaStreamSource(stream);
    this.source.connect(analyser);
    this.stream = stream;
    this.deviceId = track.getSettings().deviceId ?? deviceId;
  }

  stop(): void {
    this.releaseStream();
  }

  /** Latest spectrum (dB per bin) and time-domain RMS (linear), or null if not running. */
  sample(): { freq: Float32Array; rms: number } | null {
    const analyser = this.analyser;
    if (!analyser || !this.stream) return null;
    analyser.getFloatFrequencyData(this.freq);
    analyser.getFloatTimeDomainData(this.wave);
    let sum = 0;
    for (let i = 0; i < this.wave.length; i++) {
      const v = this.wave[i] as number;
      sum += v * v;
    }
    return { freq: this.freq, rms: Math.sqrt(sum / this.wave.length) };
  }

  /** Labels are only available after the user granted microphone permission once. */
  async listDevices(): Promise<InputDevice[]> {
    const all = await navigator.mediaDevices.enumerateDevices();
    return all
      .filter((d) => d.kind === 'audioinput' && d.deviceId !== 'communications')
      .map((d, i) => ({ id: d.deviceId, label: d.label || `Audio input ${i + 1}` }));
  }

  private async openStream(deviceId: string): Promise<MediaStream> {
    const base: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 2 },
    };
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({ audio: { ...base, deviceId: { exact: deviceId } } });
      } catch (err) {
        const name = (err as { name?: string }).name;
        if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw err;
        console.warn(`[djvj] input "${deviceId}" is gone, falling back to the default device`);
      }
    }
    return navigator.mediaDevices.getUserMedia({ audio: base });
  }

  private createAnalyser(ctx: AudioContext): AnalyserNode {
    const analyser = ctx.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0; // smoothing is done in FeatureExtractor, with attack/release
    this.freq = new Float32Array(analyser.frequencyBinCount);
    this.wave = new Float32Array(analyser.fftSize);
    // Muted sink: guarantees the graph is pulled in every browser, but nothing is audible.
    const sink = ctx.createGain();
    sink.gain.value = 0;
    analyser.connect(sink);
    sink.connect(ctx.destination);
    this.analyser = analyser;
    return analyser;
  }

  private releaseStream(): void {
    this.source?.disconnect();
    this.source = null;
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
  }
}
