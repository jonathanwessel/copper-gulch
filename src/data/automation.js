/* Automation (GDD.md, Automation): what each town's Automation sheet can take over. It only takes over choices the
   player has made by hand (owner rule): Auto-towers raises towers that stand, never builds one and never picks a path;
   Auto-research only runs again items the player has researched before. Every switch starts Off.
   share:      it buys only when the price is at most this share of the coins on hand, like a foreman
   towerEvery: seconds between two Auto-towers upgrades in one town
   faster:     each War Office upgrade bought makes that wait this many times as long
   opens:      the institution that opens each one at the Capital (Keep trying the boss comes with Auto-towers) */
export const AUTO = {
  share: .5,
  towerEvery: 180,
  faster: .85,
  opens: { towers: 'war', research: 'university', retry: 'war', arms: 'war' }, // arms needs the War Office's Armory too (src/data/arms.js)
  armsVault: .5, // Call to arms by Auto comes out when the vault is below this share of its strength,
  armsBoss: { along: .4, hp: .3 }, // or when the boss is past this share of its road with more than this share of its health
};
