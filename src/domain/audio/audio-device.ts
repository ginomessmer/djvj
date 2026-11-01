export type AudioStatus = 'idle' | 'running' | 'error';

export interface AudioDevice {
  id: string;
  label: string;
}
