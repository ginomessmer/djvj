import { describe, expect, it } from 'vitest';
import { preferredCameraId } from './camera-device';

describe('preferredCameraId', () => {
  it('prefers an iPhone (Continuity Camera) over the built-in webcam', () => {
    const devices = [
      { id: 'facetime', label: 'FaceTime HD Camera' },
      { id: 'desk', label: 'Gino’s iPhone Desk View Camera' },
      { id: 'iphone', label: 'Gino’s iPhone Camera' },
    ];
    expect(preferredCameraId(devices)).toBe('iphone');
  });

  it('never picks the Desk View camera', () => {
    expect(preferredCameraId([{ id: 'desk', label: 'iPhone Desk View Camera' }])).toBeNull();
  });

  it('leaves the choice to the system without an iPhone or without labels', () => {
    expect(preferredCameraId([{ id: 'usb', label: 'USB Camera' }])).toBeNull();
    expect(preferredCameraId([{ id: 'x', label: '' }])).toBeNull();
    expect(preferredCameraId([])).toBeNull();
  });
});
