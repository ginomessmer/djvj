import { afterEach, describe, expect, it, vi } from 'vitest';
import { memoryStorage } from '../test-utils';
import { createShowStore, STORAGE_KEY, toShowState } from './show-store';

afterEach(() => vi.unstubAllGlobals());

describe('show store', () => {
  it('applies valid patches and ignores invalid ones', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    const store = createShowStore();

    store.getState().apply({ intensity: 0.4, sceneId: 'rings' });
    expect(store.getState()).toMatchObject({ intensity: 0.4, sceneId: 'rings' });

    store.getState().apply({ intensity: 5 });
    store.getState().apply({ sceneId: 'nope' });
    store.getState().apply('garbage');
    expect(store.getState()).toMatchObject({ intensity: 0.4, sceneId: 'rings' });
  });

  it('persists only the settings, not session switches', () => {
    const storage = memoryStorage();
    vi.stubGlobal('localStorage', storage);
    const store = createShowStore();

    store.getState().apply({ paletteId: 'ice', panic: true, blackout: true, sceneId: 'fluid' });

    const saved = JSON.parse(storage.getItem(STORAGE_KEY) ?? '{}').state;
    expect(saved).toMatchObject({ paletteId: 'ice' });
    expect(saved).not.toHaveProperty('panic');
    expect(saved).not.toHaveProperty('blackout');
    expect(saved).not.toHaveProperty('sceneId');
  });

  it('restores saved settings and sanitises corrupted ones', () => {
    const stored = { state: { deviceId: 'abc', auto: false, intensity: 'loud' }, version: 0 };
    vi.stubGlobal('localStorage', memoryStorage({ [STORAGE_KEY]: JSON.stringify(stored) }));

    const state = createShowStore().getState();
    expect(state).toMatchObject({ deviceId: 'abc', auto: false, intensity: 1 });
    expect(state.panic).toBe(false);
  });

  it('works when storage is unavailable', () => {
    vi.stubGlobal('localStorage', undefined);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(createShowStore().getState().auto).toBe(true);
  });

  it('exports a state that can be sent to another window', () => {
    vi.stubGlobal('localStorage', memoryStorage());
    const show = toShowState(createShowStore().getState());
    expect(show).not.toHaveProperty('apply');
    expect(() => structuredClone(show)).not.toThrow();
  });
});
