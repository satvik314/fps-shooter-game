/**
 * The entry experience, in three beats:
 *
 *   1. GATE    — "You are now entering Vedaant Singh's universe. Are you ready?"
 *                Waiting for a real click here also satisfies the browser's
 *                autoplay policy, so every sound after it is allowed to play.
 *   2. JOURNEY — a wormhole flight rendered in 3D (see wormhole.js), with
 *                status beats and a charge bar overlaid.
 *   3. ARRIVAL — RIVALS slams in letter by letter, credited to TEMPEST_YT.
 *
 * The whole thing is one abortable timeline: `skip()` at any point resolves
 * immediately and leaves the DOM in a clean state.
 */

import { sfx, unlockAudio } from '../core/audio.js';
import { Wormhole } from './wormhole.js';

const WARP_BEATS = [
  { at: 0.02, text: 'LEAVING EARTH ORBIT' },
  { at: 0.24, text: 'FOLDING SPACETIME' },
  { at: 0.46, text: "VEDAANT'S UNIVERSE AHEAD" },
  { at: 0.68, text: 'THE GRID IS WAKING UP' },
  { at: 0.88, text: 'HOLD ON…' },
];

export class Intro {
  /** @param {import('../game/game.js').Game} game  supplies the renderer */
  constructor(game) {
    this.game = game;

    this.gate = document.getElementById('gate');
    this.gateBtn = document.getElementById('gatebtn');
    this.el = document.getElementById('intro');
    this.warpUI = document.getElementById('warpui');
    this.warpLine = document.getElementById('warpline');
    this.warpFill = document.getElementById('warpbarfill');
    this.warpPct = document.getElementById('warppct');
    this.presents = document.getElementById('presents');
    this.letters = document.getElementById('letters');
    this.byline = document.getElementById('byline');
    this.tagline = document.getElementById('introtag');
    this.flash = document.getElementById('flash');
    this.skipBtn = document.getElementById('skipbtn');

    this._timers = new Set();
    this._rafs = new Set();
    this._aborted = false;
    this._running = false;
    this._phase = 'idle'; // 'gate' | 'warp' | 'logo'
    this._gateResolve = null;

    this.gateBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this._confirmGate();
    });

    this.skipBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      this.skip();
    });

    addEventListener('keydown', (e) => {
      if (!this._running) return;
      const go = e.code === 'Enter' || e.code === 'Space' || e.code === 'Escape';
      if (!go) return;
      e.preventDefault();
      // at the gate these keys answer "yes"; later they skip ahead
      if (this._phase === 'gate') this._confirmGate();
      else this.skip();
    });

    this.el.addEventListener('click', () => {
      if (this._running && this._phase !== 'gate') this.skip();
    });

    addEventListener('resize', () => this.wormhole?.resize());
  }

  /* ---------------- timing helpers ---------------- */

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

  /* ---------------- lifecycle ---------------- */

  /**
   * Runs the sequence. Resolves when finished or skipped.
   * `short` shortens the journey for repeat visits — the gate and the logo
   * always play in full, since those are the point.
   */
  play({ short = false } = {}) {
    if (this._running) return this._promise;
    this._running = true;
    this._aborted = false;
    this._short = short;
    this._promise = new Promise((resolve) => (this._resolve = resolve));
    this._reset();
    this._run();
    return this._promise;
  }

  _reset() {
    document.body.classList.add('intro-active');
    this.gate.classList.remove('hidden');
    this.el.classList.remove('hidden', 'warping', 'logo-phase', 'rumble');
    this.skipBtn.style.display = 'none';
    this.warpLine.textContent = '';
    this.warpFill.style.width = '0%';
    this.warpPct.textContent = '0%';
    this.presents.classList.remove('in');
    this.byline.classList.remove('in');
    this.tagline.classList.remove('in');
    this.letters.innerHTML = '';
  }

  async _run() {
    await this._gatePhase();
    if (this._aborted) return;

    await this._warpPhase();
    if (this._aborted) return;

    await this._logoPhase();
    this._finish();
  }

  /* ---------------- 1. the gate ---------------- */

  _gatePhase() {
    this._phase = 'gate';
    return new Promise((resolve) => {
      this._gateResolve = resolve;
    });
  }

  _confirmGate() {
    if (this._phase !== 'gate' || !this._gateResolve) return;
    // this click is the user gesture the audio context has been waiting for
    unlockAudio();
    sfx.enter();
    this.gate.classList.add('hidden');
    const resolve = this._gateResolve;
    this._gateResolve = null;
    this._phase = 'warp';
    const id = setTimeout(resolve, 420);
    this._timers.add(id);
  }

  /* ---------------- 2. the journey ---------------- */

  async _warpPhase() {
    const duration = this._short ? 3.4 : 7;
    this.wormhole = new Wormhole(this.game.renderer, duration);
    this.wormhole.start();
    this.game.setRenderOverride((dt) => {
      this.wormhole.update(dt);
      this.wormhole.render();
    });

    this.el.classList.add('warping');
    this.skipBtn.style.display = '';
    sfx.warpIn();

    let nextBeat = 0;
    let pulseAt = 0;

    while (!this._aborted && this.wormhole.progress < 1) {
      await this._frame();
      const p = this.wormhole.progress;
      this.warpFill.style.width = p * 100 + '%';
      this.warpPct.textContent = Math.round(p * 100) + '%';

      while (nextBeat < WARP_BEATS.length && p >= WARP_BEATS[nextBeat].at) {
        this._showBeat(WARP_BEATS[nextBeat].text);
        nextBeat++;
      }
      // rising ticks that speed up as the tunnel does
      if (p > pulseAt) {
        sfx.warpPulse(Math.floor(p * 10));
        pulseAt = p + Math.max(0.03, 0.12 - p * 0.09);
      }
    }

    this._endWarp();
  }

  _showBeat(text) {
    this.warpLine.textContent = text;
    this.warpLine.classList.remove('pop');
    void this.warpLine.offsetWidth;
    this.warpLine.classList.add('pop');
  }

  /** Hand rendering back to the game and tear the tunnel down. */
  _endWarp() {
    if (!this.wormhole) return;
    this.game.clearRenderOverride();
    this.wormhole.dispose();
    this.wormhole = null;
    this.el.classList.remove('warping');
  }

  /* ---------------- 3. arrival ---------------- */

  async _logoPhase() {
    this._phase = 'logo';
    sfx.arrive();
    this._popFlash();
    this.el.classList.add('logo-phase');
    await this._wait(160);
    if (this._aborted) return;

    this.presents.classList.add('in');
    await this._wait(this._short ? 320 : 600);
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

    this.byline.classList.add('in');
    sfx.logo();
    this._popFlash(0.35);
    await this._wait(560);
    if (this._aborted) return;
    this.tagline.classList.add('in');

    await this._wait(this._short ? 1200 : 1700);
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

  /* ---------------- skip / teardown ---------------- */

  skip() {
    if (!this._running || this._phase === 'gate') return;
    this._aborted = true;
    this._clearTimers();
    this._endWarp();
    sfx.ui();
    this._finish();
  }

  _finish() {
    if (!this._running) return;
    this._running = false;
    this._phase = 'idle';
    this._gateResolve = null;
    this._clearTimers();
    this._endWarp();
    document.body.classList.remove('intro-active');
    this.gate.classList.add('hidden');
    this.el.classList.add('hidden');
    this.skipBtn.style.display = 'none';
    this.flash.classList.remove('pop');
    const id = setTimeout(() => {
      this.el.classList.remove('warping', 'logo-phase');
    }, 500);
    this._timers.add(id);
    this._resolve?.();
  }
}
