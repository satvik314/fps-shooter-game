/**
 * HUD controller. Owns every heads-up DOM node plus the radar canvas so the
 * game loop only calls semantic methods (`setHp`, `announce`, `feed`, ...).
 */

import { theme } from '../core/theme.js';

const $ = (id) => document.getElementById(id);

export class HUD {
  constructor() {
    this.root = $('hud');
    this.hpFill = $('hpfill');
    this.hpText = $('hptext');
    this.ammoEl = $('ammo');
    this.reloadHint = $('reloadhint');
    this.waveNum = $('wavenum');
    this.leftEl = $('left');
    this.killsEl = $('kills');
    this.scoreEl = $('score');
    this.comboEl = $('combo');
    this.feedEl = $('feed');
    this.announceEl = $('announce');
    this.xh = $('xh');
    this.hitmark = $('hitmark');
    this.vig = $('vig');
    this.weaponsEl = $('weapons');
    this.dashEl = $('dashmeter');
    this.dashFill = $('dashfill');
    this.buffsEl = $('buffs');
    this.bossWrap = $('bosswrap');
    this.bossFill = $('bossfill');
    this.bossName = $('bossname');
    this.chargeWrap = $('chargewrap');
    this.chargeFill = $('chargefill');
    this.radar = $('radar');
    this.rctx = this.radar?.getContext('2d') ?? null;
    this._buffNodes = new Map();
    this._radarScale = 1;
  }

  show(on) {
    this.root.classList.toggle('on', on);
  }

  /* ---------------- vitals ---------------- */
  setHp(hp, max, overshield = 0) {
    const p = Math.max(0, hp) / max;
    this.hpFill.style.width = p * 100 + '%';
    this.hpFill.classList.toggle('low', p <= 0.3);
    this.hpText.textContent =
      Math.max(0, Math.ceil(hp)) + (overshield > 0 ? ` +${Math.ceil(overshield)}` : '');
    this.hpText.classList.toggle('shielded', overshield > 0);
  }

  setAmmo(ammo, mag, reloading) {
    this.ammoEl.innerHTML = `${ammo}<small>/${mag}</small>`;
    this.ammoEl.classList.remove('ammo-kick');
    void this.ammoEl.offsetWidth;
    this.ammoEl.classList.add('ammo-kick');
    if (reloading) {
      this.reloadHint.textContent = 'RELOADING…';
      this.reloadHint.classList.remove('flash');
    } else if (ammo === 0) {
      this.reloadHint.textContent = 'RELOAD — [R]';
      this.reloadHint.classList.add('flash');
    } else {
      this.reloadHint.textContent = '';
      this.reloadHint.classList.remove('flash');
    }
  }

  setWave(n) {
    this.waveNum.textContent = n;
  }

  setHostiles(n) {
    this.leftEl.textContent = n === 1 ? '1 HOSTILE' : `${n} HOSTILES`;
  }

  setKills(n) {
    this.killsEl.textContent = n;
  }

  setScore(n) {
    this.scoreEl.textContent = n.toLocaleString('en-US');
  }

  setCombo(n, timeLeft, maxTime) {
    this.comboEl.textContent = n >= 2 ? `COMBO ×${n}` : '';
    this.comboEl.style.opacity = n >= 2 ? Math.min(1, 0.35 + (timeLeft / maxTime) * 0.65) : 0;
  }

  /* ---------------- weapons ---------------- */
  buildWeapons(loadout) {
    this.weaponsEl.innerHTML = '';
    this._weaponNodes = loadout.map((slot, i) => {
      const el = document.createElement('div');
      el.className = 'wslot';
      el.innerHTML = `<span class="wkey">${i + 1}</span><span class="wname">${slot.def.short}</span>`;
      this.weaponsEl.appendChild(el);
      return el;
    });
  }

  setWeapons(loadout, activeIndex) {
    if (!this._weaponNodes) return;
    this._weaponNodes.forEach((el, i) => {
      const slot = loadout[i];
      el.classList.toggle('active', i === activeIndex);
      el.classList.toggle('locked', !slot.unlocked);
      el.querySelector('.wname').textContent = slot.unlocked ? slot.def.short : 'LOCKED';
    });
  }

  setCharge(pct) {
    const on = pct > 0;
    this.chargeWrap.classList.toggle('on', on);
    this.chargeFill.style.width = Math.min(1, pct) * 100 + '%';
    this.chargeFill.classList.toggle('full', pct >= 1);
  }

  setDash(charges, maxCharges, cooldownPct) {
    this.dashEl.textContent = '';
    for (let i = 0; i < maxCharges; i++) {
      const pip = document.createElement('span');
      pip.className = 'pip' + (i < charges ? ' on' : '');
      this.dashEl.appendChild(pip);
    }
    this.dashFill.style.width = cooldownPct * 100 + '%';
  }

  /* ---------------- buffs ---------------- */
  setBuffs(buffs) {
    const seen = new Set();
    for (const b of buffs) {
      seen.add(b.id);
      let node = this._buffNodes.get(b.id);
      if (!node) {
        node = document.createElement('div');
        node.className = 'buff';
        node.innerHTML = `<span class="bicon"></span><span class="btime"></span>`;
        this.buffsEl.appendChild(node);
        this._buffNodes.set(b.id, node);
      }
      node.querySelector('.bicon').textContent = b.icon + ' ' + b.label;
      node.querySelector('.btime').textContent = b.t.toFixed(1) + 's';
      node.classList.toggle('expiring', b.t < 2);
    }
    for (const [id, node] of this._buffNodes) {
      if (!seen.has(id)) {
        node.remove();
        this._buffNodes.delete(id);
      }
    }
  }

  /* ---------------- boss ---------------- */
  setBoss(enemy) {
    if (!enemy) {
      this.bossWrap.classList.remove('on');
      return;
    }
    this.bossWrap.classList.add('on');
    this.bossName.textContent = enemy.type.name;
    this.bossFill.style.width = Math.max(0, (enemy.hp / enemy.maxhp) * 100) + '%';
  }

  /* ---------------- feedback ---------------- */
  hitmarker(head) {
    this.hitmark.classList.toggle('crit', !!head);
    this.hitmark.classList.remove('pop');
    void this.hitmark.offsetWidth;
    this.hitmark.classList.add('pop');
    this.xh.classList.add('hot');
    clearTimeout(this._xhT);
    this._xhT = setTimeout(() => this.xh.classList.remove('hot'), 120);
  }

  kickCrosshair(amount = 1.5) {
    this.xh.style.setProperty('--spread', 6 + amount * 6 + 'px');
    clearTimeout(this._kickT);
    this._kickT = setTimeout(() => this.xh.style.setProperty('--spread', '6px'), 90);
  }

  setAds(on) {
    this.xh.classList.toggle('ads', on);
    document.body.classList.toggle('ads', on);
  }

  damageFlash(on) {
    this.vig.style.opacity = on ? 1 : 0;
  }

  /** Directional indicator showing where a hit came from. */
  hitDirection(angle) {
    const el = document.createElement('div');
    el.className = 'hitdir';
    el.style.transform = `rotate(${angle}rad)`;
    $('hitdirs').appendChild(el);
    setTimeout(() => el.remove(), 900);
  }

  feed(text, kind = '') {
    const el = document.createElement('div');
    el.className = 'feeditem' + (kind ? ' ' + kind : '');
    el.textContent = text;
    this.feedEl.prepend(el);
    while (this.feedEl.children.length > 5) this.feedEl.lastChild.remove();
    setTimeout(() => {
      el.classList.add('out');
      setTimeout(() => el.remove(), 450);
    }, 3200);
  }

  announce(big, sub = '', kind = '') {
    const a = this.announceEl;
    a.querySelector('.big').textContent = big;
    a.querySelector('.sub').textContent = sub;
    a.className = '';
    if (kind) a.classList.add(kind);
    void a.offsetWidth;
    a.classList.add('show');
  }

  /* ---------------- radar ---------------- */
  setRadarVisible(on) {
    this.radar.parentElement.style.display = on ? 'block' : 'none';
  }

  drawRadar(player, enemies, pickups, range = 55) {
    const ctx = this.rctx;
    if (!ctx) return;
    const size = this.radar.width;
    const c = size / 2;
    const t = theme();
    ctx.clearRect(0, 0, size, size);

    const hex = (n) => '#' + n.toString(16).padStart(6, '0');

    // sweep rings
    ctx.strokeStyle = hex(t.primary);
    ctx.globalAlpha = 0.25;
    ctx.lineWidth = 1;
    for (const r of [0.33, 0.66, 1]) {
      ctx.beginPath();
      ctx.arc(c, c, c * r - 1, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.globalAlpha = 0.18;
    ctx.beginPath();
    ctx.moveTo(c, 0);
    ctx.lineTo(c, size);
    ctx.moveTo(0, c);
    ctx.lineTo(size, c);
    ctx.stroke();
    ctx.globalAlpha = 1;

    const project = (wx, wz) => {
      const dx = wx - player.pos.x;
      const dz = wz - player.pos.z;
      // rotate into view space so "up" is always where you're looking
      const s = Math.sin(-player.yaw);
      const co = Math.cos(-player.yaw);
      const rx = dx * co - dz * s;
      const rz = dx * s + dz * co;
      return [c + (rx / range) * c, c + (rz / range) * c];
    };

    pickups.forEach((p) => {
      const [x, y] = project(p.group.position.x, p.group.position.z);
      if (Math.hypot(x - c, y - c) > c) return;
      ctx.fillStyle = hex(p.color);
      ctx.globalAlpha = 0.9;
      ctx.fillRect(x - 2, y - 2, 4, 4);
    });

    enemies.forEach((e) => {
      let [x, y] = project(e.group.position.x, e.group.position.z);
      const d = Math.hypot(x - c, y - c);
      const edge = d > c - 3;
      if (edge) {
        // clamp off-radar contacts to the rim so you still know the bearing
        const a = Math.atan2(y - c, x - c);
        x = c + Math.cos(a) * (c - 3);
        y = c + Math.sin(a) * (c - 3);
      }
      ctx.globalAlpha = edge ? 0.45 : 1;
      ctx.fillStyle = e.boss ? hex(t.secondary) : hex(e.av.color);
      const r = e.boss ? 5 : e.elite ? 3.6 : 2.6;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // player wedge
    ctx.globalAlpha = 1;
    ctx.fillStyle = hex(t.primary);
    ctx.beginPath();
    ctx.moveTo(c, c - 6);
    ctx.lineTo(c - 4, c + 4);
    ctx.lineTo(c + 4, c + 4);
    ctx.closePath();
    ctx.fill();
  }

  clearFeed() {
    this.feedEl.innerHTML = '';
    this.buffsEl.innerHTML = '';
    this._buffNodes.clear();
    $('hitdirs').innerHTML = '';
    this.bossWrap.classList.remove('on');
  }
}
