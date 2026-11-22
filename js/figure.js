// Fenwick Hall — the figures: real adult proportions (about 7.5 heads tall) on a full skeleton (pelvis, two spine joints, neck, head; clavicle,
// shoulder, elbow, wrist, fingers and thumb; hip, knee, ankle, toes), skinned so every joint bends as one continuous surface. Rendered in a stylised,
// painterly way: simplified chunky forms, soft shading with a painted grain, no outlines. Everything is built in code.
//
// Units are metres; a figure faces +z, up is +y, their left is +x. Every bone's rest frame is aligned with the world, and limbs run down their bone's -y,
// so: thighs and upper arms swing forward for a negative turn about x, elbows bend forward for a negative turn, knees back for a positive one.
//
//   const f = Figure.make({ sex: 'f', height: 1.70, mass: 0.4, fat: 0.4, skin, hair, hairStyle, eyes, beard, outfit: 'uniform', dept: '#d8a040' })
//   f.root · f.bone.hips … · f.setClothes({ top: 'down'|'up', bottoms: 'up'|'down', under: 'up'|'down' }) · f.setExpr('wince') · f.tick(dt)
//   f.spots: the seat's mark spots (L/R × cheek, sitspot, thighs) · f.mark(spot, amount) · f.surface(spot, out) → { p, n } in world space
(function (root) {
'use strict';
const THREE = root.THREE, V3 = THREE.Vector3;
const clamp = (x, a, b) => Math.max(a, Math.min(b, x)), lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gauss = (d, s) => Math.exp(-(d * d) / (2 * s * s));
const srgb = h => new THREE.Color(h).convertSRGBToLinear();
const angDiff = (a, b) => { let d = a - b; while (d > Math.PI) d -= 2 * Math.PI; while (d < -Math.PI) d += 2 * Math.PI; return d; };
function shade(hex, k) {
  const n = parseInt(hex.slice(1), 16), ch = [n >> 16, (n >> 8) & 255, n & 255].map(v => Math.round(k >= 0 ? v + (255 - v) * k : v * (1 + k)));
  return '#' + ch.map(v => clamp(v, 0, 255).toString(16).padStart(2, '0')).join('');
}

// ── Painted materials ────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// A soft grain of value noise in object space (so it rides with the figure), a gentle wrap to the light so shadows stay warm and soft rather than
// black, and optionally: skin regions hidden under clothes (so nothing pokes through), and the marks on the seat.
// Garment details drawn per pixel from each point's rest-pose position (vBind), so seams, edges, bands and buttons stay crisp at any size.
// uPat0..2: their colours; uParam: per garment (tunic: hem, raised, shoulder x, uniform?; trousers: –, lowered, leg centre x, uniform?).
// vPart: which piece a point is on (the tunic's body 0, its sleeves 1).
const PATTERNS = {
  tunic: `{
  vec3 b = vBind; float ax = abs(b.x), hem = uParam.x, up = uParam.y, shX = uParam.z;
  if (uParam.w > 0.5) {
    if (vPart < 0.5) {
      float lx = mix(-0.07, 0.13, clamp((1.47 - b.y) / 0.57, 0.0, 1.0)), d = b.x - lx;
      float front = smoothstep(0.005, 0.03, b.z), inY = step(hem + 0.008, b.y) * (1.0 - smoothstep(1.478, 1.482, b.y));
      diffuseColor.rgb *= 1.0 - 0.2 * front * inY * smoothstep(-0.032, -0.004, d) * (1.0 - smoothstep(-0.0035, -0.0015, d));
      diffuseColor.rgb = mix(diffuseColor.rgb, uPat1, front * inY * (1.0 - smoothstep(0.0012, 0.0028, abs(d + 0.0005))));
      float belt = smoothstep(0.994, 0.997, b.y) * (1.0 - smoothstep(1.031, 1.034, b.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, uPat2, belt);
      float bk = belt * front * (1.0 - smoothstep(0.016, 0.019, abs(b.x - 0.02)));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.28, 0.24), bk * 0.9);
      diffuseColor.rgb *= 1.0 - 0.28 * smoothstep(1.511, 1.515, b.y);
      diffuseColor.rgb *= 1.0 - 0.25 * (1.0 - up) * (1.0 - smoothstep(hem + 0.009, hem + 0.012, b.y));
    } else {
      float flash = step(0.0, b.x) * smoothstep(1.278, 1.281, b.y) * (1.0 - smoothstep(1.366, 1.369, b.y)) * smoothstep(shX + 0.008, shX + 0.014, b.x);
      float cuff = smoothstep(0.894, 0.897, b.y) * (1.0 - smoothstep(0.912, 0.915, b.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, uPat0, max(flash, cuff));
    }
  } else if (vPart < 0.5) {
    float fr = smoothstep(0.03, 0.05, b.z);
    diffuseColor.rgb *= 1.0 - 0.3 * fr * (1.0 - smoothstep(0.009, 0.011, ax)) * smoothstep(1.31, 1.313, b.y);
    for (int i = 0; i < 3; i++) { float bd = length(vec2(b.x, b.y - (1.36 + 0.035 * float(i)))); diffuseColor.rgb = mix(diffuseColor.rgb, uPat1, fr * (1.0 - smoothstep(0.0035, 0.0048, bd))); }
    diffuseColor.rgb *= 1.0 - 0.22 * (1.0 - up) * (1.0 - smoothstep(hem + 0.009, hem + 0.012, b.y));
  }
}`,
  trousers: `{
  vec3 b = vBind; float ax = abs(b.x);
  if (uParam.w > 0.5 && uParam.y < 0.5) {
    float front = smoothstep(0.01, 0.03, b.z), kn = front * smoothstep(0.398, 0.402, b.y) * (1.0 - smoothstep(0.598, 0.602, b.y));
    diffuseColor.rgb *= 1.0 - 0.16 * kn;
    float seam = front * (1.0 - smoothstep(0.0008, 0.0022, min(abs(b.y - 0.4), abs(b.y - 0.6))));
    diffuseColor.rgb *= 1.0 + 0.4 * seam;
  }
  if (uParam.w < 0.5 && b.y < 0.9) diffuseColor.rgb = mix(diffuseColor.rgb, uPat0, (1.0 - smoothstep(0.0025, 0.0045, abs(b.z))) * step(uParam.z + 0.03, ax));
  diffuseColor.rgb *= 1.0 - 0.18 * smoothstep(1.004, 1.007, b.y) * (1.0 - uParam.y);
}`,
};
// The same details on the Blender-built clothes, placed by the body's landmarks (uL0, uL1) rather than fixed heights.
// tunicG: uParam (hem, raised, shoulder x, uniform?), uL0 (–, –, collar, waist), uL1 (shoulder y, armpit y, cuff y, neckline). vPart: sleeve 1.
// trousersG: uParam (–, lowered, leg centre x, uniform?), uL0 (knee, waist top).
PATTERNS.tunicG = `{
  vec3 b = vBind; float ax = abs(b.x), hem = uParam.x, up = uParam.y, shX = uParam.z, collar = uL0.z, waist = uL0.w, shY = uL1.x, pit = uL1.y, cuffY = uL1.z, nl = uL1.w;
  if (uParam.w > 0.5) {
    if (vPart < 0.5) {
      float yTop = collar - 0.04, lx = mix(-0.065, 0.115, clamp((yTop - b.y) / (yTop - hem), 0.0, 1.0)), d = b.x - lx;
      float front = smoothstep(0.005, 0.03, b.z), inY = step(hem + 0.006, b.y) * (1.0 - smoothstep(yTop - 0.002, yTop + 0.002, b.y));
      diffuseColor.rgb *= 1.0 - 0.2 * front * inY * smoothstep(-0.032, -0.004, d) * (1.0 - smoothstep(-0.0035, -0.0015, d));
      diffuseColor.rgb = mix(diffuseColor.rgb, uPat1, front * inY * (1.0 - smoothstep(0.0012, 0.0028, abs(d + 0.0005))));
      float belt = smoothstep(waist - 0.034, waist - 0.031, b.y) * (1.0 - smoothstep(waist + 0.003, waist + 0.006, b.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, uPat2, belt);
      float bk = belt * front * (1.0 - smoothstep(0.016, 0.019, abs(b.x - 0.02)));
      diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.3, 0.28, 0.24), bk * 0.9);
      diffuseColor.rgb *= 1.0 - 0.28 * smoothstep(collar - 0.018, collar - 0.014, b.y);
      diffuseColor.rgb *= 1.0 - 0.25 * (1.0 - up) * (1.0 - smoothstep(hem + 0.009, hem + 0.012, b.y));
    } else {
      float flash = step(0.0, b.x) * smoothstep(pit + 0.03, pit + 0.033, b.y) * (1.0 - smoothstep(shY + 0.012, shY + 0.015, b.y)) * smoothstep(shX + 0.022, shX + 0.03, b.x);
      float cuff = smoothstep(cuffY + 0.004, cuffY + 0.007, b.y) * (1.0 - smoothstep(cuffY + 0.022, cuffY + 0.025, b.y));
      diffuseColor.rgb = mix(diffuseColor.rgb, uPat0, max(flash, cuff));
    }
  } else {
    // Off duty. uL0.x: which: 0 Silas's henley (bone buttons down the placket); 2 a thermal (heathered, ribbed cuffs and hem, a coloured
    // thread at the left cuff); 3 a printed shirt open over a tee (the tee down the front between its edges and on the forearms below its
    // short sleeves); 4 a waistcoat over a shirt (the shirt in the V, below the hem, in the armholes and on the sleeves; buttons; uL0.y: a
    // scarf at the collar); 5 a cable-knit cardigan over a collared shirt (the shirt in the V and its collar above); 6 a printed tee; 7 a
    // knitted sweater vest over a shirt (down to the hem, ribbed edges; uL0.y: a scarf).
    // uPat0: accent, uPat1: the shirt beneath, uPat2: the print (or buttons).
    float st = uL0.x, sl = vPart, fr = smoothstep(0.03, 0.05, b.z), sx = b.x >= 0.0 ? 1.0 : -1.0, gk = 1.0 + uGrain * (g - 0.5) * 2.0;
    float axX = shX + (shY - b.y) * 0.23, elbow = mix(shY, cuffY, 0.5);
    vec2 uv = sl > 0.5 ? vec2(atan(b.x - sx * axX, b.z + 0.005) * 0.045, b.y) : vec2(atan(b.x, b.z + 0.01) * 0.13, b.y);
    vec3 under = uPat1 * gk;
    if (st < 0.5) {
      if (sl < 0.5) {
        float pTop = nl - 0.03;
        diffuseColor.rgb *= 1.0 - 0.3 * fr * (1.0 - smoothstep(0.009, 0.011, ax)) * smoothstep(pTop - 0.13, pTop - 0.127, b.y);
        for (int i = 0; i < 3; i++) { float bd = length(vec2(b.x, b.y - (pTop - 0.025 - 0.035 * float(i)))); diffuseColor.rgb = mix(diffuseColor.rgb, uPat1, fr * (1.0 - smoothstep(0.0035, 0.0048, bd))); }
      }
    } else if (st < 2.5) {
      diffuseColor.rgb *= 0.9 + 0.2 * fn3(b * 700.0);
      if (sl > 0.5) {
        float cuff = 1.0 - smoothstep(cuffY + 0.045, cuffY + 0.05, b.y), rib = 0.5 + 0.5 * sin(uv.x * 900.0);
        diffuseColor.rgb *= 1.0 - 0.14 * cuff * rib;
        diffuseColor.rgb = mix(diffuseColor.rgb, uPat0, step(0.0, b.x) * seamAt(b.y - cuffY - 0.04, 0.003));
      } else diffuseColor.rgb *= 1.0 - 0.12 * (1.0 - smoothstep(hem + 0.04, hem + 0.045, b.y)) * (0.5 + 0.5 * sin(uv.x * 900.0));
    } else if (st < 3.5) {
      float vein, lf = leafAt(uv, 15.0, vein);
      vec3 shirt = mix(diffuseColor.rgb, uPat2 * gk, lf); shirt = mix(shirt, uPat0 * gk, vein * 0.85);
      float w = 0.042 + 0.03 * smoothstep(collar - 0.13, collar - 0.03, b.y);      // (open down the front, the collar's points spread at the top)
      float open = sl < 0.5 ? (1.0 - smoothstep(w - 0.001, w + 0.001, ax)) * smoothstep(0.0, 0.02, b.z) : 0.0;
      float teeArm = sl > 0.5 ? 1.0 - smoothstep(elbow + 0.045, elbow + 0.05, b.y) : 0.0;
      diffuseColor.rgb = mix(shirt, under, max(open, teeArm));
      diffuseColor.rgb *= 1.0 - 0.45 * (sl < 0.5 ? seamAt(ax - w, 0.004) * smoothstep(0.0, 0.02, b.z) : seamAt(b.y - elbow - 0.0475, 0.004));
    } else if (st < 4.5) {
      // (the V from the collar's sides to a point on the chest, the hem a little below the waist, the armholes)
      float vTop = collar - 0.02, vBot = pit - 0.055, vw = 0.07 * clamp((b.y - vBot) / (vTop - vBot), 0.0, 1.0);
      float inV = (1.0 - smoothstep(vw - 0.001, vw + 0.001, ax)) * step(vBot, b.y) * smoothstep(0.0, 0.03, b.z);
      float hemV = waist - 0.05 - 0.02 * smoothstep(0.03, 0.0, ax) * fr, below = 1.0 - smoothstep(hemV - 0.001, hemV + 0.001, b.y);
      float hole = smoothstep(shX - 0.035, shX - 0.015, ax) * step(pit - 0.025, b.y);
      float vest = sl < 0.5 ? (1.0 - inV) * (1.0 - below) * (1.0 - hole) : 0.0;
      diffuseColor.rgb = mix(under, diffuseColor.rgb * (0.94 + 0.12 * fn3(b * 260.0)), vest);
      for (int i = 0; i < 4; i++) { float by = vBot - 0.018 - 0.042 * float(i); diffuseColor.rgb = mix(diffuseColor.rgb, uPat2, vest * fr * step(hemV + 0.01, by) * (1.0 - smoothstep(0.004, 0.0055, length(vec2(b.x, b.y - by))))); }
      if (sl < 0.5) diffuseColor.rgb *= 1.0 - 0.4 * max(seamAt(ax - vw, 0.004) * step(vBot, b.y) * fr, max(seamAt(b.y - hemV, 0.004), seamAt(ax - shX + 0.025, 0.004) * step(pit - 0.02, b.y))) * (1.0 - inV * 0.0);
      if (uL0.y > 0.5 && sl < 0.5) {
        float band = smoothstep(collar - 0.04, collar - 0.035, b.y);
        float tail = fr * (1.0 - smoothstep(0.011, 0.015, abs(b.x - 0.014 - (collar - 0.04 - b.y) * 0.12))) * step(collar - 0.16, b.y) * (1.0 - step(collar - 0.04, b.y));
        float knot = fr * (1.0 - smoothstep(0.012, 0.015, length(vec2(b.x - 0.012, b.y - collar + 0.045))));
        diffuseColor.rgb = mix(diffuseColor.rgb, uPat0 * (0.9 + 0.2 * fn3(b * 180.0)), max(max(band, tail), knot));
        diffuseColor.rgb *= 1.0 - 0.35 * fr * max(seamAt(length(vec2(b.x - 0.012, b.y - collar + 0.045)) - 0.0135, 0.003), seamAt(b.y - collar + 0.0375, 0.003));
      }
    } else if (st < 5.5) {
      float vBot = pit - 0.08, ow = 0.012 + 0.045 * clamp((b.y - vBot) / (collar - vBot), 0.0, 1.0);
      float open = sl < 0.5 ? (1.0 - smoothstep(ow - 0.001, ow + 0.001, ax)) * smoothstep(0.0, 0.02, b.z) * step(vBot, b.y) : 0.0;
      float col = smoothstep(collar - 0.032, collar - 0.026, b.y);
      float cable = sl < 0.5 ? 0.5 + 0.5 * sin(uv.x * 170.0 + 2.6 * sin(b.y * 95.0)) : 0.5 + 0.5 * sin(uv.x * 260.0);
      diffuseColor.rgb *= 0.88 + 0.16 * cable;
      float rib = sl > 0.5 ? 1.0 - smoothstep(cuffY + 0.05, cuffY + 0.055, b.y) : 1.0 - smoothstep(hem + 0.045, hem + 0.05, b.y);
      diffuseColor.rgb *= 1.0 - 0.1 * rib * (0.5 + 0.5 * sin(uv.x * 900.0));
      diffuseColor.rgb = mix(diffuseColor.rgb, under, max(open, col));
      if (sl < 0.5) {
        diffuseColor.rgb *= 1.0 - 0.4 * fr * max(seamAt(ax - ow, 0.004) * step(vBot, b.y), seamAt(b.x, 0.004) * step(b.y, vBot) * step(hem + 0.01, b.y));
        for (int i = 0; i < 5; i++) { float by = vBot - 0.012 - 0.05 * float(i); diffuseColor.rgb = mix(diffuseColor.rgb, uPat2, fr * step(hem + 0.02, by) * (1.0 - smoothstep(0.0045, 0.006, length(vec2(b.x - 0.008, b.y - by))))); }
        diffuseColor.rgb *= 1.0 - 0.4 * seamAt(b.y - collar + 0.029, 0.004);
      }
    } else if (st < 6.5) {
      float ctr, fl = flowerAt(uv, 36.0, ctr);
      diffuseColor.rgb = mix(diffuseColor.rgb, uPat2 * gk, fl); diffuseColor.rgb = mix(diffuseColor.rgb, uPat0 * gk, ctr * fl);
      if (sl < 0.5) diffuseColor.rgb *= 1.0 - 0.12 * smoothstep(nl - 0.02, nl - 0.012, b.y);
    } else {
      // a knitted sweater vest over a shirt: down to the top's own hem, a deep V at the neck and the armholes edged in rib, a ribbed hem band
      float vTop = collar - 0.02, vBot = pit - 0.07, vw = 0.07 * clamp((b.y - vBot) / (vTop - vBot), 0.0, 1.0);
      float inV = (1.0 - smoothstep(vw - 0.001, vw + 0.001, ax)) * step(vBot, b.y) * smoothstep(0.0, 0.03, b.z);
      float hole = smoothstep(shX - 0.04, shX - 0.02, ax) * step(pit - 0.035, b.y);
      float vest = sl < 0.5 ? (1.0 - inV) * (1.0 - hole) : 0.0;
      vec3 knit = diffuseColor.rgb * (0.9 + 0.12 * (0.5 + 0.5 * sin(uv.x * 700.0)));
      float vEdge = sl < 0.5 ? step(vBot - 0.01, b.y) * smoothstep(0.0, 0.03, b.z) * (1.0 - smoothstep(0.009, 0.011, ax - vw)) * step(vw - 0.001, ax) : 0.0;
      float hEdge = sl < 0.5 ? step(pit - 0.045, b.y) * (1.0 - smoothstep(0.009, 0.011, (shX - 0.03) - ax)) * step(ax, shX - 0.03) : 0.0;
      float band = sl < 0.5 ? max(max(vEdge, hEdge), 1.0 - smoothstep(hem + 0.045, hem + 0.05, b.y)) : 0.0;
      knit *= 1.0 - 0.14 * band * (0.5 + 0.5 * sin((vEdge > 0.5 ? b.y : uv.x) * 1100.0));
      diffuseColor.rgb = mix(under, knit, vest);
      if (sl < 0.5) diffuseColor.rgb *= 1.0 - 0.4 * max(seamAt(ax - vw, 0.004) * step(vBot, b.y) * fr, seamAt(ax - shX + 0.03, 0.004) * step(pit - 0.035, b.y));
      if (uL0.y > 0.5 && sl < 0.5) {
        float sband = smoothstep(collar - 0.04, collar - 0.035, b.y);
        float tail = fr * (1.0 - smoothstep(0.011, 0.015, abs(b.x - 0.014 - (collar - 0.04 - b.y) * 0.12))) * step(collar - 0.16, b.y) * (1.0 - step(collar - 0.04, b.y));
        float knot = fr * (1.0 - smoothstep(0.012, 0.015, length(vec2(b.x - 0.012, b.y - collar + 0.045))));
        diffuseColor.rgb = mix(diffuseColor.rgb, uPat0 * (0.9 + 0.2 * fn3(b * 180.0)), max(max(sband, tail), knot));
        diffuseColor.rgb *= 1.0 - 0.35 * fr * max(seamAt(length(vec2(b.x - 0.012, b.y - collar + 0.045)) - 0.0135, 0.003), seamAt(b.y - collar + 0.0375, 0.003));
      }
    }
    if (sl < 0.5) diffuseColor.rgb *= 1.0 - 0.22 * (1.0 - up) * (1.0 - smoothstep(hem + 0.009, hem + 0.012, b.y));
  }
}`;
PATTERNS.trousersG = `{
  vec3 b = vBind; float ax = abs(b.x), knee = uL0.x, top = uL0.y;
  if (uParam.w > 0.5 && uParam.y < 0.5) {
    float front = smoothstep(0.01, 0.03, b.z), kn = front * smoothstep(knee - 0.072, knee - 0.068, b.y) * (1.0 - smoothstep(knee + 0.128, knee + 0.132, b.y));
    diffuseColor.rgb *= 1.0 - 0.16 * kn;
    float seam = front * (1.0 - smoothstep(0.0008, 0.0022, min(abs(b.y - knee + 0.07), abs(b.y - knee - 0.13))));
    diffuseColor.rgb *= 1.0 + 0.4 * seam;
  }
  // Off duty. uL0.z: which: 0 Silas's canvas trousers (a contrast seam down the outside); 1 joggers (heathered, a ribbed cuff at the
  // ankle, a drawstring); 2 chinos (slant pockets, back pockets); 3 work trousers (double knees, a rule pocket, contrast stitching); 4 carpenter
  // trousers (bellows pockets with flaps on the thighs, a hammer loop on the left, the knees seamed); 5 pressed (a sharp crease down each leg).
  // uL0.w: the hem's height. uPat0: the accent (stitching, a cord). Drawn only as worn (lowered, they're bunched at the knees).
  if (uParam.w < 0.5) {
    float st = uL0.z, hemY = uL0.w, lx = uParam.z, sx = b.x >= 0.0 ? 1.0 : -1.0, dx = b.x - sx * lx, worn = 1.0 - uParam.y;
    float fr = smoothstep(0.0, 0.025, b.z), bk = smoothstep(0.0, 0.025, -b.z), side = 1.0 - smoothstep(0.03, 0.05, abs(b.z));
    float outer = smoothstep(0.035, 0.05, sx * dx), round_ = atan(dx, b.z) * 0.07, line = 0.0;
    if (st < 0.5) { if (b.y < top - 0.06) diffuseColor.rgb = mix(diffuseColor.rgb, uPat0, (1.0 - smoothstep(0.0025, 0.0045, abs(b.z))) * step(lx + 0.03, ax)); }
    else if (worn > 0.5) {
      if (st < 1.5) {
        diffuseColor.rgb *= 0.92 + 0.16 * fn3(b * 600.0);
        float cuff = 1.0 - smoothstep(hemY + 0.06, hemY + 0.065, b.y);
        diffuseColor.rgb *= 1.0 - 0.14 * cuff * (0.5 + 0.5 * sin(round_ * 1200.0));
        line = seamAt(b.y - hemY - 0.0625, 0.004);
        float cord = fr * step(top - 0.12, b.y) * step(b.y, top - 0.03) * seamAt(ax - 0.014 - (top - 0.03 - b.y) * 0.05, 0.005);
        diffuseColor.rgb = mix(diffuseColor.rgb, uPat0, cord);
      } else if (st < 2.5) {
        float sl = (b.y - (top - 0.025)) + 0.9 * (ax - 0.075);      // (a slant pocket's mouth: down and out from the waist)
        line = max(fr * step(top - 0.13, b.y) * step(ax, 0.16) * seamAt(sl, 0.004), bk * step(top - 0.16, b.y) * step(b.y, top - 0.055) * max(seamAt(ax - 0.035, 0.004) * step(ax, 0.1), seamAt(ax - 0.1, 0.004) * step(0.035, ax)) * step(0.035, ax) * step(ax, 0.1));
        line = max(line, bk * step(0.035, ax) * step(ax, 0.1) * seamAt(b.y - top + 0.16, 0.004));
        line = max(line, fr * seamAt(dx, 0.003) * step(hemY + 0.02, b.y) * step(b.y, top - 0.15) * 0.5);
      } else if (st < 3.5) {
        float kn = fr * smoothstep(knee - 0.09, knee - 0.086, b.y) * (1.0 - smoothstep(knee + 0.15, knee + 0.154, b.y));
        diffuseColor.rgb *= 1.0 - 0.14 * kn;
        float stitch = fr * max(seamAt(b.y - knee + 0.088, 0.003), seamAt(b.y - knee - 0.152, 0.003)) * step(0.5, fract(round_ * 160.0));
        diffuseColor.rgb = mix(diffuseColor.rgb, uPat0, stitch);
        float rp = step(sx, 0.0) * outer * step(knee + 0.12, b.y) * step(b.y, knee + 0.27) * (1.0 - smoothstep(0.03, 0.035, abs(b.z + 0.005)));
        diffuseColor.rgb *= 1.0 - 0.1 * rp;
        line = step(sx, 0.0) * outer * step(knee + 0.12, b.y) * step(b.y, knee + 0.27) * seamAt(abs(b.z + 0.005) - 0.0325, 0.004);
        line = max(line, step(sx, 0.0) * outer * (1.0 - smoothstep(0.03, 0.035, abs(b.z + 0.005))) * max(seamAt(b.y - knee - 0.12, 0.004), seamAt(b.y - knee - 0.27, 0.004)));
      } else if (st < 4.5) {
        float py0 = knee + 0.085, py1 = knee + 0.255, pz = 0.042, inP = outer * step(py0, b.y) * step(b.y, py1) * (1.0 - smoothstep(pz - 0.002, pz + 0.002, abs(b.z)));
        float flap = inP * step(py1 - 0.045, b.y);
        diffuseColor.rgb *= 1.0 - 0.08 * inP - 0.1 * flap;
        line = outer * step(py0, b.y) * step(b.y, py1) * seamAt(abs(b.z) - pz, 0.004);
        line = max(line, outer * (1.0 - smoothstep(pz - 0.002, pz + 0.002, abs(b.z))) * max(max(seamAt(b.y - py0, 0.004), seamAt(b.y - py1, 0.004)), seamAt(b.y - py1 + 0.045, 0.004)));
        float loopZ = -0.03, hl = step(0.0, sx) * outer * step(knee + 0.17, b.y) * step(b.y, top - 0.13) * (1.0 - smoothstep(0.007, 0.009, abs(b.z - loopZ)));
        diffuseColor.rgb *= 1.0 - 0.12 * hl;
        line = max(line, step(0.0, sx) * outer * step(knee + 0.17, b.y) * step(b.y, top - 0.13) * seamAt(abs(b.z - loopZ) - 0.008, 0.003));
        line = max(line, fr * max(seamAt(b.y - knee + 0.03, 0.004), seamAt(b.y - knee - 0.05, 0.004)) * 0.7);
        diffuseColor.rgb *= 0.95 + 0.1 * fn3(b * 90.0);      // (washed out, faded unevenly)
      } else {
        line = max(fr, bk) * seamAt(dx, 0.0028) * step(hemY + 0.005, b.y) * step(b.y, top - 0.08);
        diffuseColor.rgb *= 1.0 + 0.18 * max(fr, bk) * seamAt(dx - 0.003, 0.004) * step(hemY + 0.005, b.y) * step(b.y, top - 0.08);
      }
      diffuseColor.rgb *= 1.0 - 0.42 * line;
    }
  }
  diffuseColor.rgb *= 1.0 - 0.18 * smoothstep(top - 0.032, top - 0.029, b.y) * (1.0 - uParam.y);
}`;
// Shoes, drawn over the boot's shape (uParam.x: which; 0 the boots as they are): off duty, aboard, everyone but Silas wears soft indoor
// shoes over socks: the shoe's top edge low at the instep, higher at the heel, the sock above it. uParam.y: the ankle's height. uPat0: the
// sole, uPat1: trim (laces, a stripe, a strap, stitching), uPat2: the sock. 1 soft felt; 2 canvas floor shoes (a thick pale sole, laces);
// 3 soft-soled leather work shoes (a stitched welt); 4 trainers (a thick sole, a stripe down the side); 5 flats (cut low, a trim at the
// edge); 6 loafers (a strap across the instep).
PATTERNS.shoeG = `{
  vec3 b = vBind; float st = uParam.x, ank = uParam.y;
  if (st > 0.5) {
    float sx = b.x >= 0.0 ? 1.0 : -1.0, toe = smoothstep(0.0, 0.07, b.z), gk = 1.0 + uGrain * (g - 0.5) * 2.0;
    float edge = ank + 0.016 - 0.034 * toe - (st > 4.5 && st < 5.5 ? 0.012 : 0.0), soleH = st > 1.5 && st < 2.5 || st > 3.5 && st < 4.5 ? 0.028 : 0.018;
    float sock = smoothstep(edge, edge + 0.002, b.y), sole = 1.0 - smoothstep(soleH - 0.001, soleH + 0.001, b.y);
    vec3 c = diffuseColor.rgb;
    if (st < 1.5) c *= 0.92 + 0.16 * fn3(b * 500.0);
    else if (st < 2.5) c = mix(c, uPat1, toe * step(0.03, b.z) * step(b.z, 0.1) * (1.0 - smoothstep(0.012, 0.016, abs(b.x - sx * 0.113))) * step(0.5, fract(b.z * 70.0)) * step(edge - 0.03, b.y));
    else if (st < 3.5) c = mix(c, uPat1, seamAt(b.y - soleH - 0.005, 0.003) * step(0.5, fract(atan(b.x - sx * 0.113, b.z) * 9.0)));
    else if (st < 4.5) c = mix(c, uPat1, (1.0 - smoothstep(0.006, 0.008, abs(b.y - 0.045 - 0.25 * (b.z + 0.02)))) * step(0.06, abs(b.x - sx * 0.113)) * step(-0.05, b.z) * step(b.z, 0.09));
    else if (st < 5.5) c = mix(c, uPat1, seamAt(b.y - edge + 0.003, 0.004));
    else c = mix(c, uPat1, toe * step(0.02, b.z) * step(b.z, 0.06) * step(edge - 0.035, b.y));
    c = mix(c, uPat0 * gk, sole);
    c *= 1.0 - 0.4 * max(seamAt(b.y - soleH, 0.003), seamAt(b.y - edge, 0.004));
    diffuseColor.rgb = mix(c, uPat2 * gk * (0.94 + 0.12 * sin(atan(b.x - sx * 0.113, b.z) * 40.0)), sock);
  }
}`;
// ── Fenwick: her period clothes (the Blender-built dresses, kirtle, leggings, drawers) ──
// dressG: a dress or the kirtle. uParam (hem, –, sleeves: 0 long 1 elbow, apron?), uL0 (waist, neckline, print?, bodice its own colour?),
// uL1 (–, –, the sleeve's end (its height at rest), patches?); uPat0 the trim and lacing, uPat1 the chemise, uPat2 the apron, uPat3 the bodice,
// uPat4 the print. vPart: the sleeves 1. Above the neckline the chemise shows, gathered; the bodice laced down the front; a seam at the waist;
// an apron over the skirt's front with its band round the waist; a small sprig print, where there is one; a band at the hem; on the kirtle,
// patches; at the sleeve's end a cuff band, and below an elbow sleeve the chemise's frill.
PATTERNS.dressG = `{
  vec3 b = vBind; float ax = abs(b.x), hem = uParam.x, waist = uL0.x, nl = uL0.y, gk = 1.0 + uGrain * (g - 0.5) * 2.0;
  float fr = smoothstep(-0.01, 0.03, b.z), skirtP = 1.0 - smoothstep(waist - 0.02, waist - 0.008, b.y);
  // (Fenwick: the armhole seam, drawn where it falls rather than along the mesh's triangles: from the shoulder's point down and in to the
  // armpit (uL1.x the armpit's height, uL1.y the shoulder joint's x), a fine seam along it; below the armpit, where the sleeve and the
  // bodice are apart, as the mesh says)
  float pit = uL1.x, seamX = uL1.y - 0.04 + 0.19 * (b.y - pit), sleeve = (pit > 0.0 && b.y > pit) ? step(seamX, ax) : step(0.5, vPart);
  vec3 c = diffuseColor.rgb;
  if (pit > 0.0 && b.y > pit) c *= 1.0 - 0.25 * seamAt(ax - seamX, 0.0025);
  if (sleeve < 0.5) {
    if (uL0.w > 0.5 && uParam.y < 0.5) c = mix(uPat3 * gk, c, skirtP);
    if (uL0.z > 0.5) { float ctr; vec2 uv = vec2(atan(b.x, b.z + 0.03) * 0.17, b.y); float fl = flowerAt(uv, 30.0, ctr); c = mix(c, uPat4 * gk, fl * 0.8 * (uL0.w > 0.5 ? skirtP : 1.0)); c = mix(c, uPat0, ctr * fl * 0.6 * (uL0.w > 0.5 ? skirtP : 1.0)); }
    // the lacing: criss-cross down the front of the bodice, between two rows of eyelets
    float bod = (1.0 - skirtP) * fr * step(waist + 0.004, b.y) * (1.0 - smoothstep(nl - 0.05, nl - 0.042, b.y)) * (1.0 - smoothstep(0.018, 0.02, ax)) * (1.0 - uParam.y);
    float zz = fract((b.y - waist) / 0.024) - 0.5, lace = min(abs(b.x - zz * 0.03), abs(b.x + zz * 0.03));
    c = mix(c, uPat0, bod * (1.0 - smoothstep(0.0011, 0.0022, lace)) * step(ax, 0.0155));
    c = mix(c, c * 0.72, bod * seamAt(ax - 0.0165, 0.0035));
    // the waist seam, and the apron (its band all round the front, and the bib-less apron itself over the skirt)
    c *= 1.0 - 0.3 * seamAt(b.y - (waist - 0.012), 0.004) * (1.0 - uParam.y);
    if (uParam.w > 0.5) {
      float aw = 0.15 + 0.05 * clamp((waist - b.y) / 0.6, 0.0, 1.0), ap = skirtP * fr * (1.0 - smoothstep(aw - 0.003, aw + 0.003, ax)) * step(hem + 0.075, b.y);
      float band = smoothstep(waist - 0.036, waist - 0.033, b.y) * (1.0 - smoothstep(waist - 0.012, waist - 0.009, b.y)) * smoothstep(-0.06, -0.02, b.z);
      c = mix(c, uPat2 * gk * (0.96 + 0.06 * fn3(b * 300.0)), max(ap, band));
      c *= 1.0 - 0.35 * fr * skirtP * max(seamAt(ax - aw, 0.003) * step(hem + 0.075, b.y), seamAt(b.y - hem - 0.075, 0.003) * step(ax, aw));
    }
    // a band of the trim at the hem; the kirtle's patches, sewn on with a running stitch
    c = mix(c, uPat0 * gk, skirtP * (1.0 - smoothstep(hem + 0.028, hem + 0.031, b.y)) * 0.7);
    if (uL1.w > 0.5) {
      vec2 q1 = vec2(b.x - 0.09, b.y - hem - 0.11), q2 = vec2(b.x + 0.06, b.y - waist + 0.17);
      float p1 = fr * step(abs(q1.x), 0.035) * step(abs(q1.y), 0.03), p2 = (1.0 - fr) * step(abs(q2.x), 0.03) * step(abs(q2.y), 0.035);
      float pp = max(p1, p2); c = mix(c, c * vec3(1.12, 1.05, 0.92), pp);
      c *= 1.0 - 0.45 * max(p1 * step(0.5, fract((b.x + b.y) * 220.0)) * max(seamAt(abs(q1.x) - 0.033, 0.003), seamAt(abs(q1.y) - 0.028, 0.003)), p2 * step(0.5, fract((b.x + b.y) * 220.0)) * max(seamAt(abs(q2.x) - 0.028, 0.003), seamAt(abs(q2.y) - 0.033, 0.003)));
    }
  } else {
    float e = uL1.z, cuff = smoothstep(e + 0.004, e + 0.007, b.y) * (1.0 - smoothstep(e + 0.022, e + 0.025, b.y));
    c = mix(c, uPat0 * gk, cuff * 0.8);
    if (uParam.z > 0.5) c = mix(c, uPat1 * (0.92 + 0.08 * sin(atan(b.x, b.z) * 90.0)), 1.0 - smoothstep(e + 0.003, e + 0.006, b.y));
  }
  // (the chemise above the neckline, gathered: what the dress's edge leaves of it)
  float dn = 0.9131 * (b.y - nl) + 0.4078 * b.z;
  c = mix(c, uPat1 * (0.9 + 0.1 * sin(atan(b.x, b.z) * 160.0)), smoothstep(-0.018, -0.013, dn) * (1.0 - sleeve));
  c *= 1.0 - 0.3 * seamAt(dn + 0.0155, 0.003) * (1.0 - sleeve);
  diffuseColor.rgb = c;
}`;
// legG: leggings, a fine knit (ribs down the leg), a seam up the inside; darned at a knee where they're worn (uL0.x).
PATTERNS.legG = `{
  vec3 b = vBind; float sx = b.x >= 0.0 ? 1.0 : -1.0, gk = 1.0 + uGrain * (g - 0.5) * 2.0;
  vec3 c = diffuseColor.rgb * (0.94 + 0.06 * sin(atan(b.x - sx * 0.09, b.z) * 70.0)) * gk;
  c *= 1.0 - 0.25 * seamAt(abs(b.x) - 0.03, 0.003) * step(b.y, uParam.x) * step(0.0, -b.z + 0.04);
  if (uL0.x > 0.5) { vec2 q = vec2(b.x - 0.09, b.y - uParam.y - 0.02); float d = step(length(q * vec2(1.0, 0.8)), 0.035) * smoothstep(0.0, 0.03, b.z); c = mix(c, uPat0 * (0.9 + 0.2 * step(0.5, fract(b.y * 260.0))), d); }
  diffuseColor.rgb = c;
}`;
// drawersG: linen drawers, a drawstring channel at the waist, a frill at each leg's hem with a line of eyelets above it (the marks, as on
// any under layer, drawn after). uParam (the legs' hem, the waist, –, –).
PATTERNS.drawersG = `{
  vec3 b = vBind; float hem = uParam.x, top = uParam.y, gk = 1.0 + uGrain * (g - 0.5) * 2.0, sx = b.x >= 0.0 ? 1.0 : -1.0;
  vec3 c = diffuseColor.rgb * gk;
  float frill = 1.0 - smoothstep(hem + 0.03, hem + 0.033, b.y), a = atan(b.x - sx * 0.09, b.z);
  c *= 1.0 - 0.12 * frill * (0.5 + 0.5 * sin(a * 40.0));
  float ey = step(abs(b.y - hem - 0.04), 0.004) * step(0.6, fract(a * 9.0)) ; c *= 1.0 - 0.35 * ey;
  c *= 1.0 - 0.25 * max(seamAt(b.y - top + 0.02, 0.003), seamAt(b.y - hem - 0.033, 0.003));
  diffuseColor.rgb = c;
}`;
const NOISE = `
float fh(vec3 p){ return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
float fn3(vec3 p){ vec3 i = floor(p), f = fract(p); f = f * f * (3. - 2. * f);
  return mix(mix(mix(fh(i), fh(i + vec3(1,0,0)), f.x), mix(fh(i + vec3(0,1,0)), fh(i + vec3(1,1,0)), f.x), f.y),
             mix(mix(fh(i + vec3(0,0,1)), fh(i + vec3(1,0,1)), f.x), mix(fh(i + vec3(0,1,1)), fh(i + vec3(1,1,1)), f.x), f.y), f.z); }
float segd(vec2 p, vec2 a, vec2 b){ vec2 pa = p - a, ba = b - a; return length(pa - ba * clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0)); }
// Prints, on a surface unrolled round a body part (u round it, v up it), in cells (each cell's own, checked with its neighbours so nothing is
// cut off at a cell's edge): small five-petalled flowers (with their centres), or broad pointed leaves (with their middle veins).
float flowerAt(vec2 p, float dens, out float ctr) {
  vec2 g = p * dens; float best = 0.0; ctr = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = floor(g) + vec2(float(i), float(j)); if (fh(vec3(c, 9.3)) < 0.18) continue;
    vec2 q = g - c - 0.5 - (vec2(fh(vec3(c, 1.7)), fh(vec3(c, 2.3))) - 0.5) * 0.4;
    float r = length(q), a = atan(q.y, q.x) + fh(vec3(c, 5.1)) * 6.283, sz = 0.24 + 0.08 * fh(vec3(c, 7.7));
    float pet = sz * (0.6 + 0.4 * abs(cos(2.5 * a)));
    float f = 1.0 - smoothstep(pet - 0.03, pet + 0.01, r); if (f > best) { best = f; ctr = 1.0 - smoothstep(0.06, 0.085, r); }
  }
  return best;
}
float leafAt(vec2 p, float dens, out float vein) {
  vec2 g = p * dens; float best = 0.0; vein = 0.0;
  for (int j = -1; j <= 1; j++) for (int i = -1; i <= 1; i++) {
    vec2 c = floor(g) + vec2(float(i), float(j)); if (fh(vec3(c, 4.4)) < 0.15) continue;
    vec2 q = g - c - 0.5 - (vec2(fh(vec3(c, 1.1)), fh(vec3(c, 2.9))) - 0.5) * 0.3;
    float th = fh(vec3(c, 6.6)) * 6.283; q = vec2(cos(th) * q.x + sin(th) * q.y, -sin(th) * q.x + cos(th) * q.y);
    float L = 0.5 + 0.12 * fh(vec3(c, 8.2)), w = 0.17 * (1.0 - pow(clamp(abs(q.x) / L, 0.0, 1.0), 1.7));
    float f = (1.0 - smoothstep(w - 0.018, w + 0.004, abs(q.y))) * step(abs(q.x), L);
    if (f > best) { best = f; vein = f * (1.0 - smoothstep(0.006, 0.014, abs(q.y))) * step(-L * 0.85, q.x); }
  }
  return best;
}
// (where a garment's edge or seam lies: a thin dark line at distance d from it)
float seamAt(float d, float w) { return 1.0 - smoothstep(w * 0.5, w, abs(d)); }`;
// (Fenwick: the skin's painted detail, as the clothes' details are drawn: from each point's rest position, so it stays crisp and goes with the
// skin. Her areolae and nipples (round the breast's apex, which Blender raises a little: uNip, its radius in w), the crease under each breast and
// the shade beneath, the breastbone between; the collarbones and the notch between them; the navel (uNav, a dimple in the model) and a faint
// line down to it, the lines of the hip bones; behind, the spine's groove, the inner edges of the shoulder blades, the dimples above the seat;
// the kneecaps. uBust: how far below the apex the breast meets the chest, and how deep the crease is there (by her bust's size). uBd0: neck, armpit, waist, the top of the seat; uBd1: shoulder x, hip x, crotch, knee; uKnee: the knee joint. Only where the model gives them.)
const SKIN_DETAIL = `
if (uNip.w > 0.0) {
  vec3 b = vBind; float ax = abs(b.x), sx = b.x >= 0.0 ? 1.0 : -1.0;
  float neck = uBd0.x, pit = uBd0.y, waist = uBd0.z, seatTop = uBd0.w, shX = uBd1.x, hipX = uBd1.y, crotch = uBd1.z, knee = uBd1.w;
  float front = smoothstep(0.0, 0.03, b.z), back = smoothstep(0.0, 0.03, -b.z);
  vec3 c = vec3(sx * uNip.x, uNip.y, uNip.z), k = vec3(1.0);
  // the areola, a little uneven in tone; the nipple deeper, shaded on its lower side and lit on its upper, with a soft edge where it rises
  float d = length(b - c), R = uNip.w, ny = clamp((b.y - c.y) / 0.0055, -1.0, 1.0);
  k *= mix(vec3(1.0), vec3(0.86, 0.69, 0.65), (1.0 - smoothstep(R - 0.003, R + 0.0006, d)) * (0.85 + 0.15 * fn3(b * 900.0)));
  k *= mix(vec3(1.0), vec3(0.88, 0.76, 0.74) * (1.0 - 0.1 * max(0.0, -ny)), 1.0 - smoothstep(0.0042, 0.006, d));
  k *= 1.0 - 0.12 * (1.0 - smoothstep(0.0, 0.0014, abs(d - 0.0058))) * (1.0 - smoothstep(-0.9, 0.1, ny));
  k *= 1.0 + 0.14 * (1.0 - smoothstep(0.0, 0.0018, length(b - c - vec3(sx * 0.0012, 0.0018, 0.004))));
  // the crease under each breast and the shade above it; the breastbone between them
  vec2 e = (b.xy - c.xy) / vec2(0.07, uBust.x); float el = length(e), under = step(b.y, c.y - 0.012) * front * smoothstep(0.03, 0.07, b.z);
  k *= 1.0 - 0.16 * uBust.y * under * (1.0 - smoothstep(0.0, 0.08, abs(el - 1.0))) * smoothstep(0.004, 0.02, ax);
  k *= 1.0 - 0.07 * under * smoothstep(0.72, 0.97, el) * (1.0 - step(1.0, el));
  k *= 1.0 - 0.07 * front * (1.0 - smoothstep(0.004, 0.014, ax)) * smoothstep(c.y - 0.07, c.y - 0.03, b.y) * (1.0 - smoothstep(c.y + 0.03, c.y + 0.07, b.y));
  // the collarbones, from the notch at the base of the throat out to the shoulders: shade below, light along the bone
  float yc = neck - 0.032 + 0.012 * smoothstep(0.02, 0.12, ax), cl = smoothstep(-0.02, 0.004, b.z) * smoothstep(0.016, 0.03, ax) * (1.0 - smoothstep(shX - 0.03, shX, ax));
  k *= 1.0 - 0.15 * cl * smoothstep(-0.008, -0.002, b.y - yc) * (1.0 - smoothstep(-0.002, 0.0005, b.y - yc));
  k *= 1.0 + 0.06 * cl * smoothstep(0.0, 0.002, b.y - yc) * (1.0 - smoothstep(0.003, 0.006, b.y - yc));
  k *= 1.0 - 0.16 * front * exp(-((b.x / 0.008) * (b.x / 0.008) + ((b.y - neck + 0.03) / 0.006) * ((b.y - neck + 0.03) / 0.006)));
  // the navel: a small hollow, deepest under its hood, the lower rim catching the light; a faint line above it
  if (uNav.w > 0.5) {
    vec2 nq = vec2(b.x / 0.004, (b.y - uNav.y) / 0.0062); float nd = length(nq);
    k *= mix(vec3(1.0), mix(vec3(0.8, 0.64, 0.6), vec3(0.6, 0.43, 0.41), smoothstep(-0.8, 0.6, nq.y)), front * (1.0 - smoothstep(0.7, 1.05, nd)));
    k *= 1.0 - 0.1 * front * (1.0 - smoothstep(0.0, 0.4, abs(nd - 1.15))) * smoothstep(0.0, 0.7, nq.y);
    k *= 1.0 + 0.08 * front * (1.0 - smoothstep(0.0, 0.35, abs(nd - 1.25))) * (1.0 - smoothstep(-0.5, 0.2, nq.y));
    k *= 1.0 - 0.06 * front * exp(-dot(nq / 2.6, nq / 2.6));
    k *= 1.0 - 0.035 * front * (1.0 - smoothstep(0.0015, 0.005, ax)) * smoothstep(uNav.y + 0.02, uNav.y + 0.05, b.y) * (1.0 - smoothstep(c.y - 0.1, c.y - 0.06, b.y));
  }
  // the lines of the hip bones, short and soft, angled in toward the mons
  float hv = (b.y - crotch - 0.05) - (ax - 0.035) * 1.25;
  k *= 1.0 - 0.045 * front * (1.0 - smoothstep(0.002, 0.009, abs(hv))) * smoothstep(0.045, 0.06, ax) * (1.0 - smoothstep(0.075, hipX, ax));
  // behind: the groove of the spine; the shoulder blades (the inner edge near upright, the point at the bottom, the outer edge up to the
  // armpit); the two dimples above the seat
  k *= 1.0 - 0.07 * back * (1.0 - smoothstep(0.002, 0.009, ax)) * smoothstep(seatTop + 0.05, seatTop + 0.1, b.y) * (1.0 - smoothstep(neck - 0.07, neck - 0.03, b.y));
  vec2 sp = vec2(ax, b.y), ia = vec2(0.062, pit - 0.075);
  float sd = min(segd(sp, vec2(0.05, pit + 0.075), ia), segd(sp, ia, vec2(0.108, pit - 0.008)));
  k *= 1.0 - 0.055 * back * (1.0 - smoothstep(0.001, 0.009, sd)) * smoothstep(pit - 0.1, pit - 0.08, b.y);
  k *= 1.0 - 0.13 * back * exp(-(((ax - 0.036) / 0.009) * ((ax - 0.036) / 0.009) + ((b.y - seatTop - 0.05) / 0.011) * ((b.y - seatTop - 0.05) / 0.011)));
  // the kneecaps: shade round the lower half, light on the top
  if (uKnee.w > 0.5) {
    vec2 kr = vec2(ax - uKnee.x, b.z - uKnee.z); float kf = smoothstep(0.55, 0.85, kr.y / max(length(kr), 1e-4));
    vec2 kq = vec2(ax - uKnee.x, b.y - uKnee.y - 0.02) / vec2(0.025, 0.03); float kn = length(kq);
    k *= 1.0 - 0.07 * kf * (1.0 - smoothstep(0.0, 0.22, abs(kn - 1.0))) * (1.0 - smoothstep(-0.2, 0.4, kq.y));
    k *= 1.0 + 0.04 * kf * (1.0 - smoothstep(0.3, 0.9, kn)) * smoothstep(-0.3, 0.5, kq.y);
  }
  diffuseColor.rgb *= k;
}
// her feet (uFootF: the frame, from under the ankle (x, z), turned out by (cos, sin); uToe: each toenail's centre (u across, y, w along) and the
// toe's radius): a paler sole; the nails, pinker, their free edges paler, a fold round each; a shade where each toe meets the next. Not under
// stockings.
if (uFootF.z > 0.0 && vBind.y < 0.06 && !(uStock.w > 0.0 && vRegion > 4.5 && vRegion < 7.5 && vBind.y < uStock.w)) {
  vec3 b = vBind; vec2 R = vec2(abs(b.x) - uFootF.x, b.z - uFootF.y);
  float u = R.x * uFootF.z - R.y * uFootF.w, w = R.x * uFootF.w + R.y * uFootF.z, y = b.y;
  vec3 k = mix(vec3(1.0), vec3(1.0, 0.9, 0.88), 1.0 - smoothstep(0.003, 0.008, y));
  for (int i = 0; i < 5; i++) {
    vec4 t = uToe[i]; float r = t.w;
    vec2 q = vec2(u - t.x, w - t.z) / vec2(0.68 * r, 0.8 * r);
    float nd = pow(pow(abs(q.x), 3.0) + pow(abs(q.y), 3.0), 1.0 / 3.0), top = smoothstep(t.y - 0.6 * r, t.y - 0.3 * r, y);
    k = mix(k, k * vec3(1.03, 0.92, 0.91) * (1.0 + 0.12 * smoothstep(0.4, 0.95, q.y)), (1.0 - smoothstep(0.88, 1.0, nd)) * top);
    k *= 1.0 - 0.2 * top * (1.0 - smoothstep(0.0, 0.14, abs(nd - 1.0)));
    if (i < 4) {
      vec4 n = uToe[i + 1]; float um = (t.x * n.w + n.x * t.w) / (t.w + n.w), wt = min(t.z + 1.2 * t.w, n.z + 1.2 * n.w);
      k *= 1.0 - 0.24 * (1.0 - smoothstep(0.0006, 0.0024, abs(u - um))) * smoothstep(wt - 0.05, wt - 0.035, w) * (1.0 - smoothstep(wt - 0.004, wt, w))
                   * (1.0 - smoothstep(max(t.y, n.y) + 0.001, max(t.y, n.y) + 0.005, y));
    }
  }
  diffuseColor.rgb *= k;
}`;
function paint(m, o) {
  o = o || {};
  const U = { uRim: { value: srgb(o.rim || '#2a3440').multiplyScalar(o.rimK == null ? 1 : o.rimK) }, uGrain: { value: o.grain == null ? 0.03 : o.grain }, uGrainScale: { value: o.scale || 60 }, uHide: { value: 0 },
    uMarks: { value: Array.from({ length: 8 }, () => new THREE.Vector4(0, -9, 0, 0)) }, uMarkCol: { value: srgb(o.markCol || '#b8323a') },
    uPat0: { value: new THREE.Color(1, 1, 1) }, uPat1: { value: new THREE.Color(1, 1, 1) }, uPat2: { value: new THREE.Color(1, 1, 1) }, uParam: { value: new THREE.Vector4() }, uL0: { value: new THREE.Vector4() }, uL1: { value: new THREE.Vector4() }, uFlush: { value: new THREE.Vector4() }, uFlushC: { value: new THREE.Vector4() },
    uPat3: { value: new THREE.Color(1, 1, 1) }, uPat4: { value: new THREE.Color(1, 1, 1) }, uStock: { value: new THREE.Vector4(0, 0, 0, 0) },
    uNip: { value: new THREE.Vector4(0, 0, 0, 0) }, uNav: { value: new THREE.Vector4(0, 0, 0, 0) }, uBd0: { value: new THREE.Vector4() }, uBd1: { value: new THREE.Vector4() },
    uKnee: { value: new THREE.Vector4(0, 0, 0, 0) }, uBust: { value: new THREE.Vector4(0.056, 1, 0, 0) }, uFootF: { value: new THREE.Vector4(0, 0, 0, 0) }, uToe: { value: [0, 1, 2, 3, 4].map(() => new THREE.Vector4(0, 0, 0, 0)) } };      // (off unless set: a Vector4's w is 1 by default)
  m.userData.u = U;
  const key = 'paint|' + [o.regions, o.marks, o.bindAttr, o.tone, o.detail].map(x => (x ? 1 : 0)).join('') + (o.pattern || '');
  m.customProgramCacheKey = () => key;
  m.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', `#include <common>
attribute vec3 bind; ${o.regions || o.pattern ? 'attribute float region;' : ''} ${o.tone ? 'attribute float tone;' : ''} varying vec3 vBind; varying float vHide; varying float vPart; varying float vTone; varying float vRegion; uniform float uHide;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
vBind = ${o.bindAttr ? 'bind' : 'position'};
${o.regions ? 'vHide = mod(floor(uHide / exp2(region) + 0.001), 2.0); vRegion = region;' : 'vHide = 0.0; vRegion = -1.0;'} ${o.pattern ? 'vPart = region;' : 'vPart = 0.0;'} ${o.tone ? 'vTone = tone;' : 'vTone = 0.0;'}`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', `#include <common>
varying vec3 vBind; varying float vHide; varying float vPart; varying float vTone; varying float vRegion; uniform vec3 uPat0; uniform vec3 uPat1; uniform vec3 uPat2; uniform vec3 uPat3; uniform vec3 uPat4; uniform vec4 uStock; uniform vec4 uNip; uniform vec4 uNav; uniform vec4 uBd0; uniform vec4 uBd1; uniform vec4 uKnee; uniform vec4 uBust; uniform vec4 uFootF; uniform vec4 uToe[5]; uniform vec4 uParam; uniform vec4 uL0; uniform vec4 uL1; uniform vec4 uFlush; uniform vec4 uFlushC; uniform vec3 uRim; uniform float uGrain; uniform float uGrainScale; uniform vec4 uMarks[8]; uniform vec3 uMarkCol;
${NOISE}`)
      .replace('#include <color_fragment>', `#include <color_fragment>
if (vHide > 0.5) discard;
// (the body's response (F.setResponse): blood to the sex, a deeper, rosier tone there; his, the whole length as it hangs at rest, and the
// scrotum; hers, the outer forms and the bottom of the mons)
if (uFlush.x > 0.001) {
  float lo = uFlush.y - (uFlush.w > 0.5 ? 0.125 : 0.042), hi = uFlush.y + (uFlush.w > 0.5 ? 0.06 : 0.04), wx = uFlush.w > 0.5 ? 0.042 : 0.026;
  float fw = (1.0 - smoothstep(wx - 0.022, wx, abs(vBind.x))) * smoothstep(lo, lo + 0.015, vBind.y) * (1.0 - smoothstep(hi - 0.02, hi, vBind.y)) * smoothstep(uFlush.z - 0.03, uFlush.z, vBind.z);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.86, 0.54, 0.58), fw * uFlush.x);
}
// (her inner form, in the crease between the folds: a deeper rose always, deeper again with the response)
if (vTone > 0.01) diffuseColor.rgb *= mix(vec3(1.0), vec3(0.78, 0.47, 0.5), clamp(vTone, 0.0, 1.0) * (0.7 + 0.3 * uFlush.x));
// (and with desire, the flush spreads up the chest to the throat: a blotchy warmth across the front)
if (uFlushC.x > 0.001) {
  // (the upper chest, from above the breasts (rising a little toward the shoulders), and up the front and sides of the neck to under the jaw)
  float y0 = uFlushC.y + 0.25 * max(0.0, abs(vBind.x) - 0.03);
  float cw = smoothstep(y0, y0 + 0.035, vBind.y) * (1.0 - smoothstep(uFlushC.z - 0.025, uFlushC.z, vBind.y)) * (1.0 - smoothstep(0.08, 0.13, abs(vBind.x))) * smoothstep(-0.02, 0.02, vBind.z);
  cw *= 0.75 + 0.25 * fn3(vBind * 28.0);
  diffuseColor.rgb *= mix(vec3(1.0), vec3(0.93, 0.74, 0.74), cw * uFlushC.x);
}
float g = fn3(vBind * uGrainScale) * 0.6 + fn3(vBind * uGrainScale * 2.7) * 0.4;
diffuseColor.rgb *= 1.0 + uGrain * (g - 0.5) * 2.0;
// (Fenwick: stockings, for her under a dress (F.setStockings): the legs' skin (the thigh, knee and shin regions) below their tops, a fine knit, a
// garter band at the top)
if (uStock.w > 0.0 && vRegion > 4.5 && vRegion < 7.5 && vBind.y < uStock.w) {
  float knit = 0.93 + 0.07 * sin(atan(vBind.x - sign(vBind.x) * 0.09, vBind.z) * 60.0) + 0.04 * (fn3(vBind * 500.0) - 0.5);
  diffuseColor.rgb = uStock.rgb * knit * (1.0 - 0.3 * smoothstep(uStock.w - 0.02, uStock.w - 0.012, vBind.y));
}
${o.detail ? SKIN_DETAIL : ''}
${o.pattern ? PATTERNS[o.pattern] : ''}
${o.marks ? `float mk = 0.0;
for (int i = 0; i < 8; i++) { vec3 d = vBind - uMarks[i].xyz; d.z *= 0.6; mk += uMarks[i].w * exp(-dot(d, d) / 0.0026); }
float mott = fn3(vBind * 140.0);
mk = 1.0 - exp(-2.2 * mk * (0.75 + 0.5 * mott));
diffuseColor.rgb = mix(diffuseColor.rgb, uMarkCol, mk * 0.78);` : ''}`)
      // (a soft rim of light round the silhouette, as stylised shading has)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
{ float fr = 1.0 - abs(dot(normalize(vViewPosition), normal)); totalEmissiveRadiance += uRim * smoothstep(0.55, 0.9, fr) * 0.6; }`);
  };
  return m;
}
// ── Dual-quaternion skinning ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Each bone's matrix turned into a rotation and a translation (a dual quaternion), blended, and applied: unlike blending matrices, a joint keeps
// its volume as it bends (no collapsing elbow or knee, no pinched shoulder, no twisting wrist). Patched into a material's own skinning chunks, so
// it works for any material (the toon shading, the outlines, the shadows' depth). Except as far as a point's weights say otherwise, adding up
// to more than one (to 1 + s: the armpits, see adopt; the quaternions' blend doesn't mind, it's normalised): there the matrices are blended
// as they are, by s, so a point between the ribcage and a raised arm is drawn straight across between the two, a hollow, rather than swung
// round the shoulder as far as its share of the arm (which, with the arm overhead, is out sideways). (Not an attribute of its own: the body,
// with its shape keys, has none to spare.)
const DQS_PARS = `
vec4 dqQuat(mat4 m) {
  mat3 r = mat3(normalize(m[0].xyz), normalize(m[1].xyz), normalize(m[2].xyz));
  float tr = r[0][0] + r[1][1] + r[2][2]; vec4 q;
  if (tr > 0.0) { float s = sqrt(tr + 1.0) * 2.0; q = vec4((r[1][2] - r[2][1]) / s, (r[2][0] - r[0][2]) / s, (r[0][1] - r[1][0]) / s, 0.25 * s); }
  else if (r[0][0] > r[1][1] && r[0][0] > r[2][2]) { float s = sqrt(1.0 + r[0][0] - r[1][1] - r[2][2]) * 2.0; q = vec4(0.25 * s, (r[1][0] + r[0][1]) / s, (r[2][0] + r[0][2]) / s, (r[1][2] - r[2][1]) / s); }
  else if (r[1][1] > r[2][2]) { float s = sqrt(1.0 + r[1][1] - r[0][0] - r[2][2]) * 2.0; q = vec4((r[1][0] + r[0][1]) / s, 0.25 * s, (r[2][1] + r[1][2]) / s, (r[2][0] - r[0][2]) / s); }
  else { float s = sqrt(1.0 + r[2][2] - r[0][0] - r[1][1]) * 2.0; q = vec4((r[2][0] + r[0][2]) / s, (r[2][1] + r[1][2]) / s, 0.25 * s, (r[0][1] - r[1][0]) / s); }
  return normalize(q);
}
vec4 dqDual(vec4 q, vec3 t) { return 0.5 * vec4(q.w * t + cross(t, q.xyz), -dot(t, q.xyz)); }
vec3 dqRot(vec4 q, vec3 v) { return v + 2.0 * cross(q.xyz, cross(q.xyz, v) + q.w * v); }
`;
const DQS_BASE = `#ifdef USE_SKINNING
  mat4 boneMatX = getBoneMatrix( skinIndex.x ); mat4 boneMatY = getBoneMatrix( skinIndex.y ); mat4 boneMatZ = getBoneMatrix( skinIndex.z ); mat4 boneMatW = getBoneMatrix( skinIndex.w );
  vec4 dqA = dqQuat(boneMatX), dqB = dqQuat(boneMatY), dqC = dqQuat(boneMatZ), dqD = dqQuat(boneMatW);
  float wB = dot(dqA, dqB) < 0.0 ? -skinWeight.y : skinWeight.y, wC = dot(dqA, dqC) < 0.0 ? -skinWeight.z : skinWeight.z, wD = dot(dqA, dqD) < 0.0 ? -skinWeight.w : skinWeight.w;
  vec4 dqR = skinWeight.x * dqA + wB * dqB + wC * dqC + wD * dqD;
  vec4 dqT = skinWeight.x * dqDual(dqA, boneMatX[3].xyz) + wB * dqDual(dqB, boneMatY[3].xyz) + wC * dqDual(dqC, boneMatZ[3].xyz) + wD * dqDual(dqD, boneMatW[3].xyz);
  float dqL = length(dqR); dqR /= dqL; dqT /= dqL;
  float skS = skinWeight.x + skinWeight.y + skinWeight.z + skinWeight.w, skinLin = clamp(skS - 1.0, 0.0, 1.0);
  if (skinLin < 0.002) skinLin = 0.0;
  mat4 skLin = (skinWeight.x * boneMatX + skinWeight.y * boneMatY + skinWeight.z * boneMatZ + skinWeight.w * boneMatW) / skS;
#endif`;
const DQS_NORMAL = `#ifdef USE_SKINNING
  objectNormal = skinLin > 0.0 ? normalize(mix(dqRot(dqR, objectNormal), (bindMatrixInverse * skLin * bindMatrix * vec4(objectNormal, 0.0)).xyz, skinLin)) : dqRot(dqR, objectNormal);
#endif`;
const DQS_SKIN = `#ifdef USE_SKINNING
  vec3 skP = (bindMatrix * vec4(transformed, 1.0)).xyz, skP0 = skP;
  skP = dqRot(dqR, skP) + 2.0 * (dqR.w * dqT.xyz - dqT.w * dqR.xyz + cross(dqR.xyz, dqT.xyz));
  if (skinLin > 0.0) skP = mix(skP, (skLin * vec4(skP0, 1.0)).xyz, skinLin);
  transformed = (bindMatrixInverse * vec4(skP, 1.0)).xyz;
#endif`;
function dqs(m) {
  const prev = m.onBeforeCompile, prevKey = m.customProgramCacheKey ? m.customProgramCacheKey.bind(m) : () => '';
  m.onBeforeCompile = (sh, r) => {
    if (prev) prev(sh, r);
    sh.vertexShader = sh.vertexShader.replace('#include <skinning_pars_vertex>', '#include <skinning_pars_vertex>\n' + DQS_PARS)
      .replace('#include <skinbase_vertex>', DQS_BASE).replace('#include <skinnormal_vertex>', DQS_NORMAL).replace('#include <skinning_vertex>', DQS_SKIN);
  };
  m.customProgramCacheKey = () => 'dqs|' + prevKey();
  return m;
}
const DEPTHM = dqs(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, skinning: true })), DEPTHM_M = dqs(new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking, skinning: true, morphTargets: true }));
const morphed = g => !!(g.morphAttributes && g.morphAttributes.position && g.morphAttributes.position.length);
// A skinned part of a figure: bound with the rest pose's matrix, dual-quaternion skinned, casting its shadow with the same skinning.
function skinned(F, geo, m) {
  const sm = new THREE.SkinnedMesh(geo, m); F.root.add(sm); sm.bind(F.skeleton, F.bindM); sm.frustumCulled = false; sm.customDepthMaterial = morphed(geo) ? DEPTHM_M : DEPTHM;
  if (F.keys && morphed(geo)) setKeys(sm, F.keys);
  return sm;
}

const MATS = new Map();
function mat(hex, o) {
  o = o || {};
  const key = JSON.stringify([hex, o]);
  if (!o.unique && MATS.has(key)) return MATS.get(key);
  const m = paint(new THREE.MeshStandardMaterial({ color: srgb(hex), roughness: o.rough == null ? 0.78 : o.rough, metalness: o.metal || 0,
    skinning: !!o.skin, vertexColors: !!o.vc, side: o.side || THREE.FrontSide, transparent: !!o.opacity, opacity: o.opacity || 1,
    emissive: o.emissive ? srgb(o.emissive) : new THREE.Color(0), emissiveIntensity: o.ei || 1 }), o);
  if (!o.unique) MATS.set(key, m);
  return m;
}

// ── Toon: redlessons' shading (a ramp of soft bands rather than smooth falloff) and ink outlines (an inverted hull, a little out along the normals). ──
let RAMP = null;
function ramp() {
  if (RAMP) return RAMP;
  const d = new Uint8Array([128, 128, 128, 255, 176, 176, 176, 255, 228, 228, 228, 255, 255, 255, 255, 255]);
  RAMP = new THREE.DataTexture(d, 4, 1, THREE.RGBAFormat); RAMP.minFilter = RAMP.magFilter = THREE.LinearFilter; RAMP.generateMipmaps = false; RAMP.needsUpdate = true;
  return RAMP;
}
const TMATS = new Map();
function tmat(hex, o) {
  o = Object.assign({ grain: 0 }, o || {});
  const key = JSON.stringify([hex, o]);
  if (!o.unique && TMATS.has(key)) return TMATS.get(key);
  let m = paint(new THREE.MeshToonMaterial({ color: srgb(hex), gradientMap: ramp(), skinning: !!o.skin, morphTargets: !!o.morph, vertexColors: !!o.vc, side: o.side || THREE.FrontSide }), o);
  if (o.skin) m = dqs(m);
  if (!o.unique) TMATS.set(key, m);
  return m;
}
const INK = '#2a1a16';
const HULL_OFS = { polygonOffset: true, polygonOffsetFactor: 2, polygonOffsetUnits: 6 };
const INKM = { plain: new THREE.MeshBasicMaterial({ color: srgb(INK), side: THREE.BackSide }), skinned: dqs(new THREE.MeshBasicMaterial(Object.assign({ color: srgb(INK), side: THREE.BackSide, skinning: true }, HULL_OFS))),
  morph: dqs(new THREE.MeshBasicMaterial(Object.assign({ color: srgb(INK), side: THREE.BackSide, skinning: true, morphTargets: true }, HULL_OFS))) };
// (each point pushed out by its own share of w where the model gives one, `_ink`: less across a crease, so the two sides' outlines never reach
// through each other; and for a garment, a slim round edge of ink along each open hem: its waist, its legs, cuffs and collar)
function hullGeo(geo, w, hem) {
  const g = geo.clone(), p = g.attributes.position, n = g.attributes.normal, k = g.attributes._ink;
  for (let i = 0; i < p.count; i++) { const wi = w * (k ? k.getX(i) : 1); p.setXYZ(i, p.getX(i) + n.getX(i) * wi, p.getY(i) + n.getY(i) * wi, p.getZ(i) + n.getZ(i) * wi); }
  return hem ? withHems(g, geo, hem) : g;
}
// A garment's open edges (welded by position, so a split vertex isn't taken for one), each with its direction round the surface: [a, b] pairs
// of the first vertex at each place.
function openEdges(geo) {
  const p = geo.attributes.position, n = p.count, id = new Int32Array(n), at = new Map();
  for (let i = 0; i < n; i++) { const key = p.getX(i) + ',' + p.getY(i) + ',' + p.getZ(i); if (!at.has(key)) at.set(key, i); id[i] = at.get(key); }     // (exactly: the cut leaves points very close)
  const ix = geo.index ? geo.index.array : null, nt = (ix ? ix.length : n) / 3, E = new Map();
  for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) {
    const a = id[ix ? ix[t * 3 + e] : t * 3 + e], b = id[ix ? ix[t * 3 + (e + 1) % 3] : t * 3 + (e + 1) % 3], key = a < b ? a + '_' + b : b + '_' + a, o = E.get(key);
    if (o) o[2]++; else E.set(key, [a, b, 1]);
  }
  return [...E.values()].filter(e => e[2] === 1).map(e => [e[0], e[1]]);
}
const HEM_K = 6;
function withHems(g, src, r) {
  const E = openEdges(src); if (!E.length) return g;
  const P = src.attributes.position, N = src.attributes.normal, nx = new Map(), pv = new Map();
  for (const [a, b] of E) { if (!nx.has(a)) nx.set(a, b); if (!pv.has(b)) pv.set(b, a); }
  const vs = [...new Set(E.flat())], ring = new Map(), pos = [], from = [];
  const v3 = i => new THREE.Vector3(P.getX(i), P.getY(i), P.getZ(i)), t = new THREE.Vector3(), b = new THREE.Vector3(), nn = new THREE.Vector3(), q = new THREE.Vector3();
  for (const v of vs) {
    const o = v3(v), a = pv.has(v) ? v3(pv.get(v)) : o, c = nx.has(v) ? v3(nx.get(v)) : o;
    t.subVectors(c, a).normalize(); nn.set(N.getX(v), N.getY(v), N.getZ(v));
    b.crossVectors(t, nn).normalize(); nn.crossVectors(b, t).normalize();
    ring.set(v, pos.length);
    for (let j = 0; j < HEM_K; j++) {
      const th = j / HEM_K * Math.PI * 2;
      q.copy(o).addScaledVector(nn, r * (0.3 + Math.cos(th))).addScaledVector(b, r * Math.sin(th)); pos.push(q.clone()); from.push(v);
    }
  }
  const n0 = g.attributes.position.count, m = pos.length;
  const grow = (A, set) => {
    const s = A.itemSize, get = [A.getX, A.getY, A.getZ, A.getW].slice(0, s), out = new A.array.constructor((n0 + m) * s);
    for (let i = 0; i < n0; i++) for (let c = 0; c < s; c++) out[i * s + c] = get[c].call(A, i);
    for (let j = 0; j < m; j++) for (let c = 0; c < s; c++) out[(n0 + j) * s + c] = set ? set(j, c) : get[c].call(A, from[j]);
    return new THREE.BufferAttribute(out, s, A.normalized);
  };
  for (const name in g.attributes) g.setAttribute(name, grow(g.attributes[name], name === 'position' ? (j, c) => pos[j].getComponent(c) : null));
  for (const name in g.morphAttributes) g.morphAttributes[name] = g.morphAttributes[name].map(A => grow(A));
  const old = g.index ? Array.from(g.index.array) : Array.from({ length: n0 }, (_, i) => i), tri = [];
  for (const [a, c] of E) {
    const ra = n0 + ring.get(a), rc = n0 + ring.get(c);
    for (let j = 0; j < HEM_K; j++) {
      const j1 = (j + 1) % HEM_K;
      tri.push(ra + j, ra + j1, rc + j1, ra + j, rc + j1, rc + j, ra + j, rc + j1, ra + j1, ra + j, rc + j, rc + j1);     // (both ways round)
    }
  }
  g.setIndex(old.concat(tri));
  return g;
}
// An outline round a mesh: for a plain one, a child; for a skinned one, a second skinned mesh on the same skeleton (mat: its own, e.g. sharing hidden regions).
// (an outline's hull is kept with the geometry it's made from, so figures sharing a body share its hull too)
function ink(mesh, w, F, m, hem) {
  if (mesh.isSkinnedMesh) {
    const g = mesh.geometry, hg = g.userData.shared ? (g.userData.hull = g.userData.hull || hullGeo(g, w, hem)) : hullGeo(g, w, hem);
    const h = skinned(F, hg, m || (morphed(g) ? INKM.morph : INKM.skinned)); h.castShadow = false; mesh.userData.hull = h; return h;
  }
  const h = new THREE.Mesh(hullGeo(mesh.geometry, w), INKM.plain); mesh.add(h); return h;
}
const INK_W = 0.0045, HEM_R = 0.0019;

// ── Bones ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Built for a figure 1.75 m tall; a figure of another height is scaled whole (f.root.scale). Women's shoulders narrower and hip joints a touch wider.
// Each hand has four fingers of two joints and a thumb of two; each buttock a bone of its own (for the flesh's give when it's struck).
const HAND_K = 1.06;      // (hands a touch large, as the toon lean wants)
function fingerSpec(f, s, sx) {
  const k = (f ? 0.92 : 1) * HAND_K, h = 'hand' + s;
  return [
    ['index1' + s, h, 0, -0.093 * k, 0.026 * k], ['index2' + s, 'index1' + s, 0, -0.042 * k, 0],
    ['middle1' + s, h, 0, -0.095 * k, 0.009 * k], ['middle2' + s, 'middle1' + s, 0, -0.046 * k, 0],
    ['ring1' + s, h, 0, -0.092 * k, -0.008 * k], ['ring2' + s, 'ring1' + s, 0, -0.043 * k, 0],
    ['pinky1' + s, h, 0, -0.086 * k, -0.024 * k], ['pinky2' + s, 'pinky1' + s, 0, -0.033 * k, 0],
    ['thumb1' + s, h, -0.009 * k * sx, -0.026 * k, 0.026 * k], ['thumb2' + s, 'thumb1' + s, -0.004 * k * sx, -0.03 * k, 0.014 * k],
  ];
}
function skeletonSpec(sx) {
  const f = sx === 'f', shX = f ? 0.175 : 0.195, hipX = f ? 0.095 : 0.09;
  return [
    ['hips', null, 0, 0.95, 0],
    ['spine', 'hips', 0, 0.10, 0], ['chest', 'spine', 0, 0.17, 0], ['neck', 'chest', 0, 0.27, -0.012], ['head', 'neck', 0, 0.085, 0.012],
    ['clavL', 'chest', 0.03, 0.21, 0], ['upperArmL', 'clavL', shX - 0.03, 0, -0.01], ['foreArmL', 'upperArmL', 0.012, -0.29, 0], ['handL', 'foreArmL', 0.005, -0.255, 0.008],
    ...fingerSpec(f, 'L', 1),
    ['clavR', 'chest', -0.03, 0.21, 0], ['upperArmR', 'clavR', -(shX - 0.03), 0, -0.01], ['foreArmR', 'upperArmR', -0.012, -0.29, 0], ['handR', 'foreArmR', -0.005, -0.255, 0.008],
    ...fingerSpec(f, 'R', -1),
    ['thighL', 'hips', hipX, -0.05, 0], ['shinL', 'thighL', -0.005, -0.42, 0.006], ['footL', 'shinL', 0, -0.40, -0.012], ['toeL', 'footL', 0, -0.06, 0.13],
    ['thighR', 'hips', -hipX, -0.05, 0], ['shinR', 'thighR', 0.005, -0.42, 0.006], ['footR', 'shinR', 0, -0.40, -0.012], ['toeR', 'footR', 0, -0.06, 0.13],
    ['gluteL', 'hips', 0.078, -0.078, -0.1], ['gluteR', 'hips', -0.078, -0.078, -0.1],
  ];
}
const FINGERS = ['index', 'middle', 'ring', 'pinky'];

// ── Mesh builder: rings swept along the body in its rest pose, each vertex weighted to the bones near it. ────────────────────────────────────────
function Builder() {
  const B = { pos: [], nrm: [], uv: [], idx: [], si: [], sw: [], col: [], reg: [] };
  // ring: { c: [x, y, z], rx, zF, zB, p (superellipse exponent), lobes(θ) → extra radius, ax/az: its side and front axes (default x and z) };
  // rings run in order; seg around. o.smooth: rings added between each pair, on a smooth (Catmull-Rom) curve through every value, so the
  // profile flows between the rows rather than turning at each.
  B.sweep = (rings0, seg, o) => {
    const rings = smoothRings(rings0, o.smooth == null ? 2 : o.smooth);
    const base = B.pos.length / 3, n = seg + 1;
    rings.forEach((r, i) => {
      const ax = r.ax || X_, az = r.az || Z_;
      for (let j = 0; j <= seg; j++) {
        const th = (j / seg) * Math.PI * 2, c = Math.cos(th), s = Math.sin(th), p = r.p || 2;
        const ex = Math.sign(c) * Math.pow(Math.abs(c), 2 / p), ez = Math.sign(s) * Math.pow(Math.abs(s), 2 / p);
        let x = ex * r.rx, z = ez * (s > 0 ? r.zF : r.zB);
        const add = r.lobes ? r.lobes(th) : 0;
        if (add) { const L = Math.hypot(x, z) || 1; x += add * x / L; z += add * z / L; }
        const P = [r.c[0] + x * ax[0] + z * az[0], r.c[1] + x * ax[1] + z * az[1], r.c[2] + x * ax[2] + z * az[2]];
        B.vert(P, [0, 0, 0], [j / seg, i / (rings.length - 1)], o);
      }
    });
    for (let i = 0; i < rings.length - 1; i++) for (let j = 0; j < seg; j++) {
      const a = base + i * n + j, b = a + 1, c = a + n, d = c + 1;
      if (o.flip) B.idx.push(a, b, c, b, d, c); else B.idx.push(a, c, b, b, c, d);
    }
    if (o.capBottom) B.cap(base, seg, rings[0], !o.flip, o);
    if (o.capTop) B.cap(base + (rings.length - 1) * n, seg, rings[rings.length - 1], !!o.flip, o);
    return base;
  };
  B.cap = (start, seg, r, down, o) => {
    const ci = B.pos.length / 3; B.vert(r.c.slice(), [0, 0, 0], [0.5, 0.5], o);
    for (let j = 0; j < seg; j++) { if (down) B.idx.push(ci, start + j, start + j + 1); else B.idx.push(ci, start + j + 1, start + j); }
  };
  B.vert = (P, N, UV, o) => {
    B.pos.push(P[0], P[1], P[2]); B.nrm.push(N[0], N[1], N[2]); B.uv.push(UV[0], UV[1]);
    const w = (o.weights(P) || []).filter(e => e[1] > 1e-4).sort((a, b) => b[1] - a[1]).slice(0, 4), tot = w.reduce((a, e) => a + e[1], 0) || 1;
    for (let k = 0; k < 4; k++) { B.si.push(w[k] ? w[k][0] : 0); B.sw.push(w[k] ? w[k][1] / tot : 0); }
    const col = o.color ? o.color(P) : [1, 1, 1]; B.col.push(col[0], col[1], col[2]);
    B.reg.push(o.region ? o.region(P) : 0);
  };
  B.geometry = () => {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(B.pos, 3));
    g.setAttribute('bind', new THREE.Float32BufferAttribute(B.pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(B.uv, 2));
    g.setAttribute('color', new THREE.Float32BufferAttribute(B.col, 3));
    g.setAttribute('region', new THREE.Float32BufferAttribute(B.reg, 1));
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(B.si, 4));
    g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(B.sw, 4));
    g.setIndex(B.idx); g.computeVertexNormals(); weldSeams(g);
    return g;
  };
  return B;
}
const X_ = [1, 0, 0], Z_ = [0, 0, 1];
// Rings added between each pair of rows: every number (centre, radii, exponent, axes) and the lobes on a Catmull-Rom curve through the rows.
function smoothRings(rows, sub) {
  if (!sub || rows.length < 2) return rows;
  const cr = (a, b, c, d, t) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t * t + (-a + 3 * b - 3 * c + d) * t * t * t);
  const out = [], n = rows.length, at = i => rows[clamp(i, 0, n - 1)];
  const num = (r, k, i) => (k === 'c' || k === 'ax' || k === 'az' ? (r[k] || (k === 'ax' ? X_ : k === 'az' ? Z_ : [0, 0, 0]))[i] : r[k] == null ? (k === 'p' ? 2 : 0) : r[k]);
  for (let i = 0; i < n - 1; i++) {
    const A = at(i - 1), Bq = at(i), C = at(i + 1), D = at(i + 2);
    for (let k = 0; k <= sub; k++) {
      if (k === 0) { out.push(Bq); continue; }
      const t = k / (sub + 1), r = {};
      for (const key of ['c', 'ax', 'az']) r[key] = [0, 1, 2].map(j => cr(num(A, key, j), num(Bq, key, j), num(C, key, j), num(D, key, j), t));
      for (const key of ['rx', 'zF', 'zB', 'p']) r[key] = Math.max(key === 'p' ? 1.5 : 0.0005, cr(num(A, key), num(Bq, key), num(C, key), num(D, key), t));
      if (A.lobes || Bq.lobes || C.lobes || D.lobes) { const L = q => (q.lobes ? q.lobes : () => 0); r.lobes = th => cr(L(A)(th), L(Bq)(th), L(C)(th), L(D)(th), t); }
      if (Bq.ax || C.ax) { const v = new V3(...r.ax).normalize(); r.ax = [v.x, v.y, v.z]; const u = new V3(...r.az).normalize(); r.az = [u.x, u.y, u.z]; }
      out.push(r);
    }
  }
  out.push(rows[n - 1]);
  return out;
}
// The swept rings repeat their first column at the end (for the texture's seam): give both the same normal so no seam shows.
function weldSeams(g) {
  const p = g.attributes.position, n = g.attributes.normal, map = new Map();
  for (let i = 0; i < p.count; i++) {
    const k = Math.round(p.getX(i) * 1e5) + ',' + Math.round(p.getY(i) * 1e5) + ',' + Math.round(p.getZ(i) * 1e5);
    const e = map.get(k); if (e) e.push(i); else map.set(k, [i]);
  }
  for (const list of map.values()) if (list.length > 1) {
    const s = new V3(); for (const i of list) s.add(new V3(n.getX(i), n.getY(i), n.getZ(i))); s.normalize();
    for (const i of list) n.setXYZ(i, s.x, s.y, s.z);
  }
}

// ── Regions of skin, so what's under clothes can be hidden ────────────────────────────────────────────────────────────────────────────────────
const R = { HEAD: 0, CHEST: 1, WAIST: 2, HIPS: 3, SEAT: 4, THIGH: 5, KNEE: 6, SHIN: 7, UPARM: 8, FOREARM: 9, HAND: 10, WAIST_HI: 11, HIPS_LO: 12, FOOT: 13 };

// ── The body's shape, from sex, mass (muscle and frame, 0–1) and fat (softness, 0–1). ──────────────────────────────────────────────────────────
function shapeOf(o) {
  const f = o.sex === 'f', m = o.mass == null ? 0.5 : o.mass, fat = o.fat == null ? 0.4 : o.fat;
  const W = 0.9 + 0.2 * m + 0.12 * fat;                 // overall girth
  return {
    f, m, fat, W,
    shoulder: (f ? 0.92 : 1.04) * (0.94 + 0.12 * m),
    chest: f ? 0.9 : 1.0, waist: (f ? 0.82 : 0.97) * (0.9 + 0.12 * m + 0.25 * fat), hip: (f ? 1.12 : 0.98) * (0.94 + 0.08 * m + 0.14 * fat),
    glute: (f ? 0.034 : 0.022) * (0.75 + 0.5 * fat + 0.3 * m), belly: 0.035 * fat * (f ? 0.8 : 1.1),
    bust: f ? lerp(0.016, 0.07, o.bust == null ? 0.4 : o.bust) * (0.8 + 0.5 * fat) : 0.006 * m,
    limb: (f ? 0.9 : 1.0) * (0.88 + 0.18 * m + 0.14 * fat), thigh: (f ? 1.05 : 1.0) * (0.9 + 0.12 * m + 0.2 * fat),
  };
}
// The torso, crotch to under the skull: [y, rx, zF, zB, glute, bust, belly, cleft]
function torsoRings(S, inflate, bridge) {
  const sh = S.shoulder, hp = S.hip, w = S.waist, ch = S.chest, t = inflate || 0;
  const rows = [
    [0.795, 0.09 * hp, 0.045, 0.06, 0.15, 0, 0],
    [0.83, 0.135 * hp, 0.07, 0.092, 0.85, 0, 0],
    [0.875, 0.158 * hp, 0.085, 0.11, 1, 0, 0],
    [0.925, 0.162 * hp, 0.092, 0.104, 0.75, 0, 0.2],
    [0.98, 0.152 * lerp(hp, w, 0.4), 0.094, 0.088, 0.2, 0, 0.6],
    [1.04, 0.142 * w, 0.094, 0.082, 0, 0, 1],
    [1.10, 0.146 * lerp(w, ch, 0.5), 0.098, 0.084, 0, 0, 0.7],
    [1.17, 0.152 * ch, 0.104, 0.09, 0, 0.3, 0.2],
    [1.24, 0.158 * ch, 0.11, 0.095, 0, 0.85, 0],
    [1.30, 0.162 * lerp(ch, sh, 0.4), 0.112, 0.098, 0, 1, 0],
    [1.36, 0.17 * sh, 0.104, 0.098, 0, 0.45, 0],
    [1.41, 0.162 * sh, 0.085, 0.092, 0, 0, 0],
    [1.438, 0.14 * sh, 0.072, 0.08, 0, 0, 0],
    [1.462, 0.104 * sh, 0.06, 0.066, 0, 0, 0],
    [1.482, 0.07, 0.054, 0.057, 0, 0, 0],
    [1.52, 0.056 * (S.f ? 1 : 1.12), 0.05 * (S.f ? 1 : 1.1), 0.054 * (S.f ? 1 : 1.1), 0, 0, 0],
    [1.585, 0.052 * (S.f ? 1 : 1.1), 0.048 * (S.f ? 1 : 1.1), 0.05 * (S.f ? 1 : 1.1), 0, 0, 0],
  ];
  const mus = 0.6 + 0.8 * S.m, soft = bridge ? 0.5 : 1;
  const pec = S.f ? 0 : 0.011 * mus;
  return rows.map(([y, rx, zF, zB, gl, bu, be]) => {
    const R0 = { c: [0, y, 0.0], rx: rx * (y > 1.5 ? 1 : S.W) + t, zF: (zF + be * S.belly) * S.W + t, zB: zB * S.W + t, p: y > 1.44 ? 2 : 2.25 };
    const pc = pec * gauss(y - 1.31, 0.045), sca = 0.006 * mus * gauss(y - 1.35, 0.05) * soft, grv = y > 0.99 && y < 1.43 ? 0.0045 * ss(0.99, 1.06, y) * ss(1.43, 1.36, y) * (bridge ? 0 : 1) : 0;
    const obl = 0.004 * mus * gauss(y - 1.0, 0.04) * soft;      // (the obliques, over the hips)
    R0.lobes = th => {
      let a = 0;
      if (gl) {
        const l = gauss(angDiff(th, -Math.PI / 2 + 0.62), 0.5), r = gauss(angDiff(th, -Math.PI / 2 - 0.62), 0.5);
        a += gl * S.glute * (bridge ? Math.max(l, r) * 1.05 + 0.25 * gauss(angDiff(th, -Math.PI / 2), 0.4) : l + r);
        if (!bridge) a -= gl * S.glute * 0.85 * gauss(angDiff(th, -Math.PI / 2), 0.1);
      }
      if (bu) {
        const l = gauss(angDiff(th, Math.PI / 2 - 0.62), 0.38), r = gauss(angDiff(th, Math.PI / 2 + 0.62), 0.38);
        a += bu * S.bust * (bridge ? Math.max(l, r) + 0.6 * gauss(angDiff(th, Math.PI / 2), 0.45) : l + r);
      }
      if (pc) a += pc * (gauss(angDiff(th, Math.PI / 2 - 0.55), 0.42) + gauss(angDiff(th, Math.PI / 2 + 0.55), 0.42)) * (bridge ? 0.6 : 1);
      if (sca) a += sca * (gauss(angDiff(th, -Math.PI / 2 + 0.75), 0.35) + gauss(angDiff(th, -Math.PI / 2 - 0.75), 0.35));
      if (grv) a -= grv * gauss(angDiff(th, -Math.PI / 2), 0.09);
      if (obl) a += obl * (gauss(angDiff(th, 0.25), 0.4) + gauss(angDiff(th, Math.PI - 0.25), 0.4));
      return a;
    };
    return R0;
  });
}
// A leg, from the hip joint (+0.06, buried) to the ankle: [dy, rx, zF, zB, centre x, centre z]
function legRings(S, side, inflate, from, to) {
  const t = inflate || 0, hx = (S.f ? 0.095 : 0.09) * side, L = S.limb, T = S.thigh;
  const rows = [
    [0.07, 0.096 * T, 0.09 * T, 0.1 * T, 0, 0], [0.0, 0.092 * T, 0.088 * T, 0.094 * T, 0, 0], [-0.08, 0.086 * T, 0.084 * T, 0.084 * T, -0.002, 0.004],
    [-0.18, 0.076 * T, 0.075 * T, 0.072 * T, -0.004, 0.006], [-0.29, 0.064 * lerp(T, L, 0.5), 0.062, 0.058, -0.005, 0.006],
    [-0.37, 0.053 * L, 0.054 * L, 0.05 * L, -0.005, 0.006], [-0.42, 0.048 * L, 0.051 * L, 0.046 * L, -0.005, 0.008],
    [-0.47, 0.047 * L, 0.048 * L, 0.05 * L, -0.005, 0.004], [-0.56, 0.05 * L, 0.043 * L, 0.06 * L, -0.005, 0], [-0.66, 0.043 * L, 0.036 * L, 0.046 * L, -0.005, 0],
    [-0.76, 0.033 * L, 0.03 * L, 0.033 * L, -0.005, -0.006], [-0.82, 0.03, 0.03, 0.03, -0.005, -0.008], [-0.86, 0.026, 0.028, 0.026, -0.005, -0.008],
  ];
  return rows.filter(r => r[0] <= (from == null ? 9 : from) + 1e-6 && r[0] >= (to == null ? -9 : to) - 1e-6)
    .map(([dy, rx, zF, zB, cx, cz]) => {
      const y = 0.90 + dy, R0 = { c: [hx + cx * side, y, cz], rx: rx + t, zF: zF + t, zB: zB + t, p: 2.1 };
      // the muscles: quads down the front, the inner one bulging above the knee, the kneecap, the calf (the inner head higher and fuller)
      const mus = (0.6 + 0.8 * S.m) * (t > 0.003 ? 0.45 : 1), IN = side > 0 ? Math.PI : 0, OUT = side > 0 ? 0 : Math.PI, toward = (a, b, k) => a + angDiff(b, a) * k;
      const F_ = Math.PI / 2, B_ = -Math.PI / 2;
      const quad = 0.006 * mus * gauss(y - 0.68, 0.08), vmo = 0.007 * mus * gauss(y - 0.55, 0.035), vl = 0.004 * mus * gauss(y - 0.7, 0.08), pat = 0.006 * gauss(y - 0.475, 0.022) * (t > 0.003 ? 0.3 : 1);
      const ham = 0.003 * mus * gauss(y - 0.66, 0.08), gm = 0.012 * mus * gauss(y - 0.37, 0.05), gl = 0.008 * mus * gauss(y - 0.39, 0.04), mal = 0.004 * gauss(y - 0.1, 0.016);
      R0.lobes = th => quad * gauss(angDiff(th, F_), 0.7) + vmo * gauss(angDiff(th, toward(F_, IN, 0.5)), 0.45) + vl * gauss(angDiff(th, OUT), 0.6) + pat * gauss(angDiff(th, F_), 0.35)
        + ham * gauss(angDiff(th, B_), 0.7) + gm * gauss(angDiff(th, toward(B_, IN, 0.45)), 0.5) + gl * gauss(angDiff(th, toward(B_, OUT, 0.45)), 0.45) + mal * (gauss(angDiff(th, IN), 0.35) + gauss(angDiff(th, OUT), 0.35));
      return R0;
    });
}
// An arm, hanging, from over the shoulder joint to the wrist: [y, rx (side), rz (front/back), centre x]
function armRings(S, side, inflate, to) {
  const t = inflate || 0, L = S.limb, sx = (S.f ? 0.175 : 0.195) * side;
  const rows = [[1.466, 0.026, 0.026, -0.03], [1.452, 0.042, 0.042, -0.016], [1.43, 0.051, 0.05, -0.008], [1.38, 0.052, 0.05, 0.0], [1.30, 0.048, 0.048, 0.006], [1.22, 0.046, 0.045, 0.01],
    [1.145, 0.039, 0.041, 0.014], [1.07, 0.044, 0.042, 0.016], [0.98, 0.037, 0.032, 0.018], [0.90, 0.029, 0.023, 0.02], [0.875, 0.027, 0.021, 0.02]];
  const mus = (0.6 + 0.8 * S.m) * (t > 0.003 ? 0.4 : 1), OUT = side > 0 ? 0 : Math.PI, IN = side > 0 ? Math.PI : 0, F_ = Math.PI / 2, B_ = -Math.PI / 2, toward = (a, b, k) => a + angDiff(b, a) * k;
  return rows.filter(r => r[0] >= (to == null ? 0 : to) - 1e-6).map(([y, rx, rz, cx]) => {
    const R0 = { c: [sx + cx * side, y, -0.01 + (y < 1.14 ? 0.008 : 0)], rx: rx * L + t, zF: rz * L + t, zB: rz * L + t, p: 2 };
    // the deltoid capping the shoulder, the biceps and triceps, the point of the elbow, the forearm's swell below it
    const del = 0.009 * mus * gauss(y - 1.4, 0.04), bic = 0.008 * mus * gauss(y - 1.25, 0.045), tri = 0.007 * mus * gauss(y - 1.32, 0.05);
    const elb = 0.004 * gauss(y - 1.145, 0.016) * (t > 0.003 ? 0.3 : 1), brr = 0.006 * mus * gauss(y - 1.06, 0.04), flx = 0.004 * mus * gauss(y - 1.04, 0.05);
    R0.lobes = th => del * (gauss(angDiff(th, OUT), 0.9) + 0.5 * gauss(angDiff(th, F_), 0.5)) + bic * gauss(angDiff(th, F_), 0.55) + tri * gauss(angDiff(th, B_), 0.6)
      + elb * gauss(angDiff(th, B_), 0.4) + brr * gauss(angDiff(th, toward(F_, OUT, 0.5)), 0.5) + flx * gauss(angDiff(th, toward(F_, IN, 0.5)), 0.5);
    return R0;
  });
}

// ── Making a figure ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const SPOTS = ['cheekL', 'cheekR', 'sitspotL', 'sitspotR', 'thighsL', 'thighsR'];
const SPOT_AT = { cheek: 0.875, sitspot: 0.825, thighs: 0.76 };

function make(spec) {
  spec = Object.assign({ sex: 'm', height: 1.75, mass: 0.5, fat: 0.4, skin: '#c8987a', hair: '#3a2a20', hairStyle: 'crop', eyes: '#4a5a4a', lips: null,
    outfit: 'uniform', dept: '#c89a3a', beard: false }, spec || {});
  if (GLB.sex[spec.sex] && spec.model !== 'built') return makeGLB(spec, GLB.sex[spec.sex]);
  const S = shapeOf(spec), F = { spec, S, root: new THREE.Group(), bone: {}, bones: [] };
  // (the heights posing works from, in the figure's own units: the pelvis, the ankle, the pelvis over what it sits on; the arms' rest angle out)
  F.H = { hips: 0.95, ankle: 0.08, sit: 0.13, abd: 0, waist: 1.0, blades: 1.3, shoulder: [S.f ? 0.15 : 0.165, 1.41] };
  F.root.scale.setScalar(spec.height / 1.75);

  // Skeleton
  const BI = {};
  for (const [name, parent, x, y, z] of skeletonSpec(spec.sex)) {
    const b = new THREE.Bone(); b.name = name; b.position.set(x, y, z);
    (parent ? F.bone[parent] : F.root).add(b); F.bone[name] = b; BI[name] = F.bones.length; F.bones.push(b);
  }
  F.root.updateMatrixWorld(true);
  F.skeleton = new THREE.Skeleton(F.bones);
  F.bindM = F.root.matrixWorld.clone();      // (every skinned part binds with the rest pose's matrix, whenever it's made: clothes are remade mid-scene)
  const rest = {}; for (const b of F.bones) rest[b.name] = b.getWorldPosition(new V3());
  F.rest = rest;
  const w = (name, v) => [BI[name], v];
  const side = x => (x >= 0 ? 'L' : 'R');

  // Weights: smooth blends across each joint.
  function torsoW(P) {
    const [x, y] = P, ax = Math.abs(x), s = side(x), out = [];
    const toThigh = ss(0.93, 0.79, y) * ss(0.01, 0.08, ax) * 0.55;      // (the cheek's lower part rides partly with its thigh: enough to round as the leg moves, not so much that it turns with it)
    const sp = ss(0.98, 1.13, y), chs = ss(1.15, 1.30, y), nk = ss(1.47, 1.535, y), hd = ss(1.55, 1.6, y);
    const cl = ss(0.09, 0.15, ax) * ss(1.34, 1.43, y) * (1 - nk);
    let hips = (1 - sp) * (1 - toThigh), spine = sp * (1 - chs), chest = chs * (1 - nk) * (1 - cl);
    out.push(w('hips', hips), w('thigh' + s, toThigh * (1 - sp)), w('spine', spine), w('chest', chest), w('clav' + s, cl * 0.6), w('upperArm' + s, cl * 0.4), w('neck', nk * (1 - hd)), w('head', hd));
    // the cheek's flesh rides a little on its own bone, for its give when it's struck
    const gC = rest['glute' + s], gd = (x - gC.x) ** 2 + (y - gC.y) ** 2 * 0.8, gw = 0.7 * Math.exp(-gd / (2 * 0.05 * 0.05)) * ss(-0.02, -0.07, P[2]);
    if (gw > 0.01) { for (const e of out) e[1] *= 1 - gw; out.push(w('glute' + s, gw)); }
    return out;
  }
  function legW(P) {
    const y = P[1], s = side(P[0]);
    const th = ss(0.99, 0.86, y), sh = ss(0.54, 0.43, y), ft = ss(0.13, 0.065, y);
    return [w('hips', 1 - th), w('thigh' + s, th * (1 - sh)), w('shin' + s, sh * (1 - ft)), w('foot' + s, ft)];
  }
  function armW(P) {
    const y = P[1], s = side(P[0]);
    const ua = ss(1.47, 1.39, y), fa = ss(1.18, 1.10, y), hd = ss(0.915, 0.865, y);
    return [w('chest', (1 - ua) * 0.35), w('clav' + s, (1 - ua) * 0.65), w('upperArm' + s, ua * (1 - fa)), w('foreArm' + s, fa * (1 - hd)), w('hand' + s, hd)];
  }
  const torsoRegion = P => P[1] >= 1.47 ? R.HEAD : P[1] >= 1.15 ? R.CHEST : P[1] >= 1.085 ? R.WAIST_HI : P[1] >= 1.03 ? R.WAIST : P[1] >= 0.958 ? R.HIPS : P[1] >= 0.935 ? R.HIPS_LO : R.SEAT;
  const legRegion = P => P[1] >= 0.958 ? R.HIPS : P[1] >= 0.93 ? R.HIPS_LO : P[1] >= 0.61 ? R.THIGH : P[1] >= 0.38 ? R.KNEE : R.SHIN;
  const armRegion = P => P[1] >= 1.14 ? R.UPARM : P[1] >= 0.88 ? R.FOREARM : R.HAND;

  // ── The body ──
  const BB = Builder(), skinC = () => [1, 1, 1];
  BB.sweep(torsoRings(S), 48, { weights: torsoW, region: torsoRegion, capBottom: true, color: skinC });
  for (const sd of [1, -1]) {
    BB.sweep(legRings(S, sd), 22, { weights: legW, region: legRegion, color: skinC, flip: true });
    BB.sweep(armRings(S, sd), 18, { weights: armW, region: armRegion, color: skinC, capBottom: true, flip: true });
    handGeo(BB, S, sd, BI, w, rest);
  }
  const bodyGeo = BB.geometry();
  const skinM = tmat(spec.skin, { skin: true, regions: true, marks: true, bindAttr: true, unique: true, rim: '#6a5048', rimK: 0.5 });
  F.body = skinned(F, bodyGeo, skinM); F.body.castShadow = true; F.body.receiveShadow = false;
  F.skinMat = skinM;
  { const hm = dqs(paint(new THREE.MeshBasicMaterial({ color: srgb(INK), side: THREE.BackSide, skinning: true }), { regions: true, grain: 0 })); hm.userData.u.uHide = skinM.userData.u.uHide; ink(F.body, INK_W, F, hm); }

  spotsOn(F, bodyGeo, area => [area === 'thighs' ? 0.088 : 0.078, SPOT_AT[area]]);

  // ── Head, face and hair ──
  buildHead(F, spec, S);
  // ── Boots ──
  for (const sd of [1, -1]) buildBoot(F, spec, sd, BI, w);

  // ── Clothes ──
  F.clothes = {};
  F.state = { top: 'down', bottoms: 'up', under: 'up' };
  F.setClothes = st => { Object.assign(F.state, st || {}); dress(F, spec, S, BI, w, torsoW, legW, armW); };
  F.setClothes();
  F.setOutfit = (outfit, dept) => { spec.outfit = outfit; if (dept) spec.dept = dept; F.setClothes(); };

  finish(F, spec);
  return F;
}

// The seat's spots: the point on the back of the seat nearest each place (at(area) → [x from the middle, y]), for aiming at and marking; and the
// marks themselves.
function spotsOn(F, bodyGeo, at, reach) {
  reach = reach || 0.03;
  F.spot = {};
  {
    const p = bodyGeo.attributes.position, n = bodyGeo.attributes.normal, reg = bodyGeo.attributes.region;
    for (const k of SPOTS) {
      const area = k.slice(0, -1), sd = k.slice(-1) === 'L' ? 1 : -1, [ax, ty] = at(area), tx = ax * sd;
      // (the outermost point there: the cheek's own surface, not the top of a leg tube buried inside it: of the points within 3 cm, the one
      // furthest back)
      let best = -1, bd = 1e9, bz = 1e9;
      const ok = i => n.getZ(i) <= -0.55 && [R.SEAT, R.HIPS, R.HIPS_LO, R.THIGH].includes(reg.getX(i));
      for (let i = 0; i < p.count; i++) { if (!ok(i)) continue; const d = Math.hypot(p.getX(i) - tx, p.getY(i) - ty); if (d < reach && p.getZ(i) < bz) { bz = p.getZ(i); best = i; } }
      if (best < 0) for (let i = 0; i < p.count; i++) { if (!ok(i)) continue; const d = Math.hypot(p.getX(i) - tx, p.getY(i) - ty); if (d < bd) { bd = d; best = i; } }
      F.spot[k] = { i: best, bind: new V3(p.getX(best), p.getY(best), p.getZ(best)), mark: 0 };
    }
  }
  const _a = new V3(), _b = new V3();
  // A spot's place and outward normal in the world, as the body is posed now (and lifted off the skin by `lift`, for cloth over it).
  F.surface = (k, out, lift) => {
    const sp = F.spot[k] || F.anchor[k], g = F.body.geometry, i = sp.i;
    F.body.boneTransform(i, _a); _a.applyMatrix4(F.body.matrixWorld);
    // (the normal: from where a point a little way out along the rest normal goes)
    const nx = g.attributes.normal.getX(i), ny = g.attributes.normal.getY(i), nz = g.attributes.normal.getZ(i);
    const pos = g.attributes.position, sx = pos.getX(i), sy = pos.getY(i), sz = pos.getZ(i);
    pos.setXYZ(i, sx + nx * 0.05, sy + ny * 0.05, sz + nz * 0.05);
    F.body.boneTransform(i, _b); _b.applyMatrix4(F.body.matrixWorld); pos.setXYZ(i, sx, sy, sz);
    out = out || { p: new V3(), n: new V3() };
    out.n.copy(_b).sub(_a).normalize(); out.p.copy(_a).addScaledVector(out.n, (lift || 0) * F.root.scale.x);
    return out;
  };
  anchorsOn(F, bodyGeo);
  F.mark = (k, amt) => { const sp = F.spot[k]; sp.mark = clamp(sp.mark + amt, 0, 1); syncMarks(); };
  F.clearMarks = () => { for (const k of SPOTS) F.spot[k].mark = 0; syncMarks(); };
  function syncMarks() {
    SPOTS.forEach((k, i) => { const sp = F.spot[k]; F.skinMat.userData.u.uMarks.value[i].set(sp.bind.x, sp.bind.y, sp.bind.z, sp.mark); });
    if (F.underMat) SPOTS.forEach((k, i) => { const sp = F.spot[k]; F.underMat.userData.u.uMarks.value[i].set(sp.bind.x, sp.bind.y, sp.bind.z, sp.mark * 0.25); });
  }
  syncMarks();
}
// Places on the body for a hand to rest (F.surface takes them as it does the spots): the outer side of the waist, just over the hip, on each side
// (sideL, sideR), the small of the back (back), between the shoulder blades (blades), and the back of the top of each shoulder (shoulderL, shoulderR).
function anchorsOn(F, geo) {
  const p = geo.attributes.position, n = geo.attributes.normal, reg = geo.attributes.region, yW = F.H.waist;
  const torso = [R.CHEST, R.WAIST, R.WAIST_HI, R.HIPS, R.HIPS_LO, R.SEAT];
  const pick = (score, y) => { y = y == null ? yW : y; let best = -1, bs = -1e9; for (let i = 0; i < p.count; i++) { if (!torso.includes(reg.getX(i)) || Math.abs(p.getY(i) - y) > 0.012) continue; const v = score(i); if (v > bs) { bs = v; best = i; } } return best; };
  F.anchor = {};
  for (const [k, sx] of [['sideL', 1], ['sideR', -1]]) { const i = pick(j => (sx * n.getX(j) > 0.75 ? sx * p.getX(j) : -1e9)); F.anchor[k] = { i, bind: new V3(p.getX(i), p.getY(i), p.getZ(i)) }; }
  { const [sx0, sy0] = F.H.shoulder, sh = [...torso, R.UPARM];
    for (const [k, sx] of [['shoulderL', 1], ['shoulderR', -1]]) {
      let best = -1, bs = -1e9;
      for (let i = 0; i < p.count; i++) { if (!sh.includes(reg.getX(i)) || Math.abs(p.getX(i) - sx * sx0) > 0.02 || Math.abs(p.getY(i) - sy0) > 0.03 || n.getZ(i) > -0.3) continue; const v = -p.getZ(i) + 0.5 * p.getY(i); if (v > bs) { bs = v; best = i; } }
      F.anchor[k] = { i: best, bind: new V3(p.getX(best), p.getY(best), p.getZ(best)) };
    } }
  for (const [k, y] of [['back', yW], ['blades', F.H.blades]]) { const i = pick(j => (Math.abs(p.getX(j)) < 0.015 && n.getZ(j) < -0.7 ? -p.getZ(j) : -1e9), y); F.anchor[k] = { i, bind: new V3(p.getX(i), p.getY(i), p.getZ(i)) }; }
  // (Fenwick: where a raised skirt's roll lies, just above her hips (her back, and each side); and her middle back, with her ribs at each side)
  const L = F.L || {}, yRoll = L.rollY || yW - 0.07, yMid = (yW + F.H.blades) / 2;
  for (const [k, y] of [['roll', yRoll], ['mid', yMid]]) { const i = pick(j => (Math.abs(p.getX(j)) < 0.015 && n.getZ(j) < -0.7 ? -p.getZ(j) : -1e9), y); F.anchor[k] = { i, bind: new V3(p.getX(i), p.getY(i), p.getZ(i)) }; }
  for (const [k, sx, y] of [['rollL', 1, yRoll], ['rollR', -1, yRoll], ['ribL', 1, yMid], ['ribR', -1, yMid]]) { const i = pick(j => (sx * n.getX(j) > 0.75 ? sx * p.getX(j) : -1e9), y); F.anchor[k] = { i, bind: new V3(p.getX(i), p.getY(i), p.getZ(i)) }; }
}
// Expression and life: the face easing between expressions, blinking, breathing, the hands' grip, the rest pose, the flesh's give.
function finish(F, spec) {
  F.expr = flatExpr('calm'); F.exprTo = flatExpr('calm'); F.exprName = 'calm'; F.drawn = {};
  F.setExpr = (name, o) => { if (EXPRS[name]) { F.exprTo = flatExpr(name); F.exprName = name; if (o) Object.assign(F.exprTo, o); } };      // (o: any of it overridden, e.g. where the eyes look)
  F.t = Math.random() * 10; F.blink = 2 + Math.random() * 3; F.breath = 0.3; F.gaze = new V3(0, 0, 1);
  F.resp = { r: 0, lift: 0, ang: 0 }; F.blushAdd = 0; if (!F.setResponse) F.setResponse = (r, o) => { F.resp.r = clamp(r || 0, 0, 1); F.blushAdd = (o && o.blush) || 0; };
  F.tick = dt => tickFace(F, dt);
  F.rest0 = {}; for (const b of F.bones) F.rest0[b.name] = b.position.clone();
  F.grip = (s, curl, spread, thumb) => grip(F, s, curl, spread, thumb);
  F.resetPose = () => { for (const b of F.bones) { b.rotation.set(0, 0, 0); b.position.copy(F.rest0[b.name]); } F.grip('L'); F.grip('R'); };
  // The flesh's give: a struck cheek pushed in and springing back, and the other answering a little (a damped spring each).
  F.jig = { L: { x: 0, v: 0 }, R: { x: 0, v: 0 } };
  F.impact = (s, power) => { F.jig[s].v += 0.32 * power; F.jig[s === 'L' ? 'R' : 'L'].v += 0.08 * power; };
  F.resetPose();
}

// A hand: the palm (the thumb's pad bulging on its inner side), four fingers of two joints each with rounded tips, and the thumb. Every part
// built along its own bone's line in the rest pose (the hand hanging, palm in, thumb forward), weighted down its length so each joint bends.
function handGeo(BB, S, sd, BI, w, rest) {
  const s = sd > 0 ? 'L' : 'R', k = (S.f ? 0.92 : 1) * HAND_K, H = rest['hand' + s], PALM = sd > 0 ? Math.PI : 0, OUTS = sd > 0 ? 0 : Math.PI;
  const v = a => new V3(a[0], a[1], a[2]);
  // the palm: from inside the wrist to the knuckles; thick at the heel, wide across the knuckles
  const yk = rest['middle1' + s].y, zc = H.z + 0.001 * k;
  const prow = [[H.y + 0.012, 0.016, 0.024], [H.y - 0.006, 0.017, 0.031], [H.y - 0.03, 0.0175, 0.039], [H.y - 0.06, 0.016, 0.043], [yk + 0.01, 0.0135, 0.044], [yk - 0.004, 0.011, 0.04]];
  const hw = P => { const kn = ss(yk + 0.006, yk - 0.008, P[1]); const near = f => Math.exp(-((P[2] - rest[f + '1' + s].z) ** 2) / 0.00012); let tot = 0; const out = [];
    for (const f of FINGERS) { const ww = kn * near(f); tot += ww; out.push(w(f + '1' + s, ww)); } out.push(w('hand' + s, Math.max(0.001, 1 - tot))); return out; };
  BB.sweep(prow.map(([y, rx, rz]) => ({ c: [H.x + 0.002 * sd, y, zc], rx: rx * k, zF: rz * k, zB: rz * k, p: 2.6,
    lobes: th => 0.007 * k * gauss(angDiff(th, PALM + (sd > 0 ? -0.6 : 0.6)), 0.5) * gauss(y - (H.y - 0.035), 0.022) + 0.003 * k * gauss(angDiff(th, OUTS), 0.8) * gauss(y - (H.y - 0.05), 0.03) })),
    16, { weights: hw, region: () => R.HAND, capTop: true, capBottom: false, flip: true, smooth: 1 });
  // a finger (or the thumb): rings round its line from base through its joint to the tip, weighted hand → first joint → second
  const digit = (b1, b2, len2, r0, r1, base) => {
    const A = v([rest[b1].x, rest[b1].y, rest[b1].z]), J = v([rest[b2].x, rest[b2].y, rest[b2].z]), d1 = J.clone().sub(A).normalize();
    const T = J.clone().addScaledVector(d1, len2), Bp = A.clone().addScaledVector(d1, -base), len = T.distanceTo(Bp), dir = T.clone().sub(Bp).normalize();
    // its cross-section's axes: across the back of the hand (x) and across the finger (z), perpendicular to its line
    const ax = new V3(1, 0, 0).addScaledVector(dir, -dir.x).normalize(), az = new V3().crossVectors(ax, dir).negate().normalize();
    const st = [0, 0.18, 0.4, 0.55, 0.72, 0.88, 0.96, 1], rr = [1.05, 1.0, 0.96, 0.9, 0.86, 0.8, 0.62, 0.25];
    const rings = st.map((u, i) => { const P = Bp.clone().addScaledVector(dir, u * len), r = lerp(r0, r1, u) * rr[i] / lerp(1, 0.85, u);
      return { c: [P.x, P.y, P.z], rx: r * 0.86, zF: r, zB: r, p: 2.2, ax: [ax.x, ax.y, ax.z], az: [az.x, az.y, az.z] }; });
    const jt = A.distanceTo(J), wf = P => { const u = new V3(P[0], P[1], P[2]).sub(A).dot(d1); const a1 = ss(base * 0.3, base + 0.004, u + base), a2 = ss(jt - 0.006, jt + 0.006, u);
      return [w('hand' + s, 1 - a1), w(b1, a1 * (1 - a2)), w(b2, a1 * a2)]; };
    BB.sweep(rings, 12, { weights: wf, region: () => R.HAND, capTop: true, flip: true, smooth: 1 });
  };
  const fr = { index: [0.0098, 0.0082, 0.036], middle: [0.0102, 0.0085, 0.04], ring: [0.0096, 0.008, 0.037], pinky: [0.0084, 0.007, 0.03] };
  for (const f of FINGERS) digit(f + '1' + s, f + '2' + s, fr[f][2] * k, fr[f][0] * k, fr[f][1] * k, 0.016 * k);
  digit('thumb1' + s, 'thumb2' + s, 0.03 * k, 0.012 * k, 0.0095 * k, 0.012 * k);
}
// How a hand is held: curl (0 flat … 1 a fist), spread (fingers fanned), thumb (in across the palm).
function grip(F, s, curl, spread, thumb) {
  const sg = s === 'L' ? -1 : 1, c = curl == null ? 0.25 : curl, sp = spread || 0, th = thumb == null ? 0.25 : thumb;
  FINGERS.forEach((f, i) => {
    const b1 = F.bone[f + '1' + s], b2 = F.bone[f + '2' + s];
    b1.rotation.set((i - 1.4) * -0.1 * sp, 0, sg * c * (1.25 + 0.08 * i)); b2.rotation.set(0, 0, sg * c * 1.45);
  });
  F.bone['thumb1' + s].rotation.set(-0.35 * th, sg * 0.25 * th, sg * 0.55 * th); F.bone['thumb2' + s].rotation.set(0, 0, sg * 0.6 * th);
}

function buildBoot(F, spec, sd, BI, w) {
  const s = sd > 0 ? 'L' : 'R', BB = Builder(), x = (spec.sex === 'f' ? 0.095 : 0.09) * sd - 0.005 * sd, k = spec.sex === 'f' ? 0.93 : 1;
  const bw = P => { const t = ss(0.095, 0.13, P[2] / k); return [w('foot' + s, 1 - t), w('toe' + s, t)]; };
  // the shaft, round the ankle
  BB.sweep([[0.0, 0.04], [0.06, 0.042], [0.12, 0.04], [0.19, 0.041]].map(([y, r]) => ({ c: [x, y, -0.01], rx: r, zF: r * 1.05, zB: r * 1.05 })), 18,
    { weights: () => [w('foot' + s, 1)], capBottom: false, capTop: false });
  // the foot: rings from heel to toe, flat underneath
  const rows = [[-0.07, 0.02, 0.03], [-0.05, 0.036, 0.05], [0.0, 0.042, 0.06], [0.05, 0.045, 0.052], [0.10, 0.048, 0.042], [0.14, 0.046, 0.034], [0.18, 0.04, 0.026], [0.205, 0.028, 0.018], [0.215, 0.012, 0.01]];
  const pos = [], idx = [], seg = 16;
  const base = BB.pos.length / 3;
  rows.forEach(([z, hwid, hh], i) => {
    for (let j = 0; j <= seg; j++) {
      const th = (j / seg) * Math.PI * 2, c = Math.cos(th), sn = Math.sin(th), up = sn > 0;
      const P = [x + c * hwid * k, Math.max(0, 0.005 + (up ? sn * hh * 1.0 : sn * 0.01)) + (up ? 0.012 : 0), z * k + 0.01];
      P[1] = Math.max(P[1], 0.0);
      BB.vert(P, [0, 0, 0], [j / seg, i / rows.length], { weights: bw });
    }
  });
  const n = seg + 1;
  for (let i = 0; i < rows.length - 1; i++) for (let j = 0; j < seg; j++) {
    const a = base + i * n + j, b = a + 1, c = a + n, d = c + 1; BB.idx.push(a, b, c, b, d, c);
  }
  const g = BB.geometry(), col = spec.outfit === 'offduty' ? '#4a3424' : '#1e2024';
  const m = skinned(F, g, tmat(col, { skin: true, rim: '#3a4048', rimK: 0.4 })); m.castShadow = true; F['boot' + s] = m; ink(m, INK_W, F);
}

// ── Clothes, from the same rings, out a little from the skin ─────────────────────────────────────────────────────────────────────────────────
const OUTFITS = {
  // Uniform: Meridian's own duty jacket: slate blue, hip length, closing on a diagonal from the right collarbone to the left hip (a light seam
  // along the edge), a low stand collar in the same cloth, a webbing belt; the department's colour only as a flash on the left shoulder and a
  // band at each cuff. Charcoal trousers with stitched knee panels, black boots.
  uniform: { tunic: '#3e5262', trousers: '#2a2e34', pipe: null, under: '#4a4e56', sleeves: 'long', hem: 0.86, collar: true, edge: '#c8c0ae', belt: '#1e2226' },
  // Off duty: a worn henley with the sleeves pushed up (bone buttons down its placket), canvas trousers with a contrast outer seam, brown boots (frontier-practical).
  offduty: { tunic: '#8a5a3c', trousers: '#5a4a38', pipe: '#3a2a1e', under: '#cfc6b4', sleeves: 'rolled', hem: 0.86, collar: false, edge: '#d8ccb0' },
};
// Off duty, a heroine wears their own (spec.off, from Cast: offduty), over Silas's as the default; which top, legs and shoes, as the
// patterns number them.
const TOPS = { henley: 0, thermal: 2, open: 3, waistcoat: 4, cardigan: 5, tee: 6, sweatervest: 7 }, LEGS = { canvas: 0, joggers: 1, chinos: 2, work: 3, combat: 4, pressed: 5 };
const SHOES = { boots: 0, soft: 1, deck: 2, work: 3, sneakers: 4, flats: 5, loafers: 6 };
// (and spec.wear over either: someone who wears the uniform in colours of their own, the Proctor)
function outfitOf(spec) { let O = OUTFITS[spec.outfit] || OUTFITS.uniform; if (spec.outfit === 'offduty' && spec.off) O = Object.assign({}, O, spec.off); return spec.wear ? Object.assign({}, O, spec.wear) : O; }
function dress(F, spec, S, BI, w, torsoW, legW, armW) {
  for (const k in F.clothes) { const m = F.clothes[k]; for (const x of [m, m.userData.hull]) if (x) { x.parent.remove(x); x.geometry.dispose(); } }
  F.clothes = {};
  const O = outfitOf(spec), st = F.state;
  const add = (key, BB, m) => { const sm = skinned(F, BB.geometry(), m); sm.castShadow = true; sm.receiveShadow = false; F.clothes[key] = sm; ink(sm, INK_W, F); return sm; };
  let hide = 0; const H = r => { hide |= 1 << r; };

  // The top: the tunic (or shirt), hem down over the hips, or raised and rolled above the waist.
  {
    const BB = Builder(), dept = srgb(spec.dept), main = srgb(O.tunic), dark = srgb(shade(O.tunic, -0.25));
    const hem = st.top === 'up' ? 1.075 : O.hem, inf = 0.012;
    const rings = torsoRings(S, inf, true).filter(r => r.c[1] >= hem - 0.03);
    rings[0].c[1] = hem;
    // the hem hangs from the widest of the hips: never narrower than the cloth just above it, and flaring a little
    if (st.top !== 'up') { const r1 = rings.find(r => r.c[1] > hem + 0.005) || rings[1]; rings[0].rx = Math.max(rings[0].rx, r1.rx) + 0.006; rings[0].zB = Math.max(rings[0].zB, r1.zB) + 0.01; rings[0].zF = Math.max(rings[0].zF, r1.zF) + 0.005; rings[0].lobes = r1.lobes; }
    // a rolled band where it's raised
    if (st.top === 'up') { const r0 = rings[0]; rings.unshift({ c: [0, hem - 0.012, r0.c[2]], rx: r0.rx + 0.012, zF: r0.zF + 0.012, zB: r0.zB + 0.012, p: 2.2 }); }
    const top = rings[rings.length - 1]; top.c[1] = O.collar ? 1.545 : 1.50; top.rx = O.collar ? 0.062 : 0.075; top.zF = O.collar ? 0.058 : 0.07; top.zB = O.collar ? 0.062 : 0.068;
    BB.sweep(rings, 36, { weights: torsoW, bindAttr: true, region: () => 0 });
    const sleeveTo = O.sleeves === 'long' ? 0.885 : 1.03;
    for (const sd of [1, -1]) {
      const ar = armRings(S, sd, 0.01, sleeveTo); ar[ar.length - 1].c[1] = sleeveTo;
      if (O.sleeves === 'rolled') { const r = ar[ar.length - 1]; ar.push({ c: [r.c[0], sleeveTo - 0.02, r.c[2]], rx: r.rx + 0.008, zF: r.zF + 0.008, zB: r.zB + 0.008 }); ar[ar.length - 2].rx += 0.01; ar[ar.length - 2].zF += 0.01; ar[ar.length - 2].zB += 0.01; }
      BB.sweep(ar, 18, { weights: armW, capBottom: true, flip: true, region: () => 1 });
    }
    const tm = tmat(O.tunic, { skin: true, side: THREE.DoubleSide, rim: '#2a3440', rimK: 0.6, pattern: 'tunic', bindAttr: true, unique: true }), U = tm.userData.u;
    U.uPat0.value.copy(srgb(spec.dept)); U.uPat1.value.copy(srgb(O.edge || shade(O.tunic, -0.4))); U.uPat2.value.copy(srgb(O.belt || '#222'));
    U.uParam.value.set(hem, st.top === 'up' ? 1 : 0, S.f ? 0.175 : 0.195, spec.outfit === 'uniform' ? 1 : 0);
    add('top', BB, tm);
    H(R.CHEST); H(R.UPARM); H(R.WAIST_HI); if (O.sleeves === 'long') H(R.FOREARM); if (st.top !== 'up') { H(R.WAIST); }
  }
  // The trousers: up to the waist, or lowered and bunched at the knees.
  {
    const BB = Builder(), main = srgb(O.trousers), inf = 0.009, tc = () => null;
    const trm = () => { const m = tmat(O.trousers, { skin: true, side: THREE.DoubleSide, rim: '#2a3440', rimK: 0.6, pattern: 'trousers', bindAttr: true, unique: true }), U = m.userData.u;
      U.uPat0.value.copy(srgb(O.pipe || spec.dept)); U.uParam.value.set(0, st.bottoms === 'down' ? 1 : 0, S.f ? 0.095 : 0.09, spec.outfit === 'uniform' ? 1 : 0); return m; };
    if (st.bottoms !== 'down') {
      const waist = 1.035, rings = torsoRings(S, inf, true).filter(r => r.c[1] <= waist + 0.06 && r.c[1] >= 0.79);
      rings[rings.length - 1].c[1] = waist;
      BB.sweep(rings, 36, { weights: torsoW, capBottom: true });
      for (const sd of [1, -1]) {
        const lr = legRings(S, sd, inf + 0.004, 0.0, -0.82).map(r => (r.c[1] < 0.2 ? Object.assign(r, { rx: r.rx + 0.012, zF: r.zF + 0.014, zB: r.zB + 0.012 }) : r));
        lr[lr.length - 1].c[1] = 0.12;
        BB.sweep(lr, 22, { weights: legW, flip: true });
      }
      // the waistband (and the braces, off duty)
      add('bottoms', BB, trm());
      H(R.HIPS); H(R.HIPS_LO); H(R.SEAT); H(R.THIGH); H(R.KNEE); H(R.SHIN);
    } else {
      // lowered: the waistband round the knees, the cloth gathered in rolls above the boots, a sag of cloth between the legs
      for (const sd of [1, -1]) {
        const lr = legRings(S, sd, inf, -0.38, -0.82).map(r => {
          const y = r.c[1], bunch = ss(0.58, 0.46, y) * ss(0.30, 0.42, y), wob = Math.sin(y * 160) * 0.006 * bunch;
          return Object.assign(r, { rx: r.rx + 0.03 * bunch + wob + (y < 0.2 ? 0.012 : 0.006), zF: r.zF + 0.026 * bunch + wob + 0.006, zB: r.zB + 0.03 * bunch + wob + 0.008 });
        });
        lr[0].c[1] = 0.555; lr[lr.length - 1].c[1] = 0.12;
        lr.unshift({ c: [lr[0].c[0], 0.565, lr[0].c[2]], rx: lr[0].rx - 0.006, zF: lr[0].zF - 0.006, zB: lr[0].zB - 0.006 });
        BB.sweep(lr, 22, { weights: legW, flip: true });
      }
      sag(BB, S, 0.545, 0.47, 0.06, legW, null, inf + 0.03);
      add('bottoms', BB, trm());
      H(R.SHIN);
    }
  }
  // Underwear: briefs (fuller-cut trunks for the men), up, or lowered round the thighs.
  {
    const BB = Builder(), inf = 0.006, col = O.under;
    if (st.under !== 'down') {
      const top = S.f ? 0.965 : 0.985, rings = torsoRings(S, inf, true).filter(r => r.c[1] <= top + 0.06 && r.c[1] >= 0.79);
      rings[rings.length - 1].c[1] = top;
      BB.sweep(rings, 36, { weights: torsoW, capBottom: true });
      const legTo = S.f ? -0.05 : -0.11;
      for (const sd of [1, -1]) { const lr = legRings(S, sd, inf + 0.002, 0.0, legTo - 0.01); lr[lr.length - 1].c[1] = 0.9 + legTo; BB.sweep(lr, 22, { weights: legW, flip: true }); }
      H(R.SEAT); H(R.HIPS_LO);
    } else {
      for (const sd of [1, -1]) {
        const lr = legRings(S, sd, inf + 0.004, -0.18, -0.30);
        lr.forEach(r => { r.rx += 0.004; r.zF += 0.004; r.zB += 0.004; });
        lr[0].c[1] = 0.70; lr[lr.length - 1].c[1] = 0.655;
        BB.sweep(lr, 22, { weights: legW, flip: true });
      }
      sag(BB, S, 0.70, 0.665, 0.03, legW, null, inf + 0.01);
    }
    F.underMat = tmat(col, { skin: true, side: THREE.DoubleSide, marks: true, bindAttr: true, unique: true, markCol: shade(col, -0.2), rim: '#2a3440', rimK: 0.5 });
    add('under', BB, F.underMat);
  }
  F.skinMat.userData.u.uHide.value = hide;
}
// A band of cloth hanging between the two legs (lowered trousers or briefs), from y0 down to y1, sagging by `drop`.
function sag(BB, S, y0, y1, drop, legW, col, inf) {
  const hx = S.f ? 0.095 : 0.09, nx = 10, ny = 4, base = BB.pos.length / 3;
  for (let j = 0; j <= ny; j++) for (let i = 0; i <= nx; i++) {
    const u = i / nx, v = j / ny, x = lerp(hx - 0.04, -(hx - 0.04), u), mid = Math.sin(u * Math.PI);
    const y = lerp(y0, y1, v) - drop * mid * (0.5 + 0.5 * v), z = -0.02 - inf - 0.02 * mid;
    const P = [x, y, z];
    BB.vert(P, [0, 0, 0], [u, v], { weights: Q => { const a = legW([hx, Q[1]]), b = legW([-hx, Q[1]]); return a.map(e => [e[0], e[1] * (1 - u)]).concat(b.map(e => [e[0], e[1] * u])); },
      color: col ? () => [col.r, col.g, col.b] : null });
  }
  for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) { const a = base + j * (nx + 1) + i, b = a + 1, c = a + nx + 1, d = c + 1; BB.idx.push(a, b, c, b, d, c); }
}

// ── The head ─────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
// Redlessons' toon head (js/toon.js), built in its own units (about 0.056 m each, times the head scale): the cranium a ball sitting back a little,
// the face hung in front of it, its planes turning at the cheekbones, a jaw that angles down and forward and tapers to a squared chin. Each slice is
// a rounded box (a superellipse). The face's features are painted onto a thin layer over its surface, and redrawn as the expression changes, so
// everything morphs smoothly. HEAD_K: metres per head unit at head scale 1. HEAD_SCALE: the toon lean (1 = real proportions; redlessons used 1.34).
const HEAD_K = 0.056, HEAD_SCALE = 1.12;
const FACE = { eyeX: 0.66, eyeY: 0, eyeW: 0.95, eyeH: 1, iris: 1, jaw: 0.88, browY: 0.4, noseY: -0.4, noseSize: 1, mouthY: 0.1, mouthSize: 1.15, blushSize: 1, earSize: 1.1 };
const HEADK = [
  [2.12, 0.05, 0.1, 0.1, 2, 2], [1.95, 0.95, 0.9, 1.04, 2, 2], [1.55, 1.36, 1.38, 1.5, 2.05, 2], [0.95, 1.55, 1.64, 1.72, 2.3, 2.05],
  [0.25, 1.57, 1.74, 1.72, 2.8, 2.15], [-0.35, 1.53, 1.73, 1.55, 3.0, 2.4], [-0.95, 1.42, 1.66, 0.95, 3.1, 2.6], [-1.45, 1.18, 1.56, 0.35, 3.0, 2.6],
  [-1.85, 0.84, 1.44, -0.25, 2.9, 2.6], [-2.08, 0.5, 1.33, -0.72, 2.7, 2.5], [-2.2, 0.28, 1.2, -0.9, 2.5, 2.4], [-2.24, 0.03, 1.04, -0.88, 2.2, 2.2],
];
function headShape(jaw) {
  const R = HEADK.map(([y, w, f, b, nf, nb]) => [y < 0 ? y * 0.88 : y, w * (y < 0 ? lerp(1, jaw, ss(-0.1, -1.4, y)) : 1), f, b, nf, nb]);
  const at = y => {
    const n = R.length; y = clamp(y, R[n - 1][0], R[0][0]); let i = 0; while (i < n - 2 && y < R[i + 1][0]) i++;
    const a = R[i], b = R[i + 1], t = (y - a[0]) / (b[0] - a[0]), h = b[0] - a[0], out = [];
    for (let k = 1; k < 6; k++) {
      const sl = j => { const p = R[Math.max(0, j - 1)], q = R[Math.min(n - 1, j + 1)]; return (q[k] - p[k]) / (q[0] - p[0]); };
      const t2 = t * t, t3 = t2 * t; out.push((2 * t3 - 3 * t2 + 1) * a[k] + (t3 - 2 * t2 + t) * h * sl(i) + (-2 * t3 + 3 * t2) * b[k] + (t3 - t2) * h * sl(i + 1));
    }
    return { w: Math.max(0.01, out[0]), f: out[1], b: out[2], nf: out[3], nb: out[4] };
  };
  const pw = (c, n) => Math.sign(c) * Math.pow(Math.abs(c), 2 / n);
  // u round from the back through the front (seam down the back), v crown to chin
  const point = (u, v, out) => { const y = lerp(R[0][0], R[R.length - 1][0], (1 - Math.cos(Math.PI * v)) / 2), H = at(y), a = (u - 0.5) * 2 * Math.PI, c = Math.cos(a), sn = Math.sin(a), n = c > 0 ? H.nf : H.nb;
    const zc = (H.f - H.b) / 2, dz = (H.f + H.b) / 2; return (out || new V3()).set(H.w * pw(sn, n), y, zc + dz * pw(c, n)); };
  const faceZ = (x, y) => { const H = at(y), zc = (H.f - H.b) / 2, dz = (H.f + H.b) / 2, q = Math.abs(x) / H.w; return q >= 1 ? zc : zc + dz * Math.pow(1 - Math.pow(q, H.nf), 1 / H.nf); };
  return { R, at, point, faceZ, top: R[0][0], chin: R[R.length - 1][0] };
}
function surfaceGeo(fn, NU, NV) {
  const pos = [], uv = [], idx = [], p = new V3();
  for (let v = 0; v <= NV; v++) for (let u = 0; u <= NU; u++) { fn(u / NU, v / NV, p); pos.push(p.x, p.y, p.z); uv.push(u / NU, 1 - v / NV); }
  for (let v = 0; v < NV; v++) for (let u = 0; u < NU; u++) { const a = v * (NU + 1) + u, b = a + 1, c = a + NU + 1, d = c + 1; idx.push(a, c, b, b, c, d); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); weldSeams(g); return g;
}
function buildHead(F, spec, S) {
  const K = FACE, HS = HEAD_SCALE, k = HEAD_K * (spec.headScale || HS), Hs = headShape(K.jaw * (S.f ? 1 : spec.sex === 'n' ? 1.03 : 1.06));
  const H = new THREE.Group(); H.scale.setScalar(k); H.position.set(0, -0.012 - Hs.chin * k * 0.92, 0.012); F.bone.head.add(H); F.head = H;
  const P = { skin: spec.skin, lips: spec.lips || shade(spec.skin, S.f ? -0.22 : -0.12), eyes: spec.eyes, hair: spec.hair, hairDk: shade(spec.hair, -0.35), beard: shade(spec.hair, -0.2) };
  const MAN = !S.f, OLD = (spec.age || 0) >= 45, ANDRO = spec.sex === 'n';      // (non-gendered: between the two, neither's marks)
  const skinM = tmat(spec.skin, { rim: '#6a5048', rimK: 0.5 });
  const head = new THREE.Mesh(surfaceGeo(Hs.point, 40, 40), skinM); head.castShadow = true; H.add(head); ink(head, 0.06);
  for (const sx of [-1, 1]) { const e = new THREE.Mesh(new THREE.SphereGeometry(1, 14, 10), skinM); e.scale.set(0.24 * K.earSize, 0.44 * K.earSize, 0.34 * K.earSize); e.position.set(sx * (Hs.at(0).w - 0.04), 0, -0.1); H.add(e); ink(e, 0.05); }
  { const N = K.noseSize, g = new THREE.SphereGeometry(1, 16, 12); g.scale(0.15 * N, 0.36 * N, 0.17 * N); const n = new THREE.Mesh(g, skinM); n.position.set(0, K.noseY + 0.08 * N, Hs.faceZ(0, K.noseY) - 0.07); n.rotation.x = -0.42; H.add(n); }
  // The face layer and its canvas
  const FX0 = -1.62, FX1 = 1.62, FY0 = -2.05, FY1 = 1.45, FW = 512, FH = Math.round(FW * (FY1 - FY0) / (FX1 - FX0));
  const fcan = document.createElement('canvas'); fcan.width = FW; fcan.height = FH; const fx = fcan.getContext('2d');
  const ftex = new THREE.CanvasTexture(fcan); ftex.encoding = THREE.sRGBEncoding; ftex.anisotropy = 4;
  { const NX = 40, NY = 44, pos = [], uv = [], idx = [];
    for (let j = 0; j <= NY; j++) for (let i = 0; i <= NX; i++) { const x = lerp(FX0, FX1, i / NX), y = lerp(FY0, FY1, j / NY); pos.push(x, y, Hs.faceZ(x, y) + 0.012); uv.push(i / NX, j / NY); }
    for (let j = 0; j < NY; j++) for (let i = 0; i < NX; i++) { const a = j * (NX + 1) + i, b = a + 1, c = a + NX + 2, d = a + NX + 1; idx.push(a, b, c, a, c, d); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2)); g.setIndex(idx); g.computeVertexNormals();
    const m = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: ftex, transparent: true, alphaTest: 0.02, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, toneMapped: false }));
    m.renderOrder = 2; H.add(m); F.faceLayer = m; }
  const px = x => (x - FX0) / (FX1 - FX0) * FW, py = y => (FY1 - y) / (FY1 - FY0) * FH, U = FW / (FX1 - FX0);
  const INKC = '#2a1612', lipsDk = shade(P.lips, -0.4);
  function drawEye(sx, E, open) {
    const cx = sx * K.eyeX, cy = K.eyeY, rx = 0.43 * K.eyeW, ry = 0.3 * K.eyeH, shut = clamp(1 - open, 0, 1), drop = 2 * ry * shut, pt = (x, y) => [px(cx + x), py(cy + y)];
    const ell_ = (x, y, a, b) => { fx.beginPath(); fx.ellipse(px(cx + x), py(cy + y), a * U, b * U, 0, 0, 7); };
    if (shut < 0.85 && !((E.sq || 0) > 0.5 && shut > 0.6)) {
      fx.save(); ell_(0, 0, rx, ry); fx.clip();
      fx.beginPath(); fx.ellipse(px(cx), py(cy - drop), rx * U, ry * U, 0, Math.PI, 2 * Math.PI); fx.lineTo(...pt(rx, -ry - 2)); fx.lineTo(...pt(-rx, -ry - 2)); fx.closePath(); fx.clip();
      ell_(0, 0, rx, ry); fx.fillStyle = '#fffaf2'; fx.fill();
      const ix = (E.look || 0) * 0.06 * sx * sx, ki = K.iris;
      fx.fillStyle = P.eyes; ell_(ix, 0, 0.22 * ki, 0.27 * ki); fx.fill();
      fx.fillStyle = shade(P.eyes, -0.4); ell_(ix, 0.11 * ki, 0.19 * ki, 0.11 * ki); fx.fill();
      fx.fillStyle = '#1c1210'; ell_(ix, 0, 0.09 * ki, 0.11 * ki); fx.fill();
      fx.fillStyle = '#ffffff'; ell_(ix + 0.07 * ki, 0.09 * ki, 0.06 * ki, 0.06 * ki); fx.fill();
      fx.restore();
    }
    const ly = -0.5 * shut * K.eyeH, ar = 0.4 * K.eyeW, br = 0.4 * 0.72 * K.eyeH;
    fx.strokeStyle = INKC; fx.lineCap = 'round'; fx.lineWidth = (ANDRO ? 0.08 : MAN ? 0.065 : 0.1) * U;
    const sq = (E.sq || 0) > 0.5 && shut > 0.6;
    fx.beginPath(); if (sq) fx.ellipse(px(cx), py(cy + ly + 0.62 * br), ar * U, br * 0.7 * U, 0, 0.2, Math.PI - 0.2); else fx.ellipse(px(cx), py(cy + ly), ar * U, br * U, 0, Math.PI + 0.15, 2 * Math.PI - 0.15); fx.stroke();
    if (MAN) return;
    const wx = sx * 0.42 * K.eyeW, wy = (sq ? 0.05 - 0.5 * shut : 0.13 - 0.55 * shut) * K.eyeH, wl = 0.11 * K.eyeW, wa = sx * (sq ? -0.5 : 0.45);
    fx.lineWidth = 0.07 * U; fx.beginPath(); fx.moveTo(...pt(wx - Math.cos(wa) * wl, wy - Math.sin(wa) * wl)); fx.lineTo(...pt(wx + Math.cos(wa) * wl, wy + Math.sin(wa) * wl)); fx.stroke();
  }
  function drawBrow(sx, E) {
    const by = K.browY + E.browY, inX = sx * (K.eyeX - 0.3 * K.eyeW), outX = sx * (K.eyeX + 0.42 * K.eyeW), inY = by + E.brow * 0.3, outY = by - 0.06 - E.brow * 0.08;
    fx.strokeStyle = P.hairDk; fx.lineCap = 'round';
    for (let i = 0; i < 6; i++) { const t0 = i / 6, t1 = (i + 1) / 6, at = t => [lerp(inX, outX, t), lerp(inY, outY, t) + 0.09 * Math.sin(Math.PI * t)];
      const [x0, y0] = at(t0), [x1, y1] = at(t1); fx.lineWidth = lerp(0.105, 0.045, t1) * U * (ANDRO ? 1.25 : MAN ? 1.55 : 1); fx.beginPath(); fx.moveTo(px(x0), py(y0)); fx.lineTo(px(x1), py(y1)); fx.stroke(); }
  }
  function drawMouth(E) {
    const s_ = E.ms * K.mouthSize, w = E.mw * s_, cy = -1.2 + K.mouthY, c = E.mc, o = E.mo * s_, l = -w / 2, r = w / 2, cornerY = cy + c * 0.12;
    const upMid = cy + 0.02 - c * 0.04, loMid = cy - o * 0.32 - c * 0.04 - 0.01;
    if (o > 0.03) {
      fx.beginPath(); fx.moveTo(px(l), py(cornerY)); fx.quadraticCurveTo(px(0), py(upMid + (upMid - cornerY)), px(r), py(cornerY)); fx.quadraticCurveTo(px(0), py(loMid + (loMid - cornerY)), px(l), py(cornerY));
      fx.fillStyle = '#6a2026'; fx.fill();
      if (E.mt > 0.02) { fx.save(); fx.clip(); fx.fillStyle = '#fbf6ee'; const th = lerp(0.07, 0.5, E.mt) * Math.max(0.05, o * 0.32 + 0.02); fx.fillRect(px(l), py(upMid + 0.05), w * U, (th + 0.05) * U); if (E.mt > 0.7) fx.fillRect(px(l), py(loMid + 0.02 + th * 0.4), w * U, th * 0.5 * U); fx.restore(); }
      fx.strokeStyle = lipsDk; fx.lineWidth = 0.035 * U; fx.stroke();
      fx.fillStyle = P.lips; fx.globalAlpha = 0.85; fx.beginPath(); fx.ellipse(px(0), py(loMid - 0.035), w * 0.28 * U, 0.04 * U, 0, 0, 7); fx.fill(); fx.globalAlpha = 1;
    } else {
      fx.strokeStyle = lipsDk; fx.lineCap = 'round'; fx.lineWidth = 0.045 * U;
      fx.beginPath(); fx.moveTo(px(l), py(cornerY)); fx.quadraticCurveTo(px(0), py(upMid + (upMid - cornerY)), px(r), py(cornerY)); fx.stroke();
      fx.fillStyle = P.lips; fx.globalAlpha = ANDRO ? 0.5 : MAN ? 0.3 : 0.75; fx.beginPath(); fx.ellipse(px(0), py(cy - 0.08 - c * 0.03), w * 0.22 * U, 0.045 * U, 0, 0, 7); fx.fill(); fx.globalAlpha = 1;
    }
  }
  function paintFace(E, open) {
    fx.clearRect(0, 0, FW, FH);
    if (E.blush > 0.02) for (const sx of [-1, 1]) {
      const bx = px(sx * 0.98), byp = py(-0.42), r = 0.42 * K.blushSize * U, g = fx.createRadialGradient(bx, byp, 0, bx, byp, r);
      g.addColorStop(0, `rgba(240,120,120,${0.55 * E.blush})`); g.addColorStop(1, 'rgba(240,120,120,0)');
      fx.save(); fx.translate(bx, byp); fx.scale(1, 0.55); fx.translate(-bx, -byp); fx.fillStyle = g; fx.fillRect(bx - r, byp - r, 2 * r, 2 * r); fx.restore();
    }
    if (spec.beard) { fx.save(); fx.globalAlpha = 0.24; fx.fillStyle = P.beard; fx.beginPath(); fx.ellipse(px(0), py(-1.55), 1.35 * U, 0.75 * U, 0, 0, 7); fx.fill(); fx.beginPath(); fx.ellipse(px(0), py(K.noseY - 0.42), 0.55 * U, 0.16 * U, 0, 0, 7); fx.fill(); fx.restore(); }
    fx.strokeStyle = shade(P.skin, -0.3); fx.lineWidth = 0.035 * U; fx.lineCap = 'round'; fx.beginPath(); fx.arc(px(0.02), py(K.noseY - 0.12 * K.noseSize), 0.1 * K.noseSize * U, Math.PI * 0.15, Math.PI * 0.75); fx.stroke();
    if (E.tears > 0.05) for (const sx of [-1, 1]) {
      const x = sx * (K.eyeX - 0.05), y0 = K.eyeY - lerp(0.2, 0.4, clamp(1 - open, 0, 1)) * K.eyeH, len = 0.75 * E.tears;
      fx.strokeStyle = 'rgba(150,205,240,0.9)'; fx.lineWidth = 0.08 * U; fx.lineCap = 'round'; fx.beginPath(); fx.moveTo(px(x), py(y0)); fx.quadraticCurveTo(px(x + sx * 0.06), py(y0 - len * 0.5), px(x + sx * 0.02), py(y0 - len)); fx.stroke();
      fx.fillStyle = 'rgba(150,205,240,0.95)'; fx.beginPath(); fx.arc(px(x + sx * 0.02), py(y0 - len), 0.06 * U, 0, 7); fx.fill();
    }
    for (const sx of [-1, 1]) { drawEye(sx, E, open); drawBrow(sx, E); }
    if (OLD) {
      fx.strokeStyle = shade(P.skin, -0.15); fx.lineCap = 'round'; const sm = clamp(E.mc || 0, 0, 1);
      for (const sx of [-1, 1]) {
        fx.lineWidth = 0.04 * U; fx.beginPath(); fx.moveTo(px(sx * 0.42), py(K.noseY - 0.05)); fx.quadraticCurveTo(px(sx * (0.72 + 0.06 * sm)), py(-1.0 + K.mouthY), px(sx * (0.5 + 0.08 * sm)), py(-1.38 + K.mouthY)); fx.stroke();
        fx.lineWidth = 0.03 * U; const ex = sx * (K.eyeX + 0.5 * K.eyeW), ey = K.eyeY;
        for (const [dy, len] of [[0.1, 0.22], [-0.06, 0.26], [-0.22, 0.2]]) { fx.beginPath(); fx.moveTo(px(ex), py(ey + dy * 0.6)); fx.lineTo(px(ex + sx * len * (0.7 + 0.5 * sm)), py(ey + dy)); fx.stroke(); }
      }
    }
    drawMouth(E);
    ftex.needsUpdate = true;
  }
  F.paintFace = paintFace;
  buildHair(F, spec, S, H, Hs, k);
}
// Hair: a cap over the crown, its front edge drawn back to a hairline by tucking the points in front of it inside the head; then the style's shapes.
function buildHair(F, spec, S, H, Hs, k) {
  const style = spec.hairStyle; if (style === 'none') return;
  // (Fenwick: the style built in Blender, where it's loaded (tools/blender/build_hair.py): one mesh in head units, its colour per point multiplied
  // into the hair's; a braid's cap is the swept or side-parted style the plait leaves from (spec.hairCap). His beard likewise. Then the braid, as
  // below. Without the Blender-built hair, the shapes built here.)
  const G = GLB.hair, gname = 'Hair_' + (style === 'braid' ? spec.hairCap || 'swept' : style);
  if (G && G[gname]) {
    const gm = new THREE.Mesh(G[gname], tmat(spec.hair, { rim: '#3a3a4a', rimK: 0.6, vc: true })); gm.castShadow = true; H.add(gm); ink(gm, 0.035); F.hairMesh = gm;
    if (spec.beard && G.Beard_beard) { const bm = new THREE.Mesh(G.Beard_beard, tmat(shade(spec.hair, -0.1), { rim: '#3a3a4a', rimK: 0.5, vc: true })); bm.castShadow = true; H.add(bm); ink(bm, 0.03); }
    if (style === 'braid') braidOf(F, spec, H, tmat(spec.hair, { rim: '#3a3a4a', rimK: 0.6 }));
    return;
  }
  const hm = tmat(spec.hair, { rim: '#3a3a4a', rimK: 0.6 }), put = (geo, x, y, z, rot, sc) => { const m = new THREE.Mesh(geo, hm); m.position.set(x, y, z); if (rot) m.rotation.set(rot[0], rot[1], rot[2]); if (sc) m.scale.set(sc[0], sc[1], sc[2]); m.castShadow = true; H.add(m); ink(m, 0.05); return m; };
  const bob = style === 'bob', vol = style === 'shaved' ? 0.97 : style === 'crop' ? 1.0 : 1.04;
  const cap = new THREE.SphereGeometry(1, 32, 18, 0, Math.PI * 2, 0, Math.PI * (bob ? 0.8 : 0.64)); cap.scale(1.8 * vol, 2.2 * vol, 2.02 * vol);
  { const p = cap.attributes.position, q = new V3();
    for (let i = 0; i < p.count; i++) { q.fromBufferAttribute(p, i); const front = q.z / 2.02, line = lerp(0.15, 1.05, ss(0.25, 0.85, front)); if (front > 0.2 && q.y + 0.1 < line) { q.multiplyScalar(0.8); p.setXYZ(i, q.x, q.y, q.z); }
      if (bob && q.y < -0.2) { const fl = ss(-0.2, -1.6, q.y); q.x *= 1 + 0.12 * fl; q.z *= 1 + 0.08 * fl; p.setXYZ(i, q.x, q.y, q.z); } }
    cap.computeVertexNormals(); }
  const capM = put(cap, 0, 0.32, -0.16);
  if (style === 'shaved') { capM.material = tmat(shade(spec.hair, -0.1), { rim: '#3a3a4a', rimK: 0.4 }); }
  const sph = (r) => new THREE.SphereGeometry(r, 16, 12);
  if (style === 'bun') put(sph(0.62), 0, 1.75, -1.5, null, [1, 0.9, 0.85]);
  if (style === 'short' || style === 'crop') {      // chunky locks at the front and crown
    const n = style === 'short' ? 7 : 4, r = style === 'short' ? 0.42 : 0.3;
    for (let i = 0; i < n; i++) { const a = (i / (n - 1) - 0.5) * 2.0; put(sph(r), Math.sin(a) * 1.25, 1.62 - 0.12 * Math.abs(a), Math.cos(a) * 1.25 - 0.25, [0.3, a, 0], [1, 0.55, 1.3]); }
  }
  if (style === 'curls') for (let i = 0; i < 46; i++) {
    const th = i * 2.399, ph = Math.acos(1 - (i + 0.5) / 46 * 1.3); const d = new V3(Math.sin(ph) * Math.sin(th), Math.cos(ph), Math.sin(ph) * Math.cos(th));
    if (d.z > 0.45 && d.y < 0.55) continue; put(sph(0.36 + 0.08 * Math.sin(i)), d.x * 1.9, 0.32 + d.y * 2.25, -0.16 + d.z * 2.05);
  }
  if (style === 'ponytail') {
    const piv = new THREE.Group(); piv.position.set(0, 1.1, -1.95); H.add(piv);
    const pts = [new V3(0, 0, 0), new V3(0, -0.6, -0.5), new V3(0, -1.9, -0.45), new V3(0, -3.1, -0.15)];
    const tube = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 18, 0.42, 12, false), p = tube.attributes.position;
    for (let i = 0; i < p.count; i++) { const y = -p.getY(i), s2 = lerp(1, 0.3, clamp(y / 3.1, 0, 1)) * (1 + 0.25 * Math.sin(clamp(y / 3.1, 0, 1) * Math.PI)); p.setX(i, p.getX(i) * s2); p.setZ(i, (p.getZ(i) + 0.35) * s2 - 0.35); }
    tube.computeVertexNormals();
    const tail = new THREE.Mesh(tube, hm); tail.castShadow = true; piv.add(tail); ink(tail, 0.05); F.tail = { piv };
    const tie = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.08, 8, 16), tmat('#2a2a2a')); tie.rotation.x = 1.2; piv.add(tie);
  }
  // (Fenwick: a long plait from the nape to the waist, the strands crossing in lobes down its length, tied off with a tuft below the tie;
  // spec.braidLen, in head units, how far it reaches (8: the waist). It hangs with gravity from its pivot, as the ponytail does, carried
  // a little out from the back so it rides over the shoulder blades.)
  if (style === 'braid') braidOf(F, spec, H, hm);
}
// (Fenwick: the plait. Its line runs from inside the gathered hair at the back of the head, out through its pivot and down the back, past the
// tie to the end of the tuft; the tube along it rounded over at the top where the locks gather into it (no hard rim), the strands crossing in
// lobes down to the tie, pinched under it, and a tuft below that flares and tapers in a few wisps. Skinned to a chain of bones down its
// length, each hanging from the one above: the top two held to the head, the rest falling with gravity (verlet, each joint kept its length
// from the one above, the stiffness of the plait near its root easing off down it), kept out of the head and the back. So it bends down its
// length as it falls, over the shoulders, down past the face when she's bent over, rather than swinging stiff from the head as one piece.)
function braidOf(F, spec, H, hm) {
  const len = spec.braidLen || 8, piv = new THREE.Group(); piv.position.set(0, 0.9, -2.0); H.add(piv);
  const TUFT = 0.95, tieAt = new V3(0, -len + 0.15, -0.72);
  const curve = new THREE.CatmullRomCurve3([new V3(0, 0.34, 0.3), new V3(0, 0, 0), new V3(0, -0.7, -0.55), new V3(0, -2.2, -0.85), new V3(0, -len * 0.62, -0.95), new V3(0, -len, -0.7), new V3(0, -len - TUFT, -0.6)]);
  const Lt = curve.getLength(), at = s => curve.getPointAt(clamp(s / Lt, 0, 1));
  const nearest = q => { let best = 0, bd = 1e9; for (let i = 0; i <= 400; i++) { const d = at(Lt * i / 400).distanceToSquared(q); if (d < bd) { bd = d; best = Lt * i / 400; } } return best; };
  const sPiv = nearest(new V3(0, 0, 0)), sTie = nearest(tieAt), N = Math.round(len * 2.2), R0 = 0.4, RAD = 12;
  const segs = Math.round(Lt * 9), geo = new THREE.TubeGeometry(curve, segs, R0, RAD, false), p = geo.attributes.position, c = new V3(), o = new V3();
  for (let j = 0; j <= segs; j++) {
    const sj = Lt * j / segs; c.copy(at(sj));
    const dome = Math.sqrt(Math.max(0, 1 - Math.pow(1 - Math.min(1, sj / 0.5), 2)));      // (the top rounded over)
    let k = 1, side = 0;
    if (sj <= sTie) {
      const t = clamp((sj - sPiv) / (sTie - sPiv), 0, 1), lobe = Math.abs(Math.sin(t * N * Math.PI));
      k = lerp(1.05, 0.55, t) * (0.82 + 0.3 * lobe) * dome; side = Math.sign(Math.sin(t * N * Math.PI)) * 0.08 * lobe * (1 - t * 0.5) * dome;
      k *= 1 - 0.35 * ss(sTie - 0.35, sTie, sj);      // (drawn in under the tie)
    } else {
      const u = (sj - sTie) / (Lt - sTie);      // (the tuft: out from the tie, then tapering to its ends)
      k = u < 0.3 ? lerp(0.36, 0.72, Math.sin(u / 0.3 * Math.PI / 2)) : 0.72 * Math.sqrt(Math.max(0, 1 - Math.pow((u - 0.3) / 0.7, 2.2)));      // (a brush, rounded off)
    }
    for (let v = 0; v <= RAD; v++) {
      const i = j * (RAD + 1) + v; o.fromBufferAttribute(p, i).sub(c);
      const wisp = sj > sTie ? 1 + 0.28 * Math.sin(v / RAD * Math.PI * 2 * 5) * ss(sTie, Lt, sj) : 1;
      o.multiplyScalar(Math.max(k * wisp, 0.004)); p.setXYZ(i, c.x + o.x + side, c.y + o.y, c.z + o.z);
    }
  }
  geo.computeVertexNormals();
  // (the chain: its first joint inside the gathered hair, the second at the pivot, the rest even down to the tuft's end)
  const M = Math.max(4, Math.round((Lt - sPiv) / 0.75)), J = [0, sPiv]; for (let m = 1; m <= M; m++) J.push(sPiv + (Lt - sPiv) * m / M);
  const nb = J.length, restL = J.map(at), bones = [];
  for (let i = 0; i < nb; i++) { const b = new THREE.Bone(); b.position.copy(i ? restL[i].clone().sub(restL[i - 1]) : restL[0]); if (i) bones[i - 1].add(b); bones.push(b); }
  // (each point's weights: full to the bone of the length it's on at that length's middle, shared half and half with the next at a joint)
  const mid = []; for (let i = 0; i < nb - 1; i++) mid.push((J[i] + J[i + 1]) / 2);
  const n = p.count, SI = new Uint16Array(n * 4), SW = new Float32Array(n * 4);
  for (let j = 0; j <= segs; j++) {
    const sj = Lt * j / segs; let a = 0; while (a < mid.length - 1 && sj > mid[a + 1]) a++;
    const t = a < mid.length - 1 ? clamp((sj - mid[a]) / (mid[a + 1] - mid[a]), 0, 1) : 0;
    for (let v = 0; v <= RAD; v++) { const i = j * (RAD + 1) + v; SI[i * 4] = a; SI[i * 4 + 1] = Math.min(a + 1, nb - 2); SW[i * 4] = 1 - t; SW[i * 4 + 1] = t; }
  }
  geo.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(SI, 4)); geo.setAttribute('skinWeight', new THREE.Float32BufferAttribute(SW, 4));
  const mesh = new THREE.SkinnedMesh(geo, tmat(spec.hair, { rim: '#3a3a4a', rimK: 0.6, skin: true })); mesh.castShadow = true; mesh.frustumCulled = false; mesh.customDepthMaterial = DEPTHM;
  mesh.add(bones[0]); piv.add(mesh);
  const hull = new THREE.SkinnedMesh(hullGeo(geo, 0.05), INKM.skinned); hull.frustumCulled = false; piv.add(hull);
  H.updateWorldMatrix(true, true); const skel = new THREE.Skeleton(bones); mesh.bind(skel); hull.bind(skel, mesh.bindMatrix);      // (bound as placed, the head's scale and all: the quaternions' skinning keeps no scale of its own)
  // (the tie, on the bone of the length it's on, across the plait)
  const tb = Math.max(0, mid.findIndex((m, i) => i === mid.length - 1 || sTie < mid[i + 1])), tie = new THREE.Mesh(new THREE.TorusGeometry(0.24, 0.07, 8, 16), tmat(spec.ribbon || '#6a3a2a'));
  tie.position.copy(at(sTie)).sub(restL[tb]); tie.quaternion.setFromUnitVectors(new V3(0, 0, 1), curve.getTangentAt(sTie / Lt)); bones[tb].add(tie); ink(tie, 0.04);
  F.tail = { piv, bones, mesh, restL, X: restL.map(() => new V3()), Xp: restL.map(() => new V3()), W: restL.map(() => new V3()), live: false, sim: true, len: [] };
}
// The plait's chain, a step: the top two joints held where the head has them, the rest falling (verlet, damped), each drawn back toward where
// the head would have it by a stiffness that eases off down the plait, each kept its length from the one above, and out of the head and the
// back; then each bone turned to point at the next. Settled at once where it's first seen, or after the figure's been moved bodily.
const _bq = new THREE.Quaternion(), _bq2 = new THREE.Quaternion(), _bv = new V3(), _bv2 = new V3(), _bm = new THREE.Matrix4(), _bInv = {};
// (the trunk's back, for the plait to lie on: per bone, over its length (y0–y1, in its own frame, unscaled metres), an ellipse across it,
// half-width and half-depth about a middle zc: roughly the body's own, measured)
const BRAID_BODY = [['chest', 0.0, 0.17, 0.135, 0.1, 0.025], ['spine', 0.0, 0.15, 0.12, 0.085, 0.025], ['hips', -0.06, 0.16, 0.15, 0.115, 0.0], ['neck', 0.0, 0.07, 0.06, 0.045, 0.0]];
function tickBraid(F, dt) {
  const T = F.tail, X = T.X, Xp = T.Xp, W = T.W, nb = X.length, s = F.root.scale.x;
  F.root.updateMatrixWorld(true); T.piv.updateMatrixWorld(true);
  for (let i = 0; i < nb; i++) W[i].copy(T.restL[i]).applyMatrix4(T.piv.matrixWorld);
  if (!T.len.length) for (let i = 1; i < nb; i++) T.len[i] = W[i].distanceTo(W[i - 1]);
  const head = F.head, hk = head.matrixWorld.getMaxScaleOnAxis(), rb = 0.32 * hk;      // (the plait's own half-thickness, about)
  _bInv.head = (_bInv.head || new THREE.Matrix4()).copy(head.matrixWorld).invert();
  for (const [b] of BRAID_BODY) if (F.bone[b]) _bInv[b] = (_bInv[b] || new THREE.Matrix4()).copy(F.bone[b].matrixWorld).invert();
  const out = q => {
    // (the head: an ellipsoid round its middle, in head units)
    _bv.copy(q).applyMatrix4(_bInv.head); const ex = _bv.x / 1.8, ey = (_bv.y - 0.15) / 2.2, ez = (_bv.z + 0.05) / 1.88, e = Math.sqrt(ex * ex + ey * ey + ez * ez), m = 1 + rb / hk / 2.3;
    if (e < m) { _bv.set(0, 0.15, -0.05).addScaledVector(_bv2.set(ex * 1.8, ey * 2.2, ez * 1.88), m / Math.max(e, 1e-4)); q.copy(_bv).applyMatrix4(head.matrixWorld); }
    // (the back: an ellipse across each of the trunk's bones, over the length of it)
    for (const [b, y0, y1, ax, az, zc] of BRAID_BODY) {
      if (!F.bone[b]) continue; _bv.copy(q).applyMatrix4(_bInv[b]); if (_bv.y < y0 || _bv.y > y1) continue;
      const r = rb / s, dx = _bv.x / (ax + r), dz = (_bv.z - zc) / (az + r), d = Math.sqrt(dx * dx + dz * dz);
      if (d < 1) { _bv.x /= Math.max(d, 1e-4); _bv.z = zc + (_bv.z - zc) / Math.max(d, 1e-4); q.copy(_bv).applyMatrix4(F.bone[b].matrixWorld); }
    }
  };
  const jump = !T.live || X[1].distanceToSquared(W[1]) > 0.09;
  if (jump) { for (let i = 0; i < nb; i++) { X[i].copy(W[i]); Xp[i].copy(W[i]); } T.live = true; }
  const h = 1 / 60, steps = jump ? 240 : Math.min(8, Math.ceil(Math.min(dt, 0.12) / h)), hs = jump ? h : Math.min(dt, 0.12) / steps, damp = jump ? 0.8 : 0.9;
  // (its end heavier: the joints down it slower to take up a swing and quicker to lose it, each drawn a little toward hanging plumb below the
  // one above, more so toward the tie; and in keeping their lengths, a heavier joint gives less than the lighter one above it)
  const mass = i => 1 + 2.5 * Math.pow((i - 1) / (nb - 2), 2);
  for (let k = 0; k < steps; k++) {
    X[0].copy(W[0]); X[1].copy(W[1]); Xp[0].copy(W[0]); Xp[1].copy(W[1]);
    for (let i = 2; i < nb; i++) {
      const f = (i - 1) / (nb - 2);
      _bv.copy(X[i]).sub(Xp[i]).multiplyScalar(damp * (1 - 0.06 * f)); Xp[i].copy(X[i]); X[i].add(_bv); X[i].y -= 9.8 * hs * hs;
      if (i > 2) { _bv2.copy(X[i - 1]); _bv2.y -= T.len[i]; X[i].lerp(_bv2, 1 - Math.exp(-hs * 1.6 * f * f)); }
      // (its stiffness: the first length held toward where the head has it, as it leaves the tie at the back of the head; the rest each drawn
      // toward going straight on from the one above, less so down the plait: a bend that gravity wins, whichever way up the head is)
      if (i === 2) X[i].lerp(W[i], 1 - Math.exp(-hs * 3));
      else { _bv2.copy(X[i - 1]).sub(X[i - 2]).normalize().multiplyScalar(T.len[i]).add(X[i - 1]); X[i].lerp(_bv2, 1 - Math.exp(-hs * lerp(1.2, 0.2, (i - 3) / Math.max(1, nb - 4)))); }
    }
    for (let it = 0; it < 3; it++) for (let i = 2; i < nb; i++) {
      _bv.copy(X[i]).sub(X[i - 1]); const d = _bv.length() || 1e-6, e = d - T.len[i], wa = i - 1 > 1 ? 1 / mass(i - 1) : 0, wb = 1 / mass(i);
      X[i - 1].addScaledVector(_bv, e / d * wa / (wa + wb)); X[i].addScaledVector(_bv, -e / d * wb / (wa + wb));
      out(X[i]); if (X[i].y < rb) X[i].y = rb;      // (and on the floor)
    }
  }
  // (each bone turned so the next joint lies along the line to where the plait has it)
  T.mesh.getWorldQuaternion(_bq);
  for (let i = 0; i < nb - 1; i++) {
    const B = T.bones[i], a = _bv.copy(T.bones[i + 1].position).normalize().applyQuaternion(_bq), d = _bv2.copy(X[i + 1]).sub(X[i]).normalize();
    _bq2.setFromUnitVectors(a, d).multiply(_bq);      // (its turn in the world)
    B.quaternion.copy(_bq).invert().multiply(_bq2); _bq.copy(_bq2);
  }
}
// (where the end of the plait is, in the world)
const braidTip = F => (F.tail && F.tail.sim ? F.tail.X[F.tail.X.length - 1].clone() : null);

// ── Expressions (redlessons'): the mouth's shapes and each expression's brows, lids, gaze, mouth, blush and tears ──
const MOUTHS = { warm: { mw: 0.46, mc: 0.22, mo: 0, mt: 0 }, flat: { mw: 0.42, mc: 0.05, mo: 0, mt: 0 }, smile: { mw: 0.6, mc: 0.6, mo: 0.06, mt: 0.6 }, frown: { mw: 0.48, mc: -0.5, mo: 0, mt: 0 },
  open: { mw: 0.48, mc: -0.15, mo: 0.8, mt: 0.15 }, gritted: { mw: 0.68, mc: -0.8, mo: 0.3, mt: 1 }, pout: { mw: 0.26, mc: -0.2, mo: 0.1, mt: 0 },
  wail: { mw: 0.6, mc: -0.95, mo: 0.42, mt: 0.25 }, sad: { mw: 0.34, mc: -0.7, mo: 0.06, mt: 0 }, concern: { mw: 0.36, mc: -0.28, mo: 0, mt: 0 }, soft: { mw: 0.44, mc: 0.36, mo: 0, mt: 0 } };
const EXPRS = {
  // (Silas in aftercare: care, warmth and authority in balance; the eyes steady, the brow a touch level and low, the mouth kind)
  caring: { brow: -0.1, browY: -0.03, open: 0.86, mouth: 'warm', blush: 0, ms: 0.95 },
  calm: { brow: 0, browY: 0, open: 0.95, mouth: 'flat', blush: 0, ms: 1 }, smile: { brow: 0.1, browY: 0.08, open: 0.72, mouth: 'smile', blush: 0.35, ms: 1.3 },
  shy: { brow: 0.28, browY: 0.04, open: 0.55, look: -1, mouth: 'concern', blush: 1, ms: 0.8 }, cheeky: { brow: -0.22, browY: 0.12, open: 0.62, look: 1, mouth: 'smile', blush: 0.1, ms: 1.2 },
  defiant: { brow: -0.3, browY: 0.04, open: 0.7, look: 0.5, mouth: 'flat', blush: 0.1, ms: 0.95 },
  pout: { brow: 0.2, browY: -0.04, open: 0.8, look: -0.6, mouth: 'pout', blush: 0.5, ms: 1.35 }, stern: { brow: -0.42, browY: -0.1, open: 0.75, mouth: 'flat', blush: 0, ms: 0.9 },
  surprised: { brow: 0.3, browY: 0.2, open: 1.1, mouth: 'open', blush: 0.3, ms: 0.75 }, wince: { brow: 0.42, browY: 0.08, open: 0.4, mouth: 'frown', blush: 0.65, ms: 1.25 },
  gritted: { brow: 0.6, browY: 0.02, open: 0.1, mouth: 'gritted', blush: 0.9, ms: 1.2, sq: 1 }, crying: { brow: 0.9, browY: 0.02, open: 0.12, mouth: 'wail', blush: 1, tears: 1, ms: 1.45, sq: 1 },
  concerned: { brow: 0.38, browY: 0.06, open: 0.92, mouth: 'concern', blush: 0, ms: 0.95 }, sad: { brow: 0.75, browY: 0.0, open: 0.55, look: -0.4, mouth: 'sad', blush: 0.35, tears: 0.25, ms: 1.0 },
  wistful: { brow: 0.3, browY: 0.05, open: 0.58, mouth: 'soft', blush: 0.25, ms: 1.0 }, tender: { brow: 0.14, browY: 0.02, open: 0, mouth: 'soft', blush: 0.25, ms: 0.95 },
  teary: { brow: 0.38, browY: 0.04, open: 0.7, mouth: 'soft', blush: 0.6, tears: 0.6, ms: 1.0 }, soft: { brow: 0.12, browY: 0.03, open: 0.8, mouth: 'soft', blush: 0.1, ms: 1.0 },
};
const flatExpr = name => { const e = EXPRS[name] || EXPRS.calm, m = MOUTHS[e.mouth] || MOUTHS.flat; return Object.assign({ brow: 0, browY: 0, open: 0.95, look: 0, blush: 0, tears: 0, ms: 1, sq: 0 }, e, m); };
const SEX_REST = 0.46, _sq = new THREE.Quaternion(), _sv = new V3(), _tuckOff = new V3(0, 0.065, 0.035);      // (his, at rest, hangs this far forward of straight down)
function tickFace(F, dt) {
  tickPresence(F, dt);
  F.t += dt;
  const kk = 1 - Math.exp(-dt * 8), x = F.expr, to = F.exprTo;
  for (const key in to) if (typeof to[key] === 'number') x[key] = lerp(x[key] == null ? to[key] : x[key], to[key], kk);
  if (F.blushAdd) x.blush = Math.max(x.blush, F.blushAdd);
  F.blink -= dt; let bl = 0; if (F.blink < 0) { bl = clamp(1 - Math.abs(F.blink + 0.07) / 0.07, 0, 1); if (F.blink < -0.14) F.blink = 2 + Math.random() * 4; }
  const open = clamp(x.open * (1 - bl), 0, 1.15), d = F.drawn;
  let moved = Math.abs((d.open == null ? -9 : d.open) - open) > 0.004;
  for (const key in x) if (!moved && Math.abs((d[key] == null ? -9 : d[key]) - x[key]) > 0.003) moved = true;
  if (moved) { F.paintFace(x, open); Object.assign(d, x); d.open = open; }
  // breathing: the chest rising and the shoulders with it, faster and deeper when worked up (turns only: the skinning keeps volume)
  F.breathT = (F.breathT || 0) + dt * (1.6 + 2.4 * F.breath);
  const b = Math.sin(F.breathT) * (0.012 + 0.022 * F.breath);
  F.bone.chest.rotation.x -= b * 0.6; F.bone.clavL.rotation.z += b * 0.5; F.bone.clavR.rotation.z -= b * 0.5;
  // the flesh's spring: in along the cheek, a little up
  for (const sd of ['L', 'R']) {
    const J = F.jig[sd], wv = 26, z = 0.22;
    J.v += (-wv * wv * J.x - 2 * z * wv * J.v) * dt; J.x += J.v * dt; J.x = clamp(J.x, -0.02, 0.02);
    const g = F.bone['glute' + sd]; g.position.set(F.rest0['glute' + sd].x, F.rest0['glute' + sd].y + 0.35 * J.x, F.rest0['glute' + sd].z + J.x);
  }
  // his: with no response it hangs with gravity, whichever way the body lies (turned from its rest toward the ground, never back through the
  // thighs); as the response rises it lifts away from that toward where the response puts it, straight. Eased: it swings and settles, it
  // never snaps. (About the bone's own x: from down toward forward.)
  if (F.bone.sex) {
    const R = F.resp, b = F.bone.sex; b.parent.getWorldQuaternion(_sq); _sv.set(0, -1, 0).applyQuaternion(_sq.invert());
    // (face down across a lap (F.tuck, from the correction), tucked well forward into it: nothing hanging back between the thighs)
    const grav = Math.max(clamp(Math.atan2(_sv.z, -_sv.y) - (F.L && F.L.sexRest != null ? F.L.sexRest : SEX_REST), 0, 2.0), F.tuck ? 1.55 : 0), u = clamp((R.r - 0.1) / 0.35, 0, 1), want = grav + (R.lift - grav) * u * u * (3 - 2 * u);
    R.ang += (want - R.ang) * (1 - Math.exp(-dt * 2.5)); b.rotation.x = -R.ang;
  }
  // (his scrotum: with gravity alone, from hanging toward forward; face down across a lap it swings forward, out of the way between the thighs)
  if (F.bone.sexS) {
    const R = F.resp, b = F.bone.sexS; b.parent.getWorldQuaternion(_sq); _sv.set(0, -1, 0).applyQuaternion(_sq.invert());
    const want = Math.max(clamp(Math.atan2(_sv.z, -_sv.y), 0, 1.1), F.tuck ? 2.1 : 0);      // (bent over a table, it hangs back of the shaft, which it can't swing through)
    R.angS = (R.angS || 0) + (want - (R.angS || 0)) * (1 - Math.exp(-dt * 2.5)); b.rotation.x = -R.angS;
    // (and tucked, drawn up into the crotch and forward, swung up in front: from behind, between the thighs, at most a sliver of it deep in the
    // gap, nothing hanging back where a stroke could land)
    R.tuckS = (R.tuckS || 0) + ((F.tuck ? 1 : 0) - (R.tuckS || 0)) * (1 - Math.exp(-dt * 2.5));
    b.position.copy(F.rest0.sexS).addScaledVector(_tuckOff, R.tuckS / F.root.scale.x);
  }
  if (F.tail && F.tail.sim) tickBraid(F, dt);
  else if (F.tail) {
    const pv = F.tail.piv, q = new THREE.Quaternion(); pv.parent.getWorldQuaternion(q);
    const down = new V3(0, -1, 0).applyQuaternion(q.invert());
    const kx = 1 - Math.exp(-dt * 5); pv.rotation.x = lerp(pv.rotation.x, Math.atan2(-down.z, -down.y) * 0.85, kx); pv.rotation.z = lerp(pv.rotation.z, Math.atan2(down.x, -down.y) * 0.85, kx);
  }
  if (F.cloth) tickCloth(F, dt);
}


// ── The Blender-built figures (models/fenwick_f.glb, fenwick_m.glb: tools/blender/build_figures.py) ─────────────────────────────────────────────
// Each holds the body (with shape keys toward each extreme of build: muscle, slight, soft, firm, and the bust for her) and the clothing layers over
// it (the uniform's jacket and the off-duty shirt, each down or raised; trousers, up or lowered; briefs, up or lowered; boots), skinned to a
// skeleton named as the one above, in the same units and axes. models/fenwick_meta.json gives each joint's place and the body's landmarks (where
// the hems, cuffs, waist and the rest fall). A figure made from them is posed exactly as a built one, and keeps the toon head, face and hair.
// Figure.preload() loads them (make() builds figures in code until it has); Figure.adopt(meta, sex, arrayBuffer) takes one already in hand.
const GLB = { meta: null, sex: {}, hair: null, ready: null };
function preload(base) {
  if (GLB.ready) return GLB.ready;
  base = base == null ? 'models/' : base;
  if (!THREE.GLTFLoader || typeof fetch === 'undefined') return (GLB.ready = Promise.resolve(false));
  // (Fenwick: the hair too, built in Blender to fit the head: tools/blender/build_hair.py. Without it, the hair is built in code, as before.)
  const hair = fetch(base + 'fenwick_hair.glb').then(r => r.arrayBuffer()).then(adoptHair).catch(e => { console.warn('Figure: no Blender-built hair; building it in code.', e); });
  GLB.ready = fetch(base + 'fenwick_meta.json').then(r => r.json())
    .then(meta => Promise.all(['f', 'm'].map(sx => fetch(base + 'fenwick_' + sx + '.glb').then(r => r.arrayBuffer()).then(buf => adopt(meta, sx, buf)))))
    .then(() => hair).then(() => true).catch(e => { console.warn('Figure: the Blender-built models did not load; building the figures in code.', e); GLB.sex = {}; return false; });
  return GLB.ready;
}
// The hair styles: each a mesh in head units (the head group's space), with its colour per point (darker at the roots) to multiply into the
// hair's own; shared by everyone who wears the style.
function adoptHair(buf) {
  return new Promise((res, rej) => new THREE.GLTFLoader().parse(buf, '', g => {
    GLB.hair = {}; g.scene.traverse(o => { if (o.isMesh) { const geo = o.geometry; geo.userData.shared = true; GLB.hair[o.name.replace(/_\d+$/, '')] = geo; } }); res(GLB.hair);
  }, rej));
}
// (another of them, when it's needed and not before: the non-gendered body, 'n', only for the Proctor if it's chosen so)
function need(sx, base) {
  base = base == null ? 'models/' : base;
  if (GLB.sex[sx]) return Promise.resolve(true);
  return (GLB.ready || preload(base)).then(ok => {
    if (!ok || GLB.sex[sx]) return ok;
    const meta = GLB.meta; if (!meta || !meta[sx]) return false;
    return fetch(base + 'fenwick_' + sx + '.glb').then(r => r.arrayBuffer()).then(buf => adopt(meta, sx, buf)).then(() => true).catch(e => { console.warn('Figure: no model for ' + sx, e); return false; });
  });
}
// (a share of weight added to point i's bone b: in the slot it already has, else in its smallest, whose own share is let go (normed after))
function addWeight(idx, wt, i, b, w) {
  if (!(w > 0) || b == null) return;
  let k = -1; for (let q = 0; q < 4; q++) if (idx[i * 4 + q] === b && wt[i * 4 + q] > 0) k = q;
  if (k < 0) { k = 0; for (let q = 1; q < 4; q++) if (wt[i * 4 + q] < wt[i * 4 + k]) k = q; idx[i * 4 + k] = b; wt[i * 4 + k] = 0; }
  wt[i * 4 + k] += w;
}
function normWeights(wt, i) { const sum = wt[i * 4] + wt[i * 4 + 1] + wt[i * 4 + 2] + wt[i * 4 + 3] || 1; for (let q = 0; q < 4; q++) wt[i * 4 + q] /= sum; }
function adopt(meta, sx, buf) {
  GLB.meta = meta;
  return new Promise((res, rej) => new THREE.GLTFLoader().parse(buf, '', g => { GLB.sex[sx] = prepare(sx, g, meta[sx]); res(GLB.sex[sx]); }, rej));
}
const ARM_BONES = /^(upperArm|foreArm|hand|index|middle|ring|pinky|thumb)/;
// A GLB's meshes made ready to share between figures: joint indices renumbered to the skeleton's order, weights normalised, the rest pose kept
// (`bind`, for the details drawn on the clothes and the marks), each point of the body given its region (for hiding what's under clothes) and each
// point of a top its part (the body 0, a sleeve 1).
function prepare(sx, gltf, M) {
  const joints = Object.assign({}, M.joints), parents = Object.assign({}, M.parents);
  // (his scrotum gets a bone of its own, added here: it swings with gravity alone, never with the lift; placed just below and behind the root
  // once the body's in, from where the scrotum lies)
  if (sx === 'm' && joints.sex) { joints.sexS = joints.sex.slice(); parents.sexS = 'hips'; }
  const order = Object.keys(joints), BIx = {}, L = M.landmarks, mesh = {};
  order.forEach((n, i) => (BIx[n] = i));
  gltf.scene.traverse(o => {
    if (!o.isSkinnedMesh) return;
    const g = o.geometry.clone(), map = o.skeleton.bones.map(b => BIx[b.name]), si = g.attributes.skinIndex, sw = g.attributes.skinWeight, n = si.count;
    const idx = new Uint16Array(n * 4), wt = new Float32Array(n * 4), dom = new Array(n), wmax = sw.normalized ? (sw.array instanceof Uint8Array ? 255 : 65535) : 1;
    for (let i = 0; i < n; i++) {
      const j = [si.getX(i), si.getY(i), si.getZ(i), si.getW(i)], w = [sw.getX(i), sw.getY(i), sw.getZ(i), sw.getW(i)].map(v => v / wmax), t = w[0] + w[1] + w[2] + w[3] || 1;
      let best = 0;
      for (let k = 0; k < 4; k++) { idx[i * 4 + k] = w[k] > 0 ? map[j[k]] : 0; wt[i * 4 + k] = w[k] / t; if (w[k] > w[best]) best = k; }
      dom[i] = order[map[j[best]]];
    }
    const name = o.name.replace(/_\d+$/, ''), p = g.attributes.position, reg = new Float32Array(n);
    // (the neck's upper part goes with the head, more of it the higher it is: as the head tips back, the nape stays under the skull rather
    // than standing out behind it)
    if (name === 'Body') {
      const y0 = M.joints.neck[1] + 0.004, y1 = M.joints.head[1] + 0.006, hb = BIx.head;
      for (let i = 0; i < n; i++) {
        if (dom[i] !== 'neck' && dom[i] !== 'head') continue;
        const u = clamp((p.getY(i) - y0) / (y1 - y0), 0, 1), t = u * u * (3 - 2 * u); if (t <= 0) continue;
        let k0 = -1;
        for (let k = 0; k < 4; k++) { wt[i * 4 + k] *= 1 - t; if (idx[i * 4 + k] === hb) k0 = k; }
        if (k0 < 0) { k0 = 0; for (let k = 1; k < 4; k++) if (wt[i * 4 + k] < wt[i * 4 + k0]) k0 = k; wt[i * 4 + k0] = 0; idx[i * 4 + k0] = hb; }
        wt[i * 4 + k0] += t; const sum = wt[i * 4] + wt[i * 4 + 1] + wt[i * 4 + 2] + wt[i * 4 + 3]; for (let k = 0; k < 4; k++) wt[i * 4 + k] /= sum;
      }
    }
    // (the upper arm's hold kept to the arm and the cap of the shoulder: Blender's weights spread it over the chest and the upper back nearly to
    // the middle, so a raised arm hauled the ribcage up and out with it. Below the shoulder joint the arm takes over from the ribcage within a
    // centimetre or two, at the armpit's crease: a point there half the one's and half the other's turns half as far as the arm, and halfway
    // from down to overhead is straight out sideways, so a wide handover there stands the armpit out as a wing; a narrow one leaves a hollow,
    // the side of the ribcage going on up into the arm. Over the shoulder's top, a wider fade (toward the collarbone, from the neck out). What
    // the arm lets go of goes to the chest bone (the ribcage) and, up toward the shoulder's top, the collarbone; the body and every garment
    // alike, so the clothes go with the skin.)
    const lin = new Float32Array(n);      // (the armpits blended straight across: see DQS_PARS)
    for (const s of ['L', 'R']) {
      const ua = BIx['upperArm' + s], cl = BIx['clav' + s], jx = Math.abs(M.joints['upperArm' + s][0]), jy = M.joints['upperArm' + s][1], pit = L.armpit;
      if (ua == null || !(pit > 0)) continue;
      const sx = s === 'L' ? 1 : -1, xb = jx - 0.014, sm = (a, b, x) => { const u = clamp((x - a) / (b - a), 0, 1); return u * u * (3 - 2 * u); };
      const trunk = [BIx.chest, BIx.spine, cl, BIx.neck];
      for (let i = 0; i < n; i++) {
        const x = p.getX(i) * sx, y = p.getY(i); if (x < -0.01 || y < pit - 0.2 || y > jy + 0.1) continue;
        const near = sm(pit - 0.13, pit - 0.07, y);      // (the armpit, not the waist below it, where the arm hangs clear of her side)
        lin[i] = Math.max(lin[i], near * (1 - sm(jy - 0.04, jy - 0.005, y)) * sm(xb - 0.05, xb - 0.03, x) * (1 - sm(jx + 0.03, jx + 0.06, x)));
        let ua0 = 0, tw = 0; for (let q = 0; q < 4; q++) { const b = idx[i * 4 + q]; if (b === ua) ua0 += wt[i * 4 + q]; else if (trunk.includes(b)) tw += wt[i * 4 + q]; }
        if (ua0 + tw <= 0) continue;
        // (below the joint, the arm's whole share of what the trunk and arm hold between them, by which side of the crease; above, Blender's
        // own, less toward the neck)
        // (well below the armpit, only taken off the trunk's side, never given to the arm)
        const below = 1 - sm(jy - 0.05, jy - 0.005, y), kb = sm(xb - 0.009, xb + 0.009, x), want = lerp(ua0 * sm(jx - 0.065, jx + 0.004, x), lerp(ua0 * kb, (ua0 + tw) * kb, near), below);
        if (Math.abs(want - ua0) < 1e-4) continue;
        if (want > ua0) {
          const f = 1 - (want - ua0) / tw; for (let q = 0; q < 4; q++) if (trunk.includes(idx[i * 4 + q]) && idx[i * 4 + q] !== ua) wt[i * 4 + q] *= f;
          addWeight(idx, wt, i, ua, want - ua0);
        } else {
          const r = ua0 - want, cs = sm(pit, jy + 0.01, y); for (let q = 0; q < 4; q++) if (idx[i * 4 + q] === ua) wt[i * 4 + q] *= want / ua0;
          addWeight(idx, wt, i, cl, r * cs); addWeight(idx, wt, i, BIx.chest, r * (1 - cs));
        }
        normWeights(wt, i);
      }
    }
    for (let i = 0; i < n; i++) if (lin[i] > 0.002) for (let q = 0; q < 4; q++) wt[i * 4 + q] *= 1 + lin[i];      // (see DQS_PARS)
    // (and the outline finer there: the skin folds into the hollow as the arm goes up, and a full one reaches through the fold as slivers)
    if (lin.some(v => v > 0.002)) {
      const ik = g.attributes._ink ? g.attributes._ink.array : new Float32Array(n).fill(1);
      for (let i = 0; i < n; i++) ik[i] *= 1 - 0.7 * lin[i];
      if (!g.attributes._ink) g.setAttribute('_ink', new THREE.Float32BufferAttribute(ik, 1));
    }
    g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
    g.setAttribute('bind', g.attributes.position.clone());
    const part = g.attributes._part;      // (the sex, all of it, is under the briefs, however far it hangs)
    if (name === 'Body') for (let i = 0; i < n; i++) reg[i] = part && part.getX(i) > 0.5 ? R.SEAT : bodyRegion([p.getX(i), p.getY(i), p.getZ(i)], dom[i], L, sx);
    // (her inner form: its own tone, _PART 2)
    if (name === 'Body') { const tn = new Float32Array(n); if (part) for (let i = 0; i < n; i++) tn[i] = part.getX(i) > 1.5 ? 1 : 0; g.setAttribute('tone', new THREE.Float32BufferAttribute(tn, 1)); }
    // (his: a finer outline over his sex, fading back in over the skin just round it, where the scrotum meets the thighs and the groin creases:
    // a full one pokes out through those tight creases as torn slivers of ink)
    // (his shaft's turn at its root spread out: as built, it goes over to its bone across barely a centimetre where it leaves the body, and
    // turning it (with the response, or with gravity face down) folds the skin there; the same handover drawn out over four, mostly along the
    // shaft, so it bends there instead)
    if (name === 'Body' && sx === 'm' && BIx.sex != null) {
      const sb = BIx.sex, E = new V3(...joints.sex), C1 = new V3(); let nC = 0;
      const ws = i => { let w = 0; for (let k = 0; k < 4; k++) if (idx[i * 4 + k] === sb) w += wt[i * 4 + k]; return w; };
      for (let i = 0; i < n; i++) if (ws(i) > 0.95) { C1.add(new V3(p.getX(i), p.getY(i), p.getZ(i))); nC++; }
      if (nC) {
        const u = C1.divideScalar(nC).sub(E).normalize(), sm = (a_, b_, x) => { const t = clamp((x - a_) / (b_ - a_), 0, 1); return t * t * (3 - 2 * t); };
        // (and between the shaft and the scrotum below it, the same: by how far a point is from the shaft's line, the scrotum's top following
        // it a little, so the skin between them stretches rather than turning inside out)
        for (let i = 0; i < n; i++) {
          const w0 = ws(i), isSex = part && part.getX(i) > 0.5; if (w0 <= 0.001 && !isSex) continue;
          const v = new V3(p.getX(i), p.getY(i), p.getZ(i)).sub(E), t = v.dot(u), r = v.addScaledVector(u, -t).length();
          if (w0 <= 0.001 && (t < 0 || r > 0.04)) continue;
          const w1 = sm(0.04, 0.017, r) * sm(-0.012, 0.032, t);
          // (the bone's share set to w1, the rest scaled to fill)
          let ks = -1; for (let k = 0; k < 4; k++) if (idx[i * 4 + k] === sb) ks = k;
          if (ks < 0) { if (w1 <= 0.001) continue; ks = 0; for (let k = 1; k < 4; k++) if (wt[i * 4 + k] < wt[i * 4 + ks]) ks = k; wt[i * 4 + ks] = 0; idx[i * 4 + ks] = sb; }
          const rest = 1 - (idx[i * 4 + ks] === sb ? wt[i * 4 + ks] : 0); for (let k = 0; k < 4; k++) if (k !== ks) wt[i * 4 + k] = rest > 1e-6 ? wt[i * 4 + k] * (1 - w1) / rest : 0;
          if (rest <= 1e-6) { const kh = ks === 0 ? 1 : 0; idx[i * 4 + kh] = BIx.hips; wt[i * 4 + kh] = 1 - w1; }
          wt[i * 4 + ks] = w1;
        }
        g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
      }
    }
    // (his scrotum onto its bone: it isn't marked as the sex (it's joined to the body, as the thighs are), so found by its own shape, the
    // landmark's centre and radii; more of it the further down it hangs below its root at the top, where it joins the body, the bone's pivot
    // there; fading out over its join to the thighs and the perineum, and never the shaft's)
    if (name === 'Body' && sx === 'm' && BIx.sexS != null && L.scrotum) {
      const sb = BIx.sex, bs = BIx.sexS, ws = i => { let w = 0; for (let k = 0; k < 4; k++) if (idx[i * 4 + k] === sb) w += wt[i * 4 + k]; return w; };
      const S0 = new V3(L.scrotum[0], L.scrotum[1], L.scrotum[2]), R0 = new V3(L.scrotum[3], L.scrotum[4], L.scrotum[5]);
      const J = S0.clone().add(new V3(0, 0.8 * R0.y, 0.3 * R0.z)), drop = J.y - (S0.y - R0.y); joints.sexS = J.toArray();
      const sm = (a_, b_, x) => { const t = clamp((x - a_) / (b_ - a_), 0, 1); return t * t * (3 - 2 * t); };
      for (let i = 0; i < n; i++) {
        if ((part && part.getX(i) > 0.5) || ws(i) > 0.05) continue;
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), q = Math.hypot((x - S0.x) / R0.x, (y - S0.y) / R0.y, (z - S0.z) / R0.z);
        const w2 = sm(1.3, 1.02, q) * sm(-0.1, 0.45, (J.y - y) / drop); if (w2 <= 0.001) continue;
        let k0 = 0; for (let k = 1; k < 4; k++) if (wt[i * 4 + k] < wt[i * 4 + k0]) k0 = k;
        for (let k = 0; k < 4; k++) wt[i * 4 + k] *= 1 - w2; idx[i * 4 + k0] = bs; wt[i * 4 + k0] = w2;
        const sum = wt[i * 4] + wt[i * 4 + 1] + wt[i * 4 + 2] + wt[i * 4 + 3]; for (let k = 0; k < 4; k++) wt[i * 4 + k] /= sum;
      }
      g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4));
    }
    // (trousers and briefs, up: their crotch shared between the pelvis and the thighs rather than going with the pelvis alone. Bent well
    // forward, the pelvis turns and the thighs don't: on the pelvis alone the crotch swings out behind between the legs, the cloth drawn out
    // into creases round it. Shared, it stays between the legs, closer to smooth.)
    if ((name === 'Trousers' || name === 'Briefs') && BIx.hips != null && BIx.thighL != null && BIx.thighR != null && L.crotch != null) {
      const hp = BIx.hips, tL = BIx.thighL, tR = BIx.thighR, c = L.crotch, sm = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
      for (let i = 0; i < n; i++) {
        const x = p.getX(i), y = p.getY(i), z = p.getZ(i), ax = Math.abs(x);
        if (ax > 0.1 || y > c + 0.08 || y < c - 0.15 || z < -0.1) continue;
        const f = 0.9 * sm(0.1, 0.045, ax) * sm(c + 0.08, c + 0.025, y) * sm(-0.1, -0.05, z); if (f <= 0.01) continue;
        let kH = -1; for (let k = 0; k < 4; k++) if (idx[i * 4 + k] === hp) kH = k; if (kH < 0) continue;
        const want = x >= 0 ? tL : tR; let kT = -1; for (let k = 0; k < 4; k++) if (idx[i * 4 + k] === want) kT = k;
        if (kT < 0) { let m = -1; for (let k = 0; k < 4; k++) if (k !== kH && (m < 0 || wt[i * 4 + k] < wt[i * 4 + m])) m = k; kT = m; idx[i * 4 + kT] = want; wt[i * 4 + kT] = 0; }
        const mv = wt[i * 4 + kH] * f; wt[i * 4 + kH] -= mv; wt[i * 4 + kT] += mv;
      }
    }
    // (a garment's crotch, between the legs: shared between the thighs across a hand's width of the middle, rather than going over from one to
    // the other at the midline itself; as built, the lowered briefs and trousers split there, and the gusset tore open as the legs parted)
    if (name !== 'Body' && BIx.thighL != null && BIx.thighR != null) {
      const tL = BIx.thighL, tR = BIx.thighR; let changed = false;
      for (let i = 0; i < n; i++) {
        const x = p.getX(i); if (Math.abs(x) > 0.065) continue;
        let kL = -1, kR = -1, wL = 0, wR = 0;
        for (let k = 0; k < 4; k++) { if (idx[i * 4 + k] === tL) { kL = k; wL = wt[i * 4 + k]; } else if (idx[i * 4 + k] === tR) { kR = k; wR = wt[i * 4 + k]; } }
        const tot = wL + wR; if (tot < 0.3) continue;
        const u = clamp((x + 0.06) / 0.12, 0, 1), t = u * u * (3 - 2 * u);
        const slot = () => { let m = -1; for (let k = 0; k < 4; k++) if (k !== kL && k !== kR && (m < 0 || wt[i * 4 + k] < wt[i * 4 + m])) m = k; return m; };      // (the lightest other)
        if (kL < 0) { kL = slot(); idx[i * 4 + kL] = tL; }
        if (kR < 0) { kR = slot(); idx[i * 4 + kR] = tR; }
        wt[i * 4 + kL] = tot * t; wt[i * 4 + kR] = tot * (1 - t);
        const sum = wt[i * 4] + wt[i * 4 + 1] + wt[i * 4 + 2] + wt[i * 4 + 3]; if (sum > 0) for (let k = 0; k < 4; k++) wt[i * 4 + k] /= sum;
        changed = true;
      }
      if (changed) { g.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(idx, 4)); g.setAttribute('skinWeight', new THREE.Float32BufferAttribute(wt, 4)); }
    }
    if (name === 'Body' && sx === 'm' && part && g.attributes._ink) {
      const ink_ = g.attributes._ink, S_ = [], B_ = [], sb = BIx.sex, ssb = BIx.sexS, inS = new Uint8Array(n);
      // (and finest of all where it bends as it lifts, the blend at its root, and close round it: there the shell folds out through the skin;
      // the scrotum the same, on its own bone though not marked as the sex, and finest where it blends into the body as it swings)
      const wOn = (i, b) => { let w = 0; for (let k = 0; k < 4; k++) if (idx[i * 4 + k] === b) w += wt[i * 4 + k]; return w; };
      for (let i = 0; i < n; i++) {
        const ws_ = ssb != null ? wOn(i, ssb) : 0;
        if (part.getX(i) > 0.5 || ws_ > 0.3) { S_.push(i); inS[i] = 1; }
        if (sb != null) { const w = wOn(i, sb); if (w > 0.02 && w < 0.98) B_.push(i); }
        if (ws_ > 0.02 && ws_ < 0.9) B_.push(i);
      }
      for (let i = 0; i < n; i++) {
        let f = 0.4;
        if (!inS[i]) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
          if (Math.abs(x) > 0.13 || y < L.crotch - 0.2 || y > L.crotch + 0.12) continue;
          let d = 1; for (const j of S_) { const dx = p.getX(j) - x, dy = p.getY(j) - y, dz = p.getZ(j) - z, dd = dx * dx + dy * dy + dz * dz; if (dd < d) d = dd; }
          const u = clamp(Math.sqrt(d) / 0.045, 0, 1); f = 0.4 + 0.6 * u * u * (3 - 2 * u);
        }
        if (B_.length) {
          const x = p.getX(i), y = p.getY(i), z = p.getZ(i); let d = 1;
          for (const j of B_) { const dx = p.getX(j) - x, dy = p.getY(j) - y, dz = p.getZ(j) - z, dd = dx * dx + dy * dy + dz * dz; if (dd < d) d = dd; }
          const u = clamp(Math.sqrt(d) / 0.025, 0, 1); f = Math.min(f, 0.1 + 0.9 * u * u * (3 - 2 * u));
        }
        ink_.setX(i, ink_.getX(i) * f);
      }
    }
    else if (/^(Tunic|Shirt|Dress|Kirtle)/.test(name)) for (let i = 0; i < n; i++) reg[i] = ARM_BONES.test(dom[i]) ? 1 : 0;
    g.setAttribute('region', new THREE.Float32BufferAttribute(reg, 1));
    g.userData.shared = true;
    mesh[name] = { geo: g, keys: Object.assign({}, o.morphTargetDictionary || {}) };
  });
  return { sex: sx, order, joints, parents, L, mesh };
}
// Where a point of the body is, for hiding what's under each garment: the garments' own edges (from the landmarks) decide it, each region's
// edge a little inside the garment that hides it (so no gap opens at a hem or cuff).
function bodyRegion(P, dom, L, sex) {
  const [x, y, z] = P, sx = x >= 0 ? 1 : -1;
  if (ARM_BONES.test(dom)) {
    const a = (x - sx * L.shX) * sx * Math.sin(L.abd) - (y - L.shoulder) * Math.cos(L.abd);       // (along the arm from the shoulder)
    return a > L.cuffA - 0.015 ? R.HAND : a > L.rollA - 0.015 ? R.FOREARM : R.UPARM;
  }
  if (/^(foot|toe)/.test(dom) || y < L.bootTop - 0.012) return R.FOOT;
  // (the neck above the open shirt's neckline, lower in front, shows with any top; behind, well down inside the collar, which the neck rises
  // out of as the head goes forward)
  if (Math.cos(0.42) * (y - L.neckline) + Math.sin(0.42) * z > -0.006 - 0.032 * clamp(-z / 0.04, 0, 1)) return R.HEAD;
  if (y >= L.hemUp + 0.06) return R.CHEST;
  if (y >= L.hemUp + 0.04) return R.WAIST_HI;      // (well up under the raised hem, which rides up as they bend)
  if (y >= L.trouserTop - 0.01) return R.WAIST;
  if (y >= L.briefTop - 0.008) return R.HIPS;
  // under the briefs (to their leg openings: cut high at the sides for her) is the seat; below, the thighs, the knee (just above where lowered
  // trousers bunch) and the shins
  const bc = L.briefCut || [0.012, L.briefLeg - 0.006, 0.4375];
  // (Fenwick's period wardrobe for her, L.period: smalls cut straight across the top of the thigh, as his trunks are)
  const inBriefs = sex === 'f' && !L.period ? ((x * sx - bc[0]) * bc[2] - (y - bc[1])) / Math.hypot(1, bc[2]) < -0.009 : y >= L.briefLeg + 0.009;
  if (y >= L.briefTop - 0.022 && inBriefs) return R.HIPS_LO;      // (only within the leg openings: hers rise nearly to the waistband at the hip)
  if (inBriefs) return R.SEAT;
  if (y >= L.downTop + 0.02) return R.THIGH;
  if (y >= L.downTop - 0.04) return R.KNEE;
  return R.SHIN;
}
// The body's build, as the shape keys' amounts: mass (muscle and frame) toward muscle or slight, fat toward soft or firm; her bust's size (0 small
// – 1 large; the model as built is about 0.4) toward the smaller or the larger; his sex likewise, by the same number (spec.size if given, else
// the bust's, held a little short of the largest: Silas's is given as 1).
function bodyKeys(spec) {
  const m = spec.mass == null ? 0.5 : spec.mass, fat = spec.fat == null ? 0.4 : spec.fat, b = spec.bust == null ? 0.4 : spec.bust, her = spec.sex === 'f';
  const z = spec.size != null ? spec.size : 0.25 + 0.6 * b;
  return { muscle: clamp((m - 0.5) / 0.4, 0, 1), slight: clamp((0.5 - m) / 0.25, 0, 1) * 0.8, soft: clamp((fat - 0.4) / 0.35, 0, 1), firm: clamp((0.4 - fat) / 0.3, 0, 1) * 0.8,
    bust: her ? clamp((b - 0.4) / 0.6, 0, 1) : 0, bustSmall: her ? clamp((0.4 - b) / 0.4, 0, 1) : 0,
    sexLarge: her ? 0 : clamp((z - 0.4) / 0.6, 0, 1), sexSmall: her ? 0 : clamp((0.4 - z) / 0.4, 0, 1), sexSwell: 0 };
}
function setKeys(mesh, keys) {
  const dict = mesh.geometry.userData.keys || {}, inf = mesh.morphTargetInfluences;
  if (inf) for (const k in dict) inf[dict[k]] = keys[k] || 0;
}
function makeGLB(spec, T) {
  const S = shapeOf(spec), F = { spec, S, root: new THREE.Group(), bone: {}, bones: [], model: T, L: T.L };
  F.root.scale.setScalar(spec.height / T.L.height); F.root.userData.figure = F; FIGS.add(F);      // (for skirts' cloth to find anyone near: see tickCloth)
  for (const name of T.order) {
    const par = T.parents[name], p = T.joints[name], q = par ? T.joints[par] : [0, 0, 0];
    const b = new THREE.Bone(); b.name = name; b.position.set(p[0] - q[0], p[1] - q[1], p[2] - q[2]);
    (par ? F.bone[par] : F.root).add(b); F.bone[name] = b; F.bones.push(b);
  }
  F.root.updateMatrixWorld(true);
  F.skeleton = new THREE.Skeleton(F.bones); F.bindM = F.root.matrixWorld.clone();
  F.rest = {}; for (const b of F.bones) F.rest[b.name] = b.getWorldPosition(new V3());
  F.H = { hips: T.joints.hips[1], ankle: T.joints.footL[1], sit: T.joints.hips[1] - T.L.crotch + 0.008, abd: T.L.abd, waist: T.L.waist - 0.03, blades: T.L.armpit + 0.03, shoulder: [T.L.shX * 0.95, T.L.shoulder + 0.02] };
  F.keys = bodyKeys(spec);
  for (const k in T.mesh) T.mesh[k].geo.userData.keys = T.mesh[k].keys;
  // the body
  // (his drawn from both sides: where the shaft turns, lifting or swinging with gravity, the skin between it and the scrotum turns over on itself,
  // and from one side that shows the outline's shell through it as a dark patch)
  const skinM = tmat(spec.skin, { skin: true, morph: true, regions: true, marks: true, bindAttr: true, tone: true, detail: true, unique: true, rim: '#6a5048', rimK: 0.5, side: spec.sex === 'm' ? THREE.DoubleSide : THREE.FrontSide });
  { const L = T.L, U = skinM.userData.u;      // (Fenwick: the skin's painted detail, where the model says where it goes)
    const bk = F.keys.bust || 0, bs = F.keys.bustSmall || 0;      // (the fold lower on a fuller bust, the crease fainter on a smaller)
    U.uBust.value.set(0.055 + 0.05 * bk - 0.004 * bs, 1 + 0.4 * bk - 0.45 * bs, 0, 0);
    if (L.nipple) { U.uNip.value.set(L.nipple[0], L.nipple[1], L.nipple[2], 0.0165 * (1 + 0.2 * bk - 0.12 * bs)); U.uBd0.value.set(L.neck, L.armpit, L.waist, L.seatTop); U.uBd1.value.set(L.shX, L.hipX, L.crotch, L.knee); }
    if (L.navel) U.uNav.value.set(L.navel[0], L.navel[1], L.navel[2], 1);
    const kn = T.joints.shinL; if (L.nipple && kn) U.uKnee.value.set(kn[0], kn[1], kn[2], 1);
    if (L.toes && L.footFrame) { U.uFootF.value.fromArray(L.footFrame); U.uToe.value.forEach((v, i) => v.fromArray(L.toes, i * 4)); } }
  F.body = skinned(F, T.mesh.Body.geo, skinM); F.body.castShadow = true; F.body.receiveShadow = false; F.skinMat = skinM;
  // (the nape drawn all the way up under the skull: its upper part goes with the head (see adopt), so it stays under the skull as the head tips
  // back, and it's what joins the neck to the head behind)
  // The body's response, 0–1 (the session decides how much, and how far it may go): the sex fuller (the shape key), his lifting on its bone
  // (eased toward, in tick), a deeper tone there; and, given, a blush on the face besides whatever the expression has.
  F.setResponse = (r, o) => {
    r = clamp(r || 0, 0, 1); o = o || {};
    const swell = clamp(r * (spec.sex === 'f' ? 0.9 : 1.2), 0, 1), u = clamp((r - 0.12) / 0.88, 0, 1);
    F.resp.r = r; F.resp.lift = 2.0 * u * u * (3 - 2 * u);
    if (Math.abs((F.keys.sexSwell || 0) - swell) > 0.004) { F.keys.sexSwell = swell; F.root.traverse(m => { if (m.isSkinnedMesh && m.morphTargetInfluences) setKeys(m, F.keys); }); }
    skinM.userData.u.uFlush.value.set(spec.sex !== 'f' ? 0 : clamp(r * 1.7, 0, 1), T.L.crotch, 0.0, spec.sex === 'm' ? 1 : 0);      // (his takes no tint: only hers flushes; none for the non-gendered, with nothing there)
    skinM.userData.u.uFlushC.value.set(clamp((o.chest || 0) * 1.8, 0, 1), T.L.nipple ? T.L.nipple[1] + 0.04 : T.L.armpit + 0.03, T.L.neck + 0.05, 1);
    F.blushAdd = o.blush || 0;
  };
  { const hm = dqs(paint(new THREE.MeshBasicMaterial(Object.assign({ color: srgb(INK), side: THREE.BackSide, skinning: true, morphTargets: true }, HULL_OFS)), { regions: true, grain: 0 })); hm.userData.u.uHide = skinM.userData.u.uHide; ink(F.body, INK_W, F, hm); }
  const L = T.L;
  // the seat's spots from its own shape (measured in Blender): the cheek where it's fullest, the sit spot just above the fold beneath it, the
  // thighs below the fold (for a flatter seat, within sensible bounds of the fullest point)
  const pk = clamp(L.seatPeak, L.crotch + 0.02, L.crotch + 0.045), sit = Math.min(clamp(L.seatFold, pk - 0.07, pk - 0.03) + 0.012, pk - 0.05);
  const SEAT = { cheek: [L.hipX * 0.84, pk], sitspot: [L.hipX * 0.86, sit], thighs: [L.hipX * 0.95, sit - 0.06] };
  spotsOn(F, T.mesh.Body.geo, area => SEAT[area], 0.006);
  buildHead(F, spec, S);
  // the clothes: each garment made when it's first worn, then shown or hidden
  F.gm = {}; F.clothes = {};
  F.state = { top: 'down', bottoms: 'up', under: 'up' };
  F.setClothes = st => { Object.assign(F.state, st || {}); if (F.spec.outfit === 'period') dressPeriod(F); else dressGLB(F); };
  F.drapePose = null; F.setDrape = pose => { F.drapePose = pose || null; if (F.spec.outfit === 'period') F.setClothes(); };
  F.cushionOf = area => (F.spec.outfit === 'period' ? cushionPeriod(F, area) : null);
  F.liftOf = () => (F.spec.outfit === 'period' ? liftPeriod(F) : null); F.backOf = where => (F.spec.outfit === 'period' ? backPeriod(F, where) : null);
  F.setPeriod = period => { spec.period = period; spec.outfit = 'period'; for (const k in F.gm) { const m = F.gm[k]; for (const x of [m, m.userData.hull]) if (x) x.parent.remove(x); } F.gm = {}; F.underMat = null; F.setClothes(); };
  F.setOutfit = (outfit, dept) => { spec.outfit = outfit; if (dept) spec.dept = dept; for (const k in F.gm) { const m = F.gm[k]; for (const x of [m, m.userData.hull]) if (x) x.parent.remove(x); } F.gm = {}; F.setClothes(); };
  F.setClothes();
  finish(F, spec);
  return F;
}
function garmentGLB(F, name) {
  if (F.gm[name]) return F.gm[name];
  const spec = F.spec, O = outfitOf(spec), L = F.L, uni = spec.outfit === 'uniform' ? 1 : 0, geo = F.model.mesh[name].geo;
  let m;
  if (/^NightShirt/.test(name)) {      // (Fenwick: his nightshirt, undyed linen, a shift: drawn as her chemise is)
    m = tmat(NIGHT_M, { skin: true, morph: true, side: THREE.DoubleSide, rim: '#3a3028', rimK: 0.55, pattern: 'dressG', bindAttr: true, unique: true }); const U = m.userData.u;
    for (const k of ['uPat0', 'uPat1', 'uPat2', 'uPat3', 'uPat4']) U[k].value.copy(srgb(NIGHT_M));
    U.uParam.value.set(L.nightShirtHem, 1, 0, 0); U.uL0.value.set(L.waist, L.neckline, 0, 0); U.uL1.value.set(L.armpit, L.shX, L.shoulder - L.cuffA * Math.cos(L.abd), 0);
  } else if (/^Drawers/.test(name)) {
    m = tmat(NIGHT_M, { skin: true, morph: true, side: THREE.DoubleSide, pattern: 'drawersG', bindAttr: true, unique: true, rim: '#2a3440', rimK: 0.45 });
    m.userData.u.uParam.value.set(L.drawersLeg, L.trouserTop, 0, 0);
  } else if (/^(Tunic|Shirt)/.test(name)) {
    m = tmat(O.tunic, { skin: true, morph: true, side: THREE.DoubleSide, rim: '#2a3440', rimK: 0.6, pattern: 'tunicG', bindAttr: true, unique: true });
    const U = m.userData.u, own = !uni && O.top;
    U.uPat0.value.copy(srgb(own ? O.accent || spec.dept : spec.dept)); U.uPat1.value.copy(srgb(own ? O.shirt || shade(O.tunic, -0.3) : O.edge || shade(O.tunic, -0.4)));
    U.uPat2.value.copy(srgb(own ? O.print || '#222' : O.belt || '#222'));
    const up = /Up$/.test(name);
    U.uParam.value.set(up ? L.hemUp : L.hem, up ? 1 : 0, L.shX, uni);
    U.uL0.value.set(own ? TOPS[O.top] || 0 : 0, own && O.scarf ? 1 : 0, L.collar, L.waist); U.uL1.value.set(L.shoulder, L.armpit, L.shoulder - L.cuffA * Math.cos(L.abd), L.neckline);
  } else if (/^Trousers/.test(name)) {
    m = tmat(O.trousers, { skin: true, morph: true, side: THREE.DoubleSide, rim: '#2a3440', rimK: 0.6, pattern: 'trousersG', bindAttr: true, unique: true });
    const tg = F.model.mesh.Trousers.geo; if (!tg.boundingBox) tg.computeBoundingBox();      // (the hem: the bottom of the trousers as worn)
    const U = m.userData.u; U.uPat0.value.copy(srgb(O.legAccent || O.pipe || spec.dept)); U.uParam.value.set(0, /Down$/.test(name) ? 1 : 0, L.hipX, uni);
    U.uL0.value.set(L.knee, L.trouserTop, uni ? 0 : LEGS[O.legs] || 0, tg.boundingBox.min.y);
  } else if (/^Briefs/.test(name)) {
    F.underMat = F.underMat || tmat(O.under, { skin: true, morph: true, side: THREE.DoubleSide, marks: true, bindAttr: true, unique: true, markCol: shade(O.under, -0.2), rim: '#2a3440', rimK: 0.5 });
    m = F.underMat;
  } else {
    // (the boots; or, off duty, aboard, each heroine's own soft shoes over socks)
    const sh = !uni && O.shoes ? SHOES[O.shoes] || 0 : 0;
    m = tmat(sh ? O.shoe : spec.outfit === 'offduty' ? '#4a3424' : '#1e2024', { skin: true, morph: true, rim: '#3a4048', rimK: 0.4, pattern: 'shoeG', bindAttr: true, unique: true });
    const U = m.userData.u; U.uParam.value.set(sh, F.H.ankle, 0, 0);
    if (sh) { U.uPat0.value.copy(srgb(O.sole || '#222')); U.uPat1.value.copy(srgb(O.trim || O.sole || '#222')); U.uPat2.value.copy(srgb(O.sock || '#555')); }
  }
  const depth = /^Briefs/.test(name) ? 2 : /^Trousers/.test(name) ? 1 : 0;
  if (depth) { m.polygonOffset = true; m.polygonOffsetFactor = depth; m.polygonOffsetUnits = 2 * depth; }
  const sm = skinned(F, geo, m); sm.castShadow = true; sm.receiveShadow = false; ink(sm, INK_W, F, null, HEM_R);
  F.gm[name] = sm; return sm;
}
// ── Fenwick: her period wardrobe (spec.outfit 'period', spec.period: the outfit, Cast.WARDROBE). The layers as the correction knows them: the
// top is her dress or kirtle (down, or its skirt raised at the back), the bottoms her leggings where she wears them (up or lowered), the under
// her drawers or smalls (up or lowered). Stockings under a dress, drawn on the legs. ──
const PHIDE = {
  DressLong: ['CHEST', 'UPARM', 'WAIST_HI', 'WAIST', 'HIPS', 'HIPS_LO', 'SEAT', 'THIGH', 'FOREARM'], DressLongUp: ['CHEST', 'UPARM', 'WAIST_HI', 'WAIST', 'FOREARM'],
  DressElbow: ['CHEST', 'UPARM', 'WAIST_HI', 'WAIST', 'HIPS', 'HIPS_LO', 'SEAT', 'THIGH'], DressElbowUp: ['CHEST', 'UPARM', 'WAIST_HI', 'WAIST'],
  Kirtle: ['CHEST', 'UPARM', 'WAIST_HI', 'WAIST', 'HIPS', 'HIPS_LO', 'SEAT', 'THIGH'], KirtleUp: ['CHEST', 'UPARM', 'WAIST_HI', 'WAIST'],
  Leggings: ['HIPS', 'HIPS_LO', 'SEAT', 'THIGH', 'KNEE', 'SHIN'], LeggingsDown: ['SHIN'], Drawers: ['HIPS', 'HIPS_LO', 'SEAT', 'THIGH'], DrawersDown: [],
  Smalls: ['HIPS_LO', 'SEAT'], SmallsDown: [], Boots: ['FOOT'],
  Chemise: ['CHEST', 'UPARM', 'WAIST_HI', 'WAIST', 'HIPS', 'HIPS_LO', 'SEAT'], ChemiseUp: ['CHEST', 'UPARM', 'WAIST_HI'],      // (shirt-length: the thighs below it bare, or in her drawers)
  NightDress: ['CHEST', 'UPARM', 'WAIST_HI', 'WAIST', 'HIPS', 'HIPS_LO', 'SEAT', 'THIGH', 'FOREARM'], NightDressUp: ['CHEST', 'UPARM', 'WAIST_HI', 'WAIST', 'FOREARM'],
};
// (what each layer takes off a smack's sting when it's over the spot: js/session.js asks F.cushionOf)
const PCUSH = { skirt: 0.45, leggings: 0.25, drawers: 0.16, smalls: 0.1 };
// (spec.period.none: nothing at all, for looking at how the body moves (figures.html): no layers to change, no skin hidden, bare feet)
// (Fenwick: her nightclothes, by kind: a chemise or a night-dress; each a shift, hanging loose, with neither lacing nor a waist seam)
const TOPS_P = { chemise: 'Chemise', nightdress: 'NightDress' }, SHIFT = /^(Chemise|NightDress)/;
function periodNames(F) {
  const P = F.spec.period || {}, st = F.state, kirtle = P.kind === 'kirtle';
  if (P.none) return { top: null, bottoms: null, under: null, boots: null };
  const base = TOPS_P[P.kind] || (kirtle ? 'Kirtle' : P.sleeves === 'long' ? 'DressLong' : 'DressElbow');
  return { top: base + (st.top === 'up' && !CLOTHED.test(base) && F.model.mesh[base + 'Up'] ? 'Up' : ''),      // (a skirt raised or not the same: its cloth rolls its back up (makeCloth); a chemise, its raised mesh)
    bottoms: P.legs === 'leggings' ? (st.bottoms === 'down' ? 'LeggingsDown' : 'Leggings') : null,
    under: (P.under === 'smalls' ? 'Smalls' : 'Drawers') + (st.under === 'down' ? 'Down' : ''), boots: P.shoes ? 'Boots' : null };      // (barefoot, in her nightclothes)
}
function garmentPeriod(F, name) {
  if (F.gm[name]) return F.gm[name];
  const P = F.spec.period || {}, L = F.L; let geo = F.model.mesh[name] && F.model.mesh[name].geo; if (!geo) return null;
  const opt = (pat, col, o) => tmat(col, Object.assign({ skin: true, morph: true, side: THREE.DoubleSide, rim: '#3a3028', rimK: 0.55, pattern: pat, bindAttr: true, unique: true }, o || {}));
  let m;
  if (/^(Dress|Kirtle|Chemise|NightDress)/.test(name)) {
    m = opt('dressG', P.main || '#6a5a4a'); const U = m.userData.u, kirtle = /^Kirtle/.test(name);
    U.uPat0.value.copy(srgb(P.trim || shade(P.main || '#6a5a4a', -0.3))); U.uPat1.value.copy(srgb(P.chemise || '#f2ede2')); U.uPat2.value.copy(srgb(P.apron || '#f2ede2'));
    U.uPat3.value.copy(srgb(P.bodice || P.main || '#6a5a4a')); U.uPat4.value.copy(srgb(P.print || '#ffffff'));
    const sleeveA = kirtle || P.sleeves !== 'long' ? L.sleeveE : L.cuffA;
    U.uParam.value.set(/^Chemise/.test(name) ? L.chemiseHem : /^NightDress/.test(name) ? L.nightHem : kirtle ? L.kirtleHem : L.skirtHem, SHIFT.test(name) ? 1 : 0, kirtle || P.sleeves !== 'long' ? 1 : 0, P.apron ? 1 : 0);      // (y: a shift)
    U.uL0.value.set(L.waist, L.neckline, P.print ? 1 : 0, P.bodice ? 1 : 0); U.uL1.value.set(L.armpit, L.shX, L.shoulder - sleeveA * Math.cos(L.abd), P.patches ? 1 : 0);
  } else if (/^Leggings/.test(name)) {
    m = opt('legG', P.legCol || '#3e3a32'); const U = m.userData.u; U.uPat0.value.copy(srgb(shade(P.legCol || '#3e3a32', 0.25))); U.uParam.value.set(L.crotch - 0.02, L.knee, 0, 0); U.uL0.value.set(P.darned ? 1 : 0, 0, 0, 0);
  } else if (/^(Drawers|Smalls)/.test(name)) {
    const col = P.underCol || '#f2ede2', down = /Down$/.test(name), drawers = /^Drawers/.test(name);
    m = down ? opt('drawersG', col) : (F.underMat = F.underMat || opt('drawersG', col, { marks: true, markCol: shade(col, -0.2), rimK: 0.45 }));
    m.userData.u.uParam.value.set(drawers ? (down ? L.knee - 0.01 : L.drawersLeg) : -9, down ? (drawers ? L.drawersDown : L.briefDown) : drawers ? L.trouserTop : L.briefTop, 0, 0);
  } else {
    const sh = SHOES[P.shoes] || 0;
    m = opt('shoeG', P.shoe || '#4a3424', { rimK: 0.4, rim: '#3a4048' }); const U = m.userData.u; U.uParam.value.set(sh, F.H.ankle, 0, 0);
    if (sh) { U.uPat0.value.copy(srgb(P.sole || '#2a2018')); U.uPat1.value.copy(srgb(P.trimShoe || P.sole || '#2a2018')); U.uPat2.value.copy(srgb(P.stockings || P.legCol || '#d8d0c0')); }
  }
  if (CLOTHED.test(name)) geo = skirtless(geo, F.L.waist - 0.009);      // (below the waist, its cloth: makeCloth)
  const depth = /^(Drawers|Smalls)/.test(name) ? 2 : /^Leggings/.test(name) ? 1 : 0;
  if (depth) { m.polygonOffset = true; m.polygonOffsetFactor = depth; m.polygonOffsetUnits = 2 * depth; }
  const sm = skinned(F, geo, m); sm.castShadow = true; sm.receiveShadow = false; ink(sm, INK_W, F, null, HEM_R);
  F.gm[name] = sm; return sm;
}
const CLOTHED = /^(Dress|Kirtle|NightDress)(Long|Elbow)?$/;      // (Fenwick: the skirts are cloth; a chemise is built as a shirt, with its own raised mesh)
// (a garment as built, without its skirt: the triangles wholly below the waist and not of a sleeve taken out, for its cloth to hang there)
function skirtless(geo, y) {
  const p = geo.attributes.position, reg = geo.attributes.region, ix = geo.index.array, keep = [];
  for (let t = 0; t < ix.length; t += 3) { const a = ix[t], b = ix[t + 1], c = ix[t + 2]; if (p.getY(a) >= y || p.getY(b) >= y || p.getY(c) >= y || (reg && reg.getX(a) > 0.5)) keep.push(a, b, c); }
  const g = new THREE.BufferGeometry(); g.name = geo.name; for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]); g.setIndex(keep);
  g.morphAttributes = geo.morphAttributes; g.morphTargetsRelative = geo.morphTargetsRelative; g.userData = Object.assign({}, geo.userData, { shared: false, hull: undefined }); return g;
}
// ── Fenwick: her skirt's cloth. Below the waist her skirt (or kirtle, or nightclothes) is a sheet of cloth simulated live: a grid of points,
// columns round her and rows from the waist to the hem, its shape at rest taken from the garment as built (so standing it's the skirt as it
// was made, its folds and all). The top row is held to the waist where the bodice ends; the rest falls with gravity (verlet, position-based:
// each point kept its distance from its neighbours across, down and diagonally, and from the next but one, which is the cloth's stiffness),
// over her (her body as spheres, measured from her own body and carried by her bones), over Silas, the furniture and the floor. It settles
// at once whenever it's put somewhere new (a pose, raised or let down: always behind a cut); after that it's damped hard, so it follows her
// as she moves without twitching. Raised, the back is rolled up to the small of her back: a smooth roll laid there, not simulated, wound
// from the cloth's own rows, with the sides hanging free from its ends into the front. ──
const CL = { NC: 56, NR: 30, FOLDS: 14, M: 0.02, MS: 0.03, live: false };      // (live: go on simulating once settled, rather than freezing)      // (M: how far it keeps off her, her drawers and all; MS: off anyone else, his clothes and all)
const _cv = new V3(), _cv2 = new V3(), _cm = new THREE.Matrix4(), _cm2 = new THREE.Matrix4();
// (the points of a mesh as her build shapes them: its shape keys at their amounts, in the model's space)
function shapedPos(geo, keys) {
  const P = Float32Array.from(geo.attributes.position.array), M = geo.morphAttributes && geo.morphAttributes.position, dict = geo.userData.keys || {};
  if (M) for (const k in dict) { const w = keys[k] || 0, D = M[dict[k]]; if (!w || !D) continue; const d = D.array; for (let i = 0; i < P.length; i++) P[i] += w * d[i]; }
  return P;
}
// (a spatial hash of points, for nearest-point questions)
function pointHash(P, n, cell) {
  const H = new Map(), key = (x, y, z) => ((x * 73856093) ^ (y * 19349663) ^ (z * 83492791)) | 0;
  for (let i = 0; i < n; i++) { const k = key(Math.floor(P[i * 3] / cell), Math.floor(P[i * 3 + 1] / cell), Math.floor(P[i * 3 + 2] / cell)); let a = H.get(k); if (!a) H.set(k, (a = [])); a.push(i); }
  return { near(x, y, z, r, fn) { const c0 = Math.floor((x - r) / cell), c1 = Math.floor((x + r) / cell), d0 = Math.floor((y - r) / cell), d1 = Math.floor((y + r) / cell), e0 = Math.floor((z - r) / cell), e1 = Math.floor((z + r) / cell);
    for (let a = c0; a <= c1; a++) for (let b = d0; b <= d1; b++) for (let c = e0; c <= e1; c++) { const L = H.get(key(a, b, c)); if (L) for (const i of L) fn(i); } } };
}
// Her body (or his) as spheres, for cloth to lie on: centres inside the body, each as big as reaches its surface, chosen so together they
// cover it (the trunk from below the chest down, the legs; not the arms, which move through a skirt as they will), each carried by the bone
// of the body's nearest point. Measured once for each body and build.
const SPHERES = new Map();
function bodySpheres(F, extra) {
  extra = (extra || []).filter(k => F.model.mesh[k]);
  const key = F.spec.sex + JSON.stringify(F.keys || {}) + extra.join(',');
  if (SPHERES.has(key)) return SPHERES.get(key);
  // (her body's points, and those of what she has on close over it that a skirt raised off her lies on: her drawers, leggings)
  const geos = [F.model.mesh.Body.geo, ...extra.map(k => F.model.mesh[k].geo)], cat = f => { const a = geos.map(f), out = new Float32Array(a.reduce((t, x) => t + x.length, 0)); let o = 0; for (const x of a) { out.set(x, o); o += x.length; } return out; };
  const P = cat(g => shapedPos(g, F.keys || {})), N = cat(g => g.attributes.normal.array), n = P.length / 3, SI = cat(g => g.attributes.skinIndex.array), SW = cat(g => g.attributes.skinWeight.array);
  const names = F.bones.map(b => b.name), dom = new Int16Array(n), top = F.L.armpit + 0.02;
  for (let i = 0; i < n; i++) { let b = 0; for (let k = 1; k < 4; k++) if (SW[i * 4 + k] > SW[i * 4 + b]) b = k; dom[i] = SI[i * 4 + b]; }
  const use = i => P[i * 3 + 1] < top && !ARM_BONES.test(names[dom[i]]), H = pointHash(P, n, 0.03);
  let x0 = 9, x1 = -9, z0 = 9, z1 = -9; for (let i = 0; i < n; i++) if (use(i)) { x0 = Math.min(x0, P[i * 3]); x1 = Math.max(x1, P[i * 3]); z0 = Math.min(z0, P[i * 3 + 2]); z1 = Math.max(z1, P[i * 3 + 2]); }
  const cand = [], st = 0.016;
  for (let x = x0; x <= x1; x += st) for (let y = 0.02; y <= top; y += st) for (let z = z0; z <= z1; z += st) {
    let best = -1, bd = 1e9; const nb = [];
    for (const r of [0.03, 0.07, 0.12]) { nb.length = 0; H.near(x, y, z, r, i => { const dx = P[i * 3] - x, dy = P[i * 3 + 1] - y, dz = P[i * 3 + 2] - z, d = dx * dx + dy * dy + dz * dz; if (d < r * r) nb.push([d, i]); if (d < bd) { bd = d; best = i; } }); if (best >= 0 && bd < r * r) break; }
    if (best < 0 || !use(best) || bd > 0.12 * 0.12) continue;
    // (inside: on the inner side of each of the nearest few points of its surface, not just the one)
    nb.sort((a, b) => a[0] - b[0]); let inside = true;
    for (const [, i] of nb.slice(0, 6)) if ((x - P[i * 3]) * N[i * 3] + (y - P[i * 3 + 1]) * N[i * 3 + 1] + (z - P[i * 3 + 2]) * N[i * 3 + 2] >= 0) { inside = false; break; }
    const d = Math.sqrt(bd);
    if (inside && d > 0.01) cand.push([x, y, z, d, best]);
  }
  cand.sort((a, b) => b[3] - a[3]);
  const cov = new Uint8Array(n), out = [];
  for (const [x, y, z, r, i0] of cand) {
    let k = 0; const hit = [];
    H.near(x, y, z, r + 0.008, i => { if (cov[i] || !use(i)) return; const dx = P[i * 3] - x, dy = P[i * 3 + 1] - y, dz = P[i * 3 + 2] - z; if (dx * dx + dy * dy + dz * dz <= (r + 0.008) * (r + 0.008)) { k++; hit.push(i); } });
    if (k < 4) continue;
    for (const i of hit) cov[i] = 1;
    out.push({ c: new V3(x, y, z), r, bone: dom[i0] });
  }
  SPHERES.set(key, out); return out;
}
// (where each of a figure's spheres is now, in another's space: centre and radius)
function spheresIn(G, inv, out, pad, extra, below, who) {
  const ek = (extra || []).join(',');
  if (!G._sph || G._sphKey !== ek) { G._sphKey = ek; G._sph = bodySpheres(G, extra).map(s => ({ s, local: s.c.clone().applyMatrix4(G.bindM).applyMatrix4(G.skeleton.boneInverses[s.bone]) })); }
  const S = G._sph;
  const k = G.root.matrixWorld.getMaxScaleOnAxis() / Math.max(1e-6, 1 / inv.getMaxScaleOnAxis());
  for (const q of S) { if (below != null && q.s.c.y > below) continue; _cv.copy(q.local).applyMatrix4(G.bones[q.s.bone].matrixWorld).applyMatrix4(inv); out.push(_cv.x, _cv.y, _cv.z, q.s.r * k + pad); if (who) who.push(G, q.s.bone); }
}
// The furniture near her, as boxes: what the room's made of (each a box), found when the cloth's put somewhere.
function clothBoxes(F) {
  let top = F.root; while (top.parent) top = top.parent;
  const hp = F.bone.hips.getWorldPosition(new V3()), out = [];
  top.traverse(o => {
    if (!o.isMesh || !o.geometry || o.geometry.type !== 'BoxGeometry' || o.userData.noCloth) return;
    let p = o; while (p && !p.userData.figure && p.visible) p = p.parent; if (p) return;      // (not a figure's own, nor anything hidden, itself or what it's in)
    const g = o.geometry.parameters; o.updateMatrixWorld(true); const c = o.getWorldPosition(new V3()), sc = new V3().setFromMatrixScale(o.matrixWorld);
    const half = new V3(g.width / 2 * sc.x, g.height / 2 * sc.y, g.depth / 2 * sc.z);
    if (c.distanceTo(hp) > 1.8 + half.length()) return;
    out.push({ m: o.matrixWorld.clone(), half: new V3(g.width / 2, g.height / 2, g.depth / 2) });
  });
  return out;
}
// The cloth for a garment: its grid, its rest shape from the garment as built, the points it's held by at the waist.
function makeCloth(F, name) {
  const L = F.L, gm = F.gm[name], geo = F.model.mesh[name].geo, NC = CL.NC, NR = CL.NR;
  const hem = /^Chemise/.test(name) ? L.chemiseHem : /^NightDress/.test(name) ? L.nightHem : /^Kirtle/.test(name) ? L.kirtleHem : L.skirtHem;
  const y0 = L.waist - 0.006, cx = L.skirtC[0], cz = L.skirtC[1], P = shapedPos(geo, F.keys || {}), n = P.length / 3;
  const SI = gm.geometry.attributes.skinIndex.array, SW = gm.geometry.attributes.skinWeight.array, names = F.bones.map(b => b.name);
  const arm = new Uint8Array(n); for (let i = 0; i < n; i++) { let b = 0; for (let k = 1; k < 4; k++) if (SW[i * 4 + k] > SW[i * 4 + b]) b = k; arm[i] = ARM_BONES.test(names[SI[i * 4 + b]]) ? 1 : 0; }
  // (its outline at each height and angle round her: the furthest of the garment's own points there)
  const R = new Float32Array(NC * (NR + 1)).fill(-1), dy = (y0 - hem) / NR;
  for (let i = 0; i < n; i++) {
    if (arm[i]) continue; const x = P[i * 3] - cx, y = P[i * 3 + 1], z = P[i * 3 + 2] - cz; if (y > y0 + dy || y < hem - dy) continue;
    const r = Math.hypot(x, z), a = (Math.atan2(z, x) + 2 * Math.PI) % (2 * Math.PI), c = Math.round(a / (2 * Math.PI) * NC) % NC, row = Math.round((y0 - y) / dy);
    for (const rr of [row - 1, row, row + 1]) if (rr >= 0 && rr <= NR && Math.abs(y0 - rr * dy - y) < dy * 0.75) { const k = c * (NR + 1) + rr; if (r > R[k]) R[k] = r; }
  }
  for (let it = 0; it < 4; it++) for (let c = 0; c < NC; c++) for (let r = 0; r <= NR; r++) {      // (gaps filled from round about)
    const k = c * (NR + 1) + r; if (R[k] > 0) continue; let s = 0, w = 0;
    for (const [dc, dr] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const cc = (c + dc + NC) % NC, r2 = r + dr; if (r2 < 0 || r2 > NR) continue; const v = R[cc * (NR + 1) + r2]; if (v > 0) { s += v; w++; } }
    if (w) R[k] = s / w;
  }
  // (the rest shape: that outline, with soft folds below the hips; the points' own rest positions are what its pattern's drawn by)
  const B = new Float32Array(NC * (NR + 1) * 3), hipY = L.skirtC[2];
  for (let c = 0; c < NC; c++) for (let r = 0; r <= NR; r++) {
    const k = c * (NR + 1) + r, a = c / NC * 2 * Math.PI, y = y0 - r * dy, f = 0.06 * ss(hipY, hipY - 0.18, y), rad = Math.max(R[k], 0.05) * (1 + f * Math.cos(CL.FOLDS * a));
    B[k * 3] = cx + rad * Math.cos(a); B[k * 3 + 1] = y; B[k * 3 + 2] = cz + rad * Math.sin(a);
  }
  // (the constraints: across, down, both diagonals, and the next but one each way)
  const C = [], idx = (c, r) => ((c + NC) % NC) * (NR + 1) + r, dist = (i, j) => Math.hypot(B[i * 3] - B[j * 3], B[i * 3 + 1] - B[j * 3 + 1], B[i * 3 + 2] - B[j * 3 + 2]);
  const add = (i, j, k) => C.push(i, j, dist(i, j), k);
  for (let c = 0; c < NC; c++) for (let r = 0; r <= NR; r++) {
    const i = idx(c, r); add(i, idx(c + 1, r), 1);
    if (r < NR) { add(i, idx(c, r + 1), 1); add(i, idx(c + 1, r + 1), 0.85); add(idx(c + 1, r), idx(c, r + 1), 0.85); }
    if (r < NR - 1) add(i, idx(c, r + 2), 0.3); add(i, idx(c + 2, r), 0.3);
  }
  // (and each point tethered to the top of its own column: never further from the waist than the cloth between them is long, so the skirt
  // can't slide round her, its back off her seat, however gravity pulls across her)
  const tether = new Float32Array(NC * (NR + 1));
  for (let c = 0; c < NC; c++) { let L_ = 0; for (let r = 1; r <= NR; r++) { L_ += dist(idx(c, r - 1), idx(c, r)); tether[idx(c, r)] = L_ * 1.01; } }
  // (just below the waist, held where the garment is, each point skinned as the garment's nearest point is: fitted there, it goes with her
  // exactly as the bodice does, so there's no step where the one meets the other. Only that strip: over her seat the garment's own skinning
  // crumples as she bends, and the cloth hangs on its own)
  const pin = [], rHip = Math.max(0, Math.min(NR - 2, Math.floor(0.07 / dy)));
  for (let c = 0; c < NC; c++) for (let r = 0; r <= rHip; r++) {
    const k = idx(c, r); let best = -1, bd = 1e9;
    for (let i = 0; i < n; i++) { if (arm[i]) continue; const d = (P[i * 3] - B[k * 3]) ** 2 + (P[i * 3 + 1] - B[k * 3 + 1]) ** 2 + (P[i * 3 + 2] - B[k * 3 + 2]) ** 2; if (d < bd) { bd = d; best = i; } }
    const w = Array.from(SW.slice(best * 4, best * 4 + 4)), ws = w.reduce((a, b) => a + b, 0) || 1;      // (to one: see DQS_PARS)
    pin.push({ k, bind: new V3(B[k * 3], B[k * 3 + 1], B[k * 3 + 2]), j: Array.from(SI.slice(best * 4, best * 4 + 4)), w: w.map(v => v / ws) });
  }
  // (the mesh: the grid's quads, its points' rest positions for its pattern)
  const N = NC * (NR + 1), X = new Float32Array(N * 3), Xp = new Float32Array(N * 3), Nm = new Float32Array(N * 3), I = [];
  const Q = [];
  for (let c = 0; c < NC; c++) for (let r = 0; r < NR; r++) { const a = idx(c, r), b = idx(c + 1, r), d = idx(c, r + 1), e = idx(c + 1, r + 1); I.push(a, b, d, b, e, d); Q.push(a, b, d, e); }
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(X, 3)); g.setAttribute('normal', new THREE.BufferAttribute(Nm, 3));
  g.setAttribute('bind', new THREE.BufferAttribute(B, 3)); g.setAttribute('region', new THREE.BufferAttribute(new Float32Array(N), 1)); g.setIndex(I);
  { const t = new Float32Array(N); for (let k = 0; k < N; k++) t[k] = ss(y0, y0 - 0.1, B[k * 3 + 1]); g.setAttribute('clothT', new THREE.BufferAttribute(t, 1)); }      // (its thickness, none at the waist)
  const dm = gm.material, m = tmat('#ffffff', { side: THREE.DoubleSide, rim: '#3a3028', rimK: 0.55, pattern: 'dressG', bindAttr: true, unique: true });
  m.polygonOffset = true; m.polygonOffsetFactor = -1; m.polygonOffsetUnits = -2;      // (over her drawers wherever it lies close on them)
  { const prev = m.onBeforeCompile, key = m.customProgramCacheKey();      // (and drawn a few millimetres out from where it is: its own thickness)
    m.onBeforeCompile = (sh, r) => { prev(sh, r); sh.vertexShader = 'attribute float clothT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(objectNormal) * 0.004 * clothT;'); };
    m.customProgramCacheKey = () => key + '|cloth'; }
  for (const k in dm.userData.u) if (k !== 'uHide' && k !== 'uCut') m.userData.u[k] = dm.userData.u[k];
  m.color.copy(dm.color);
  const mesh = new THREE.Mesh(g, m); mesh.frustumCulled = false; mesh.castShadow = true; mesh.userData.figure = F;
  const hull = new THREE.Mesh(g, CLOTH_INK); hull.frustumCulled = false; mesh.add(hull);
  F.root.add(mesh);
  return { name, mesh, hull, g, X, Xp, Nm, B, C: Float32Array.from(C), Q: Int32Array.from(Q), tether, pin, NC, NR, hem, y0, live: false, key: null, boxes: [], sph: [], arm };
}
const CLOTH_INK = (() => {
  const m = new THREE.MeshBasicMaterial(Object.assign({ color: srgb(INK), side: THREE.BackSide }, HULL_OFS));
  m.onBeforeCompile = sh => { sh.vertexShader = 'attribute float clothT;\n' + sh.vertexShader.replace('#include <begin_vertex>', '#include <begin_vertex>\n  transformed += normalize(normal) * (' + INK_W.toFixed(4) + ' + 0.004 * clothT);'); };
  return m;
})();
// (a point in the model's space, skinned by the given bones and weights, in the figure's own space now)
function skinPoint(F, p, J, W, inv, out) {
  _cv2.copy(p).applyMatrix4(F.bindM); out.set(0, 0, 0);
  for (let k = 0; k < J.length; k++) { if (!W[k]) continue; _cm2.multiplyMatrices(F.bones[J[k]].matrixWorld, F.skeleton.boneInverses[J[k]]); out.addScaledVector(_cv.copy(_cv2).applyMatrix4(_cm2), W[k]); }
  return out.applyMatrix4(inv);
}
// Raised: the back of the skirt rolled up to the small of her back, tight to her. Each column within about 60° of the middle of her back lies
// flat on her from her waist down to the roll, then is wound from there to the hem round a slim tube lying across her back just above her
// seat (lower toward its ends), the hem at its heart, as thick as the cloth in it. Every point of it is laid a few millimetres off her (her
// body, or her drawers where they're on over it, measured at that point's own height round her), carried by her hips. The sides and the
// front are free, and fall from it.
function rollOf(F, C) {
  const L = F.L, NC = C.NC, NR = C.NR, B = C.B, cx = L.skirtC[0], cz = L.skirtC[1], out = new Map(), span = 1.05, GAP = 0.004;
  const yR = L.rollY, dy = (C.y0 - C.hem) / NR, rTop = Math.max(1, Math.ceil((C.y0 - yR) / dy)), rFit = Math.max(0, Math.min(NR - 2, Math.floor(0.07 / dy)));
  // (how far out she is round her, by angle and height, every 5 mm: her body, and her drawers or leggings where they're on over it)
  const Y0 = yR - 0.12, Y1 = C.y0 + 0.02, HB = Math.ceil((Y1 - Y0) / 0.005), on = new Float32Array(NC * HB), names = F.bones.map(b => b.name);
  for (const nm of ['Body', ...clothUnder(F)]) {
    const g = F.model.mesh[nm] && F.model.mesh[nm].geo; if (!g) continue;
    const P = shapedPos(g, F.keys || {}), SI = g.attributes.skinIndex.array, SW = g.attributes.skinWeight.array;
    for (let i = 0; i < P.length / 3; i++) {
      const y = P[i * 3 + 1]; if (y > Y1 || y < Y0) continue;
      let b = 0; for (let k = 1; k < 4; k++) if (SW[i * 4 + k] > SW[i * 4 + b]) b = k; if (ARM_BONES.test(names[SI[i * 4 + b]])) continue;
      const x = P[i * 3] - cx, z = P[i * 3 + 2] - cz, c = Math.round(((Math.atan2(z, x) + 2 * Math.PI) % (2 * Math.PI)) / (2 * Math.PI) * NC) % NC, h = Math.floor((y - Y0) / 0.005);
      const r = Math.hypot(x, z); for (const cc of [c, (c + 1) % NC, (c + NC - 1) % NC]) if (r > on[cc * HB + h]) on[cc * HB + h] = r;
    }
  }
  const her = (c, y) => { const h = clamp(Math.floor((y - Y0) / 0.005), 0, HB - 1); let r = 0; for (let j = Math.max(0, h - 1); j <= Math.min(HB - 1, h + 1); j++) r = Math.max(r, on[c * HB + j]); return r; };
  const len = (C.hem < yR ? (yR - C.hem) : 0.05) * 1.05, rho = Math.sqrt(len * 0.0025 / Math.PI + 0.008 * 0.008);
  for (let c = 0; c < NC; c++) {
    const a = c / NC * 2 * Math.PI, d = Math.atan2(Math.sin(a + Math.PI / 2), Math.cos(a + Math.PI / 2));      // (from the middle of her back)
    if (Math.abs(d) > span) continue;
    const e = Math.abs(d) / span, rr = rho * (1 - 0.45 * e * e), yc = yR - 0.035 * e * e;
    const Nv = new V3(Math.cos(a), 0, Math.sin(a)), Up = new V3(0, 1, 0);
    const lay = (p) => { const r0 = Math.hypot(p.x - cx, p.z - cz), want = her(c, p.y) + GAP; if (want > 0.03 && r0 < want) { p.x = cx + (p.x - cx) * want / r0; p.z = cz + (p.z - cz) * want / r0; } return p; };
    // (from the waist down to the roll, flat on her, to where the roll's inner side lies on her)
    for (let r = rFit + 1; r < rTop; r++) { const k = c * (NR + 1) + r, y = C.y0 + (yc - C.y0) * r / rTop; out.set(k, lay(new V3(cx, y, cz).addScaledVector(Nv, her(c, y) + GAP))); }      // (above, fitted as the dress is: see makeCloth)
    const ctr = new V3(cx, yc, cz).addScaledVector(Nv, her(c, yc) + GAP + rr);
    let th = Math.PI, s = 0;
    for (let r = rTop; r <= NR; r++) {
      const k = c * (NR + 1) + r, rad = rr * (1 - 0.7 * Math.min(1, s / len)) + 0.002;
      out.set(k, lay(ctr.clone().addScaledVector(Nv, rad * Math.cos(th)).addScaledVector(Up, rad * Math.sin(th))));
      const step = r < NR ? Math.hypot(B[(k + 1) * 3] - B[k * 3], B[(k + 1) * 3 + 1] - B[k * 3 + 1], B[(k + 1) * 3 + 2] - B[k * 3 + 2]) : 0;
      s += step; th += step / Math.max(rad, 0.005);      // (down its inner side against her, under, up its outer side, over, and in toward the hem at its heart)
    }
  }
  return out;
}
// (her bones for where the skirt starts as it's put somewhere: her hips above, both thighs alike below, as a skirt hangs between her legs)
function clothStart(F, C, inv, k, out) {
  const L = F.L, y = C.B[k * 3 + 1], h = clamp((L.skirtC[2] + 0.02 - y) / (L.skirtC[2] + 0.02 - (L.crotch - 0.11)), 0, 1), hs = h * h * (3 - 2 * h);
  const kb = 0.6 * clamp((L.knee + 0.14 - y) / 0.26, 0, 1), bi = n => F.bones.indexOf(F.bone[n]);
  return skinPoint(F, _cv.set(C.B[k * 3], y, C.B[k * 3 + 2]).clone(), [bi('hips'), bi('thighL'), bi('thighR'), bi('shinL'), bi('shinR')], [1 - hs, hs * (1 - kb) / 2, hs * (1 - kb) / 2, hs * kb / 2, hs * kb / 2], inv, out);
}
const FIGS = new Set();
// Where each free point of the cloth is held, once it's settled: on whatever it lies on, the bone of the nearest of her (or his) spheres,
// fading toward her hips the further it hangs clear of anything; how firmly (firmer where it lies on something). Each kept in its bones' own
// frames, so it's carried as they move.
function anchorsOf(F, C, inv, S, who, W, upto) {
  const X = C.X, N = X.length / 3, list = new Array(N).fill(null), hb = F.bones.indexOf(F.bone.hips), toW = F.root.matrixWorld;
  const local = (G, b, p) => p.clone().applyMatrix4(toW).applyMatrix4(_cm.copy(G.bones[b].matrixWorld).invert());
  for (let k = 0; k < N; k++) {
    if (!W[k]) continue;
    const p = new V3(X[k * 3], X[k * 3 + 1], X[k * 3 + 2]); let best = -1, bd = 1e9;
    for (let q = 0; q < (upto == null ? S.length : upto); q += 4) { const d = Math.hypot(p.x - S[q], p.y - S[q + 1], p.z - S[q + 2]) - S[q + 3]; if (d < bd) { bd = d; best = q / 4; } }
    const near = best < 0 ? 0 : 1 - ss(0.015, 0.12, bd), on = [];
    if (best >= 0 && near > 0) on.push([who[best * 2], who[best * 2 + 1], local(who[best * 2], who[best * 2 + 1], p), near]);
    if (near < 1) on.push([F, hb, local(F, hb, p), 1 - near]);
    list[k] = { on, t: new V3(), k: lerp(0.02, 0.12, near) };
  }
  return { list };
}
// (what's showing under her raised skirt, that it lies on: her drawers or smalls, her leggings, up or lowered)
const clothUnder = F => { const w = F.spec.outfit === 'period' ? periodNames(F) : {}; return [w.under, w.bottoms].filter(Boolean); };
// A step of the cloth: held at the waist (and, raised, in its roll), falling, kept its shape, out of her, Silas, the furniture and the floor.
// Put somewhere new (a pose; raised or let down; moved bodily), it's settled at once, behind the cut: she's brought into the pose from
// standing, her hips where the pose has them and the rest of her easing from her rest pose into it, the cloth (starting as the skirt is on
// her, standing) following as it would, so it ends where it would hang on her, never started through her legs; then it settles.
function tickCloth(F, dt) {
  const C = F.cloth; if (!C || !C.mesh.visible) return;
  F.root.updateMatrixWorld(true);
  const inv = new THREE.Matrix4().copy(F.root.matrixWorld).invert(), X = C.X, Xp = C.Xp, N = X.length / 3, up = F.state.top === 'up', key = (F.drapePose || '-') + (up ? ':up' : '');
  const W = C.W || (C.W = new Float32Array(N)), hb = F.bones.indexOf(F.bone.hips), uk = clothUnder(F).join();
  if (up && (!C.roll || C.rollKey !== uk)) { C.roll = rollOf(F, C); C.rollKey = uk; }
  const R = up ? C.roll : null;
  let lifting = R;      // (what's rolled, while she's brought into the pose: nothing, till the skirt's hung and then lifted)
  const pins = () => { const T = new Map(); for (const q of C.pin) T.set(q.k, skinPoint(F, q.bind, q.j, q.w, inv, new V3())); if (lifting) for (const [k, p] of lifting) T.set(k, skinPoint(F, p, [hb], [1], inv, new V3())); return T; };
  let T = pins();
  const t0 = T.get(C.pin[0].k);
  let jump = !C.live || C.key !== key || !C.last || C.last.distanceTo(t0) > 0.2;
  // (settled, it's frozen: not simulated any more, each point carried as she moves by her bones as it was anchored to them: next to nothing
  // a frame. Put somewhere new, it's settled again)
  // (where her knees are, from her hips: how far her legs have moved since it was frozen, or since the frame before)
  const hipInv = _cm2.copy(F.bone.hips.matrixWorld).invert(), knees = [F.bone.shinL, F.bone.shinR].map(b => b.getWorldPosition(new V3()).applyMatrix4(hipInv));
  const moved = ref => (ref ? Math.max(knees[0].distanceTo(ref[0]), knees[1].distanceTo(ref[1])) * F.root.matrixWorld.getMaxScaleOnAxis() : 9);
  // (her legs moved well away from where they were when it froze (into another pose): simulated again till she's still, then frozen anew)
  if (!jump && C.frozen && moved(C.ref) > 0.25) { C.frozen = false; C.anchor = null; C.steady = 0; }      // (a quarter of a metre: another pose, not a kick or a stamp)
  if (!jump && C.frozen && C.anchor) {
    const AN = C.anchor.list;
    for (let k = 0; k < N; k++) {
      const p = T.get(k); if (p) { X[k * 3] = p.x; X[k * 3 + 1] = p.y; X[k * 3 + 2] = p.z; continue; }
      const a = AN[k]; if (!a) continue; let x = 0, y = 0, z = 0;
      for (const [G, b, loc, w] of a.on) { _cv.copy(loc).applyMatrix4(G.bones[b].matrixWorld).applyMatrix4(inv); x += _cv.x * w; y += _cv.y * w; z += _cv.z * w; }
      X[k * 3] = x; X[k * 3 + 1] = y; X[k * 3 + 2] = z;
    }
    C.last = t0.clone(); clothNormals(C); C.g.attributes.position.needsUpdate = true; C.g.attributes.normal.needsUpdate = true;
    return;
  }
  // (what it lies on besides her: anyone near her, the furniture, the floor; her own spheres each step, as she moves)
  const hp = F.bone.hips.getWorldPosition(new V3()), others = [];
  // (anyone else: his lap and legs, below his waist; not the rest of him, which her skirt only ever brushes, and would catch on)
  const othersWho = [];
  for (const G of FIGS) { if (G === F || !G.root.parent || !G.root.visible || !G.model) continue; if (G.bone.hips.getWorldPosition(new V3()).distanceTo(hp) > 2.2) continue; spheresIn(G, inv, others, CL.MS, null, G.L.waist - 0.03, othersWho); }
  if (jump) C.boxes = clothBoxes(F);
  const BX = C.boxes.map(b => { const m = new THREE.Matrix4().multiplyMatrices(inv, b.m), mi = m.clone().invert(), sx = new V3().setFromMatrixColumn(m, 0).length(), sy = new V3().setFromMatrixColumn(m, 1).length(), sz = new V3().setFromMatrixColumn(m, 2).length();
    const h = [b.half.x + CL.M / sx, b.half.y + CL.M / sy, b.half.z + CL.M / sz], bb = new THREE.Box3();
    for (const a of [-1, 1]) for (const b_ of [-1, 1]) for (const c of [-1, 1]) bb.expandByPoint(new V3(a * h[0], b_ * h[1], c * h[2]).applyMatrix4(m));
    return { m, mi, h, bb }; });
  const fn = new V3(0, 1, 0).transformDirection(inv), f0 = new V3(0, 0.004, 0).applyMatrix4(inv), fd = fn.dot(f0);
  const cell = 0.1, skey = (a, b, c) => ((a * 73856093) ^ (b * 19349663) ^ (c * 83492791)) | 0;
  let S = [], SH = new Map(), own = 0;
  let who = [];
  const current = () => { const A = []; who = []; spheresIn(F, inv, A, CL.M, clothUnder(F), null, who); own = A.length; for (let q = 0; q < others.length; q++) A.push(others[q]); for (const w of othersWho) who.push(w); return A; };
  const colliders = A => {
    S = A || current(); SH = new Map();
    for (let q = 0; q < S.length; q += 4) { const r = S[q + 3]; for (let a = Math.floor((S[q] - r) / cell); a <= Math.floor((S[q] + r) / cell); a++) for (let b = Math.floor((S[q + 1] - r) / cell); b <= Math.floor((S[q + 1] + r) / cell); b++) for (let c = Math.floor((S[q + 2] - r) / cell); c <= Math.floor((S[q + 2] + r) / cell); c++) { const k = skey(a, b, c); let L_ = SH.get(k); if (!L_) SH.set(k, (L_ = [])); L_.push(q); } }
  };
  // (cloth on something holds there: pushed out of it, and what it's moved across it since the last step mostly undone, so it doesn't slide
  // off her thighs into the gap between them, or creep)
  const fric = (i, nx, ny, nz) => {
    const mx = X[i * 3] - Xp[i * 3], my = X[i * 3 + 1] - Xp[i * 3 + 1], mz = X[i * 3 + 2] - Xp[i * 3 + 2], dn = mx * nx + my * ny + mz * nz, f = 0.85;
    X[i * 3] -= (mx - dn * nx) * f; X[i * 3 + 1] -= (my - dn * ny) * f; X[i * 3 + 2] -= (mz - dn * nz) * f;
  };
  // (where she and anyone else overlap, his lap under her, him close at her hip, there's nowhere for it to be outside both: caught there, it's
  // held where it is, as it would be pinched between them, not pushed from one to the other and so through one of them. Elsewhere, anyone
  // else first, then her; it slides off him freely, only on her does it hold)
  let pinch = false;
  const collide = i => {
    let x = X[i * 3], y = X[i * 3 + 1], z = X[i * 3 + 2], hit = false, nx = 0, ny = 0, nz = 0;
    const L_ = SH.get(skey(Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell)));
    if (L_ && pinch) {
      let inHer = false, inHim = false;
      for (const q of L_) { const dx = x - S[q], dy = y - S[q + 1], dz = z - S[q + 2], r = S[q + 3]; if (dx * dx + dy * dy + dz * dz < r * r) { if (q < own) inHer = true; else inHim = true; } if (inHer && inHim) break; }
      if (inHer && inHim) { X[i * 3] = Xp[i * 3]; X[i * 3 + 1] = Xp[i * 3 + 1]; X[i * 3 + 2] = Xp[i * 3 + 2]; return; }
    }
    if (L_) {
      for (const q of L_) { if (q < own) continue; const dx = x - S[q], dy = y - S[q + 1], dz = z - S[q + 2], r = S[q + 3], d2 = dx * dx + dy * dy + dz * dz; if (d2 < r * r) { const d = Math.sqrt(d2) || 1e-6, k = r / d; x = S[q] + dx * k; y = S[q + 1] + dy * k; z = S[q + 2] + dz * k; } }
      for (const q of L_) { if (q >= own) continue; const dx = x - S[q], dy = y - S[q + 1], dz = z - S[q + 2], r = S[q + 3], d2 = dx * dx + dy * dy + dz * dz; if (d2 < r * r) { const d = Math.sqrt(d2) || 1e-6, k = r / d; x = S[q] + dx * k; y = S[q + 1] + dy * k; z = S[q + 2] + dz * k; nx += dx / d; ny += dy / d; nz += dz / d; hit = true; } }
    }
    for (const b of BX) {
      if (x < b.bb.min.x || x > b.bb.max.x || y < b.bb.min.y || y > b.bb.max.y || z < b.bb.min.z || z > b.bb.max.z) continue;
      _cv.set(x, y, z).applyMatrix4(b.mi); const px = b.h[0] - Math.abs(_cv.x), py = b.h[1] - Math.abs(_cv.y), pz = b.h[2] - Math.abs(_cv.z);
      if (px > 0 && py > 0 && pz > 0) {
        _cv2.set(0, 0, 0); if (px <= py && px <= pz) { _cv.x = Math.sign(_cv.x) * b.h[0]; _cv2.x = Math.sign(_cv.x); } else if (py <= pz) { _cv.y = Math.sign(_cv.y) * b.h[1]; _cv2.y = Math.sign(_cv.y); } else { _cv.z = Math.sign(_cv.z) * b.h[2]; _cv2.z = Math.sign(_cv.z); }
        _cv.applyMatrix4(b.m); _cv2.transformDirection(b.m); x = _cv.x; y = _cv.y; z = _cv.z; nx += _cv2.x; ny += _cv2.y; nz += _cv2.z; hit = true;
      }
    }
    const fl = fn.x * x + fn.y * y + fn.z * z - fd; if (fl < 0) { x -= fn.x * fl; y -= fn.y * fl; z -= fn.z * fl; nx += fn.x; ny += fn.y; nz += fn.z; hit = true; }
    X[i * 3] = x; X[i * 3 + 1] = y; X[i * 3 + 2] = z;
    if (hit) { const l = Math.hypot(nx, ny, nz) || 1; fric(i, nx / l, ny / l, nz / l); }
  };
  // (moved bodily between one frame and the next, a leg more than a hand's breadth (put in another stance, another pose): placed anew, and
  // settled, not dragged through)
  if (!jump && C.prevS) { const A = current(); if (A.length === C.prevS.length) { let far = 0; for (let q = 0; q < own; q += 4) far = Math.max(far, Math.hypot(A[q] - C.prevS[q], A[q + 1] - C.prevS[q + 1], A[q + 2] - C.prevS[q + 2])); if (far > 0.1) { jump = true; C.boxes = clothBoxes(F); } } }
  const g = new V3(0, -9.8, 0).transformDirection(inv).multiplyScalar(9.8 / F.root.matrixWorld.getMaxScaleOnAxis()), CC = C.C, R1 = C.NR + 1, TE = C.tether, QQ = C.Q;
  let AN = null; const VMAX = 0.015;
  const run = (steps, h, damp, its) => {
    W.fill(1); for (const k of T.keys()) W[k] = 0;
    for (let s = 0; s < steps; s++) {
      for (let k = 0; k < N; k++) {
        if (!W[k]) { const p = T.get(k); X[k * 3] = Xp[k * 3] = p.x; X[k * 3 + 1] = Xp[k * 3 + 1] = p.y; X[k * 3 + 2] = Xp[k * 3 + 2] = p.z; continue; }
        let vx = (X[k * 3] - Xp[k * 3]) * damp, vy = (X[k * 3 + 1] - Xp[k * 3 + 1]) * damp, vz = (X[k * 3 + 2] - Xp[k * 3 + 2]) * damp;
        const vl = Math.hypot(vx, vy, vz); if (vl > VMAX) { const f = VMAX / vl; vx *= f; vy *= f; vz *= f; }      // (never flung: so far a step, no further)
        Xp[k * 3] = X[k * 3]; Xp[k * 3 + 1] = X[k * 3 + 1]; Xp[k * 3 + 2] = X[k * 3 + 2];
        X[k * 3] += vx + g.x * h * h; X[k * 3 + 1] += vy + g.y * h * h; X[k * 3 + 2] += vz + g.z * h * h;
        // (held, softly, where it settled on whatever it lies on, carried as that moves: it follows her and can't drift off her or slide
        // through his knee over time; moved with what it's on, not pulled, so it doesn't swing)
        if (AN) { const a = AN[k]; if (a) { const t = a.t, dx = (t.x - X[k * 3]) * a.k, dy = (t.y - X[k * 3 + 1]) * a.k, dz = (t.z - X[k * 3 + 2]) * a.k; X[k * 3] += dx; X[k * 3 + 1] += dy; X[k * 3 + 2] += dz; Xp[k * 3] += dx; Xp[k * 3 + 1] += dy; Xp[k * 3 + 2] += dz; } }
      }
      for (let it = 0; it < its; it++) {
        for (let q = 0; q < CC.length; q += 4) {
          const i = CC[q], j = CC[q + 1], wi = W[i], wj = W[j], ws = wi + wj; if (!ws) continue;
          const dx = X[j * 3] - X[i * 3], dy = X[j * 3 + 1] - X[i * 3 + 1], dz = X[j * 3 + 2] - X[i * 3 + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1e-9;
          const rest = CC[q + 2], k = CC[q + 3] * (d < rest ? 0.7 : 1) * (d - rest) / (d * ws);      // (it gives a little more easily to being pushed together, into folds, than to stretching)
          X[i * 3] += dx * k * wi; X[i * 3 + 1] += dy * k * wi; X[i * 3 + 2] += dz * k * wi; X[j * 3] -= dx * k * wj; X[j * 3 + 1] -= dy * k * wj; X[j * 3 + 2] -= dz * k * wj;
        }
        for (let k = 0; k < N; k++) {
          if (!W[k]) continue; const top = k - (k % R1);      // (tethered to the waist, at the top of its column)
          const dx = X[k * 3] - X[top * 3], dy = X[k * 3 + 1] - X[top * 3 + 1], dz = X[k * 3 + 2] - X[top * 3 + 2], d = Math.sqrt(dx * dx + dy * dy + dz * dz);
          if (d > TE[k]) { const f = TE[k] / d; X[k * 3] = X[top * 3] + dx * f; X[k * 3 + 1] = X[top * 3 + 1] + dy * f; X[k * 3 + 2] = X[top * 3 + 2] + dz * f; }
          collide(k);
        }
        // (and the middle of each cell of it, between its four points: nothing pokes through between them; what's needed to put the middle
        // outside is given to the four)
        for (let q = 0; q < QQ.length; q += 4) {
          const a = QQ[q], b = QQ[q + 1], c = QQ[q + 2], d = QQ[q + 3], wsum = W[a] + W[b] + W[c] + W[d]; if (!wsum) continue;
          const x = (X[a * 3] + X[b * 3] + X[c * 3] + X[d * 3]) / 4, y = (X[a * 3 + 1] + X[b * 3 + 1] + X[c * 3 + 1] + X[d * 3 + 1]) / 4, z = (X[a * 3 + 2] + X[b * 3 + 2] + X[c * 3 + 2] + X[d * 3 + 2]) / 4;
          const L_ = SH.get(skey(Math.floor(x / cell), Math.floor(y / cell), Math.floor(z / cell))); if (!L_) continue;
          let px = 0, py = 0, pz = 0, inHer = false, inHim = false;
          for (const s_ of L_) {
            const dx = x + px - S[s_], dy = y + py - S[s_ + 1], dz = z + pz - S[s_ + 2], r = S[s_ + 3], d2 = dx * dx + dy * dy + dz * dz;
            if (d2 < r * r) { if (s_ < own) inHer = true; else inHim = true; const dd = Math.sqrt(d2) || 1e-6, k = (r - dd) / dd; px += dx * k; py += dy * k; pz += dz * k; }
          }
          if (!(px || py || pz) || (pinch && inHer && inHim)) continue;
          const f = 4 / wsum;
          for (const i of [a, b, c, d]) if (W[i]) { X[i * 3] += px * f * W[i] / 4 * 4; X[i * 3 + 1] += py * f * W[i] / 4 * 4; X[i * 3 + 2] += pz * f * W[i] / 4 * 4; }
        }
      }
    }
  };
  if (jump) {
    AN = null; C.anchor = null; C.frozen = false;
    // (from standing into the pose: every bone but her hips eased from rest to where the pose has it)
    const fin = F.bones.map(b => [b.quaternion.clone(), b.position.clone()]), I = new THREE.Quaternion();
    const at = t => { F.bones.forEach((b, i) => { if (i === hb) return; b.quaternion.copy(I).slerp(fin[i][0], t); b.position.copy(F.rest0[b.name]).lerp(fin[i][1], t); }); F.root.updateMatrixWorld(true); };
    lifting = null; at(0); T = pins();
    const q = new V3(); for (let k = 0; k < N; k++) { skinPoint(F, _cv.set(C.B[k * 3], C.B[k * 3 + 1], C.B[k * 3 + 2]).clone(), [hb], [1], inv, q); X[k * 3] = q.x; X[k * 3 + 1] = q.y; X[k * 3 + 2] = q.z; }
    Xp.set(X);
    // (as many steps of it as it takes for nothing of her to move more than a centimetre at a time, legs sweeping down through where the
    // skirt hangs included: it's pushed ahead of them, never passed through)
    colliders(); const A0 = S.slice(0, own); at(1); const A1 = current().slice(0, own); at(0);
    let D = 0; for (let q = 0; q < Math.min(A0.length, A1.length); q += 4) D = Math.max(D, Math.hypot(A1[q] - A0[q], A1[q + 1] - A0[q + 1], A1[q + 2] - A0[q + 2]));
    const TN = CL.debugSteps != null ? Math.min(CL.debugSteps, 40) : clamp(Math.ceil(D / 0.01), 40, 180);
    for (let i = 1; i <= TN; i++) { at(i / TN); T = pins(); colliders(); run(1, 1 / 60, 0.85, 6); }
    F.bones.forEach((b, i) => { b.quaternion.copy(fin[i][0]); b.position.copy(fin[i][1]); }); F.root.updateMatrixWorld(true); T = pins();
    colliders(); run(CL.debugSteps != null ? Math.max(0, CL.debugSteps - 40) : 100, 1 / 60, 0.88, 8);
    // (raised: the skirt, hung as it falls in the pose, then its back lifted: each point of what's rolled carried from where it hangs, out over
    // her (clear of her seat), and up to its place in the roll, a little at a time, the rest of it following as it would)
    if (R) {
      const from = new Map(), to = new Map(); for (const [k, p] of R) { from.set(k, new V3(X[k * 3], X[k * 3 + 1], X[k * 3 + 2])); to.set(k, skinPoint(F, p, [hb], [1], inv, new V3())); }
      const hc = new V3().setFromMatrixPosition(F.bone.hips.matrixWorld).applyMatrix4(inv), LN = 40;
      for (let i = 1; i <= LN; i++) {
        const u = i / LN, e = u * u * (3 - 2 * u); T = pins();
        for (const [k, a] of from) { const b = to.get(k), out = a.clone().add(b).multiplyScalar(0.5).sub(hc).normalize(); T.set(k, a.clone().lerp(b, e).addScaledVector(out, 0.12 * Math.sin(Math.PI * u))); }
        run(2, 1 / 60, 0.85, 6);
      }
      lifting = R; T = pins(); run(60, 1 / 60, 0.88, 8);
    }
    C.anchor = anchorsOf(F, C, inv, S, who, W, CL.live ? S.length : own); C.frozen = !CL.live; C.ref = knees; C.steady = 0;
    C.key = key; C.live = true;
  } else {
    // (after: a step a frame (two when frames come slowly), damped hard: it follows her, it doesn't swing about. When she moves quickly (a
    // kick, a buck), more: what it lies on and where it's held eased from where they were the frame before, a centimetre or so at a time,
    // so a leg pushes the cloth ahead of it rather than passing through it between one frame and the next)
    const A = current(), P0 = C.prevS && C.prevS.length === A.length ? C.prevS : null, T0 = C.prevT;
    if (C.anchor) { AN = C.anchor.list; for (const a of AN) if (a) { a.t.set(0, 0, 0); for (const [G, b, loc, w] of a.on) a.t.addScaledVector(_cv.copy(loc).applyMatrix4(G.bones[b].matrixWorld).applyMatrix4(inv), w); } }
    let far = 0; if (P0) for (let q = 0; q < A.length; q += 4) far = Math.max(far, Math.abs(A[q] - P0[q]) + Math.abs(A[q + 1] - P0[q + 1]) + Math.abs(A[q + 2] - P0[q + 2]));
    const steps = Math.max(dt > 1 / 40 ? 2 : 1, P0 ? Math.min(16, Math.ceil(far / 0.008)) : 1), h = Math.min(dt, 0.1) / steps, Tn = T; pinch = true;
    for (let j = 1; j <= steps; j++) {
      const u = j / steps;
      if (P0 && u < 1) { const Ai = new Array(A.length); for (let q = 0; q < A.length; q++) Ai[q] = P0[q] + (A[q] - P0[q]) * u; colliders(Ai); } else colliders(A);
      if (T0 && u < 1) { T = new Map(); for (const [k, p] of Tn) { const p0 = T0.get(k); T.set(k, p0 ? p0.clone().lerp(p, u) : p); } } else T = Tn;
      run(1, h, 0.93, 5);
    }
    C.prevS = A;
  }
  // (simulated while she moves into place: frozen once her legs have been still for half a second, anchored where it's settled)
  if (!jump && !CL.live && !C.frozen) {
    C.steady = moved(C.kPrev) < 0.004 ? (C.steady || 0) + dt : 0;
    if (C.steady > 0.5) { C.anchor = anchorsOf(F, C, inv, S, who, W, own); C.frozen = true; C.ref = knees; }
  }
  C.kPrev = knees;
  C.last = T.get(C.pin[0].k).clone(); C.prevT = T;
  if (jump) C.prevS = null;
  clothNormals(C); C.g.attributes.position.needsUpdate = true; C.g.attributes.normal.needsUpdate = true;
}
function clothNormals(C) {
  const X = C.X, Nm = C.Nm, NC = C.NC, NR = C.NR, R1 = NR + 1;
  for (let c = 0; c < NC; c++) for (let r = 0; r <= NR; r++) {
    const k = c * R1 + r, a = ((c + 1) % NC) * R1 + r, b = ((c + NC - 1) % NC) * R1 + r, d = c * R1 + Math.min(NR, r + 1), e = c * R1 + Math.max(0, r - 1);
    const ux = X[a * 3] - X[b * 3], uy = X[a * 3 + 1] - X[b * 3 + 1], uz = X[a * 3 + 2] - X[b * 3 + 2], vx = X[d * 3] - X[e * 3], vy = X[d * 3 + 1] - X[e * 3 + 1], vz = X[d * 3 + 2] - X[e * 3 + 2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1;
    Nm[k * 3] = nx / l; Nm[k * 3 + 1] = ny / l; Nm[k * 3 + 2] = nz / l;
  }
}
// (Fenwick: a chemise, shirt-length, isn't raised by hand: at the table it rides up of itself, and across the knee it goes up when her drawers
// (or smalls) come down, and down again when they're back up)
const AUTO_TOP = { chemise: true };
function autoTop(F) {
  const P = F.spec.period || {}; F.autoTop = !!AUTO_TOP[P.kind]; if (!F.autoTop) return;
  F.state.top = F.drapePose === 'edge' || F.drapePose === 'table' || F.state.under === 'down' ? 'up' : 'down';
}
function dressPeriod(F) {
  autoTop(F);
  const want = periodNames(F), on = new Set(Object.values(want).filter(Boolean));
  // (under a long skirt that's down, her drawers aren't drawn, nor the skin it covers: nothing of them shows, and its cloth lies close
  // enough over them that they'd come through it. Not under a kirtle or a chemise, which they show below)
  // (nothing under her skirt hidden, her drawers nor her skin: it's cloth, and may lift off her anywhere; what it covers is there under it)
  const covered = false;
  for (const k of on) garmentPeriod(F, k);
  for (const k in F.gm) { const m = F.gm[k], v = on.has(k) && !(covered && k === want.under); m.visible = v; if (m.userData.hull) m.userData.hull.visible = v; }
  F.clothes = { top: F.gm[want.top], bottoms: want.bottoms ? F.gm[want.bottoms] : null, under: F.gm[want.under] }; F.bootL = F.bootR = F.gm.Boots;
  F.topName = want.top;
  // (below the waist, her skirt's cloth: made for the garment she's in, kept while she's in it)
  if (F.cloth && F.cloth.name !== want.top) { F.root.remove(F.cloth.mesh); F.cloth = null; }
  if (want.top && CLOTHED.test(want.top) && F.gm[want.top]) { if (!F.cloth) F.cloth = makeCloth(F, want.top); F.cloth.mesh.visible = true; }
  F.layers = (F.spec.period || {}).none ? [] : (F.autoTop ? [] : ['top']).concat(['under'], want.bottoms ? ['bottoms'] : []);
  F.skirt = (F.spec.period || {}).none ? null : (F.spec.period || {}).kind === 'kirtle' ? 'short' : 'long';
  let hide = 0; for (const k of on) for (const r of PHIDE[CLOTHED.test(k) && !covered ? k + 'Up' : k] || []) hide |= 1 << R[r];      // (raised, nothing under the cloth hidden: it hangs clear of her)
  F.skinMat.userData.u.uHide.value = hide;
  // (stockings under a dress, to above the knee; none under leggings)
  const P = F.spec.period || {}; F.skinMat.userData.u.uStock.value.set(0, 0, 0, 0);
  if (P.stockings && P.legs !== 'leggings') { const c = srgb(P.stockings); F.skinMat.userData.u.uStock.value.set(c.r, c.g, c.b, F.L.knee + 0.105); }
  if (F.spot) for (const k of SPOTS) F.mark(k, 0);
}
// (how far out from her skin her clothes are over her seat, the outermost layer that covers it: the skirt, the kirtle, leggings, drawers or
// smalls; and at her back, where Silas's other hand lies: over the roll, when the skirt's raised, or over the bodice and skirt)
function liftPeriod(F) {
  const st = F.state, P = F.spec.period || {};
  if (P.none) return 0.004;
  if (st.top === 'down') return P.kind === 'kirtle' ? 0.02 : 0.03;
  if (P.legs === 'leggings' && st.bottoms === 'up') return 0.009;
  if (st.under === 'up') return P.under === 'smalls' ? 0.006 : 0.014;
  return 0.004;
}
function backPeriod(F, where) { if ((F.spec.period || {}).none) return 0.004; const raised = F.state.top === 'up'; return where === 'roll' ? (raised ? 0.06 : 0.026) : 0.012; }
function cushionPeriod(F, area) {
  const st = F.state, P = F.spec.period || {}; let left = 1;
  if (P.none) return 0;
  if (st.top === 'down' && (P.kind !== 'kirtle' || area !== 'thighs')) left *= 1 - PCUSH.skirt;
  if (P.legs === 'leggings' && st.bottoms === 'up') left *= 1 - PCUSH.leggings;
  if (st.under === 'up' && (P.under !== 'smalls' || area !== 'thighs')) left *= 1 - (P.under === 'smalls' ? PCUSH.smalls : PCUSH.drawers);
  return 1 - left;
}
const NIGHT_M = '#ddd4c2';      // (undyed linen)
function dressGLB(F) {
  if (F.spec.outfit === 'night') {      // (Fenwick: his nightclothes: the long nightshirt over linen drawers; barefoot)
    const on = new Set(['NightShirt', 'Drawers'].filter(k => F.model.mesh[k]));
    for (const k of on) garmentGLB(F, k);
    for (const k in F.gm) { const m = F.gm[k], v = on.has(k); m.visible = v; if (m.userData.hull) m.userData.hull.visible = v; }
    F.clothes = { top: F.gm.NightShirt || null, bottoms: null, under: F.gm.Drawers || null }; F.bootL = F.bootR = null; F.layers = ['top', 'under']; F.skirt = null;
    let hide = 0; for (const r of ['CHEST', 'UPARM', 'WAIST_HI', 'WAIST', 'HIPS', 'HIPS_LO', 'SEAT', 'THIGH', 'FOREARM']) hide |= 1 << R[r];
    F.skinMat.userData.u.uHide.value = hide;
    if (F.spot) for (const k of SPOTS) F.mark(k, 0);
    return;
  }
  if (F.spec.outfit === 'none') {      // (Fenwick: nothing on, for looking at how he moves: figures.html)
    for (const k in F.gm) { const m = F.gm[k]; m.visible = false; if (m.userData.hull) m.userData.hull.visible = false; }
    F.clothes = { top: null, bottoms: null, under: null }; F.bootL = F.bootR = null; F.layers = []; F.skirt = null; F.skinMat.userData.u.uHide.value = 0;
    if (F.spot) for (const k of SPOTS) F.mark(k, 0);
    return;
  }
  const st = F.state, O = outfitOf(F.spec), longS = F.spec.outfit !== 'offduty' || O.sleeves === 'long', tops = longS ? ['Tunic', 'TunicUp'] : ['Shirt', 'ShirtUp'];
  const want = { top: tops[st.top === 'up' ? 1 : 0], bottoms: st.bottoms === 'down' ? 'TrousersDown' : 'Trousers', under: st.under === 'down' ? 'BriefsDown' : 'Briefs', boots: 'Boots' };
  const on = new Set(Object.values(want));
  for (const k of Object.values(want)) garmentGLB(F, k);
  for (const k in F.gm) { const m = F.gm[k], v = on.has(k); m.visible = v; if (m.userData.hull) m.userData.hull.visible = v; }
  F.clothes = { top: F.gm[want.top], bottoms: F.gm[want.bottoms], under: F.gm[want.under] }; F.bootL = F.bootR = F.gm.Boots; F.layers = ['top', 'bottoms', 'under']; F.skirt = null;
  // the skin under each garment hidden (so nothing pokes through as they move)
  let hide = 1 << R.FOOT; const H = r => { hide |= 1 << r; };
  H(R.CHEST); H(R.UPARM); H(R.WAIST_HI); if (longS) H(R.FOREARM); if (st.top !== 'up') H(R.WAIST);
  if (st.bottoms !== 'down') { H(R.HIPS); H(R.HIPS_LO); H(R.SEAT); H(R.THIGH); H(R.KNEE); H(R.SHIN); } else H(R.SHIN);
  if (st.under !== 'down') { H(R.SEAT); H(R.HIPS_LO); }
  F.skinMat.userData.u.uHide.value = hide;
  if (F.spot) for (const k of SPOTS) F.mark(k, 0);      // (the briefs' copy of the marks)
}

// ── Posing helpers ───────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
const _q = new THREE.Quaternion(), _m = new THREE.Matrix4();
function setWorldQuat(obj, qw) { obj.parent.getWorldQuaternion(_q).invert(); obj.quaternion.copy(_q.multiply(qw)); }
// Two-bone IK: rotate `a` (the upper bone) and bend `b` (the middle joint) so that `c` (the end bone's origin) reaches W, the joint bending toward `pole`.
// bendSign: −1 for an elbow (forearm forward on a negative turn), +1 for a knee.
function ik2(F, a, b, c, W, pole, bendSign) {
  F.root.updateMatrixWorld(true);
  const sc = F.root.getWorldScale(new V3()).x, L1 = b.position.length() * sc, L2 = c.position.length() * sc;
  const A = a.getWorldPosition(new V3()), v = W.clone().sub(A), d = clamp(v.length(), Math.abs(L1 - L2) + 0.01, L1 + L2 - 0.002), u = v.normalize();
  const cosA = clamp((L1 * L1 + d * d - L2 * L2) / (2 * L1 * d), -1, 1), sinA = Math.sqrt(1 - cosA * cosA);
  let pp = pole.clone().addScaledVector(u, -pole.dot(u)); if (pp.lengthSq() < 1e-8) pp = new V3(0, 0, 1).addScaledVector(u, -u.z); pp.normalize();
  const J = A.clone().addScaledVector(u, L1 * cosA).addScaledVector(pp, L1 * sinA), E2 = A.clone().addScaledVector(u, d);
  const u1 = J.clone().sub(A).normalize(), f = E2.clone().sub(J).normalize();
  // the upper bone: its -y along u1; its +z toward the bend for an elbow (−1), away for a knee (+1)
  let Z = f.clone().addScaledVector(u1, -f.dot(u1)); if (Z.lengthSq() < 1e-8) Z = pp.clone(); Z.normalize(); if (bendSign > 0) Z.negate();
  const Y = u1.clone().negate(), X = new V3().crossVectors(Y, Z);
  // (the upper bone's rest direction to its joint need not be straight down its -y: turned so that direction lies along u1; then the lower bone
  // turned the least that takes its own rest direction onto f)
  const q0 = new THREE.Quaternion().setFromUnitVectors(new V3(0, -1, 0), b.position.clone().normalize());
  setWorldQuat(a, new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(X, Y, Z)).multiply(q0.invert()));
  a.updateMatrixWorld(true);
  const fl = f.clone().applyQuaternion(a.getWorldQuaternion(new THREE.Quaternion()).invert());
  b.quaternion.setFromUnitVectors(c.position.clone().normalize(), fl.normalize());
  F.root.updateMatrixWorld(true);
}
// Turn a bone so its local axes point the given world ways: X and Y (Y made perpendicular to X).
function aim(obj, X, Y) {
  const x = X.clone().normalize(), z = new V3().crossVectors(x, Y).normalize(), y = new V3().crossVectors(z, x);
  setWorldQuat(obj, new THREE.Quaternion().setFromRotationMatrix(_m.makeBasis(x, y, z)));
}

// ── Presence: how a figure is there (the Proctor: docs/proctor.md) ──
// 'projected': an image in light, the bridge's blue: drawn in lines with gaps between them (the same lines for every surface, so nothing under
// its clothes ever shows through them), brighter toward its edges, flickering a little, casting no shadow, its outline the same light;
// 'hardlight': solid, in its own colours, with a faint blue light at its edges; 'solid': as anyone. Each of its materials is swapped for a
// copy of its own that adds this (sharing the original's uniforms, so marks, hiding and the rest still reach it); 'solid' puts them back.
const HOLO_LIT = `
{ float fres_ = 1.0 - abs(dot(normalize(normal), normalize(vViewPosition)));
  if (uHolo > 0.5) {
    if (mod(floor(gl_FragCoord.y * 0.5) + floor(uHoloT * 14.0), 3.0) < 1.0) discard;
    float lum_ = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11));
    gl_FragColor.rgb = (uHoloTint * (0.22 + 1.15 * lum_) + uHoloTint * pow(fres_, 2.0) * 1.3) * uHoloK;
  } else gl_FragColor.rgb += uHoloTint * pow(fres_, 5.0) * 0.16 * uHard; }`;
const HOLO_FLAT = `
{ if (uHolo > 0.5) { if (mod(floor(gl_FragCoord.y * 0.5) + floor(uHoloT * 14.0), 3.0) < 1.0) discard;
    float lum_ = dot(gl_FragColor.rgb, vec3(0.3, 0.59, 0.11)); gl_FragColor.rgb = uHoloTint * (0.2 + 1.2 * lum_) * uHoloK; } }`;
const HOLO_INK = `
{ if (uHolo > 0.5) { if (mod(floor(gl_FragCoord.y * 0.5) + floor(uHoloT * 14.0), 3.0) < 1.0) discard; gl_FragColor.rgb = uHoloTint * 1.4 * uHoloK; } }`;
function presence(F, mode) {
  const H = F.holo || (F.holo = { u: { uHolo: { value: 0 }, uHard: { value: 0 }, uHoloT: { value: 0 }, uHoloK: { value: 1 }, uHoloTint: { value: srgb('#5ad8e0') } }, made: new Map(), mode: 'solid' });
  const of = m => {
    if (H.made.has(m)) return H.made.get(m);
    const c = m.clone(), prev = m.onBeforeCompile, key0 = m.customProgramCacheKey, lit = !m.isMeshBasicMaterial, inked = m.isMeshBasicMaterial && m.side === THREE.BackSide;      // (its outline: the light itself)
    c.userData = m.userData;
    c.onBeforeCompile = (sh, r) => {
      if (prev) prev.call(m, sh, r); Object.assign(sh.uniforms, H.u);
      sh.fragmentShader = sh.fragmentShader.replace('void main() {', 'uniform float uHolo, uHard, uHoloT, uHoloK; uniform vec3 uHoloTint;\nvoid main() {')
        .replace('#include <dithering_fragment>', '#include <dithering_fragment>\n' + (lit ? HOLO_LIT : inked ? HOLO_INK : HOLO_FLAT));
    };
    c.customProgramCacheKey = () => 'holo' + (lit ? 1 : inked ? 2 : 0) + '|' + (key0 ? key0.call(m) : '');
    H.made.set(m, c); return c;
  };
  F.root.traverse(o => {
    if (!o.isMesh) return;
    if (!o.userData.mat0) { o.userData.mat0 = o.material; o.userData.cast0 = o.castShadow; }
    const m0 = o.userData.mat0;
    o.material = mode === 'solid' ? m0 : Array.isArray(m0) ? m0.map(of) : of(m0);
    o.castShadow = mode === 'projected' ? false : o.userData.cast0;
  });
  H.mode = mode; H.u.uHolo.value = mode === 'projected' ? 1 : 0; H.u.uHard.value = mode === 'hardlight' ? 1 : 0;
}
// (its light alive: the lines drifting up, now and then a stutter)
function tickPresence(F, dt) {
  const H = F.holo; if (!H || H.mode === 'solid') return;
  H.u.uHoloT.value += dt; H.t = (H.t || 0) - dt;
  if (H.t <= 0) { H.t = 1.5 + Math.random() * 5; H.glitch = 0.12 + Math.random() * 0.12; }
  H.glitch = Math.max(0, (H.glitch || 0) - dt);
  H.u.uHoloK.value = (H.glitch > 0 ? 0.55 + 0.45 * Math.random() : 1) * (0.94 + 0.06 * Math.sin(H.u.uHoloT.value * 9.0));
}

// The top of someone's hair, in the world: the highest point of the Blender-built style over the crown (or of the head itself), for a hand to
// rest on.
function hairTop(F) {
  const m = F.hairMesh || null, H = F.head; if (!H) return null;
  if (m && !m.geometry.boundingBox) m.geometry.computeBoundingBox();
  const b = m ? m.geometry.boundingBox : null, p = new V3(0, b ? b.max.y : 2.12, b ? (b.min.z + b.max.z) * 0.5 * 0.4 : 0);
  H.updateMatrixWorld(true); return H.localToWorld(p);
}
const api = { _bodySpheres: bodySpheres, _spheresIn: spheresIn, _CL: CL, presence, tickPresence, need, adoptHair, hairTop, braidTip, hairStyles: () => Object.keys(GLB.hair || {}), tmat, ink, dqs, grip, FINGERS, make, preload, adopt, models: () => Object.keys(GLB.sex), EXPRS, MOUTHS, HEAD_SCALE, OUTFITS, SPOTS, ik2, aim, setWorldQuat, mat, paint, srgb, shade, R };
root.Figure = api;
})(typeof window !== 'undefined' ? window : globalThis);
