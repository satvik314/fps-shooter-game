/**
 * The wormhole journey.
 *
 * A self-contained three.js scene that borrows the game's renderer for the
 * length of the trip: a tunnel of neon rings rushing past, warp streaks, and a
 * light at the far end that swallows the screen on arrival.
 *
 * Content moves toward the camera and recycles rather than the camera flying
 * forward, so the trip can run indefinitely without drifting into float
 * precision trouble.
 *
 * The tunnel is deliberately theme-independent: it is deep space in both
 * palettes. Its glow relies on additive blending, which renders as flat white
 * over a light background, and "the void is dark" holds either way.
 */

import * as THREE from 'three';

const RING_COUNT = 74;
const RING_GAP = 6;
const TUNNEL_DEPTH = RING_COUNT * RING_GAP;
const STREAK_COUNT = 700;
const STREAK_MIN_R = 3.2; // keep streaks off the flight axis
const STREAK_MAX_R = 12;
const VOID = 0x03030a;
const RING_COLORS = [0x00f0ff, 0xff2fd6, 0xb6ff00, 0xffb300, 0x8b5cf6];
const warpColor = (i) => RING_COLORS[i % RING_COLORS.length];

/** Vertical light streaks, scrolled along the tunnel wall. */
function streakTexture() {
  const c = document.createElement('canvas');
  c.width = 256;
  c.height = 512;
  const g = c.getContext('2d');
  g.clearRect(0, 0, 256, 512);
  for (let i = 0; i < 220; i++) {
    const x = Math.random() * 256;
    const y = Math.random() * 512;
    const h = 40 + Math.random() * 220;
    const w = 1 + Math.random() * 3;
    const hex = '#' + warpColor(Math.floor(Math.random() * RING_COLORS.length)).toString(16).padStart(6, '0');
    const grad = g.createLinearGradient(0, y, 0, y + h);
    grad.addColorStop(0, 'rgba(255,255,255,0)');
    grad.addColorStop(0.5, hex);
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.globalAlpha = 0.4 + Math.random() * 0.6;
    g.fillRect(x, y, w, h);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(4, 2);
  return tex;
}

/** Soft radial glow used for the light at the end of the tunnel. */
function glowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.3, 'rgba(255,255,255,.45)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class Wormhole {
  /**
   * @param {THREE.WebGLRenderer} renderer  shared with the game
   * @param {number} duration               seconds the journey lasts
   */
  constructor(renderer, duration = 7) {
    this.renderer = renderer;
    this.duration = duration;
    this.t = 0;
    this.progress = 0;
    this.speed = 0;
    this.done = false;

    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(80, innerWidth / innerHeight, 0.1, TUNNEL_DEPTH + 80);

    this.glowTex = glowTexture();
    this._build();
  }

  _build() {
    this.scene.background = new THREE.Color(VOID);
    this.scene.fog = new THREE.Fog(VOID, TUNNEL_DEPTH * 0.45, TUNNEL_DEPTH);

    /* ---- tunnel wall ---- */
    this.wallTex = streakTexture();
    this.wall = new THREE.Mesh(
      new THREE.CylinderGeometry(11, 11, TUNNEL_DEPTH, 40, 1, true),
      new THREE.MeshBasicMaterial({
        map: this.wallTex,
        side: THREE.BackSide,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      })
    );
    this.wall.rotation.x = Math.PI / 2;
    this.wall.position.z = -TUNNEL_DEPTH / 2;
    this.scene.add(this.wall);

    /* ---- rings ---- */
    this.ringGeo = new THREE.TorusGeometry(1, 0.038, 6, 40);
    this.rings = [];
    for (let i = 0; i < RING_COUNT; i++) {
      const mat = new THREE.MeshBasicMaterial({
        color: warpColor(i),
        transparent: true,
        opacity: 0.95,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const m = new THREE.Mesh(this.ringGeo, mat);
      m.position.z = -i * RING_GAP;
      m.userData.idx = i;
      m.userData.spin = (i % 2 ? 1 : -1) * (0.2 + (i % 5) * 0.06);
      this.scene.add(m);
      this.rings.push(m);
    }

    /* ---- warp streaks ----
       Line segments rather than point sprites: a sprite with size attenuation
       balloons into bokeh as it passes the camera, which washed the tunnel out
       at high speed. Segments stretch with velocity instead, which is the look
       we actually want. */
    this.streakBase = new Float32Array(STREAK_COUNT * 3); // x, y, z per streak
    const verts = new Float32Array(STREAK_COUNT * 6);
    const cols = new Float32Array(STREAK_COUNT * 6);
    const c = new THREE.Color();
    for (let i = 0; i < STREAK_COUNT; i++) {
      this._seedStreak(i, -Math.random() * TUNNEL_DEPTH);
      c.setHex(warpColor(i));
      for (let v = 0; v < 2; v++) {
        cols[i * 6 + v * 3] = c.r;
        cols[i * 6 + v * 3 + 1] = c.g;
        cols[i * 6 + v * 3 + 2] = c.b;
      }
    }
    this.streakGeo = new THREE.BufferGeometry();
    this.streakGeo.setAttribute('position', new THREE.BufferAttribute(verts, 3));
    this.streakGeo.setAttribute('color', new THREE.BufferAttribute(cols, 3));
    this.streakMat = new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    this.streaks = new THREE.LineSegments(this.streakGeo, this.streakMat);
    this.scene.add(this.streaks);

    /* ---- the light at the end ---- */
    this.exit = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: 0xffffff,
        transparent: true,
        opacity: 0.85,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        depthTest: false,
        fog: false,
      })
    );
    this.exit.position.set(0, 0, -TUNNEL_DEPTH * 0.92);
    this.exit.scale.setScalar(6);
    this.scene.add(this.exit);
  }

  /** Place streak `i` at depth `z` on a fresh random ring position. */
  _seedStreak(i, z) {
    const a = Math.random() * Math.PI * 2;
    const r = STREAK_MIN_R + Math.random() * (STREAK_MAX_R - STREAK_MIN_R);
    this.streakBase[i * 3] = Math.cos(a) * r;
    this.streakBase[i * 3 + 1] = Math.sin(a) * r;
    this.streakBase[i * 3 + 2] = z;
  }

  /** Rewind to the mouth of the tunnel. */
  start() {
    this.t = 0;
    this.progress = 0;
    this.speed = 0;
    this.done = false;
    this.rings.forEach((m, i) => {
      m.position.z = -i * RING_GAP;
    });
    this.camera.fov = 80;
    this.camera.rotation.set(0, 0, 0);
    this.camera.updateProjectionMatrix();
    this.resize();
  }

  resize() {
    this.camera.aspect = innerWidth / innerHeight;
    this.camera.updateProjectionMatrix();
  }

  update(dt) {
    this.t += dt;
    const p = Math.min(1, this.t / this.duration);
    this.progress = p;

    // slow drift out of the gate, then a hard acceleration into the light
    const ease = p * p;
    this.speed = 16 + 300 * ease + (p > 0.86 ? (p - 0.86) * 1400 : 0);

    const travel = this.speed * dt;

    // rings rush past and recycle to the far end
    for (const m of this.rings) {
      m.position.z += travel;
      if (m.position.z > 6) m.position.z -= TUNNEL_DEPTH;
      // the tunnel breathes so it reads as organic rather than a pipe
      const r = 6.4 + Math.sin(m.position.z * 0.028 + this.t * 0.9) * 2.4;
      m.scale.set(r, r, 1);
      m.rotation.z += m.userData.spin * dt;
      // fade only in the last couple of metres, so rings still rush past the
      // camera at full brightness — that's where the speed reads from
      const d = -m.position.z;
      m.material.opacity = Math.max(0, Math.min(1, d / 7)) * (0.6 + 0.4 * (1 - p * 0.35));
    }

    // streaks stream, stretch with velocity, and recycle behind the camera
    const len = Math.max(0.7, Math.min(34, this.speed * 0.075));
    const verts = this.streakGeo.attributes.position.array;
    for (let i = 0; i < STREAK_COUNT; i++) {
      let z = this.streakBase[i * 3 + 2] + travel;
      if (z > 2) {
        this._seedStreak(i, z - TUNNEL_DEPTH);
        z = this.streakBase[i * 3 + 2];
      } else {
        this.streakBase[i * 3 + 2] = z;
      }
      const x = this.streakBase[i * 3];
      const y = this.streakBase[i * 3 + 1];
      verts[i * 6] = x;
      verts[i * 6 + 1] = y;
      verts[i * 6 + 2] = z;
      verts[i * 6 + 3] = x;
      verts[i * 6 + 4] = y;
      verts[i * 6 + 5] = z - len;
    }
    this.streakGeo.attributes.position.needsUpdate = true;

    // wall scroll + swirl
    this.wallTex.offset.y -= travel * 0.006;
    this.wallTex.offset.x += dt * 0.05;

    // the light at the end rushes toward us and swells to fill the screen
    this.exit.position.z = -TUNNEL_DEPTH * (0.92 - 0.72 * p);
    this.exit.scale.setScalar(6 + Math.pow(p, 2.4) * 150);
    this.exit.material.opacity = 0.55 + p * 0.45;

    // camera: roll, wobble, and a widening FOV to sell the speed
    this.camera.rotation.z = Math.sin(this.t * 0.55) * 0.22 + this.t * 0.12;
    this.camera.position.x = Math.sin(this.t * 0.8) * 0.5 * (1 - p);
    this.camera.position.y = Math.cos(this.t * 0.65) * 0.4 * (1 - p);
    const targetFov = 80 + ease * 16;
    this.camera.fov += (targetFov - this.camera.fov) * Math.min(1, dt * 5);
    this.camera.updateProjectionMatrix();

    if (p >= 1) this.done = true;
  }

  render() {
    this.renderer.render(this.scene, this.camera);
  }

  dispose() {
    this.ringGeo.dispose();
    this.rings.forEach((m) => m.material.dispose());
    this.wall.geometry.dispose();
    this.wall.material.dispose();
    this.wallTex.dispose();
    this.streakGeo.dispose();
    this.streakMat.dispose();
    this.exit.material.dispose();
    this.glowTex.dispose();
    this.scene.clear();
  }
}
