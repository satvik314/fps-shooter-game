/**
 * Blocky neon avatar — the "Glowbot" chassis every enemy is built from.
 * Parts are individually addressable so a kill can blow them apart as debris.
 */

import * as THREE from 'three';
import { theme, themeId, neon, onThemeChange } from '../core/theme.js';
import { haloSprite, neonEdges, bodyMaterial } from './gfx.js';

const FACE_CACHE = new Map();
const faceMats = []; // { mat, idx, mood }

const MOODS = {
  normal: (g, hex) => {
    g.beginPath();
    g.ellipse(42, 52, 7, 11, 0, 0, 7);
    g.fill();
    g.beginPath();
    g.ellipse(86, 52, 7, 11, 0, 0, 7);
    g.fill();
    g.lineWidth = 6;
    g.strokeStyle = hex;
    g.beginPath();
    g.moveTo(28, 34);
    g.lineTo(52, 44);
    g.stroke();
    g.beginPath();
    g.moveTo(100, 34);
    g.lineTo(76, 44);
    g.stroke();
    g.beginPath();
    g.arc(64, 96, 18, Math.PI * 1.15, Math.PI * 1.85);
    g.stroke();
  },
  rage: (g, hex) => {
    g.beginPath();
    g.moveTo(28, 40);
    g.lineTo(54, 58);
    g.lineTo(28, 62);
    g.fill();
    g.beginPath();
    g.moveTo(100, 40);
    g.lineTo(74, 58);
    g.lineTo(100, 62);
    g.fill();
    g.lineWidth = 7;
    g.strokeStyle = hex;
    g.beginPath();
    g.moveTo(40, 100);
    g.lineTo(64, 88);
    g.lineTo(88, 100);
    g.stroke();
  },
  visor: (g, hex) => {
    g.fillRect(20, 44, 88, 18);
    g.lineWidth = 5;
    g.strokeStyle = hex;
    g.beginPath();
    g.moveTo(36, 92);
    g.lineTo(92, 92);
    g.stroke();
  },
  boss: (g, hex) => {
    g.beginPath();
    g.moveTo(24, 36);
    g.lineTo(58, 56);
    g.lineTo(24, 66);
    g.fill();
    g.beginPath();
    g.moveTo(104, 36);
    g.lineTo(70, 56);
    g.lineTo(104, 66);
    g.fill();
    g.lineWidth = 5;
    g.strokeStyle = hex;
    for (let i = 0; i < 5; i++) {
      g.beginPath();
      g.moveTo(30 + i * 17, 84);
      g.lineTo(38 + i * 17, 104);
      g.stroke();
    }
  },
};

function faceTexture(idx, mood) {
  const key = `${themeId()}|${idx}|${mood}`;
  if (FACE_CACHE.has(key)) return FACE_CACHE.get(key);
  const hex = '#' + neon(idx).toString(16).padStart(6, '0');
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  g.fillStyle = theme().faceBg;
  g.fillRect(0, 0, 128, 128);
  g.fillStyle = hex;
  g.shadowColor = hex;
  g.shadowBlur = 14;
  (MOODS[mood] || MOODS.normal)(g, hex);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  FACE_CACHE.set(key, tex);
  return tex;
}

function faceMaterial(idx, mood) {
  const tex = faceTexture(idx, mood);
  const m = new THREE.MeshStandardMaterial({
    map: tex,
    emissive: 0xffffff,
    emissiveMap: tex,
    emissiveIntensity: 0.9 * theme().emissiveScale,
    roughness: 0.6,
  });
  faceMats.push({ mat: m, idx, mood });
  return m;
}

onThemeChange((t) => {
  faceMats.forEach((f) => {
    const tex = faceTexture(f.idx, f.mood);
    f.mat.map = tex;
    f.mat.emissiveMap = tex;
    f.mat.emissiveIntensity = 0.9 * t.emissiveScale;
    f.mat.needsUpdate = true;
  });
});

/**
 * @param {number} scale  body scale multiplier
 * @param {number} idx    neon accent index
 * @param {string} mood   face variant
 */
export function makeAvatar(scale = 1, idx = 0, mood = 'normal') {
  const s = scale;
  const bodyMat = bodyMaterial(idx, 0.35);
  const limbMat = bodyMaterial(idx, 0.2);
  const faceMat = faceMaterial(idx, mood);

  const g = new THREE.Group();
  const headMats = [bodyMat, bodyMat, bodyMat, bodyMat, faceMat, bodyMat];
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.75 * s, 0.75 * s, 0.75 * s), headMats);
  head.position.y = 2.05 * s;
  neonEdges(head, idx);

  const torso = new THREE.Mesh(new THREE.BoxGeometry(1 * s, 1.05 * s, 0.55 * s), bodyMat);
  torso.position.y = 1.15 * s;
  neonEdges(torso, idx);

  const halo = haloSprite(idx, 3.2 * s);
  halo.position.y = 1.3 * s;
  g.add(halo);

  const mk = (w, h, d) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w * s, h * s, d * s), limbMat);
    neonEdges(m, idx);
    return m;
  };

  const armL = new THREE.Group();
  const armR = new THREE.Group();
  const la = mk(0.32, 0.95, 0.45);
  la.position.y = -0.45 * s;
  armL.add(la);
  const ra = mk(0.32, 0.95, 0.45);
  ra.position.y = -0.45 * s;
  armR.add(ra);
  armL.position.set(-0.68 * s, 1.62 * s, 0);
  armR.position.set(0.68 * s, 1.62 * s, 0);

  const legL = new THREE.Group();
  const legR = new THREE.Group();
  const ll = mk(0.4, 1, 0.45);
  ll.position.y = -0.5 * s;
  legL.add(ll);
  const rl = mk(0.4, 1, 0.45);
  rl.position.y = -0.5 * s;
  legR.add(rl);
  legL.position.set(-0.26 * s, 0.62 * s, 0);
  legR.position.set(0.26 * s, 0.62 * s, 0);

  g.add(head, torso, armL, armR, legL, legR);

  return {
    group: g,
    head,
    torso,
    armL,
    armR,
    legL,
    legR,
    halo,
    idx,
    color: neon(idx),
    parts: [head, torso, armL, armR, legL, legR],
    scale: s,
  };
}
