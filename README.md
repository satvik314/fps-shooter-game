# RIVALS — by Tempest_YT

**Made for Vedaant.**

A neon arena FPS built with **Vite + three.js**. Step through the gate into
Vedaant Singh's universe, ride a wormhole to the grid, then survive endless
waves of living doodles — picking an augment after every wave and trying not to
meet Red Ronin unprepared.

This is a full working prototype: a modular rebuild of the original single-file
HTML version, plus a three-part entry sequence, a complete light mode, three
weapons, five enemy types, a roguelite upgrade system, drops, and a radar.

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
| Medkit | `H` | `✚` |
| Weapons | `1` `2` `3` `4` / mouse wheel | `SWAP` |
| Pause | `Esc` / `P` | — |
| Toggle theme | `T` | theme chip, top right |
| Mute | `M` | sound chip, top right |

The sliding switch on the menu, pause screen and HUD flips between the two
control schemes at any time. Genuinely touch-first devices (phones, tablets)
start in button mode; touchscreen laptops stay on mouse.

---

## What's in it

**The entry experience**, in three beats:

1. **The gate.** A spinning portal, and the question: *You are now entering
   **Vedaant Singh's universe** — are you ready?* Nothing moves until you answer.
   That deliberate click is also the user gesture browsers require before audio
   is allowed to play, so everything after it has sound.
2. **The journey.** A wormhole rendered in 3D — a tunnel of neon rings rushing
   past, warp streaks stretching with velocity, and a light at the far end that
   swells until it swallows the screen. It accelerates the whole way, with
   status beats and a charge bar overlaid.
3. **The arrival.** You come out the other side into the arena, and **RIVALS**
   slams in one letter at a time — each with its own impact hit and screen
   rumble — before handing the credit to **TEMPEST_YT**.

Skippable from the journey onward with the SKIP button, a click, `Space` or
`Esc`. Repeat visits take a shorter trip through the wormhole; **REPLAY INTRO**
on the menu restores the full-length journey.

The wormhole is deliberately deep-space dark in both themes — it's the void
between worlds, and its glow depends on additive blending, which would render
as flat white over a light background.

**Light mode.** Not a CSS filter — a second complete palette. Both the interface
tokens *and* the 3D scene swap: sky, fog colour and density, three light
sources, the procedurally drawn grid floor, structure colours, emissive
strength, halo opacity, damage-number colours and the viewmodel finish. Every
material registers a repaint callback, so the theme flips live mid-firefight
without rebuilding the scene. The choice persists.

**Four weapons**, each with its own model, feel and unlock:

| | Unlock | Behaviour |
| --- | --- | --- |
| Pulse Rifle | start | full auto, tight spread, all-rounder |
| Scattergun | wave 2 | 9 pellets, brutal up close, slow |
| Longshot | wave 3 | scoped sniper — **a headshot is an instant kill** |
| Railgun | wave 4 | hold to charge, pierces a whole line of enemies |

**The Longshot** one-shots any enemy you hit in the head, at any range, no
matter how much health it has. Wild from the hip and pinpoint through the
scope, which replaces the viewmodel with a proper scope overlay at 24° FOV.
The one exception is Red Ronin: a boss takes 25% of its maximum health from
a headshot instead of dying outright, because a one-shot boss is no boss at all.

**The medkit.** One is issued at the start of every wave (stockpiling up to
three) and heals **70** shield on `H`. It is a committed action, not a free
top-up: the rifle drops out of view, the kit swings up and pops its lid, the
shield refills along an eased curve as a `+70` counter climbs and the world
washes green — and you cannot fire, reload or swap weapons for the ~1.2s it
takes. It refuses politely if you have no kit or are already at full shield.

**Five living-doodle enemies.** Grin (baseline chaser), Smoke Rider (fast
swarm), Glitch (armoured heavy), Dawg (keeps range, throws plasma), and the
**Red Ronin** boss every fifth wave — which strafes, fires three-round bursts
and summons minions. After choosing JACK IN, the threat-deck screen lets the
player pick two optional rivals alongside Grin; Red Ronin is inevitable.
Elites carry health bars; the boss gets a HUD bar.

**Roguelite augments.** Clear a wave, pick one of three cards from a pool of 15:
damage, fire rate, magazine, reload, shield, speed, headshot damage, lifesteal,
regen, extra dash charges, chain detonation, scavenger, adrenaline, glass
cannon, overshield. They stack, and the run's build is yours.

**Drops.** Shield, full ammo, double damage, rapid fire, and a rare Grid Purge
that wipes the field.

**Plus:** an `ELIMINATED <TARGET>` kill feed (`HEADSHOT ✕` and `ONE SHOT ✕`
variants), radar with off-screen contact bearings, combo multiplier, killstreak
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
    doodleAvatar.js     transparent cutout rigs, hitboxes and character motion
    avatar.js           legacy blocky Glowbot chassis
    gfx.js              themed material factories + registries for repainting
    fx.js               debris, sparks, damage numbers, tracers, rings, lights
  game/
    game.js             renderer, run state, the update/render loop
    enemy.js            enemy archetypes, AI, wave composition
    weapons.js          weapon data + first-person models
    medkit.js           medkit viewmodel, heal curve and constants
    upgrades.js         augment cards
    pickups.js          drops
  ui/
    intro.js            the abortable gate → journey → arrival timeline
    wormhole.js         the 3D wormhole, borrowing the game's renderer
    hud.js              every heads-up element, including the radar canvas
    screens.js          menu, briefing, settings, pause, upgrade picker, death
```

Three conventions are worth knowing before editing:

- **Colours are referenced by neon *index*, not hex.** `neonEdges(mesh, 2)` means
  "accent 2", which resolves differently per theme. That is what makes the live
  theme swap possible.
- **Anything that allocates a material must release it.** `gfx.js` keeps
  registries so theme repaints reach every live object; `disposeObject` and
  `FX._release` drop entries as objects die. The FX pools are hard-capped so a
  wave wiping at once can't flood the scene.
- **Never give an instance property the same name as a method.** `this.heal`
  as heal-in-progress state silently shadowed the `heal(amount)` method and
  broke every heal in the game; the state is `this.healing` for that reason.
- **The renderer can be lent out.** `game.setRenderOverride(fn)` hands the
  render loop to something else — that's how the wormhole draws its own scene
  through the game's renderer without a second WebGL context. It disposes
  itself and hands rendering back when the journey ends, however it ends.

---

## Notes

- Frame delta is clamped to 50 ms, so on very slow hardware the game runs in
  slow motion rather than letting enemies tunnel through walls.
- Audio only starts after the first interaction — which is what the gate's
  "I'm ready" button is for.
- Tested in Chromium at desktop, tablet and phone viewports, in both themes,
  against both the dev server and the production build.
