/**
 * Shared 3D look-and-feel helpers.
 *
 * Everything created here registers itself so a theme flip can repaint the
 * whole scene without rebuilding it. Colours are referenced by *neon index*
 * rather than a literal hex, so the same object picks up the right accent in
 * either palette.
 */

import * as THREE from 'three';
import { theme, neon, onThemeChange } from '../core/theme.js';

/* ---------- registries ---------- */
const edgeMats = []; // { mat, idx }
const haloMats = []; // { mat, idx, base }
const bodyMats = []; // { mat, idx, emissive }
const structureMats = []; // MeshStandardMaterial
const gunMats = []; // viewmodel bodies — tracked separately from world structures

/* ---------- radial glow sprite texture ---------- */
function makeGlowTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const g = c.getContext('2d');
  const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
  gr.addColorStop(0, 'rgba(255,255,255,1)');
  gr.addColorStop(0.25, 'rgba(255,255,255,.5)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}
export const GLOW_TEX = makeGlowTexture();

export const rng = (a, b) => a + Math.random() * (b - a);
export const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

/** Additive halo sprite tinted by neon index. */
export function haloSprite(idx, size, opacityScale = 1) {
  const mat = new THREE.SpriteMaterial({
    map: GLOW_TEX,
    color: neon(idx),
    transparent: true,
    opacity: theme().haloOpacity * opacityScale,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const s = new THREE.Sprite(mat);
  s.scale.setScalar(size);
  haloMats.push({ mat, idx, base: opacityScale });
  return s;
}

/** Wireframe outline welded onto a mesh, tinted by neon index. */
export function neonEdges(mesh, idx) {
  const mat = new THREE.LineBasicMaterial({ color: neon(idx) });
  const e = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry), mat);
  e.userData.isEdge = true;
  mesh.add(e);
  edgeMats.push({ mat, idx });
  return e;
}

/** Matte structural material (walls, pillars) that tracks the palette. */
export function structureMaterial(extra = {}) {
  const t = theme();
  const m = new THREE.MeshStandardMaterial({
    color: t.structure,
    roughness: t.structureRough,
    metalness: 0.05,
    ...extra,
  });
  structureMats.push(m);
  return m;
}

/** Viewmodel chassis material. Kept apart from world structures so the gun
 *  stays readable against either background. */
export function gunMaterial(extra = {}) {
  const m = new THREE.MeshStandardMaterial({
    color: theme().gunBody,
    roughness: 0.5,
    metalness: 0.15,
    ...extra,
  });
  gunMats.push(m);
  return m;
}

/** Emissive body material used by avatars / props. */
export function bodyMaterial(idx, emissiveIntensity = 0.4, extra = {}) {
  const t = theme();
  const m = new THREE.MeshStandardMaterial({
    color: t.bodyBase,
    emissive: neon(idx),
    emissiveIntensity: emissiveIntensity * t.emissiveScale,
    roughness: 0.6,
    ...extra,
  });
  bodyMats.push({ mat: m, idx, emissive: emissiveIntensity });
  return m;
}

/** Forget materials owned by disposed objects so the registries don't grow. */
export function releaseMaterial(mat) {
  for (const list of [edgeMats, haloMats, bodyMats]) {
    const i = list.findIndex((e) => e.mat === mat);
    if (i >= 0) list.splice(i, 1);
  }
  for (const list of [structureMats, gunMats]) {
    const i = list.indexOf(mat);
    if (i >= 0) list.splice(i, 1);
  }
}

/** Recursively dispose a subtree and drop its materials from the registries. */
export function disposeObject(root) {
  root.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    const mats = Array.isArray(o.material) ? o.material : o.material ? [o.material] : [];
    mats.forEach((m) => {
      releaseMaterial(m);
      // avatar limbs share one material and expire at different times
      if (m.userData?.disposed) return;
      if (m.userData) m.userData.disposed = true;
      m.dispose?.();
    });
  });
}

/* ---------- repaint on theme change ---------- */
onThemeChange((t) => {
  edgeMats.forEach(({ mat, idx }) => mat.color.setHex(neon(idx)));
  haloMats.forEach(({ mat, idx, base }) => {
    mat.color.setHex(neon(idx));
    mat.opacity = t.haloOpacity * base;
  });
  bodyMats.forEach(({ mat, idx, emissive }) => {
    mat.color.setHex(t.bodyBase);
    mat.emissive.setHex(neon(idx));
    mat.emissiveIntensity = emissive * t.emissiveScale;
  });
  structureMats.forEach((m) => {
    m.color.setHex(t.structure);
    m.roughness = t.structureRough;
  });
  gunMats.forEach((m) => m.color.setHex(t.gunBody));
});

/** Emissive value an avatar part should sit at right now (used by hit-flash). */
export function restEmissive(base = 0.4) {
  return base * theme().emissiveScale;
}
