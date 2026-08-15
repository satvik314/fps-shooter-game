/**
 * Field medkit.
 *
 * One is issued at the start of every wave. Using it is a committed action:
 * the rifle drops out of view, the kit swings up, the lid pops, and the shield
 * refills over the animation — so healing costs you a second of firepower
 * rather than being a free instant top-up.
 */

import * as THREE from 'three';
import { neon } from '../core/theme.js';

export const MEDKIT_HEAL = 70;
export const MEDKIT_MAX = 3;
export const MEDKIT_DURATION = 1.15; // seconds, start to finish

/** The window inside the animation over which the shield actually refills. */
const HEAL_FROM = 0.28;
const HEAL_TO = 0.82;

/** 0..1 eased progress of the heal itself. */
export function healCurve(p) {
  const k = (p - HEAL_FROM) / (HEAL_TO - HEAL_FROM);
  if (k <= 0) return 0;
  if (k >= 1) return 1;
  return 1 - Math.pow(1 - k, 3); // ease-out: most of it lands early
}

/**
 * First-person medkit. Returns the group plus the parts the animation drives.
 * The lid is its own group pivoted at the back edge so it hinges open.
 */
export function buildMedkit() {
  const group = new THREE.Group();

  const shellMat = new THREE.MeshStandardMaterial({
    color: 0xf4f7fd,
    roughness: 0.45,
    metalness: 0.05,
  });
  const trimMat = new THREE.MeshStandardMaterial({
    color: 0x1a1a26,
    roughness: 0.6,
  });
  const crossMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: neon(2), // lime in dark, deep green in light
    emissiveIntensity: 1.4,
    roughness: 0.4,
  });

  const W = 0.26;
  const H = 0.15;
  const D = 0.19;

  const base = new THREE.Mesh(new THREE.BoxGeometry(W, H, D), shellMat);
  group.add(base);

  const band = new THREE.Mesh(new THREE.BoxGeometry(W * 1.02, 0.03, D * 1.02), trimMat);
  band.position.y = H / 2;
  group.add(band);

  // lid hinges at the back edge
  const lid = new THREE.Group();
  lid.position.set(0, H / 2, -D / 2);
  const lidBody = new THREE.Mesh(new THREE.BoxGeometry(W, 0.05, D), shellMat);
  lidBody.position.set(0, 0.025, D / 2);
  lid.add(lidBody);

  const crossV = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.012, 0.14), crossMat);
  crossV.position.set(0, 0.056, D / 2);
  const crossH = new THREE.Mesh(new THREE.BoxGeometry(0.14, 0.012, 0.05), crossMat);
  crossH.position.set(0, 0.056, D / 2);
  lid.add(crossV, crossH);
  group.add(lid);

  const faceV = new THREE.Mesh(new THREE.BoxGeometry(0.045, 0.1, 0.012), crossMat);
  faceV.position.set(0, 0, D / 2);
  const faceH = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.045, 0.012), crossMat);
  faceH.position.set(0, 0, D / 2);
  group.add(faceV, faceH);

  // the charge inside, revealed when the lid opens
  const vial = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.11, 10),
    new THREE.MeshStandardMaterial({
      color: 0x0d0d18,
      emissive: neon(2),
      emissiveIntensity: 1.8,
      roughness: 0.3,
    })
  );
  vial.rotation.z = Math.PI / 2;
  vial.position.set(0, 0.02, 0.02);
  group.add(vial);

  const handle = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.02, 0.02), trimMat);
  handle.position.set(0, -H / 2 - 0.01, 0);
  group.add(handle);

  return { group, lid, vial, cross: [crossV, crossH, faceV, faceH] };
}

/**
 * Drives the viewmodel for a given progress 0..1.
 * Phase 1 raises the kit, phase 2 pops the lid, phase 3 drops it away.
 */
export function animateMedkit(kit, p) {
  const { group, lid, vial } = kit;

  // rise into view, hold, then fall away
  let lift;
  if (p < 0.22) lift = p / 0.22; // up
  else if (p < 0.86) lift = 1; // hold
  else lift = 1 - (p - 0.86) / 0.14; // down
  const ease = 1 - Math.pow(1 - Math.max(0, Math.min(1, lift)), 3);

  group.position.set(0.07, -0.6 + ease * 0.36, -0.74);
  group.scale.setScalar(0.86);
  group.rotation.set(-0.5 + ease * 0.42, 0.5 - ease * 0.35, 0.24 - ease * 0.2);

  // lid pops open across the heal window, snaps shut at the end
  let open;
  if (p < 0.24) open = 0;
  else if (p < 0.84) open = Math.min(1, (p - 0.24) / 0.14);
  else open = Math.max(0, 1 - (p - 0.84) / 0.1);
  lid.rotation.x = -open * 1.5;

  // the vial burns down as the charge is spent
  const spent = healCurve(p);
  vial.material.emissiveIntensity = 1.8 * (1 - spent * 0.85) + Math.sin(p * 60) * 0.25;
  vial.scale.setScalar(1 - spent * 0.35);
}
