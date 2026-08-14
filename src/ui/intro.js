/**
 * The intro. A CRT power-on, a terminal boot log, then RIVALS slams onto the
 * screen letter by letter and hands the credit to TEMPEST_YT.
 *
 * The whole thing is one abortable timeline — `skip()` at any point resolves
 * immediately and leaves the DOM in a clean state.
 */

import { sfx, unlockAudio } from '../core/audio.js';

const BOOT_LINES = [
  { text: 'TEMPEST//NET  ::  GRID UPLINK v4.2', cls: '' },
  { text: '> establishing handshake ............ [OK]', cls: 'ok' },
  { text: '> neural signature verified ......... [OK]', cls: 'ok' },
  { text: '> loading arena :: THE GRID ......... [OK]', cls: 'ok' },
  { text: '> waking GLOWBOT swarm .............. [ONLINE]', cls: 'ok' },
  { text: '! HOSTILE DENSITY: CRITICAL', cls: 'warn' },
  { text: '> operator, you are cleared to jack in_', cls: '' },
];

export class Intro {
  constructor() {
    this.el = document.getElementById('intro');
    this.bootLines = document.getElementById('bootlines');
    this.barFill = document.getElementById('bootbarfill');
    this.pct = document.getElementById('bootpct');
    this.presents = document.getElementById('presents');
    this.letters = document.getElementById('letters');
    this.byline = document.getElementById('byline');
    this.tagline = document.getElementById('introtag');
    this.flash = document.getElementById('flash');
    this.skipBtn = document.getElementById('skipbtn');

    this._timers = new Set();
    this._rafs = new Set();
    this._aborted = false;
    this._resolve = null;
    this._running = false;

    this.skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.skip();
    });
    this._keyHandler = (e) => {
      if (!this._running) return;
      if (e.code === 'Escape' || e.code === 'Space' || e.code === 'Enter') this.skip();
    };
    addEventListener('keydown', this._keyHandler);
    this.el.addEventListener('click', () => this._running && this.skip());
  }

  _wait(ms) {
    return new Promise((resolve) => {
      if (this._aborted) return resolve();
      const id = setTimeout(() => {
        this._timers.delete(id);
        resolve();
      }, ms);
      this._timers.add(id);
    });
  }

  _frame() {
    return new Promise((resolve) => {
      if (this._aborted) return resolve();
      const id = requestAnimationFrame(() => {
        this._rafs.delete(id);
        resolve();
      });
      this._rafs.add(id);
    });
  }

  _clearTimers() {
    this._timers.forEach(clearTimeout);
    this._timers.clear();
    this._rafs.forEach(cancelAnimationFrame);
    this._rafs.clear();
  }

  /**
   * Runs the sequence. Resolves when finished or skipped.
   * `short` drops the boot log and goes straight to the logo — used on repeat
   * visits so the title still lands without making anyone sit through it twice.
   */
  play({ short = false } = {}) {
    if (this._running) return this._promise;
    this._running = true;
    this._aborted = false;
    this._short = short;
    this._promise = new Promise((resolve) => (this._resolve = resolve));
    this._reset();
    unlockAudio();
    this._run();
    return this._promise;
  }

  _reset() {
    this.el.classList.remove('hidden', 'logo-phase', 'rumble');
    this.el.classList.add('booting');
    this.bootLines.textContent = '';
    this.barFill.style.width = '0%';
    this.pct.textContent = '0%';
    this.presents.classList.remove('in');
    this.byline.classList.remove('in');
    this.tagline.classList.remove('in');
    this.letters.innerHTML = '';
  }

  async _run() {
    sfx.boot();

    // --- phase 1: CRT power-on ---
    await this._wait(this._short ? 260 : 520);
    if (this._aborted) return;

    // --- phase 2: terminal boot log ---
    if (!this._short) await this._bootLog();
    if (this._aborted) return;

    // --- phase 3: riser into the whiteout ---
    sfx.riser();
    await this._wait(this._short ? 420 : 900);
    if (this._aborted) return;
    this._popFlash();
    this.el.classList.remove('booting');
    this.el.classList.add('logo-phase');
    await this._wait(120);
    if (this._aborted) return;

    // --- phase 4: RIVALS, one letter at a time ---
    this.presents.classList.add('in');
    await this._wait(this._short ? 300 : 620);
    if (this._aborted) return;

    const word = 'RIVALS';
    for (let i = 0; i < word.length; i++) {
      if (this._aborted) return;
      const s = document.createElement('span');
      s.textContent = word[i];
      // "ALS" gets the inverted highlight treatment, same as the menu logo
      if (i >= 3) s.classList.add('alt');
      this.letters.appendChild(s);
      void s.offsetWidth;
      s.classList.add('slam');
      sfx.slam(i);
      this._rumble();
      await this._wait(155);
    }
    await this._wait(280);
    if (this._aborted) return;

    // --- phase 5: the credit ---
    this.byline.classList.add('in');
    sfx.logo();
    this._popFlash(0.35);
    await this._wait(560);
    if (this._aborted) return;
    this.tagline.classList.add('in');

    await this._wait(this._short ? 1200 : 1700);
    this._finish();
  }

  /**
   * Types the terminal boot log, filling the progress bar as it goes.
   *
   * Driven by elapsed time on rAF rather than one setTimeout per character, so
   * the log always finishes in the same ~3s whether the machine is running at
   * 144fps or crawling — a per-character timer would stall on a slow frame.
   */
  async _bootLog() {
    const CHARS_PER_SEC = 78;
    const flat = [];
    BOOT_LINES.forEach((line, li) => {
      for (const ch of line.text) flat.push({ ch, li, cls: line.cls });
      flat.push({ ch: '\n', li, cls: line.cls, pause: li === BOOT_LINES.length - 1 ? 0.24 : 0.09 });
    });

    let shown = 0;
    let budget = 0;
    let hold = 0;
    let last = performance.now();
    let span = null;
    let curLine = -1;

    while (shown < flat.length) {
      if (this._aborted) return;
      await this._frame();
      const now = performance.now();
      const dt = Math.min(0.1, (now - last) / 1000);
      last = now;

      if (hold > 0) {
        hold -= dt;
        continue;
      }
      budget += dt * CHARS_PER_SEC;

      while (budget >= 1 && shown < flat.length) {
        const item = flat[shown++];
        budget -= 1;
        if (item.ch === '\n') {
          this.bootLines.appendChild(document.createTextNode('\n'));
          span = null;
          hold = item.pause;
          break;
        }
        if (!span || item.li !== curLine) {
          span = document.createElement('span');
          if (item.cls) span.className = item.cls;
          this.bootLines.appendChild(span);
          curLine = item.li;
        }
        span.textContent += item.ch;
        if (shown % 3 === 0) sfx.type();
      }

      const p = Math.round((shown / flat.length) * 100);
      this.barFill.style.width = p + '%';
      this.pct.textContent = p + '%';
    }
  }

  _popFlash(strength = 1) {
    this.flash.style.opacity = '';
    this.flash.classList.remove('pop');
    void this.flash.offsetWidth;
    this.flash.style.setProperty('--flash', strength);
    this.flash.classList.add('pop');
    const id = setTimeout(() => this.flash.classList.remove('pop'), 520);
    this._timers.add(id);
  }

  _rumble() {
    this.el.classList.remove('rumble');
    void this.el.offsetWidth;
    this.el.classList.add('rumble');
  }

  skip() {
    if (!this._running) return;
    this._aborted = true;
    this._clearTimers();
    sfx.ui();
    this._finish();
  }

  _finish() {
    if (!this._running) return;
    this._running = false;
    this._clearTimers();
    this.el.classList.add('hidden');
    this.flash.classList.remove('pop');
    const id = setTimeout(() => {
      this.el.classList.remove('booting', 'logo-phase');
    }, 500);
    this._timers.add(id);
    this._resolve?.();
  }
}
