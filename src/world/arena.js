/**
 * The arena: neon grid floor, cover pillars, boundary walls and the ambient
 * "crazy neon" set dressing that spins overhead.
 */

import * as THREE from 'three';
import { theme, onThemeChange } from '../core/theme.js';
import { haloSprite, neonEdges, structureMaterial, bodyMaterial, rng } from './gfx.js';

export const ARENA = 60;

/** Where the player drops in, and how much clear ground they get around it. */
export const SPAWN = { x: 0, z: 18 };
const SPAWN_CLEARANCE = 8;

/** True when a box of cover would crowd the drop-in point. */
function crowdsSpawn(x, z, w, d) {
  const dx = Math.max(Math.abs(x - SPAWN.x) - w / 2, 0);
  const dz = Math.max(Math.abs(z - SPAWN.z) - d / 2, 0);
  return Math.hypot(dx, dz) < SPAWN_CLEARANCE;
}

export function buildArena(scene) {
  const colliders = [];
  const spinners = [];
  const solids = []; // raycast targets so bullets stop at cover

  /* ---------------- lighting ---------------- */
  const t0 = theme();
  const ambient = new THREE.AmbientLight(t0.ambient, t0.ambientIntensity);
  const hemi = new THREE.HemisphereLight(t0.hemiSky, t0.hemiGround, t0.hemiIntensity);
  const sun = new THREE.DirectionalLight(t0.sun, t0.sunIntensity);
  sun.position.set(20, 50, 10);
  scene.add(ambient, hemi, sun);

  /* ---------------- ground ---------------- */
  function gridTexture() {
    const t = theme();
    const c = document.createElement('canvas');
    c.width = c.height = 512;
    const g = c.getContext('2d');
    g.fillStyle = t.groundBase;
    g.fillRect(0, 0, 512, 512);
    g.strokeStyle = t.gridLine;
    g.lineWidth = 2;
    for (let i = 0; i <= 8; i++) {
      g.beginPath();
      g.moveTo(i * 64, 0);
      g.lineTo(i * 64, 512);
      g.stroke();
      g.beginPath();
      g.moveTo(0, i * 64);
      g.lineTo(512, i * 64);
      g.stroke();
    }
    g.strokeStyle = t.gridEdge;
    g.lineWidth = 4;
    g.strokeRect(0, 0, 512, 512);
    const tex = new THREE.CanvasTexture(c);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    tex.repeat.set(30, 30);
    return tex;
  }

  const groundMat = new THREE.MeshStandardMaterial({
    map: gridTexture(),
    roughness: 0.9,
    metalness: 0,
    emissive: t0.groundEmissive,
    emissiveIntensity: t0.groundEmissiveIntensity,
  });
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(ARENA * 2 + 40, ARENA * 2 + 40),
    groundMat
  );
  ground.rotation.x = -Math.PI / 2;
  scene.add(ground);
  solids.push(ground);

  /* ---------------- cover ---------------- */
  const darkMat = structureMaterial();

  function pillar(x, z, w, h, d, idx) {
    // never box the player in at the drop-in point — cover there blocks every
    // shot they take in the first seconds of a run
    if (crowdsSpawn(x, z, w, d)) return null;
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), darkMat);
    m.position.set(x, h / 2, z);
    neonEdges(m, idx);
    scene.add(m);
    solids.push(m);
    colliders.push({ minX: x - w / 2, maxX: x + w / 2, minZ: z - d / 2, maxZ: z + d / 2 });
    return m;
  }

  const spots = [];
  for (let gx = -2; gx <= 2; gx++) {
    for (let gz = -2; gz <= 2; gz++) {
      if (Math.abs(gx) + Math.abs(gz) < 1) continue;
      spots.push([gx * 18 + rng(-3, 3), gz * 18 + rng(-3, 3)]);
    }
  }
  spots.forEach(([x, z], i) => {
    const w = rng(3, 6);
    const d = rng(3, 6);
    const h = rng(4, 14);
    if (!pillar(x, z, w, h, d, i)) return;
    if (Math.random() < 0.45) {
      const capH = rng(1, 3);
      const cap = new THREE.Mesh(
        new THREE.BoxGeometry(w * rng(0.5, 0.8), capH, d * rng(0.5, 0.8)),
        darkMat
      );
      cap.position.set(x + rng(-0.6, 0.6), h + capH / 2, z + rng(-0.6, 0.6));
      neonEdges(cap, i + 2);
      scene.add(cap);
      solids.push(cap);
    }
  });

  // low crates ringing spawn — cover you can peek over
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const r = rng(8, 13);
    pillar(Math.cos(a) * r, Math.sin(a) * r, rng(2, 3.4), rng(1.2, 2.2), rng(2, 3.4), 0);
  }

  // boundary walls
  [
    [0, -ARENA - 2, ARENA * 2 + 8, 2],
    [0, ARENA + 2, ARENA * 2 + 8, 2],
    [-ARENA - 2, 0, 2, ARENA * 2 + 8],
    [ARENA + 2, 0, 2, ARENA * 2 + 8],
  ].forEach(([x, z, w, d], i) => {
    const b = new THREE.Mesh(new THREE.BoxGeometry(w, 2.4, d), darkMat);
    b.position.set(x, 1.2, z);
    neonEdges(b, i % 2);
    scene.add(b);
    solids.push(b);
  });

  /* ---------------- ambient neon ---------------- */
  const ring = new THREE.Group();
  for (let i = 0; i < 14; i++) {
    const c = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.6, 1.6), bodyMaterial(i, 0.5));
    const a = (i / 14) * Math.PI * 2;
    c.position.set(Math.cos(a) * 26, 0, Math.sin(a) * 26);
    c.rotation.set(a, a * 2, 0);
    neonEdges(c, i);
    c.add(haloSprite(i, 4));
    ring.add(c);
  }
  ring.position.y = 24;
  scene.add(ring);
  spinners.push((t) => {
    ring.rotation.y = t * 0.08;
    ring.position.y = 24 + Math.sin(t * 0.5) * 1.2;
  });

  for (let i = 0; i < 5; i++) {
    const g = new THREE.Group();
    for (let s = 0; s < 3; s++) {
      const b = new THREE.Mesh(
        new THREE.BoxGeometry(rng(1, 2.4), rng(1, 2.4), rng(1, 2.4)),
        bodyMaterial(i, s === 1 ? 0.6 : 0.05)
      );
      b.position.y = s * 2.2;
      neonEdges(b, i);
      g.add(b);
    }
    g.add(haloSprite(i, 6));
    const a = (i / 5) * Math.PI * 2 + 0.6;
    const r = rng(34, 46);
    g.position.set(Math.cos(a) * r, rng(9, 16), Math.sin(a) * r);
    scene.add(g);
    const ph = Math.random() * 10;
    spinners.push((t) => {
      g.rotation.y = t * 0.4 + ph;
      g.position.y += Math.sin(t * 1.1 + ph) * 0.004;
    });
  }

  const knot = new THREE.Mesh(
    new THREE.TorusKnotGeometry(4, 1.1, 90, 12),
    bodyMaterial(1, 0.9)
  );
  knot.position.set(0, 34, -70);
  knot.add(haloSprite(1, 26));
  scene.add(knot);
  spinners.push((t) => {
    knot.rotation.x = t * 0.3;
    knot.rotation.y = t * 0.2;
  });

  /* ---------------- starfield ---------------- */
  const starGeo = new THREE.BufferGeometry();
  const pos = [];
  for (let i = 0; i < 400; i++) pos.push(rng(-150, 150), rng(20, 120), rng(-150, 150));
  starGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  const starMat = new THREE.PointsMaterial({
    color: t0.starColor,
    size: 0.35,
    transparent: true,
    opacity: t0.starOpacity,
  });
  scene.add(new THREE.Points(starGeo, starMat));

  /* ---------------- theme repaint ---------------- */
  onThemeChange((t) => {
    scene.background = new THREE.Color(t.sky);
    scene.fog.color.setHex(t.fog);
    scene.fog.density = t.fogDensity;
    ambient.color.setHex(t.ambient);
    ambient.intensity = t.ambientIntensity;
    hemi.color.setHex(t.hemiSky);
    hemi.groundColor.setHex(t.hemiGround);
    hemi.intensity = t.hemiIntensity;
    sun.color.setHex(t.sun);
    sun.intensity = t.sunIntensity;
    groundMat.map?.dispose();
    groundMat.map = gridTexture();
    groundMat.emissive.setHex(t.groundEmissive);
    groundMat.emissiveIntensity = t.groundEmissiveIntensity;
    groundMat.needsUpdate = true;
    starMat.color.setHex(t.starColor);
    starMat.opacity = t.starOpacity;
  });

  return { colliders, spinners, solids, ground };
}

/** Push a circle of radius r out of every collider box. Returns [x, z]. */
export function resolveCollisions(colliders, x, z, r) {
  for (const c of colliders) {
    const cx = Math.max(c.minX, Math.min(x, c.maxX));
    const cz = Math.max(c.minZ, Math.min(z, c.maxZ));
    const dx = x - cx;
    const dz = z - cz;
    const d2 = dx * dx + dz * dz;
    if (d2 < r * r) {
      const d = Math.sqrt(d2) || 0.001;
      x = cx + (dx / d) * r;
      z = cz + (dz / d) * r;
    }
  }
  return [x, z];
}
