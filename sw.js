// Service worker: lets Copper Gulch install as an app and run offline.
// The page and the game's code come from the network first (revalidated, never from a stale browser cache), so a new
// version runs as soon as it is published; the cached copies are used only when offline. Icons come from the cache.
// tools/bump-version.js sets VERSION and SHELL with every release, so old caches are cleared.
// Cache names start with 'cg-shell-': the old game shares this origin and clears its own 'copper-gulch-' caches.
const VERSION = '2026.11.24-2';
const CACHE = 'cg-shell-' + VERSION;
const SHELL = ["./","./index.html","./manifest.webmanifest","./icons/apple-touch-icon.png","./icons/icon-192.png","./icons/icon-512.png","./icons/icon-maskable-192.png","./icons/icon-maskable-512.png","./src/art/foes.js","./src/art/pixfont.js","./src/assets/models/capital.js","./src/assets/models/entrances.js","./src/assets/models/falls.js","./src/assets/models/gulch.js","./src/assets/models/ridge.js","./src/assets/models/units.js","./src/audio/audio.js","./src/audio/speech.js","./src/audio/tunes.js","./src/core/arms.js","./src/core/automation.js","./src/core/capital.js","./src/core/charter.js","./src/core/clock.js","./src/core/defense.js","./src/core/economy.js","./src/core/empire.js","./src/core/events.js","./src/core/explain.js","./src/core/foremen.js","./src/core/game.js","./src/core/goals.js","./src/core/map.js","./src/core/market.js","./src/core/mods.js","./src/core/orders.js","./src/core/outpost.js","./src/core/path.js","./src/core/research.js","./src/core/reveal.js","./src/core/rng.js","./src/core/save.js","./src/core/setup.js","./src/core/town.js","./src/core/tree.js","./src/data/arms.js","./src/data/automation.js","./src/data/buildings.js","./src/data/capital.js","./src/data/empire.js","./src/data/explainers.js","./src/data/foes.js","./src/data/goals.js","./src/data/goods.js","./src/data/institutions.js","./src/data/news.js","./src/data/orders.js","./src/data/perks.js","./src/data/research.js","./src/data/towers.js","./src/data/towns/drycreek.js","./src/data/towns/falls.js","./src/data/towns/gulch.js","./src/data/towns/index.js","./src/data/towns/pinehollow.js","./src/data/towns/ridge.js","./src/data/towns/sandybend.js","./src/main.js","./src/render/autoquality.js","./src/render/battle.js","./src/render/board.js","./src/render/bridge-plan.js","./src/render/camera.js","./src/render/dress.js","./src/render/empire-land.js","./src/render/empire-plan.js","./src/render/empire-view.js","./src/render/entrance.js","./src/render/kit.js","./src/render/life-plan.js","./src/render/life.js","./src/render/militia.js","./src/render/pick.js","./src/render/quality.js","./src/render/scene.js","./src/render/select.js","./src/render/terrain.js","./src/render/title-scene.js","./src/render/town-view.js","./src/ui/boss.js","./src/ui/capital.js","./src/ui/coach.js","./src/ui/explain.js","./src/ui/foe.js","./src/ui/format.js","./src/ui/heart.js","./src/ui/install.js","./src/ui/lost.js","./src/ui/map.js","./src/ui/news.js","./src/ui/play.js","./src/ui/sheets.js","./src/ui/state.js","./src/ui/storage.js","./src/ui/switch.js","./src/ui/title.js","./src/ui/update.js","./src/ui/wave.js","./src/ui/worker.js","./src/version.js","./vendor/three/addons/postprocessing/EffectComposer.js","./vendor/three/addons/postprocessing/MaskPass.js","./vendor/three/addons/postprocessing/OutputPass.js","./vendor/three/addons/postprocessing/Pass.js","./vendor/three/addons/postprocessing/RenderPass.js","./vendor/three/addons/postprocessing/ShaderPass.js","./vendor/three/addons/postprocessing/UnrealBloomPass.js","./vendor/three/addons/shaders/CopyShader.js","./vendor/three/addons/shaders/LuminosityHighPassShader.js","./vendor/three/addons/shaders/OutputShader.js","./vendor/three/addons/utils/BufferGeometryUtils.js","./vendor/three/three.module.min.js"];

// Install: fetch every file fresh. A plain addAll can be answered from the HTTP cache with the previous version's code.
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL.map(u => new Request(u, { cache: 'reload' })))));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys()
    .then(keys => Promise.all(keys.filter(k => k.startsWith('cg-shell-') && k !== CACHE).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('message', e => { if (e.data === 'skip') self.skipWaiting(); });
self.addEventListener('fetch', e => {
  const req = e.request, url = new URL(req.url);
  if (req.method !== 'GET' || url.origin !== location.origin) return;
  if (url.pathname.endsWith('/version.json')) return; // always from the network: it is how the page spots new releases
  const page = req.mode === 'navigate' || url.pathname.endsWith('/index.html');
  const code = page || /\.(js|webmanifest|json)$/.test(url.pathname);
  if (code) { // network first, revalidated; keep a copy for offline play
    const key = page ? './index.html' : req;
    e.respondWith(fetch(req, { cache: 'no-cache' })
      .then(res => { if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(key, copy)); } return res; })
      .catch(() => caches.match(key, { ignoreSearch: true })));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
