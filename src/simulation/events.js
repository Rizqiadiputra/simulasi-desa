// Acara desa: Upacara Purnama, Pasar Umanis, Pesta Panen, Festival Caitra.
import { YEAR_DAYS } from '../data/config.js';
import { dayInfo } from './clock.js';

export const EVENT_INFO = {
  upacara: { label: 'Upacara Purnama', place: 'candi', from: 17, to: 20, icon: '🌕' },
  pesta: { label: 'Pesta Panen', place: 'pendopo', from: 18, to: 21.5, icon: '🎉' },
  festival: { label: 'Festival Caitra', place: 'pendopo', from: 15, to: 21.5, icon: '🏮' },
  pasar: { label: 'Pasar Umanis ramai', place: 'pasar', from: 6, to: 15, icon: '🧺' },
};

export function eventsForDay(state, day) {
  const info = dayInfo(day);
  const list = [];
  if (day % 15 === 0) list.push({ type: 'upacara', ...EVENT_INFO.upacara });
  if (day % YEAR_DAYS === 0) list.push({ type: 'festival', ...EVENT_INFO.festival });
  if (state.events.scheduled.some((e) => e.day === day && e.type === 'pesta')) list.push({ type: 'pesta', ...EVENT_INFO.pesta });
  if (info.pasaran === 'Umanis') list.push({ type: 'pasar', ...EVENT_INFO.pasar });
  return list;
}

export function nextEvents(state, fromDay, n = 4) {
  const out = [];
  for (let d = fromDay; d < fromDay + 30 && out.length < n; d++)
    for (const e of eventsForDay(state, d)) if (e.type !== 'pasar') out.push({ ...e, day: d });
  return out;
}
