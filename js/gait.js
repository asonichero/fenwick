// Fenwick Hall — walking: each figure's own walk, blended from Mixamo's walking loops (models/*.fbx, made into models/walk.json by
// tools/blender/export_anims.py) as bases, and shaped.
//
// Each loop gives, frame by frame, how far each bone has turned in the world from its rest (a T-pose), and where the hips are; and its rest
// (each bone's place and the way it points), its characters being of different sizes. Ours rest with the arms hanging, so each of our bones is
// first turned to point as theirs does at rest, then as theirs has. The loops are lined up step for step (each from its left heel's strike),
// so a walk is a blend of them at the same point in the stride: each bone's turn a weighted mean of theirs, the hips' rise, fall and sway and
// the going forward in proportion to each one's legs against ours. Then shaped: the arms swung more or less (toward the loop's own still
// average), the hips' sway likewise, the head carried lower, the chest a little forward, the pace. A figure's going forward is the blend's: it
// carries the figure along its way, so the feet stay where they're put.
//   A walk of a given length is planned before it's begun: begun at the point of the stride that brings it, at that length, to a heel strike,
// eased in from standing (the pace building over the first steps) and out at its end (the pace slackening into the last), then the pose that
// follows. Its steps lengthened by a hair, if at all, to come out exactly.
//
//   await Gait.load()  ·  const w = Gait.walker(F, length, { style })  ·  each frame: const { d, done } = w.step(dt)  (then place the figure at d
//   along its way; its bones are set)  ·  Gait.STYLES (silas, adela, plain) · Gait.plan / planned (for checking) · Gait.ready
(function (root) {
'use strict';
const THREE = root.THREE, V3 = THREE.Vector3, Q = THREE.Quaternion;
let D = null;
const ORDER = ['hips', 'spine', 'chest', 'neck', 'head', 'clavL', 'upperArmL', 'foreArmL', 'handL', 'clavR', 'upperArmR', 'foreArmR', 'handR', 'thighL', 'shinL', 'footL', 'toeL', 'thighR', 'shinR', 'footR', 'toeR'];
const ARMS = /^(clav|upperArm|foreArm|hand)/;
// (where each of our bones points: to the next joint, as theirs is measured)
const TO = { hips: 'spine', spine: 'chest', chest: 'neck', neck: 'head', clavL: 'upperArmL', upperArmL: 'foreArmL', foreArmL: 'handL', handL: 'middle1L',
  clavR: 'upperArmR', upperArmR: 'foreArmR', foreArmR: 'handR', handR: 'middle1R', thighL: 'shinL', shinL: 'footL', footL: 'toeL', thighR: 'shinR', shinR: 'footR', footR: 'toeR' };

// ── Each figure's walk: the bases blended (their weights), then shaped (arms 0–1: their swing, kept that much; sway 0–1: the hips' likewise;
// head: carried that much lower (radians); slump: the chest that much forward; pace: the stride's speed against the blend's own) ──
const STYLES = {
  // (Silas: plain and purposeful, a man about his work: the standard walk sobered by the sad one, the arms easier, no swagger)
  silas: { mix: { walk: 0.72, sad: 0.28 }, arms: 0.6, sway: 0.45, head: 0.02, slump: 0, pace: 0.95 },
  // (Adela: a goose girl called in to wait at table, who's lost everything and tells no one: small, quiet steps, the head bowed, the hands still)
  adela: { mix: { female: 0.72, sad: 0.28 }, arms: 0.32, sway: 0.5, head: 0.16, slump: 0, pace: 0.9 },
  plain: { mix: { walk: 0.4, female: 0.2, sad: 0.4 }, arms: 0.75, sway: 0.8, head: 0.03, slump: 0.0, pace: 1.0 },
};

async function load(url) {
  if (D) return D;
  const r = await fetch(url || 'models/walk.json'); D = await r.json();
  for (const k in D.clips) {
    const c = D.clips[k]; c.key = k; c.rest = (D.rests && D.rests[k]) || D.rest; c.Q = {};
    for (const b in c.q) { const a = c.q[b], out = []; for (let i = 0; i < a.length; i += 4) out.push(new Q(a[i], a[i + 1], a[i + 2], a[i + 3])); c.Q[b] = out; }
    c.x = []; c.y = []; c.z = []; for (let f = 0; f < c.n; f++) { c.x.push(c.hips[f * 3]); c.y.push(c.hips[f * 3 + 1]); c.z.push(c.hips[f * 3 + 2]); }
    if (!c.loop) continue;
    // (a loop: its stride (its last frame is its first again); how far one stride goes; where its left heel strikes (the left foot furthest
    // forward of the hips: the stride's start); each bone's turn on average through the stride, that the arms and hips are swung about)
    c.cyc = c.n - 1; c.per = c.z[c.cyc] - c.z[0];
    const dir = new V3(...c.rest.thighL.dir), fw = f => dir.clone().applyQuaternion(c.Q.thighL[f]).z;
    let best = 0; for (let f = 0; f < c.cyc; f++) if (fw(f) > fw(best)) best = f; c.off = best;
    c.avg = {}; for (const b in c.Q) { const m = new Q(0, 0, 0, 0), q0 = c.Q[b][0]; for (let f = 0; f < c.cyc; f++) { const q = c.Q[b][f], s = q.dot(q0) < 0 ? -1 : 1; m.x += s * q.x; m.y += s * q.y; m.z += s * q.z; m.w += s * q.w; } c.avg[b] = m.normalize(); }
    c.ax = c.x.slice(0, c.cyc).reduce((a, v) => a + v, 0) / c.cyc;
  }
  return D;
}
const lerpA = (a, f) => { const i = Math.max(0, Math.min(a.length - 1, Math.floor(f))), j = Math.min(a.length - 1, i + 1), t = f - Math.floor(f); return a[i] + (a[j] - a[i]) * (f < 0 ? 0 : t); };
const styleOf = s => (typeof s === 'string' ? STYLES[s] : s) || STYLES.plain;

// Our figure, against each loop: each bone's turn to point as theirs does at rest; our legs against theirs.
function rig(F) {
  if (F._gait) return F._gait;
  const R = F.rest, s = F.root.scale.x, by = {};
  const leg = side => R['thigh' + side].distanceTo(R['foot' + side]), ours = (leg('L') + leg('R')) / 2;
  for (const k in D.clips) {
    const rest = D.clips[k].rest, C = {};
    for (const b of ORDER) {
      const src = rest[b]; if (!src) continue;
      const o = b === 'head' ? new V3(0, 1, 0.2) : b.startsWith('toe') ? new V3(0, 0, 1) : R[TO[b]] ? R[TO[b]].clone().sub(R[b]) : new V3(0, 1, 0);
      C[b] = new Q().setFromUnitVectors(o.normalize(), new V3(...src.dir).normalize());
    }
    by[k] = { C, k: ours / new V3(...rest.thighL.pos).distanceTo(new V3(...rest.footL.pos)), hipY: rest.hips.pos[1] };
  }
  return (F._gait = { by, s, k: by.walk ? by.walk.k : 1 });
}
// (a style's loops, their weights summing to one)
const mixOf = st => { const m = styleOf(st).mix, ks = Object.keys(m).filter(k => D.clips[k] && D.clips[k].loop && m[k] > 0), t = ks.reduce((a, k) => a + m[k], 0); return ks.map(k => ({ c: D.clips[k], w: m[k] / t })); };
// (where in each loop a point of the stride falls: phase 0 its left heel's strike; and how far it's gone, unwrapped)
const frameAt = (c, ph) => c.off + ph * c.cyc, wrap = (c, f) => ((f % c.cyc) + c.cyc) % c.cyc;
const goneAt = (c, f) => lerpA(c.z, wrap(c, f)) + Math.floor(f / c.cyc) * c.per;

// A point of the stride on the figure: the bases blended, then shaped; its hips placed (not carried forward: that's where the figure is put).
const _w = {}, _pw = new Q(), _q = new Q(), _m = new Q(), _x = new V3(1, 0, 0);
function pose(F, st, ph) {
  const G = rig(F), S = styleOf(st), M = mixOf(S); F.resetPose();
  for (const b of F.bones) {
    const n = b.name, par = b.parent && b.parent.isBone ? b.parent.name : null;
    _pw.copy(par && _w[par] ? _w[par] : new Q());
    const W = _w[n] || (_w[n] = new Q());
    if (M[0].c.Q[n] && G.by[M[0].c.key].C[n]) {
      // (each loop's turn for this bone, here in the stride, its swing kept as the style has it, laid on our rest; their weighted mean)
      const keep = ARMS.test(n) ? S.arms : n === 'hips' ? S.sway : 1;
      _m.set(0, 0, 0, 0); let first = null;
      for (const { c, w } of M) {
        const a = c.Q[n], f = wrap(c, frameAt(c, ph)), i = Math.floor(f), j = (i + 1) % c.cyc;
        _q.copy(a[i]).slerp(a[j], f - i); if (keep < 1) _q.copy(c.avg[n].clone().slerp(_q, keep));
        _q.multiply(G.by[c.key].C[n]);
        if (!first) first = _q.clone(); const sg = _q.dot(first) < 0 ? -w : w;
        _m.x += sg * _q.x; _m.y += sg * _q.y; _m.z += sg * _q.z; _m.w += sg * _q.w;
      }
      W.copy(_m.normalize());
      b.quaternion.copy(_pw).invert().multiply(W);
    } else W.copy(_pw).multiply(b.quaternion);
  }
  // (the head carried lower, the chest a little forward: about their own across)
  if (S.head) { F.bone.neck.quaternion.multiply(_q.setFromAxisAngle(_x, S.head * 0.6)); F.bone.head.quaternion.multiply(_q.setFromAxisAngle(_x, S.head * 0.4)); }
  if (S.slump) F.bone.chest.quaternion.multiply(_q.setFromAxisAngle(_x, S.slump));
  // (the hips: their rise and fall, and their sway, as the loops have them in proportion to our legs; the sway kept as the style has it)
  let hx = 0, hy = 0; for (const { c, w } of M) { const f = wrap(c, frameAt(c, ph)), gk = G.by[c.key]; hx += w * (c.ax + (lerpA(c.x, f) - c.ax) * S.sway) * gk.k; hy += w * (lerpA(c.y, f) - gk.hipY) * gk.k; }
  const r0 = F.rest0.hips; F.bone.hips.position.set(r0.x + hx / G.s, r0.y + hy / G.s, r0.z);
  for (const sd of ['L', 'R']) F.grip(sd, 0.35, 0.08, 0.3);
  F.root.updateMatrixWorld(true);
}
const snap = F => F.bones.map(b => [b.quaternion.clone(), b.position.clone()]);
const _tq = new Q(), _tp = new V3();
const mixFrom = (F, S, e) => { F.bones.forEach((b, i) => { _tq.copy(b.quaternion); _tp.copy(b.position); b.quaternion.copy(S[i][0]).slerp(_tq, e); b.position.lerpVectors(S[i][1], _tp, e); }); F.root.updateMatrixWorld(true); };

// ── A walk of `len` metres, planned: where in the stride it begins (ph0), how much stride it takes (span), its steps' lengthening (sg) ──
// (how far the blend goes from one point of the stride to another, for this figure)
function gone(F, st, ph0, span) { const G = rig(F); return mixOf(st).reduce((t, { c, w }) => t + w * G.by[c.key].k * (goneAt(c, frameAt(c, ph0 + span)) - goneAt(c, frameAt(c, ph0))), 0); }
function plan(F, len, o) {
  const st = (o && o.style) || 'plain', per = gone(F, st, 0, 1);
  // (ending on a heel strike, either foot: the span that comes nearest the length, begun where it must be to end there)
  let best = null;
  for (const end of [0, 0.5]) {
    let span = Math.max(0.25, len / per), ph0 = end - span;
    for (let i = 0; i < 6; i++) { const g = gone(F, st, ph0, span); span *= len / Math.max(1e-6, g); ph0 = end - span; }
    const sg = len / Math.max(1e-6, gone(F, st, ph0, span));
    if (!best || Math.abs(sg - 1) < Math.abs(best.sg - 1)) best = { ph0, span, sg, end };
  }
  return Object.assign(best, { style: st, len });
}
const planned = (F, P) => P.sg * gone(F, P.style, P.ph0, P.span);

function walker(F, len, o) {
  o = o || {}; const P = plan(F, len, o), S = styleOf(P.style), M = mixOf(S), fps = D.fps;
  // (the blend's own stride time: each loop's, weighted; the pace as the style and the scene have it)
  const T = M.reduce((t, { c, w }) => t + w * c.cyc / fps, 0) / (S.pace || 1) / (o.rate || 1);
  let t = 0, done = 0, d = 0, fin = false, fade = { S: snap(F), t: 0, ms: 420 };
  function step(dt) {
    if (fin) return { d: len, done: true };
    t += dt;
    // (eased in from standing over the first steps, out over the last: the pace, and so the going, slackened there)
    const left = P.span - done, ease = Math.min(1, 0.35 + 0.65 * Math.min(1, t / 0.7)) * Math.min(1, 0.4 + 0.6 * Math.min(1, left / 0.4));
    done = Math.min(P.span, done + dt / T * ease);
    if (done >= P.span - 1e-6) fin = true;
    d = Math.min(len, P.sg * gone(F, P.style, P.ph0, done));
    pose(F, P.style, P.ph0 + done);
    if (fade) { fade.t += dt * 1000; const e = Math.min(1, fade.t / fade.ms); mixFrom(F, fade.S, e * e * (3 - 2 * e)); if (e >= 1) fade = null; }
    return { d: fin ? len : d, done: fin };
  }
  return { step, plan: P, get mode() { return 'walk'; } };
}

root.Gait = { load, walker, plan, planned, pose, rig, STYLES, get ready() { return !!D; }, ORDER };
})(typeof window !== 'undefined' ? window : globalThis);
