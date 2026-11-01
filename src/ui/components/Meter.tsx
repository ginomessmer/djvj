import { clamp01 } from '@/domain/math';

interface MeterProps {
  label: string;
  /** 0..1 */
  value: number;
}

export function Meter({ label, value }: MeterProps) {
  return (
    <div class="meter">
      <span class="meter__label">{label}</span>
      <div class="meter__track">
        <i class="meter__fill" style={{ transform: `scaleX(${clamp01(value).toFixed(3)})` }} />
      </div>
    </div>
  );
}
