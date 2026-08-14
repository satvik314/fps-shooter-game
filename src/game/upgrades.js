/**
 * Roguelite upgrade cards. Clearing a wave offers three at random; picking one
 * mutates `player.mods`, which every gameplay system reads live.
 */

export function baseMods() {
  return {
    dmg: 1,
    fireRate: 1,
    magMul: 1,
    reloadMul: 1,
    speedMul: 1,
    headMul: 1,
    lifesteal: 0,
    regen: 0,
    dashCharges: 2,
    dashCd: 2.4,
    splash: 0,
    scavenger: 0,
    adrenaline: 0,
    maxhpBonus: 0,
    pickupRadius: 2.6,
    overshield: 0,
  };
}

export const UPGRADES = [
  {
    id: 'dmg',
    name: 'OVERCLOCK',
    icon: '⚡',
    desc: '+18% weapon damage',
    max: 8,
    apply: (m) => (m.dmg *= 1.18),
  },
  {
    id: 'rate',
    name: 'HAIR TRIGGER',
    icon: '🔥',
    desc: '+14% fire rate',
    max: 6,
    apply: (m) => (m.fireRate *= 1.14),
  },
  {
    id: 'mag',
    name: 'DEEP MAG',
    icon: '📦',
    desc: '+30% magazine size',
    max: 5,
    apply: (m) => (m.magMul *= 1.3),
  },
  {
    id: 'reload',
    name: 'QUICK HANDS',
    icon: '🔄',
    desc: '-20% reload time',
    max: 5,
    apply: (m) => (m.reloadMul *= 0.8),
  },
  {
    id: 'shield',
    name: 'PLATING',
    icon: '🛡',
    desc: '+30 max shield, refill 30',
    max: 6,
    apply: (m) => (m.maxhpBonus += 30),
    onPick: (g) => g.heal(30),
  },
  {
    id: 'speed',
    name: 'LIGHT FEET',
    icon: '💨',
    desc: '+12% move speed',
    max: 5,
    apply: (m) => (m.speedMul *= 1.12),
  },
  {
    id: 'head',
    name: 'HEADHUNTER',
    icon: '🎯',
    desc: '+35% headshot damage',
    max: 4,
    apply: (m) => (m.headMul *= 1.35),
  },
  {
    id: 'lifesteal',
    name: 'LEECH CORE',
    icon: '🩸',
    desc: '+4 shield per frag',
    max: 5,
    apply: (m) => (m.lifesteal += 4),
  },
  {
    id: 'regen',
    name: 'NANO REPAIR',
    icon: '➕',
    desc: 'Regenerate 1.5 shield/s',
    max: 4,
    apply: (m) => (m.regen += 1.5),
  },
  {
    id: 'dash',
    name: 'PHASE DRIVE',
    icon: '⏩',
    desc: '+1 dash charge',
    max: 3,
    apply: (m) => (m.dashCharges += 1),
  },
  {
    id: 'splash',
    name: 'CHAIN DETONATE',
    icon: '💥',
    desc: 'Frags explode for +45 area damage',
    max: 4,
    apply: (m) => (m.splash += 45),
  },
  {
    id: 'scav',
    name: 'SCAVENGER',
    icon: '🧲',
    desc: '+25% drop chance, +60% pickup range',
    max: 3,
    apply: (m) => {
      m.scavenger += 0.25;
      m.pickupRadius *= 1.6;
    },
  },
  {
    id: 'adren',
    name: 'ADRENALINE',
    icon: '🚀',
    desc: '+30% speed for 3s after a frag',
    max: 3,
    apply: (m) => (m.adrenaline += 0.3),
  },
  {
    id: 'glass',
    name: 'GLASS CANNON',
    icon: '☠',
    desc: '+45% damage, -25 max shield',
    max: 2,
    apply: (m) => {
      m.dmg *= 1.45;
      m.maxhpBonus -= 25;
    },
  },
  {
    id: 'over',
    name: 'OVERSHIELD',
    icon: '🔷',
    desc: 'Absorb the first 40 damage of each wave',
    max: 3,
    apply: (m) => (m.overshield += 40),
  },
];

/** Three distinct cards the player has not maxed out. */
export function rollUpgrades(taken, n = 3) {
  const pool = UPGRADES.filter((u) => (taken[u.id] || 0) < u.max);
  const out = [];
  const bag = [...pool];
  while (out.length < n && bag.length) {
    out.push(bag.splice(Math.floor(Math.random() * bag.length), 1)[0]);
  }
  return out;
}
