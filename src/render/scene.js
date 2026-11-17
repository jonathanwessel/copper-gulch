/* The renderer shared by every view: one WebGL canvas, warm desert light with shadows, and on the high tier lamps
   that bloom and a color grade after tone mapping (see src/render/quality.js for the tiers). createScene() returns
   null when WebGL 2 is not available, and the interface then runs without the 3D view. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { TIERS } from './quality.js';

const NLAMPS = 8;

/* Cheaper shadow edges for the med tier (PCFShadowMap). three's PCF filter reads the shadow map 17 times for every
   pixel that takes shadows, which was a third of a phone frame in tools/perf.js (2026-11-17: 32 ms with it, 21 ms with
   no shadows). Four reads in a square round the point keep a soft edge for a quarter of the cost. The high tier's
   PCFSoftShadowMap is a separate branch and stays as it is. */
(function cheapPcf() {
  const c = THREE.ShaderChunk.shadowmap_pars_fragment;
  const a = c.indexOf('#if defined( SHADOWMAP_TYPE_PCF )'), b = c.indexOf('#elif defined( SHADOWMAP_TYPE_PCF_SOFT )', a);
  if (a < 0 || b < 0) return; // a different three.js: keep its filter
  const four = `#if defined( SHADOWMAP_TYPE_PCF )
			vec2 d = shadowRadius * .5 / shadowMapSize;
			shadow = (
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( -d.x, -d.y ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( d.x, -d.y ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( -d.x, d.y ), shadowCoord.z ) +
				texture2DCompare( shadowMap, shadowCoord.xy + vec2( d.x, d.y ), shadowCoord.z )
			) * .25;
		`;
  THREE.ShaderChunk.shadowmap_pars_fragment = c.slice(0, a) + four + c.slice(b);
})();

/* Grading: saturation, contrast, tint, lift and a vignette, after tone mapping. */
const GradeShader = {
  uniforms: {
    tDiffuse: { value: null }, uSat: { value: 1.0 }, uCon: { value: .12 }, uTint: { value: new THREE.Vector3(1, 1, .98) },
    uLift: { value: new THREE.Vector3(.012, .006, .02) }, uVig: { value: .32 },
  },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform float uSat, uCon, uVig; uniform vec3 uTint, uLift; varying vec2 vUv;
    void main(){ vec3 c = texture2D(tDiffuse, vUv).rgb; float l = dot(c, vec3(.299, .587, .114));
      c = mix(vec3(l), c, uSat); c = (c - .5) * (1. + uCon * .6) + .5; c = c * uTint + uLift;
      vec2 d = vUv - .5; c *= 1. - uVig * smoothstep(.3, .9, length(d * vec2(1., 1.15)));
      gl_FragColor = vec4(clamp(c, 0., 1.), 1.); }`,
};

/* A sky dome: a gradient from the ground haze to the zenith. */
export function makeSky(top = '#5f93c8', mid = '#f0c99a', bot = '#c9905e') {
  const mat = new THREE.ShaderMaterial({
    side: THREE.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: new THREE.Color(top) }, mid: { value: new THREE.Color(mid) }, bot: { value: new THREE.Color(bot) } },
    vertexShader: 'varying vec3 vP; void main(){ vP = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
    fragmentShader: 'uniform vec3 top, mid, bot; varying vec3 vP; void main(){ float h = vP.y; vec3 c = h > 0. ? mix(mid, top, smoothstep(0., .5, h)) : mix(mid, bot, smoothstep(0., .2, -h)); gl_FragColor = vec4(c, 1.); }',
  });
  const m = new THREE.Mesh(new THREE.SphereGeometry(90, 24, 12), mat);
  m.frustumCulled = false; m.renderOrder = -1;
  return m;
}

/* createScene(canvas, { tier, lamps }): tier is a key of TIERS (src/render/quality.js); lamps: this view uses point
   lights (only drawn on tiers that allow them; an idle light still costs every pixel). */
export function createScene(canvas, opt = {}) {
  let tier = TIERS[opt.tier] ? opt.tier : 'med', T = TIERS[tier];
  let r;
  try { r = new THREE.WebGLRenderer({ canvas, antialias: T.aa, powerPreference: 'high-performance', stencil: false }); }
  catch (e) { console.warn('3D view unavailable:', e.message); return null; }
  if (!r.capabilities.isWebGL2) { r.dispose(); return null; }
  r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;
  r.info.autoReset = false; // count a whole frame, every pass, in view.stats

  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(opt.fov || 35, 1, .3, 200);
  scene.fog = new THREE.Fog(opt.fog || '#e6cba6', 24, 85);
  const sky = makeSky(); scene.add(sky);
  const hemi = new THREE.HemisphereLight('#d9e6f2', '#8a6244', 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe0b5', 2.5); scene.add(sun, sun.target);
  const sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 60;
  sun.shadow.bias = -.0006; sun.shadow.normalBias = .02; sun.shadow.radius = 3;
  let lamps = [];

  let composer = null, W = 0, H = 0, CW = 0, CH = 0;
  const view = {
    renderer: r, scene, cam, sky, hemi, sun, canvas,
    get tier() { return tier; }, get lamps() { return lamps; },
    /* Change the quality tier (shadows, lamps, post-processing, pixel ratio). Antialiasing stays as created. */
    setQuality(next) {
      if (!TIERS[next]) return;
      const shadowWas = r.shadowMap.enabled, lampsWas = lamps.length;
      tier = next; T = TIERS[next];
      r.shadowMap.enabled = T.shadow > 0; sun.castShadow = T.shadow > 0;
      r.shadowMap.type = T.shadow >= 2048 ? THREE.PCFSoftShadowMap : THREE.PCFShadowMap;
      if (T.shadow && sun.shadow.mapSize.x !== T.shadow) { sun.shadow.mapSize.set(T.shadow, T.shadow); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } }
      const wantLamps = opt.lamps && T.lamps ? NLAMPS : 0;
      if (wantLamps !== lamps.length) {
        for (const l of lamps) scene.remove(l);
        lamps = []; for (let k = 0; k < wantLamps; k++) { const l = new THREE.PointLight('#ffb070', 0, 3.2, 1.6); scene.add(l); lamps.push(l); }
        if (view.lampList) view.setLamps(view.lampList, view.lampPower);
      }
      if (shadowWas !== r.shadowMap.enabled || lampsWas !== lamps.length) scene.traverse(o => { if (o.material) [].concat(o.material).forEach(m => { m.needsUpdate = true; }); });
      W = H = 0; if (CW) view.resize(CW, CH);
    },
    /* Point the lamps at up to NLAMPS positions (world Vector3s), brightest first. */
    setLamps(list, power = 1) {
      view.lampList = list; view.lampPower = power;
      lamps.forEach((l, k) => { const p = list[k]; l.intensity = p ? 2.2 * power : 0; if (p) l.position.copy(p); });
    },
    resize(w, h) {
      CW = w; CH = h;
      const dpr = Math.min(T.ratio, window.devicePixelRatio || 1) * T.scale;
      const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
      if (pw === W && ph === H) return; W = pw; H = ph;
      r.setPixelRatio(1); r.setSize(pw, ph, false); canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      cam.aspect = w / h; cam.updateProjectionMatrix();
      if (composer) { composer.dispose(); composer = null; }
      if (!T.post) return;
      composer = new EffectComposer(r, new THREE.WebGLRenderTarget(pw, ph, { type: THREE.HalfFloatType, samples: 4 }));
      composer.setPixelRatio(1); composer.setSize(pw, ph);
      composer.addPass(new RenderPass(scene, cam));
      composer.addPass(new UnrealBloomPass(new THREE.Vector2(Math.max(1, pw / 2), Math.max(1, ph / 2)), .45, .5, .85));
      composer.addPass(new OutputPass());
      composer.addPass(new ShaderPass(GradeShader));
    },
    render() {
      r.info.reset();
      if (composer) composer.render(); else r.render(scene, cam);
      view.stats = { calls: r.info.render.calls, triangles: r.info.render.triangles, w: W, h: H, tier };
    },
    dispose() { if (composer) composer.dispose(); r.dispose(); },
  };
  view.setQuality(tier);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); view.lost = true; });
  return view;
}
