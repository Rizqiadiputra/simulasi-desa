// Simpan / muat state desa di localStorage. State = JSON murni, siap dikirim ke backend.
import { SAVE_KEY, STATE_VERSION } from './config.js';
import { createInitialState } from './initialState.js';

export function loadState() {
  try {
    const raw = localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    const s = JSON.parse(raw);
    if (s.version !== STATE_VERSION) return null;
    return s;
  } catch (e) {
    console.warn('[desa] gagal memuat state, mulai baru', e);
    return null;
  }
}

export function saveState(state) {
  try {
    state.clock.savedAt = Date.now();
    localStorage.setItem(SAVE_KEY, JSON.stringify(state));
    return true;
  } catch (e) {
    return false;
  }
}

export function resetState() {
  try { localStorage.removeItem(SAVE_KEY); } catch (e) { /* abaikan */ }
  return createInitialState();
}

export const exportState = (state) => JSON.stringify(state, null, 2);
