# Copper Gulch fresh-eyes review

Based only on `shots/` (all 32 phone shots, most land shots, several desk shots) and `bot-tables.md`. Ranked most important first.

---

## 1. Playing well does not change anything. Dry Creek is an 11-minute Crossbow grind.

**Shows it:** `bot-tables.md` (balance strategies table and firstplay newcomer table), `outpost-*`, `outpost-fight-*`, `goal-*`.

**What a player experiences:** The newcomer bot (slow, makes mistakes, 47 to 64 wrong buys) wins Dry Creek in 10.9 to 11.3 min and reaches Gulch wave 10 in 7.7 to 8.1 min. The careful bot takes 11.0 to 11.3 min and 8.0 to 8.3 min. Every strategy bot lands on 11.1 to 11.2 min and 7.7 to 8.1 min. So waves arrive on a clock, and nothing the player does makes the game go faster. In Dry Creek the only tower is the Crossbow. Every bot buys 21 to 29 of them, and the goal strip has nothing new between minute 3.3 (`dc-up`) and minute 8.8 (`dc-path`). That is about 5.5 minutes of tapping Crossbow, then Upgrade, in a game whose rule is "about 3 minutes max with nothing new". A kid who plays carefully gets the same result as one who taps at random, and the first 11 minutes have one tower and one thing to do.

**Fix:**
- Make **Call now** pay off. Give bonus coins for calling a wave early, and let a cleared wave count down faster, so a strong defense finishes Dry Creek in about 7 min and a weak one in about 12.
- Add a test that the active bot beats the newcomer by at least 20% on Dry Creek win time and Gulch wave 10.
- Put one new thing into the 3 to 9 minute gap. For example, the Crossbow path choice earlier (around wave 4), or a second outpost tower, or a goal like "Beat a wave without a raider reaching the vault".

---

## 2. The Snake Oil Still carries the Gulch. Crossbow and Mortar are traps, and you cannot undo a bad buy.

**Shows it:** `bot-tables.md` ("most damage per wave", "damage by kind"), `selected-phone`, `mortar-phone`, `path-phone`, `why-tower-phone`.

**What a player experiences:** From Gulch wave 4 on, the Still leads almost every wave on every seed, and it leads every wave from about 20 to 31, both before and after the charter. It does 31 to 40% of the damage for 4 of 5 strategies. The Crossbow is the most-bought thing for the active bot (146 buys) but does only 5% of the damage. The Mortar is the last unlock, bought 36 to 41 times by minute 14, and still does only 4 to 6% (it only matters in the swarm bot at 26%). The Mortar never leads a single wave. On top of that, selling refunds almost nothing. A level 6 Heavy Cannon sells for **60 coins** (the same as level 1), and a level 4 Mortar sells for **240 coins** (the same as level 1). A player who spent thousands on Crossbow or Mortar levels is stuck.

**Fix:**
- Cut the Still's damage against unarmored raiders, or make poison not stack across Stills, so it is great against Brutes and armor but not everything.
- Give the Mortar a job only it can do (wide blast vs War wagons and packed groups) and roughly double its damage. Give the Crossbow a late path that scales (for example, a Repeater).
- Make the sell value include a share of the upgrade cost (for example, half of all coins spent).
- Gate on it: no tower over 35% of damage in any strategy, and every tower leads at least a few waves in at least one strategy.

---

## 3. A mid-game wall, then a charter that costs 35 minutes and gives nothing you can feel. The Perks card is confusing.

**Shows it:** `bot-tables.md` (goals list, "wave at 10/20/30/40/60 min", charter line), `perks-phone`, `perks-land`.

**What a player experiences:** The last new unlock (Mortar) comes at about 23 min. The charter is offered at about 37 to 42 min. In between there is nothing new, and waves crawl from about 27 to 31 with a breach every few waves for every bot. After signing, bots need **31 to 43 minutes to get back to the same wave**, which is about as long as the first time. So the reset feels like pure loss. The Perks card then says three things that don't add up for a 12-year-old: "Sign now to get 2 more deeds", "Your best wave is 34. That gives 1 deed", "You earned 100K coins. That gives 1 deed", and "You hold 2 deeds". Is that 2, 4, or 1+1? "Next deed at 850K coins" while you have 100K reads like a typo. Perks, Charter and Deeds are three new words for one system, and the red warning lists everything you lose but never says what you keep or how much faster you will go.

**Fix:**
- Make deeds strong enough that a signed town gets back to its old best wave in half the time or less. Add that as a pacing test.
- Add a new unlock or event between about 23 and 38 min (a new raider, a second Mortar pit, a building).
- Rewrite the card in one voice. "Sign the charter to start Copper Gulch over. You get 2 deeds. Each deed gives you 25% more coins forever. You keep your deeds and perks." Show "You have 2 deeds now" and "After signing you will have 4" as two plain numbers. Use one name (Charter) on the button and the heading.

---

## 4. The camera takes over at the worst moments and the goal strip goes out of sync.

**Shows it:** `entry-phone`, `entry2-phone`, `entry-land`, `outpost-entry-phone`, `outpost-entry-land`, `bandits-phone`, `bandits-desk`, `won-phone`, `won-land`, `town-phone`.

**What a player experiences:**
- **Arriving in a town:** the camera flies down the road at ground level. The highlighted pad and its "Lv 1" tag are cut off at the right edge on phone. Meanwhile the wave timer runs out ("in 1s", then "7 left · Mixed raid"), so the first raid is walking in before the player has seen the map.
- **The bandit wagon:** the camera zooms so close that the screen is one wagon and one giant crossbow. The goal still says "Tap a Crossbow, then tap Upgrade", but no normal Crossbow can be tapped. On desktop the yellow spotlight box sits on an empty crate.
- **Winning Dry Creek:** the scene goes dark and stays zoomed in. The goal strip still says "Beat wave 10 to open Copper Gulch" right above a card that says "Copper Gulch is open". The timer says "in 120s".
- In `town-phone` the player arrives with 15 coins and +0/s. The goal asks for a Crossbow that costs 20 coins + 8 timber, and nothing says to wait.

**Fix:**
- Hold the wave 1 timer until the fly-in ends, and end the fly-in on the normal overview with the spotlight fully on screen.
- Keep the wagon close-up to about 2 seconds, then go back to the overview. Never move the camera while a goal is pointing at something.
- Mark the goal Done (or switch to "Tap Go to Copper Gulch") the moment wave 10 is beaten.
- If the first tower can't be afforded yet, the goal should say "Wait for 20 coins, then tap a stone pad".

---

## 5. Tags cover the map, and goals point at names that are not on screen.

**Shows it:** `dots-phone`, `built-phone`, `short-phone`, `goal-phone`, `outpost-entry-phone`, `fight-phone`, `mortar-phone`, `research-land`.

**What a player experiences:** Every building wears a big "Lv 10" tag and every empty plot wears a "Build" tag. The tags sit on top of the building itself and on top of neighbors. In `short-phone` a "Build" tag covers the Cannon that is selected. The goal "Tap Build to build the Sawmill" shows three identical "Build" tags, and none of them says Sawmill. "Tap the Stone Camp, then tap Upgrade" spotlights a "Lv 1" tag, and the words "Stone Camp" appear nowhere on screen, so the kid has to guess which pile of rocks is the camp. A red ring sits on the road near the raider entrance with no explanation (`dots`, `goods`, `research-land`, `mortar`).

**Fix:**
- Put the name on the tag when it matters, for example "Sawmill" on the plot the goal points at. Show "Lv 10" only on the selected building, or as a small corner number.
- Draw tags offset to the side with a short stem so they never cover another object. Hide the "Build" tags on plots the player can't afford yet.
- Explain the red ring the first time it appears ("Raiders come in here"), or remove it.

---

## 6. Building, goods and research cards use words a 12-year-old can't read on the first try.

**Shows it:** `card-phone`, `foreman-phone`, `why-output-phone`, `goods-phone`, `why-price-phone`, `research-phone`, `spot-phone`, `mortar-phone`, `why-tower-phone`, `title-phone`.

**What a player experiences:**
- The **Selling / Holding** button shows a state, not an action. A kid can't tell if tapping "Selling" starts selling or stops it. Next to it, "Keep for towers · On" and "Saving 19 timber for towers" are a second toggle about the same timber.
- Foreman: "Buys the next level when it costs half your coins or less" is a rule to work out, not something that happens.
- Every other research button says **Busy**, which reads like the game is stuck.
- Bare numbers: "1/s", "+0.68/s", "× 0.22", "× 3.7", "× 1.15", "sells for 0.79 coins each".
- The same fact twice. The Stone pad card says "100 coins + 6 copper ore" and then "Copper ore 0 of 6. Build a Copper Mine to make copper ore". That turns four tower rows into a red wall of text. The title screen says "Build a town. Stop the raiders." and then "Build your town and fight off raiders."
- Mixed names. "+ 9 copper" on the Mortar but "copper ore" elsewhere, and "Heavy Cannon" on one card but "Cannon" on another with no path note.

**Fix:**
- One button with a verb: "Sell timber" / "Stop selling". Fold "Keep for towers" into it ("Sell extra timber", which always keeps what towers need).
- Foreman: "Hire foreman. He upgrades this camp for you when you have plenty of coins."
- Research: one line at the top, "One study at a time", and grey out the other buttons with "Wait".
- Rates as "1 timber a second". Price as "Price low. Sold too much." with a bar, not "× 0.22".
- Stone pad card: a missing item turns red in the cost line, plus one short hint ("Needs a Copper Mine").
- Drop the second title tagline.

---

## 7. Panels and toasts cover the HUD on phone.

**Shows it:** `built-phone`, `why-price-phone`, `built-land`, `research-phone`, `perks-phone`, `menu-phone`, `outpost-phone`, `why-output-phone`.

**What a player experiences:** The toast "Thick Walls level 1 is done." lands on the wave bar and hides **Call now** on phone, and it hides the **Goods** button in landscape. The Research, Perks and Menu panels slide up over the goal strip. The goal is cut mid-sentence ("Tap Build to ...") and the right-hand buttons are half hidden (only Perks' red dot peeks out). By mid-game the right column is four stacked buttons (Goods, Research, Perks, Menu) over the map on phone. Red dots light up on Goods, Research and Perks all at once. The Goods dot is already lit on the very first screen of Dry Creek, before goods mean anything, which teaches the kid to ignore red dots.

**Fix:**
- Put toasts at the bottom above the card area (or below the HUD), never on a button.
- Make full panels start below the HUD row, or hide the goal strip cleanly while a panel is open.
- On phone, merge Goods, Research and Perks into one "Town" button with tabs once there are more than two.
- Show a red dot only when something new can be done there, and not on minute one.

---

## 8. In landscape and desktop the Gulch is framed badly and the pads are tiny.

**Shows it:** `town-land`, `card-land`, `mortar-land`, `foreman-land`, `built-land`, `spot-land`, `town-desk`, `title-land`.

**What a player experiences:** A big orange cliff block fills the left third of the Gulch view in landscape and desktop, right where raiders walk in. A Mortar built there sits behind the cliff and only its range ring shows (`mortar-land`). In landscape at 860x400 the stone pads are about 20 px across, under the 30 px touch rule. The "Lv / Build" tags of the top row run into the goal strip (`built-land`, `foreman-land`). Open cards cover the right half, and the map does not shift to keep the selected tower in view. On the title in landscape, the Continue box sits on top of the town and the tagline overlaps a building.

**Fix:**
- Fit the camera to the path and plots inside the space left free by the HUD. Fade or cut away the near cliff when it covers a tower or the road.
- Use a closer zoom in landscape so pads are at least 30 px, and let drag pan.
- When a card opens on the right, slide the camera so the selected object sits in the left half.
- Push the title text and box apart in landscape.

---

## What was done with this review (2026.11.17-11)

- **Fixed now.** Issue 5: the tag the goal points at shows the building name ("Stone Camp · Lv 1", "Sawmill · Build"). Issue 6: the sell switch says "Sell timber · On/Off" (Goods: "Sell · On/Off"); the foreman line says "Buys the next level when you have twice what it costs"; the other research items keep a grayed Research button instead of Busy; a stone pad's tower option no longer repeats "0 of 6" under its cost when the building that makes the good is not built; the title's second line, which repeated the tagline, is gone; the reserve line and its switch are one switch, "Keep 8 for towers · On"; a building's output reads "1 a second". Issue 3 (the card): "Sign the charter to get 2 deeds. Then you will have 4.", "Best wave 34, worth 1 deed.", "You have 2 deeds. Each one adds 25% to all the coins you earn." Issue 7 (toasts): a toast now sits just under the top bar, so it never covers Call now or the side buttons.
- **Not real, from how the screenshots are staged.** The level 6 Heavy Cannon selling for 60 coins (the shot sets its level by hand; selling returns 60% of everything spent, upgrades included). The Goods dot on Dry Creek's first screen (the shot marks every help card as seen). The ground-level fly-in and the wagon close-up (the shot moves the camera there on purpose; the game has no fly-in). The goal under the win card (the shot fakes the win).
- **New boxes in PLAN.md (M2), worked next:** Skill pays (issue 1), Tower balance and the charter's payoff (issues 2 and 3), Camera framing in landscape and on desktop (issue 8, and the rest of issue 4).
