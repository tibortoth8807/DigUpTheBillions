# Ásd ki a milliárdokat! 🪏💰

[![Test & deploy](https://github.com/tibortoth8807/DigUpTheBillions/actions/workflows/deploy.yml/badge.svg)](https://github.com/tibortoth8807/DigUpTheBillions/actions/workflows/deploy.yml)
![TypeScript](https://img.shields.io/badge/TypeScript-3178C6?logo=typescript&logoColor=white)
![Canvas 2D](https://img.shields.io/badge/Canvas_2D-no_engine-orange)
![Vite](https://img.shields.io/badge/Vite-646CFF?logo=vite&logoColor=white)
![Web Audio](https://img.shields.io/badge/Web_Audio-synthesized-blueviolet)
![License: MIT](https://img.shields.io/badge/license-MIT-green)

**A satirical browser puzzle game (in Hungarian):** a fictional retired minister buried his "investments" in the forest.
You have his scribbled map, a shovel, a metal detector and a dog – dig up the billions before the squad's jeep arrives.

> 🇭🇺 *Egy kitalált nyugalmazott miniszter elásta a milliárdokat a Bükkös-erdőben. Nálad a térkép – ásd ki, mielőtt a Különítmény odaér!*
>
> **Parody.** The story, characters, place and "Különítmény" are fictional; any resemblance to real persons or events is coincidental.

![Gameplay](docs/gameplay.png)

## How to play

- 🗺️ The **map** gives 2–3 clues ("Pontosan 4 lépésre az öreg tölgytől", "A vadászlestől északkeletre") that narrow the forest down to a few tiles.
- 🪏 **6 digs** – every miss costs 3 seconds (noise attracts the squad).
- 📡 **3 detector readings** – hot / warm / lukewarm / cold by distance.
- 🐕 **The dog** sits down 1–2 steps from the treasure, once.
- ⏱️ **75 seconds.** Unused tools and time are worth points. Results can be shared Wordle-style (no spoilers).
- **Daily map:** everybody gets the same forest on the same day (seeded by the date).

## Tech

| Area | What |
|---|---|
| Language | TypeScript (strict), no game engine, no runtime dependencies |
| Rendering | HTML Canvas 2D: procedurally drawn sprites (trees, landmarks, dog, chest), offscreen-rendered forest floor, particles, high-DPI aware |
| Procedural content | Seeded PRNG (mulberry32 + FNV-1a), forest generator, **puzzle generator that guarantees a fair puzzle** (3–7 candidate tiles, always solvable with the tools) |
| Audio | Sound effects synthesized with the Web Audio API – no audio files |
| UX | Responsive (desktop & mobile, touch), keyboard shortcuts, Web Share API / clipboard |
| Quality | Game logic separated from rendering and unit-tested with `node:test` – including 500 random maps for puzzle fairness |
| Build & deploy | Vite, GitHub Actions → GitHub Pages |

```
src/
  game/      pure logic – rng, forest, puzzle, game rules, share text (no DOM)
  render/    canvas renderer and sprites
  audio.ts   Web Audio sound effects
  main.ts    UI wiring, input, game loop
tests/       node:test unit tests for the game logic
```

## Run locally

```bash
npm install
npm run dev     # http://localhost:5173
npm test        # game logic tests
npm run build   # static files in dist/
```

## Deploy

Push to `main` → the workflow tests, builds and publishes to GitHub Pages
(one-time: repository **Settings → Pages → Source: GitHub Actions**).

## Ideas

- [ ] Levels: bigger forest, fog of war, decoy maps
- [ ] Leaderboard for the daily map (ASP.NET Core minimal API)
- [ ] Night mode with flashlight

## Author

**Tibor Tóth** – [LinkedIn](https://www.linkedin.com/in/tibor-t%C3%B3th-a353b38b) · More: [VulnLens](https://github.com/tibortoth8807/VulnLens) · [AccessDesk](https://github.com/tibortoth8807/AccessDesk) · [PartFinder](https://github.com/tibortoth8807/AutoWebshopPartfinder) · [TalentPulse](https://github.com/tibortoth8807/TalentPulse)
