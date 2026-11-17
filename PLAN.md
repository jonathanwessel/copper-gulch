# Copper Gulch: plan

The design is in `GDD.md`. This file is the roadmap the hourly scheduled task works through.

## How the task works through this roadmap
1. **Pick the next box.** Take the first unticked box in the first unfinished milestone. Work boxes in order for as long as the run lasts.
2. **Release.** Run the release checklist below.
   - Green: publish, tick the boxes you finished, and add a one-line `Notes:` under each.
   - Red: fix it, or stash the broken part and publish what is green. Never push red.
3. **Targets.** The last box of each milestone is its target: one measurable line, proved by a bot or a test. The milestone is done when its target passes.
4. **Target missed.** Add the fix box it needs just above the target and keep going.
5. **Decisions.** Decide sensibly and write the decision in the box's note. Never stop to ask the owner.

## Rules from the owner
- Free forever: no ads, no purchases, no tracking, and no requests to other hosts at runtime (no CDNs, no web fonts).
- The repo is public: no personal details in code, commits or docs (no names, emails, LAN addresses or family stories).
- The look: a crisp, flat pixel UI with no glossy gradients or glass. Modern motion is welcome.
- Phone first, then landscape, then desktop. No sideways scroll at 400 px wide. Touch targets at least 30 px.
- American spelling.
- Saves: bump `v` and add a migration for any change to the save's shape. Use only `cg-*` storage keys. The old game's key `copper-gulch-save-v1` may be read, never written.
- Publish working releases often; the owner plays the installed app between sessions.
- Always installable as an app (PWA), above all in Chrome on Android, where the browser must offer "Install app". `tools/install-test.js` must print ok for every release, locally and against the live site.

## Release checklist (every release; stop and fix on any failure)
1. `node --test test/*.test.js` passes (Node 24 does not take a bare folder).
2. `node tools/audit.js` prints `audit ok`.
3. Run the bots that the current milestone's target names. From M1 on that is `tools/balance.js`; from M2, `tools/firstplay.js`; from M4, `tools/idle.js`. Write their numbers in the notes.
4. `node tools/smoke.js` ends with phone, land and desk `ok`.
5. `node tools/shots.js <scratch dir>`: look at every screenshot and fix anything ugly or broken.
6. `node tools/bump-version.js "note, no apostrophes"`, then `node tools/update-test.js` and `node tools/install-test.js` print ok.
7. Commit, push `main`, wait for the Pages build, and confirm the live `version.json` shows the new version. Then `node tools/install-test.js https://jonathanwessel.github.io/copper-gulch/` prints ok (the live manifest and icons).

Until a tool exists, the box that creates it is the first to use it; skip the steps for tools that don't exist yet.

## Roadmap

### M1. Copper Gulch, playable
- [x] **Bootstrap.**
  - `index.html` with an import map, `sw.js`, `manifest.webmanifest`, icons, and `package.json` set to `{"type":"module"}` with no dependencies.
  - Vendored three.js, copied from `../tycoon/vendor/three`.
  - Tools copied from `../tycoon/scripts`: `cdp`, `serve`, `update-test`, `bump-version`, `make-icons`.
  - `audit` v0, and a test harness.
  - Shipped when the live site shows a title over a Gulch model and works offline.
  - Installable as an app (owner requirement, added after the first release), above all in Chrome on Android:
    - `manifest.webmanifest` linked from `index.html`: name, short_name, id, start_url and scope `./`, display standalone with display_override fullscreen, orientation any, theme and background colors matching the page, a description; PNG icons 192 and 512 with purpose any, separate 192 and 512 maskable icons with the art inside the safe zone, and an apple-touch-icon. Every path relative (the site lives under `/copper-gulch/`).
    - `sw.js` registered with scope `./`, with a real fetch handler that serves the game offline.
    - An Install button: catch beforeinstallprompt, show the button only while the prompt is available (on the title, and in Settings once the Phone shell builds it), call prompt() on tap, hide it after appinstalled or when already running as an app. On iPhone and iPad, a one-line "Share, then Add to Home Screen" hint instead.
    - `tools/install-test.js`: CDP Page.getAppManifest with no errors and every icon loading at its size, and Page.getInstallabilityErrors returning an empty list; run on the served repo and on the live URL after publishing.
  - Notes (install): shipped 2026.11.16-6. `tools/install-test.js` on the served repo: no manifest errors; icons 192, 512, maskable 192, maskable 512 and the 180 apple-touch-icon all load at their sizes; installabilityErrors `[]`; headless Chrome fired beforeinstallprompt and the Install button showed. A broken copy (no icons, no fetch handler) fails it with `no-acceptable-icon`, so the check bites. The maskable icons are the scene from further back so the saloon sits inside the safe zone. `index.html` catches beforeinstallprompt in a tiny inline script before the modules load; `src/ui/install.js` owns the button (`installButton()`), counting fullscreen and minimal-ui as already installed because of display_override. Live check after publishing (https://jonathanwessel.github.io/copper-gulch/): version.json 2026.11.16-6, service worker in control, no manifest errors, all five icons at their sizes, installabilityErrors `[]`, the prompt offered and the Install button shown.
  - Notes: shipped 2026.11.16-2. Tools are ES modules now (`tools/*.js`); also added `smoke` (phone, land, desk, then offline with the server stopped) and `shots`. The title scene (`src/render/title-scene.js`) uses the old buildings, adapted into `src/assets/models/gulch.js`; the Board box replaces it with the real board. Logo is a code-drawn 5x7 pixel font (`src/art/pixfont.js`), no web fonts. Version lives in `src/version.js`. Caches are named `cg-shell-*` because the old game on the same origin deletes its own `copper-gulch-*` caches. `update-test` also checks the new version boots offline. Audit v0: pure core, no other hosts, cg-* keys, American spelling, no emails or LAN addresses, matching versions, no missing cached files.
- [x] **Core.**
  - `src/core/`: `rng` (a seeded stream per town), `clock` (fixed 0.25 s steps and offline catch-up), `events` (the bus), `mods` (named sources with caps), `town` (`class Town`, with no global state), `save` (v1 with migrations), `game`.
  - Must be deterministic: no DOM, no three.js, no `Math.random`.
  - Notes: shipped 2026.11.16-3. rng is sfc32 with its state in the save; `fork(name)` gives side streams. Offline catch-up steps the first 10 min finely, then coarse chunks (systems may give a `coarse` step), capped at 24 h. Systems are plain objects (`init/step/coarse/load`, plus `setup/tick` for empire-wide state in `game.shared`). Mods: a stat can be narrowed (`prod:saw`) and shares its family's cap; a stat with no published cap throws. Save v1 is `{ v, at, game }`; storage and slots are left to the Phone shell box. The audit also refuses wall-clock reads in the core. `src/core/setup.js` builds a new or loaded game for the UI, bots and tests.
- [x] **Economy.** The Gulch chain and the market with saturation, as data in `src/data/`.
  - Notes: shipped 2026.11.16-3. Goods, buildings and `towns/gulch.js` are data; `src/core/economy.js` makes goods (suppliers first, starved buildings flagged) and sells the surplus, keeping 10 s of each workshop's inputs; `src/core/market.js` prices with `rec / (rec + sellRate / depth)` (rec 1, recovery 60 s). A sale pays the average price over the saturation it causes, so splitting a sale gains nothing and a coarse offline chunk settles like fine steps. Milestones at levels 10, 25, 50, 100, 150, 200 each double output. Building ids `toolsmith` and `wagonworks` so no id is shared with a good. Every good sells by default (`town.sell[good] = false` holds it); sell modes come in M6. Costs and rates are first guesses; the M1 target box tunes them with the balance bot. The audit checks the chain rules; the first town is exempt from "the top good needs an import".
- [x] **Board.**
  - `src/render/`: `scene`, `board` (`new Board(town, {lod})`), `camera` (pan, pinch, twist), `pick`.
  - The Gulch models in `src/assets/models/gulch.js`, with `kit` and `units` adapted from `../tycoon/src/r3d`.
  - The interface to build, sell and upgrade.
  - Notes: shipped 2026.11.16-4. Play loads the autosave (`cg-save`, every 10 s and when the app hides; slots come with the Phone shell) and catches up the time away, or starts a new game. The board layout (plots, road, vault) is data in `towns/gulch.js`; the road is a crisp ribbon mesh with ruts. New models: clay pit, kiln, toolsmith, wagon works; buildings change model at levels 10, 25, 50, 100. The home view frames the plots that are built or can be built (at least three wide), so a phone sees the early yard large and the view widens as plots unlock; the Defense box must widen it to the whole road. Tall screens get a 50 degree lens and a steeper view. Tags over plots show levels (copper when affordable, a red edge when short of inputs); the card shows output with a tap-to-explain breakdown, inputs, needs, Build/Upgrade, and a sell or hold toggle for its good. Without WebGL the plots are listed as buttons. Verified headless: picking by tap, drag pans without tapping, buying through the card; pinch and twist are adapted from the old game and not yet tried on a real phone. `units.js` (people, foes, towers) is left for the Defense box.
- [x] **Defense.**
  - The road, crossbow, cannon, frost lens and snake oil still, the vault, foes, waves and the war wagon.
  - Paths at level 5.
  - Notes: shipped 2026.11.16-5. `src/core/defense.js` with `data/towers.js` and `data/foes.js`. Towers stand on 12 fixed stone-pad spots beside the road (data in `towns/gulch.js`); tap a pad for its card. Costs: crossbow timber (so the first tower comes in under a minute), cannon copper, frost lens bricks and copper, still bricks and tools; the town holds back the goods its next tower needs instead of selling them. Paths at level 5: Repeater or Longbow, Mortar or Grapeshot, Deep Freeze or Brittle Ice, Plague Cloud or Spreading Fever. Raiders: bandit, rider (wave 3+), armored brute (wave 6+), the war wagon every 10th wave; wave kinds mixed, rush, swarm, heavy. 30 s before wave 1, 12 s rests, and Call now pays for the time skipped. The vault holds 20; when it falls the town loses 10% of its coins and drops back two waves. Hits land at once in the core and the renderer draws the flight. Defense rests during offline catch-up until M4 brings background battles. The home view now frames the yard down to the far-side spots. A scratch greedy bot gave: first tower at 17 s, wave 10 at 6.5 min, no breach in waves 1-3, first breach at wave 15; the M1 target box tunes this with `tools/balance.js`. Pinch and twist are still untried on a real phone.
- [ ] **Phone shell.** The HUD, slide-up sheets, cards, side buttons, the title, settings, save slots, and export and import.
  - Settings includes the Install entry: `installButton()` from `src/ui/install.js` (button while Chrome offers it, the iOS hint on iPhone and iPad).
- [ ] **Town layer.** Town research, foremen, charter and deeds, and the Perks screen.
- [ ] **Target:** `tools/balance.js` gives wave 10 in 7-9 min, the first charter offered at 35-45 min, and no breach in waves 1-3.

### M2. Onboarding, then Evaluation 1
- [ ] **Onboarding.**
  - Tabs revealed one at a time; coach cards; alerts (tab dots and toasts).
  - A tutorial through the first 30 minutes.
  - Tap to explain on every number.
- [ ] **Bots and checks.**
  - `tools/firstplay.js`, the newcomer bot: it waits 3-8 s before acting, makes a wrong buy 30% of the time, and uses only the tabs it can see.
  - The full `tools/audit.js` (the list is in GDD.md and in Notes).
- [ ] **Fresh-eyes review.** Give a subagent only the screenshots and the bot tables; it writes `REVIEW.md` with at most 8 ranked issues. Fix the top ones here.
- [ ] **Target:** the newcomer bot is never stuck for more than 3 min in the first hour, and the audit is clean.

### M3. Iron Ridge and the empire map
- [ ] **Iron Ridge.** Data, models, the armored train, routes with wagons, and switching between towns.
- [ ] **The empire map.** Town dioramas, route splines with moving wagons, badges, and fly-in.
- [ ] **Target:** imports keep the Ridge workshops running, and a phone frame stays under 20 ms with 2 boards (fewer than 300 draw calls).

### M4. The Capital and Automation
- [ ] **The Capital.**
  - The treasury; institutions founded with coins; the Empire tree in Influence; federal contracts.
  - The Capital city scene.
- [ ] **Automation.**
  - The Automation panel (Auto-build, Auto-towers, Auto-research).
  - Background defense and offline catch-up.
  - `tools/idle.js`.
- [ ] **Target:** over 12 idle hours income rises every hour, spending never passes its cap, and the Capital opens at 2.5-4 h.

### M5. Silver Falls, pacing, then Evaluation 2
- [ ] **Silver Falls.** The power grid, the river and its boats, the steamer, models, and the 5-deed gate shown on the map.
- [ ] **Pacing and Evaluation 2.**
  - Tune pacing from the Gulch to the Falls.
  - A 24 h idle run, a 2 h newcomer run, and phone performance with 4 boards.
  - A fresh-eyes review, and its fixes.
- [ ] **Target:** Silver Falls opens at 6-10 h with charters, and at least 2.5 times later without them. Every earlier target still holds.

### M6. Market depth, Thunder Mesa and Radium Springs
- [ ] **Market depth.** Booms and busts, orders with deadlines and reputation, sell modes, and the Stock Exchange.
- [ ] **Thunder Mesa.** The sky lane and the airship.
- [ ] **Radium Springs.** Jamming and the Iron Colossus.
- [ ] **Target:**
  - no buy-and-sell loop earns coins (a test);
  - Thunder Mesa opens at 20-30 h and Radium Springs at 50-80 h;
  - the audit says every town is complete.

### M7. The top layer and polish
- [ ] **The top layer.** Laws, the Convention, Legacy and the Legacy perks.
- [ ] **Juice and extras.**
  - Builds rise in scaffolding; the boss gets an entrance; coins burst out.
  - Procedural music; gamepad support.
  - Every mission and badge.
- [ ] **Old-save bonus.** Read the old game's save once and grant deeds = min(15, floor(log10 of its lifetime coins)), plus a Pioneer badge. Never write the old key.
- [ ] **Target:** a second life reaches the first life's peak in under 30% of the time, and a bot completes every mission.

### M8. 1.0
- [ ] **Evaluation 3.** Every bot, a fresh-eyes review at phone, landscape and desktop sizes, the model contact sheet, and the fixes.
- [ ] **Release.**
  - Release 1.0.
  - In `../tycoon`, add a "Copper Gulch moved" card linking to the new site; the old game stays playable.
  - Push it with that repo's own checklist.
- [ ] **Target:** 1.0 is live and the old site links to it. After this the task stops and waits for the owner.

## Layout
- **`src/core/`:** pure, deterministic simulation.
- **`src/data/`:** goods, buildings, towers, foes, waves, the tree, laws, perks, badges and `towns/*.js`.
- **`src/render/`:** three.js scene, boards, camera, picking, the Capital, the empire map, effects and icons.
- **`src/assets/models/`:** the code-built models.
- **`src/ui/`:** DOM interface.
- **`src/art/`:** pixel sprites.
- **`src/audio/`:** music and sound.
- **`tools/`:** dev server, headless browser driver, smoke test, screenshots, contact sheet, bots, audit, version bump, update test.
- **`test/`:** `node --test` suites that import the core directly.
- **Reference:** the old game lives in `../tycoon` (frozen). It has good parts to adapt: `src/r3d/kit.js`, `units.js`, `capital3d.js`, `icons.js`, `music.js`, the grading shader, and the economy and combat formulas.
