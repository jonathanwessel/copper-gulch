/* The renderer shared by every view: one WebGL canvas, warm desert light with soft shadows, lamps that bloom at night,
   and a color grade after tone mapping. createScene() returns null when WebGL 2 is not available, and the interface
   then runs without the 3D view. */
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';

const NLAMPS = 8;

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

export function createScene(canvas, opt = {}) {
  let r;
  try { r = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }); }
  catch (e) { console.warn('3D view unavailable:', e.message); return null; }
  if (!r.capabilities.isWebGL2) { r.dispose(); return null; }
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFSoftShadowMap;
  r.toneMapping = THREE.NeutralToneMapping; r.toneMappingExposure = 1.05; r.outputColorSpace = THREE.SRGBColorSpace;

  const scene = new THREE.Scene(), cam = new THREE.PerspectiveCamera(opt.fov || 35, 1, .3, 200);
  scene.fog = new THREE.Fog(opt.fog || '#e6cba6', 24, 85);
  const sky = makeSky(); scene.add(sky);
  const hemi = new THREE.HemisphereLight('#d9e6f2', '#8a6244', 1.15); scene.add(hemi);
  const sun = new THREE.DirectionalLight('#ffe0b5', 2.5); sun.castShadow = true; scene.add(sun, sun.target);
  const sc = sun.shadow.camera; sc.left = -9; sc.right = 9; sc.top = 9; sc.bottom = -9; sc.near = 1; sc.far = 60;
  sun.shadow.mapSize.set(2048, 2048); sun.shadow.bias = -.0006; sun.shadow.normalBias = .02; sun.shadow.radius = 3;
  const lamps = [];
  for (let i = 0; i < NLAMPS; i++) { const l = new THREE.PointLight('#ffb070', 0, 3.2, 1.6); scene.add(l); lamps.push(l); }

  let composer = null, W = 0, H = 0, bloom = null;
  const view = {
    renderer: r, scene, cam, sky, hemi, sun, lamps, canvas,
    /* Point the lamps at up to NLAMPS positions (world Vector3s), brightest first. */
    setLamps(list, power = 1) { lamps.forEach((l, i) => { const p = list[i]; l.intensity = p ? 2.2 * power : 0; if (p) l.position.copy(p); }); },
    resize(w, h, dpr = Math.min(2, window.devicePixelRatio || 1)) {
      const pw = Math.max(1, Math.round(w * dpr)), ph = Math.max(1, Math.round(h * dpr));
      if (pw === W && ph === H) return; W = pw; H = ph;
      r.setPixelRatio(1); r.setSize(pw, ph, false); canvas.style.width = w + 'px'; canvas.style.height = h + 'px';
      cam.aspect = w / h; cam.updateProjectionMatrix();
      if (composer) composer.dispose();
      composer = new EffectComposer(r, new THREE.WebGLRenderTarget(pw, ph, { type: THREE.HalfFloatType, samples: 4 }));
      composer.setPixelRatio(1); composer.setSize(pw, ph);
      composer.addPass(new RenderPass(scene, cam));
      bloom = new UnrealBloomPass(new THREE.Vector2(Math.max(1, pw / 2), Math.max(1, ph / 2)), .45, .5, .85); composer.addPass(bloom);
      composer.addPass(new OutputPass());
      composer.addPass(new ShaderPass(GradeShader));
    },
    render() { if (composer) composer.render(); },
    dispose() { if (composer) composer.dispose(); r.dispose(); },
  };
  canvas.addEventListener('webglcontextlost', e => { e.preventDefault(); view.lost = true; });
  return view;
}
