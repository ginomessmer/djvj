import type { ShowSnapshot } from '@/domain/remote/protocol';

interface DebugHudProps {
  snapshot: ShowSnapshot;
}

export function DebugHud({ snapshot }: DebugHudProps) {
  const { show, signal, performance, shownSceneId } = snapshot;
  const lines = [
    `${performance.fps.toFixed(0)} fps · ${performance.frameMs.toFixed(1)} ms · ${performance.resolution.join('×')}`,
    `scene ${shownSceneId}${show.auto ? ' (auto)' : ' (locked)'} · palette ${show.paletteId}`,
    `signal ${signal.present ? 'yes' : 'no'} · ${signal.loudnessDb.toFixed(0)} dBFS · energy ${signal.energy.toFixed(2)} · kick ${signal.kick.toFixed(2)}`,
    `bands ${signal.bands.map((level) => level.toFixed(2)).join(' ')}`,
  ];
  return <pre class="hud">{lines.join('\n')}</pre>;
}
