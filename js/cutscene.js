// Fenwick Hall — the cutscene player: a scene's script (js/prologue.js) played out in its room, with its people. Cuts and slow pushes between
// shots, lines said (the page shows them: ui.line), heads turned to whoever's speaking, faces set, the speaker's mouth working while the line
// types out, and the scene's acts (someone coming in, turning to someone, rising, crossing to someone, kneeling, a nod, a bow): one pose eased
// into the next where the camera can see it, cut to where it can't.
//
//   const cs = Cutscene.create({ stage, room, scene, cast: { id: figure }, ui });  cs.place() (everyone where the scene starts them)
//   await cs.play(from);  cs.tick(dt) each frame;  cs.stop()
//   ui: { line({ id, name, text, ms, hold }) → Promise (on to the next when it resolves; hold 'choices': as soon as it's shown whole, the choices
//     to come up under it), fade(on) → Promise, names(map), pause(ms) → Promise (optional), choose({ id, name, prompt, hint, options: [{ id, label,
//     text }] }) → Promise(option id) (a prompt of null: under the line already shown; an option with no text: its label alone), and optional:
//     sfx(name) (a sound: 'knock', 'paper'), click() → Promise (a cue, and wait for the player), clear() (the dialogue box away), hurry(fn) (a
//     click or a key, while the letter's being written: all of it, at once) }
//   A beat can also be: talk (lines of inquiry, in any order, every one of them, before the scene goes on: { prompt, hint, options: [{ id,
//   label, beats }] }); think (a line his own thought, not said); sfx; click (wait for the player); button (a button at the foot of the view, labelled, to go on by); clear (the last
//   line away); hold: 'choices' (a line the talk's first choices come up under).
//   A scene can have a letter (scene.letter): folded, carried in someone's hand (start: { by, side }), laid on something (act lay, at a point),
//   taken up (take), opened (open: unfolded and held to read), read (read: the view cut to the whole page, still, its text written in) and put
//   down (lower: folded, and the view back).
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
  const ME = scene.me || 'silas';      // (who the player speaks as, in a talk)
  let stopped = false, now = 0, speaking = null, talkUntil = 0; const chosen = Object.assign({}, o.chosen || {});
  const v3 = a => new V3(a[0], a[1], a[2]);
  const spotOf = id => spots[(scene.cast[id] || {}).seat || (scene.cast[id] || {}).mark || id];

  // ── Each person: posed (seated, standing, walking), and then each frame, from that pose, the head turned and any nod or bow ──
  for (const id in cast) S[id] = { F: cast[id], c: scene.cast[id] || {}, base: null, look: undefined, auto: null, yaw: 0, pitch: 0, nod: 0, bow: 0, mo0: 0, walk: null, blend: null,
    react: 0.2 + 0.45 * ((id.charCodeAt(0) * 7 + id.length * 13) % 10) / 10, seen: null, seenAt: 0, ph: id.charCodeAt(1) || 1 };      // (each turns to a new speaker after their own moment)
  const keep = s => { const b = s.F.bone; s.base = { spine: b.spine.rotation.clone(), chest: b.chest.rotation.clone(), neck: b.neck.rotation.clone() }; };
  function seatAt(s, spot) { P.seat(s.F, spot.at, spot.yaw, { seatY: spot.seatY, lean: s.c.arms === 'desk' ? 0.1 : 0.03, look: 0.06 }); if (s.c.arms === 'desk') deskHands(s); else P.arms(s.F, 'clasp'); keep(s); }
  // (sat at a desk: both hands on it before them, palms down, a forearm's length out; the right a little further, as if at his pen)
  function deskHands(s) {
    const F = s.F, sc = P.sc(F), fwd = P.toWorldDir(F, 0, 0, 1), side = P.toWorldDir(F, 1, 0, 0), up = new V3(0, 1, 0), ch = P.W_(F, 'chest'), y = s.c.deskY || 0.765;
    for (const [sd, sx] of [['L', 1], ['R', -1]]) {
      const fing = fwd.clone().addScaledVector(side, -sx * 0.35).normalize(), palm = ch.clone().addScaledVector(fwd, (sx > 0 ? 0.34 : 0.38) * sc).addScaledVector(side, sx * 0.16 * sc).setY(y + 0.03);
      P.reach(F, sd, palm.addScaledVector(fing, -0.075 * sc), side.clone().multiplyScalar(sx).addScaledVector(up, -0.7).normalize(), up.clone().negate(), fing); F.grip(sd, 0.3, 0.05, 0.3);
    }
  }
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
  const point = k => { if (k === 'letter' && LT) return LT.where(); const q = scene.points && scene.points[k]; if (!q) return room.points && room.points[k] ? room.points[k].clone() : null; const sp = spots[q.from], c = Math.cos(sp.yaw), n = Math.sin(sp.yaw), [x, y, z] = q.at; return new V3(sp.at.x + x * c + z * n, y, sp.at.z - x * n + z * c); };
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
    // (the walk itself: their own walk, blended from the Mixamo loops (js/gait.js: s.c.gait, a style), carried along the way as far as its steps
    // take it; else a few small steps of our own)
    const gait = root.Gait && root.Gait.ready ? root.Gait.walker(s.F, len, { style: s.c.gait || 'plain', rate: s.c.gaitRate || 1 }) : null;
    s.walkP = new Promise(res => { s.walk = { segs, len, d: 0, gait, speed: speed || 0.7, yaw: yawTo(pts[0], pts[1]), done: () => { s.walk = null; s.walkP = null; const b = blendTo(s, () => standAt(s, last, yaw), 450); (b || Promise.resolve()).then(res); } }; });
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

  // ── The letter (scene.letter): a folded packet sealed in red wax, carried in a hand or laid down; and, opened, its sheet, held up to read,
  // its text (scene.letter.text) written out a stroke at a time ──
  const LT = scene.letter ? makeLetter(scene.letter) : null;
  function makeLetter(def) {
    const paperM = new THREE.MeshStandardMaterial({ color: 0xe9dfc4, roughness: 0.92, side: THREE.DoubleSide }), sealM = new THREE.MeshStandardMaterial({ color: 0x8a1a14, roughness: 0.45 });
    const packet = new THREE.Group(), pk = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.004, 0.1), paperM); pk.castShadow = true; packet.add(pk);
    const seal = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.012, 0.003, 16), sealM); seal.position.set(0.012, 0.0032, 0.004); packet.add(seal);
    // (the sheet: its own canvas, the paper and its folds drawn once, the words over them as far as they're written)
    const W = 1024, H = 1434, cv = document.createElement('canvas'); cv.width = W; cv.height = H; const c = cv.getContext('2d');
    const bg = document.createElement('canvas'); bg.width = W; bg.height = H; const b = bg.getContext('2d');
    if (b.createLinearGradient) { const g = b.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#f1e8d0'); g.addColorStop(1, '#e4d6b4'); b.fillStyle = g; } else b.fillStyle = '#ece0c4';
    b.fillRect(0, 0, W, H); for (let i = 0; i < 900; i++) { b.fillStyle = `rgba(120,96,60,${0.03 + 0.05 * Math.random()})`; b.fillRect(Math.random() * W, Math.random() * H, 2, 2); }
    for (const y of [H / 3, 2 * H / 3]) { b.fillStyle = 'rgba(120,96,60,0.14)'; b.fillRect(0, y - 1, W, 2); b.fillStyle = 'rgba(255,255,255,0.25)'; b.fillRect(0, y + 1, W, 2); }      // (where it was folded)
    b.strokeStyle = 'rgba(120,96,60,0.25)'; b.lineWidth = 6; b.strokeRect(3, 3, W - 6, H - 6);
    const tex = new THREE.CanvasTexture(cv); tex.anisotropy = 8; if (THREE.sRGBEncoding) tex.encoding = THREE.sRGBEncoding;
    const sheetM = new THREE.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: 0.05, color: 0xd6cdb8, roughness: 0.95, side: THREE.DoubleSide });      // (lit as paper is: not glowing)
    const sheet = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.28), sheetM);
    const sc3 = stage.scene; sc3.add(packet); sc3.add(sheet);
    // (the words laid out on the sheet: each block a paragraph (p), a line to the right (right), or the name signed (sign))
    const FONT = 'italic 35px Georgia, "Times New Roman", serif', LH = 47, M = 92, lines = [];
    c.font = FONT; const wide = t => (c.measureText ? c.measureText(t).width : t.length * 17);
    let y = 120;
    for (const blk of def.text) {
      const t = fill(blk.p || blk.right || blk.sign || '');
      if (blk.gap) { y += blk.gap; continue; }
      if (blk.right || blk.sign) { lines.push({ s: t, x: W - M, y, align: 'right', sign: !!blk.sign }); y += LH * (blk.sign ? 1.4 : 1); continue; }
      const words = t.split(' '); let cur = '', first = true;
      for (const w of words) { const next = cur ? cur + ' ' + w : w; if (wide(next) > W - 2 * M - (first && blk.indent ? 50 : 0) && cur) { lines.push({ s: cur, x: M + (first && blk.indent ? 50 : 0), y }); y += LH; cur = w; first = false; } else cur = next; }
      if (cur) { lines.push({ s: cur, x: M + (first && blk.indent ? 50 : 0), y }); y += LH; }
      y += blk.after == null ? LH * 0.45 : blk.after;
    }
    const total = lines.reduce((n, l) => n + l.s.length, 0);
    let shown = -1;
    function draw(n) {
      n = Math.max(0, Math.min(total, Math.floor(n))); if (n === shown) return; shown = n;
      c.drawImage(bg, 0, 0); c.font = FONT; c.textBaseline = 'alphabetic'; let left = n;
      for (const l of lines) { if (left <= 0) break; const part = l.s.slice(0, left); left -= l.s.length;
        c.fillStyle = l.sign ? '#1e120a' : '#261810'; c.font = l.sign ? 'italic 46px Georgia, serif' : FONT;
        if (l.align === 'right') { c.textAlign = 'left'; c.fillText(part, l.x - wide(l.s), l.y); } else { c.textAlign = 'left'; c.fillText(part, l.x, l.y); } }
      tex.needsUpdate = true;
    }
    const L = { packet, sheet, total, holder: null, open: false, write: null, reading: null, draw, lines,
      unwiden() { if (this.fov0 != null) { stage.camera.fov = this.fov0; stage.camera.updateProjectionMatrix(); this.fov0 = null; }
        if (this.minD != null && stage.controls) { stage.controls.minDistance = this.minD; this.minD = null; } },
      reset() { this.unwiden(); const st = def.start || {}; this.open = false; this.write = null; this.reading = null; packet.visible = true; sheet.visible = false; this.holder = st.by ? { id: st.by, side: st.side || 'R' } : null; draw(0); },
      where() { return (this.open ? sheet : packet).getWorldPosition(new V3()); } };
    return L;
  }
  const palmOf = (F, sd) => { const h = P.W_(F, 'hand' + sd), d = h.clone().sub(P.W_(F, 'foreArm' + sd)).normalize(); return h.addScaledVector(d, 0.07 * P.sc(F)); };
  // (where it is, each frame: in the hand holding it, or, open, between the two hands holding it up, turned to the face reading it)
  function placeLetter() {
    const h = LT.holder; if (!h || !S[h.id]) return; const F = S[h.id].F;
    if (LT.open) { const m = palmOf(F, 'L').lerp(palmOf(F, 'R'), 0.5); LT.sheet.position.copy(m).addScaledVector(P.toWorldDir(F, 0, 0, 1), -0.012); LT.sheet.lookAt(P.W_(F, 'head')); LT.sheet.updateMatrixWorld(true); return; }
    LT.packet.position.copy(palmOf(F, h.side)); LT.packet.quaternion.copy(P.yawQ(yawOf(F))).multiply(new THREE.Quaternion().setFromAxisAngle(new V3(1, 0, 0), h.tilt == null ? -0.9 : h.tilt)); LT.packet.updateMatrixWorld(true);
  }
  // (a hand to a point: the palm on it, the fingers along `fing`, the elbow out and down)
  function handTo(F, sd, at, fing, palmN) {
    const sx = sd === 'L' ? 1 : -1, side = P.toWorldDir(F, 1, 0, 0), up = new V3(0, 1, 0);
    P.reach(F, sd, at.clone().addScaledVector(fing, -0.075 * P.sc(F)), side.clone().multiplyScalar(sx).addScaledVector(up, -0.8).normalize(), palmN || up.clone().negate(), fing);
  }
  // (the page held open before the chest, tipped back a little: each hand at a side edge, a little below the middle, the fingers along it
  // behind the page, the thumb before it. As the eyes go down it (prog), it comes up a little and nearer; and it's never quite still (t))
  function holdOpen(F, prog, t) {
    const sc = P.sc(F), fwd = P.toWorldDir(F, 0, 0, 1), side = P.toWorldDir(F, 1, 0, 0), up = new V3(0, 1, 0);
    const C = P.W_(F, 'chest').addScaledVector(fwd, (0.42 - 0.025 * prog) * sc).addScaledVector(up, 0.05 + 0.035 * prog);
    if (t) C.addScaledVector(side, 0.007 * Math.sin(t * 0.7) + 0.003 * Math.sin(t * 1.9)).addScaledVector(up, 0.008 * Math.sin(t * 0.53 + 1)).addScaledVector(fwd, 0.006 * Math.sin(t * 0.37 + 2));
    const tip = t ? 0.05 * Math.sin(t * 0.45) : 0;      // (and turned a touch, one hand then the other a little nearer)
    const hold = { at: {}, fing: {}, palm: {} };
    for (const [sd, sx] of [['L', 1], ['R', -1]]) { hold.at[sd] = C.clone().addScaledVector(side, sx * 0.07).addScaledVector(up, -0.03).addScaledVector(fwd, sx * tip * 0.07);
      hold.fing[sd] = fwd.clone().multiplyScalar(0.35).addScaledVector(side, -sx * 0.75).addScaledVector(up, 0.3).normalize(); hold.palm[sd] = side.clone().multiplyScalar(-sx).addScaledVector(fwd, -0.45).normalize();
      handTo(F, sd, hold.at[sd], hold.fing[sd], hold.palm[sd]); }
    F.root.updateMatrixWorld(true); return hold;
  }
  // (reading, each frame: his hands kept just where they hold it, whatever his breathing does; the page itself still, where it was when he
  // began, and the view on all of it: nothing moves while the words are written in)
  function reading() { const R = LT.reading, F = S[R.by].F; for (const sd of ['L', 'R']) handTo(F, sd, R.at[sd], R.fing[sd], R.palm[sd]); F.root.updateMatrixWorld(true); }
  const lieOn = (at, yaw) => { LT.holder = null; LT.packet.position.copy(at); LT.packet.quaternion.copy(P.yawQ(yaw + 0.2)); LT.packet.updateMatrixWorld(true); };

  // ── The acts ──
  const ACTS = {
    // Adela, through the archway from the passage to her mark: a few steps, then still, her hands clasped, her eyes down.
    adelaIn(fast) {
      const s = S.adela, sp = spotOf('adela'), from = sp.at.clone().addScaledVector(fwdOf(sp), -((s.c.enter && s.c.enter.back) || 1.6));
      s.F.root.visible = true;
      return walkTo(s, [from, sp.at.clone()], sp.yaw, fast, 0.62);
    },
    // ── And for any scene: walk a way (b.path: spots), sit (b.at: a seat), stand (where they are, or b.at), turned to b.face (someone, or a
    // spot: b.toward); the room's door to b.to (0 shut, 1 open); her hands to the lacing at the front of her bodice ──
    walk(fast, b) { const s = S[b.by], pts = b.path.map(k => spots[k].at.clone()); s.F.root.visible = true; return walkTo(s, pts, faceYaw(pts[pts.length - 1], b.toward, pts, b.by), fast, b.speed); },
    sit(fast, b) { const s = S[b.by]; return after(s, () => blendTo(s, () => seatAt(s, spots[b.at]), b.ms || 1000, fast)); },
    stand(fast, b) { const s = S[b.by]; return after(s, () => { const at = b.at ? spots[b.at].at.clone() : s.F.root.position.clone().setY(0); return blendTo(s, () => standAt(s, at, faceYaw(at, b.toward, null, b.by)), b.ms || 1000, fast); }); },
    door(fast, b) { const D = b.which && room.doors ? room.doors[b.which] : room.door; return D ? D.to(b.to, fast ? 0 : (b.ms || 1000)) : null; },
    unlace(fast, b) {
      const s = S[b.by], F = s.F;
      return blendTo(s, () => {
        standAt(s, F.root.position.clone().setY(0), yawOf(F)); const ch = P.W_(F, 'chest'), fw = P.toWorldDir(F, 0, 0, 1), sd = P.toWorldDir(F, 1, 0, 0), up = new V3(0, 1, 0), sc = P.sc(F);
        for (const [side, sx] of [['L', 1], ['R', -1]]) P.reach(F, side, ch.clone().addScaledVector(fw, 0.13 * sc).addScaledVector(up, (sx > 0 ? -0.06 : -0.1) * sc).addScaledVector(sd, sx * 0.05 * sc),
          sd.clone().multiplyScalar(sx).addScaledVector(up, -0.7).normalize(), fw.clone().negate(), up.clone().addScaledVector(sd, -sx * 0.6).normalize());
        F.grip('L', 0.55, 0.05, 0.5); F.grip('R', 0.55, 0.05, 0.5);
      }, b.ms || 1100, fast);
    },
    // ── The letter: laid on something (b.at, a point) by whoever has it; taken up from where it lies; opened and held up to read; read ──
    lay(fast, b) {
      const s = S[b.by], F = s.F, at = point(b.at), yaw = yawOf(F), pos = F.root.position.clone().setY(0);
      if (fast) { lieOn(at, yaw); standAt(s, pos, yaw); return null; }
      LT.holder = { id: b.by, side: 'R', tilt: -0.15 };
      return blendTo(s, () => { standAt(s, pos, yaw); s.F.bone.spine.rotation.x += 0.16; s.F.bone.chest.rotation.x += 0.08; F.root.updateMatrixWorld(true);
        handTo(F, 'R', at.clone().setY(at.y + 0.01), P.toWorldDir(F, 0, -0.25, 1).normalize()); F.grip('R', 0.2, 0.05, 0.2); }, 1000)
        .then(() => { lieOn(at, yaw); return blendTo(s, () => standAt(s, pos, yaw), 800); });
    },
    take(fast, b) {
      const s = S[b.by], F = s.F, at = LT.where(), yaw = yawOf(F), pos = F.root.position.clone().setY(0);
      const hold = () => { standAt(s, pos, yaw); handTo(F, 'R', P.W_(F, 'chest').addScaledVector(P.toWorldDir(F, 0, 0, 1), 0.3 * P.sc(F)).addScaledVector(new V3(0, 1, 0), -0.12), P.toWorldDir(F, -0.4, 0.3, 1).normalize(), P.toWorldDir(F, 0.6, 0.6, 0).normalize()); F.grip('R', 0.45, 0.05, 0.4); };
      if (fast) { LT.holder = { id: b.by, side: 'R', tilt: -1.2 }; hold(); keep(s); return null; }
      return blendTo(s, () => { standAt(s, pos, yaw); s.F.bone.spine.rotation.x += 0.2; s.F.bone.chest.rotation.x += 0.1; F.root.updateMatrixWorld(true);
        handTo(F, 'R', at.clone().setY(at.y + 0.012), P.toWorldDir(F, 0, -0.25, 1).normalize()); F.grip('R', 0.25, 0.05, 0.25); }, 900)
        .then(() => { LT.holder = { id: b.by, side: 'R', tilt: -1.2 }; return blendTo(s, hold, 800); });
    },
    // (the seal broken and the sheet unfolded: held up in both hands at its edges, before the chest, tipped back a little, to read)
    open(fast, b) {
      const s = S[b.by], F = s.F, yaw = yawOf(F), pos = F.root.position.clone().setY(0);
      if (!fast && ui.sfx) ui.sfx('paper');
      LT.open = true; LT.packet.visible = false; LT.sheet.visible = true; LT.holder = { id: b.by }; s.look = 'letter';
      return blendTo(s, () => { standAt(s, pos, yaw); holdOpen(F, 0, 0); F.grip('L', 0.12, 0.25, 0.3); F.grip('R', 0.12, 0.25, 0.3); }, fast ? 0 : 1100, fast);
    },
    // (the view cut to it, as he sees it, the whole page in it and still; and its text written in. A click or a key: all of it at once)
    read(fast, b) {
      if (ui.clear) ui.clear(); const F = S[b.by].F;
      LT.reading = Object.assign({ by: b.by }, holdOpen(F, 0, 0)); placeLetter();      // (the page as he holds it: from here on, still)
      // (before his eyes, nearer the page than the orbit's own limit, a little wider than the camera's usual: all of the page, with a margin)
      const cam = stage.camera; if (LT.fov0 == null) LT.fov0 = cam.fov; cam.fov = b.fov || 58; cam.updateProjectionMatrix();
      if (stage.controls && LT.minD == null) { LT.minD = stage.controls.minDistance; stage.controls.minDistance = 0.1; }
      const C = LT.sheet.getWorldPosition(new V3()), n = new V3(0, 0, 1).applyQuaternion(LT.sheet.getWorldQuaternion(new THREE.Quaternion()));
      stage.go(C.clone().addScaledVector(n, b.dist || 0.33), C, 0);
      if (fast) { LT.draw(LT.total); return null; }
      return new Promise(res => { LT.write = { n: 0, rate: b.rate || 38, done: res }; if (ui.hurry) ui.hurry(() => { if (LT.write) LT.write.n = LT.total; }); });
    },
    // (the letter put down: folded again, in his hand before him, and the view back as it was)
    lower(fast, b) {
      const s = S[b.by], F = s.F, yaw = yawOf(F), pos = F.root.position.clone().setY(0);
      LT.reading = null; LT.write = null; LT.draw(LT.total); LT.unwiden(); LT.open = false; LT.sheet.visible = false; LT.packet.visible = true; LT.holder = { id: b.by, side: 'R', tilt: -1.2 }; s.look = undefined;
      const hold = () => { standAt(s, pos, yaw); handTo(F, 'R', P.W_(F, 'hips').addScaledVector(P.toWorldDir(F, 0, 0, 1), 0.2 * P.sc(F)).addScaledVector(P.toWorldDir(F, -1, 0, 0), 0.08), P.toWorldDir(F, -0.2, -0.4, 1).normalize(), P.toWorldDir(F, 0.6, 0.5, 0).normalize()); F.grip('R', 0.45, 0.05, 0.4); };
      return blendTo(s, hold, b.ms || 900, fast);
    },
    // (turned where they stand, to someone or a spot (b.toward))
    turn(fast, b) { const s = S[b.by]; return after(s, () => { const at = s.F.root.position.clone().setY(0); return blendTo(s, () => standAt(s, at, faceYaw(at, b.toward, null, b.by)), b.ms || 800, fast); }); },
    // (gone: off through the door, out of the scene)
    gone(fast, b) { const s = S[b.by]; return after(s, () => { s.F.root.visible = false; }); },
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
    if (LT && LT.write) { const w = LT.write; w.n = Math.min(LT.total, w.n + w.rate * dt); LT.draw(w.n); if (w.n >= LT.total) { LT.write = null; w.done(); } }
    for (const id in S) {
      const s = S[id], F = s.F; if (!F.root.visible) continue;      // (off: not there at all, cloth included, till they come on)
      if (s.walk && s.walk.gait) { const w = s.walk, r = w.gait.step(dt); w.d = r.d;
        const g = w.segs.find(q => w.d <= q.at + q.d) || w.segs[w.segs.length - 1], at = g.a.clone().lerp(g.b, Math.min(1, (w.d - g.at) / Math.max(1e-6, g.d))), want = yawTo(g.a, g.b);
        let dy = want - w.yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); w.yaw += dy * (1 - Math.exp(-dt * 6));
        F.root.position.copy(at); F.root.quaternion.copy(P.yawQ(w.yaw)); F.root.updateMatrixWorld(true); keep(s);
        if (r.done) w.done(); }
      else if (s.walk) { const w = s.walk; w.d = Math.min(w.len, w.d + w.speed * dt);
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
    if (LT) { if (LT.reading && S[LT.reading.by]) reading(); else placeLetter(); }
  }
  const face = (id, f) => { const s = S[id]; if (!s || !f) return; s.F.setExpr(f); s.mo0 = s.F.exprTo.mo || 0; };
  function shotTo(name, ms) { const sh = root.Prologue.shot(scene, name, spots); if (sh) stage.go(v3(sh.cam), v3(sh.look), ms || 0); }

  // ── A beat ──
  async function beat(b, fast, hold) {
    if (b.name) { for (const k in b.name) names[k] = fill(b.name[k]); if (ui.names) ui.names(names); }
    if (b.look) for (const id in b.look) if (S[id]) S[id].look = b.look[id] === null ? undefined : b.look[id];
    if (b.listen) for (const id in b.listen) face(id, b.listen[id]);
    let wait = null;
    if (b.sfx && !fast && ui.sfx) ui.sfx(b.sfx);
    if (b.clear && ui.clear) ui.clear();      // (what was last said, away: no one's speaking now)
    if (b.act && ACTS[b.act]) wait = ACTS[b.act](fast, b);
    if (b.wait === false) wait = null;      // (done while the line's said)
    if (b.shot) { shotTo(b.shot, b.glide); if (b.push && !fast) { const to = b.push, ms = b.ms || 9000; setTimeout(() => { if (!stopped) shotTo(to, ms); }, 30); } }
    if (fast) { if (b.act === 'bow') S.silas.bow = 1; if (b.act === 'nod') S.master.nod = 0; return; }      // (the bow all the way down; the nod over)
    if (wait) await wait;
    if (stopped) return;
    if (b.who) {
      face(b.who, b.face);
      for (const id in S) S[id].auto = id === b.who ? (b.to || null) : (S[id].c.demure && b.to !== id ? null : b.who);
      const text = fill(b.text); speaking = b.think ? null : b.who; talkUntil = now + text.length * TYPE_MS + 150;      // (a thought: his mouth still)
      await ui.line({ id: b.who, name: names[b.who] || b.who, text, ms: text.length * TYPE_MS, hold: b.hold || hold, thought: !!b.think });
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
    // (lines of inquiry: the player takes them in any order, each once, and the scene goes on only when every one's been taken; each one's last
    // line has the choices left come up under it. Skipped past: none of it)
    if (b.talk && !fast) {
      const T = b.talk; let left = T.options.slice(), first = true;
      while (left.length && !stopped) {
        const id = await ui.choose({ id: ME, name: names[ME], prompt: first && T.prompt ? fill(T.prompt) : null, hint: first ? T.hint || '' : '', options: left.map(q => ({ id: q.id, label: fill(q.label) })) });
        const opt = left.find(q => q.id === id) || left[0]; left = left.filter(q => q !== opt); first = false;
        for (const [i, x] of opt.beats.entries()) { if (stopped) return; await beat(x, fast, i === opt.beats.length - 1 && left.length ? 'choices' : undefined); }
      }
    }
    if (b.pause && !stopped) await (ui.pause ? ui.pause(b.pause) : sleep(b.pause));
    if (b.click && !fast && !stopped) await (ui.click ? ui.click() : sleep(2500));
    if (b.button && !fast && !stopped) await (ui.button ? ui.button(fill(b.button)) : sleep(2500));      // (theirs to do: a button at the foot of the view)
    if (b.end) await ui.fade(true);
  }
  // Played from the start (or from beat `from`, everything before it done at once: who's where, what they're called, what they look like).
  async function play(from) {
    from = from || 0; stopped = false;
    for (const id in S) place(id); if (LT) LT.reset();
    for (let i = 0; i < from && i < scene.beats.length; i++) await beat(scene.beats[i], true);
    if (ui.names) ui.names(names);
    try { for (let i = from; i < scene.beats.length; i++) { if (stopped) return false; await beat(scene.beats[i], false); } }
    finally { if (LT) { LT.reading = null; LT.unwiden(); } }      // (the camera as it was, once it's over or skipped: the scene's ended in black)
    return !stopped;
  }
  // (before the scene, behind the title: anyone who comes on walking stood where they'll start from, and the cloth they wear settled there, out
  // of sight; so when they come on, nothing's to settle, and nothing waits on it)
  function prewarm() {
    for (const id in S) { const s = S[id], c = s.c; if (!c.off || !c.enter) continue;
      const sp = spotOf(id), from = c.enter.from ? spots[c.enter.from].at.clone() : sp.at.clone().addScaledVector(fwdOf(sp), -(c.enter.back || 1.6));
      standAt(s, from, c.enter.from ? spots[c.enter.from].yaw : sp.yaw); s.F.root.visible = true; s.F.tick(1 / 30); s.F.tick(1 / 30); s.F.root.visible = false; }
  }
  return { play, tick, prewarm, place: () => { for (const id in S) place(id); if (LT) LT.reset(); if (scene.start && scene.start.door != null && room.door) room.door.set(scene.start.door); },
    dispose() { if (LT) { LT.reading = null; LT.write = null; LT.unwiden(); stage.scene.remove(LT.packet); stage.scene.remove(LT.sheet); } }, stop: () => { stopped = true; }, get names() { return names; }, chosen, S, spots, shotTo };
}

root.Cutscene = { create, TYPE_MS };
})(typeof window !== 'undefined' ? window : globalThis);
