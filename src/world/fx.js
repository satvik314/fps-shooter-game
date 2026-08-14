/**
 * Transient visual effects: debris chunks, spark bursts, floating damage
 * numbers, tracers, shockwave rings and short-lived point lights.
 * One `update(dt)` drives every pool.
 */

import * as THREE from 'three';
import { theme, neon } from '../core/theme.js';
import { rng, releaseMaterial } from './gfx.js';

/* Shared geometries — never disposed with an individual effect. */
const PART_GEO = new THREE.BoxGeometry(0.09, 0.09, 0.09);
const RING_GEO = new THREE.RingGeometry(0.6, 0.85, 32);
const SHARED_GEO = new Set([PART_GEO, RING_GEO]);

/* Hard ceilings. A big wave dying at once can otherwise put thousands of
   individually-drawn objects in the scene and tank the framerate on weak
   hardware; the oldest effects are retired to make room. */
const CAPS = {
  particles: 260,
  debris: 140,
  dmgNums: 40,
  tracers: 60,
  rings: 40,
  lights: 14,
  texts: 12,
};

export class FX {
  constructor(scene) {
    this.scene = scene;
    this.debris = [];
    this.particles = [];
    this.dmgNums = [];
    this.tracers = [];
    this.lights = [];
    this.rings = [];
    this.texts = [];
  }

  /* ---------------- lifetime plumbing ---------------- */

  /** Detach one effect object and free everything it uniquely owns. */
  _release(o) {
    this.scene.remove(o);
    if (o.isLight) return;
    o.traverse?.((child) => {
      if (child.geometry && !SHARED_GEO.has(child.geometry)) child.geometry.dispose();
      const mats = Array.isArray(child.material)
        ? child.material
        : child.material
          ? [child.material]
          : [];
      mats.forEach((m) => {
        releaseMaterial(m);
        // avatar limbs share one material across parts that expire separately
        if (m.userData?.disposed) return;
        if (m.userData) m.userData.disposed = true;
        m.map?.dispose?.();
        m.dispose?.();
      });
    });
  }

  /** Drop an entry at `index` from a pool. */
  _remove(list, index, key) {
    this._release(list[index][key]);
    list.splice(index, 1);
  }

  /** Retire the oldest entries once a pool is over its ceiling. */
  _cap(list, max, key) {
    while (list.length > max) this._remove(list, 0, key);
  }

  /* ---------------- spawners ---------------- */

  burst(pos, colorHex, n = 8, speed = 1) {
    for (let i = 0; i < n; i++) {
      const m = new THREE.Mesh(
        PART_GEO,
        new THREE.MeshBasicMaterial({
          color: colorHex,
          blending: THREE.AdditiveBlending,
          transparent: true,
          depthWrite: false,
        })
      );
      m.position.copy(pos);
      this.scene.add(m);
      this.particles.push({
        mesh: m,
        vel: new THREE.Vector3(rng(-3, 3), rng(1, 5), rng(-3, 3)).multiplyScalar(speed),
        life: rng(0.3, 0.7),
      });
    }
    this._cap(this.particles, CAPS.particles, 'mesh');
  }

  /** Blow an avatar's limbs off as physics debris. */
  gib(parts, group, origin) {
    parts.forEach((p) => {
      const wp = new THREE.Vector3();
      p.getWorldPosition(wp);
      const wq = new THREE.Quaternion();
      p.getWorldQuaternion(wq);
      group.remove(p);
      p.position.copy(wp);
      p.quaternion.copy(wq);
      this.scene.add(p);
      const dir = wp.clone().sub(origin).setY(0).normalize();
      this.debris.push({
        mesh: p,
        vel: new THREE.Vector3(
          dir.x * rng(2, 5) + rng(-1, 1),
          rng(4, 8),
          dir.z * rng(2, 5) + rng(-1, 1)
        ),
        rot: new THREE.Vector3(rng(-6, 6), rng(-6, 6), rng(-6, 6)),
        life: rng(1.4, 2.2),
      });
    });
    this._cap(this.debris, CAPS.debris, 'mesh');
  }

  damageNumber(pos, amount, crit) {
    const t = theme();
    const c = document.createElement('canvas');
    c.width = 160;
    c.height = 72;
    const g = c.getContext('2d');
    g.font = '900 46px "Courier New", monospace';
    g.textAlign = 'center';
    g.shadowColor = crit ? t.dmgCrit : t.dmgColor;
    g.shadowBlur = 16;
    g.fillStyle = crit ? t.dmgCrit : t.dmgColor;
    g.fillText(String(amount), 80, 52);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    );
    s.scale.set(crit ? 1.7 : 1.1, crit ? 0.77 : 0.5, 1);
    s.position.copy(pos).add(new THREE.Vector3(rng(-0.2, 0.2), 0.3, rng(-0.2, 0.2)));
    s.renderOrder = 10;
    this.scene.add(s);
    this.dmgNums.push({ sprite: s, life: 0.8, vy: 1.6 });
    this._cap(this.dmgNums, CAPS.dmgNums, 'sprite');
  }

  /** World-space label, e.g. pickup names. */
  floatText(pos, text, colorHex) {
    const c = document.createElement('canvas');
    c.width = 512;
    c.height = 96;
    const g = c.getContext('2d');
    const hex = '#' + colorHex.toString(16).padStart(6, '0');
    g.font = '900 40px "Courier New", monospace';
    g.textAlign = 'center';
    g.shadowColor = hex;
    g.shadowBlur = 18;
    g.fillStyle = hex;
    g.fillText(text, 256, 62);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false })
    );
    s.scale.set(4.2, 0.8, 1);
    s.position.copy(pos);
    s.renderOrder = 11;
    this.scene.add(s);
    this.texts.push({ sprite: s, life: 1.3, vy: 1.1 });
    this._cap(this.texts, CAPS.texts, 'sprite');
  }

  tracer(from, to, colorHex) {
    const g = new THREE.BufferGeometry().setFromPoints([from, to]);
    const l = new THREE.Line(
      g,
      new THREE.LineBasicMaterial({
        color: colorHex ?? theme().tracer,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.scene.add(l);
    this.tracers.push({ line: l, life: 0.09, max: 0.09 });
    this._cap(this.tracers, CAPS.tracers, 'line');
  }

  /** Fat beam for the railgun — a stretched additive cylinder. */
  beam(from, to, colorHex, radius = 0.08, life = 0.22) {
    const len = new THREE.Vector3().subVectors(to, from).length();
    if (len < 0.01) return;
    const geo = new THREE.CylinderGeometry(radius, radius, len, 8, 1, true);
    geo.translate(0, len / 2, 0);
    geo.rotateX(Math.PI / 2);
    const mesh = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        color: colorHex ?? theme().tracer,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    mesh.position.copy(from);
    mesh.lookAt(to);
    this.scene.add(mesh);
    this.tracers.push({ line: mesh, life, max: life });
    this._cap(this.tracers, CAPS.tracers, 'line');
  }

  ring(pos, colorHex, size = 6, life = 0.5) {
    const m = new THREE.Mesh(
      RING_GEO,
      new THREE.MeshBasicMaterial({
        color: colorHex,
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    m.position.copy(pos);
    m.rotation.x = -Math.PI / 2;
    m.scale.setScalar(0.4);
    this.scene.add(m);
    this.rings.push({ mesh: m, life, max: life, size });
    this._cap(this.rings, CAPS.rings, 'mesh');
  }

  light(pos, colorHex, intensity = 40, dist = 14, life = 0.4) {
    const l = new THREE.PointLight(colorHex, intensity, dist, 2);
    l.position.copy(pos);
    this.scene.add(l);
    this.lights.push({ light: l, life, max: life, intensity });
    this._cap(this.lights, CAPS.lights, 'light');
  }

  /** Big cinematic pop used for kills / explosions. */
  explode(pos, colorHex, scale = 1) {
    this.burst(pos, colorHex, Math.round(18 * scale), 1.3);
    this.ring(pos.clone().setY(0.12), colorHex, 8 * scale, 0.55);
    this.light(pos, colorHex, 60 * scale, 16 * scale, 0.35);
  }

  clear() {
    const pools = [
      [this.debris, 'mesh'],
      [this.particles, 'mesh'],
      [this.dmgNums, 'sprite'],
      [this.texts, 'sprite'],
      [this.tracers, 'line'],
      [this.rings, 'mesh'],
      [this.lights, 'light'],
    ];
    pools.forEach(([list, key]) => {
      while (list.length) this._remove(list, list.length - 1, key);
    });
  }

  /* ---------------- per-frame ---------------- */

  update(dt) {
    for (let i = this.debris.length - 1; i >= 0; i--) {
      const d = this.debris[i];
      d.vel.y -= 18 * dt;
      d.mesh.position.addScaledVector(d.vel, dt);
      d.mesh.rotation.x += d.rot.x * dt;
      d.mesh.rotation.y += d.rot.y * dt;
      d.mesh.rotation.z += d.rot.z * dt;
      if (d.mesh.position.y < 0.1) {
        d.mesh.position.y = 0.1;
        d.vel.y *= -0.35;
        d.vel.x *= 0.7;
        d.vel.z *= 0.7;
      }
      d.life -= dt;
      if (d.life < 0.4) d.mesh.scale.multiplyScalar(Math.pow(0.01, dt));
      if (d.life <= 0) this._remove(this.debris, i, 'mesh');
    }

    for (let i = this.particles.length - 1; i >= 0; i--) {
      const p = this.particles[i];
      p.vel.y -= 12 * dt;
      p.mesh.position.addScaledVector(p.vel, dt);
      p.mesh.rotation.x += 8 * dt;
      p.mesh.rotation.y += 8 * dt;
      p.life -= dt;
      p.mesh.material.opacity = Math.min(1, p.life * 2);
      if (p.life <= 0) this._remove(this.particles, i, 'mesh');
    }

    for (let i = this.dmgNums.length - 1; i >= 0; i--) {
      const d = this.dmgNums[i];
      d.sprite.position.y += d.vy * dt;
      d.vy *= Math.pow(0.2, dt);
      d.life -= dt;
      d.sprite.material.opacity = Math.min(1, d.life * 2);
      if (d.life <= 0) this._remove(this.dmgNums, i, 'sprite');
    }

    for (let i = this.texts.length - 1; i >= 0; i--) {
      const d = this.texts[i];
      d.sprite.position.y += d.vy * dt;
      d.vy *= Math.pow(0.35, dt);
      d.life -= dt;
      d.sprite.material.opacity = Math.min(1, d.life);
      if (d.life <= 0) this._remove(this.texts, i, 'sprite');
    }

    for (let i = this.tracers.length - 1; i >= 0; i--) {
      const tr = this.tracers[i];
      tr.life -= dt;
      if (tr.life <= 0) this._remove(this.tracers, i, 'line');
      else tr.line.material.opacity = (tr.life / tr.max) * 0.9;
    }

    for (let i = this.rings.length - 1; i >= 0; i--) {
      const r = this.rings[i];
      r.life -= dt;
      const k = 1 - r.life / r.max;
      r.mesh.scale.setScalar(0.4 + k * r.size);
      r.mesh.material.opacity = Math.max(0, 0.8 * (1 - k));
      if (r.life <= 0) this._remove(this.rings, i, 'mesh');
    }

    for (let i = this.lights.length - 1; i >= 0; i--) {
      const f = this.lights[i];
      f.life -= dt;
      f.light.intensity = Math.max(0, (f.life / f.max) * f.intensity);
      if (f.life <= 0) this._remove(this.lights, i, 'light');
    }
  }
}

export { neon };
