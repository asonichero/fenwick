"""Fenwick Hall: builds the hair in Blender, fitted to the head js/figure.js builds in code (tools/export-head.js writes it to head.json).

  node tools/export-head.js                         (→ tools/blender/head.json: her head and his, in head units)
  python tools/blender/build_hair.py                (with Blender's bpy module; or: blender -b --python tools/blender/build_hair.py)
                                                    → models/fenwick_hair.glb

Each style is one mesh in head units (the head group's space: y up, z forward, about 6.3 cm a unit), made of:
  - a scalp shell: the head's own surface above the style's hairline, eased out and given thickness, so no skin shows between the locks;
  - locks: strands of hair as tapered ribbons of lens-shaped section, laid over the scalp (each following a path in direction space from its
    root, eased out from the head, and pushed clear of it and the ears) and, past the hairline, falling with gravity; some coiled into ringlets
    or a bun.
Each point carries a colour (COLOR_0): darker at the roots and in the shell, lighter toward the tips, a little different lock to lock; the game
multiplies it into the hair's own colour, so one mesh serves any colour.
Styles: curls (Goldie), swept (center part, back to the braid: Red, Rapunzel), sidepart (back to the braid: Snow White), chignon (Belle),
workbun (Eleanor), cropped (Gretel), tousled (Silas), and his beard.
"""
import bpy, json, math, os, sys
import numpy as np
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
OUT = os.environ.get('FENWICK_OUT') or os.path.join(REPO, 'models')
HEAD = json.load(open(os.path.join(HERE, 'head.json')))
RNG = np.random.default_rng(7)
def ss(a, b, x):
    t = np.clip((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t)
def nrm(v): v = np.asarray(v, float); return v / max(1e-9, np.linalg.norm(v))
def toB(p): return (p[0], -p[2], p[1])

# ── The head, as a surface to fit to ──
class Head:
    def __init__(self, sex):
        H = HEAD[sex]; self.parts = []
        for m in H['meshes']:
            V = np.array(m['pos']).reshape(-1, 3)
            if m['idx'] is None: continue
            T = np.array(m['idx']).reshape(-1, 3); self.parts.append((m['name'], V, T))
        V = np.concatenate([p[1] for p in self.parts if p[0] != 'part3']); off = 0; T = []
        for name, Vp, Tp in self.parts:
            if name == 'part3': continue
            T.append(Tp + off); off += len(Vp)
        self.V = V; self.T = np.concatenate(T)
        self.bvh = BVHTree.FromPolygons([Vector(v) for v in V], self.T.tolist())
        self.HV, self.HT = self.parts[0][1], self.parts[0][2]      # (the head's own surface, without the ears: for the scalp shell)
    def radius(self, d):
        """The outermost surface (the head, or an ear) along the direction d from the head's middle."""
        d = nrm(d); best = -9.0
        # (the head's surface has a pinhole at its crown's pole: a ray straight down it can miss the top and find the chin, so a couple more,
        # nudged, and the outermost taken)
        for j in ((0, 0, 0), (0.004, 0, 0.003), (-0.003, 0, -0.004)):
            dj = nrm(d + np.array(j)); hit = self.bvh.ray_cast(Vector(dj * 6.0), Vector(-dj))
            if hit[0] is not None: best = max(best, 6.0 - hit[3])
        return best if best > 0.5 else 1.6
    def on(self, d, off): d = nrm(d); return d * (self.radius(d) + off)
    def clear(self, p, off):
        """p pushed out from the head (along its direction from the middle) till it's at least `off` outside it."""
        r = np.linalg.norm(p); R = self.radius(p)
        return p * ((R + off) / r) if r < R + off else p

# ── Locks ──
def slerp_path(dirs, n):
    """A smooth path through control directions (a Catmull-Rom spline through them, normalised): n points."""
    D = [nrm(d) for d in dirs]
    if len(D) == 2: D = [D[0], nrm(D[0] + D[1]), D[1]]
    P = []
    for i in range(n):
        u = i / (n - 1) * (len(D) - 1); k = min(int(u), len(D) - 2); t = u - k
        p0, p1, p2, p3 = D[max(k - 1, 0)], D[k], D[k + 1], D[min(k + 2, len(D) - 1)]
        q = 0.5 * ((2 * p1) + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t ** 3)
        P.append(nrm(q))
    return np.array(P)

class Style:
    def __init__(self, name, head):
        self.name, self.h = name, head; self.V = []; self.F = []; self.C = []; self.n = 0
    def add_tube(self, P, W, Tk, Up, col, sides=8, cap_root=True):
        """A ribbon of lens-shaped section along P (n×3): half-width W, half-thickness Tk, its flat side facing Up (n×3); col: per point."""
        n = len(P); base = self.n
        T = np.gradient(P, axis=0); T = T / np.maximum(np.linalg.norm(T, axis=1, keepdims=True), 1e-9)
        U = Up - (Up * T).sum(1, keepdims=True) * T; U = U / np.maximum(np.linalg.norm(U, axis=1, keepdims=True), 1e-9); B = np.cross(T, U)
        a = np.linspace(0, 2 * np.pi, sides, endpoint=False)
        for i in range(n):
            for j in range(sides):
                c, s = math.cos(a[j]), math.sin(a[j])
                # (a lens, not an ellipse: thinner at its edges, so it lies flat and its silhouette reads as a lock)
                self.V.append(P[i] + B[i] * W[i] * c + U[i] * Tk[i] * s * (1 - 0.35 * c * c))
                self.C.append(col[i])
        for i in range(n - 1):
            for j in range(sides):
                a0 = base + i * sides + j; a1 = base + i * sides + (j + 1) % sides; b0 = a0 + sides; b1 = a1 + sides
                self.F.append((a0, a1, b1, b0))
        if cap_root: self.F.append(tuple(base + j for j in range(sides)[::-1]))
        self.n += n * sides
    def lock(self, P, w0=0.3, t0=0.07, taper=2.2, root_w=1.0, up=None, shade=None, tip_w=0.0):
        """A lock along P: full width from near its root, tapering to a point (or tip_w) at its end."""
        n = len(P); u = np.linspace(0, 1, n)
        W = w0 * (root_w + (1 - root_w) * ss(0.0, 0.12, u)) * (tip_w + (1 - tip_w) * (1 - u ** taper)); W = np.maximum(W, 0.004)
        Tk = t0 * (0.35 + 0.65 * (1 - u ** taper)); Tk = np.maximum(Tk, 0.003)
        Up = np.array([nrm(p) for p in P]) if up is None else up
        k = 0.94 + 0.12 * RNG.random()
        col = [np.array([1, 1, 1]) * (shade(x) if shade else (0.74 + 0.26 * ss(0.0, 0.65, x))) * k for x in u]
        self.add_tube(np.asarray(P), W, Tk, Up, col)
    def over(self, dirs, n, off0, off1, extra=None):
        """A path over the scalp through control directions, eased out from the head from off0 to off1."""
        D = slerp_path(dirs, n); u = np.linspace(0, 1, n)
        return np.array([self.h.on(d, off0 + (off1 - off0) * x + (extra(x) if extra else 0)) for d, x in zip(D, u)])
    def fall(self, P, length, n, out=0.05, curl=0.0, sway=None, off=0.06, step_dir=None):
        """A path continued from the end of P, falling: down (−y) with a little outward from the head, kept clear of it."""
        p = P[-1].copy(); v = nrm(P[-1] - P[-2]); pts = []; ds = length / n
        for i in range(n):
            g = nrm(np.array([0, -1.0, 0]) + out * nrm(p * np.array([1, 0, 1])) + (sway(i / n) if sway else 0))
            v = nrm(v * 0.55 + g * 0.45); p = self.h.clear(p + v * ds, off); pts.append(p.copy())
        return np.concatenate([P, np.array(pts)])
    def shell(self, scalp, off=0.07, thick=0.07, shade=0.7):
        """The scalp shell: the head's surface above the hairline, cut exactly along it, eased out and given thickness (inward), thinning to a
        soft edge at the hairline; the colour of the roots."""
        HV, HT = self.h.HV, self.h.HT
        V, T, Sv = clip(HV, HT, np.array([scalp(v) for v in HV]))
        solid_patch(self, V, T, Sv, off, thick, 0.14, shade)
        return
        keep = np.array([scalp(v) for v in HV])
        tris = [t for t in HT if keep[t].all()]
        used = sorted({i for t in tris for i in t}); ix = {v: k for k, v in enumerate(used)}
        out_v = np.array([nrm(HV[i]) * (np.linalg.norm(HV[i]) + off) for i in used]); in_v = np.array([nrm(HV[i]) * (np.linalg.norm(HV[i]) + off - thick) for i in used])
        base = self.n; m = len(used)
        for v in out_v: self.V.append(v); self.C.append(np.array([shade] * 3))
        for v in in_v: self.V.append(v); self.C.append(np.array([shade * 0.8] * 3))
        for t in tris:
            a, b, c = (ix[i] for i in t); self.F.append((base + a, base + c, base + b)); self.F.append((base + m + a, base + m + b, base + m + c))
        # (its rim: where a triangle's edge has no neighbour, a wall from the outer surface to the inner)
        from collections import Counter
        E = Counter()
        for t in tris:
            for e in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): E[tuple(sorted(e))] += 1
        for t in tris:
            for e in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
                if E[tuple(sorted(e))] == 1:
                    a, b = ix[e[0]], ix[e[1]]; self.F.append((base + a, base + b, base + m + b, base + m + a))
        self.n += 2 * m

def clip(V, T, S):
    """The part of a triangle mesh where the field S (one value per point) is ≥ 0, cut exactly along S = 0: triangles crossing it split there.
    Returns the points (old and new), the triangles, and S at each point (0 on the cut)."""
    V = list(map(np.asarray, V)); S = list(S); cache = {}; out = []
    def cut_pt(a, b):
        k = (min(a, b), max(a, b))
        if k not in cache:
            t = S[a] / (S[a] - S[b]); V.append(V[a] + (V[b] - V[a]) * t); S.append(0.0); cache[k] = len(V) - 1
        return cache[k]
    for t in T:
        a, b, c = int(t[0]), int(t[1]), int(t[2]); ins = [S[a] >= 0, S[b] >= 0, S[c] >= 0]; n = sum(ins)
        if n == 3: out.append((a, b, c)); continue
        if n == 0: continue
        # (rotate so the odd one out is first, keeping the winding)
        tri = [a, b, c]
        for _ in range(3):
            if (n == 1 and ins[0]) or (n == 2 and not ins[0]): break
            tri = tri[1:] + tri[:1]; ins = ins[1:] + ins[:1]
        p, q, r = tri
        if n == 1: out.append((p, cut_pt(p, q), cut_pt(p, r)))
        else: pq, pr = cut_pt(p, q), cut_pt(p, r); out.append((pq, q, r)); out.append((pq, r, pr))
    return np.array(V), out, np.array(S)

def solid_patch(S, V, T, Sv, off, thick, feather, shade, outer_k=1.0, bump=None):
    """A clipped patch of the head's surface made into a solid: eased out by `off` (and given thickness inward), both thinning to nothing over
    `feather` toward its edge, so the edge reads as a soft line. Its rim closed between the two surfaces."""
    from collections import Counter
    base = S.n; m = len(V)
    for v, sv in zip(V, Sv):
        f = float(ss(0.0, feather, sv)); r = np.linalg.norm(v); o = 0.01 + (off - 0.01) * f + (bump(v) * f if bump else 0)
        S.V.append(nrm(v) * (r + o)); S.C.append(np.array([shade * outer_k] * 3))
    for v, sv in zip(V, Sv):
        f = float(ss(0.0, feather, sv)); r = np.linalg.norm(v); o = 0.01 + (off - 0.01) * f - thick * f - 0.004
        S.V.append(nrm(v) * (r + o)); S.C.append(np.array([shade * 0.8] * 3))
    for a, b, c in T: S.F.append((base + a, base + c, base + b)); S.F.append((base + m + a, base + m + b, base + m + c))
    E = Counter()
    for t in T:
        for e in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])): E[tuple(sorted(e))] += 1
    for t in T:
        for e in ((t[0], t[1]), (t[1], t[2]), (t[2], t[0])):
            if E[tuple(sorted(e))] == 1: a, b = e; S.F.append((base + a, base + b, base + m + b, base + m + a))
    S.n += 2 * m

# ── Hairlines: where the scalp ends, by the angle round the head (0 the front, ±π the back) ──
def hairline(front=1.15, temple=0.62, sideburn=0.15, over_ear=0.52, behind=-0.35, nape=-0.85):
    """How far above the hairline a point of the head is (negative below it), by its angle round the head."""
    A = np.array([0.0, 0.42, 0.75, 1.18, 1.55, 1.95, 2.35, np.pi]); Y = np.array([front, front - 0.08 - 0.25 * (front - temple), temple, sideburn, over_ear, over_ear - 0.15, behind, nape])
    return lambda v: v[1] - float(np.interp(abs(math.atan2(v[0], v[2])), A, Y))

def build_style(name, sex):
    h = Head(sex); S = Style(name, h); R = RNG
    if name == 'swept' or name == 'sidepart':
        # back to the braid's root, high on the back of the head (js/figure.js: the braid's pivot at (0, 0.9, -2.0))
        B = np.array([0, 0.98, -1.85]); px = 0.0 if name == 'swept' else 0.5
        S.shell(hairline(front=1.12, temple=0.66, sideburn=0.3, over_ear=0.5, behind=-0.35, nape=-0.82), off=0.05, thick=0.06)
        for sx in (1, -1):
            # from the part, out over the temple and above the ear, back to the root
            for k in range(14):
                s = k / 13; root = np.array([px + sx * 0.06, 1.2 + 0.85 * s ** 0.8, 1.35 - 1.6 * s])
                side = np.array([sx * 1.5, 0.75 + 0.35 * s, 0.5 - 1.1 * s])
                P = S.over([root, side, B + np.array([sx * 0.25, -0.1, 0])], 26, 0.07 + 0.02 * R.random(), 0.11 + 0.04 * s)
                S.lock(P, w0=0.34 + 0.06 * R.random(), t0=0.06, taper=2.4, tip_w=0.06)
            # from the hairline round the face and over the ears, back
            for k in range(9):
                a = 0.2 + 1.35 * k / 8; root = h.on(np.array([sx * math.sin(a), 0.62 + 0.45 * math.cos(a * 1.1), math.cos(a)]), 0.04)
                mid = np.array([sx * 1.4, 0.45 + 0.25 * k / 8, -0.4 - 0.5 * k / 8])
                P = S.over([root, mid, B + np.array([sx * 0.3, -0.25, 0])], 24, 0.06, 0.1)
                S.lock(P, w0=0.3, t0=0.055, taper=2.4, tip_w=0.06)
            # up from the nape
            for k in range(6):
                a = 2.2 + 0.9 * k / 5; root = h.on(np.array([sx * math.sin(a), -0.75 + 0.15 * (5 - k) / 5, math.cos(a)]), 0.04)
                P = S.over([root, B + np.array([sx * 0.2, -0.3, 0.05])], 16, 0.06, 0.09)
                S.lock(P, w0=0.32, t0=0.055, taper=2.4, tip_w=0.06)
        if name == 'sidepart':
            # a fringe swept from the part across the forehead toward her other temple, above the brows
            for k in range(6):
                root = np.array([px - 0.1 * k, 1.55 - 0.05 * k, 1.05]); P = S.over([root, np.array([-0.6 - 0.1 * k, 1.05 - 0.04 * k, 1.5]), np.array([-1.35, 0.85, 0.9])], 22, 0.09, 0.07)
                S.lock(P, w0=0.3, t0=0.06, taper=2.0)
        else:
            # two loose strands at the temples, falling past the cheek
            for sx in (1, -1):
                P = S.over([np.array([sx * 1.05, 1.0, 1.1]), np.array([sx * 1.42, 0.6, 0.75])], 8, 0.08, 0.1)
                P = S.fall(P, 1.15, 18, out=0.35, sway=lambda t, sx=sx: np.array([sx * 0.22 * math.sin(t * 9), 0, -0.1 + 0.18 * math.cos(t * 9)]), off=0.12)
                S.lock(P, w0=0.075, t0=0.04, taper=1.3)
    elif name == 'chignon':
        # a side part, swept back over the tops of the ears to a low bun at the nape, coiled; a tendril by each ear
        Bc = np.array([0, -0.45, -1.95]); px = -0.42
        S.shell(hairline(front=1.12, temple=0.62, sideburn=0.3, over_ear=0.45, behind=-0.45, nape=-0.85), off=0.05, thick=0.06)
        for sx in (1, -1):
            for k in range(15):
                s = k / 14; root = np.array([px + sx * 0.06, 1.2 + 0.85 * s ** 0.8, 1.35 - 1.6 * s])
                side = np.array([sx * 1.55, 0.35 - 0.15 * s, 0.35 - 1.2 * s])
                P = S.over([root, side, Bc + np.array([sx * 0.28, 0.08, 0.05])], 28, 0.07 + 0.02 * R.random(), 0.12)      # (into the bun's side, under it)
                S.lock(P, w0=0.36, t0=0.065, taper=2.4, tip_w=0.06)
            for k in range(7):
                a = 2.0 + 1.1 * k / 6; root = h.on(np.array([sx * math.sin(a), -0.7, math.cos(a)]), 0.04)
                P = S.over([root, Bc + np.array([sx * 0.12, 0.08, 0.0])], 12, 0.06, 0.1)      # (up from the nape to under the bun, out of sight beneath it)
                S.lock(P, w0=0.32, t0=0.05, taper=2.4, tip_w=0.06)
            # (a tendril in front of each ear, curling)
            root = h.on(np.array([sx * 1.3, 0.62, 0.85]), 0.08); n = 34; P = []
            for i in range(n):
                u = i / (n - 1); a = u * 3.2 * 2 * np.pi
                P.append(h.clear(root + np.array([sx * (0.12 + 0.1 * math.cos(a)), -1.3 * u, -0.05 + 0.1 * math.sin(a)]), 0.1))
            S.lock(np.array(P), w0=0.07, t0=0.055, taper=1.6)
        # (set against the back of the head, low, its outer turn bedded in the locks that lead into it: on the head, not standing off it)
        coil(S, h.on(nrm(Bc + np.array([0, 0.03, 0])), 0.25), nrm([0, -0.25, -1]), r0=0.6, r1=0.12, turns=2.3, tube=0.26, n=120, hug=0.2)
    elif name == 'workbun':
        # pulled up from all round to a bun high on the back of the head, not neatly: wisps loose at the nape and the temples
        Bw = np.array([0, 1.15, -1.75])
        S.shell(hairline(front=1.12, temple=0.66, sideburn=0.32, over_ear=0.5, behind=-0.4, nape=-0.85), off=0.05, thick=0.06)
        for sx in (1, -1):
            for k in range(20):
                s = k / 19; root = np.array([sx * 0.06, 1.2 + 0.85 * s ** 0.8, 1.35 - 1.5 * s])
                P = S.over([root, np.array([sx * 1.35, 1.1 + 0.25 * s, 0.25 - 1.0 * s]), Bw + np.array([sx * 0.3, -0.05, 0.15])], 26, 0.065, 0.085 + 0.02 * R.random())
                S.lock(P, w0=0.24 + 0.04 * R.random(), t0=0.05, taper=2.4, tip_w=0.06)
            for k in range(10):
                a = 0.5 + 2.5 * k / 9; y0 = float(np.interp(a, [0.5, 1.2, 1.6, 2.3, 3.0], [0.75, 0.35, 0.5, -0.35, -0.8]))
                root = h.on(np.array([sx * math.sin(a), y0, math.cos(a)]), 0.04)
                P = S.over([root, Bw + np.array([sx * 0.35, -0.2, 0.1])], 22, 0.055, 0.08)
                S.lock(P, w0=0.21 + 0.04 * R.random(), t0=0.045, taper=2.4, tip_w=0.06)
            for k in range(3):      # (wisps)
                a = [0.95, 2.6, 2.95][k]; y0 = [0.55, -0.45, -0.7][k]
                P = S.over([np.array([sx * math.sin(a), y0 + 0.15, math.cos(a)]), np.array([sx * math.sin(a), y0, math.cos(a)])], 6, 0.07, 0.09)
                P = S.fall(P, [1.0, 0.7, 0.8][k], 12, out=0.3, sway=lambda t, sx=sx: np.array([sx * 0.15 * math.sin(t * 9), 0, 0.1]), off=0.08)
                S.lock(P, w0=0.09, t0=0.045, taper=1.5)
        coil(S, Bw + np.array([0, 0.05, -0.2]), nrm([0, 0.35, -1]), r0=0.55, r1=0.1, turns=2.0, tube=0.24, n=100, mess=0.022)
        for k in range(3):      # (ends escaping the bun)
            a = 2 * math.pi * k / 3 + 0.4; base = Bw + np.array([0.45 * math.cos(a), 0.05 + 0.45 * math.sin(a), -0.45])
            P = np.array([base + np.array([0.25 * math.cos(a) * t, 0.25 * math.sin(a) * t - 0.1 * t * t, -0.1 * t]) for t in np.linspace(0, 1, 8)])
            S.lock(P, w0=0.09, t0=0.04, taper=1.5)
    elif name == 'cropped':
        # cut short with a knife: no part; locks from a whorl at the crown, out and down over the head, ends uneven: a fringe above the brows,
        # the sides to the middle of the ear and the jaw, the back to the nape
        Wh = np.array([0.1, 2.0, -0.55])
        S.shell(hairline(front=1.12, temple=0.66, sideburn=0.25, over_ear=0.4, behind=-0.5, nape=-0.9), off=0.06, thick=0.07)
        for k in range(70):
            a = (k * 2.39996) % (2 * math.pi); f = math.sqrt((k + 0.5) / 70)
            root = h.on(nrm(nrm(Wh) + np.array([math.sin(a), 0, math.cos(a)]) * 0.55 * f), 0.05)
            az = math.atan2(math.sin(a), math.cos(a)); front = math.cos(az)
            tip_y = float(np.interp(abs(az), [0, 0.42, 0.8, 1.3, 1.9, 2.6, np.pi], [0.8, 0.75, 0.3, -0.4, -0.75, -0.95, -1.05])) + 0.16 * (R.random() - 0.5)
            edge = np.array([1.55 * math.sin(az), max(tip_y + 0.6, 0.6), 1.55 * math.cos(az)])
            P = S.over([root, edge], 14, 0.07 + 0.05 * f, 0.13)
            if P[-1][1] > tip_y + 0.05:
                side = 0.42 < abs(az) < 1.5      # (at the sides, back off the face)
                P = S.fall(P, max(0.2, P[-1][1] - tip_y), 10, out=0.18 + 0.2 * max(front, 0), off=0.12,
                           sway=(lambda t: np.array([0, 0, -0.35])) if side else None)
            S.lock(P, w0=0.34 + 0.08 * R.random(), t0=0.08, taper=1.3)
    elif name == 'curls':
        # golden curls over the whole head: a mass of them from the crown down the back of the head to the nape, small ones along the
        # hairline over the forehead, and ringlets in rows, falling round the sides and down the back from high on the head to below the jaw
        hl = hairline(front=1.15, temple=0.66, sideburn=0.32, over_ear=0.45, behind=-0.45, nape=-0.85)
        S.shell(hl, off=0.08, thick=0.08, shade=0.6)
        n = 230
        for k in range(n):
            yv = 1 - 2 * (k + 0.5) / n; rr = math.sqrt(max(0.0, 1 - yv * yv)); a = k * 2.39996
            d = np.array([rr * math.sin(a), yv, rr * math.cos(a)])
            if d[2] > 0.55 and d[1] < 0.55: continue                          # (not over the face)
            if hl(h.on(d, 0.0)) < 0.14: continue                               # (inside the hairline)
            back = ss(0.2, -0.6, d[2])
            curl_lock(S, h.on(d, 0.12 + 0.1 * R.random()), d, r=0.19 + 0.06 * R.random(), turns=1.2, length=0.62, tube=0.17,
                      down=0.35 * back, spin=R.uniform(-0.9, 0.9))
        for k in range(26):
            a = -2.6 + 5.2 * k / 25
            if abs(a) < 0.75: continue
            y0 = float(np.interp(abs(a), [0.75, 1.2, 1.6, 2.2, 2.6], [0.75, 0.55, 0.5, 0.1, -0.3]))
            root = h.on(np.array([math.sin(a), y0, math.cos(a)]), 0.16)
            ringlet(S, root, length=1.6 + 0.9 * ss(0.8, 2.4, abs(a)) + 0.3 * R.random(), r=0.17, tube=0.15, turns=3.2 + R.random(), out=0.18)
        # (further rows behind the ears and down the back, rooted higher on the head, so the back of it is ringlets all the way up)
        for row, (lift, a_lo, cnt) in enumerate([(0.42, 1.45, 16), (0.84, 1.9, 11)]):
            for k in range(cnt):
                sd = 1 if k % 2 == 0 else -1; a = sd * (a_lo + (np.pi - a_lo) * (k // 2) / max(1, (cnt - 1) // 2)) + R.uniform(-0.06, 0.06)
                yb = float(np.interp(abs(a), [0.75, 1.2, 1.6, 2.2, 2.6, np.pi], [0.75, 0.55, 0.5, 0.1, -0.3, -0.3]))
                tip = h.on(np.array([math.sin(a), yb, math.cos(a)]), 0.16)[1] - 1.6 - 0.9 * ss(0.8, 2.4, abs(a))      # (ending where the row below does)
                root = h.on(np.array([math.sin(a), yb + lift, math.cos(a)]), 0.2)
                ringlet(S, root, length=root[1] - tip + 0.25 * R.random(), r=0.18, tube=0.15, turns=3.4 + R.random(), out=0.22)
        for k in range(7):      # (small curls at the hairline, over the forehead)
            x = -0.85 + 1.7 * k / 6; d = nrm(np.array([x, 1.2 - 0.25 * abs(x), 1.2]))
            curl_lock(S, h.on(d, 0.1), d, r=0.16, turns=1.1, length=0.45, tube=0.13, down=0.6)
    elif name == 'tousled':
        # his: short, worked back and a little to his right from a lifted front, the ends turning every way; sideburns down to the beard
        S.shell(hairline(front=1.25, temple=0.8, sideburn=-0.2, over_ear=0.4, behind=-0.4, nape=-0.9), off=0.05, thick=0.06)
        for k in range(150):
            a = (k * 2.39996) % (2 * math.pi); f = math.sqrt((k + 0.5) / 150)
            d0 = nrm(np.array([0, 1, 0.15]) + np.array([math.sin(a), 0, math.cos(a)]) * 1.35 * f)
            if d0[1] < 0.15 and d0[2] > 0.3: continue
            flow = nrm(np.array([-0.35, -0.25, -1.0]) + 0.4 * np.array([math.sin(a), 0, 0]))
            lift = 0.12 * ss(0.3, 0.9, d0[2])
            P = S.over([d0, nrm(d0 + flow * (0.3 + 0.2 * R.random())), nrm(d0 + flow * (0.55 + 0.25 * R.random()) + np.array([0, -0.12, 0]))], 12, 0.08 + lift, 0.09 + 0.04 * R.random())
            P[-4:] += nrm(P[-1]) * np.array([[0.01], [0.03], [0.06], [0.1]]) * (0.5 + R.random())
            S.lock(P, w0=0.17 + 0.06 * R.random(), t0=0.075, taper=1.3)
        for sx in (1, -1):
            for k in range(3):
                P = S.over([np.array([sx * 1.45, 0.55 - 0.05 * k, 0.55 + 0.12 * k]), np.array([sx * 1.55, -0.25, 0.5 + 0.12 * k])], 8, 0.04, 0.05)
                S.lock(P, w0=0.12, t0=0.035, taper=2.0)
    elif name == 'beard':
        beard(S, h)
    return S

def coil(S, C, axis, r0, r1, turns, tube, n, mess=0.0, hug=None):
    """A bun: a thick lock coiled round an axis, from the outside in, its turns climbing over each other. (hug: each turn kept just that far
    out from the head and no further in, so a bun set against the head's curve sits on the hair round it all the way round rather than
    touching it at one point and standing off it elsewhere)"""
    axis = nrm(axis); e1 = nrm(np.cross(axis, [0, 1, 0.01])); e2 = np.cross(axis, e1)
    t = np.linspace(0, 1, n); a = t * turns * 2 * np.pi; r = r0 + (r1 - r0) * t
    P = np.array([C + (e1 * math.cos(ai) + e2 * math.sin(ai)) * ri + axis * (0.22 * ti) + RNG.normal(0, mess, 3) for ai, ri, ti in zip(a, r, t)])
    if hug is not None: P = np.array([S.h.clear(p, hug) for p in P])
    Up = np.array([nrm(p - C + axis * 0.4) for p in P])
    S.lock(P, w0=tube * 1.2, t0=tube * 0.8, taper=6.0, root_w=0.5, up=Up, shade=lambda x: 0.8 + 0.2 * ss(0.1, 0.9, x))
def curl_lock(S, root, d, r, turns, length, tube, down=0.0, spin=0.0):
    """A short curl over the crown: a lock that leaves the head and turns over on itself (its way turned round d by spin)."""
    t_ = nrm(np.cross(d, [0.3, 0.1, 1.0])); n = 18
    if spin: t_ = nrm(t_ * math.cos(spin) + np.cross(nrm(d), t_) * math.sin(spin))
    P = []
    for i in range(n):
        u = i / (n - 1); a = u * turns * 2 * np.pi
        P.append(root + t_ * length * u + (d * math.sin(a) + t_ * (1 - math.cos(a)) * 0.3) * r + np.array([0, -down * length * u * u, 0]))
    P = np.array([S.h.clear(p, 0.08) for p in P])
    S.lock(P, w0=tube, t0=tube * 0.75, taper=2.0, root_w=0.6, shade=lambda x: 0.82 + 0.18 * x)
def ringlet(S, root, length, r, tube, turns, out):
    """A ringlet: a helix falling from its root, its coil tightening a little toward the end."""
    n = int(28 * turns); horiz = nrm(root * np.array([1, 0, 1])); P = []
    e1 = horiz; e2 = nrm(np.cross([0, 1, 0], e1))
    for i in range(n):
        u = i / (n - 1); a = u * turns * 2 * np.pi; rr = r * (1 - 0.3 * u)
        c = root + horiz * out * math.sin(min(u * 3, 1) * np.pi / 2) + np.array([0, -length * u, 0])
        P.append(S.h.clear(c + (e1 * math.cos(a) + e2 * math.sin(a)) * rr, 0.1))
    S.lock(np.array(P), w0=tube, t0=tube * 0.85, taper=3.0, root_w=0.7, shade=lambda x: 0.8 + 0.2 * ss(0.0, 0.5, x))

def beard(S, h):
    """His beard: a short full beard and moustache over the jaw, chin and upper lip; its edges cut clean along their lines (down from the
    sideburns in front of the ears, along the cheek, round the mouth) and feathered, its surface clumped."""
    HV, HT = h.HV, h.HT
    def field(v):
        x, y, z = v; ax = abs(x)
        top = float(np.interp(ax, [0, 0.55, 1.0, 1.3, 1.5], [-0.68, -0.66, -0.6, -0.3, 0.05]))      # (the cheek line, rising to the sideburn)
        f = top - y
        f = min(f, (z - 0.05) * 1.2 + 0.25 * ss(1.25, 1.0, ax))                                       # (in front of the ears)
        mouth = ((x / 0.5) ** 2 + ((y + 1.19) / 0.19) ** 2) - 1.0
        if z > 0.4: f = min(f, mouth * 0.18)
        return min(f, y + 2.2)
    V, T, Sv = clip(HV, HT, np.array([field(v) for v in HV]))
    def bump(v):
        x, y, z = v
        lip = ss(-0.98, -0.9, -y) * ss(-1.02, -0.9, y) * ss(0.6, 0.3, abs(x))
        return 0.05 - 0.035 * lip + 0.05 * ss(-1.6, -2.0, y) + 0.018 * math.sin(x * 11 + y * 3) * math.cos(y * 9 - x * 2)
    solid_patch(S, V, T, Sv, 0.06, 0.07, 0.1, 0.82, bump=bump)

STYLES = [('curls', 'f'), ('swept', 'f'), ('sidepart', 'f'), ('chignon', 'f'), ('workbun', 'f'), ('cropped', 'f'), ('tousled', 'm'), ('beard', 'm')]

def to_object(S):
    name = ('Beard_' if S.name == 'beard' else 'Hair_') + S.name
    me = bpy.data.meshes.new(name); ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    me.from_pydata([toB(v) for v in S.V], [], [tuple(f) for f in S.F]); me.update()
    ca = me.color_attributes.new('Color', 'FLOAT_COLOR', 'POINT'); cols = np.array([[c[0], c[1], c[2], 1.0] for c in S.C], np.float32)
    ca.data.foreach_set('color', cols.ravel()); me.color_attributes.active_color = ca
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.mode_set(mode='EDIT'); bpy.ops.mesh.select_all(action='SELECT'); bpy.ops.mesh.normals_make_consistent(inside=False); bpy.ops.object.mode_set(mode='OBJECT')
    for p in me.polygons: p.use_smooth = True
    ob.select_set(False)
    print(name, len(me.vertices), 'verts', len(me.polygons), 'faces')
    return ob

if __name__ == '__main__':
    bpy.ops.wm.read_factory_settings(use_empty=True)
    objs = [to_object(build_style(n, sx)) for n, sx in STYLES]
    for o in objs: o.select_set(True)
    path = os.path.join(OUT, 'fenwick_hair.glb')
    bpy.ops.export_scene.gltf(filepath=path, export_format='GLB', use_selection=True, export_yup=True, export_apply=True, export_materials='NONE',
                              export_vertex_color='ACTIVE', export_all_vertex_colors=False, export_animations=False)
    print('exported', path, round(os.path.getsize(path) / 1e6, 2), 'MB')
