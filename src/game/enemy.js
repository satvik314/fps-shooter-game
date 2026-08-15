/**
 * Enemies. One class, five archetypes driven by the ENEMY_TYPES table:
 * chasers, sprinters, heavies, ranged casters and the wave-5 boss.
 */

import * as THREE from 'three';
import { makeDoodleAvatar } from '../world/doodleAvatar.js';
import { haloSprite, rng, disposeObject, releaseMaterial } from '../world/gfx.js';
import { resolveCollisions, ARENA } from '../world/arena.js';
import { theme, neon } from '../core/theme.js';
import { sfx } from '../core/audio.js';

export const ENEMY_TYPES = {
  grunt: {
    id: 'grunt',
    name: 'GRIN',
    scale: 1,
    hp: (w) => 60 + w * 12,
    speed: (w) => Math.min(5.2, 2.9 + w * 0.1),
    dmg: 10,
    score: 100,
    mood: 'normal',
    idx: 0,
  },
  zip: {
    id: 'zip',
    name: 'SMOKE RIDER',
    scale: 0.72,
    hp: (w) => 34 + w * 7,
    speed: (w) => Math.min(7.4, 5 + w * 0.14),
    dmg: 7,
    score: 160,
    mood: 'visor',
    idx: 2,
    attackCd: 0.7,
  },
  titan: {
    id: 'titan',
    name: 'GLITCH',
    scale: 1.75,
    hp: (w) => 240 + w * 45,
    speed: () => 2,
    dmg: 24,
    score: 420,
    mood: 'rage',
    idx: 3,
    elite: true,
    knockbackResist: 1,
  },
  seer: {
    id: 'seer',
    name: 'DAWG',
    scale: 1.05,
    hp: (w) => 70 + w * 14,
    speed: (w) => Math.min(3.4, 2.1 + w * 0.06),
    dmg: 14,
    score: 260,
    mood: 'visor',
    idx: 4,
    ranged: true,
    preferred: 16,
    elite: true,
  },
  boss: {
    id: 'boss',
    name: 'RED RONIN',
    scale: 3.1,
    hp: (w) => 1200 + w * 260,
    speed: () => 2.3,
    dmg: 34,
    score: 3000,
    mood: 'boss',
    idx: 1,
    ranged: true,
    preferred: 13,
    boss: true,
    elite: true,
  },
};

function barTexture(pct, colorHex) {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 16;
  const g = c.getContext('2d');
  const hex = '#' + colorHex.toString(16).padStart(6, '0');
  g.fillStyle = 'rgba(0,0,0,.55)';
  g.fillRect(0, 0, 128, 16);
  g.fillStyle = hex;
  g.fillRect(2, 2, Math.max(0, 124 * pct), 12);
  g.strokeStyle = hex;
  g.lineWidth = 2;
  g.strokeRect(1, 1, 126, 14);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

export class Enemy {
  constructor(game, typeId, x, z, wave) {
    const type = ENEMY_TYPES[typeId] || ENEMY_TYPES.grunt;
    this.game = game;
    this.type = type;
    this.typeId = type.id;

    const idx = type.idx ?? Math.floor(Math.random() * 5);
    const av = makeDoodleAvatar(type.id, type.scale, idx);
    this.av = av;
    this.group = av.group;
    this.group.position.set(x, -2.4 * type.scale, z);
    av.setSpawnProgress?.(0);

    this.maxhp = Math.round(type.hp(wave) * (game.difficulty || 1));
    this.hp = this.maxhp;
    this.speed = type.speed(wave);
    this.scale = type.scale;
    this.dmg = type.dmg;
    this.score = type.score;
    this.ranged = !!type.ranged;
    this.boss = !!type.boss;
    this.elite = !!type.elite;

    this.walkPhase = Math.random() * 10;
    this.attackCd = type.attackCd ?? 1;
    this.shootCd = rng(1, 2.4);
    this.summonCd = 8;
    this.dead = false;
    this.flashT = 0;
    this.spawnT = 0.6;
    this.strafe = Math.random() < 0.5 ? 1 : -1;
    this.strafeT = rng(1, 3);
    this.slowT = 0;

    game.scene.add(this.group);

    // teleport-in beam
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.7 * this.scale, 0.7 * this.scale, 10, 10, 1, true),
      new THREE.MeshBasicMaterial({
        color: av.color,
        transparent: true,
        opacity: 0.4,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    beam.position.set(x, 5, z);
    game.scene.add(beam);
    this.beam = beam;

    if (this.elite) {
      this.barTex = barTexture(1, av.color);
      this.bar = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.barTex, transparent: true, depthTest: false })
      );
      this.bar.scale.set(2.2 * this.scale, 0.28 * this.scale, 1);
      this.bar.position.y = 2.9 * this.scale;
      this.bar.renderOrder = 9;
      this.group.add(this.bar);
    }

    if (this.boss) {
      this.crown = haloSprite(1, 9 * this.scale, 1.4);
      this.crown.position.y = 2.2 * this.scale;
      this.group.add(this.crown);
      sfx.boss();
    } else {
      sfx.spawn();
    }

    this.hitMeshes = av.hitMeshes || [];
    if (!this.hitMeshes.length) {
      this.group.traverse((o) => {
        if (o.isMesh && !o.userData.isEdge) this.hitMeshes.push(o);
      });
    }
    this.hitMeshes.forEach((o) => {
      o.userData.enemy = this;
      o.userData.isHead = o === av.head;
    });
  }

  get position() {
    return this.group.position;
  }

  refreshBar() {
    if (!this.bar) return;
    this.bar.material.map?.dispose();
    const tex = barTexture(Math.max(0, this.hp / this.maxhp), this.av.color);
    this.bar.material.map = tex;
    this.bar.material.needsUpdate = true;
  }

  damage(amount, isHead, hitPoint, opts = {}) {
    if (this.dead) return 0;
    const dealt = Math.min(this.hp, amount);
    this.hp -= amount;
    this.flashT = 0.12;
    if (!opts.silent) {
      this.game.fx.damageNumber(hitPoint, Math.round(amount), isHead);
      this.game.fx.burst(hitPoint, this.av.color, isHead ? 14 : 8);
    }
    this.refreshBar();
    if (opts.slow) this.slowT = opts.slow;
    if (this.hp <= 0) this.die(isHead);
    return dealt;
  }

  die(head) {
    if (this.dead) return;
    this.dead = true;
    const origin = this.group.position.clone();

    if (this.bar) {
      this.group.remove(this.bar);
      this.bar.material.map?.dispose();
      this.bar.material.dispose();
      this.bar = null;
    }
    if (this.crown) {
      this.group.remove(this.crown);
      releaseMaterial(this.crown.material);
      this.crown.material.dispose();
      this.crown = null;
    }

    this.game.fx.gib(this.av.parts, this.group, origin);
    this.game.fx.explode(
      origin.clone().setY(1.2 * this.scale),
      this.av.color,
      this.boss ? 3 : this.scale
    );

    this.game.scene.remove(this.group);
    disposeObject(this.group);
    if (this.beam) {
      this.game.scene.remove(this.beam);
      this.beam.geometry.dispose();
      this.beam.material.dispose();
      this.beam = null;
    }
    this.game.onEnemyDeath(this, head, origin);
  }

  /** Removed without a kill credit (game reset / boss despawn). */
  dispose() {
    this.dead = true;
    this.game.scene.remove(this.group);
    disposeObject(this.group);
    if (this.beam) {
      this.game.scene.remove(this.beam);
      this.beam.geometry.dispose();
      this.beam.material.dispose();
      this.beam = null;
    }
  }

  update(dt, t) {
    if (this.dead) return;
    const player = this.game.player;

    // rise out of the floor on spawn
    if (this.spawnT > 0) {
      this.spawnT -= dt;
      const k = 1 - Math.max(this.spawnT, 0) / 0.6;
      this.group.position.y = -2.4 * this.scale * (1 - k);
      this.av.setSpawnProgress?.(k);
      if (this.beam) {
        this.beam.material.opacity = 0.4 * (this.spawnT / 0.6);
        this.beam.scale.x = this.beam.scale.z = 1 + (1 - this.spawnT / 0.6) * 1.5;
        if (this.spawnT <= 0) {
          this.game.scene.remove(this.beam);
          this.beam.geometry.dispose();
          this.beam.material.dispose();
          this.beam = null;
        }
      }
      return;
    }

    this.group.position.y = 0;
    this.av.setSpawnProgress?.(1);
    if (this.slowT > 0) this.slowT -= dt;

    const dx = player.pos.x - this.group.position.x;
    const dz = player.pos.z - this.group.position.z;
    const dist = Math.hypot(dx, dz) || 0.001;
    const dirX = dx / dist;
    const dirZ = dz / dist;
    this.group.rotation.y = Math.atan2(dirX, dirZ);

    const speed = this.speed * (this.slowT > 0 ? 0.45 : 1);

    if (this.ranged) {
      this.updateRanged(dt, t, dirX, dirZ, dist, speed);
    } else {
      this.updateMelee(dt, t, dirX, dirZ, dist, speed);
    }

    // "breathing" halo
    this.av.halo.material.opacity =
      theme().haloOpacity * (0.75 + Math.sin(t * 4 + this.walkPhase) * 0.32);

    if (this.flashT > 0) {
      this.flashT -= dt;
      const on = this.flashT > 0 && Math.floor(this.flashT * 40) % 2 === 0;
      const rest = theme().emissiveScale;
      this.group.traverse((o) => {
        if (o.isMesh && o.material?.emissive && !o.userData.isEdge) {
          o.material.emissiveIntensity = on ? 1.6 : 0.35 * rest;
        }
      });
      this.av.setHitFlash?.(on);
    } else {
      this.av.setHitFlash?.(false);
    }
  }

  updateMelee(dt, t, dirX, dirZ, dist, speed) {
    if (dist > 1.6 * this.scale) {
      this.step(dt, dirX, dirZ, speed);
      this.animateWalk(dt, speed);
    } else {
      this.av.attack?.(t);
      this.attackCd -= dt;
      if (this.attackCd <= 0) {
        this.attackCd = this.type.attackCd ?? 1;
        this.game.hurtPlayer(this.dmg + Math.round(this.scale * 3), this);
        this.group.position.x += dirX * 0.35;
        this.group.position.z += dirZ * 0.35;
      }
    }
  }

  updateRanged(dt, t, dirX, dirZ, dist, speed) {
    const want = this.type.preferred;
    this.strafeT -= dt;
    if (this.strafeT <= 0) {
      this.strafeT = rng(1.2, 3);
      this.strafe *= -1;
    }
    // orbit at preferred range, close in if too far, back off if crowded
    let mx = 0;
    let mz = 0;
    if (dist > want + 2) {
      mx = dirX;
      mz = dirZ;
    } else if (dist < want - 3) {
      mx = -dirX;
      mz = -dirZ;
    }
    mx += -dirZ * this.strafe * 0.8;
    mz += dirX * this.strafe * 0.8;
    const len = Math.hypot(mx, mz) || 1;
    this.step(dt, mx / len, mz / len, speed);
    this.animateWalk(dt, speed);

    this.shootCd -= dt;
    if (this.shootCd <= 0 && dist < 42) {
      this.shootCd = this.boss ? 0.85 : rng(1.6, 2.6);
      this.av.attack?.(t);
      const origin = this.group.position
        .clone()
        .setY(1.7 * this.scale)
        .add(new THREE.Vector3(dirX * 0.8, 0, dirZ * 0.8));
      const shots = this.boss ? 3 : 1;
      for (let i = 0; i < shots; i++) {
        const spread = this.boss ? (i - 1) * 0.16 : 0;
        this.game.spawnProjectile(origin, this.aimAt(spread), this.dmg, this.av.color, this.scale);
      }
    }

    if (this.boss) {
      this.summonCd -= dt;
      if (this.summonCd <= 0) {
        this.summonCd = 11;
        this.game.summonMinions(this.group.position, 3);
      }
    }
  }

  /** Lead the player slightly so projectiles feel aimed, not scripted. */
  aimAt(spreadAngle) {
    const p = this.game.player;
    const target = p.pos
      .clone()
      .add(new THREE.Vector3(p.vel.x, 0, p.vel.z).multiplyScalar(0.28))
      .setY(p.pos.y - 0.2);
    const dir = target.sub(this.group.position.clone().setY(1.7 * this.scale)).normalize();
    if (spreadAngle) dir.applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngle);
    return dir;
  }

  step(dt, dirX, dirZ, speed) {
    let nx = this.group.position.x + dirX * speed * dt;
    let nz = this.group.position.z + dirZ * speed * dt;
    [nx, nz] = resolveCollisions(this.game.colliders, nx, nz, 0.55 * this.scale);
    nx = Math.max(-ARENA + 1, Math.min(ARENA - 1, nx));
    nz = Math.max(-ARENA + 1, Math.min(ARENA - 1, nz));
    this.group.position.x = nx;
    this.group.position.z = nz;
  }

  animateWalk(dt, speed) {
    this.walkPhase += dt * speed * 2.2;
    if (this.av.animateWalk) {
      this.av.animateWalk(this.walkPhase, speed);
      this.group.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.035;
      return;
    }
    const sw = Math.sin(this.walkPhase) * 0.7;
    this.av.armL.rotation.x = sw;
    this.av.armR.rotation.x = -sw;
    this.av.legL.rotation.x = -sw;
    this.av.legR.rotation.x = sw;
    this.group.position.y = Math.abs(Math.sin(this.walkPhase)) * 0.06;
  }
}

/** Wave composition — what spawns, and how much of it. */
export function rollWaveComposition(wave, activeRivals = ['grunt', 'zip', 'titan', 'seer']) {
  const list = [];
  const roster = new Set(['grunt', ...activeRivals.filter((id) => id !== 'boss')]);
  const isBossWave = wave % 5 === 0;
  if (isBossWave) list.push('boss');

  const budget = 3 + Math.floor(wave * 1.35);
  for (let i = 0; i < budget; i++) {
    const r = Math.random();
    let typeId = 'grunt';
    if (wave >= 3 && r < 0.16) typeId = 'zip';
    else if (wave >= 4 && r < 0.28) typeId = 'seer';
    else if (wave >= 3 && r < 0.38) typeId = 'titan';
    list.push(roster.has(typeId) ? typeId : 'grunt');
  }
  return list;
}

export { neon };
