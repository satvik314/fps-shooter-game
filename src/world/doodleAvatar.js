/**
 * Living-doodle avatars.
 *
 * The art stays flat and faithful to the original marker drawings, while a
 * shallow 3D rig supplies reliable body/head hitboxes and paper-cutout motion.
 */

import * as THREE from 'three';
import { haloSprite } from './gfx.js';
import { neon } from '../core/theme.js';

export const DOODLE_CAST = {
  grunt: {
    id: 'grunt',
    name: 'GRIN',
    title: 'THE RELENTLESS',
    role: 'CORE HUNTER',
    description: 'Always on the grid. Steady, stubborn, and closing fast.',
    texture: './characters/grin.png',
    aspect: 1156 / 1361,
    visualScale: 1,
    motion: 'sway',
    idx: 0,
  },
  zip: {
    id: 'zip',
    name: 'SMOKE RIDER',
    title: 'THE RUSH',
    role: 'SPEED DEMON',
    description: 'Small target. Sudden lunges. Never where you expect.',
    texture: './characters/smoke-rider.png',
    aspect: 1328 / 1184,
    visualScale: 0.95,
    motion: 'dash',
    idx: 2,
  },
  titan: {
    id: 'titan',
    name: 'GLITCH',
    title: 'THE HEAVY',
    role: 'ARMOURED BRUTE',
    description: 'A fractured wall of health with a devastating close hit.',
    texture: './characters/glitch.png',
    aspect: 1024 / 1536,
    visualScale: 0.9,
    motion: 'fracture',
    idx: 3,
  },
  seer: {
    id: 'seer',
    name: 'DAWG',
    title: 'THE ORACLE',
    role: 'PLASMA CASTER',
    description: 'Floats at range, circles its prey, and predicts movement.',
    texture: './characters/dawg.png',
    aspect: 1024 / 1536,
    visualScale: 1,
    motion: 'hover',
    idx: 4,
  },
  boss: {
    id: 'boss',
    name: 'RED RONIN',
    title: 'THE OVERLORD',
    role: 'BOSS — EVERY 5 WAVES',
    description: 'Commands the arena, fires in bursts, and summons the rush.',
    texture: './characters/red-ronin.png',
    aspect: 971 / 1619,
    visualScale: 1,
    motion: 'boss',
    idx: 1,
  },
};

const textureCache = new Map();

function loadTexture(path) {
  if (textureCache.has(path)) return textureCache.get(path);
  const tex = new THREE.TextureLoader().load(path);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  textureCache.set(path, tex);
  return tex;
}

function segmentGeometry(width, height, top, bottom) {
  const geometry = new THREE.PlaneGeometry(width, height);
  const uv = geometry.attributes.uv;
  const uvBottom = 1 - bottom;
  const uvTop = 1 - top;
  for (let i = 0; i < uv.count; i++) {
    uv.setY(i, uvBottom + uv.getY(i) * (uvTop - uvBottom));
  }
  uv.needsUpdate = true;
  return geometry;
}

function cutoutSegment(texture, width, totalHeight, top, bottom) {
  const height = totalHeight * (bottom - top);
  const mat = new THREE.MeshBasicMaterial({
    map: texture,
    color: 0xffffff,
    transparent: true,
    alphaTest: 0.035,
    side: THREE.DoubleSide,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(segmentGeometry(width, height, top, bottom), mat);
  mesh.position.y = totalHeight * (1 - (top + bottom) / 2);
  mesh.renderOrder = 3;
  mesh.userData.doodleVisual = true;
  return mesh;
}

function hitbox(w, h, d, y) {
  const material = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
    colorWrite: false,
  });
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(0, y, 0.08);
  return mesh;
}

/**
 * Return the same public contract as the old block avatar so Enemy can remain
 * concerned with combat rather than the visual technology behind a character.
 */
export function makeDoodleAvatar(typeId, scale = 1, idxOverride) {
  const cast = DOODLE_CAST[typeId] || DOODLE_CAST.grunt;
  const idx = idxOverride ?? cast.idx;
  const texture = loadTexture(cast.texture);
  const height = 3.05 * scale * cast.visualScale;
  const width = height * cast.aspect;

  const group = new THREE.Group();
  const visualRoot = new THREE.Group();
  group.add(visualRoot);

  // Separating the drawing into broad paper strips is invisible while alive,
  // but lets the original art break apart convincingly on a kill.
  const headArt = cutoutSegment(texture, width, height, 0, 0.34);
  const torsoArt = cutoutSegment(texture, width, height, 0.34, 0.72);
  const lowerArt = cutoutSegment(texture, width, height, 0.72, 1);
  const parts = [headArt, torsoArt, lowerArt];
  visualRoot.add(...parts);

  const head = hitbox(width * 0.5, height * 0.28, 0.5 * scale, height * 0.78);
  const torso = hitbox(width * 0.72, height * 0.5, 0.55 * scale, height * 0.4);
  head.userData.doodleHitbox = true;
  torso.userData.doodleHitbox = true;
  group.add(head, torso);

  const halo = haloSprite(idx, Math.max(width, height) * 1.22, typeId === 'boss' ? 1.35 : 0.72);
  halo.position.y = height * 0.48;
  halo.position.z = -0.16;
  group.add(halo);

  const anchors = {
    armL: new THREE.Group(),
    armR: new THREE.Group(),
    legL: new THREE.Group(),
    legR: new THREE.Group(),
  };

  const basePositions = parts.map((p) => p.position.clone());
  const baseRotations = parts.map((p) => p.rotation.z);

  function animateWalk(phase, speed) {
    const pulse = Math.sin(phase);
    const quick = Math.sin(phase * 2.1);
    visualRoot.rotation.z = pulse * (cast.motion === 'dash' ? 0.075 : 0.025);
    visualRoot.position.y = Math.abs(pulse) * 0.06 * scale;
    visualRoot.scale.setScalar(1 + quick * 0.012);

    parts.forEach((part, i) => {
      part.position.copy(basePositions[i]);
      part.rotation.z = baseRotations[i];
    });

    if (cast.motion === 'hover') {
      visualRoot.position.y += Math.sin(phase * 0.7) * 0.14 * scale;
      lowerArt.position.y += Math.sin(phase * 1.6) * 0.07 * scale;
    } else if (cast.motion === 'fracture') {
      torsoArt.position.x = Math.sin(phase * 0.8) * 0.045 * scale;
      lowerArt.position.x = -Math.sin(phase * 0.8) * 0.08 * scale;
      lowerArt.rotation.z = quick * 0.035;
    } else if (cast.motion === 'boss') {
      headArt.rotation.z = Math.sin(phase * 0.45) * 0.018;
      torsoArt.scale.x = 1 + Math.abs(pulse) * 0.018;
    } else if (cast.motion === 'dash') {
      visualRoot.rotation.y = quick * 0.05;
      visualRoot.position.x = quick * 0.045 * scale * Math.min(speed, 6);
    }
  }

  function attack(t = 0) {
    const kick = 1 + Math.sin(t * 18) * 0.035;
    visualRoot.scale.set(kick, 1 / kick, 1);
    torsoArt.rotation.z = Math.sin(t * 15) * 0.05;
  }

  function setHitFlash(on) {
    const tint = on ? 0xff82b8 : 0xffffff;
    parts.forEach((p) => p.material.color.setHex(tint));
  }

  function setSpawnProgress(k) {
    const eased = Math.max(0, Math.min(1, k));
    parts.forEach((p) => {
      p.material.opacity = eased;
    });
    visualRoot.scale.set(0.72 + eased * 0.28, 1.45 - eased * 0.45, 1);
  }

  return {
    group,
    head,
    torso,
    ...anchors,
    halo,
    idx,
    color: neon(idx),
    parts,
    hitMeshes: [head, torso],
    scale,
    cast,
    animateWalk,
    attack,
    setHitFlash,
    setSpawnProgress,
  };
}
