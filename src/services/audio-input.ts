import type { AudioDevice } from '@/domain/audio/audio-device';

const FFT_SIZE = 2048;

export interface AudioSample {
  /** Spectrum in dB per bin. */
  spectrumDb: Float32Array;
  /** Time-domain RMS, linear (0..1). */
  rms: number;
}

/**
 * Browser audio input: any device the OS offers, so the built-in microphone, a USB audio
 * interface fed from the mixer, or a virtual device such as BlackHole all work the same way.
 *
 * - Browser "voice call" processing (echo cancellation, noise suppression, auto gain) is off:
 *   it would pump, gate and flatten music.
 * - The signal is only analysed. It is never routed to the speakers (no feedback loop).
 */
export class AudioInput {
  /** Called when the active input disappears (e.g. a USB interface is unplugged). */
  onLost: (() => void) | null = null;
  deviceId = '';

  private context: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private source: MediaStreamAudioSourceNode | null = null;
  private stream: MediaStream | null = null;
  private spectrumDb: Float32Array<ArrayBuffer> = new Float32Array(0);
  private waveform: Float32Array<ArrayBuffer> = new Float32Array(0);

  get sampleRate(): number {
    return this.context?.sampleRate ?? 48000;
  }

  get binCount(): number {
    return this.analyser?.frequencyBinCount ?? FFT_SIZE / 2;
  }

  /** The first call must come from a user gesture (browser autoplay policy). */
  async start(deviceId = ''): Promise<void> {
    const context = this.context ?? new AudioContext({ latencyHint: 'interactive' });
    this.context = context;
    if (context.state !== 'running') await context.resume();

    this.releaseStream();
    const stream = await this.openStream(deviceId);
    const track = stream.getAudioTracks()[0];
    if (!track) {
      for (const t of stream.getTracks()) t.stop();
      throw new Error('The selected device has no audio track.');
    }
    track.addEventListener('ended', () => {
      if (this.stream !== stream) return;
      this.releaseStream();
      this.onLost?.();
    });

    this.source = context.createMediaStreamSource(stream);
    this.source.connect(this.analyser ?? this.createAnalyser(context));
    this.stream = stream;
    this.deviceId = track.getSettings().deviceId ?? deviceId;
  }

  /** Latest analysis frame, or null while no input is open. */
  sample(): AudioSample | null {
    if (!this.analyser || !this.stream) return null;
    this.analyser.getFloatFrequencyData(this.spectrumDb);
    this.analyser.getFloatTimeDomainData(this.waveform);

    let sumOfSquares = 0;
    for (const value of this.waveform) sumOfSquares += value * value;
    return { spectrumDb: this.spectrumDb, rms: Math.sqrt(sumOfSquares / this.waveform.length) };
  }

  /** Labels only appear after the user granted microphone permission once. */
  async listDevices(): Promise<AudioDevice[]> {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices
      .filter((device) => device.kind === 'audioinput' && device.deviceId !== 'communications')
      .map((device, index) => ({
        id: device.deviceId,
        label: device.label || `Audio input ${index + 1}`,
      }));
  }

  private async openStream(deviceId: string): Promise<MediaStream> {
    const audio: MediaTrackConstraints = {
      echoCancellation: false,
      noiseSuppression: false,
      autoGainControl: false,
      channelCount: { ideal: 2 },
    };
    if (deviceId) {
      try {
        return await navigator.mediaDevices.getUserMedia({
          audio: { ...audio, deviceId: { exact: deviceId } },
        });
      } catch (error) {
        const name = (error as { name?: string }).name;
        if (name !== 'OverconstrainedError' && name !== 'NotFoundError') throw error;
        console.warn(`[djvj] input "${deviceId}" is gone, falling back to the default device`);
      }
    }
    return navigator.mediaDevices.getUserMedia({ audio });
  }

  private createAnalyser(context: AudioContext): AnalyserNode {
    const analyser = context.createAnalyser();
    analyser.fftSize = FFT_SIZE;
    analyser.smoothingTimeConstant = 0; // smoothing happens in the domain, with attack/release
    this.spectrumDb = new Float32Array(analyser.frequencyBinCount);
    this.waveform = new Float32Array(analyser.fftSize);

    // Muted sink: guarantees the graph is pulled in every browser, but nothing is audible.
    const sink = context.createGain();
    sink.gain.value = 0;
    analyser.connect(sink);
    sink.connect(context.destination);

    this.analyser = analyser;
    return analyser;
  }

  private releaseStream(): void {
    this.source?.disconnect();
    this.source = null;
    for (const track of this.stream?.getTracks() ?? []) track.stop();
    this.stream = null;
  }
}
