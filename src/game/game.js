/**
 * RIVALS — game core.
 *
 * Owns the renderer, the run state and the fixed update/render loop. Systems
 * (arena, enemies, weapons, pickups, HUD) are plugged in here; this file is the
 * only place that knows about all of them at once.
 */

import * as THREE from 'three';
import { theme, onThemeChange, neon } from '../core/theme.js';
import { settings, recordRun } from '../core/storage.js';
import { sfx, startMusic, stopMusic, setMusicIntensity, unlockAudio } from '../core/audio.js';
import { buildArena, resolveCollisions, ARENA } from '../world/arena.js';
import { FX } from '../world/fx.js';
import { GLOW_TEX, rng, disposeObject } from '../world/gfx.js';
import { Enemy, ENEMY_TYPES, rollWaveComposition } from './enemy.js';
import { WEAPONS, makeLoadout } from './weapons.js';
import { baseMods, rollUpgrades } from './upgrades.js';
import { Pickup, rollPickupType, PICKUP_TYPES } from './pickups.js';

const COMBO_WINDOW = 2.6;
const STREAKS = [
  [5, 'RAMPAGE', 'FIVE IN A ROW'],
  [10, 'DOMINATING', 'TEN STRAIGHT'],
  [15, 'UNSTOPPABLE', 'FIFTEEN STRAIGHT'],
  [25, 'GODLIKE', 'TWENTY-FIVE STRAIGHT'],
  [40, 'LEGENDARY', 'FORTY STRAIGHT'],
];

const PROJ_GEO = new THREE.SphereGeometry(0.22, 10, 10);

export class Game {
  constructor(canvas, hud, screens) {
    this.canvas = canvas;
    this.hud = hud;
    this.screens = screens;

    /* ---------- renderer ---------- */
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(innerWidth, innerHeight);

    this.scene = new THREE.Scene();
    const t = theme();
    this.scene.background = new THREE.Color(t.sky);
    this.scene.fog = new THREE.FogExp2(t.fog, t.fogDensity);

    this.camera = new THREE.PerspectiveCamera(75, innerWidth / innerHeight, 0.05, 400);
    this.scene.add(this.camera);

    addEventListener('resize', () => this.onResize());

    /* ---------- world ---------- */
    const arena = buildArena(this.scene);
    this.colliders = arena.colliders;
    this.spinners = arena.spinners;
    this.solids = arena.solids;
    this.fx = new FX(this.scene);

    /* ---------- viewmodel ---------- */
    this.gunGroup = new THREE.Group();
    this.gunGroup.position.set(0.26, -0.22, -0.78);
    this.gunGroup.rotation.y = 0.06;
    this.gunGroup.scale.setScalar(0.72);
    this.camera.add(this.gunGroup);

    this.muzzleLight = new THREE.PointLight(t.muzzle, 0, 9, 2);
    this.muzzleLight.position.set(0.32, -0.2, -1.1);
    this.camera.add(this.muzzleLight);

    this.muzzle = new THREE.Mesh(
      new THREE.SphereGeometry(0.06, 6, 6),
      new THREE.MeshBasicMaterial({ color: t.muzzle })
    );
    this.muzzle.position.set(0, 0.05, -0.62);
    this.muzzle.visible = false;
    this.gunGroup.add(this.muzzle);

    /* ---------- state ---------- */
    this.player = {
      pos: new THREE.Vector3(0, 1.7, 18),
      vel: new THREE.Vector3(),
      yaw: Math.PI,
      pitch: 0,
      onGround: true,
      hp: 100,
      radius: 0.45,
      eye: 1.7,
      dead: false,
      mods: baseMods(),
      overshield: 0,
      dashCharges: 2,
      dashRecharge: 0,
      dashT: 0,
      dashDir: new THREE.Vector3(),
      iframes: 0,
      adrenT: 0,
    };

    this.enemies = [];
    this.projectiles = [];
    this.pickups = [];
    this.buffs = [];
    this.spawnQueue = [];
    this.loadout = makeLoadout();
    this.activeWeapon = 0;
    this.takenUpgrades = {};

    this.wave = 0;
    this.kills = 0;
    this.score = 0;
    this.combo = 0;
    this.comboT = 0;
    this.bestCombo = 0;
    this.streak = 0;
    this.shots = 0;
    this.hits = 0;
    this.difficulty = 1;
    this.boss = null;

    this.mode = 'menu'; // 'menu' | 'playing' | 'paused' | 'dead' | 'upgrading'
    this.timeScale = 1;
    this.targetTimeScale = 1;
    this.recoil = 0;
    this.gunKick = 0;
    this.shakeT = 0;
    this.shakeAmp = 0;
    this.bobT = 0;
    this.landDip = 0;
    this.menuAngle = 0;
    this.pendingWave = false;

    this.raycaster = new THREE.Raycaster();
    this.clock = new THREE.Clock();

    this.equip(0, true);
    this.hud.buildWeapons(this.loadout);
    this.hud.setWeapons(this.loadout, 0);

    onThemeChange((th) => {
      this.scene.background = new THREE.Color(th.sky);
      this.muzzleLight.color.setHex(th.muzzle);
      this.muzzle.material.color.setHex(th.muzzle);
    });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden && this.mode === 'playing') this.pause();
    });

    this._loop = this._loop.bind(this);
    requestAnimationFrame(this._loop);
  }

  /* ================================================================
     lifecycle
     ================================================================ */

  onResize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(innerWidth, innerHeight);
  }

  attachInput(input) {
    this.input = input;
    input.enabled = () => this.mode === 'playing';
    input.onPause = () => {
      // Escape backs out one layer at a time: modal, then pause, then resume
      if (this.screens.closeModals()) return;
      if (this.mode === 'playing') this.pause();
      else if (this.mode === 'paused') this.resume();
    };
  }

  startRun() {
    this.resetRun();
    this.mode = 'playing';
    this.setPlayView();
    this.hud.show(true);
    this.screens.hideAll();
    document.getElementById('hudswitch').classList.add('on');
    this.syncTouchUI();
    unlockAudio();
    startMusic();
    this.input?.requestLock();
    this.spawnWave();
  }

  resetRun() {
    this.enemies.forEach((e) => e.dispose());
    this.enemies.length = 0;
    this.projectiles.forEach((p) => {
      this.scene.remove(p.mesh);
      disposeObject(p.mesh);
    });
    this.projectiles.length = 0;
    this.pickups.forEach((p) => p.dispose());
    this.pickups.length = 0;
    this.buffs.length = 0;
    this.spawnQueue.length = 0;
    this.fx.clear();

    const p = this.player;
    p.pos.set(0, 1.7, 18);
    p.vel.set(0, 0, 0);
    p.yaw = Math.PI;
    p.pitch = 0;
    p.dead = false;
    p.mods = baseMods();
    p.hp = this.maxHp();
    p.overshield = 0;
    p.dashCharges = p.mods.dashCharges;
    p.dashRecharge = 0;
    p.dashT = 0;
    p.iframes = 0;
    p.adrenT = 0;

    this.loadout = makeLoadout();
    this.takenUpgrades = {};
    this.wave = 0;
    this.kills = 0;
    this.score = 0;
    this.combo = 0;
    this.comboT = 0;
    this.bestCombo = 0;
    this.streak = 0;
    this.shots = 0;
    this.hits = 0;
    this.boss = null;
    this.pendingWave = false;
    this.timeScale = this.targetTimeScale = 1;

    this.equip(0, true);
    this.hud.buildWeapons(this.loadout);
    this.hud.setWeapons(this.loadout, 0);
    this.hud.clearFeed();
    this.hud.setKills(0);
    this.hud.setScore(0);
    this.hud.setCombo(0, 0, 1);
    this.hud.setBoss(null);
    this.hud.damageFlash(false);
    this.refreshVitals();
  }

  pause() {
    if (this.mode !== 'playing') return;
    this.mode = 'paused';
    this.input?.releaseLock();
    this.input?.clearActions();
    document.getElementById('touchui').classList.remove('on');
    this.screens.showPause({ wave: this.wave, kills: this.kills, score: this.score });
  }

  resume() {
    if (this.mode !== 'paused') return;
    this.screens.hidePause();
    this.mode = 'playing';
    this.syncTouchUI();
    this.input?.requestLock();
  }

  quitToMenu() {
    this.mode = 'menu';
    stopMusic();
    this.resetRun();
    this.hud.show(false);
    this.input?.releaseLock();
    document.getElementById('touchui').classList.remove('on');
    document.getElementById('hudswitch').classList.remove('on');
    this.screens.hideAll();
    this.screens.showMenu();
  }

  syncTouchUI() {
    const on = this.input?.mode === 'buttons' && this.mode === 'playing';
    document.getElementById('touchui').classList.toggle('on', on);
    document.body.classList.toggle('touchmode', this.input?.mode === 'buttons');
    document.getElementById('deskkeys').style.display =
      this.input?.mode === 'mouse' ? 'flex' : 'none';
  }

  /* ================================================================
     player vitals
     ================================================================ */

  maxHp() {
    return Math.max(30, 100 + this.player.mods.maxhpBonus);
  }

  refreshVitals() {
    this.hud.setHp(this.player.hp, this.maxHp(), this.player.overshield);
    const slot = this.loadout[this.activeWeapon];
    this.hud.setAmmo(slot.ammo, this.magSize(slot), slot.reloading);
    this.hud.setDash(
      this.player.dashCharges,
      this.player.mods.dashCharges,
      Math.min(1, this.player.dashRecharge / this.player.mods.dashCd)
    );
  }

  heal(amount) {
    this.player.hp = Math.min(this.maxHp(), this.player.hp + amount);
    this.refreshVitals();
  }

  hurtPlayer(amount, source) {
    const p = this.player;
    if (p.dead || p.iframes > 0 || this.mode !== 'playing') return;

    if (p.overshield > 0) {
      const absorbed = Math.min(p.overshield, amount);
      p.overshield -= absorbed;
      amount -= absorbed;
      this.fx.ring(p.pos.clone().setY(0.15), neon(4), 3, 0.35);
    }
    if (amount <= 0) {
      this.refreshVitals();
      return;
    }

    p.hp -= amount;
    p.iframes = 0.12;
    sfx.hurt();
    this.hud.damageFlash(true);
    clearTimeout(this._vigT);
    this._vigT = setTimeout(() => {
      if (this.player.hp > 0) this.hud.damageFlash(false);
    }, 240);
    this.shake(0.25, 0.03);

    if (source?.group) {
      const dx = source.group.position.x - p.pos.x;
      const dz = source.group.position.z - p.pos.z;
      this.hud.hitDirection(Math.atan2(dx, -dz) - p.yaw + Math.PI);
    }

    this.combo = 0;
    this.streak = 0;
    this.hud.setCombo(0, 0, 1);
    this.refreshVitals();
    if (p.hp <= 0) this.die();
  }

  die() {
    const p = this.player;
    p.dead = true;
    this.mode = 'dead';
    stopMusic();
    sfx.death();
    this.input?.releaseLock();
    this.input?.clearActions();
    document.getElementById('touchui').classList.remove('on');
    document.getElementById('hudswitch').classList.remove('on');
    this.hud.damageFlash(true);
    this.fx.explode(p.pos.clone(), neon(1), 2);

    const stats = {
      wave: this.wave,
      kills: this.kills,
      score: this.score,
      bestCombo: this.bestCombo,
      accuracy: this.shots ? Math.round((this.hits / this.shots) * 100) : 0,
    };
    const records = recordRun(stats);

    setTimeout(() => {
      this.hud.show(false);
      this.screens.showDeath(stats, records);
    }, 900);
  }

  shake(t, amp) {
    this.shakeT = Math.max(this.shakeT, t);
    this.shakeAmp = Math.max(this.shakeAmp, amp);
  }

  /* ================================================================
     weapons
     ================================================================ */

  magSize(slot) {
    return Math.round(slot.def.mag * this.player.mods.magMul);
  }

  equip(index, silent) {
    const slot = this.loadout[index];
    if (!slot || !slot.unlocked) return;
    if (this.activeWeapon === index && this._equipped) return;

    if (this._equipped) {
      this._equipped.remove(this.muzzle); // shared across weapons — keep it alive
      this.gunGroup.remove(this._equipped);
      disposeObject(this._equipped);
    }
    this.activeWeapon = index;
    const model = slot.def.build(slot.def.idx);
    model.add(this.muzzle);
    this.gunGroup.add(model);
    this._equipped = model;
    this.gunKick = 1.4;
    slot.charge = 0;
    if (!silent) {
      sfx.swap();
      this.hud.feed(slot.def.name + ' READY');
    }
    this.hud.setWeapons(this.loadout, index);
    this.refreshVitals();
  }

  cycleWeapon(dir) {
    const n = this.loadout.length;
    for (let i = 1; i <= n; i++) {
      const idx = (this.activeWeapon + dir * i + n * 2) % n;
      if (this.loadout[idx].unlocked) {
        this.equip(idx);
        return;
      }
    }
  }

  unlockWeaponsFor(wave) {
    this.loadout.forEach((slot, i) => {
      if (!slot.unlocked && slot.def.unlockWave <= wave) {
        slot.unlocked = true;
        this.hud.feed('WEAPON UNLOCKED — ' + slot.def.name, 'good');
        this.hud.announce(slot.def.name, 'PRESS ' + (i + 1) + ' TO EQUIP', 'good');
        sfx.levelup();
      }
    });
    this.hud.setWeapons(this.loadout, this.activeWeapon);
  }

  tryReload() {
    const slot = this.loadout[this.activeWeapon];
    if (slot.reloading || slot.ammo >= this.magSize(slot) || this.player.dead) return;
    slot.reloading = true;
    slot.reloadT = slot.def.reloadTime * this.player.mods.reloadMul;
    slot.charge = 0;
    sfx.reload();
    this.refreshVitals();
  }

  fireRate(slot) {
    const rapid = this.hasBuff('rapid') ? 0.55 : 1;
    return slot.def.fireRate / this.player.mods.fireRate * rapid;
  }

  /** Fires the active weapon. `power` scales damage for charged shots. */
  shoot(power = 1) {
    const slot = this.loadout[this.activeWeapon];
    const def = slot.def;
    if (slot.reloading || slot.cd > 0 || this.player.dead) return;
    if (slot.ammo <= 0) {
      sfx.empty();
      this.tryReload();
      return;
    }

    slot.ammo--;
    slot.cd = this.fireRate(slot);
    this.shots++;
    def.sound();
    this.refreshVitals();

    this.recoil += def.recoil * (this.input?.ads ? 0.55 : 1);
    this.gunKick = def.kick;
    this.shake(0.08, def.shake);
    this.hud.kickCrosshair(def.kick);
    this.muzzleLight.intensity = 55;
    this.muzzle.visible = true;
    this.muzzle.scale.setScalar(rng(0.7, 1.4) * (def.id === 'scatter' ? 1.6 : 1));

    const camPos = new THREE.Vector3();
    this.camera.getWorldPosition(camPos);
    const baseDir = new THREE.Vector3();
    this.camera.getWorldDirection(baseDir);
    const muzzlePos = new THREE.Vector3();
    this.muzzle.getWorldPosition(muzzlePos);

    const targets = [];
    for (const e of this.enemies) {
      if (!e.dead && e.spawnT <= 0) targets.push(...e.hitMeshes);
    }
    const all = targets.concat(this.solids);

    const spread = (this.input?.ads ? def.adsSpread : def.spread) * (this.player.onGround ? 1 : 1.8);
    let anyHit = false;
    const damaged = new Set();

    for (let p = 0; p < def.pellets; p++) {
      const dir = baseDir.clone();
      if (spread > 0) {
        dir.x += rng(-spread, spread);
        dir.y += rng(-spread, spread);
        dir.z += rng(-spread, spread);
        dir.normalize();
      }
      this.raycaster.set(camPos, dir);
      this.raycaster.far = def.range;
      const hits = this.raycaster.intersectObjects(all, false);

      let pierceLeft = def.pierce;
      let end = camPos.clone().addScaledVector(dir, def.range);

      for (const h of hits) {
        const en = h.object.userData.enemy;
        if (!en) {
          // hit cover / floor
          end = h.point;
          this.fx.burst(h.point, neon(0), 3, 0.5);
          break;
        }
        if (en.dead) continue;
        const isHead = !!h.object.userData.isHead;
        this.applyDamage(en, isHead, h.point, def, power);
        damaged.add(en);
        anyHit = true;
        if (pierceLeft <= 0) {
          end = h.point;
          break;
        }
        pierceLeft--;
      }

      if (def.tracerWidth > 0) {
        this.fx.beam(muzzlePos, end, neon(def.idx), def.tracerWidth * power, 0.24);
        this.fx.light(end, neon(def.idx), 40, 12, 0.2);
      } else {
        this.fx.tracer(muzzlePos, end, neon(def.idx));
      }
    }

    if (anyHit) {
      this.hits++;
      sfx.hit();
      this.hud.hitmarker([...damaged].some((e) => e.lastHitHead));
    }
    if (slot.ammo === 0) this.tryReload();
  }

  applyDamage(enemy, isHead, point, def, power) {
    const m = this.player.mods;
    const boost = this.hasBuff('damage') ? 2 : 1;
    let dmg = rng(def.dmg[0], def.dmg[1]) * m.dmg * power * boost;
    if (isHead) {
      dmg *= def.headMult * m.headMul;
      sfx.head();
    }
    enemy.lastHitHead = isHead;
    enemy.damage(Math.round(dmg), isHead, point);
  }

  /* ================================================================
     enemies / waves
     ================================================================ */

  spawnWave() {
    this.wave++;
    this.hud.setWave(this.wave);
    this.unlockWeaponsFor(this.wave);

    const comp = rollWaveComposition(this.wave);
    const isBoss = comp.includes('boss');
    this.hud.announce(
      'WAVE ' + this.wave,
      isBoss ? 'OVERLORD DETECTED' : this.wave % 3 === 0 ? 'HEAVY GLOWBOTS INBOUND' : 'THE GRID HUNGERS',
      isBoss ? 'danger' : ''
    );
    sfx.wave();

    this.spawnQueue = comp.map((typeId, i) => ({
      typeId,
      t: typeId === 'boss' ? 0.4 : 0.45 + i * 0.55,
    }));
    this.hud.setHostiles(comp.length);

    // wave-start overshield from the OVERSHIELD augment
    this.player.overshield = this.player.mods.overshield;
    setMusicIntensity(Math.min(1, this.wave / 12));
    this.refreshVitals();
  }

  spawnEnemy(typeId) {
    const a = Math.random() * Math.PI * 2;
    const r = rng(26, ARENA - 8);
    let x = this.player.pos.x + Math.cos(a) * r;
    let z = this.player.pos.z + Math.sin(a) * r;
    x = Math.max(-ARENA + 4, Math.min(ARENA - 4, x));
    z = Math.max(-ARENA + 4, Math.min(ARENA - 4, z));
    const e = new Enemy(this, typeId, x, z, this.wave);
    this.enemies.push(e);
    if (e.boss) {
      this.boss = e;
      this.hud.announce('OVERLORD', 'WAVE ' + this.wave + ' BOSS', 'danger');
    }
    return e;
  }

  summonMinions(pos, n) {
    this.hud.feed('OVERLORD SUMMONS', 'warn');
    for (let i = 0; i < n; i++) {
      const a = (i / n) * Math.PI * 2;
      const x = Math.max(-ARENA + 4, Math.min(ARENA - 4, pos.x + Math.cos(a) * 5));
      const z = Math.max(-ARENA + 4, Math.min(ARENA - 4, pos.z + Math.sin(a) * 5));
      this.enemies.push(new Enemy(this, 'zip', x, z, this.wave));
    }
    this.hud.setHostiles(this.enemies.length + this.spawnQueue.length);
  }

  onEnemyDeath(enemy, isHead, origin) {
    const i = this.enemies.indexOf(enemy);
    if (i >= 0) this.enemies.splice(i, 1);

    this.kills++;
    this.combo++;
    this.comboT = COMBO_WINDOW;
    this.streak++;
    this.bestCombo = Math.max(this.bestCombo, this.combo);

    const mult = 1 + (this.combo - 1) * 0.25;
    const gained = Math.round(enemy.score * mult * (isHead ? 1.5 : 1));
    this.score += gained;

    this.hud.setKills(this.kills);
    this.hud.setScore(this.score);
    this.hud.setCombo(this.combo, this.comboT, COMBO_WINDOW);
    this.hud.feed(
      (isHead ? 'HEADSHOT ✕ ' : 'FRAGGED ✕ ') + enemy.type.name,
      isHead ? 'head' : ''
    );
    sfx.kill();

    const m = this.player.mods;
    if (m.lifesteal) this.heal(m.lifesteal);
    if (m.adrenaline) this.player.adrenT = 3;

    // chain detonation
    if (m.splash > 0) {
      this.fx.ring(origin.clone().setY(0.2), neon(3), 7, 0.45);
      for (const other of [...this.enemies]) {
        if (other.dead || other.spawnT > 0) continue;
        if (other.group.position.distanceTo(origin) < 6) {
          other.damage(m.splash, false, other.group.position.clone().setY(1.2));
        }
      }
    }

    // streak callouts
    for (const [n, big, sub] of STREAKS) {
      if (this.streak === n) {
        this.hud.announce(big, sub, 'good');
        sfx.levelup();
      }
    }

    if (enemy.boss) {
      this.boss = null;
      this.hud.setBoss(null);
      this.hud.announce('OVERLORD DOWN', '+' + gained + ' POINTS', 'good');
      this.slowmo(1.1);
      for (let k = 0; k < 3; k++) {
        this.dropPickup(origin.clone().add(new THREE.Vector3(rng(-3, 3), 0, rng(-3, 3))), true);
      }
    } else if (Math.random() < 0.14 + m.scavenger) {
      this.dropPickup(origin);
    }

    this.hud.setHostiles(this.enemies.length + this.spawnQueue.length);
    this.checkWaveClear();
  }

  dropPickup(pos, guaranteed) {
    const type = guaranteed ? PICKUP_TYPES.shield : rollPickupType();
    this.pickups.push(new Pickup(this.scene, type, pos));
  }

  checkWaveClear() {
    if (this.pendingWave || this.mode !== 'playing') return;
    if (this.enemies.length > 0 || this.spawnQueue.length > 0) return;

    this.pendingWave = true;
    this.hud.announce('WAVE CLEAR', 'AUGMENT AVAILABLE', 'good');
    sfx.levelup();
    setTimeout(() => {
      if (this.mode !== 'playing') {
        this.pendingWave = false;
        return;
      }
      this.openUpgradePicker();
    }, 1400);
  }

  openUpgradePicker() {
    this.mode = 'upgrading';
    this.input?.releaseLock();
    this.input?.clearActions();
    document.getElementById('touchui').classList.remove('on');
    const cards = rollUpgrades(this.takenUpgrades, 3);
    this.screens.showUpgrades(this.wave, cards, this.takenUpgrades, (choice) => {
      if (choice) {
        this.takenUpgrades[choice.id] = (this.takenUpgrades[choice.id] || 0) + 1;
        choice.apply(this.player.mods);
        choice.onPick?.(this);
        this.hud.feed('AUGMENT — ' + choice.name, 'good');
        // keep derived values consistent with the new mods
        this.player.hp = Math.min(this.player.hp, this.maxHp());
        this.player.dashCharges = Math.min(
          this.player.mods.dashCharges,
          this.player.dashCharges + 1
        );
      } else {
        this.heal(this.maxHp());
      }
      this.loadout.forEach((s) => {
        s.ammo = this.magSize(s);
        s.reloading = false;
      });
      this.heal(20);
      this.refreshVitals();
      this.mode = 'playing';
      this.pendingWave = false;
      this.syncTouchUI();
      this.input?.requestLock();
      this.spawnWave();
    });
  }

  spawnProjectile(origin, dir, dmg, color, scale) {
    const mesh = new THREE.Mesh(
      PROJ_GEO,
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.95 })
    );
    mesh.scale.setScalar(Math.max(0.7, scale * 0.8));
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: GLOW_TEX,
        color,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    halo.scale.setScalar(1.6 * scale);
    mesh.add(halo);
    mesh.position.copy(origin);
    this.scene.add(mesh);
    this.projectiles.push({
      mesh,
      vel: dir.clone().multiplyScalar(24),
      dmg,
      life: 4,
      color,
    });
  }

  slowmo(duration) {
    this.targetTimeScale = 0.32;
    clearTimeout(this._slowT);
    this._slowT = setTimeout(() => (this.targetTimeScale = 1), duration * 1000);
  }

  /* ================================================================
     buffs
     ================================================================ */

  hasBuff(id) {
    return this.buffs.some((b) => b.id === id);
  }

  addBuff(id, label, icon, dur) {
    const existing = this.buffs.find((b) => b.id === id);
    if (existing) existing.t = Math.max(existing.t, dur);
    else this.buffs.push({ id, label, icon, t: dur });
  }

  collectPickup(p) {
    sfx.pickup();
    const pos = p.group.position.clone();
    this.fx.explode(pos, p.color, 0.7);
    this.fx.floatText(pos.clone().setY(2), p.type.label, p.color);
    this.hud.feed(p.type.label, 'good');

    switch (p.type.id) {
      case 'shield':
        this.heal(35);
        break;
      case 'ammo':
        this.loadout.forEach((s) => {
          s.ammo = this.magSize(s);
          s.reloading = false;
          s.reloadT = 0;
        });
        this.refreshVitals();
        break;
      case 'damage':
        this.addBuff('damage', 'DMG×2', '⚡', p.type.dur);
        break;
      case 'rapid':
        this.addBuff('rapid', 'RAPID', '🔥', p.type.dur);
        break;
      case 'nuke': {
        this.hud.announce('GRID PURGE', 'ALL HOSTILES BURNED', 'danger');
        this.fx.ring(this.player.pos.clone().setY(0.2), p.color, 60, 0.9);
        this.shake(0.5, 0.05);
        [...this.enemies].forEach((e) => {
          if (e.spawnT > 0) return;
          e.damage(e.boss ? e.maxhp * 0.35 : 99999, false, e.group.position.clone().setY(1.2), {
            silent: true,
          });
        });
        break;
      }
    }
  }

  /* ================================================================
     movement
     ================================================================ */

  movePlayer(dt) {
    const p = this.player;
    const input = this.input;
    if (!input) return;

    input.sample();
    const look = input.consumeLook();
    p.yaw += look.x;
    p.pitch = Math.max(-1.45, Math.min(1.45, p.pitch + look.y));

    const edges = input.consumeEdges();
    if (edges.reload) this.tryReload();
    if (edges.weapon === 'next') this.cycleWeapon(1);
    else if (edges.weapon === 'prev') this.cycleWeapon(-1);
    else if (typeof edges.weapon === 'number') this.equip(edges.weapon);

    const m = p.mods;
    const adrenBoost = p.adrenT > 0 ? 1 + m.adrenaline : 1;
    const adsSlow = input.ads ? 0.55 : 1;
    const baseSpeed = (input.sprint ? 9.2 : 5.6) * m.speedMul * adrenBoost * adsSlow;

    const fwd = new THREE.Vector3(Math.sin(p.yaw), 0, Math.cos(p.yaw)).negate();
    const right = new THREE.Vector3().crossVectors(fwd, new THREE.Vector3(0, 1, 0));
    const move = new THREE.Vector3()
      .addScaledVector(fwd, input.move.z)
      .addScaledVector(right, input.move.x);
    const moving = move.lengthSq() > 0.001;
    if (move.lengthSq() > 1) move.normalize();

    // dash
    if (edges.dash && p.dashCharges > 0 && p.dashT <= 0) {
      p.dashCharges--;
      p.dashT = 0.17;
      p.iframes = 0.26;
      p.dashDir.copy(moving ? move : fwd).normalize();
      sfx.dash();
      this.fx.ring(p.pos.clone().setY(0.15), neon(2), 4, 0.4);
      this.shake(0.12, 0.02);
    }

    if (p.dashT > 0) {
      p.dashT -= dt;
      p.vel.x = p.dashDir.x * 30;
      p.vel.z = p.dashDir.z * 30;
    } else {
      p.vel.x += (move.x * baseSpeed - p.vel.x) * Math.min(1, dt * 12);
      p.vel.z += (move.z * baseSpeed - p.vel.z) * Math.min(1, dt * 12);
    }

    if (p.dashCharges < m.dashCharges) {
      p.dashRecharge += dt;
      if (p.dashRecharge >= m.dashCd) {
        p.dashRecharge = 0;
        p.dashCharges++;
      }
    } else {
      p.dashRecharge = 0;
    }

    if (edges.jump && p.onGround) {
      p.vel.y = 8.2;
      p.onGround = false;
      sfx.jump();
    }
    p.vel.y -= 24 * dt;

    let nx = p.pos.x + p.vel.x * dt;
    let ny = p.pos.y + p.vel.y * dt;
    let nz = p.pos.z + p.vel.z * dt;

    if (ny <= p.eye) {
      ny = p.eye;
      p.vel.y = 0;
      if (!p.onGround) {
        sfx.land();
        this.landDip = 0.11;
        this.shake(0.06, 0.008);
      }
      p.onGround = true;
    } else {
      p.onGround = false;
    }

    [nx, nz] = resolveCollisions(this.colliders, nx, nz, p.radius);
    nx = Math.max(-ARENA, Math.min(ARENA, nx));
    nz = Math.max(-ARENA, Math.min(ARENA, nz));
    p.pos.set(nx, ny, nz);

    // view bob / camera
    const sprinting = input.sprint && moving;
    if (moving && p.onGround) this.bobT += dt * (sprinting ? 13 : 9);
    const bobbing = moving && p.onGround ? 1 : 0;
    const bob = Math.sin(this.bobT) * 0.035 * bobbing;
    const sway = Math.cos(this.bobT * 0.5) * 0.02 * bobbing;
    this.landDip = Math.max(0, this.landDip - dt * 0.5);

    this.camera.position.copy(p.pos);
    this.camera.position.y += bob - this.landDip;
    this.camera.rotation.order = 'YXZ';
    this.camera.rotation.y = p.yaw;
    this.camera.rotation.x = p.pitch + this.recoil;
    this.camera.rotation.z = sway * 0.4;

    const targetFov = input.ads ? 52 : sprinting ? 82 : 75;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 9);
    this.camera.updateProjectionMatrix();

    // viewmodel
    const slot = this.loadout[this.activeWeapon];
    const adsPull = input.ads ? 1 : 0;
    const reloadDip = slot.reloading ? 0.18 : 0;
    const reloadWobble = slot.reloading ? Math.sin(this.clock.elapsedTime * 20) * 0.012 : 0;
    this.gunGroup.position.x += (0.26 * (1 - adsPull) + sway - this.gunGroup.position.x) * Math.min(1, dt * 14);
    this.gunGroup.position.y +=
      (-0.22 + adsPull * 0.09 + bob * 0.6 - reloadDip + reloadWobble - this.gunGroup.position.y) *
      Math.min(1, dt * 14);
    this.gunGroup.position.z = -0.78 + this.gunKick * 0.1 + adsPull * 0.14;
    this.gunGroup.rotation.x = this.gunKick * 0.35 + reloadDip * 2.6;
    this.gunGroup.rotation.y = 0.06 * (1 - adsPull);
    this.hud.setAds(input.ads);
  }

  /* ================================================================
     per-frame systems
     ================================================================ */

  updateWeapons(dt) {
    const slot = this.loadout[this.activeWeapon];
    const def = slot.def;

    this.loadout.forEach((s) => {
      // every slot cools down, not just the equipped one — otherwise swapping
      // away mid-cooldown freezes that weapon's timer until you come back
      if (s.cd > 0) s.cd -= dt;
      if (!s.reloading) return;
      s.reloadT -= dt;
      if (s.reloadT <= 0) {
        s.reloading = false;
        s.ammo = this.magSize(s);
        sfx.reload();
        if (s === slot) this.refreshVitals();
      }
    });

    const firing = !!this.input?.firing;

    if (def.charge > 0) {
      if (firing && !slot.reloading && slot.ammo > 0) {
        if (slot.charge === 0) sfx.charge();
        slot.charge = Math.min(def.charge, slot.charge + dt);
      } else if (slot.charge > 0) {
        const power = Math.max(0.35, slot.charge / def.charge);
        slot.charge = 0;
        this.shoot(power);
      }
      this.hud.setCharge(slot.charge / def.charge);
    } else {
      this.hud.setCharge(0);
      if (firing) {
        if (def.auto) this.shoot();
        else if (!this._firePressed) this.shoot();
      }
    }
    this._firePressed = firing;
  }

  updateProjectiles(dt) {
    const p = this.player;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const pr = this.projectiles[i];
      pr.mesh.position.addScaledVector(pr.vel, dt);
      pr.life -= dt;

      let done = pr.life <= 0 || pr.mesh.position.y < 0.1;

      if (!done && pr.mesh.position.distanceTo(p.pos) < 0.95) {
        this.hurtPlayer(pr.dmg, null);
        this.fx.explode(pr.mesh.position.clone(), pr.color, 0.6);
        done = true;
      }
      if (!done) {
        const [cx, cz] = resolveCollisions(
          this.colliders,
          pr.mesh.position.x,
          pr.mesh.position.z,
          0.25
        );
        if (Math.abs(cx - pr.mesh.position.x) > 0.001 || Math.abs(cz - pr.mesh.position.z) > 0.001) {
          this.fx.burst(pr.mesh.position, pr.color, 6);
          done = true;
        }
      }

      if (done) {
        this.scene.remove(pr.mesh);
        disposeObject(pr.mesh);
        this.projectiles.splice(i, 1);
      }
    }
  }

  updatePickups(dt, t) {
    const grabR = this.player.mods.pickupRadius;
    for (let i = this.pickups.length - 1; i >= 0; i--) {
      const pk = this.pickups[i];
      pk.update(dt, t);
      const d = pk.group.position.distanceTo(this.player.pos);
      if (d < grabR) {
        this.collectPickup(pk);
        pk.dispose();
        this.pickups.splice(i, 1);
      } else if (pk.life <= 0) {
        pk.dispose();
        this.pickups.splice(i, 1);
      }
    }
  }

  updateBuffs(dt) {
    let changed = false;
    for (let i = this.buffs.length - 1; i >= 0; i--) {
      this.buffs[i].t -= dt;
      if (this.buffs[i].t <= 0) {
        this.buffs.splice(i, 1);
        changed = true;
      }
    }
    this.hud.setBuffs(this.buffs);
    if (changed) this.refreshVitals();
  }

  updateSpawns(dt) {
    for (let i = this.spawnQueue.length - 1; i >= 0; i--) {
      this.spawnQueue[i].t -= dt;
      if (this.spawnQueue[i].t <= 0) {
        this.spawnEnemy(this.spawnQueue[i].typeId);
        this.spawnQueue.splice(i, 1);
      }
    }
  }

  /* ================================================================
     loop
     ================================================================ */

  _loop() {
    requestAnimationFrame(this._loop);
    const raw = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;

    this.timeScale += (this.targetTimeScale - this.timeScale) * Math.min(1, raw * 6);
    const dt = raw * this.timeScale;

    if (this.mode === 'playing') {
      const p = this.player;
      if (p.iframes > 0) p.iframes -= raw;
      if (p.adrenT > 0) p.adrenT -= raw;
      if (p.mods.regen > 0 && p.hp < this.maxHp()) this.heal(p.mods.regen * dt);

      this.movePlayer(dt);
      this.updateWeapons(dt);
      this.updateSpawns(dt);
      for (const e of [...this.enemies]) e.update(dt, t);
      this.updateProjectiles(dt);
      this.updatePickups(dt, t);
      this.updateBuffs(raw);

      if (this.comboT > 0) {
        this.comboT -= raw;
        this.hud.setCombo(this.combo, this.comboT, COMBO_WINDOW);
        if (this.comboT <= 0) {
          this.combo = 0;
          this.hud.setCombo(0, 0, 1);
        }
      }
      if (this.boss) this.hud.setBoss(this.boss.dead ? null : this.boss);
      if (settings.showRadar) this.hud.drawRadar(this.player, this.enemies, this.pickups);
    } else if (this.mode === 'menu') {
      this.updateMenuCamera(raw);
    }

    // decay shared feel values on real time so pausing doesn't freeze them oddly
    this.recoil *= Math.pow(0.0001, raw);
    if (this.recoil < 0.0001) this.recoil = 0;
    this.gunKick *= Math.pow(0.0005, raw);
    this.muzzleLight.intensity *= Math.pow(0.0001, raw);
    if (this.muzzleLight.intensity < 0.6) this.muzzle.visible = false;

    if (this.shakeT > 0) {
      this.shakeT -= raw;
      this.camera.position.x += rng(-1, 1) * this.shakeAmp;
      this.camera.position.y += rng(-1, 1) * this.shakeAmp;
      if (this.shakeT <= 0) this.shakeAmp = 0;
    }

    this.spinners.forEach((fn) => fn(t));
    this.fx.update(this.mode === 'playing' ? dt : raw);

    this.renderer.render(this.scene, this.camera);
  }

  /** Slow orbit around the arena behind the menus. */
  updateMenuCamera(dt) {
    this.menuAngle += dt * 0.09;
    const r = 34;
    this.camera.position.set(
      Math.cos(this.menuAngle) * r,
      9 + Math.sin(this.menuAngle * 0.7) * 2.5,
      Math.sin(this.menuAngle) * r
    );
    this.camera.lookAt(0, 5, 0);
    this.camera.fov = 68;
    this.camera.updateProjectionMatrix();
    this.gunGroup.visible = false;
  }

  setPlayView() {
    this.gunGroup.visible = true;
  }
}

export { WEAPONS, ENEMY_TYPES };
