/**
 * Screen + modal management: menu, briefing, settings, pause, upgrade picker
 * and the death screen. Purely presentational — it raises callbacks and never
 * touches game state directly.
 */

import { settings, set, save } from '../core/storage.js';
import { sfx, setVolume } from '../core/audio.js';
import { DOODLE_CAST } from '../world/doodleAvatar.js';

const $ = (id) => document.getElementById(id);

export class Screens {
  constructor({ onStart, onRetry, onResume, onQuit, onThemeChange, onIntroReplay }) {
    this.menu = $('menu');
    this.rivals = $('rivals');
    this.briefing = $('briefing');
    this.settings = $('settings');
    this.pause = $('pause');
    this.upgrade = $('upgrade');
    this.death = $('death');

    this.onStart = onStart;
    this.onRetry = onRetry;
    this.onResume = onResume;
    this.onQuit = onQuit;
    this.onThemeChange = onThemeChange;
    this.onIntroReplay = onIntroReplay;

    this._upgradePick = null;
    this._rivalPick = new Set(settings.selectedRivals || ['grunt', 'zip', 'seer']);
    this._bind();
    this._syncSettings();
  }

  _bind() {
    $('startbtn').onclick = () => {
      sfx.ui();
      this.showRivals();
    };
    $('retrybtn').onclick = () => {
      sfx.ui();
      this.onRetry();
    };
    $('menubtn').onclick = () => {
      sfx.ui();
      this.hideAll();
      this.showMenu();
    };
    $('briefbtn').onclick = () => {
      sfx.ui();
      this.show(this.briefing);
    };
    $('setbtn').onclick = () => {
      sfx.ui();
      this.show(this.settings);
    };
    $('pausesetbtn').onclick = () => {
      sfx.ui();
      this.show(this.settings);
    };
    $('replaybtn').onclick = () => {
      sfx.ui();
      this.hide(this.menu);
      this.onIntroReplay();
    };
    $('rivalback').onclick = () => {
      sfx.ui();
      this.hide(this.rivals);
      this.showMenu();
    };
    $('rivalconfirm').onclick = () => {
      if (this._rivalPick.size !== 3) return;
      sfx.upgrade();
      const selected = [...this._rivalPick];
      set('selectedRivals', selected);
      this.hide(this.rivals);
      this.onStart(selected);
    };
    $('resumebtn').onclick = () => {
      sfx.ui();
      this.onResume();
    };
    $('quitbtn').onclick = () => {
      sfx.ui();
      this.onQuit();
    };
    document.querySelectorAll('[data-close]').forEach((btn) => {
      btn.onclick = () => {
        sfx.ui();
        this.hide($(btn.dataset.close));
      };
    });

    // --- settings widgets ---
    const sens = $('sens');
    const sensval = $('sensval');
    sens.oninput = () => {
      set('sensitivity', parseFloat(sens.value));
      sensval.textContent = parseFloat(sens.value).toFixed(2);
    };

    const vol = $('vol');
    const volval = $('volval');
    vol.oninput = () => {
      setVolume(parseFloat(vol.value));
      volval.textContent = Math.round(parseFloat(vol.value) * 100) + '%';
    };
    vol.onchange = () => sfx.ui();

    $('invert').onchange = (e) => set('invertY', e.target.checked);
    $('radartoggle').onchange = (e) => {
      set('showRadar', e.target.checked);
      document.getElementById('radarwrap').style.display = e.target.checked ? 'block' : 'none';
    };
    $('themeselect').onchange = (e) => {
      sfx.ui();
      this.onThemeChange(e.target.value);
    };
    $('resetbests').onclick = () => {
      settings.bestWave = settings.bestKills = settings.bestScore = 0;
      save();
      sfx.ui();
      this.renderBests();
    };

    // upgrade cards respond to 1/2/3 as well as clicks
    addEventListener('keydown', (e) => {
      if (this.upgrade.classList.contains('hidden') || !this._upgradePick) return;
      const i = ['Digit1', 'Digit2', 'Digit3'].indexOf(e.code);
      if (i >= 0) {
        const card = this.upgrade.querySelectorAll('.card')[i];
        if (card) card.click();
      }
    });
  }

  _syncSettings() {
    $('sens').value = settings.sensitivity;
    $('sensval').textContent = settings.sensitivity.toFixed(2);
    $('vol').value = settings.volume;
    $('volval').textContent = Math.round(settings.volume * 100) + '%';
    $('invert').checked = settings.invertY;
    $('radartoggle').checked = settings.showRadar;
    $('themeselect').value = settings.theme;
    document.getElementById('radarwrap').style.display = settings.showRadar ? 'block' : 'none';
  }

  syncTheme(id) {
    $('themeselect').value = id;
  }

  /* ---------------- generic ---------------- */
  show(el) {
    el.classList.remove('hidden');
  }

  hide(el) {
    el.classList.add('hidden');
  }

  /** Close whatever modal is layered on top. Returns true if one was open. */
  closeModals() {
    let closed = false;
    [this.settings, this.briefing].forEach((el) => {
      if (!el.classList.contains('hidden')) {
        el.classList.add('hidden');
        closed = true;
      }
    });
    if (closed) sfx.ui();
    return closed;
  }

  hideAll() {
    [this.menu, this.rivals, this.briefing, this.settings, this.pause, this.upgrade, this.death].forEach((s) =>
      s.classList.add('hidden')
    );
  }

  anyOpen() {
    return [this.menu, this.rivals, this.briefing, this.settings, this.pause, this.upgrade, this.death].some(
      (s) => !s.classList.contains('hidden')
    );
  }

  modalOpen() {
    return [this.briefing, this.settings].some((s) => !s.classList.contains('hidden'));
  }

  /* ---------------- menu ---------------- */
  showMenu() {
    this.renderBests();
    this.show(this.menu);
  }

  showRivals() {
    this.hide(this.menu);
    const saved = settings.selectedRivals || ['grunt', 'zip', 'seer'];
    this._rivalPick = new Set(['grunt', ...saved.filter((id) => ['zip', 'titan', 'seer'].includes(id))]);
    while (this._rivalPick.size > 3) {
      const last = [...this._rivalPick].at(-1);
      if (last !== 'grunt') this._rivalPick.delete(last);
    }

    const holder = $('rivalcards');
    holder.innerHTML = '';
    ['grunt', 'zip', 'titan', 'seer', 'boss'].forEach((id) => {
      const c = DOODLE_CAST[id];
      const locked = id === 'grunt' || id === 'boss';
      const card = document.createElement('button');
      card.type = 'button';
      card.className = 'rival-card';
      card.dataset.rival = id;
      card.innerHTML = `
        <span class="rival-art"><img src="${c.texture}" alt="${c.name}" /></span>
        <span class="rival-role">${c.role}</span>
        <strong>${c.name}</strong>
        <em>${c.title}</em>
        <span class="rival-desc">${c.description}</span>
        <span class="rival-lock">${id === 'boss' ? 'INEVITABLE' : id === 'grunt' ? 'CORE TARGET' : 'SELECT'}</span>`;
      if (locked) card.classList.add('locked');
      if (id === 'boss') card.classList.add('boss-card', 'selected');
      if (this._rivalPick.has(id)) card.classList.add('selected');
      if (!locked) {
        card.onclick = () => {
          if (this._rivalPick.has(id)) this._rivalPick.delete(id);
          else if (this._rivalPick.size < 3) this._rivalPick.add(id);
          sfx.ui();
          this.paintRivalPick();
        };
      }
      holder.appendChild(card);
    });
    this.paintRivalPick();
    this.show(this.rivals);
  }

  paintRivalPick() {
    this.rivals.querySelectorAll('.rival-card').forEach((card) => {
      const id = card.dataset.rival;
      if (id !== 'boss') card.classList.toggle('selected', this._rivalPick.has(id));
      const label = card.querySelector('.rival-lock');
      if (id !== 'grunt' && id !== 'boss') {
        label.textContent = this._rivalPick.has(id) ? 'LOCKED IN' : 'SELECT';
      }
    });
    const optional = [...this._rivalPick].filter((id) => id !== 'grunt').length;
    $('rivalcount').textContent = `${optional} / 2 OPTIONAL RIVALS LOCKED`;
    $('rivalconfirm').disabled = this._rivalPick.size !== 3;
  }

  renderBests() {
    const b = $('bests');
    b.innerHTML = `
      <div>BEST WAVE<b>${settings.bestWave}</b></div>
      <div>BEST FRAGS<b>${settings.bestKills}</b></div>
      <div>BEST SCORE<b>${settings.bestScore.toLocaleString('en-US')}</b></div>`;
  }

  /* ---------------- pause ---------------- */
  showPause(stats) {
    $('pausestats').innerHTML =
      `WAVE <b>${stats.wave}</b> · FRAGS <b>${stats.kills}</b><br>SCORE <b>${stats.score.toLocaleString('en-US')}</b>`;
    this.show(this.pause);
  }

  hidePause() {
    this.hide(this.pause);
    this.hide(this.settings);
  }

  /* ---------------- upgrades ---------------- */
  showUpgrades(wave, cards, taken, onPick) {
    $('upwave').textContent = wave;
    const holder = $('upcards');
    holder.innerHTML = '';
    this._upgradePick = onPick;

    if (!cards.length) {
      // every augment maxed — hand out a shield top-up instead
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML =
        `<div class="cicon">🛡</div><div class="cname">FULL REPAIR</div>` +
        `<div class="cdesc">Shields restored to maximum</div><div class="ckey">1</div><div class="cstack"></div>`;
      el.onclick = () => {
        sfx.upgrade();
        this._upgradePick = null;
        this.hide(this.upgrade);
        onPick(null);
      };
      holder.appendChild(el);
    }

    cards.forEach((u, i) => {
      const stacks = taken[u.id] || 0;
      const el = document.createElement('div');
      el.className = 'card';
      el.innerHTML =
        `<div class="cicon">${u.icon}</div>` +
        `<div class="cname">${u.name}</div>` +
        `<div class="cdesc">${u.desc}</div>` +
        `<div class="ckey">${i + 1}</div>` +
        `<div class="cstack">${stacks ? `OWNED ×${stacks}` : ''}</div>`;
      el.onclick = () => {
        if (!this._upgradePick) return;
        sfx.upgrade();
        this._upgradePick = null;
        this.hide(this.upgrade);
        onPick(u);
      };
      holder.appendChild(el);
    });

    this.show(this.upgrade);
  }

  /* ---------------- death ---------------- */
  showDeath(stats, records) {
    $('finalstats').innerHTML =
      `WAVE REACHED — <b>${stats.wave}</b><br>` +
      `DOODLES ERASED — <b>${stats.kills}</b><br>` +
      `ACCURACY — <b>${stats.accuracy}%</b><br>` +
      `BEST COMBO — <b>×${stats.bestCombo}</b><br>` +
      `SCORE — <b>${stats.score.toLocaleString('en-US')}</b>`;
    const rec = $('newrecord');
    if (records.length) {
      rec.textContent = '★ NEW PERSONAL BEST — ' + records.join(' · ').toUpperCase() + ' ★';
      rec.classList.add('on');
    } else {
      rec.textContent = '';
      rec.classList.remove('on');
    }
    this.show(this.death);
  }
}
