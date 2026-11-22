// Fenwick Hall — the cutscene player: a scene's script (js/prologue.js) played out in its room, with its people. Cuts and slow pushes between
// shots, lines said (the page shows them: ui.line), heads turned to whoever's speaking, faces set, the speaker's mouth working while the line
// types out, and the scene's acts (someone coming in, rising, crossing to someone, a nod, a bow).
//
//   const cs = Cutscene.create({ stage, room, scene, cast: { id: figure }, ui });  await cs.play(from);  cs.tick(dt) each frame;  cs.stop()
//   ui: { line({ id, name, text, ms }) → Promise (on to the next when it resolves), fade(on) → Promise, names(map), pause(ms) → Promise (optional) }
(function (root) {
'use strict';
const THREE = root.THREE, V3 = THREE.Vector3, P = root.Poses;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), sm = k => k * k * (3 - 2 * k);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPE_MS = 24;       // (a character of a line, typing out: as the page's box types it)

function create(o) {
  const { stage, room, scene, cast, ui } = o, spots = room.spots(), S = {}, names = Object.assign({}, scene.names);
  let stopped = false, now = 0, speaking = null, talkUntil = 0;
  const v3 = a => new V3(a[0], a[1], a[2]);
  const spotOf = id => spots[(scene.cast[id] || {}).seat || (scene.cast[id] || {}).mark || id];

  // ── Each person: posed (seated, standing, walking), and then each frame, from that pose, the head turned and any nod or bow ──
  for (const id in cast) S[id] = { F: cast[id], c: scene.cast[id] || {}, base: null, look: undefined, auto: null, yaw: 0, pitch: 0, nod: 0, bow: 0, mo0: 0, walk: null };
  const keep = s => { const b = s.F.bone; s.base = { spine: b.spine.rotation.clone(), chest: b.chest.rotation.clone(), neck: b.neck.rotation.clone() }; };
  function seatAt(s, spot) { P.seat(s.F, spot.at, spot.yaw, { seatY: spot.seatY, lean: 0.03, look: 0.06 }); P.arms(s.F, 'clasp'); keep(s); }
  function standAt(s, at, yaw) {
    P.stand(s.F, at, yaw, { weight: s.c.weight == null ? 0.35 : s.c.weight, look: s.c.arms === 'clasp' ? 0.18 : 0.06 });
    if (s.c.arms) P.arms(s.F, s.c.arms); keep(s);
  }
  // (a few steps: the body carried along, the legs swinging under it, a little rise and fall; the hands as they're held)
  function stride(s, at, yaw, ph) {
    const F = s.F; P.stand(F, at, yaw, { weight: 0.12 * Math.sin(ph), look: 0.16, arms: null });
    F.bone.hips.position.y += 0.012 * Math.cos(2 * ph); F.root.updateMatrixWorld(true);
    for (const [side, sx, off] of [['L', 1, 0], ['R', -1, Math.PI]]) {
      const q = ph + off, z = 0.2 * Math.sin(q), lift = 0.055 * Math.max(0, Math.cos(q));
      P.legTo(F, side, P.local(F, sx * 0.1, P.ankleY(F) + lift, z), P.toWorldDir(F, sx * 0.12, 0, 1).normalize());
      P.footFlat(F, side, P.toWorldDir(F, sx * 0.1, 0, 1).normalize(), 0);
    }
    if (s.c.arms) P.arms(F, s.c.arms); keep(s);
  }
  function place(id) {
    const s = S[id], c = s.c; s.F.root.visible = !c.off;
    if (c.seat) seatAt(s, spots[c.seat]); else standAt(s, spotOf(id).at, spotOf(id).yaw);
    s.F.setExpr(c.face || 'calm'); s.mo0 = s.F.exprTo.mo || 0;
  }
  const head = id => P.W_(S[id].F, 'head');
  const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);

  // ── The acts ──
  const ACTS = {
    // Adela, through the archway from the passage to her mark: a few steps, then still, her hands clasped, her eyes down.
    adelaIn(fast) {
      const s = S.adela, sp = spotOf('adela'), fwd = new V3(Math.sin(sp.yaw), 0, Math.cos(sp.yaw)), from = sp.at.clone().addScaledVector(fwd, -1.6);
      s.F.root.visible = true;
      if (fast) { standAt(s, sp.at, sp.yaw); return null; }
      return new Promise(res => { s.walk = { from, to: sp.at.clone(), yaw: sp.yaw, t: 0, ms: 2600, done: () => { standAt(s, sp.at, sp.yaw); res(); } }; });
    },
    // The master nods to Silas: go on.
    nod() { S.master.nod = 1; return null; },
    // The young lord gets up from his chair, beside it, turned toward her.
    sonRises() {
      const s = S.heir, sp = spots.son, c = Math.cos(sp.yaw), n = Math.sin(sp.yaw), at = new V3(sp.at.x + 0.7 * c + 0.15 * n, 0, sp.at.z - 0.7 * n + 0.15 * c);
      standAt(s, at, yawTo(at, spotOf('adela').at)); s.c = Object.assign({}, s.c, { arms: null }); return null;
    },
    // …and has crossed the hall to her: before her, facing her.
    sonToAdela() {
      const s = S.heir, sp = spotOf('adela'), at = sp.at.clone().addScaledVector(new V3(Math.sin(sp.yaw), 0, Math.cos(sp.yaw)), 0.85);
      s.c = Object.assign({}, s.c, { weight: -0.3 }); standAt(s, at, sp.yaw + Math.PI); return null;
    },
    // Silas turns to his master, and bows.
    bow() { const s = S.silas, sp = spotOf('silas'); standAt(s, sp.at, yawTo(sp.at, spots.master.at)); s.look = 'master'; s.bow = 1e-6; return null; },
  };

  // ── Each frame ──
  function tick(dt) {
    now += dt * 1000;
    for (const id in S) {
      const s = S[id], F = s.F; if (!F.root.visible) { F.tick(dt); continue; }
      if (s.walk) { const w = s.walk; w.t += dt * 1000; const k = clamp(w.t / w.ms, 0, 1), at = w.from.clone().lerp(w.to, k);
        if (k >= 1) { s.walk = null; w.done(); } else stride(s, at, w.yaw, (w.t / 1000) * 4.6); }
      if (!s.base) { F.tick(dt); continue; }
      // where they're looking: whoever they've been turned to, else the speaker (or whoever the speaker's speaking to); eased there
      let tgt = s.look !== undefined ? s.look : s.auto, wantY = 0, wantP = 0;
      if (tgt === 'down') wantP = 0.42;      // (looking down at herself, or at the floor)
      else if (tgt && S[tgt] && S[tgt].F.root.visible && tgt !== id) {
        const me = head(id), d = head(tgt).sub(me).applyQuaternion(F.root.quaternion.clone().invert());
        wantY = clamp(Math.atan2(d.x, d.z), -1.25, 1.25); wantP = clamp(Math.atan2(-d.y, Math.hypot(d.x, d.z)), -0.35, 0.45);
      }
      if (F.exprName === 'haughty') wantP -= 0.13;      // (the chin up)
      const kk = 1 - Math.exp(-dt * 4.5); s.yaw += (wantY - s.yaw) * kk; s.pitch += (wantP - s.pitch) * kk;
      if (s.nod) { s.nod += dt / 0.8; if (s.nod >= 2) s.nod = 0; }
      if (s.bow) s.bow = Math.min(1, s.bow + dt / 0.9);
      const nodA = s.nod ? 0.22 * Math.sin(Math.PI * Math.min(1, s.nod)) : 0, bw = sm(s.bow || 0);
      const b = F.bone, B = s.base;
      b.spine.rotation.set(B.spine.x + 0.32 * bw, B.spine.y + 0.15 * s.yaw, B.spine.z);
      b.chest.rotation.set(B.chest.x + 0.18 * bw, B.chest.y + 0.2 * s.yaw, B.chest.z);
      b.neck.rotation.set(B.neck.x + 0.75 * s.pitch + nodA + 0.3 * bw, B.neck.y + 0.65 * s.yaw, B.neck.z);
      // (the speaker's mouth working while the line types out)
      if (speaking === id && now < talkUntil) F.exprTo.mo = s.mo0 + 0.32 * Math.abs(Math.sin(now * 0.016)) * (0.6 + 0.4 * Math.sin(now * 0.0047));
      else F.exprTo.mo = s.mo0;
      F.root.updateMatrixWorld(true); F.tick(dt);
    }
  }
  const face = (id, f) => { const s = S[id]; if (!s || !f) return; s.F.setExpr(f); s.mo0 = s.F.exprTo.mo || 0; };
  function shotTo(name, ms) { const sh = root.Prologue.shot(scene, name, spots); if (sh) stage.go(v3(sh.cam), v3(sh.look), ms || 0); }

  // ── A beat ──
  async function beat(b, fast) {
    if (b.name) { Object.assign(names, b.name); if (ui.names) ui.names(names); }
    if (b.look) for (const id in b.look) if (S[id]) S[id].look = b.look[id] === null ? undefined : b.look[id];
    if (b.listen) for (const id in b.listen) face(id, b.listen[id]);
    let wait = null;
    if (b.act && ACTS[b.act]) wait = ACTS[b.act](fast);
    if (b.shot) { shotTo(b.shot, b.glide); if (b.push && !fast) { const to = b.push, ms = b.ms || 9000; setTimeout(() => { if (!stopped) shotTo(to, ms); }, 30); } }
    if (fast) { if (b.act === 'bow') S.silas.bow = 1; if (b.act === 'nod') S.master.nod = 0; return; }      // (the bow all the way down; the nod over)
    if (wait) await wait;
    if (stopped) return;
    if (b.who) {
      face(b.who, b.face);
      for (const id in S) S[id].auto = id === b.who ? (b.to || null) : (S[id].c.demure && b.to !== id ? null : b.who);
      speaking = b.who; talkUntil = now + b.text.length * TYPE_MS + 150;
      await ui.line({ id: b.who, name: names[b.who] || b.who, text: b.text, ms: b.text.length * TYPE_MS });
      speaking = null;
    }
    if (b.pause && !stopped) await (ui.pause ? ui.pause(b.pause) : sleep(b.pause));
    if (b.end) await ui.fade(true);
  }
  // Played from the start (or from beat `from`, everything before it done at once: who's where, what they're called, what they look like).
  async function play(from) {
    from = from || 0; stopped = false;
    for (const id in S) place(id);
    for (let i = 0; i < from && i < scene.beats.length; i++) await beat(scene.beats[i], true);
    if (ui.names) ui.names(names);
    for (let i = from; i < scene.beats.length; i++) { if (stopped) return false; await beat(scene.beats[i], false); }
    return !stopped;
  }
  return { play, tick, stop: () => { stopped = true; }, get names() { return names; }, S, spots, shotTo };
}

root.Cutscene = { create, TYPE_MS };
})(typeof window !== 'undefined' ? window : globalThis);
