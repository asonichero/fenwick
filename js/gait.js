// Fenwick Hall — walking: the Mixamo clips (models/*.fbx, made into models/walk.json by tools/blender/export_anims.py) played on our figures.
//
// Each clip gives, frame by frame, how far each bone has turned in the world from its rest (a T-pose), and where the hips are. Ours rest with
// the arms hanging, so each of our bones is first turned to point as theirs does at rest (arms up level, the rest near enough as it is), and
// then turned as theirs has. The hips rise, fall and sway as theirs do, in proportion to our legs; their going forward is the figure's own:
// it's carried along its way by just as much, so the feet stay where they're put.
//   A walk of a given length: the start (from standing; only if there's room for it), the walk, and the stop, which is begun at the frame of
// it that matches the step the walk is on, as soon as what's left to go is what the stop takes from there: so it ends where it should, on
// its own feet. Short walks begin in the walk itself, or the stop. Each eased into from the last.
//
//   await Gait.load()  ·  const w = Gait.walker(F, length, { rate })  ·  each frame: const { d, done } = w.step(dt)  (then place the figure
//   at d along its way; its bones are set)  ·  Gait.ready
(function (root) {
'use strict';
const THREE = root.THREE, V3 = THREE.Vector3, Q = THREE.Quaternion;
let D = null;
const ORDER = ['hips', 'spine', 'chest', 'neck', 'head', 'clavL', 'upperArmL', 'foreArmL', 'handL', 'clavR', 'upperArmR', 'foreArmR', 'handR', 'thighL', 'shinL', 'footL', 'toeL', 'thighR', 'shinR', 'footR', 'toeR'];
// (where each of our bones points: to the next joint, as theirs is measured)
const TO = { hips: 'spine', spine: 'chest', chest: 'neck', neck: 'head', clavL: 'upperArmL', upperArmL: 'foreArmL', foreArmL: 'handL', handL: 'middle1L',
  clavR: 'upperArmR', upperArmR: 'foreArmR', foreArmR: 'handR', handR: 'middle1R', thighL: 'shinL', shinL: 'footL', footL: 'toeL', thighR: 'shinR', shinR: 'footR', footR: 'toeR' };

async function load(url) {
  if (D) return D;
  const r = await fetch(url || 'models/walk.json'); D = await r.json();
  // (each clip's frames as quaternions; how far its hips have gone forward at each frame)
  for (const k in D.clips) { const c = D.clips[k]; c.Q = {}; for (const b in c.q) { const a = c.q[b], out = []; for (let i = 0; i < a.length; i += 4) out.push(new Q(a[i], a[i + 1], a[i + 2], a[i + 3])); c.Q[b] = out; }
    c.x = []; c.y = []; c.z = []; for (let f = 0; f < c.n; f++) { c.x.push(c.hips[f * 3]); c.y.push(c.hips[f * 3 + 1]); c.z.push(c.hips[f * 3 + 2]); } }
  // (the stop, mirrored: left for right, so it can follow on from either foot. A turn mirrored across x = 0 is (x, −y, −z, w))
  const S = D.clips.stop, M = { n: S.n, Q: {}, x: S.x.map(v => -v), y: S.y.slice(), z: S.z.slice() }, sw = b => (/L$/.test(b) ? b.slice(0, -1) + 'R' : /R$/.test(b) ? b.slice(0, -1) + 'L' : b);
  for (const b in S.Q) M.Q[b] = S.Q[sw(b)].map(q => new Q(q.x, -q.y, -q.z, q.w));
  D.clips.stopM = M;
  return D;
}
const lerpA = (a, f) => { const i = Math.max(0, Math.min(a.length - 1, Math.floor(f))), j = Math.min(a.length - 1, i + 1), t = f - Math.floor(f); return a[i] + (a[j] - a[i]) * (f < 0 ? 0 : t); };

// Our figure's own: each bone's turn to point as theirs does at rest; our legs against theirs.
function rig(F) {
  if (F._gait) return F._gait;
  const R = F.rest, s = F.root.scale.x, C = {};
  for (const b of ORDER) {
    const src = D.rest[b]; if (!src) continue;
    let ours = b === 'head' ? new V3(0, 1, 0.2) : b.startsWith('toe') ? new V3(0, 0, 1) : R[TO[b]] ? R[TO[b]].clone().sub(R[b]) : new V3(0, 1, 0);
    ours.normalize(); C[b] = new Q().setFromUnitVectors(ours, new V3(...src.dir).normalize());
  }
  const leg = side => R['thigh' + side].distanceTo(R['foot' + side]), theirs = new V3(...D.rest.thighL.pos).distanceTo(new V3(...D.rest.footL.pos));
  const k = (leg('L') + leg('R')) / 2 / theirs;
  return (F._gait = { C, k, s, hipY: D.rest.hips.pos[1] });
}

// A frame of a clip on the figure: its bones turned, its hips placed (but not carried forward: that's where the figure is put).
const _w = {}, _pw = new Q(), _q = new Q();
function pose(F, clip, f) {
  const G = rig(F), c = D.clips[clip]; F.resetPose();
  const world = _w;
  for (const b of F.bones) {
    const n = b.name, par = b.parent && b.parent.isBone ? b.parent.name : null;
    _pw.copy(par && world[par] ? world[par] : new Q());
    const W = world[n] || (world[n] = new Q());
    if (c.Q[n] && G.C[n]) {
      const a = c.Q[n], i = Math.max(0, Math.min(a.length - 1, Math.floor(f))), j = Math.min(a.length - 1, i + 1);
      _q.copy(a[i]).slerp(a[j], Math.max(0, f - Math.floor(f)));
      W.copy(_q).multiply(G.C[n]);
      b.quaternion.copy(_pw).invert().multiply(W);
    } else W.copy(_pw).multiply(b.quaternion);
  }
  const hx = lerpA(c.x, f), hy = lerpA(c.y, f), r0 = F.rest0.hips;
  F.bone.hips.position.set(r0.x + hx * G.k / G.s, r0.y + (hy - G.hipY) * G.k / G.s, r0.z);
  for (const sd of ['L', 'R']) F.grip(sd, 0.35, 0.08, 0.3);
  F.root.updateMatrixWorld(true);
}
const snap = F => F.bones.map(b => [b.quaternion.clone(), b.position.clone()]);
const _tq = new Q(), _tp = new V3();
const mixFrom = (F, S, e) => { F.bones.forEach((b, i) => { _tq.copy(b.quaternion); _tp.copy(b.position); b.quaternion.copy(S[i][0]).slerp(_tq, e); b.position.lerpVectors(S[i][1], _tp, e); }); F.root.updateMatrixWorld(true); };

// A walk of `len` metres, planned before it's begun: a run of pieces of clips, each from a frame for so many frames, and how much their steps
// are lengthened (σ) to come out at `len` exactly.
//   With room for it: the start (from standing), the walk for some half-strides, and the stop (mirrored if the half-strides are odd), all
// lengthened alike by as little as it takes (σ within 12%). Else: the walk, begun at whichever point of its stride brings it, after len − stop,
// to the stop's first step (on either foot), and the stop; or for a very short way, the stop alone, from as far into it as leaves len to go.
function plan(F, len, o) {
  const G = rig(F), J = D.join, cyc = J.cycle, half = cyc / 2, W = D.clips.walk, St = D.clips.start, Sp = D.clips.stop, k = G.k;
  const per = W.z[cyc] - W.z[0], Zw = f => lerpA(W.z, ((f % cyc) + cyc) % cyc) + Math.floor(f / cyc) * per;      // (the walk's going, unwrapped)
  const wd = (a, n) => (Zw(a + n) - Zw(a)) * k, ds = (St.z[St.n - 1] - St.z[J.startFirst]) * k, dp = (Sp.z[Sp.n - 1] - Sp.z[0]) * k;
  const stop = odd => ({ clip: odd ? 'stopM' : 'stop', from: 0, n: Sp.n - 1 });
  if (!o.noStart) {
    let best = null;
    for (let h = 0; h <= 24; h++) { const nom = ds + wd(J.startToWalk, h * half) + dp, sg = len / nom; if (!best || Math.abs(sg - 1) < Math.abs(best.sg - 1)) best = { h, sg }; }
    if (best && Math.abs(best.sg - 1) <= 0.12) return { sg: best.sg, seq: [{ clip: 'start', from: J.startFirst, n: St.n - 1 - J.startFirst }].concat(best.h ? [{ clip: 'walk', from: J.startToWalk, n: best.h * half }] : [], [stop(best.h % 2)]) };
  }
  if (len >= dp) {
    // (backwards from the stop's step, on whichever foot needs the walk begun nearer a whole step: as far as len − dp)
    const want = len - dp, opts = [0, 1].map(odd => { const T = J.walkToStop + odd * half; let x = 0; while (wd(T - x - 0.25, x + 0.25) <= want && x < 40 * cyc) x += 0.25;
      let lo = x, hi = x + 0.25; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (wd(T - m, m) <= want) lo = m; else hi = m; }      // (to the millimetre)
      return { odd, a: T - lo, x: lo }; });
    const o2 = opts[0].x <= opts[1].x ? opts[0] : opts[1];
    return { sg: 1, seq: [{ clip: 'walk', from: ((o2.a % cyc) + cyc) % cyc, n: o2.x }, stop(o2.odd)] };
  }
  let f = 0; while (f < 40 && (Sp.z[Sp.n - 1] - lerpA(Sp.z, f)) * k > len) f += 0.25;      // (σ makes up the rest)
  return { sg: len / ((Sp.z[Sp.n - 1] - lerpA(Sp.z, f)) * k || 1), seq: [{ clip: 'stop', from: f, n: Sp.n - 1 - f }] };
}
function walker(F, len, o) {
  o = o || {}; const G = rig(F), cyc = D.join.cycle, fps = D.fps, rate = o.rate || 1, P = plan(F, len, o), W = D.clips.walk, per = W.z[cyc] - W.z[0];
  const zOf = (clip, f) => clip === 'walk' ? lerpA(W.z, ((f % cyc) + cyc) % cyc) + Math.floor(f / cyc) * per : lerpA(D.clips[clip].z, f);
  let i = 0, t = 0, base = 0, d = 0, done = false, fade = { S: snap(F), t: 0, ms: 380 };
  function step(dt) {
    if (done) return { d: len, done };
    t += dt * fps * rate;
    let p = P.seq[i];
    while (t >= p.n && i < P.seq.length - 1) { base += (zOf(p.clip, p.from + p.n) - zOf(p.clip, p.from)) * G.k * P.sg; t -= p.n; i++; p = P.seq[i]; fade = { S: snap(F), t: 0, ms: 160 }; }
    if (t >= p.n) { t = p.n; done = true; }
    d = Math.min(len, base + (zOf(p.clip, p.from + t) - zOf(p.clip, p.from)) * G.k * P.sg);
    const f = p.from + t; pose(F, p.clip, p.clip === 'walk' ? ((f % cyc) + cyc) % cyc : f);
    if (fade) { fade.t += dt * 1000; const e = Math.min(1, fade.t / fade.ms); mixFrom(F, fade.S, e * e * (3 - 2 * e)); if (e >= 1) fade = null; }
    return { d: done ? len : d, done };
  }
  return { step, plan: P, get mode() { return P.seq[i].clip; } };
}

// (how far a plan goes, as planned: for checking it comes out at the length asked)
function planned(F, P) {
  const G = rig(F), cyc = D.join.cycle, W = D.clips.walk, per = W.z[cyc] - W.z[0];
  const zOf = (clip, f) => clip === 'walk' ? lerpA(W.z, ((f % cyc) + cyc) % cyc) + Math.floor(f / cyc) * per : lerpA(D.clips[clip].z, f);
  return P.seq.reduce((t, p) => t + (zOf(p.clip, p.from + p.n) - zOf(p.clip, p.from)) * G.k * P.sg, 0);
}

root.Gait = { load, walker, plan, planned, pose, rig, get ready() { return !!D; }, ORDER };
})(typeof window !== 'undefined' ? window : globalThis);
