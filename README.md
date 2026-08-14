# RIVALS — by Tempest_YT

A neon arena FPS built with **Vite + three.js**. Survive endless waves of Glowbots
on the grid, pick an augment after every wave, and try not to meet the Overlord
unprepared.

This is a full working prototype: a modular rebuild of the original single-file
HTML version, plus a cinematic intro, a complete light mode, three weapons,
five enemy types, a roguelite upgrade system, drops, and a radar.

---

## Run it

```bash
npm install
npm run dev        # http://localhost:5173
```

```bash
npm run build      # production bundle in dist/
npm run preview    # serve the built bundle
```

No API keys, no assets to download — every texture, sound and model is generated
at runtime.

---

## Controls

| Action | Mouse + keyboard | On-screen buttons |
| --- | --- | --- |
| Move | `W A S D` / arrows | left-thumb virtual stick |
| Look | mouse (pointer lock) | drag anywhere on the right |
| Sprint | `Shift` | push the stick to the edge |
| Jump | `Space` | `JUMP` |
| Dash (i-frames) | `E` | `DASH` |
| Fire | left click or `Q` | `FIRE` |
| Aim down sights | right click or `C` | `AIM` (toggle) |
| Reload | `R` | `R` |
| Weapons | `1` `2` `3` / mouse wheel | `SWAP` |
| Pause | `Esc` / `P` | — |
| Toggle theme | `T` | theme chip, top right |
| Mute | `M` | sound chip, top right |

The sliding switch on the menu, pause screen and HUD flips between the two
control schemes at any time. Genuinely touch-first devices (phones, tablets)
start in button mode; touchscreen laptops stay on mouse.

---

## What's in it

**Intro experience.** A CRT power-on, a typed `TEMPEST//NET` boot log with a
loading bar, a riser into a whiteout, then **RIVALS** slams in one letter at a
time — each with its own impact hit and screen rumble — before handing the
credit to **TEMPEST_YT**. Skippable at any point with click / `Space` / `Esc`.
First visit gets the full sequence; later visits get the short cut, and
**REPLAY INTRO** on the menu always plays it in full.

**Light mode.** Not a CSS filter — a second complete palette. Both the interface
tokens *and* the 3D scene swap: sky, fog colour and density, three light
sources, the procedurally drawn grid floor, structure colours, emissive
strength, halo opacity, damage-number colours and the viewmodel finish. Every
material registers a repaint callback, so the theme flips live mid-firefight
without rebuilding the scene. The choice persists.

**Three weapons**, each with its own model, feel and unlock:

| | Unlock | Behaviour |
| --- | --- | --- |
| Pulse Rifle | start | full auto, tight spread, all-rounder |
| Scattergun | wave 2 | 9 pellets, brutal up close, slow |
| Railgun | wave 4 | hold to charge, pierces a whole line of enemies |

**Five enemy types.** Glowbot (baseline chaser), Zipbot (fast swarm), Titan
(armoured heavy), Seer (keeps range, throws plasma), and the **Overlord** boss
every fifth wave — which strafes, fires three-round bursts and summons minions.
Elites carry health bars; the boss gets a HUD bar.

**Roguelite augments.** Clear a wave, pick one of three cards from a pool of 15:
damage, fire rate, magazine, reload, shield, speed, headshot damage, lifesteal,
regen, extra dash charges, chain detonation, scavenger, adrenaline, glass
cannon, overshield. They stack, and the run's build is yours.

**Drops.** Shield, full ammo, double damage, rapid fire, and a rare Grid Purge
that wipes the field.

**Plus:** radar with off-screen contact bearings, combo multiplier, killstreak
callouts, directional damage indicators, dash with i-frames, aim-down-sights,
hit markers with headshot variants, floating damage numbers, gib physics,
adaptive music that speeds up as waves escalate, pause menu, settings
(sensitivity, volume, invert Y, radar, theme), and persistent personal bests.

---

## Layout

```
index.html              markup for every screen, HUD and control overlay
src/
  main.js               entry point — boots theme, game, input, intro, UI
  style.css             design system; both palettes live in CSS custom properties
  core/
    theme.js            palette definitions + repaint broadcast (CSS *and* 3D)
    audio.js            WebAudio synth: SFX, intro stingers, adaptive music
    input.js            keyboard / pointer-lock / virtual stick — one neutral state
    storage.js          settings + personal bests (localStorage, fails soft)
  world/
    arena.js            grid floor, cover, walls, ambient neon, spawn clearance
    avatar.js           the blocky Glowbot chassis and its face variants
    gfx.js              themed material factories + registries for repainting
    fx.js               debris, sparks, damage numbers, tracers, rings, lights
  game/
    game.js             renderer, run state, the update/render loop
    enemy.js            enemy archetypes, AI, wave composition
    weapons.js          weapon data + first-person models
    upgrades.js         augment cards
    pickups.js          drops
  ui/
    intro.js            the abortable intro timeline
    hud.js              every heads-up element, including the radar canvas
    screens.js          menu, briefing, settings, pause, upgrade picker, death
```

Two conventions are worth knowing before editing:

- **Colours are referenced by neon *index*, not hex.** `neonEdges(mesh, 2)` means
  "accent 2", which resolves differently per theme. That is what makes the live
  theme swap possible.
- **Anything that allocates a material must release it.** `gfx.js` keeps
  registries so theme repaints reach every live object; `disposeObject` and
  `FX._release` drop entries as objects die. The FX pools are hard-capped so a
  wave wiping at once can't flood the scene.

---

## Notes

- Frame delta is clamped to 50 ms, so on very slow hardware the game runs in
  slow motion rather than letting enemies tunnel through walls.
- Audio only starts after the first interaction — browser autoplay policy.
- Tested in Chromium at desktop, tablet and phone viewports, in both themes,
  against both the dev server and the production build.
