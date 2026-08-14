/**
 * Theme system.
 *
 * CSS side lives in style.css keyed off `<html data-theme="...">`.
 * The 3D side can't use CSS vars, so every scene colour is mirrored here and
 * broadcast to subscribers whenever the theme flips. Anything in the world that
 * owns a material registers a repaint callback via `onThemeChange`.
 */

export const THEMES = {
  dark: {
    id: 'dark',
    name: 'NIGHT GRID',
    // --- world ---
    sky: 0x07070d,
    fog: 0x07070d,
    fogDensity: 0.018,
    groundBase: '#0a0a14',
    gridLine: 'rgba(0,240,255,.28)',
    gridEdge: 'rgba(255,47,214,.35)',
    groundEmissive: 0x0a0a14,
    groundEmissiveIntensity: 0.4,
    structure: 0x14141f,
    structureRough: 0.85,
    // --- lighting ---
    ambient: 0x223355,
    ambientIntensity: 1.2,
    sun: 0x3344aa,
    sunIntensity: 0.6,
    hemiSky: 0x101033,
    hemiGround: 0x000005,
    hemiIntensity: 0.4,
    // --- neon behaviour ---
    emissiveScale: 1,
    haloOpacity: 0.55,
    starColor: 0x8899ff,
    starOpacity: 0.7,
    // --- accents (mirrors CSS) ---
    neons: [0x00f0ff, 0xff2fd6, 0xb6ff00, 0xffb300, 0x8b5cf6],
    primary: 0x00f0ff,
    secondary: 0xff2fd6,
    tracer: 0x00f0ff,
    muzzle: 0xaffcff,
    gunBody: 0x1a1a26,
    bodyBase: 0x0d0d18,
    bodyEmissive: 0.45,
    faceBg: '#0d0d18',
    dmgColor: '#00f0ff',
    dmgCrit: '#ff2fd6',
  },
  light: {
    id: 'light',
    name: 'DAY GRID',
    sky: 0xd7e1f2,
    fog: 0xd7e1f2,
    fogDensity: 0.012,
    groundBase: '#e4eaf4',
    gridLine: 'rgba(0,80,190,.42)',
    gridEdge: 'rgba(214,0,140,.50)',
    groundEmissive: 0x000000,
    groundEmissiveIntensity: 0,
    structure: 0xb9c5da,
    structureRough: 0.7,
    ambient: 0xffffff,
    ambientIntensity: 1.35,
    sun: 0xfff4e0,
    sunIntensity: 1.5,
    hemiSky: 0xdfe7f5,
    hemiGround: 0x8b98ae,
    hemiIntensity: 0.9,
    emissiveScale: 0.55,
    haloOpacity: 0.3,
    starColor: 0x7a8db0,
    starOpacity: 0.22,
    neons: [0x0072ff, 0xe0007a, 0x3d9b00, 0xe07800, 0x6d28d9],
    primary: 0x0072ff,
    secondary: 0xe0007a,
    tracer: 0x0050c8,
    muzzle: 0xffd36e,
    gunBody: 0x2b3245,
    bodyBase: 0xf4f7fd,
    bodyEmissive: 0.22,
    faceBg: '#ffffff',
    dmgColor: '#0059cc',
    dmgCrit: '#d6008f',
  },
};

let current = THEMES.dark;
const listeners = new Set();

export function theme() {
  return current;
}

export function themeId() {
  return current.id;
}

/** Pick a themed neon accent by index (wraps). */
export function neon(i) {
  const n = current.neons;
  return n[((i % n.length) + n.length) % n.length];
}

/** Register a repaint callback. Returns an unsubscribe fn. */
export function onThemeChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function setTheme(id) {
  const next = THEMES[id] || THEMES.dark;
  if (next === current) return current;
  current = next;
  document.documentElement.dataset.theme = current.id;
  listeners.forEach((fn) => {
    try {
      fn(current);
    } catch (err) {
      console.error('[theme] listener failed', err);
    }
  });
  return current;
}

export function toggleTheme() {
  return setTheme(current.id === 'dark' ? 'light' : 'dark');
}

/** Apply without firing listeners — used once at boot. */
export function initTheme(id) {
  current = THEMES[id] || THEMES.dark;
  document.documentElement.dataset.theme = current.id;
  return current;
}
