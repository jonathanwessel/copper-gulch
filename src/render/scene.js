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

/* Edge smoothing for the med tier (FXAA, after Timothy Lottes' fast approximate antialiasing): the scene is drawn into
   an 8-bit target already tone mapped and in screen colors (the target says it is an XR target, which is the one case
   where three.js does that), then one full-screen triangle blurs only across edges: four corner reads find the edge's
   direction, flat areas stop there, and edges take two or four reads along it. On the software GPU in tools/perf.js
   multisampling ran the fragment shader for every sample and cost a third of the frame; this is one cheap pass.
   The five reads that find an edge land on whole pixels, so they are texelFetch reads: a filtered read costs four
   fetches on a software GPU even at a pixel's middle (perf headroom box, 2026.11.27-5). Only the reads along an
   edge, which fall between pixels, blend. */
const FxaaShader = {
  uniforms: { tDiffuse: { value: null }, uPx: { value: new THREE.Vector2(1, 1) } },
  vertexShader: 'varying vec2 vUv; void main(){ vUv = position.xy * .5 + .5; gl_Position = vec4(position.xy, 0., 1.); }',
  fragmentShader: `uniform sampler2D tDiffuse; uniform vec2 uPx; varying vec2 vUv;
    const vec3 L = vec3(.299, .587, .114);
    vec3 at(ivec2 p, ivec2 e) { return texelFetch(tDiffuse, clamp(p, ivec2(0), e), 0).rgb; }
    void main(){
      ivec2 p = ivec2(gl_FragCoord.xy), edge = textureSize(tDiffuse, 0) - 1;
      vec3 nw = at(p + ivec2(-1, -1), edge), ne = at(p + ivec2(1, -1), edge);
      vec3 sw = at(p + ivec2(-1, 1), edge), se = at(p + ivec2(1, 1), edge);
      vec3 m = at(p, edge);
      float lnw = dot(nw, L), lne = dot(ne, L), lsw = dot(sw, L), lse = dot(se, L), lm = dot(m, L);
      float lo = min(lm, min(min(lnw, lne), min(lsw, lse))), hi = max(lm, max(max(lnw, lne), max(lsw, lse)));
      if (hi - lo < max(.0833, hi * .166)) { gl_FragColor = vec4(m, 1.); return; }
      vec2 dir = vec2(-((lnw + lne) - (lsw + lse)), (lnw + lsw) - (lne + lse));
      float red = max((lnw + lne + lsw + lse) * .03125, 1. / 128.), rcp = 1. / (min(abs(dir.x), abs(dir.y)) + red);
      dir = clamp(dir * rcp, -8., 8.) * uPx;
      vec3 a = .5 * (texture2D(tDiffuse, vUv - dir / 6.).rgb + texture2D(tDiffuse, vUv + dir / 6.).rgb);
      vec3 b = a * .5 + .25 * (texture2D(tDiffuse, vUv - dir * .5).rgb + texture2D(tDiffuse, vUv + dir * .5).rgb);
      float lb = dot(b, L);
      gl_FragColor = vec4(lb < lo || lb > hi ? a : b, 1.);
    }`,
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
  // drawn after the rest of the solid world, so the ground in front of it hides most of the dome before it is shaded
  // (it was drawn first, under everything: a whole screen of sky shaded and then covered; perf headroom box, 2026.11.27-5)
  m.frustumCulled = false; m.renderOrder = 1e6;
  return m;
}

/* createScene(canvas, { tier, ratio, lamps }): tier is a key of TIERS (src/render/quality.js), ratio its pixel ratio (the
   tier's own when left out; Auto raises it on a fast device); lamps: this view uses point lights (only drawn on tiers
   that allow them; an idle light still costs every pixel). */
export function createScene(canvas, opt = {}) {
  let tier = TIERS[opt.tier] ? opt.tier : 'med', T = TIERS[tier], ratio = opt.ratio || T.ratio;
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

  let composer = null, W = 0, H = 0, CW = 0, CH = 0, aa = null;
  /* The FXAA pass: a target the size of the drawing buffer and one triangle that covers the screen. */
  const fxaaMat = new THREE.ShaderMaterial({ ...FxaaShader, uniforms: THREE.UniformsUtils.clone(FxaaShader.uniforms), depthTest: false, depthWrite: false });
  const tri = new THREE.BufferGeometry(); tri.setAttribute('position', new THREE.Float32BufferAttribute([-1, -1, 0, 3, -1, 0, -1, 3, 0], 3));
  const fxaaQuad = new THREE.Mesh(tri, fxaaMat); fxaaQuad.frustumCulled = false;
  const fxaaScene = new THREE.Scene(); fxaaScene.add(fxaaQuad);
  const fxaaCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const view = {
    renderer: r, scene, cam, sky, hemi, sun, canvas,
    get tier() { return tier; }, get target() { return aa; }, get ratio() { return ratio; }, get lamps() { return lamps; },
    /* Change the quality tier (shadows, lamps, post-processing) and the pixel ratio (the tier's own when left out).
       Multisampling stays as created. */
    setQuality(next, nextRatio) {
      if (!TIERS[next]) return;
      const shadowWas = r.shadowMap.enabled, lampsWas = lamps.length;
      tier = next; T = TIERS[next]; ratio = nextRatio || T.ratio;
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
      const dpr = Math.min(ratio, window.devicePixelRatio || 1) * T.scale;
      const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
      if (pw === W && ph === H) return; W = pw; H = ph;
      // the CSS keeps the canvas at 100% of the screen; pinning a pixel size here froze it at the first size, so turning the phone left half the screen blank
      r.setPixelRatio(1); r.setSize(pw, ph, false); canvas.style.width = '100%'; canvas.style.height = '100%';
      cam.aspect = w / h; cam.updateProjectionMatrix();
      if (composer) { composer.dispose(); composer = null; }
      if (aa) { aa.dispose(); aa = null; }
      if (T.fxaa && !T.post) {
        aa = new THREE.WebGLRenderTarget(pw, ph, { depthBuffer: true, stencilBuffer: false });
        aa.isXRRenderTarget = true; // three.js tone maps and converts to screen colors only for the screen or an XR target
        aa.texture.colorSpace = THREE.SRGBColorSpace; aa.texture.internalFormat = 'RGBA8'; // the shader writes screen colors; RGBA8 so the GPU does not convert them again
        aa.texture.generateMipmaps = false;
        fxaaMat.uniforms.tDiffuse.value = aa.texture; fxaaMat.uniforms.uPx.value.set(1 / pw, 1 / ph);
      }
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
      // the sky dome rides with the camera, so its far side is never past the far plane (review of 2026.11.19-13: with a
      // card open the map's camera pulled back and a black wedge showed at the top of the screen)
      sky.position.set(cam.position.x, 0, cam.position.z);
      if (composer) composer.render();
      else if (aa) { r.setRenderTarget(aa); r.render(scene, cam); r.setRenderTarget(null); r.render(fxaaScene, fxaaCam); }
      else r.render(scene, cam);
      view.stats = { calls: r.info.render.calls, triangles: r.info.render.triangles, w: W, h: H, tier, ratio };
    },
    dispose() { if (composer) composer.dispose(); if (aa) aa.dispose(); fxaaMat.dispose(); tri.dispose(); r.dispose(); },
  };
  view.setQuality(tier, ratio);
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); view.lost = true; });
  return view;
}
