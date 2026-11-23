/* What's new: plain notes for each release, newest first, in the player's words (the writing rule in PLAN.md).
   On opening a newer version, the title shows every entry since the version this device last saw (src/ui/news.js).
   Every release adds its entry here in the same commit. */
export const NEWS = [
  {
    v: '2026.11.23-10',
    lines: [
      'A red dot on Map now shows every town that needs you, held towns too.',
      'In a boss fight with few hearts left, the Goal says which tower to upgrade.',
      'Messages no longer leave one word alone on the last line.',
    ],
  },
  {
    v: '2026.11.23-9',
    lines: [
      'While waves are on hold, only Resume waves shows. Call now comes back once they run.',
      'Goals for several towers count them, like 2 of 5.',
      'Boss bar lines say what changed, like Crew off, slower.',
      'Building cards fit on a phone turned sideways, foreman and all.',
    ],
  },
  {
    v: '2026.11.23-8',
    lines: [
      'When Iron Ridge beats wave 30, a message says what the Capital costs.',
      'While you save for a Capital building, the Goal asks you to keep a contract going.',
      'Iron Ridge asks for a tower at level 15 at wave 28.',
      'A town that loses while you climb to the Capital waits for you.',
    ],
  },
  {
    v: '2026.11.23-7',
    lines: [
      'Pause and Hold waves now fit on a phone turned sideways.',
      'Goods shows when a price is way up or way down.',
      'A tip about one town no longer shows up after you move to another place.',
      'The Goal shows your coins only while you still need more.',
    ],
  },
  {
    v: '2026.11.23-6',
    lines: [
      'The Capital now costs 25K coins. The Goal asks you to hold the waves while you save for it.',
      'Iron Ridge has new goals for the Steel Mill and for towers as you climb.',
      'Tap the Goal to open the card of the building or tower it names.',
      'After the Capital, the Goal asks for a contract and then one of its buildings.',
    ],
  },
  {
    v: '2026.11.23-5',
    lines: [
      'Iron Ridge has three new research items. Telescope Sights shows up at wave 27, Steam Hammers at wave 32 and Bounty Office at wave 37.',
      'Each one has a good side and a bad side.',
    ],
  },
  {
    v: '2026.11.23-4',
    lines: [
      'The Capital now costs 60K coins, not 150K.',
      'Before the Capital, the Goal says to beat wave 30 in Iron Ridge.',
      'After that, the Goal in every town shows the coins the Capital needs.',
    ],
  },
  {
    v: '2026.11.23-3',
    lines: [
      'A goal that needs coins now says about how soon you can pay for it if you save.',
      'Fixed a rare freeze when a raider spreading poison fell just as the war wagon crew jumped off.',
    ],
  },
  {
    v: '2026.11.23-2',
    lines: [
      'The Goal at the top always shows a next step. With no goals left in a town, it shows how to open the next town or the Capital.',
      'A goal to build a new lot shows your coins and its price. A goal for a locked lot names the building to upgrade first.',
      'The Mortar goal asks for a Kiln first. The Mortar needs bricks.',
      'In Goods, each Sell spare choice says what it does.',
    ],
  },
  {
    v: '2026.11.23-1',
    lines: [
      'Tip cards have a speaker button at the top right. Tap it to hear the card read out loud. Tap it again to stop.',
      'In the Menu, turn on Read cards aloud to hear each new tip card by itself, and set how loud with Voice. It uses the voice built into your device, so it works offline.',
      'A raider card shows the best tower against it on its own line.',
    ],
  },
  {
    v: '2026.11.22-12',
    lines: [
      'Towns look sharper on phones, with smoother edges on buildings, towers and people.',
      'When Graphics in the Menu is set to Auto, the picture gets sharper if your phone keeps up, and softer if the game slows down.',
    ],
  },
  {
    v: '2026.11.22-11',
    lines: [
      'After To arms, tap a pair of workers by the road to see how long until they go back to work and what their building is not making.',
    ],
  },
  {
    v: '2026.11.22-10',
    lines: [
      'When a boss is on the road, a bar under the top bar shows its health, its armor and what it is doing. Tap the bar to see its card.',
      'Bosses change when they are badly hurt. The war wagon crew jumps off and runs, the bandit wagon horsemen ride off, the armored train drops its plates and the steamer goes full steam.',
    ],
  },
  {
    v: '2026.11.22-9',
    lines: [
      'Tap a raider on the road to see its health, its armor and what is on it, like poison, frost or fire.',
      'Each effect shows how many seconds it has left. The card follows the raider until it falls or gets through.',
    ],
  },
  {
    v: '2026.11.22-8',
    lines: [
      'A Crossbow that reaches level 20 picks Piercing Bolts or Sharpshooter.',
      'Piercing Bolts go through up to 3 raiders in a row. Sharpshooter aims at the toughest raider and hits much harder.',
      'A Crossbow already past level 20 gets the choice with its next upgrade.',
      'A foreman now waits instead of raising a workshop that the goods shipped to it could not keep running.',
    ],
  },
  {
    v: '2026.11.22-7',
    lines: [
      'The river now runs under every bridge in Silver Falls and on the map. Trains ride across the top.',
      'Tap Hold waves and the top of the screen says On hold right away, even during a fight.',
    ],
  },
  {
    v: '2026.11.22-6',
    lines: [
      'A Still or Cannon you raised past level 20 now gets its level 20 choice. Tap it to pick.',
      'Last Call now hits raiders low on health much harder, wherever it stands.',
      'The level 20 choices say what they do in one short line.',
    ],
  },
  {
    v: '2026.11.22-5',
    lines: [
      'Each town researches on its own list. Outposts have no research.',
      'Open Research in a town or outpost to see what your other towns research. Tap a town to go there.',
      'Auto switches work only in the town where you turn them on.',
    ],
  },
  {
    v: '2026.11.22-4',
    lines: [
      'Beat wave 10 in Iron Ridge and buyers in each town start to send orders. Tap Goods to see them.',
      'Tap Take on an order. Your town sends the goods by itself. You get more coins than if you sold them.',
      'Fill orders in time to raise your reputation. When it reaches 60, rush orders start. They pay more.',
    ],
  },
  {
    v: '2026.11.22-3',
    lines: [
      'Once Iron Ridge is open, every few minutes one good sells for more, for 90 sec. This is a boom. Sometimes one sells for less, a bust.',
      'A green arrow on a good at the bottom of the screen shows a boom. A red one shows a bust.',
      'Tap Goods, then Sell spare on a good, to pick Always, Skip busts, Booms only or Off.',
    ],
  },
  {
    v: '2026.11.22-2',
    lines: [
      'Turn on Fight the war wagon again in Auto. A town that loses then keeps playing.',
      'Lose wave 20 and it plays wave 19 again and again. You still earn coins for each raider.',
      'Once a tower goes up a level, it tries wave 20 again.',
    ],
  },
  {
    v: '2026.11.22-1',
    lines: [
      'Buy the Armory at the War Office and every town gets a To arms button.',
      'Tap it to send your workers out to fight on the road for 40 sec. Their buildings make nothing while they fight.',
      'Your workers shoot the boss first. You can call them again 5 min after.',
      'Sell is now at the top of each tower card.',
    ],
  },
  {
    v: '2026.11.21-9',
    lines: [
      'Tap a level 19 Cannon to pick Rocket Battery or Big Shell.',
      'Rocket Battery fires 4 rockets at once, each at its own raider. It reaches far.',
      'Big Shell fires one huge shot. It hits the war wagon and other bosses twice as hard.',
      'On a sideways phone, both Choose buttons now fit on the card.',
    ],
  },
  {
    v: '2026.11.21-8',
    lines: [
      'From level 10, Snake Oil Still poison eats half of the armor on brutes and bosses.',
      'Your other towers then hit the poisoned ones harder.',
      'In Iron Ridge a Still now costs stone and coal, not iron.',
    ],
  },
  {
    v: '2026.11.21-7',
    lines: [
      'Tap a level 19 Snake Oil Still to pick Slow Rot or Last Call.',
      'Slow Rot poisons raiders until they fall. Best near the start of the road.',
      'Last Call hits up to 3 times harder near the vault. Best near the end of the road.',
    ],
  },
  {
    v: '2026.11.21-6',
    lines: [
      'Town names on the map now sit beside each town, not on top of it.',
      'On a phone the names no longer hide the Capital, Silver Falls or Iron Ridge.',
    ],
  },
  {
    v: '2026.11.21-5',
    lines: [
      'The map is redrawn. Each town now sits right on its own land.',
      'Pines grow around Pine Hollow and gray rocks around Iron Ridge.',
      'A river falls from a cliff and runs down to Silver Falls.',
      'Each town shows the canyon or tunnel its raiders come from.',
      'Build the Rail Office in the Capital to run trains between your towns.',
      'Cloud shadows drift over the map. Towns you have not started show a tent and a campfire.',
    ],
  },
  {
    v: '2026.11.21-4',
    lines: [
      'Buildings change as you level them up. At level 25 the windows light up.',
      'At level 50 a building gets taller and stands on a stone base with a flag.',
      'At level 100 it gets a gold band and a gold flag.',
      'Raiders have a soft shadow under them, and big towns run smoother.',
      'The Sell button on a tower card in landscape shows a coin.',
      'The line at the bottom of the title screen is easier to read.',
    ],
  },
  {
    v: '2026.11.21-3',
    lines: [
      'People walk between the buildings now, and birds circle high above.',
      'A wagon comes up the road between waves and leaves when raiders come.',
      'Tumbleweeds roll by in the wind. During a wave, people stay indoors.',
    ],
  },
  {
    v: '2026.11.21-2',
    lines: [
      'Towns have a new look. The sand has ripples, grass grows along the roads, and rocks sit around each town.',
      'Stone pads look like real stone now, with soft shadows. A few sit a little farther from the road.',
      'On a phone, no stone pad is cut in half at the edge of the screen when a town opens.',
    ],
  },
  {
    v: '2026.11.21-1',
    lines: [
      'In Goods, Save for towers has two buttons, 2 upgrades and 4 upgrades. Each building card uses the same name.',
      'A Mortar shell now shows a dark spot where it will land, like its shadow.',
      'On the map, a red dot means a town has a problem. A gold dot means something is ready, like a Capital contract.',
      'In landscape, a tower card has its Sell button at the top, so nothing hides under the price.',
      'Clearer words for lost waves, research and the income list.',
    ],
  },
  {
    v: '2026.11.20-18',
    lines: [
      'On the map, every town shows what its waves are doing. Fighting, the time to the next wave, or On hold in red.',
      'A won outpost shows Raids and the time to the next raid. Its raids keep coming and its towers hold them.',
      'A thin bar under each map label fills as raiders fall or the next wave gets close.',
      'Research and Capital prices show the price first, with what you have under it.',
    ],
  },
  {
    v: '2026.11.20-17',
    lines: [
      'Every map has more stone pads to build towers on, about half again as many.',
      'Copper Gulch and Iron Ridge each have one more mortar pit.',
      'Once a town has as many towers as it used to have pads, each new one costs more than the last. Upgrades cost the same.',
    ],
  },
  {
    v: '2026.11.20-16',
    lines: [
      'The Research button is in every town and outpost once you have research anywhere.',
      'Research shows what is running in your other towns and how long it has left.',
      'In Auto, Auto-research names what it is working on. Tap See research to open it.',
    ],
  },
  {
    v: '2026.11.20-15',
    lines: [
      'A red heart by the wave number shows how many more hits your vault can take.',
      'Prices show what something costs first, with what you have under it.',
      'Picking a tower path says that either path costs the same.',
      'A picked tower slides clear of the goods strip, with its whole range in view.',
    ],
  },
  {
    v: '2026.11.20-14',
    lines: [
      'The wave bar shows how many hits your vault can take, like Vault 20/20.',
      'On the map, a town shows its vault only after raiders hit it. Town names cover less of the next town.',
      'Each good on the strip shows its count in the same corner.',
      'Picking a tower path shows the price on its own line.',
      'Auto says why it is waiting before it tries the boss again.',
    ],
  },
  {
    v: '2026.11.20-13',
    lines: [
      'The bar next to the wave number now says Vault, so you know what it shows.',
      'A camp card says which buildings use its goods, so you can see where your timber goes.',
      'At Silver Falls, power has its own line on each card, and a slow building says to upgrade the Water Wheel.',
      'On a phone turned sideways, cards take less of the screen, and town names on the map keep apart.',
    ],
  },
  {
    v: '2026.11.20-12',
    lines: [
      'The town name, wave bar and Pause stay in the same place on every screen.',
      'Power shows on the goods strip once your town makes it. Each town lists its own goods first.',
      'A goal that sends you back to a town names the back button. Every button that takes you to a place says Play.',
      'The Mortar and the Still name the boss they are best against, and the Rail Office names your outposts.',
      'In Goods and on each building, the switch for tower goods is called Keep for towers.',
    ],
  },
  {
    v: '2026.11.20-11',
    lines: [
      'Raiders face the way they ride again, and stay hidden inside the entrance until they come out.',
      'The bridges at Silver Falls arch over the river, and the steamer folds its stack to pass under them.',
      'Goods shows what is kept for towers and what is spare on every row, and the price bar says how far the price is down.',
      'Your Influence shows under your coins on the map.',
      'The goal tag points at its building, or toward it when the building is off the screen. Auto says which good it waits for.',
    ],
  },
  {
    v: '2026.11.20-10',
    lines: [
      'In Goods, Keep goods for says how many tower upgrades it saves for, and each price bar shows how close it is to the best price for that good.',
      'Auto, foremen and the map all say Upgrade, the same word as the buttons.',
      'Iron Ridge starts with goals that lead you to the Blast Furnace.',
      'Copper Gulch starts with enough coins for its first Crossbow.',
      'On the map, a place ready to build no longer shows a lock.',
    ],
  },
  {
    v: '2026.11.20-9',
    lines: [
      'In Goods, the town switch is now Keep for each tower, and the price bar ends in Full price down to Very low price.',
      'Every price under 1 coin now reads under 1 coin each.',
      'Perks says what a charter does before you sign, and what each deed gives you.',
      'Sandy Bend has its own goals, and the Dry Creek mine is now the Copper Camp.',
      'In landscape, a building you tap slides clear of the goods strip.',
    ],
  },
  {
    v: '2026.11.20-8',
    lines: [
      'In Goods, each good shows how many are saved for towers and how many are spare to sell.',
      'Save for towers now says 2 upgrades or 4 upgrades, and 4 upgrades saves for 4 levels of every tower.',
      'The price bar always starts with the price.',
      'The Capital tabs are Contracts and Buildings, and the Department of Transportation is now the Rail Office.',
      'A goal on a stone pad shows a ring lying on the pad, and a Mortar shows both of its circles in one color.',
    ],
  },
  {
    v: '2026.11.20-7',
    lines: [
      'While one research runs, tap Do next on another and it starts as soon as the first is done.',
      'The fast raiders are now called Horsemen.',
      'In Goods, the price sits on the price bar in whole coins, and the switch says Sell spare.',
      'Building lots in Iron Ridge and Silver Falls match the ground, so they no longer all glow orange.',
      'A tapped tower or pit keeps its whole range circle in view when there is room.',
    ],
  },
  {
    v: '2026.11.20-6',
    lines: [
      'Level numbers on buildings stay solid in a fight and step aside only while a raider walks under them.',
      'With the phone turned sideways, a tapped Mortar pit slides fully into view.',
      'Perks lists your deeds in short rows, and Sign the charter is the same size as the other buttons.',
      'Town labels on the map keep a little more room between them.',
    ],
  },
  {
    v: '2026.11.20-5',
    lines: [
      'Goods shows every good the same way, with how many are kept for towers and the price.',
      'Tap a stone pad on a phone and its card leaves room to see the pad.',
      'The town switch on Goods is now called Tower stock.',
      'On the map, a town card says how many hits its vault can take.',
    ],
  },
  {
    v: '2026.11.20-4',
    lines: [
      'Switches like Sell and Keep for towers light a small green On box, so a card is not full of yellow buttons.',
      'The foreman switch now says Foreman buys levels.',
      'With the phone turned sideways, cards are wider and both tower paths show side by side.',
      'The goods strip fits more goods on a phone, and the more box stays inside the strip.',
      'On the map, a town card says Vault Full, and the Capital names the good you are sending.',
    ],
  },
  {
    v: '2026.11.20-3',
    lines: [
      'Tap the wave number to see a picture of each raider and the tower that beats it best.',
      'On tower and building cards, Sell moved away from Upgrade, so the price above Upgrade is only for Upgrade.',
      'Only one button shows a red dot at a time.',
      'With the phone turned sideways, your goal label stays in view.',
      'Goods shows how high each price is, from Very low to Top.',
    ],
  },
  {
    v: '2026.11.20-2',
    lines: [
      'With the phone turned sideways the goods strip keeps to one row.',
      'The wave bar stays in place when the Map button shows up.',
      'Goods has one Sell switch for each good, and Keep for towers says how much it saves.',
      'Research shows the coins you have and need, and says what it waits for.',
      'The Blast row on a Cannon or Mortar opens like Damage does.',
    ],
  },
  {
    v: '2026.11.20-1',
    lines: [
      'Your towns keep more goods for towers. Each town saves enough for the next two upgrades of every tower and two new towers.',
      'Workshops leave those goods alone too, so a Smelter no longer uses up the ore your Cannon needs.',
      'Want even more saved? Open Goods and tap Keep for towers to switch it to Lots.',
    ],
  },
  {
    v: '2026.11.19-14',
    lines: [
      'Building labels are small now. The full label shows on your goal and on the building you tap.',
      'The wave bar keeps one size. It shows the wave, a timer and Call now.',
      'Tap the wave number to see which raiders are coming.',
    ],
  },
  {
    v: '2026.11.19-13',
    lines: [
      'On a tower, the old waves bonus is shorter, and the wave number turns gold while it is on.',
      'Prices under 1 coin say what 10 or 100 bring, like 6 coins per 10.',
      'The goods strip keeps to two rows. Tap the last box to see the rest.',
      'Perks shows your deeds now and after you sign.',
      'Building upgrades show the coins you have and need. Crowded map labels show just the name.',
      'Saving for Iron Ridge starts with Tap Hold waves. Then the goal points at your coins.',
    ],
  },
  {
    v: '2026.11.19-12',
    lines: [
      'On a tower, the old waves bonus says your towers are stronger on waves you beat before.',
      'A foreman that is not buying says when it will buy the next level.',
      'In the Capital, each building shows its first upgrade, and what you bought stays on its card.',
      'On the map, the yellow border marks the place whose card is open, and the labels crowd less.',
      'Sideways on a phone, tapping Damage on a tower card brings its list into view.',
      'In Goods, a price gives one reason at a time.',
    ],
  },
  {
    v: '2026.11.19-11',
    lines: [
      'Perks says what signing pays, like Sign now and get 2 deeds, with fewer words around it.',
      'On a tower, the bonus for waves you beat before says up to which wave it lasts.',
      'The Department of Transportation names the outposts it helps.',
      'With no contract running, the Capital just says so.',
      'Sideways on a phone, a tower card fits without scrolling.',
      'In Income, the bonuses say they are already in the total. A camp no longer says it is short of materials.',
    ],
  },
  {
    v: '2026.11.19-10',
    lines: [
      'A finished goal says what you did, like Sand Pit is level 4.',
      'With a card open on the map, the whole map fits above it, so you see every town and what it earns.',
      'The map card shows the vault in hits and the coins the same way as the label under the town.',
      'In Goods, a good with none to sell says what it would pay instead of a long price list.',
      'On a phone, cards stop under Pause and Hold waves. Upgrade prices stay on one line.',
      'After a lost wave, the message asks for one tap at a time.',
    ],
  },
  {
    v: '2026.11.19-9',
    lines: [
      'In Income, other towns read Earned in and the town name, with the same coins a second as the map.',
      'Tower damage rounds the way you would, so its parts multiply to the total.',
      'Before you build them, the Capital buildings say how much they give, like You earn up to 39% more coins.',
      'The Iron Ridge goal asks for one thing at a time and counts your coins up to the price.',
      'A workshop that makes nothing right now says None right now.',
      'After a lost wave, the map says the vault is full again.',
    ],
  },
  {
    v: '2026.11.19-8',
    lines: [
      'In Silver Falls, a workshop card shows how much power the Water Wheel makes and how much your workshops use.',
      'In Goods, a good your towers need all of says there is none to sell. A good you do not sell shows what it would sell for.',
      'Research shows how many levels you have done.',
      'The message after a fallen vault names every button to tap, Play too.',
      'The Income menu and the coins at the top always show the same number, and Goods shows the same counts as the bottom bar.',
      'Goods sent in from another town stay on the bottom bar, even at 0.',
    ],
  },
  {
    v: '2026.11.19-7',
    lines: [
      'On the map, the coins each town earns add up to the total at the top. A town on hold still shows what it earns.',
      'Menus open below the buttons on the right, so none is cut in half.',
      'A message hides the building levels under it until it goes.',
      'Menus and cards never cover your goods at the bottom, and every good shows its full name.',
      'A building level is never shown cut in half.',
    ],
  },
  {
    v: '2026.11.19-6',
    lines: [
      'The coins you earn from each place now add up to the total shown.',
      'A message waits while a menu fills the screen, so it never covers Pause.',
      'Building levels stay in view under the goal at the top.',
      'A locked town on the map shows its wave next to the wave it needs.',
    ],
  },
  {
    v: '2026.11.19-5',
    lines: [
      'A workshop that runs short shows how much it really makes, and tapping it shows what it is short of.',
      'A good you sold too much of reads almost 0 coins.',
      'Cards open above your goods, so you can always see how many you have.',
      'Messages on the map move down so they never cover a town name.',
      'Costs on a card count your goods the same way as the bar at the bottom.',
    ],
  },
  {
    v: '2026.11.19-4',
    lines: [
      'A building card says what it makes with the good named, like 2 planks a second.',
      'While research runs, its button shows the time left.',
      'Perks says that more deeds let you pick more perks.',
      'A town card on the map shows its coins a second.',
      'Opening the map clears the message about a lost wave, so it no longer covers the town names.',
    ],
  },
  {
    v: '2026.11.19-3',
    lines: [
      'On a phone turned sideways, cards and menus open below Pause, Hold waves and your coins.',
      'The Upgrade and Build buttons stay at the bottom of a card while you scroll it.',
      'In Iron Ridge, the goal at the top now sends you to win Pine Hollow, then back.',
      'Messages at the top move out of the way of open menus.',
      'On the map, a locked town says when it opens, like Opens at wave 20 in Copper Gulch.',
    ],
  },
  {
    v: '2026.11.19-2',
    lines: [
      'Tower cards show the coins you have next to the coins you need, red when you are short.',
      'Prices in Goods are rounded. A good kept for towers says so.',
      'In a boss wave, the goal at the top no longer sends you to another town.',
      'The Heavy Cannon and Siege Mortar cards say they fire slower.',
      'On the map, a won outpost says Sends goods. A town that needs another says Needs Iron Ridge.',
    ],
  },
  {
    v: '2026.11.19-1',
    lines: [
      'When the waves in a town are on hold, the goal at the top says to tap Resume waves.',
      'Starting a new town starts the waves again in the town that saved up for it.',
      'Keep trying the boss now also starts the waves again after a vault falls.',
      'In an outpost you won, Auto-towers raises a tower only when a raid gets through.',
    ],
  },
  {
    v: '2026.11.18-17',
    lines: [
      'Tap Damage on a tower. The numbers in the list now multiply to the total.',
      'When a tower card says you will have enough soon, that line is no longer red.',
      'Goals now say which thing to tap, like "Tap the Sawmill, then tap Build".',
      'The Capital\'s label on the map says how far your contract is.',
      'Messages at the top no longer cover a card when the phone is turned sideways.',
    ],
  },
  {
    v: '2026.11.18-16',
    lines: [
      'Town labels on the map no longer cover each other.',
      'The Silver Falls card on the map shows your deeds and how to earn them.',
      'What\'s new now scrolls when the phone is turned sideways.',
      'Tower cards show the damage of each hit.',
      'The Institutions tab shows how many upgrades you bought.',
      'One Capital building has a new name, the Department of Transportation.',
    ],
  },
  {
    v: '2026.11.18-15',
    lines: [
      'Cannon, Frost Lens and Mortar upgrades now add a bit less power. Crossbow upgrades stay the same.',
      'Silver Falls has 3 mortar pits now. A Mortar on the pit that is gone moved to the pit by the vault.',
      'If that pit already had a Mortar, the other one came down and you got back every coin spent on it.',
      'Silver Falls now needs wave 52 in Iron Ridge to open, not 57.',
      'The armored train in Iron Ridge is a little easier to stop.',
      'The first upgrade of each Capital building now costs 10 Influence, not 8.',
    ],
  },
  {
    v: '2026.11.18-14',
    lines: [
      'Silver Falls now needs wave 57 in Iron Ridge, 1M coins and 5 deeds.',
      'Sign the Iron Ridge charter to get the deeds for Silver Falls.',
      'In Silver Falls, the Goal box at the top tells you what to build next, up to the Telegraph Works.',
      'Waves in Silver Falls come a little slower. Tap Call now there and the wave brings more raiders.',
    ],
  },
  {
    v: '2026.11.18-13',
    lines: [
      'Silver Falls is on the map. Beat wave 25 in Iron Ridge and hold 5 deeds to start it.',
      'In Silver Falls, boats come down the river while raiders ride the road. Build towers by the water.',
      'The Water Wheel makes power for the workshops there. When it makes too little, they all slow down.',
      'Starting Silver Falls also opens Sandy Bend, a new outpost with sand and quartz.',
    ],
  },
  {
    v: '2026.11.18-12',
    lines: [
      'A foreman now waits when its building makes something that sells for very little. Tap the building to see the reason.',
      'A foreman still buys the next level when a workshop or your towers need more of what its building makes.',
      'At the Capital, each new institution costs a little more than before.',
    ],
  },
  {
    v: '2026.11.18-11',
    lines: [
      'A Frost Lens with Deep Freeze cannot keep a raider frozen forever now. After a freeze, a raider walks a few steps before it can freeze again.',
      'Big waves in Iron Ridge end sooner now.',
      'In Iron Ridge, if you tap Call now very early, that wave brings a few more raiders.',
    ],
  },
  {
    v: '2026.11.18-10',
    lines: [
      'New switch on the Auto sheet. Keep trying the boss.',
      'Turn it on and a town that loses its boss starts its waves again by itself once a tower goes up a level.',
      'With Auto-towers on too, a town can get past a boss while you are away. The map shows Retrying on it.',
    ],
  },
  {
    v: '2026.11.18-9',
    lines: [
      'The War Office at the Capital opens Auto-towers. The University opens Auto-research. Tap Auto in a town to turn them on.',
      'Auto-towers raises one tower a level every few minutes. Auto-research runs research you did before, one level higher.',
      'They never spend more than half your coins.',
    ],
  },
  {
    v: '2026.11.18-8',
    lines: [
      'The Capital on the map is now a small city with a big domed hall, a contract board and a plaza.',
      'Each institution you build gets its own building there. Watch it rise when you tap Build.',
    ],
  },
  {
    v: '2026.11.18-7',
    lines: [
      'Tap Map, then Capital, then Institutions. Tap Build to start the Market Board, the Bank, the War Office and more.',
      'They cost coins. Each one you build makes the next cost more.',
      'Spend Influence on their upgrades. They help every town, like better prices, stronger towers or faster research.',
    ],
  },
  {
    v: '2026.11.18-6',
    lines: [
      'Turning your phone sideways now fills the whole screen. Before, the right side stayed blank.',
      'Taps on towers and buildings work again after you turn the phone.',
      'On the map, the name of a town you have not opened yet is no longer cut off.',
    ],
  },
  {
    v: '2026.11.18-5',
    lines: [
      'You can build the Capital now. Beat wave 30 in Iron Ridge, then tap Map, then Capital.',
      'The Capital asks for goods from your towns. Take a contract and the town on it sends the goods by itself.',
      'A finished contract pays coins and Influence. Keep your Influence. Soon it will buy upgrades for every town.',
    ],
  },
  {
    v: '2026.11.18-4',
    lines: [
      'The game has music now. It is calm while you build and speeds up when raiders come. A boss brings its own tune.',
      'Towers, buildings, coins and bosses make sounds too.',
      'In your town, tap Menu to set the Music and Sound sliders.',
    ],
  },
  {
    v: '2026.11.18-3',
    lines: [
      'To beat a boss wave, you must stop the boss. If it reaches your vault, you drop back two waves and lose some coins.',
      'Then your waves go on hold. Build more towers, then tap Resume waves.',
      'The war wagon has less health now, so you can stop it on your first try.',
    ],
  },
  {
    v: '2026.11.18-2',
    lines: [
      'The top left now shows the town name, Map, and a button back to the last town you played.',
      'Tap Map to go to any other town or to start a new one. A red dot on Map means a town needs you.',
    ],
  },
  {
    v: '2026.11.18-1',
    lines: [
      'Your other towns keep fighting their waves while you play somewhere else, and while the game is closed.',
      'If raiders beat a town while you are away, its waves stop until you go back and tap Resume waves.',
      'When waves are held, the button says Resume waves.',
    ],
  },
  {
    v: '2026.11.17-25',
    lines: [
      'Tap a tower or building once to open its card. On a tall tower, the top works too.',
      'Pinch with two fingers to zoom the map. The buttons stay the same size.',
    ],
  },
  {
    v: '2026.11.17-24',
    lines: [
      'The goods bar holds still. Its boxes keep one size as the numbers grow.',
      'On a phone, the coins you make each second show under your coins.',
      'The goods bar lines up in neat columns.',
    ],
  },
  {
    v: '2026.11.17-23',
    lines: [
      'You can tap Call now as soon as a wave ends.',
      'Tap Call now right away and the next wave has more raiders.',
      'Plague Cloud poison is a little weaker.',
    ],
  },
  {
    v: '2026.11.17-22',
    lines: [
      'Iron Ridge now shows goals under Pause. Follow them to build the Locomotive Works.',
      'You can build the Rolling Mill and the Locomotive Works sooner now.',
    ],
  },
  {
    v: '2026.11.17-21',
    lines: [
      'The game is smoother on phones, even when you have lots of towns.',
      'When a workshop runs short of goods from another town, its card says what to build there.',
    ],
  },
  {
    v: '2026.11.17-20',
    lines: [
      'Tap Map to see all your towns at once. Zooming a town all the way out opens it too.',
      'Wagons roll between towns when goods move. Busy roads get more wagons.',
      'Tap a town on the map to see its wave and what it earns. Tap Play to fly down into it.',
    ],
  },
  {
    v: '2026.11.17-19',
    lines: [
      'All your towns and outposts now use the same coins.',
      'Tap your coins at the top to see what each town earns.',
      'Signing a charter keeps your coins.',
      'If a vault breaks, you lose at most the coins that town made in the last few minutes.',
    ],
  },
  {
    v: '2026.11.17-18',
    lines: [
      'Your towns keep earning when you switch to another app. Come back to see what they made.',
      'The game moves more smoothly on phones.',
    ],
  },
  {
    v: '2026.11.17-17',
    lines: [
      'A new row at the bottom shows your goods. Tap one to see its price.',
      'Tower costs show what you have and what you need, like Timber 3 / 8. Red means you need more.',
    ],
  },
  {
    v: '2026.11.17-16',
    lines: [
      'Iron Ridge now costs 15K coins, not 150K.',
      'After wave 20 in Copper Gulch, tap Hold waves and save coins for Iron Ridge.',
      'Raiders in Pine Hollow drop three times as many coins. Pine Hollow waves are a little easier.',
      'The Boiler Shop in Iron Ridge opens sooner, at Steel Mill level 3.',
    ],
  },
  {
    v: '2026.11.17-15',
    lines: [
      'Iron Ridge, the second town, is here. Beat wave 20 in Copper Gulch, then tap Iron Ridge at the top.',
      'Raiders come out of a railway tunnel, and wave 10 brings the armored train.',
      'Copper Gulch sends bricks and tools to Iron Ridge by wagon.',
      'Pine Hollow, a new outpost, opens with Iron Ridge and sends timber and clay to your towns.',
    ],
  },
  {
    v: '2026.11.17-14',
    lines: [
      'The town fits the screen better on wide screens, and stone pads are bigger.',
      'When you open a card, the map slides so you can still see what you tapped.',
      'The rock walls where raiders come in sink down when they would hide the road.',
      "If you can't pay for your first Crossbow yet, the goal says how much more you need.",
    ],
  },
  {
    v: '2026.11.17-13',
    lines: [
      'Each tower hits some raiders harder. Tap a tower to see what it is best against.',
      'The Snake Oil Still is weaker on Bandits and Riders and stronger on Brutes and wagons.',
      'The Mortar hits war wagons much harder.',
      'After you sign the charter, your towers hit 3 times harder until you pass your old best wave.',
      'New research at wave 26. Powder Kegs makes Cannon and Mortar blasts wider.',
    ],
  },
  {
    v: '2026.11.17-12',
    lines: [
      'Waves now wait longer before they come.',
      'Tap Call now when your towers win easily. The next wave comes right away and you get bonus coins.',
      'You can tap Call now once half the wait is over.',
    ],
  },
  {
    v: '2026.11.17-11',
    lines: [
      'When a goal says to tap a building, its tag shows the building name.',
      'The switch on a building card now says Sell timber On or Off.',
      'Short messages show under the buttons at the top, so they never cover Call now.',
      'The Perks sheet says how many deeds you get and how many you will have.',
    ],
  },
  {
    v: '2026.11.17-10',
    lines: [
      'The bandit wagon at wave 10 in Dry Creek now has a canvas top and a horse.',
      'A gold frame no longer hides the words of your goal.',
    ],
  },
  {
    v: '2026.11.17-9',
    lines: [
      'Tap your coins at the top to see what earns them each second.',
      'Tap the wave number or the green bar next to it to see how many hits your vault can take. Big raiders hit it harder.',
      'On a tower card, tap Damage, Shots or Range to see what adds to it. On a building card, tap the Makes line.',
      'In Goods, tap Timber or any other good to see what sets its price.',
    ],
  },
  {
    v: '2026.11.17-8',
    lines: [
      'A goal under the Pause button now tells you what to do next, from your first Crossbow to your first Mortar.',
      'A gold frame blinks on the pad, building or button the goal means. Tap the goal to make it flash again.',
      'If you already play in Copper Gulch, goals you are past are skipped.',
    ],
  },
  {
    v: '2026.11.17-7',
    lines: [
      'The Goods, Research and Perks buttons now appear as you unlock them.',
      'A red dot on a button means something new is waiting there.',
      'A town button gets a red dot when raiders hit that town while you were away.',
      'Messages at the top now show one at a time.',
    ],
  },
  {
    v: '2026.11.17-6',
    lines: [
      'Waves in Dry Creek now come about a minute apart. Beating all 10 takes about 11 minutes.',
      'Coins from Dry Creek still go to Copper Gulch. They no longer help you earn deeds.',
      'You get your first deed at wave 33, or when Copper Gulch earns 85K coins.',
    ],
  },
  {
    v: '2026.11.17-5',
    lines: [
      'A new game now starts in Dry Creek Outpost. Hold it for 10 waves and Copper Gulch opens.',
      'Dry Creek has its own Stone Camp, Mining Camp and stockpile, and raiders come down a dry wash.',
      'Tap Dry Creek or Copper Gulch at the top of the screen to switch towns.',
      'While you are in another town, the next wave in Copper Gulch waits for you.',
    ],
  },
  {
    v: '2026.11.17-4',
    lines: [
      'Dry Creek Outpost now keeps working while you play in Copper Gulch. It digs copper ore and cuts stone.',
      'Your Smelter gets its copper ore first. The rest is sold, and the coins go to Copper Gulch.',
      'Raiders attack the outpost about every two minutes. Its two Crossbows fight them on their own.',
    ],
  },
  {
    v: '2026.11.17-3',
    lines: [
      'The Cannon and the Snake Oil Still now cost copper ore, so you can build them in the first few minutes.',
      'The Frost Lens, the Smelter and the Kiln cost fewer coins.',
      'A new wave never comes sooner than 40 seconds after the last one started. Tap Call now to bring it sooner for bonus coins.',
      'The Perks button shows up once you have earned 60K coins.',
    ],
  },
  {
    v: '2026.11.17-2',
    lines: [
      'The Cannon, Frost Lens, Snake Oil Still and Mortar cost far fewer coins.',
      'The Frost Lens is now built with planks and clay, and the Snake Oil Still with copper and planks.',
      'The Kiln now costs 1000 coins. The war wagon rides faster but has less health.',
      'Waves come a little sooner. The Perks button shows up once you have earned 52K coins.',
    ],
  },
  {
    v: '2026.11.17-1',
    lines: [
      'When your town reaches wave 30 or earns 60K coins, a Perks button shows up.',
      'Tap Perks, then Sign the charter. Your town starts over at wave 1 and you get deeds.',
      'You keep deeds forever. Each one adds 25% to all the coins you earn.',
      'Deeds open perks. Pick one of each two, like more goods or stronger towers.',
    ],
  },
  {
    v: '2026.11.16-19',
    lines: [
      "Once a building reaches level 10, tap it and tap Hire foreman.",
      "A foreman buys the next level for you when it costs half your coins or less.",
      "To stop it, tap Foreman · On on the building's card.",
      "Research buttons say Busy while another item is working.",
    ],
  },
  {
    v: '2026.11.16-18',
    lines: [
      'Research is here. Build the Sawmill, then tap Research to make your saws, mines and towers better.',
      'Each item costs coins and takes some time. Only one can work at a time.',
      'Hot Furnaces makes the Smelter and the Kiln faster, but they burn more timber.',
    ],
  },
  {
    v: '2026.11.16-17',
    lines: [
      'Your town saves the timber, copper and bricks your towers need next, instead of selling them. Building cards show how much.',
      'To sell it all anyway, tap the building and switch Keep for towers off.',
      'When a tower is short of goods, its card says how much you have, how long until it is ready, and which building to upgrade.',
    ],
  },
  {
    v: '2026.11.16-16',
    lines: [
      'The map follows your fingers. Drag it, pinch to zoom where your fingers are, and twist two fingers to turn it.',
      'Tower cards are shorter. Range now says Short, Medium or Long.',
      'The building card switch now just says Selling or Holding, like the Goods list.',
      'Picking a tower path takes a second tap, so you never pick by accident.',
      'This card lists what changed after each update.',
    ],
  },
  {
    v: '2026.11.16-15',
    lines: [
      'Raiders ride out of an old mine at the end of a canyon. Dust rises there just before each wave.',
      'The Frost Lens and the Snake Oil Still cost much less and hit harder.',
    ],
  },
  {
    v: '2026.11.16-14',
    lines: ['New tower, the Mortar. It opens at wave 12 and goes in the mortar pits far from the road.'],
  },
  {
    v: '2026.11.16-13',
    lines: ['Tap Menu to change graphics, switch save slots, or copy your save.', 'Tap Goods to see your stock and sell prices.'],
  },
];
