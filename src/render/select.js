/* What is selected on the board, made unmistakable while its card is open: a bright pulsing gold frame on the ground
   (a square around a building's plot, a ring around a pad or tower), the tower's range drawn as a circle on the ground
   (an empty pad shows the Crossbow's range), a soft column of light rising around the object that pulses with the frame,
   and the selected tower lifts a little. Cleared when the card closes. */
import * as THREE from 'three';
import { towerAt, towerStats, isPit } from '../core/defense.js';
import { TOWERS } from '../data/towers.js';

const mat = (color, opacity) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4, fog: false });

export class Selection {
  constructor(board, battle) {
    this.board = board; this.battle = battle; this.town = board.town; this.target = null;
    this.group = new THREE.Group(); this.group.name = 'selection'; this.group.visible = false; this.group.renderOrder = 3;
    const R2 = Math.SQRT2;
    this.square = new THREE.Mesh(new THREE.RingGeometry(1.08 * R2, 1.2 * R2, 4, 1, Math.PI / 4).rotateX(-Math.PI / 2), mat('#ffd36a', .95));
    this.ring = new THREE.Mesh(new THREE.RingGeometry(.5, .64, 40).rotateX(-Math.PI / 2), mat('#ffd36a', .95));
    this.range = new THREE.Mesh(new THREE.RingGeometry(.965, 1, 96).rotateX(-Math.PI / 2), mat('#ffc58f', .7));
    this.fill = new THREE.Mesh(new THREE.CircleGeometry(1, 96).rotateX(-Math.PI / 2), mat('#ffd36a', .08));
    // a Mortar's dead zone: a darker red disc inside a second ring, so the gap it cannot fire into is plain to see
    this.dead = new THREE.Mesh(new THREE.CircleGeometry(1, 64).rotateX(-Math.PI / 2), mat('#7a1e12', .32));
    this.inner = new THREE.Mesh(new THREE.RingGeometry(.94, 1, 64).rotateX(-Math.PI / 2), mat('#ff7a5a', .85));
    this.dead.position.y = this.inner.position.y = .004;
    // the reach circles stay visible where the ground beyond the yard rises over them
    for (const m of [this.range, this.fill, this.dead, this.inner]) m.material.depthTest = false;
    // the glow: an open cylinder, bright at the ground and fading upward, drawn additively (one mesh, one material)
    this.glowMat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false,
      uniforms: { uColor: { value: new THREE.Color('#ffc24a') }, uOp: { value: .5 } },
      vertexShader: 'varying float vY; void main(){ vY = uv.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.); }',
      fragmentShader: 'uniform vec3 uColor; uniform float uOp; varying float vY; void main(){ float a = (1. - vY); gl_FragColor = vec4(uColor, a * a * uOp); }',
    });
    this.glow = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 32, 1, true).translate(0, .5, 0), this.glowMat);
    for (const m of [this.square, this.ring, this.range, this.fill, this.dead, this.inner, this.glow]) { m.renderOrder = 3; this.group.add(m); }
    board.group.add(this.group);
  }
  /* { plot: id } or { spot: index } or null. */
  set(target) { this.target = target || null; this.group.visible = !!this.target; this.battle.lift = this.target && this.target.spot !== undefined ? this.target.spot : null; }
  update(t) {
    const tg = this.target;
    if (!tg) return;
    const pulse = .5 + .5 * Math.sin(t * 6), B = this.town.def.board;
    const [x, z] = tg.plot ? B.plots[tg.plot] : B.spots[tg.spot];
    this.group.position.set(x, .035, z);
    this.square.visible = !!tg.plot; this.ring.visible = !tg.plot;
    const s = 1 + pulse * .08;
    this.square.scale.set(s, 1, s); this.ring.scale.set(s, 1, s);
    this.square.material.opacity = this.ring.material.opacity = .65 + .35 * pulse;
    const b = tg.plot ? this.board.bld && this.board.bld[tg.plot] : null, gr = tg.plot ? 1.25 : .58, gh = tg.plot ? Math.max(1.2, (b ? b.top : 1) + .6) : 1.7;
    this.glow.scale.set(gr, gh, gr); this.glowMat.uniforms.uOp.value = .32 + .28 * pulse;
    // a tower's reach, or what a Crossbow here would reach
    const tw = tg.spot !== undefined ? towerAt(this.town, tg.spot) : null;
    // (an empty mortar pit shows the Mortar's reach)
    const pit = !tg.plot && isPit(this.town, tg.spot);
    const r = tg.plot ? 0 : tw ? towerStats(this.town, tw).range : pit ? TOWERS.mortar.range : TOWERS.crossbow.range;
    const r0 = tg.plot ? 0 : tw ? towerStats(this.town, tw).minRange : pit ? TOWERS.mortar.minRange : 0;
    this.range.visible = this.fill.visible = r > 0;
    if (r > 0) { this.range.scale.set(r, 1, r); this.fill.scale.set(r, 1, r); }
    this.dead.visible = this.inner.visible = r0 > 0;
    if (r0 > 0) { this.dead.scale.set(r0, 1, r0); this.inner.scale.set(r0, 1, r0); }
  }
  dispose() { this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); }); }
}
