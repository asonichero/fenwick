// Fenwick Hall — the cutscene player: a scene's script (js/prologue.js) played out in its room, with its people. Cuts and slow pushes between
// shots, lines said (the page shows them: ui.line), heads turned to whoever's speaking, faces set, the speaker's mouth working while the line
// types out, and the scene's acts (someone coming in, turning to someone, rising, crossing to someone, kneeling, a nod, a bow): one pose eased
// into the next where the camera can see it, cut to where it can't.
//
//   const cs = Cutscene.create({ stage, room, scene, cast: { id: figure }, ui });  cs.place() (everyone where the scene starts them)
//   await cs.play(from);  cs.tick(dt) each frame;  cs.stop()
//   ui: { line({ id, name, text, ms }) → Promise (on to the next when it resolves), fade(on) → Promise, names(map), pause(ms) → Promise (optional),
//     choose({ id, name, prompt, hint, options: [{ id, label, text }] }) → Promise(option id) }
//   fill(text) → text: the player's name put into the script's lines and names (js/player.js: Player.fill)
(function (root) {
'use strict';
const THREE = root.THREE, V3 = THREE.Vector3, P = root.Poses;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v)), sm = k => k * k * (3 - 2 * k);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const TYPE_MS = 24;       // (a character of a line, typing out: as the page's box types it)

function create(o) {
  const { stage, room, scene, cast, ui } = o, fill = o.fill || (t => t), spots = room.spots(), S = {}, names = {};
  for (const k in scene.names) names[k] = fill(scene.names[k]);
  let stopped = false, now = 0, speaking = null, talkUntil = 0; const chosen = Object.assign({}, o.chosen || {});
  const v3 = a => new V3(a[0], a[1], a[2]);
  const spotOf = id => spots[(scene.cast[id] || {}).seat || (scene.cast[id] || {}).mark || id];

  // ── Each person: posed (seated, standing, walking), and then each frame, from that pose, the head turned and any nod or bow ──
  for (const id in cast) S[id] = { F: cast[id], c: scene.cast[id] || {}, base: null, look: undefined, auto: null, yaw: 0, pitch: 0, nod: 0, bow: 0, mo0: 0, walk: null, blend: null,
    react: 0.2 + 0.45 * ((id.charCodeAt(0) * 7 + id.length * 13) % 10) / 10, seen: null, seenAt: 0, ph: id.charCodeAt(1) || 1 };      // (each turns to a new speaker after their own moment)
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
      const q = ph + off, z = 0.13 * Math.sin(q), lift = 0.04 * Math.max(0, Math.cos(q));      // (small steps, in a long skirt)
      P.legTo(F, side, P.local(F, sx * 0.1, P.ankleY(F) + lift, z), P.toWorldDir(F, sx * 0.12, 0, 1).normalize());
      P.footFlat(F, side, P.toWorldDir(F, sx * 0.1, 0, 1).normalize(), 0);
    }
    if (s.c.arms) P.arms(F, s.c.arms); keep(s);
  }
  // Down on one knee (the left), the right foot forward with its knee up, upright, looking up: the hips as high as the thigh is long.
  function kneelAt(s, at, yaw) {
    const F = s.F, sc = P.sc(F); F.resetPose(); P.setRoot(F, at, yaw);
    const th = P.W_(F, 'thighL').distanceTo(P.W_(F, 'shinL')), sh = P.W_(F, 'shinL').distanceTo(P.W_(F, 'footL')), dy = P.W_(F, 'hips').y - P.W_(F, 'thighL').y;
    F.bone.hips.position.y = (th + 0.06 + dy) / sc; F.bone.hips.position.z = -0.03 / sc; F.bone.hips.rotation.set(0.04, 0, 0);
    F.bone.spine.rotation.set(0.05, 0, 0); F.bone.chest.rotation.set(0.03, 0, 0); F.bone.neck.rotation.set(-0.08, 0, 0); F.root.updateMatrixWorld(true);
    P.legTo(F, 'R', P.local(F, -0.12, P.ankleY(F), th * 0.95), P.toWorldDir(F, -0.1, 0.45, 1).normalize());
    P.footFlat(F, 'R', P.toWorldDir(F, -0.06, 0, 1).normalize(), 0);
    P.legTo(F, 'L', P.local(F, 0.12, 0.1, -0.03 - sh * 0.95), P.toWorldDir(F, 0.05, -0.35, 1).normalize());
    P.footFlat(F, 'L', P.toWorldDir(F, 0.03, 0, 1).normalize(), 1);
    F.root.updateMatrixWorld(true); keep(s);
  }
  function place(id) {
    const s = S[id], c = s.c; s.F.root.visible = !c.off; s.blend = null; s.walk = null; s.walkP = null; s.bow = 0; s.nod = 0; s.look = c.look; s.auto = null; s.seen = null; s.seenAt = 0;
    if (c.seat) seatAt(s, spots[c.seat]); else standAt(s, spotOf(id).at, spotOf(id).yaw);
    s.F.setExpr(c.face || 'calm'); s.mo0 = s.F.exprTo.mo || 0;
  }
  const head = id => P.W_(S[id].F, 'head');
  // (a thing in the room to look at: scene.points, each from someone's place as the shots are: his plate, say)
  const point = k => { const q = scene.points && scene.points[k]; if (!q) return null; const sp = spots[q.from], c = Math.cos(sp.yaw), n = Math.sin(sp.yaw), [x, y, z] = q.at; return new V3(sp.at.x + x * c + z * n, y, sp.at.z - x * n + z * c); };
  const yawTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
  const fwdOf = sp => new V3(Math.sin(sp.yaw), 0, Math.cos(sp.yaw));
  const yawOf = F => 2 * Math.atan2(F.root.quaternion.y, F.root.quaternion.w);
  // (the way to face, from `at`: toward someone, or a spot; else along the last of the way walked; else as they are)
  // (someone else by that name, or else the spot: his own name, from him, is his chair)
  const faceYaw = (at, face, pts, by) => { const t = face && S[face] && face !== by ? S[face].F.root.position : face && spots[face] ? spots[face].at : null;
    return t ? yawTo(at, t) : pts && pts.length > 1 ? yawTo(pts[pts.length - 2], pts[pts.length - 1]) : 0; };
  // (what's done after anything they're still doing: a walk to finish, then sit)
  const after = (s, fn) => (s.walkP ? s.walkP.then(fn) : fn());
  // A walk along a way of points: small steps, the body turning into each leg of it; at the end, turned to `yaw`.
  function walkTo(s, pts, yaw, fast, speed) {
    const last = pts[pts.length - 1];
    if (fast || pts.length < 2) { s.walk = null; s.walkP = null; standAt(s, last, yaw); return null; }
    let len = 0; const segs = []; for (let i = 1; i < pts.length; i++) { const d = pts[i].distanceTo(pts[i - 1]); segs.push({ a: pts[i - 1], b: pts[i], d, at: len }); len += d; }
    s.walkP = new Promise(res => { s.walk = { segs, len, d: 0, speed: speed || 0.7, yaw: yawTo(pts[0], pts[1]), done: () => { s.walk = null; s.walkP = null; const b = blendTo(s, () => standAt(s, last, yaw), 450); (b || Promise.resolve()).then(res); } }; });
    return s.walkP;
  }

  // ── One pose eased into the next: every bone (and where they stand) carried from the one to the other, smoothly; at once when `fast` ──
  const snap = F => ({ q: F.bones.map(b => b.quaternion.clone()), p: F.bones.map(b => b.position.clone()), rp: F.root.position.clone(), rq: F.root.quaternion.clone() });
  const put = (F, A, B, k) => {
    F.bones.forEach((b, i) => { b.quaternion.copy(A.q[i]).slerp(B.q[i], k); b.position.lerpVectors(A.p[i], B.p[i], k); });
    F.root.position.lerpVectors(A.rp, B.rp, k); F.root.quaternion.copy(A.rq).slerp(B.rq, k); F.root.updateMatrixWorld(true);
  };
  function blendTo(s, pose, ms, fast) {
    const F = s.F, b = F.bone;
    if (s.base) { b.spine.rotation.copy(s.base.spine); b.chest.rotation.copy(s.base.chest); b.neck.rotation.copy(s.base.neck); }      // (from the pose itself, not the head's turn)
    const A = snap(F); pose(); const B = snap(F);
    if (fast || !ms) { keep(s); return null; }
    put(F, A, A, 0); keep(s);
    return new Promise(res => { s.blend = { A, B, t: 0, ms, done: res }; });
  }

  // ── The acts ──
  const ACTS = {
    // Adela, through the archway from the passage to her mark: a few steps, then still, her hands clasped, her eyes down.
    adelaIn(fast) {
      const s = S.adela, sp = spotOf('adela'), from = sp.at.clone().addScaledVector(fwdOf(sp), -1.6);
      s.F.root.visible = true;
      return walkTo(s, [from, sp.at.clone()], sp.yaw, fast, 0.62);
    },
    // ── And for any scene: walk a way (b.path: spots), sit (b.at: a seat), stand (where they are, or b.at), turned to b.face (someone, or a
    // spot: b.toward); the room's door to b.to (0 shut, 1 open); her hands to the lacing at the front of her bodice ──
    walk(fast, b) { const s = S[b.by], pts = b.path.map(k => spots[k].at.clone()); s.F.root.visible = true; return walkTo(s, pts, faceYaw(pts[pts.length - 1], b.toward, pts, b.by), fast, b.speed); },
    sit(fast, b) { const s = S[b.by]; return after(s, () => blendTo(s, () => seatAt(s, spots[b.at]), b.ms || 1000, fast)); },
    stand(fast, b) { const s = S[b.by]; return after(s, () => { const at = b.at ? spots[b.at].at.clone() : s.F.root.position.clone().setY(0); return blendTo(s, () => standAt(s, at, faceYaw(at, b.toward, null, b.by)), b.ms || 1000, fast); }); },
    door(fast, b) { return room.door ? room.door.to(b.to, fast ? 0 : (b.ms || 1000)) : null; },
    unlace(fast, b) {
      const s = S[b.by], F = s.F;
      return blendTo(s, () => {
        standAt(s, F.root.position.clone().setY(0), yawOf(F)); const ch = P.W_(F, 'chest'), fw = P.toWorldDir(F, 0, 0, 1), sd = P.toWorldDir(F, 1, 0, 0), up = new V3(0, 1, 0), sc = P.sc(F);
        for (const [side, sx] of [['L', 1], ['R', -1]]) P.reach(F, side, ch.clone().addScaledVector(fw, 0.13 * sc).addScaledVector(up, (sx > 0 ? -0.06 : -0.1) * sc).addScaledVector(sd, sx * 0.05 * sc),
          sd.clone().multiplyScalar(sx).addScaledVector(up, -0.7).normalize(), fw.clone().negate(), up.clone().addScaledVector(sd, -sx * 0.6).normalize());
        F.grip('L', 0.55, 0.05, 0.5); F.grip('R', 0.55, 0.05, 0.5);
      }, b.ms || 1100, fast);
    },
    // The master nods to Silas: go on.
    nod() { S.master.nod = 1; return null; },
    // Cicely turns in her chair to Young Thornleigh, and lays her hand on his arm.
    plead(fast) {
      const s = S.cicely, sp = spotOf('cicely'), F = s.F, son = S.heir.F;
      return blendTo(s, () => {
        P.seat(F, sp.at, sp.yaw, { seatY: sp.seatY, lean: 0.1, twist: 0.38, look: 0.0 }); P.arms(F, 'clasp');
        const T = P.W_(son, 'foreArmR').lerp(P.W_(son, 'handR'), 0.35), side = P.toWorldDir(F, 1, 0, 0), up = new V3(0, 1, 0);
        P.reach(F, 'L', T.addScaledVector(up, 0.035), side.clone().addScaledVector(up, -0.8).normalize(), up.clone().negate().addScaledVector(side, 0.3).normalize(), side.clone().addScaledVector(P.toWorldDir(F, 0, 0, 1), 0.6).normalize());
        F.grip('L', 0.35, 0.05, 0.3);
      }, 700, fast);
    },
    // Young Thornleigh gets up from his chair and stands beside it, turned to her, to answer her; her hand falls from his arm.
    sonRises(fast) {
      const s = S.heir, sp = spots.son, c = Math.cos(sp.yaw), n = Math.sin(sp.yaw), at = new V3(sp.at.x + 0.7 * c + 0.12 * n, 0, sp.at.z - 0.7 * n + 0.12 * c);
      s.c = Object.assign({}, s.c, { arms: null, weight: 0.3 });
      blendTo(S.cicely, () => seatAt(S.cicely, spotOf('cicely')), 600, fast);
      return blendTo(s, () => standAt(s, at, yawTo(at, spotOf('cicely').at)), 1300, fast);
    },
    // …and has crossed the hall to Adela: before her, facing her.
    sonToAdela() {
      const s = S.heir, sp = spotOf('adela'), at = sp.at.clone().addScaledVector(fwdOf(sp), 0.85);
      s.c = Object.assign({}, s.c, { weight: -0.3 }); standAt(s, at, sp.yaw + Math.PI); return null;
    },
    // He goes down on one knee before her and takes her hand: she gives it, and he holds it in both of his.
    kneel(fast) {
      const s = S.heir, a = S.adela, sp = spotOf('adela'), fw = fwdOf(sp), at = sp.at.clone().addScaledVector(fw, 0.82), side = new V3(fw.z, 0, -fw.x), up = new V3(0, 1, 0);
      const M = sp.at.clone().addScaledVector(fw, 0.42).addScaledVector(side, -0.03).setY(0.84);      // (where their hands meet, between them)
      blendTo(a, () => {
        standAt(a, sp.at, sp.yaw);
        P.reach(a.F, 'R', M.clone(), side.clone().negate().addScaledVector(up, -0.9).normalize(), up.clone().negate(), fw.clone());
        a.F.grip('R', 0.2, 0.05, 0.2);
      }, 1100, fast);
      return blendTo(s, () => {
        kneelAt(s, at, sp.yaw + Math.PI);
        const back = fw.clone().negate();      // (toward her, from him)
        P.reach(s.F, 'R', M.clone().addScaledVector(up, -0.03).addScaledVector(back, -0.01), side.clone().negate().addScaledVector(up, -0.9).normalize(), up.clone(), fw.clone());
        P.reach(s.F, 'L', M.clone().addScaledVector(up, 0.035).addScaledVector(fw, 0.03).addScaledVector(side, 0.02), side.clone().addScaledVector(up, -0.6).normalize(), up.clone().negate(), back.clone().addScaledVector(side, -0.5).normalize());
        s.F.grip('R', 0.45, 0.05, 0.4); s.F.grip('L', 0.3, 0.05, 0.3);
      }, 1400, fast);
    },
    // Silas turns to his master, and bows.
    bow(fast) { const s = S.silas, sp = spotOf('silas'); blendTo(s, () => standAt(s, sp.at, yawTo(sp.at, spots.master.at)), 500, fast); s.look = 'master'; s.bow = 1e-6; return null; },
  };

  // ── Each frame ──
  function tick(dt) {
    now += dt * 1000;
    for (const id in S) {
      const s = S[id], F = s.F; if (!F.root.visible) continue;      // (off: not there at all, cloth included, till they come on)
      if (s.walk) { const w = s.walk; w.d = Math.min(w.len, w.d + w.speed * dt);
        if (w.d >= w.len) w.done();
        else { const g = w.segs.find(q => w.d <= q.at + q.d) || w.segs[w.segs.length - 1], at = g.a.clone().lerp(g.b, (w.d - g.at) / Math.max(1e-6, g.d)), want = yawTo(g.a, g.b);
          let dy = want - w.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); w.yaw += dy * (1 - Math.exp(-dt * 7));      // (turning into each leg of the way)
          stride(s, at, w.yaw, w.d * 11.7); } }      // (the feet keeping pace: 2 × 0.13 m a step)
      if (s.blend) { const B = s.blend; B.t += dt * 1000; const k = Math.min(1, B.t / B.ms); put(F, B.A, B.B, sm(k)); keep(s); if (k >= 1) { s.blend = null; B.done(); } }
      if (!s.base) { F.tick(dt); continue; }
      // where they're looking: whoever they've been turned to, else the speaker (or whoever the speaker's speaking to); eased there
      // (a new speaker is turned to after a moment, each their own: heads don't all swing at once)
      if (s.auto !== s.seen) { if (!s.seenAt) s.seenAt = now + s.react * 1000; if (now >= s.seenAt) { s.seen = s.auto; s.seenAt = 0; } }
      let tgt = s.look !== undefined ? s.look : s.seen, wantY = 0, wantP = 0, at = null;
      if (tgt === 'down') wantP = 0.42;      // (looking down at herself, or at the floor)
      else if (tgt && S[tgt] && S[tgt].F.root.visible && tgt !== id) at = head(tgt);
      else if (tgt) at = point(tgt);
      if (at) {
        const d = at.sub(head(id)).applyQuaternion(F.root.quaternion.clone().invert());
        wantY = clamp(Math.atan2(d.x, d.z), -1.25, 1.25); wantP = clamp(Math.atan2(-d.y, Math.hypot(d.x, d.z)), -0.35, 0.5);
      }
      // (never quite still: a slow small drift of the head about where it's looking)
      wantY += 0.045 * Math.sin(now * 0.00041 + s.ph) + 0.025 * Math.sin(now * 0.00097 + 2 * s.ph); wantP += 0.025 * Math.sin(now * 0.00053 + 3 * s.ph);
      if (F.exprName === 'haughty') wantP -= 0.13;      // (the chin up)
      const kk = 1 - Math.exp(-dt * 3.6); s.yaw += (wantY - s.yaw) * kk; s.pitch += (wantP - s.pitch) * kk;
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
    if (b.name) { for (const k in b.name) names[k] = fill(b.name[k]); if (ui.names) ui.names(names); }
    if (b.look) for (const id in b.look) if (S[id]) S[id].look = b.look[id] === null ? undefined : b.look[id];
    if (b.listen) for (const id in b.listen) face(id, b.listen[id]);
    let wait = null;
    if (b.act && ACTS[b.act]) wait = ACTS[b.act](fast, b);
    if (b.wait === false) wait = null;      // (done while the line's said)
    if (b.shot) { shotTo(b.shot, b.glide); if (b.push && !fast) { const to = b.push, ms = b.ms || 9000; setTimeout(() => { if (!stopped) shotTo(to, ms); }, 30); } }
    if (fast) { if (b.act === 'bow') S.silas.bow = 1; if (b.act === 'nod') S.master.nod = 0; return; }      // (the bow all the way down; the nod over)
    if (wait) await wait;
    if (stopped) return;
    if (b.who) {
      face(b.who, b.face);
      for (const id in S) S[id].auto = id === b.who ? (b.to || null) : (S[id].c.demure && b.to !== id ? null : b.who);
      const text = fill(b.text); speaking = b.who; talkUntil = now + text.length * TYPE_MS + 150;
      await ui.line({ id: b.who, name: names[b.who] || b.who, text, ms: text.length * TYPE_MS });
      speaking = null;
    }
    // (a choice: the player picks what Silas says (shown on the page: ui.choose), and its beats play; skipped past, it's the one chosen before,
    // or the first)
    if (b.choose) {
      const C = b.choose; let id = chosen[C.key];
      if (!fast || !id) id = fast ? C.options[0].id : await ui.choose({ id: C.who || 'silas', name: names[C.who || 'silas'], prompt: fill(C.prompt || ''), hint: C.hint, options: C.options.map(q => ({ id: q.id, label: q.label, text: fill(q.text) })) });
      chosen[C.key] = id; if (ui.chose) ui.chose(C.key, id);
      const opt = C.options.find(q => q.id === id) || C.options[0];
      for (const x of opt.beats) { if (stopped) return; await beat(x, fast); }
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
  return { play, tick, place: () => { for (const id in S) place(id); if (scene.start && scene.start.door != null && room.door) room.door.set(scene.start.door); }, stop: () => { stopped = true; }, get names() { return names; }, chosen, S, spots, shotTo };
}

root.Cutscene = { create, TYPE_MS };
})(typeof window !== 'undefined' ? window : globalThis);
