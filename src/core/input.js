/**
 * Unified input: keyboard + pointer-lock mouse on desktop, virtual stick +
 * on-screen buttons in "buttons" mode. Both feed the same neutral state object
 * so the game loop never branches on device type.
 *
 * Fire/ADS come from three possible sources at once (mouse, key, touch button),
 * so they are computed getters rather than a flag anyone can stomp on.
 */

import { settings, set } from './storage.js';
import { sfx, unlockAudio } from './audio.js';

export const KEYMAP = {
  fire: ['KeyQ'],
  ads: ['KeyC'],
  reload: ['KeyR'],
  jump: ['Space'],
  dash: ['KeyE'],
  heal: ['KeyH'],
  pause: ['Escape', 'KeyP'],
  theme: ['KeyT'],
  mute: ['KeyM'],
  w1: ['Digit1'],
  w2: ['Digit2'],
  w3: ['Digit3'],
  w4: ['Digit4'],
};

const NO_EDGES = () => ({
  jump: false,
  dash: false,
  reload: false,
  heal: false,
  weapon: null,
  pause: false,
});

export class Input {
  constructor(canvas) {
    this.canvas = canvas;
    this.keys = Object.create(null);
    this.locked = false;
    this.mode = settings.controlMode === 'buttons' ? 'buttons' : 'mouse';

    this.move = { x: 0, z: 0 };
    this.lookDx = 0;
    this.lookDy = 0;
    this.sprint = false;

    // per-source action flags
    this._mouseFire = false;
    this._btnFire = false;
    this._mouseAds = false;
    this._btnAds = false;

    this.edges = NO_EDGES();

    // wired up by the game
    this.onPause = () => {};
    this.onThemeToggle = () => {};
    this.onMuteToggle = () => {};
    this.enabled = () => false;

    this._stick = { id: null, ox: 0, oy: 0 };
    this._look = { id: null, x: 0, y: 0 };

    this._bindKeyboard();
    this._bindMouse();
    this._bindTouch();
  }

  get firing() {
    return this._mouseFire || this._btnFire || !!this.keys.KeyQ;
  }

  get ads() {
    return this._mouseAds || this._btnAds || !!this.keys.KeyC;
  }

  clearActions() {
    this._mouseFire = this._btnFire = false;
    this._mouseAds = this._btnAds = false;
    this.keys = Object.create(null);
    this.move.x = this.move.z = 0;
  }

  /* ---------------- keyboard ---------------- */
  _bindKeyboard() {
    const is = (action, code) => KEYMAP[action].includes(code);

    addEventListener('keydown', (e) => {
      const first = !e.repeat;
      this.keys[e.code] = true;
      if (e.code === 'Space' || e.code.startsWith('Arrow')) e.preventDefault();
      if (!first) return;

      if (is('pause', e.code)) {
        this.edges.pause = true;
        this.onPause();
      }
      if (is('theme', e.code)) this.onThemeToggle();
      if (is('mute', e.code)) this.onMuteToggle();
      if (!this.enabled()) return;
      if (is('jump', e.code)) this.edges.jump = true;
      if (is('dash', e.code)) this.edges.dash = true;
      if (is('reload', e.code)) this.edges.reload = true;
      if (is('heal', e.code)) this.edges.heal = true;
      if (is('w1', e.code)) this.edges.weapon = 0;
      if (is('w2', e.code)) this.edges.weapon = 1;
      if (is('w3', e.code)) this.edges.weapon = 2;
      if (is('w4', e.code)) this.edges.weapon = 3;
    });

    addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    addEventListener('blur', () => this.clearActions());
  }

  /* ---------------- mouse ---------------- */
  _bindMouse() {
    document.addEventListener('pointerlockchange', () => {
      this.locked = document.pointerLockElement === this.canvas;
      if (!this.locked) this._mouseFire = this._mouseAds = false;
    });

    this.canvas.addEventListener('contextmenu', (e) => e.preventDefault());

    addEventListener('mousemove', (e) => {
      if (this.mode !== 'mouse' || !this.locked) return;
      const s = settings.sensitivity * 0.0022;
      this.lookDx -= e.movementX * s;
      this.lookDy -= e.movementY * s * (settings.invertY ? -1 : 1);
    });

    addEventListener('mousedown', (e) => {
      if (this.mode !== 'mouse') return;
      // clicks on UI chrome must never be swallowed as gameplay input
      if (e.target.closest('.ui-interactive, .screen, button, input, label, a')) return;
      unlockAudio();
      if (!this.locked) {
        if (this.enabled()) this.requestLock();
        return;
      }
      if (e.button === 0) this._mouseFire = true;
      if (e.button === 2) this._mouseAds = true;
    });

    addEventListener('mouseup', (e) => {
      if (e.button === 0) this._mouseFire = false;
      if (e.button === 2) this._mouseAds = false;
    });

    addEventListener(
      'wheel',
      (e) => {
        if (!this.enabled() || this.mode !== 'mouse' || !this.locked) return;
        this.edges.weapon = e.deltaY > 0 ? 'next' : 'prev';
      },
      { passive: true }
    );
  }

  requestLock() {
    if (this.mode !== 'mouse') return;
    this.canvas.requestPointerLock?.();
  }

  releaseLock() {
    if (document.pointerLockElement) document.exitPointerLock();
  }

  /* ---------------- touch / buttons ---------------- */
  _bindTouch() {
    const stickZone = document.getElementById('stickzone');
    const lookZone = document.getElementById('lookzone');
    const base = document.getElementById('stickbase');
    const nub = document.getElementById('sticknub');
    if (!stickZone || !lookZone) return;

    const down = (x, y, zone, id) => {
      if (zone === stickZone && this._stick.id === null) {
        this._stick = { id, ox: x, oy: y };
        base.style.display = nub.style.display = 'block';
        base.style.left = x - 55 + 'px';
        base.style.top = y - 55 + 'px';
        nub.style.left = x - 24 + 'px';
        nub.style.top = y - 24 + 'px';
      } else if (zone === lookZone && this._look.id === null) {
        this._look = { id, x, y };
      }
    };

    const move = (x, y, id) => {
      if (id === this._stick.id) {
        let dx = x - this._stick.ox;
        let dy = y - this._stick.oy;
        const len = Math.hypot(dx, dy);
        const max = 52;
        if (len > max) {
          dx = (dx / len) * max;
          dy = (dy / len) * max;
        }
        nub.style.left = this._stick.ox + dx - 24 + 'px';
        nub.style.top = this._stick.oy + dy - 24 + 'px';
        this.move.x = dx / max;
        this.move.z = -dy / max;
      } else if (id === this._look.id) {
        const s = settings.sensitivity * 0.005;
        this.lookDx -= (x - this._look.x) * s;
        this.lookDy -= (y - this._look.y) * s * (settings.invertY ? -1 : 1);
        this._look.x = x;
        this._look.y = y;
      }
    };

    const up = (id) => {
      if (id === this._stick.id) {
        this._stick.id = null;
        this.move.x = this.move.z = 0;
        base.style.display = nub.style.display = 'none';
      }
      if (id === this._look.id) this._look.id = null;
    };

    [stickZone, lookZone].forEach((z) => {
      z.addEventListener(
        'touchstart',
        (e) => {
          e.preventDefault();
          unlockAudio();
          for (const t of e.changedTouches) down(t.clientX, t.clientY, z, t.identifier);
        },
        { passive: false }
      );
      z.addEventListener('mousedown', (e) => {
        unlockAudio();
        down(e.clientX, e.clientY, z, 'm');
      });
    });
    addEventListener(
      'touchmove',
      (e) => {
        for (const t of e.changedTouches) move(t.clientX, t.clientY, t.identifier);
      },
      { passive: false }
    );
    addEventListener('touchend', (e) => {
      for (const t of e.changedTouches) up(t.identifier);
    });
    addEventListener('touchcancel', (e) => {
      for (const t of e.changedTouches) up(t.identifier);
    });
    addEventListener('mousemove', (e) => {
      if (this.mode === 'buttons') move(e.clientX, e.clientY, 'm');
    });
    addEventListener('mouseup', () => up('m'));

    const bind = (id, onDown, onUp) => {
      const el = document.getElementById(id);
      if (!el) return;
      ['touchstart', 'mousedown'].forEach((ev) =>
        el.addEventListener(
          ev,
          (e) => {
            e.preventDefault();
            e.stopPropagation();
            unlockAudio();
            onDown();
          },
          { passive: false }
        )
      );
      if (onUp) {
        ['touchend', 'touchcancel', 'mouseup', 'mouseleave'].forEach((ev) =>
          el.addEventListener(ev, onUp)
        );
      }
    };

    bind(
      'firebtn',
      () => (this._btnFire = true),
      () => (this._btnFire = false)
    );
    bind('jumpbtn', () => (this.edges.jump = true));
    bind('dashbtn', () => (this.edges.dash = true));
    bind('rlbtn', () => (this.edges.reload = true));
    bind('medbtn', () => (this.edges.heal = true));
    bind('adsbtn', () => {
      this._btnAds = !this._btnAds;
      document.getElementById('adsbtn')?.classList.toggle('active', this._btnAds);
    });
    bind('swapbtn', () => (this.edges.weapon = 'next'));
  }

  /* ---------------- mode ---------------- */
  setMode(mode) {
    this.mode = mode === 'buttons' ? 'buttons' : 'mouse';
    set('controlMode', this.mode);
    if (this.mode === 'buttons') this.releaseLock();
    this.clearActions();
    document.getElementById('adsbtn')?.classList.remove('active');
    sfx.ui();
    return this.mode;
  }

  toggleMode() {
    return this.setMode(this.mode === 'mouse' ? 'buttons' : 'mouse');
  }

  /* ---------------- per-frame read ---------------- */
  sample() {
    if (this.mode === 'mouse') {
      const k = this.keys;
      let x = 0;
      let z = 0;
      if (k.KeyW || k.ArrowUp) z += 1;
      if (k.KeyS || k.ArrowDown) z -= 1;
      if (k.KeyD || k.ArrowRight) x += 1;
      if (k.KeyA || k.ArrowLeft) x -= 1;
      this.move.x = x;
      this.move.z = z;
      this.sprint = !!(k.ShiftLeft || k.ShiftRight);
    } else {
      this.sprint = Math.hypot(this.move.x, this.move.z) > 0.85;
    }
  }

  consumeEdges() {
    const e = this.edges;
    this.edges = NO_EDGES();
    return e;
  }

  consumeLook() {
    const d = { x: this.lookDx, y: this.lookDy };
    this.lookDx = 0;
    this.lookDy = 0;
    return d;
  }
}
