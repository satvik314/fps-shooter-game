/**
 * Floating drops. Enemies leave them behind; walking near one grabs it.
 */

import * as THREE from 'three';
import { haloSprite, neonEdges, bodyMaterial, disposeObject, rng } from '../world/gfx.js';
import { neon } from '../core/theme.js';

export const PICKUP_TYPES = {
  shield: { id: 'shield', label: 'SHIELD +35', idx: 0, weight: 34, geo: 'oct' },
  ammo: { id: 'ammo', label: 'AMMO FULL', idx: 2, weight: 30, geo: 'box' },
  damage: { id: 'damage', label: 'DOUBLE DAMAGE', idx: 1, weight: 16, geo: 'tetra', dur: 9 },
  rapid: { id: 'rapid', label: 'RAPID FIRE', idx: 3, weight: 14, geo: 'tetra', dur: 9 },
  nuke: { id: 'nuke', label: 'GRID PURGE', idx: 4, weight: 6, geo: 'ico' },
};

const GEOS = {
  box: () => new THREE.BoxGeometry(0.55, 0.55, 0.55),
  oct: () => new THREE.OctahedronGeometry(0.42),
  tetra: () => new THREE.TetrahedronGeometry(0.5),
  ico: () => new THREE.IcosahedronGeometry(0.44),
};

export function rollPickupType() {
  const list = Object.values(PICKUP_TYPES);
  const total = list.reduce((s, p) => s + p.weight, 0);
  let r = Math.random() * total;
  for (const p of list) {
    r -= p.weight;
    if (r <= 0) return p;
  }
  return list[0];
}

export class Pickup {
  constructor(scene, type, pos) {
    this.scene = scene;
    this.type = type;
    this.life = 22;
    this.phase = Math.random() * 6;

    const mesh = new THREE.Mesh(GEOS[type.geo](), bodyMaterial(type.idx, 1.1));
    neonEdges(mesh, type.idx);
    const halo = haloSprite(type.idx, 2.6, 1.1);
    const g = new THREE.Group();
    g.add(mesh, halo);
    g.position.copy(pos).setY(1);
    scene.add(g);
    this.group = g;
    this.mesh = mesh;
    this.color = neon(type.idx);
  }

  update(dt, t) {
    this.life -= dt;
    this.mesh.rotation.y += dt * 2.2;
    this.mesh.rotation.x += dt * 1.1;
    this.group.position.y = 1 + Math.sin(t * 2.4 + this.phase) * 0.22;
    // blink out in the last two seconds
    if (this.life < 2) this.group.visible = Math.floor(this.life * 8) % 2 === 0;
  }

  dispose() {
    this.scene.remove(this.group);
    disposeObject(this.group);
  }
}

export function randomDropOffset() {
  return new THREE.Vector3(rng(-0.6, 0.6), 0, rng(-0.6, 0.6));
}
