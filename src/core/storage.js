/** Persisted settings + high scores. Fails soft when storage is unavailable. */

const KEY = 'rivals.tempest.v1';

const DEFAULTS = {
  theme: 'dark',
  controlMode: 'mouse', // 'mouse' | 'buttons'
  sensitivity: 1,
  volume: 0.7,
  muted: false,
  invertY: false,
  showRadar: true,
  bestWave: 0,
  bestKills: 0,
  bestScore: 0,
  seenIntro: false,
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...DEFAULTS };
    return { ...DEFAULTS, ...JSON.parse(raw) };
  } catch {
    return { ...DEFAULTS };
  }
}

export const settings = read();

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(settings));
  } catch {
    /* private mode / quota — the game still plays fine */
  }
}

export function set(key, value) {
  settings[key] = value;
  save();
  return value;
}

/** Returns the list of records that were beaten. */
export function recordRun({ wave, kills, score }) {
  const beaten = [];
  if (wave > settings.bestWave) {
    settings.bestWave = wave;
    beaten.push('wave');
  }
  if (kills > settings.bestKills) {
    settings.bestKills = kills;
    beaten.push('kills');
  }
  if (score > settings.bestScore) {
    settings.bestScore = score;
    beaten.push('score');
  }
  if (beaten.length) save();
  return beaten;
}
