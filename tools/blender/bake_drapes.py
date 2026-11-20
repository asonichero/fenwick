"""Fenwick Hall — her skirts draped in Blender, once for each pose she's put in (tools/export-poses.js wrote them: tools/blender/poses.json).

For each garment with a skirt (the dresses and the kirtle, down and raised) and each pose: her body is posed, by the game's own skinning (the
bones' matrices from the game, blended as dual quaternions, as js/figure.js does on the GPU), as a collider, with what she wears under the
skirt; with Silas's legs (capsules), the furniture (boxes) and the floor. The garment is posed the same way, and from there Blender's cloth lets its skirt fall: the bodice and
sleeves (and, raised, the roll at her back) pinned where they are, the rest hanging under gravity and lying over whatever it meets. Where each
point of it settles is turned back, through the same skinning undone, into an offset from the garment as built; the game adds it when she's
in that pose (js/figure.js: setDrape). Written to models/fenwick_drapes.json (the index) and models/fenwick_drapes.bin (the offsets, int16).

    .blender/bin/python tools/blender/bake_drapes.py [-- MESH,MESH POSE,POSE]      (a few minutes each; all of them, half an hour or so)
"""
import sys, os, json, struct, math, time
import numpy as np
import bpy

HERE = os.path.dirname(os.path.abspath(__file__)); REPO = os.path.dirname(os.path.dirname(HERE))
MODELS = os.environ.get('FENWICK_MODELS') or os.path.join(REPO, 'models'); OUT = os.environ.get('FENWICK_OUT') or MODELS
GARMENTS = ['DressLong', 'DressLongUp', 'DressElbow', 'DressElbowUp', 'Kirtle', 'KirtleUp']
POSES_DOWN = ['otk', 'bed', 'edge', 'table', 'after']; POSES_UP = ['otk', 'bed', 'edge', 'table']      # (raised only in a correction)
FRAMES = 72
ARM = ('clav', 'upperArm', 'foreArm', 'hand', 'index', 'middle', 'ring', 'pinky', 'thumb')

# ── the model, read straight from the GLB, in the game's own order ──
def read_glb(path):
    b = open(path, 'rb').read(); assert b[:4] == b'glTF'
    jl = struct.unpack_from('<I', b, 12)[0]; J = json.loads(b[20:20 + jl]); bl = struct.unpack_from('<I', b, 20 + jl)[0]; BIN = b[28 + jl:28 + jl + bl]
    CT = {5126: ('<f4', 4), 5123: ('<u2', 2), 5121: ('u1', 1), 5125: ('<u4', 4)}; NC = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3, 'VEC4': 4}
    def acc(i):
        a = J['accessors'][i]; bv = J['bufferViews'][a['bufferView']]; dt, sz = CT[a['componentType']]; nc = NC[a['type']]
        off = bv.get('byteOffset', 0) + a.get('byteOffset', 0); stride = bv.get('byteStride', sz * nc); n = a['count']
        raw = np.frombuffer(BIN, dtype=np.uint8, count=stride * (n - 1) + sz * nc, offset=off)
        out = np.stack([np.frombuffer(raw[k * stride:k * stride + sz * nc].tobytes(), dtype=dt) for k in range(n)]) if stride != sz * nc else np.frombuffer(raw.tobytes(), dtype=dt).reshape(n, nc)
        out = out.astype(np.float64)
        if a.get('normalized'): out = out / (255.0 if sz == 1 else 65535.0)
        return out
    meshes = {}
    for nd in J['nodes']:
        if 'mesh' not in nd or 'skin' not in nd: continue
        name = nd.get('name', ''); import re; name = re.sub(r'_\d+$', '', name)
        pr = J['meshes'][nd['mesh']]['primitives'][0]; at = pr['attributes']
        joints = [J['nodes'][j]['name'] for j in J['skins'][nd['skin']]['joints']]
        meshes[name] = dict(P=acc(at['POSITION']), J=acc(at['JOINTS_0']).astype(int), W=acc(at['WEIGHTS_0']), I=acc(pr['indices']).astype(int).reshape(-1, 3), joints=joints)
    return meshes

# ── the game's skinning (js/figure.js: DQS_*), and its inverse ──
def mat_quat(m):
    r = m[:3, :3] / np.linalg.norm(m[:3, :3], axis=0)      # (columns normalized, as the shader does)
    # (r[i][j] in GLSL is column i, row j)
    R = lambda i, j: r[j, i]
    tr = R(0, 0) + R(1, 1) + R(2, 2)
    if tr > 0: s = math.sqrt(tr + 1) * 2; q = np.array([(R(1, 2) - R(2, 1)) / s, (R(2, 0) - R(0, 2)) / s, (R(0, 1) - R(1, 0)) / s, 0.25 * s])
    elif R(0, 0) > R(1, 1) and R(0, 0) > R(2, 2): s = math.sqrt(1 + R(0, 0) - R(1, 1) - R(2, 2)) * 2; q = np.array([0.25 * s, (R(1, 0) + R(0, 1)) / s, (R(2, 0) + R(0, 2)) / s, (R(1, 2) - R(2, 1)) / s])
    elif R(1, 1) > R(2, 2): s = math.sqrt(1 + R(1, 1) - R(0, 0) - R(2, 2)) * 2; q = np.array([(R(1, 0) + R(0, 1)) / s, 0.25 * s, (R(2, 1) + R(1, 2)) / s, (R(2, 0) - R(0, 2)) / s])
    else: s = math.sqrt(1 + R(2, 2) - R(0, 0) - R(1, 1)) * 2; q = np.array([(R(2, 0) + R(0, 2)) / s, (R(2, 1) + R(1, 2)) / s, 0.25 * s, (R(0, 1) - R(1, 0)) / s])
    return q / np.linalg.norm(q)
def dq_dual(q, t): return 0.5 * np.concatenate([q[3] * t + np.cross(t, q[:3]), [-np.dot(t, q[:3])]])
def rot(q, v): return v + 2.0 * np.cross(q[..., :3], np.cross(q[..., :3], v) + q[..., 3:4] * v)
def blend(mesh, mats):
    """Each point's blended rotation (quaternion) and translation, as the shader blends them."""
    names = mesh['joints']; Q = np.array([mat_quat(mats[n]) for n in names]); D = np.array([dq_dual(Q[i], mats[n][:3, 3]) for i, n in enumerate(names)])
    J, W = mesh['J'], mesh['W'] / np.maximum(mesh['W'].sum(1, keepdims=True), 1e-9)
    qa = Q[J[:, 0]]; r = np.zeros((len(J), 4)); d = np.zeros((len(J), 4))
    for k in range(4):
        qk = Q[J[:, k]]; w = W[:, k] * np.where((k > 0) & (np.sum(qa * qk, 1) < 0), -1.0, 1.0)
        r += w[:, None] * qk; d += w[:, None] * D[J[:, k]]
    L = np.linalg.norm(r, axis=1, keepdims=True); r /= L; d /= L
    t = 2.0 * (r[:, 3:4] * d[:, :3] - d[:, 3:4] * r[:, :3] + np.cross(r[:, :3], d[:, :3]))
    return r, t
def skin(mesh, mats, S, P=None):
    r, t = blend(mesh, mats); return rot(r, S * (mesh['P'] if P is None else P)) + t
def unskin(mesh, mats, S, X):
    r, t = blend(mesh, mats); rc = r * np.array([-1, -1, -1, 1.0]); return rot(rc, X - t) / S

# ── Blender: ours (y up) and Blender's (z up) ──
toB = lambda P: np.stack([P[:, 0], -P[:, 2], P[:, 1]], 1)
fromB = lambda P: np.stack([P[:, 0], P[:, 2], -P[:, 1]], 1)
def mesh_obj(name, V, F, collide=False):
    me = bpy.data.meshes.new(name); me.from_pydata([tuple(v) for v in V], [], [tuple(int(i) for i in f) for f in F]); me.update()
    ob = bpy.data.objects.new(name, me); bpy.context.scene.collection.objects.link(ob)
    if collide:
        ob.modifiers.new('Collision', 'COLLISION'); ob.collision.thickness_outer = 0.006; ob.collision.cloth_friction = 6.0; ob.collision.damping = 0.6
    return ob
def capsule(name, A, B, ra, rb):
    n = 16; ax = B - A; L = np.linalg.norm(ax); d = ax / max(L, 1e-9)
    e1 = np.cross(d, [0, 0, 1.0]); e1 = e1 / np.linalg.norm(e1) if np.linalg.norm(e1) > 1e-6 else np.array([1.0, 0, 0]); e2 = np.cross(d, e1)
    V, F = [], []
    prof = [(A - d * ra * math.cos(t), ra * math.sin(t)) for t in np.linspace(0.05, math.pi / 2, 5)] + [(B + d * rb * math.cos(t), rb * math.sin(t)) for t in np.linspace(math.pi / 2, 0.05, 5)]
    for c, r in prof:
        for k in range(n): a = 2 * math.pi * k / n; V.append(c + (e1 * math.cos(a) + e2 * math.sin(a)) * r)
    for i in range(len(prof) - 1):
        for k in range(n): F.append((i * n + k, i * n + (k + 1) % n, (i + 1) * n + (k + 1) % n, (i + 1) * n + k))
    V.append(A - d * ra); V.append(B + d * rb); c0, c1 = len(V) - 2, len(V) - 1
    for k in range(n): F.append((c0, (k + 1) % n, k)); F.append((c1, (len(prof) - 1) * n + k, (len(prof) - 1) * n + (k + 1) % n))
    return mesh_obj(name, toB(np.array(V)), F, True)
def box(name, Mw, w, h, d):
    C = np.array([[x, y, z] for x in (-w / 2, w / 2) for y in (-h / 2, h / 2) for z in (-d / 2, d / 2)])
    P = (np.c_[C, np.ones(8)] @ Mw.T)[:, :3]
    F = [(0, 1, 3, 2), (4, 6, 7, 5), (0, 4, 5, 1), (2, 3, 7, 6), (0, 2, 6, 4), (1, 5, 7, 3)]
    return mesh_obj(name, toB(P), F, True)

def bake(meshes, meta, pose, P_, gname):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    sc = bpy.context.scene; sc.frame_start, sc.frame_end = 1, FRAMES
    mats = {n: np.array(m).reshape(4, 4).T for n, m in P_['bones'].items()}; S = P_['scale']; L = meta['landmarks']
    body = meshes['Body']; mesh_obj('Body', toB(skin(body, mats, S)), body['I'], True)
    for i, c in enumerate(P_['caps']): capsule('Leg%d' % i, np.array(c[:3]), np.array(c[3:6]), c[6], c[7])
    for i, bx in enumerate(P_['boxes']): box('Box%d' % i, np.array(bx[:16]).reshape(4, 4).T, *bx[16:])
    mesh_obj('Floor', np.array([[-6, -6, 0], [6, -6, 0], [6, 6, 0], [-6, 6, 0.0]]), [(0, 1, 2, 3)], True)
    # (and what she wears under it, which it lies over: drawers under a dress, leggings and smalls under the kirtle)
    for un in (['Leggings', 'Smalls'] if gname.startswith('Kirtle') else ['Drawers']):
        if un in meshes: mesh_obj(un, toB(skin(meshes[un], mats, S)), meshes[un]['I'], True)
    g = meshes[gname]; X0 = skin(g, mats, S)
    # (the skirt's points welded where the export split them, so its seams can't open)
    uid = {}; U = []
    for i, p in enumerate(g['P']):
        k = tuple(np.round(p, 6))
        if k not in uid: uid[k] = len(U); U.append(i)
    ix = np.array([uid[tuple(np.round(p, 6))] for p in g['P']]); U = np.array(U)
    tris = ix[g['I']]; tris = tris[(tris[:, 0] != tris[:, 1]) & (tris[:, 1] != tris[:, 2]) & (tris[:, 0] != tris[:, 2])]
    ob = mesh_obj('Garment', toB(X0[U]), tris)
    # (pinned: the bodice and above, the sleeves; raised, the roll at her back)
    y = g['P'][U, 1]; armw = np.array([sum(w for j, w in zip(g['J'][i], g['W'][i]) if g['joints'][j].startswith(ARM)) for i in U])
    top = L['waist'] - 0.025 if not gname.endswith('Up') else min(L['waist'] - 0.025, L['rollY'] - 0.05)
    pin = ((y > top) | (armw > 0.3)).astype(float)
    vg = ob.vertex_groups.new(name='pin')
    for i in np.where(pin > 0)[0]: vg.add([int(i)], 1.0, 'REPLACE')
    md = ob.modifiers.new('Cloth', 'CLOTH'); s = md.settings
    s.quality = 6; s.mass = 0.3; s.air_damping = 1.0; s.vertex_group_mass = 'pin'
    s.tension_stiffness = 15; s.compression_stiffness = 15; s.shear_stiffness = 5; s.bending_stiffness = 0.8
    s.tension_damping = 5; s.compression_damping = 5; s.shear_damping = 5; s.bending_damping = 0.5
    cs = md.collision_settings; cs.distance_min = 0.006; cs.collision_quality = 3; cs.use_self_collision = False
    md.point_cache.frame_start = 1; md.point_cache.frame_end = FRAMES
    t0 = time.time()
    for f in range(1, FRAMES + 1): sc.frame_set(f)
    dg = bpy.context.evaluated_depsgraph_get(); ev = ob.evaluated_get(dg).data
    co = np.zeros(len(ev.vertices) * 3); ev.vertices.foreach_get('co', co); Xs = fromB(co.reshape(-1, 3))
    Xd = Xs[ix]      # (back to every point the game has)
    off = unskin(g, mats, S, Xd) - g['P']; off[pin[ix] > 0] = 0.0
    print(gname, pose, 'draped in', round(time.time() - t0, 1), 's; furthest', round(float(np.linalg.norm(off, axis=1).max()), 3), 'm', flush=True)
    return off

if __name__ == '__main__':
    args = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    only_g = args[0].split(',') if len(args) > 0 else GARMENTS; only_p = args[1].split(',') if len(args) > 1 else None
    meshes = read_glb(os.path.join(MODELS, 'fenwick_f.glb')); meta = json.load(open(os.path.join(MODELS, 'fenwick_meta.json')))['f']
    poses = json.load(open(os.path.join(HERE, 'poses.json')))['poses']
    # (what's there already is kept: a bake of some is added to the rest)
    jpath, bpath = os.path.join(OUT, 'fenwick_drapes.json'), os.path.join(OUT, 'fenwick_drapes.bin')
    have = {}
    if os.path.exists(jpath) and os.path.exists(bpath):
        J = json.load(open(jpath)); B = np.fromfile(bpath, dtype='<i2')
        for gn, e in J['meshes'].items():
            for pn, o in e['poses'].items(): have[(gn, pn)] = B[o // 2:o // 2 + e['count'] * 3].astype(np.float64).reshape(-1, 3) / J['scale']
    for gn in only_g:
        for pn in (POSES_UP if gn.endswith('Up') else POSES_DOWN):
            if only_p and pn not in only_p: continue
            have[(gn, pn)] = bake(meshes, meta, pn, poses[pn], gn)
    SCALE = 32767.0      # (a metre either way, to a thirtieth of a millimetre)
    idx = {'scale': SCALE, 'meshes': {}}; chunks = []; at = 0
    for (gn, pn), off in sorted(have.items()):
        e = idx['meshes'].setdefault(gn, {'count': len(off), 'poses': {}}); q = np.clip(np.round(off * SCALE), -32767, 32767).astype('<i2')
        e['poses'][pn] = at; chunks.append(q.tobytes()); at += q.nbytes
    open(bpath, 'wb').write(b''.join(chunks)); json.dump(idx, open(jpath, 'w'), indent=1)
    print('drapes:', ', '.join('%s (%s)' % (g, ' '.join(sorted(e['poses']))) for g, e in idx['meshes'].items()), '—', round(at / 1e6, 2), 'MB')
