// Fenwick Hall — walking where the player steers (Ch. 1 on: the Hall and its grounds explored on foot). Silas walks as Gait.roam walks him,
// steered by the keys (WASD or the arrows) relative to the view, which follows him (drag to look round, scroll to come closer). He's kept to
// the room's walkable areas (room.walk: areas; doorways, each passable only while its door's open; blocks, what's in the way). Things near
// him to look at or do (things: { id, at (a point), reach, label (or a function), when(), act() → Promise }) are offered at the foot of the
// view; E (or Enter) does it. While one's being done, he waits.
//   const R = Roam.create({ stage, room, figure, things, ui: { prompt(text | null) }, style })  ·  R.start(at, yaw)  ·  R.tick(dt) each frame
//   ·  R.use()  ·  R.place(at, yaw)  ·  R.stop()  ·  R.pos  ·  R.busy  ·  R.held (true: no walking, the menu's open or a scene's playing)
(function (root) {
'use strict';
const THREE = root.THREE, V3 = THREE.Vector3, P = root.Poses;
const KEYS = { w: 'f', W: 'f', ArrowUp: 'f', s: 'b', S: 'b', ArrowDown: 'b', a: 'l', A: 'l', ArrowLeft: 'l', d: 'r', D: 'r', ArrowRight: 'r' };
const R0 = 0.24;      // (how much room he takes: a circle this wide about his feet)
const SIDE = 0.42, ARM = 3.0;      // (the view's centre, this far to his right: over his shoulder; and the view this far back from it)

function create(o) {
  const { stage, room, figure: F, ui } = o, things = o.things || [], cam = stage.camera, ctl = stage.controls;
  const keys = { f: 0, b: 0, l: 0, r: 0 };
  let on = false, held = false, busy = false, pos = new V3(), yaw = 0, gait = null, fade = null, near = null, moving = false, headY = 0;
  let arm = ARM, cur = ARM, lastD = null, lift = 0;      // (the view's distance: as the player would have it, as it is, as it was last set; and
  // how far it's been raised, drawn in, to see over him)
  const onDown = e => { const k = KEYS[e.key]; if (!on || !k || (e.target.closest && e.target.closest('input, textarea'))) return; keys[k] = 1; e.preventDefault(); };
  const onUp = e => { const k = KEYS[e.key]; if (k) keys[k] = 0; };
  const onBlur = () => { for (const k in keys) keys[k] = 0; };

  // ── Where he may stand: in a walkable area (clear of its walls), or a doorway whose door is open; and not in anything ──
  const W = room.walk;
  const inRect = (r, x, z, m) => x > r.x0 + m && x < r.x1 - m && z > r.z0 + m && z < r.z1 - m;
  const doorOpen = d => !d.door || (room.doors && room.doors[d.door] && room.doors[d.door].k > 0.6);
  function free(x, z) {
    const inside = W.areas.some(a => inRect(a, x, z, R0)) || W.doorways.some(d => doorOpen(d) && inRect(d, x, z, 0));
    return inside && !W.blocks.some(b => inRect(b, x, z, -R0));
  }
  // ── Standing still: as he stands, the arms easy; crossfaded from the stride, and into it ──
  const snap = () => F.bones.map(b => [b.quaternion.clone(), b.position.clone()]);
  const mix = (S, e) => { F.bones.forEach((b, i) => { const q = b.quaternion.clone(), p = b.position.clone(); b.quaternion.copy(S[i][0]).slerp(q, e); b.position.lerpVectors(S[i][1], p, e); }); F.root.updateMatrixWorld(true); };
  const stand = () => { P.stand(F, pos, yaw, { weight: 0.3, look: 0.06 }); };

  function start(at, y) {
    pos.copy(at).setY(0); yaw = y || 0; on = true; held = false; busy = false; near = null; moving = false;
    gait = root.Gait && root.Gait.ready ? root.Gait.roam(F, { style: o.style || 'silas' }) : null;
    F.root.visible = true; place(at, y);
    ctl.enabled = true; o.minD = ctl.minDistance; o.maxD = ctl.maxDistance; ctl.minDistance = 0.3; ctl.maxDistance = 5;      // (near, as a wall may bring it)
    addEventListener('keydown', onDown); addEventListener('keyup', onUp); addEventListener('blur', onBlur);
  }
  // (set down here, facing so; the view over his right shoulder, behind him and a little above, so he's to one side of what's ahead: the
  // player's to turn from there)
  function place(at, y) {
    pos.copy(at).setY(0); if (y != null) yaw = y; fade = null; stand();
    const fwd = new V3(Math.sin(yaw), 0, Math.cos(yaw)), head = pos.clone().add(new V3(0, 1.45, 0));
    stage.go(head.clone().addScaledVector(fwd, -ARM).add(new V3(0, 0.5, 0)), head, 0); arm = cur = ARM; lastD = null; lift = 0; follow(0, true);
  }
  // ── The view: wherever the player's turned it, it follows him, its centre a little to the right of him on screen; kept within the rooms
  // (drawn in along its line to him if it would be through a wall, and eased back out once it can be) and under the ceiling ──
  const inRooms = (x, z, m) => W.areas.some(a => inRect(a, x, z, m)) || W.doorways.some(d => inRect(d, x, z, 0));
  const ceilAt = (x, z) => { const a = W.areas.find(a => inRect(a, x, z, 0)); return a && a.ht ? a.ht : 9; };
  function follow(dt, snapTo) {
    cam.position.y -= lift; lift = 0;
    const off = cam.position.clone().sub(ctl.target), d = off.length() || 1, dir = off.divideScalar(d);
    if (lastD != null && Math.abs(d - lastD) > 0.03) arm = cur = Math.max(0.8, Math.min(5, d));      // (the player's drawn it in or out)
    const rt = new V3(dir.z, 0, -dir.x).normalize(), tgt = pos.clone().add(new V3(0, 1.45, 0)).addScaledVector(rt, SIDE * Math.max(0, Math.min(1, (cur - 0.8) / 1.6)));
    // (how far back it can be, along its line, before it's through a wall)
    const at = m => inRooms(tgt.x + dir.x * m, tgt.z + dir.z * m, 0.12);
    let room = arm; if (!at(arm)) { let lo = 0, hi = arm; for (let i = 0; i < 12; i++) { const m = (lo + hi) / 2; if (at(m)) lo = m; else hi = m; } room = lo; }
    cur = snapTo || room < cur ? room : cur + (room - cur) * (1 - Math.exp(-dt * 3));
    ctl.target.copy(tgt); cam.position.copy(tgt).addScaledVector(dir, cur);
    const top = ceilAt(cam.position.x, cam.position.z) - 0.25; if (cam.position.y > top) cam.position.y = top;
    lastD = cam.position.distanceTo(tgt);
    // (drawn in by a wall, raised a little too, to look over him rather than into his back)
    lift = Math.min(Math.max(0, arm - cur) * 0.45, Math.max(0, top - cam.position.y)); cam.position.y += lift;
    // (drawn in so close it would be inside him: he's not shown till it's back out)
    F.root.visible = Math.hypot(cam.position.x - pos.x, cam.position.z - pos.z) > 0.5 || cam.position.y > pos.y + 2.1;
  }
  function stop() {
    on = false; for (const k in keys) keys[k] = 0; if (ui.prompt) ui.prompt(null); if (F) F.root.visible = true;
    removeEventListener('keydown', onDown); removeEventListener('keyup', onUp); removeEventListener('blur', onBlur);
    if (o.minD != null) { ctl.minDistance = o.minD; ctl.maxDistance = o.maxD; } ctl.enabled = false;
  }
  // (the nearest thing he can do something with: in reach, roughly before him, and wanted now)
  function nearest() {
    let best = null, bd = Infinity; const fwd = new V3(Math.sin(yaw), 0, Math.cos(yaw));
    for (const t of things) {
      if (t.when && !t.when()) continue; const at = typeof t.at === 'function' ? t.at() : t.at; if (!at) continue;
      const d = new V3(at.x - pos.x, 0, at.z - pos.z), dist = d.length(); if (dist > (t.reach || 1.4)) continue;
      const facing = dist < 0.5 ? 1 : d.normalize().dot(fwd); if (facing < -0.1) continue;
      const score = dist - 0.6 * facing; if (score < bd) { bd = score; best = t; }
    }
    return best;
  }
  async function use() {
    if (!on || busy || held || !near) return; const t = near; busy = true; if (ui.prompt) ui.prompt(null);
    for (const k in keys) keys[k] = 0;
    try { await t.act(); } finally { busy = false; }
  }
  function tick(dt) {
    if (!on) return;
    // (steered: the keys, relative to the view; turned toward the way he's going, and carried along it by his stride)
    const ix = keys.r - keys.l, iz = keys.f - keys.b, want = !held && !busy && (ix || iz);
    let dir = null;
    if (want) { const c = new V3().subVectors(ctl.target, cam.position).setY(0).normalize(), rt = new V3(-c.z, 0, c.x); dir = c.multiplyScalar(iz).addScaledVector(rt, ix).normalize();
      let dy = Math.atan2(dir.x, dir.z) - yaw; dy = Math.atan2(Math.sin(dy), Math.cos(dy)); yaw += dy * (1 - Math.exp(-dt * 9)); }
    const was = moving, pre = want && !moving ? snap() : null; let d = 0;      // (setting off: his standing pose, to ease out of)
    if (gait) { const r = gait.step(dt, !!want); moving = r.moving; d = r.d; } else { moving = !!want; d = moving ? 1.1 * dt : 0; }
    if (moving) {
      const fwd = new V3(Math.sin(yaw), 0, Math.cos(yaw)), nx = pos.x + fwd.x * d, nz = pos.z + fwd.z * d;
      if (free(nx, nz)) pos.set(nx, 0, nz); else if (free(nx, pos.z)) pos.x = nx; else if (free(pos.x, nz)) pos.z = nz;
      if (!gait) stand(); else { F.root.position.copy(pos); F.root.quaternion.copy(P.yawQ(yaw)); F.root.updateMatrixWorld(true); }
      if (!was && pre) fade = { S: pre, t: 0, ms: 260 };
    } else { if (was) fade = { S: snap(), t: 0, ms: 320 }; stand(); }
    if (fade) { fade.t += dt * 1000; const e = Math.min(1, fade.t / fade.ms); mix(fade.S, e * e * (3 - 2 * e)); if (e >= 1) fade = null; }
    // (his head turned a little toward what's near him)
    near = !busy && !held ? nearest() : null;
    const at = near && (typeof near.at === 'function' ? near.at() : near.at);
    let hy = 0; if (at) { const d2 = new V3(at.x - pos.x, 0, at.z - pos.z); hy = Math.atan2(d2.x, d2.z) - yaw; hy = Math.max(-0.9, Math.min(0.9, Math.atan2(Math.sin(hy), Math.cos(hy)))); }
    headY += (hy - headY) * (1 - Math.exp(-dt * 4)); F.bone.neck.rotation.y += 0.7 * headY; F.bone.chest.rotation.y += 0.2 * headY; F.root.updateMatrixWorld(true);
    if (ui.prompt) ui.prompt(near ? (typeof near.label === 'function' ? near.label() : near.label) : null);
    F.tick(dt);
    follow(dt);
  }
  return { start, stop, tick, use, place, get pos() { return pos; }, get yaw() { return yaw; }, set yaw(v) { yaw = v; }, get busy() { return busy; }, get held() { return held; }, set held(v) { held = !!v; }, get near() { return near; }, things, free };
}

root.Roam = { create };
})(typeof window !== 'undefined' ? window : globalThis);
