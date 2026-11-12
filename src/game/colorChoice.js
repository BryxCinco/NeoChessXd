// Which side the human plays against the CPU.
// The stored choice is 'w' (RED), 'b' (BLUE) or 'random'; a match itself
// always has a definite colour, picked by resolveColor() when it starts.
export const COLOR_KEY = 'neochess_preferred_color';
export const COLOR_CHOICES = ['w', 'b', 'random'];

export function loadColorChoice() {
  try {
    const stored = localStorage.getItem(COLOR_KEY);
    return COLOR_CHOICES.includes(stored) ? stored : 'w';
  } catch {
    return 'w';
  }
}

export function saveColorChoice(choice) {
  try {
    localStorage.setItem(COLOR_KEY, choice);
  } catch {
    // blocked storage: the choice still applies to this session
  }
}

// 'random' flips a coin; anything unknown falls back to RED.
export function resolveColor(choice, random = Math.random) {
  if (choice === 'random') return random() < 0.5 ? 'w' : 'b';
  return choice === 'b' ? 'b' : 'w';
}

export const opposite = (color) => (color === 'w' ? 'b' : 'w');
