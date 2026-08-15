/**
 * Weapon definitions + first-person models.
 *
 * Every gun is a data blob (feel + ballistics) plus a `build()` that returns a
 * viewmodel group. Runtime state (ammo, cooldown) lives on the loadout slot in
 * game.js, never in here.
 */

import * as THREE from 'three';
import { neonEdges, bodyMaterial, gunMaterial } from '../world/gfx.js';
import { sfx } from '../core/audio.js';

function frame(idx) {
  return { dark: gunMaterial(), lit: bodyMaterial(idx, 0.9) };
}

export const WEAPONS = [
  {
    id: 'pulse',
    name: 'PULSE RIFLE',
    short: 'PULSE',
    slot: 1,
    idx: 0,
    unlockWave: 1,
    mag: 24,
    auto: true,
    fireRate: 0.11,
    reloadTime: 0.85,
    pellets: 1,
    spread: 0.008,
    adsSpread: 0.002,
    dmg: [22, 32],
    headMult: 2.3,
    range: 90,
    recoil: 0.028,
    kick: 1,
    shake: 0.012,
    pierce: 0,
    charge: 0,
    tracerWidth: 0,
    sound: () => sfx.shoot(),
    build(idx) {
      const g = new THREE.Group();
      const { dark, lit } = frame(idx);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.16, 0.55), dark);
      neonEdges(body, idx);
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.07, 0.35), dark);
      barrel.position.set(0, 0.05, -0.42);
      neonEdges(barrel, idx);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.12), dark);
      grip.position.set(0, -0.15, 0.14);
      grip.rotation.x = 0.3;
      neonEdges(grip, idx);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.16, 0.1), lit);
      mag.position.set(0, -0.14, -0.05);
      const sight = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.03), lit);
      sight.position.set(0, 0.12, -0.2);
      g.add(body, barrel, grip, mag, sight);
      return g;
    },
  },
  {
    id: 'scatter',
    name: 'SCATTERGUN',
    short: 'SCATTER',
    slot: 2,
    idx: 1,
    unlockWave: 2,
    mag: 6,
    auto: false,
    fireRate: 0.55,
    reloadTime: 1.2,
    pellets: 9,
    spread: 0.055,
    adsSpread: 0.032,
    dmg: [12, 19],
    headMult: 1.7,
    range: 34,
    recoil: 0.075,
    kick: 2.1,
    shake: 0.03,
    pierce: 0,
    charge: 0,
    tracerWidth: 0,
    sound: () => sfx.shotgun(),
    build(idx) {
      const g = new THREE.Group();
      const { dark, lit } = frame(idx);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.16, 0.18, 0.5), dark);
      neonEdges(body, idx);
      const b1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.42), dark);
      b1.position.set(-0.045, 0.045, -0.44);
      neonEdges(b1, idx);
      const b2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.42), dark);
      b2.position.set(0.045, 0.045, -0.44);
      neonEdges(b2, idx);
      const pump = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.09, 0.16), lit);
      pump.position.set(0, -0.04, -0.3);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.16), dark);
      stock.position.set(0, -0.14, 0.18);
      stock.rotation.x = 0.25;
      neonEdges(stock, idx);
      g.add(body, b1, b2, pump, stock);
      return g;
    },
  },
  {
    id: 'sniper',
    name: 'LONGSHOT',
    short: 'SNIPER',
    slot: 3,
    idx: 3,
    unlockWave: 3,
    mag: 5,
    auto: false,
    fireRate: 1.1,
    reloadTime: 1.6,
    pellets: 1,
    spread: 0.045, // punishing from the hip
    adsSpread: 0, // pinpoint once scoped
    dmg: [90, 120],
    headMult: 3,
    range: 220,
    recoil: 0.13,
    kick: 2.4,
    shake: 0.05,
    pierce: 2,
    charge: 0,
    tracerWidth: 0.045,
    adsFov: 24, // heavy scope zoom
    scope: true,
    instantHeadshot: true, // a head hit drops anything short of a boss outright
    sound: () => sfx.sniper(),
    build(idx) {
      const g = new THREE.Group();
      const { dark, lit } = frame(idx);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.11, 0.13, 0.66), dark);
      neonEdges(body, idx);
      const barrel = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.78), dark);
      barrel.position.set(0, 0.03, -0.66);
      neonEdges(barrel, idx);
      const brake = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 0.1), lit);
      brake.position.set(0, 0.03, -1.02);
      const scopeTube = new THREE.Mesh(
        new THREE.CylinderGeometry(0.042, 0.042, 0.34, 12),
        dark
      );
      scopeTube.rotation.x = Math.PI / 2;
      scopeTube.position.set(0, 0.15, -0.12);
      neonEdges(scopeTube, idx);
      const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.038, 0.038, 0.02, 12), lit);
      lens.rotation.x = Math.PI / 2;
      lens.position.set(0, 0.15, -0.3);
      const mount = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.06, 0.16), dark);
      mount.position.set(0, 0.1, -0.12);
      const mag = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.13, 0.09), lit);
      mag.position.set(0, -0.11, -0.08);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.2, 0.11), dark);
      grip.position.set(0, -0.15, 0.12);
      grip.rotation.x = 0.3;
      neonEdges(grip, idx);
      const stock = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.15, 0.24), dark);
      stock.position.set(0, -0.05, 0.36);
      neonEdges(stock, idx);
      const bipodL = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.16, 0.015), dark);
      bipodL.position.set(-0.05, -0.11, -0.5);
      bipodL.rotation.z = 0.32;
      const bipodR = bipodL.clone();
      bipodR.position.x = 0.05;
      bipodR.rotation.z = -0.32;
      g.add(body, barrel, brake, scopeTube, lens, mount, mag, grip, stock, bipodL, bipodR);
      return g;
    },
  },
  {
    id: 'rail',
    name: 'RAILGUN',
    short: 'RAIL',
    slot: 4,
    idx: 4,
    unlockWave: 4,
    mag: 4,
    auto: false,
    fireRate: 0.85,
    reloadTime: 1.5,
    pellets: 1,
    spread: 0,
    adsSpread: 0,
    dmg: [110, 150],
    headMult: 2.2,
    range: 160,
    recoil: 0.11,
    kick: 2.6,
    shake: 0.045,
    pierce: 6, // punches through a whole line of enemies
    charge: 0.45, // seconds of hold before it discharges
    tracerWidth: 0.09,
    sound: () => sfx.rail(),
    build(idx) {
      const g = new THREE.Group();
      const { dark, lit } = frame(idx);
      const body = new THREE.Mesh(new THREE.BoxGeometry(0.13, 0.14, 0.7), dark);
      neonEdges(body, idx);
      const rail1 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.62), lit);
      rail1.position.set(-0.06, 0.055, -0.34);
      const rail2 = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.025, 0.62), lit);
      rail2.position.set(0.06, 0.055, -0.34);
      const coil = new THREE.Mesh(new THREE.TorusGeometry(0.085, 0.016, 6, 14), lit);
      coil.position.set(0, 0.04, -0.4);
      const grip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.22, 0.12), dark);
      grip.position.set(0, -0.17, 0.16);
      grip.rotation.x = 0.28;
      neonEdges(grip, idx);
      const scope = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.26), dark);
      scope.position.set(0, 0.13, -0.02);
      neonEdges(scope, idx);
      g.add(body, rail1, rail2, coil, grip, scope);
      return g;
    },
  },
];

export const weaponById = (id) => WEAPONS.find((w) => w.id === id);

/** Fresh runtime state for every weapon, used on game reset. */
export function makeLoadout() {
  return WEAPONS.map((w) => ({
    def: w,
    ammo: w.mag,
    reloading: false,
    reloadT: 0,
    cd: 0,
    charge: 0,
    unlocked: w.unlockWave <= 1,
    model: null,
  }));
}
