/**
 * RIVALS — by Tempest_YT
 * Entry point: boots the theme, builds the game, plays the intro, wires the UI.
 */

import './style.css';
import { initTheme, setTheme, toggleTheme, themeId } from './core/theme.js';
import { settings, set } from './core/storage.js';
import { sfx, setMuted, unlockAudio } from './core/audio.js';
import { Input } from './core/input.js';
import { HUD } from './ui/hud.js';
import { Screens } from './ui/screens.js';
import { Intro } from './ui/intro.js';
import { Game } from './game/game.js';

/* ---------------- theme ---------------- */
initTheme(settings.theme);

const themeBtn = document.getElementById('themebtn');
const themeIcon = document.getElementById('themeicon');
const themeText = document.getElementById('themetext');
const muteBtn = document.getElementById('mutebtn');
const muteIcon = document.getElementById('muteicon');
const muteText = document.getElementById('mutetext');

function paintThemeChip() {
  const dark = themeId() === 'dark';
  themeIcon.textContent = dark ? '◐' : '☀';
  themeText.textContent = dark ? 'DARK' : 'LIGHT';
  document
    .querySelector('meta[name="theme-color"]')
    ?.setAttribute('content', dark ? '#07070d' : '#e9eef7');
}

function applyTheme(id) {
  setTheme(id);
  set('theme', id);
  paintThemeChip();
  screens.syncTheme(id);
}

function paintMuteChip() {
  muteIcon.textContent = settings.muted ? '✕' : '♪';
  muteText.textContent = settings.muted ? 'MUTED' : 'SOUND';
  muteBtn.classList.toggle('off', settings.muted);
}

/* ---------------- boot ---------------- */
const canvas = document.getElementById('scene');
const hud = new HUD();

const screens = new Screens({
  onStart: () => game.startRun(),
  onRetry: () => game.startRun(),
  onResume: () => game.resume(),
  onQuit: () => game.quitToMenu(),
  onThemeChange: (id) => applyTheme(id),
  onIntroReplay: () => runIntro(true),
});

const game = new Game(canvas, hud, screens);
const input = new Input(canvas);
game.attachInput(input);

input.onThemeToggle = () => {
  applyTheme(toggleTheme().id);
  sfx.ui();
};
input.onMuteToggle = () => {
  setMuted(!settings.muted);
  paintMuteChip();
};

themeBtn.onclick = () => {
  unlockAudio();
  sfx.ui();
  applyTheme(themeId() === 'dark' ? 'light' : 'dark');
};
muteBtn.onclick = () => {
  setMuted(!settings.muted);
  paintMuteChip();
  if (!settings.muted) sfx.ui();
};

paintThemeChip();
paintMuteChip();

/* ---------------- control-mode switches ---------------- */
function paintSwitches() {
  const buttons = input.mode === 'buttons';
  document.querySelectorAll('[data-switch]').forEach((sw) => {
    sw.classList.toggle('right', buttons);
    if (!sw.querySelector('.knob')) {
      const k = document.createElement('div');
      k.className = 'knob';
      sw.appendChild(k);
    }
  });
  document.querySelectorAll('.lab-mouse').forEach((l) => l.classList.toggle('active', !buttons));
  document.querySelectorAll('.lab-btn').forEach((l) => l.classList.toggle('active', buttons));
  game.syncTouchUI();
}

document.querySelectorAll('[data-switch]').forEach((sw) => {
  sw.addEventListener('click', (e) => {
    e.stopPropagation();
    input.toggleMode();
    paintSwitches();
    if (input.mode === 'mouse' && game.mode === 'playing') input.requestLock();
  });
});

// Default to on-screen buttons only on genuinely touch-first hardware.
// Touchscreen laptops keep mouse mode, which is what they actually want.
if (
  !localStorage.getItem('rivals.tempest.v1') &&
  matchMedia?.('(pointer:coarse)').matches &&
  !matchMedia('(pointer:fine)').matches
) {
  input.setMode('buttons');
}
paintSwitches();

/* ---------------- intro ---------------- */
const intro = new Intro(game);

/**
 * The gate and the RIVALS arrival always play in full — they're the point.
 * Repeat visits just get a shorter trip through the wormhole; "REPLAY INTRO"
 * restores the full-length journey.
 */
function runIntro(full) {
  screens.hideAll();
  intro.play({ short: !full }).then(() => {
    set('seenIntro', true);
    screens.showMenu();
  });
}

// A first click anywhere unlocks WebAudio (browser autoplay policy).
addEventListener('pointerdown', () => unlockAudio(), { once: true });

runIntro(!settings.seenIntro);

/* ---------------- global keys ---------------- */
addEventListener('keydown', (e) => {
  // Enter starts a run from the menu or the death screen
  if (e.code !== 'Enter') return;
  if (!game.screens.menu.classList.contains('hidden')) {
    e.preventDefault();
    game.startRun();
  } else if (!game.screens.death.classList.contains('hidden')) {
    e.preventDefault();
    game.startRun();
  }
});

// Handy for debugging from the console.
window.RIVALS = { game, input, hud, screens, intro };
