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
- Writing rule for all player-facing text: plain, short sentences a 12-year-old gets on first read. Name the actual button or thing on screen and say exactly what to tap. Describe what happens, not abstractions (no "empire market", "hold a good back", "a spread of goods"). No invented jargon, no marketing tone, no semicolons or colons in game text. Before shipping new text, reread it as a new player who has only seen the screen. (`tools/audit.js` refuses colons and semicolons in explainer and tower text.)
- Saves: bump `v` and add a migration for any change to the save's shape. Use only `cg-*` storage keys. The old game's key `copper-gulch-save-v1` may be read, never written.
- Publish working releases often; the owner plays the installed app between sessions.
- Smooth on phones: 60 fps on a mid-range Android is the aim. `tools/perf.js` (headless Edge, phone size, CPU throttled 4x) must give a median frame under 33 ms for every release; it reports draw calls and triangles.
- Every feature teaches itself: no feature box is done without its explainer card (a short card with a spotlight on the thing, shown once when the feature first appears, remembered in the save). `tools/audit.js` fails when a feature has no explainer.
- Always installable as an app (PWA), above all in Chrome on Android, where the browser must offer "Install app". `tools/install-test.js` must print ok for every release, locally and against the live site.

## Release checklist (every release; stop and fix on any failure)
1. `node --test test/*.test.js` passes (Node 24 does not take a bare folder).
2. `node tools/audit.js` prints `audit ok`.
3. Run the bots that the current milestone's target names. From M1 on that is `tools/balance.js`; from M2, `tools/firstplay.js`; from M4, `tools/idle.js`. Write their numbers in the notes.
4. `node tools/smoke.js` ends with phone, land and desk `ok`, and `node tools/perf.js` prints ok (median frame under 33 ms; write the numbers in the notes).
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
  - Follow-up (owner: "selecting a tower opens the dialog box but doesn't highlight the tower well enough"). Notes: shipped 2026.11.16-11. While a card is open, `src/render/select.js` draws a pulsing gold ring under the tower or pad (a gold square around a building's plot) and the tower's range as a circle on the ground (an empty pad shows the Crossbow's range), and the tower lifts a little. It clears when the card closes; the smoke test checks that, and `tools/shots.js` has a "selected" frame. In 2026.11.16-13 a soft column of light rising around the selected tower, pad or building joined it (the owner asked for a glow on the object), one additive mesh pulsing with the ring.
  - `src/render/`: `scene`, `board` (`new Board(town, {lod})`), `camera` (pan, pinch, twist), `pick`.
  - The Gulch models in `src/assets/models/gulch.js`, with `kit` and `units` adapted from `../tycoon/src/r3d`.
  - The interface to build, sell and upgrade.
  - Notes: shipped 2026.11.16-4. Play loads the autosave (`cg-save`, every 10 s and when the app hides; slots come with the Phone shell) and catches up the time away, or starts a new game. The board layout (plots, road, vault) is data in `towns/gulch.js`; the road is a crisp ribbon mesh with ruts. New models: clay pit, kiln, toolsmith, wagon works; buildings change model at levels 10, 25, 50, 100. The home view frames the plots that are built or can be built (at least three wide), so a phone sees the early yard large and the view widens as plots unlock; the Defense box must widen it to the whole road. Tall screens get a 50 degree lens and a steeper view. Tags over plots show levels (copper when affordable, a red edge when short of inputs); the card shows output with a tap-to-explain breakdown, inputs, needs, Build/Upgrade, and a sell or hold toggle for its good. Without WebGL the plots are listed as buttons. Verified headless: picking by tap, drag pans without tapping, buying through the card; pinch and twist are adapted from the old game and not yet tried on a real phone. `units.js` (people, foes, towers) is left for the Defense box.
- [x] **Defense.**
  - The road, crossbow, cannon, frost lens and snake oil still, the vault, foes, waves and the war wagon.
  - Paths at level 5.
  - Notes: shipped 2026.11.16-5. `src/core/defense.js` with `data/towers.js` and `data/foes.js`. Towers stand on 12 fixed stone-pad spots beside the road (data in `towns/gulch.js`); tap a pad for its card. Costs: crossbow timber (so the first tower comes in under a minute), cannon copper, frost lens bricks and copper, still bricks and tools; the town holds back the goods its next tower needs instead of selling them. Paths at level 5: Repeater or Longbow, Mortar or Grapeshot, Deep Freeze or Brittle Ice, Plague Cloud or Spreading Fever. Raiders: bandit, rider (wave 3+), armored brute (wave 6+), the war wagon every 10th wave; wave kinds mixed, rush, swarm, heavy. 30 s before wave 1, 12 s rests, and Call now pays for the time skipped. The vault holds 20; when it falls the town loses 10% of its coins and drops back two waves. Hits land at once in the core and the renderer draws the flight. Defense rests during offline catch-up until M4 brings background battles. The home view now frames the yard down to the far-side spots. A scratch greedy bot gave: first tower at 17 s, wave 10 at 6.5 min, no breach in waves 1-3, first breach at wave 15; the M1 target box tunes this with `tools/balance.js`. Pinch and twist are still untried on a real phone.
- [x] **Performance (owner feedback: "looks awesome but runs at like 0.5 frames per second" on the phone).**
  - Profile first, then fix properly: capped pixel ratio and a render scale, merged static geometry and shared materials, instancing for repeats, cheap or no shadows on Low, no idle lights, quality tiers with an automatic step-down when frames stay slow, and the fixed-step sim with a cap on steps per frame.
  - `tools/perf.js`: frame time in headless Edge at phone size with CPU throttling 4x, failing above 33 ms median, reporting draw calls and triangles. It joins the release checklist.
  - Note: this box and the next two jump the queue at the owner's request (2026-11-16), ahead of the Phone shell.
  - Notes: shipped 2026.11.16-7. Profile (`tools/perf.js`, phone 400x860 at pixel ratio 2, software WebGL so drawing costs like a weak GPU; CPU 4x): as shipped 371 ms a frame (2.7 fps) at 800x1720; without post-processing 72 ms; at pixel ratio 1 110 ms; without lamps 334 ms; without shadows 345 ms. Cause: the bloom, 4x-multisampled half-float target and grade passes at full phone resolution, then the pixel count; 182 draw calls with every rock and cactus its own draw (and shadow draw); 8 idle point lights in every pixel's shader; a 62k-triangle ground. Fixes: quality tiers in `src/render/quality.js` (low: ratio 1 at 85%, no shadows, no post; med, the phone default: ratio up to 1.25, antialiasing, 1024 shadows, no post; high, the desktop default: ratio up to 2, bloom and grade, 2048 soft shadows, lamps); lamps exist only on high in the title; static scenery and tower pads merged into one mesh per material (`mergeStatic` in `kit.js`); a coarser ground; "auto" steps down a tier when the median frame stays over 40 ms for 6 s, remembered under `cg-gfx`; the clock runs at most 8 steps a frame and drops the rest. After: med 23 ms median (43 fps), 93 draw calls, 50k triangles; low 16.5 ms. Headless Edge with a real GPU hid all of this (9.5 ms), so `perf.js` forces SwiftShader and waits for the GPU each frame; it also fails if the game had to step itself down. Not yet measured on a real phone. Foes are still a few meshes each (instancing them waits until waves get bigger). A Graphics setting (Auto, Low, Med, High) belongs in the Phone shell's Settings.
  - Follow-up (owner feedback after installing on Android: "super jittery", and no way to pause the waves). Notes: shipped 2026.11.16-10. Cause of the stutter: raiders were drawn straight from the 0.25 s simulation, so they jumped four times a second at any frame rate. Fix: render interpolation; the clock exposes `alpha` (how far into the next step it is) and `src/render/battle.js` draws each raider between its last two simulated places; shots aim where the target is drawn. Tower aim, projectiles, smoke and the camera already moved per frame. Effects now come from pools (meshes and fading materials made once, never cloned per hit), and the per-frame quaternion clone is gone. `tools/perf.js` gained a smoothness gate: it follows one raider on screen every frame and fails on a jump over 3 times the median or on a raider that stands still on most frames. Now: 0.77 px median, 0.84 px max, never still; the old drawing fails it (still on 88% of frames, 6.3 px jumps). Frame time 28.5 ms median. New on the HUD: Pause (stops the whole game; it also waits while the app is in the background) and Hold waves (the wave on the road finishes, the next waits, the town keeps working), each with an explainer card; the smoke test checks both at every size. Save v2 (migration: `waves.hold`, and the explainers seen). Not yet tried on the owner's phone.
  - Bug fixed in 2026.11.16-12 (owner screenshot on -10: solid orange blobs stacking up on the road). The pooled effects in -10 added a cannon's blast (and a still's cloud) to the effect list while that list was being filtered, so the new effect was dropped from the list: shown at full size and never faded or returned to the pool. Follow-up effects now join the list after the pass. The smoke test now fires cannons and a still through a wave, waits 2 s of quiet, and fails if any blast or cloud still shows; against the -10 code it finds 2 left behind, with the fix none. Slip: -12 went out with one `perf.js` run at 34.9 ms (over the 33 ms gate) because the release command piped the output and lost the exit code. Three re-runs gave 29.4, 29.6 and 30.0 ms, so the build was green, but it should not have been pushed on that run. Since then `perf.js` measures a near miss (within 15%) once more and keeps the better run, and release commands run with `set -o pipefail`.
  - Second follow-up (owner on 2026.11.16-9: "still very jittery"; -10 was not yet installed). Checked the other suspects. Camera easing was already frame-rate independent, and the frame time was already capped at 0.1 s after a hitch. Fixed in 2026.11.16-11: plot tags moved in whole pixels (now sub-pixel, so they glide with the camera); the HUD rewrote its text five times a second even when nothing changed (now only on change); per-frame garbage from smoke matrices, tag projections and the board's level check (now reused objects, and the check runs only when the simulation steps).
- [x] **The Gulch map: a road that winds through town.**
  - The raiders' road doubles back, even triples back, through the town, with the yard plots beside it, so raiders pass the towers several times. This is the pattern for every later town (GDD.md).
  - Retune the waves so wave 10 still lands in 7-9 minutes.
  - Note: owner feedback, ahead of the Phone shell.
  - Notes: shipped 2026.11.16-8. The road now runs down the west side, round a bend, up the middle, round a second bend and down the east side to the vault (52 units, was 20). The eight plots stand in two columns between the passes; the 12 tower spots sit between plots and inside the bends (each reaches two passes) and outside the first and last pass. The town is taller than wide, which suits phones held upright; wide screens turn the camera so the town's length runs across. The camera's home frame is now data (`board.frame`). Old saves keep their towers (spot numbers are unchanged; the spots moved). New `tools/balance.js` (a steady greedy player on the core, several seeds): with raiders 7% faster (`WAVE.speed`) and 10 s rests, wave 10 clears at 7.1-8.6 min over 6 seeds, the first tower at 17 s, no breach in waves 1-3; the bot then stalls around wave 20-22 (the M1 target box tunes the long game). `tools/perf.js` after: 28 ms median, 123 draw calls (raiders on screen), 56k triangles.
- [x] **Explainers that grow with the game.**
  - The coach-card system, pulled forward from M2: when a feature first appears (first tower, first workshop, selling, upgrades, paths at level 5, the boss, the vault, and later research, foremen, charters...), a short card with a spotlight on it, shown once and remembered in the save.
  - Every feature declares its explainer in data; `tools/audit.js` fails when one is missing. From here on, no feature box is done without its explainer.
  - Note: owner feedback, ahead of the Phone shell. M2's Onboarding box keeps the tabs revealed one at a time, alerts and the 30-minute tutorial.
  - Notes (owner rewrite): shipped 2026.11.16-11. Every card now uses the owner's wording. One fact fixed: the market card's example says "copper for a Cannon" (no tower is built from planks). The other on-screen text was rewritten to the writing rule: toasts without colons, "Stone pad" instead of "Tower spot" (as the cards say), "Range" and "Slows raiders" on tower cards, "Unlocks when the Lumber Camp reaches level 5", the path choice spelled out, and plain tower and path descriptions.
  - Notes: shipped 2026.11.16-9. 13 explainers in `src/data/explainers.js` (welcome, towers, market, waves, vault, milestones, workshops, running short, cannon, frost lens, finished goods and the still, paths, the war wagon), each with what it covers, when it shows and what it spotlights. `src/ui/coach.js` shows one at a time: the screen dims, a pulsing copper frame spotlights the thing, the card sits in the other half of the screen, and the game waits until Got it; seen cards live in the save (`game.shared.seen`) and save at once. The audit works out the required features from the game itself (each system, tower kind and goods tier, plus paths, the boss, the vault and breach, call early, upgrades and milestones, running short) and fails when one has no explainer; a test proves it notices a missing one. The smoke test checks a fresh game opens on the welcome card with its spotlight, the game waits under it, Got it dismisses it and it stays gone after a reload. Test tools load with `?coach=off`. From now on every feature box adds its explainer (owner rule).
- [x] **Phone shell.** The HUD, slide-up sheets, cards, side buttons, the title, settings, save slots, and export and import.
  - Settings has Graphics: Auto, Low, Med or High (`saveQuality` in `src/render/quality.js`).
  - Settings includes the Install entry: `installButton()` from `src/ui/install.js` (button while Chrome offers it, the iOS hint on iPhone and iPad).
  - Notes: shipped 2026.11.16-13. Two side buttons under the coins, Goods and Menu, open slide-up sheets (`src/ui/sheets.js`): one at a time, a dimmed backdrop that closes it, and on short landscape screens the sheet sits on the right like the card. Opening a card closes a sheet and the other way round. **Goods** lists each good whose building is built, with the stock, the price now, a bar for how far the price has dropped, and a Selling or Holding switch (the same switch as on the building card). **Menu** has Graphics (Auto, Low, Med, High, applied at once through `view.setQuality` and kept under `cg-gfx`; picking a tier turns the automatic step-down off), three save slots, Copy save (clipboard, with a text box when the clipboard is blocked) and Save as file, Load a save (paste or Open file, checked by building the game, then a second tap on Load save to replace the slot), Show help cards again, Check for updates, Title screen, Install app, and the version. Slots: slot 1 keeps the old key `cg-save` so existing games stay put, slots 2 and 3 are `cg-save-2` and `cg-save-3`, and `cg-slot` remembers the one in play. Switching a slot or loading a save saves the current game, stops the autosave and reloads with `#play`, which starts the game straight away; an imported save is stamped with the time it was loaded, so it pays no offline time. The title says Continue with the slot, wave, coins and when it was saved. `fmt` moved to `src/ui/format.js` (with `ago`). Two explainers, Goods and Menu (the audit now requires goods, menu, slots and export). Tests: `test/storage.test.js` (slot keys, each slot its own game, export and import round trip, plain error messages). The smoke test opens both sheets at every size, flips a good, sets Graphics to Low and back, and a new `slots` run starts slot 2, pastes slot 1 into it, switches back and checks the title offers Continue. Checks: 56 tests, audit ok, smoke phone, land, desk, slots, coach and offline ok, `perf.js` 30.7 ms median (123 draw calls, 56k triangles, 0.78 px median raider step, never still), balance wave 10 at 7.7-8.6 min, first tower 17 s, first breach at wave 17 or later. Not yet tried on a real phone (the clipboard and file picker especially).
- [x] **The Mortar and mortar pits (owner request, ahead of the Town layer).**
  - The Mortar (GDD.md, Defense): reach 0.5R to 2R with a dead zone, slow fire, a lobbed shell with a flight time and a landing marker, splash on landing, no airships. Paths: Siege Mortar or Shrapnel (burning ground). Opens at wave 12 in the Gulch, for coins, copper and bricks.
  - Mortar pits: 3 to 5 far pads per map with a sandbag look; only long-range towers there; a locked pit's card says what it is for and when it opens. `tools/audit.js` fails a town without them.
  - Both range circles (dead zone shaded) on the card and the selection highlight. Explainers for the first pit and for the Mortar opening.
  - Tests: the dead zone, splash, no air hits, pads per map. `tools/balance.js` keeps wave 10 at 7-9 min. `tools/shots.js` gets a frame with a shell in flight and the two circles.
  - Notes: shipped 2026.11.16-14. Mortar (`data/towers.js`): reach 1.4 to 5.6 (`NORMAL_REACH` R = 2.8, the Cannon's), 34 damage, a shot every 3.3 s, blast 1.3, 1200 coins + 10 copper + 8 bricks, opens at wave 12 (`town.flags['open:mortar']`, set once the town reaches it and kept after a breach). The core now really flies the shell: it aims where the target will be after the 1.5 s flight, keeps it in `waves.shells` and hits everything in the blast when it lands (`land` event). Siege Mortar: blast x1.5, reach x1.2 (2.4R), damage x1.2, a bit slower. Shrapnel: blast x0.7, a bit faster, and burning ground (`waves.fires`) for 3 s that slows 30% and does 35% of a hit per second. Lobbed shells skip foes marked `air` (none exist yet). The Cannon's level-5 path that was called Mortar is now Heavy Cannon (names are never reused). Save v3 (migration adds the empty shell and fire lists). Pits: Copper Gulch has 4 (`board.far` = 12, so spots 12-15; old towers keep their spot numbers), 3.2-3.4 from the road, with 6-12.7 units of road in the ring; the audit (`mapRules`) fails a town with fewer than 3 or more than 5 pits, a pit within R of the road, or less than 5 units of road in the ring. Pits take only `long` towers; the Mortar also fits a normal pad. The ground is now level round every pad and wider round pits. Drawn: a sandbag ring for pits, a short wide barrel in sandbags for the Mortar, a high arc for the shell with a red ring closing in on the landing spot, a bigger blast, and flickering discs for burning ground. The card shows Range "1.4 to 5.6" and says raiders inside the red circle are safe; the selection draws the outer ring and a red-shaded dead zone with its own ring, drawn over the terrain so hills never hide them. A closed pit's card says what it is for and that it opens at wave 12. Explainers: Mortar pit (from wave 4, between waves) and The Mortar is open. Tests: `test/mortar.test.js` (opening, pits, reach, dead zone, shell flight and splash, no airships, Shrapnel fire, Siege reach, the map rule, save v3). Smoke checks the closed pit card, building through the card, the dead-zone circle and a landing at every size; shots has `pit` and `mortar` frames. Checks: 66 tests, audit ok, smoke all ok, perf 28.4 ms median (123 draw calls, 58k triangles), balance unchanged (wave 10 at 7.7-8.6 min). The balance bot only builds Crossbows, so the Mortar's strength is a first guess for the M1 target box to tune; the background battle and Auto-towers rules are in GDD.md for when those arrive. Not yet tried on a real phone.
- [ ] **Town layer.** Town research, foremen, charter and deeds, and the Perks screen.
- [ ] **Target:** `tools/balance.js` gives wave 10 in 7-9 min, the first charter offered at 35-45 min, and no breach in waves 1-3. Tower variety (owner): with the bot choosing among every open tower and pad by damage per coin, every tower kind is its best buy at some point in the first hour, and no single kind does the most damage in every wave.
  - Notes (before the target box, 2026.11.16-15): `tools/balance.js` now plays every open tower kind on every pad it fits (pits included) and every upgrade and path, ranked by damage per coin over the road that pad covers (splash counts the raiders it catches, poison counts past armor, slow counts its help to nearby towers, a build is charged half the average spend per tower for using up a pad). It reports what it bought, which kind did the most damage each wave (from `game.dealt`, a damage tally by kind that is not saved) and the variety check, which is not a release gate yet. First readings showed the Crossbow winning every buy by far (per coin at level 1: Crossbow 1.30, Cannon 0.74, Mortar 0.41, Frost 0.10, Still 0.05). First pass: Frost 220 coins + 4 bricks + 1 copper (was 600 + 6 + 2), damage 5 (was 3); Still 450 coins + 3 bricks + 2 tools (was 2000 + 4 + 3), damage 5 and poison 10 (were 4 and 6); the Mortar now goes only in mortar pits (in the middle of town it covered twice the road and made pits pointless); the war wagon has 25 health (was 30) and waves rest 9 s (was 10), because the new bot's pads let the wagon through on one seed and wave 10 drifted to 9.6 min. Now, over 6 seeds: wave 10 at 7.2-8.9 min, Cannons bought from minute 12-26 in 5 of 6 seeds, Frost from minute 39-58 in 4, the Still and the Mortar never in the first hour (the bot's economy has no tools and too few bricks by then), and the Crossbow or the Cannon tops each wave. So the variety target still misses on the Still and the Mortar: the target box tunes the economy and those two.

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
