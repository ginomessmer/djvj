import type { ShowSnapshot } from '@/domain/remote/protocol';
import type { Section } from '@/domain/rhythm/section-tracker';

export const SECTION_LABELS: Record<Section, string> = {
  quiet: 'Quiet',
  groove: 'Groove',
  breakdown: 'Breakdown',
  build: 'Build-up',
  drop: 'Drop',
};

/** Below this confidence the tempo is not shown: it would only be a guess. */
const SHOW_BPM_FROM = 0.2;

export function isTempoKnown({ bpm, confidence }: ShowSnapshot['rhythm']): boolean {
  return bpm > 0 && confidence >= SHOW_BPM_FROM;
}
