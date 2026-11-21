"""Fenwick Hall — each heroine's skirt draped in Blender, once for each pose she's put in (tools/export-poses.js wrote them, from the game:
tools/blender/poses.json).

For each heroine, each garment with a skirt she wears (a dress or the kirtle), and each pose, down and (in a correction) raised:
  · her body, in her build (the shape keys' amounts) and posed by the game's own skinning (the bones' matrices from the game, blended as
    dual quaternions, as js/figure.js does on the GPU), and what she wears under the skirt (drawers, or leggings) are colliders; so are
    Silas, his body and what he's wearing, posed the same way; the furniture; and the floor.
  · the garment is posed the same way; what's below its waistband is first put outside everything it starts inside (her legs, his, the
    table's edge), then Blender's cloth lets it fall: soft, so it folds rather than holding its shape, and long enough to settle. The bodice
    and sleeves are pinned. Raised, the back of the hem is lifted, out over her and up to her waist, and held there; the cloth between
    gathers (it collides with itself), the sides falling from it to the front, which still hangs.
  · where each point settles is turned back into the garment as built: each point is given to the part of her it lies on (the bones of the
    nearest point of her body, fading to her hips where it hangs clear of her), so it moves with what it rests on as she wriggles, and its
    offset is that skinning undone.
Written to models/drapes/<heroine>.json (the index) and .bin (the points that move; their offsets, int16; their two bones and weight).

    .blender/bin/python tools/blender/bake_drapes.py [-- HEROINE,HEROINE [GARMENT,GARMENT [POSE,POSE]]]      (POSE: otk, or otk:up)
"""
import sys, os, json, struct, math, time, re
import numpy as np
import bpy
from mathutils import Vector
from mathutils.bvhtree import BVHTree

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
MODELS = os.environ.get('FENWICK_MODELS') or os.path.join(REPO, 'models'); OUT = os.environ.get('FENWICK_OUT') or os.path.join(MODELS, 'drapes')
POSES_DOWN = ['otk', 'bed', 'edge', 'table', 'after']; POSES_UP = ['otk', 'bed', 'edge', 'table']      # (raised only in a correction)
FRAMES = int(os.environ.get('FENWICK_FRAMES') or 100); QUALITY = [5, 3, 0]      # (steps, collision steps, her drawers left out)
LIFT = (6, 22, 40)      # (raised: out over her by the second frame of these, at her waist by the third)
ARM = ('clav', 'upperArm', 'foreArm', 'hand', 'index', 'middle', 'ring', 'pinky', 'thumb')

# ── the models, read straight from the GLBs: points, skinning, triangles and shape keys ──
def read_glb(path):
    b = open(path, 'rb').read(); assert b[:4] == b'glTF'
    jl = struct.unpack_from('<I', b, 12)[0]; J = json.loads(b[20:20 + jl]); bl = struct.unpack_from('<I', b, 20 + jl)[0]; BIN = b[28 + jl:28 + jl + bl]
    CT = {5126: ('<f4', 4), 5123: ('<u2', 2), 5121: ('u1', 1), 5125: ('<u4', 4)}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
    def acc(i):
        a = J['accessors'][i]; dt, sz = CT[a['componentType']]; nc = NC[a['type']]; n = a['count']
        if 'bufferView' in a:
            bv = J['bufferViews'][a['bufferView']]; off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', sz * nc)
            if stride == sz * nc: out = np.frombuffer(BIN, dtype=dt, count=n * nc, offset=off).reshape(n, nc)
            else: out = np.stack([np.frombuffer(BIN, dtype=dt, count=nc, offset=off + k * stride) for k in range(n)])
            out = out.astype(np.float64)
        else: out = np.zeros((n, nc))
        if 'sparse' in a:      # (only the points that differ, a shape key's moved points: indices and their values)
            sp = a['sparse']; m = sp['count']; iv = J['bufferViews'][sp['indices']['bufferView']]; vv = J['bufferViews'][sp['values']['bufferView']]
            idt = CT[sp['indices']['componentType']][0]
            ids = np.frombuffer(BIN, dtype=idt, count=m, offset=iv.get('byteOffset', 0) + sp['indices'].get('byteOffset', 0)).astype(int)
            out[ids] = np.frombuffer(BIN, dtype=dt, count=m * nc, offset=vv.get('byteOffset', 0) + sp['values'].get('byteOffset', 0)).reshape(m, nc)
        if a.get('normalized'): out = out / (255.0 if sz == 1 else 65535.0)
        return out
    meshes = {}
    for nd in J['nodes']:
        if 'mesh' not in nd or 'skin' not in nd: continue
        name = re.sub(r'_\d+$', '', nd.get('name', '')); M = J['meshes'][nd['mesh']]; pr = M['primitives'][0]; at = pr['attributes']
        names = M.get('extras', {}).get('targetNames', [])
        T = {n: acc(t['POSITION']) for n, t in zip(names, pr.get('targets', []))}
        meshes[name] = dict(P=acc(at['POSITION']), J=acc(at['JOINTS_0']).astype(int), W=acc(at['WEIGHTS_0']), I=acc(pr['indices']).astype(int).reshape(-1, 3),
                            joints=[J['nodes'][j]['name'] for j in J['skins'][nd['skin']]['joints']], T=T)
    return meshes
def shaped(mesh, keys):
    """The mesh's points in a build: its shape keys at their amounts (the game's morph targets)."""
    P = mesh['P'].copy()
    for k, v in (keys or {}).items():
        if v and k in mesh['T']: P += v * mesh['T'][k]
    return P

# ── the game's skinning (js/figure.js: DQS_*), and its inverse ──
def mat_quat(m):
    r = m[:3, :3] / np.linalg.norm(m[:3, :3], axis=0); R = lambda i, j: r[j, i]      # (columns normalized, as the shader does; GLSL r[i][j]: column i, row j)
    tr = R(0, 0) + R(1, 1) + R(2, 2)
    if tr > 0: s = math.sqrt(tr + 1) * 2; q = np.array([(R(1, 2) - R(2, 1)) / s, (R(2, 0) - R(0, 2)) / s, (R(0, 1) - R(1, 0)) / s, 0.25 * s])
    elif R(0, 0) > R(1, 1) and R(0, 0) > R(2, 2): s = math.sqrt(1 + R(0, 0) - R(1, 1) - R(2, 2)) * 2; q = np.array([0.25 * s, (R(1, 0) + R(0, 1)) / s, (R(2, 0) + R(0, 2)) / s, (R(1, 2) - R(2, 1)) / s])
    elif R(1, 1) > R(2, 2): s = math.sqrt(1 + R(1, 1) - R(0, 0) - R(2, 2)) * 2; q = np.array([(R(1, 0) + R(0, 1)) / s, 0.25 * s, (R(2, 1) + R(1, 2)) / s, (R(2, 0) - R(0, 2)) / s])
    else: s = math.sqrt(1 + R(2, 2) - R(0, 0) - R(1, 1)) * 2; q = np.array([(R(2, 0) + R(0, 2)) / s, (R(2, 1) + R(1, 2)) / s, 0.25 * s, (R(0, 1) - R(1, 0)) / s])
    return q / np.linalg.norm(q)
def dq_dual(q, t): return 0.5 * np.concatenate([q[3] * t + np.cross(t, q[:3]), [-np.dot(t, q[:3])]])
def rot(q, v): return v + 2.0 * np.cross(q[..., :3], np.cross(q[..., :3], v) + q[..., 3:4] * v)
def blend(names, J, W, mats):
    """Each point's blended rotation and translation, as the shader blends them (names: the bones J indexes)."""
    Q = np.array([mat_quat(mats[n]) for n in names]); D = np.array([dq_dual(Q[i], mats[n][:3, 3]) for i, n in enumerate(names)])
    W = W / np.maximum(W.sum(1, keepdims=True), 1e-9); qa = Q[J[:, 0]]; r = np.zeros((len(J), 4)); d = np.zeros((len(J), 4))
    for k in range(J.shape[1]):
        qk = Q[J[:, k]]; w = W[:, k] * np.where((k > 0) & (np.sum(qa * qk, 1) < 0), -1.0, 1.0)
        r += w[:, None] * qk; d += w[:, None] * D[J[:, k]]
    L = np.linalg.norm(r, axis=1, keepdims=True); r /= L; d /= L
    return r, 2.0 * (r[:, 3:4] * d[:, :3] - d[:, 3:4] * r[:, :3] + np.cross(r[:, :3], d[:, :3]))
def skin(names, J, W, mats, S, P): r, t = blend(names, J, W, mats); return rot(r, S * P) + t
def unskin(names, J, W, mats, S, X): r, t = blend(names, J, W, mats); return rot(r * np.array([-1, -1, -1, 1.0]), X - t) / S
def skin_mesh(m, mats, S, keys): return skin(m['joints'], m['J'], m['W'], mats, S, shaped(m, keys))

# ── Blender: ours (y up) and Blender's (z up) ──
toB = lambda P: np.stack([P[:, 0], -P[:, 2], P[:, 1]], 1)
fromB = lambda P: np.stack([P[:, 0], P[:, 2], -P[:, 1]], 1)
def mesh_obj(name, V, F, collide=False, friction=1.5):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in V], [], [tuple(int(i) for i in f) for f in F]); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if collide:
        ob.modifiers.new('Collision', 'COLLISION'); ob.collision.thickness_outer = 0.004; ob.collision.cloth_friction = friction; ob.collision.damping = 0.5
    return ob
def box_pts(Mw, w, h, d):
    C = np.array([[x, y, z] for x in (-w / 2, w / 2) for y in (-h / 2, h / 2) for z in (-d / 2, d / 2)])
    return (np.c_[C, np.ones(8)] @ Mw.T)[:, :3]
BOX_F = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]

def push_out(X, which, solids, boxes):
    """Points (ours, world) put outside each solid (a BVH of a closed mesh, ours) and box they start inside: to its nearest surface."""
    for _ in range(2):
        for i in which:
            p = Vector(X[i])
            for bvh, thick in solids:
                loc, n, _, dist = bvh.find_nearest(p, 0.25)
                if loc is not None and ((p - loc).dot(n) < 0 or dist < thick): p = loc + n * (thick + 0.006)
            for Mw, Mi, half in boxes:
                q = Mi @ np.array([p.x, p.y, p.z, 1.0]); pen = half - np.abs(q[:3])
                if (pen > 0).all():
                    a = int(np.argmin(pen)); q[a] = math.copysign(half[a] + 0.007, q[a]); p = Vector((Mw @ q)[:3])
            if p.y < 0.005: p.y = 0.005
            X[i] = np.array(p)
    return X

def bake(F_, M_, G, rec, gname, up, legs):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.frame_start, sc.frame_end = 1, FRAMES
    L = F_['meta']['landmarks']; mats = {n: np.array(m).reshape(4, 4).T for n, m in rec['bones'].items()}; S = rec['scale']; keys = rec['keys']
    solids = []
    def no_arms(m, I):      # (the faces of a body that go with neither arm: arms and hands move as they will, through a skirt's drape)
        dom = np.array([m['joints'][m['J'][v][int(np.argmax(m['W'][v]))]].startswith(ARM) for v in range(len(m['P']))])
        return I[~dom[I].any(1)]
    def solid(name, X, I, friction=1.5, thick=0.004):
        ob = mesh_obj(name, toB(X), I, True, friction); ob.collision.thickness_outer = thick
        solids.append((BVHTree.FromPolygons([tuple(v) for v in X], [tuple(int(i) for i in f) for f in I]), thick))
    # her body, and what's under the skirt
    body = F_['meshes']['Body']; Xb = skin_mesh(body, mats, S, keys); solid('Body', Xb, no_arms(body, body['I']), 1.5, 0.011 if legs else 0.014 if QUALITY[2] else 0.004)      # (over leggings, their thickness too; or her drawers', in their place)
    # (what's under the skirt only where it stands well off her: drawers, not leggings, which lie too close to her for two colliders to
    # agree on which way to push the cloth between them)
    under = None if legs or QUALITY[2] or os.environ.get('FENWICK_NOUNDER') else 'Drawers'
    if under and under in F_['meshes']: solid(under, skin_mesh(F_['meshes'][under], mats, S, keys), F_['meshes'][under]['I'])
    # Silas, as he is: his body, with room for what he's wearing over it (his clothes are open at their edges, so not solids themselves)
    sr = rec['silas']; smats = {n: np.array(m).reshape(4, 4).T for n, m in sr['bones'].items()}; m = M_['Body']
    solid('Silas', skin_mesh(m, smats, sr['scale'], sr['keys']), no_arms(m, m['I']), 1.0, 0.016 if sr['wears'] else 0.004)
    # the furniture, and the floor
    boxes = []
    for i, bx in enumerate(rec['boxes']):
        Mw = np.array(bx[:16]).reshape(4, 4).T; mesh_obj('Box%d' % i, toB(box_pts(Mw, *bx[16:])), BOX_F, True, 1.0); boxes.append((Mw, np.linalg.inv(Mw), np.array(bx[16:]) / 2))
    mesh_obj('Floor', np.array([[-6, -6, 0], [6, -6, 0], [6, 6, 0], [-6, 6, 0.0]]), [(0, 1, 2, 3)], True, 2.0)
    # the garment, its points welded where the export split them
    g = F_['meshes'][gname]; Pg = shaped(g, keys)
    # (where it starts: as the game skins it, except below the waist, where the skirt goes with her hips and with both legs alike rather
    # than its left half with her left leg and its right with her right, which would start it stretched across between them, through one)
    y = g['P'][:, 1]; h = np.clip((L['skirtC'][2] + 0.02 - y) / (L['skirtC'][2] + 0.02 - (L['crotch'] - 0.11)), 0, 1); h = h * h * (3 - 2 * h)
    kb = 0.6 * np.clip((L['knee'] + 0.14 - y) / 0.26, 0, 1); armv = np.array([sum(w for j, w in zip(g['J'][i], g['W'][i]) if g['joints'][j].startswith(ARM)) for i in range(len(y))])
    names0 = ['hips', 'thighL', 'thighR', 'shinL', 'shinR']; J0 = np.tile(np.arange(5), (len(y), 1))
    W0 = np.stack([1 - h, h * (1 - kb) / 2, h * (1 - kb) / 2, h * kb / 2, h * kb / 2], 1)
    X0 = skin(g['joints'], g['J'], g['W'], mats, S, Pg); below = (y < L['waist'] - 0.04) & (armv < 0.3)
    X0[below] = skin(names0, J0[below], W0[below], mats, S, Pg[below])
    uid = {}; U = []
    for i, p in enumerate(g['P']):
        k = tuple(np.round(p, 6))
        if k not in uid: uid[k] = len(U); U.append(i)
    ix = np.array([uid[tuple(np.round(p, 6))] for p in g['P']]); U = np.array(U)
    tris = ix[g['I']]; tris = tris[(tris[:, 0] != tris[:, 1]) & (tris[:, 1] != tris[:, 2]) & (tris[:, 0] != tris[:, 2])]
    yb = g['P'][U, 1]; armw = np.array([sum(w for j, w in zip(g['J'][i], g['W'][i]) if g['joints'][j].startswith(ARM)) for i in U])
    pin = (yb > L['waist'] - 0.02) | (armw > 0.3)
    Xs0 = X0[U].copy(); push_out(Xs0, np.where(~pin)[0], solids, boxes)
    ob = mesh_obj('Garment', toB(Xs0), tris)
    pinw = pin.astype(float)
    if up:
        # (raised: folded up tight to the small of her back, her seat clear. Rows of the back of the skirt, every 9 cm or so from the hem up to
        # a little below her waist, are each lifted out over her and brought to her waist, one laid on another a little further out; the cloth
        # between two rows makes a short fold, so all of it lies in a tight band at her lower back rather than standing up off it. The sides,
        # free, fall from the band's ends to the front, which still hangs)
        cx, cz = L['skirtC'][0], L['skirtC'][1]
        hem = {'Kirtle': L['kirtleHem'], 'Chemise': L.get('chemiseHem'), 'NightDress': L.get('nightHem')}.get(gname) or L['skirtHem']
        Pu = Pg[U]; phi = np.arctan2(Pu[:, 2] - cz, Pu[:, 0] - cx); behind = np.sin(phi) < -0.3
        top_y = L['waist'] - 0.05; NR = max(3, int(np.ceil((top_y - hem) / 0.09))); ys = hem + (top_y - hem) * np.arange(NR) / NR
        lifted = np.zeros(len(Pu), bool); row = np.zeros(len(Pu))
        for i, yr in enumerate(ys):
            band = (np.abs(Pu[:, 1] - yr) < 0.007) & behind & ~pin; lifted |= band; row[band] = i
        near = np.abs(Pu[:, 1] - L['rollY']) < 0.012; bins = np.linspace(-np.pi, np.pi, 33)
        rr = np.array([np.median(np.hypot(Pu[near & (phi >= a) & (phi < b), 0] - cx, Pu[near & (phi >= a) & (phi < b), 2] - cz)) if (near & (phi >= a) & (phi < b)).any() else np.nan for a, b in zip(bins[:-1], bins[1:])])
        rr = np.where(np.isnan(rr), np.nanmean(rr), rr); rad = np.interp(phi, (bins[:-1] + bins[1:]) / 2, rr, period=2 * np.pi) + 0.008 + 0.007 * row
        T = np.stack([cx + rad * np.cos(phi), L['rollY'] + 0.01 + 0.003 * row, cz + rad * np.sin(phi)], 1)
        qh = mat_quat(mats['hips']); Tw = rot(qh, S * T) + mats['hips'][:3, 3]
        outw = rot(qh, np.stack([np.cos(phi), np.full(len(phi), 0.1), np.sin(phi)], 1))
        Mid = Xs0.copy(); Mid[lifted] = 0.5 * (Xs0[lifted] + Tw[lifted]) + outw[lifted] * 0.12
        Top = Xs0.copy(); Top[lifted] = Tw[lifted]
        ob.shape_key_add(name='Basis'); km = ob.shape_key_add(name='mid', from_mix=False); kt = ob.shape_key_add(name='top', from_mix=False)
        km.data.foreach_set('co', toB(Mid).ravel()); kt.data.foreach_set('co', toB(Top).ravel())
        for f, vm, vt in ((1, 0, 0), (LIFT[0], 0, 0), (LIFT[1], 1, 0), (LIFT[2], 0, 1)):
            km.value, kt.value = vm, vt; km.keyframe_insert('value', frame=f); kt.keyframe_insert('value', frame=f)
        pinw[lifted] = 1.0
    vg = ob.vertex_groups.new(name='pin')
    for i in np.where(pinw > 0)[0]: vg.add([int(i)], 1.0, 'REPLACE')
    md = ob.modifiers.new('Cloth', 'CLOTH'); s = md.settings
    s.quality = QUALITY[0]; s.mass = 0.25; s.air_damping = 1.5; s.vertex_group_mass = 'pin'
    s.tension_stiffness = 8; s.compression_stiffness = 1.5; s.shear_stiffness = 3; s.bending_stiffness = 0.2 if up else 0.45      # (gathered, it folds over on itself freely)
    s.tension_damping = 5; s.compression_damping = 5; s.shear_damping = 5; s.bending_damping = 0.3
    cs = md.collision_settings; cs.distance_min = 0.004; cs.collision_quality = QUALITY[1]
    cs.use_self_collision = bool(up); cs.self_distance_min = 0.004
    md.point_cache.frame_start = 1; md.point_cache.frame_end = FRAMES
    t0 = time.time()
    for f in range(1, FRAMES + 1): sc.frame_set(f)
    ev = ob.evaluated_get(bpy.context.evaluated_depsgraph_get()).data
    co = np.zeros(len(ev.vertices) * 3); ev.vertices.foreach_get('co', co); Xs = fromB(co.reshape(-1, 3))
    if os.environ.get('FENWICK_DEBUG'):      # (where the cloth's stretched far beyond itself: a spike)
        E = np.unique(np.sort(np.concatenate([tris[:, [0, 1]], tris[:, [1, 2]], tris[:, [2, 0]]]), 1), axis=0)
        r = np.linalg.norm(Xs[E[:, 0]] - Xs[E[:, 1]], axis=1) / np.maximum(S * np.linalg.norm(Pg[U][E[:, 0]] - Pg[U][E[:, 1]], axis=1), 1e-6)
        bad = E[r > 2.0]; vs = np.unique(bad.ravel())
        names = {}
        for v in vs:
            for k, (b, _) in enumerate(solids):
                l2, _, _, d2 = b.find_nearest(Vector(Xs[v]), 1.0)
                if d2 is not None and d2 < 0.03: names[k] = names.get(k, 0) + 1
        print('  stretched x2+: %d edges, %d points; pinned among them %d; near solids %s; worst %.1f' % (len(bad), len(vs), int(pinw[vs].sum()), names, r.max()), flush=True)
        for e in np.argsort(-r)[:6]:
            a, b = E[e]
            print('    x%.0f  armw %.2f/%.2f pin %d/%d  bind %s / %s  start %s end %s / start %s end %s' % (r[e], armw[a], armw[b], pinw[a], pinw[b], np.round(Pg[U][a], 3), np.round(Pg[U][b], 3),
                  np.round(Xs0[a], 2), np.round(Xs[a], 2), np.round(Xs0[b], 2), np.round(Xs[b], 2)), flush=True)
    # each point that moves: given to the part of her it lies on, and its offset from the garment as built
    mv = np.where(~pin[ix])[0]
    # (a point flung off (the cloth blew up somewhere): the drape tried again, more finely; failing that, any point still far from her put
    # back where it started)
    far = np.array([solids[0][0].find_nearest(Vector(Xs[i]), 0.5)[0] is None for i in range(len(Xs))]) & ~pin
    if far.any() and os.environ.get('FENWICK_DEBUG'):
        fi_ = np.where(far)[0]; near = {}
        for i in fi_[:400]:
            for k, (b, _) in enumerate(solids):
                d = b.find_nearest(Vector(Xs0[i]), 0.05)[3]
                if d is not None: near[k] = near.get(k, 0) + 1
            for k, (Mw, Mi, half) in enumerate(boxes):
                q = Mi @ np.array([*Xs0[i], 1.0]); 
                if (np.abs(q[:3]) < half + 0.05).all(): near['box%d' % k] = near.get('box%d' % k, 0) + 1
        print('  flung: started near %s; start y %.2f..%.2f; bind y %.2f..%.2f' % (near, Xs0[fi_, 1].min(), Xs0[fi_, 1].max(), Pg[U][fi_, 1].min(), Pg[U][fi_, 1].max()), flush=True)
        print('  solids:', [nm for nm in ['Body', 'Drawers', 'Silas'] [:len(solids)]], flush=True)
    if far.any():
        # (where her drawers lie close to her, the cloth caught between them and her body can be thrown about: again, with her body alone,
        # thickened by her drawers', standing for both)
        if not QUALITY[2] and not legs and not os.environ.get('FENWICK_NORETRY'): print('  %d points flung off: again, without her drawers' % int(far.sum()), flush=True); QUALITY[2] = 1; r = bake(F_, M_, G, rec, gname, up, legs); QUALITY[2] = 0; return r
        print('  %d points still flung off: put back where they started' % int(far.sum()), flush=True); Xs[far] = Xs0[far]
    if up:
        # (the gathered back smoothed: the rows lie close together at her waist and the cloth between them crumples into slivers; eased into a
        # soft roll (Taubin's smoothing, which keeps its bulk rather than shrinking it), then put back outside her where it's sunk in)
        reg = np.where(behind & ~pin)[0]; inreg = np.zeros(len(Xs), bool); inreg[reg] = True
        nb_ = [[] for _ in range(len(Xs))]
        for a, b, c in tris:
            for u_, v_ in ((a, b), (b, c), (c, a)): nb_[u_].append(v_); nb_[v_].append(u_)
        nb_ = [np.unique(n) for n in nb_]
        for it in range(40):
            for lam in (0.6, -0.63):
                avg = np.array([Xs[nb_[i]].mean(0) if len(nb_[i]) else Xs[i] for i in reg]); Xs[reg] += lam * (avg - Xs[reg])
        push_out(Xs, reg, solids, boxes)
    Xm = Xs[ix[mv]]
    # (her trunk and legs only: a skirt never goes with her arms, which move beside it)
    dom = np.array([body['joints'][body['J'][v][int(np.argmax(body['W'][v]))]] for v in range(len(body['P']))])
    keepf = np.array([not any(dom[v].startswith(ARM) for v in f_) for f_ in body['I']])
    bvh = BVHTree.FromPolygons([tuple(v) for v in Xb], [tuple(int(i) for i in f) for f in body['I'][keepf]]); Ik = body['I'][keepf]
    bix = {n: i for i, n in enumerate(G)}; hips = bix['hips']; J2 = np.zeros((len(mv), 2), int); W2 = np.zeros((len(mv), 2))
    for k, p in enumerate(Xm):
        loc, n, fi, dist = bvh.find_nearest(Vector(p), 2.0)
        if fi is None: J2[k] = [hips, hips]; W2[k] = [1.0, 0.0]; continue
        f_ = Ik[fi]; v = f_[int(np.argmin(np.linalg.norm(Xb[f_] - p, axis=1)))]
        w = {}
        for j, wt in zip(body['J'][v], body['W'][v]):
            if wt > 0 and not body['joints'][j].startswith(ARM): b = bix[body['joints'][j]]; w[b] = w.get(b, 0) + wt
        tot = sum(w.values()) or 1.0; free = float(np.clip((dist - 0.025) / 0.075, 0, 1)); free = free * free * (3 - 2 * free)
        w = {b: x / tot * (1 - free) for b, x in w.items()}; w[hips] = w.get(hips, 0) + free
        top = sorted(w.items(), key=lambda e: -e[1])[:2]; t_ = sum(x for _, x in top) or 1.0
        J2[k] = [top[0][0], top[-1][0]]; W2[k] = [top[0][1] / t_, (top[1][1] / t_ if len(top) > 1 else 0.0)]
    off = unskin(G, J2, W2, mats, S, Xm) - Pg[mv]
    print('  draped in %.0f s; furthest %.2f m' % (time.time() - t0, float(np.linalg.norm(off, axis=1).max())), flush=True)
    return mv, off, J2, W2

def sig(P):
    """The garment's points, summed with weights by their order: the same points in the same order give the same, a remade garment (even
    with as many points) another; the game checks it (js/figure.js, applyDrape) before laying a drape on."""
    P = np.asarray(P, np.float64); k = 1 + np.arange(len(P)) % 7
    return [round(float(sum(float(x) for x in P[:, c] * k)), 3) for c in range(3)]
def write(who, idx, data):
    os.makedirs(OUT, exist_ok=True); chunks = []; at = 0
    def put(b):
        nonlocal at
        pad = (-at) % 4; chunks.append(b'\0' * pad); at += pad; o = at; chunks.append(b); at += len(b); return o
    J = {'scale': 32767.0, 'garments': {}}
    for gname, e in sorted(data.items()):
        G_ = J['garments'][gname] = {'count': e['count'], 'sig': e.get('sig'), 'n': len(e['mv']), 'verts': put(np.asarray(e['mv'], '<u2').tobytes()), 'poses': {}}
        for pk, (off, J2, W2) in sorted(e['poses'].items()):
            q = np.clip(np.round(off * 32767.0), -32767, 32767).astype('<i2')
            sw = np.stack([J2[:, 0], J2[:, 1], np.clip(np.round(W2[:, 0] * 255), 0, 255)], 1).astype('u1')
            G_['poses'][pk] = {'off': put(q.tobytes()), 'skin': put(sw.tobytes())}
    open(os.path.join(OUT, who + '.bin'), 'wb').write(b''.join(chunks)); json.dump(J, open(os.path.join(OUT, who + '.json'), 'w'), indent=1)
    print(who, '—', ', '.join('%s (%s)' % (g, ' '.join(sorted(e['poses']))) for g, e in J['garments'].items()), '—', round(at / 1e6, 2), 'MB', flush=True)

def load(who):
    """What's there already for her, so a bake of some is added to the rest."""
    jp, bp = os.path.join(OUT, who + '.json'), os.path.join(OUT, who + '.bin')
    if not (os.path.exists(jp) and os.path.exists(bp)): return {}
    J = json.load(open(jp)); B = open(bp, 'rb').read(); out = {}
    for gname, e in J['garments'].items():
        n = e['n']; mv = np.frombuffer(B, '<u2', n, e['verts']).astype(int); d = out[gname] = {'count': e['count'], 'sig': e.get('sig'), 'mv': mv, 'poses': {}}
        for pk, o in e['poses'].items():
            off = np.frombuffer(B, '<i2', n * 3, o['off']).reshape(-1, 3) / J['scale']; sw = np.frombuffer(B, 'u1', n * 3, o['skin']).reshape(-1, 3)
            d['poses'][pk] = (off, sw[:, :2].astype(int), np.stack([sw[:, 2] / 255.0, 1 - sw[:, 2] / 255.0], 1))
    return out

if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    poses = json.load(open(os.path.join(HERE, 'poses.json'))); meta = json.load(open(os.path.join(MODELS, 'fenwick_meta.json')))
    F_ = {'meshes': read_glb(os.path.join(MODELS, 'fenwick_f.glb')), 'meta': meta['f']}; M_ = read_glb(os.path.join(MODELS, 'fenwick_m.glb'))
    G = list(meta['f']['joints'])      # (the game's own order of her bones)
    heroes = args[0].split(',') if len(args) > 0 and args[0] else list(poses['heroes'])
    only_g = args[1].split(',') if len(args) > 1 and args[1] else None; only_p = args[2].split(',') if len(args) > 2 else None
    for who in heroes:
        data = load(who); recs = poses['heroes'][who]
        for gname, legs in poses['garments'][who]:
            if only_g and gname not in only_g: continue
            # (a garment remade since its drapes were baked, its points not the same: what was baked for it dropped, not mixed with the new)
            sg = sig(F_['meshes'][gname]['P'])
            if gname in data and (data[gname]['count'] != len(F_['meshes'][gname]['P']) or data[gname].get('sig') != sg): print(' ', gname, 'remade: its old drapes dropped', flush=True); del data[gname]
            for pk in POSES_DOWN + [p + ':up' for p in POSES_UP]:
                if only_p and pk not in only_p: continue
                if gname == 'Chemise' and pk in ('edge', 'table'): continue      # (a chemise is always raised at the table: Figure's autoTop)
                pose, up = pk.split(':')[0], pk.endswith(':up')
                print(who, gname, pk, flush=True)
                mv, off, J2, W2 = bake(F_, M_, G, recs[pose], gname, up, legs)
                d = data.setdefault(gname, {'count': len(F_['meshes'][gname]['P']), 'sig': sg, 'mv': mv, 'poses': {}})
                if len(d['mv']) != len(mv) or (np.asarray(d['mv']) != np.asarray(mv)).any(): d['poses'] = {}      # (the skirt's points another set: start over)
                d['mv'] = mv; d['poses'][pk] = (off, J2, W2)
            write(who, None, data)
