// Time controls. A time mode is a short string kept in saves:
//   'none'   no clock
//   '5'      5 minutes each, no increment
//   '3+2'    3 minutes each, +2 seconds added after every move you make
export const TIME_PRESETS = [
  { id: 'none', label: 'NO LIMIT' },
  { id: '0.5', label: '00:30' },
  { id: '1', label: '01:00' },
  { id: '3+2', label: '3+2' },
  { id: '5', label: '05:00' },
  { id: '5+3', label: '5+3' },
  { id: '10', label: '10+0' },
  { id: '15+10', label: '15+10' },
  { id: '30', label: '30:00' },
];

// → { timed, seconds, increment } (seconds = starting time per side).
export function parseTimeMode(timeMode) {
  if (!timeMode || timeMode === 'none') return { timed: false, seconds: 0, increment: 0 };
  const [minutes, increment] = String(timeMode).split('+').map(Number);
  if (!Number.isFinite(minutes) || minutes <= 0) return { timed: false, seconds: 0, increment: 0 };
  return { timed: true, seconds: minutes * 60, increment: Number.isFinite(increment) && increment > 0 ? increment : 0 };
}

// Short text for save cards: 'INF', '5M', '3+2'.
export function timeModeLabel(timeMode) {
  const { timed, increment } = parseTimeMode(timeMode);
  if (!timed) return 'INF';
  return increment > 0 ? String(timeMode) : `${timeMode}M`;
}
