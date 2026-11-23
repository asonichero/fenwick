# Fenwick Hall — the walking clips (Mixamo FBX in models/), made into data our figures can play (models/walk.json).
#
# For each clip, frame by frame, each bone we use: how far it has turned in the world from its rest (a T-pose), as a quaternion; and the hips'
# place. With the rest itself (each bone's place and the way it points, to its child), so the game can line our rest pose (arms hanging) up
# with this one before it turns our bones as these turned. In three.js's frame: y up, the figure facing +z, its left at +x.
# Also, from the clips: the frame where the start's first step begins; the walk's phase its last steps join; the walk's phase the stop's
# first steps follow on from.
#
#   python tools/blender/export_anims.py      (Blender's bpy; writes models/walk.json)
import bpy, json, math, os
from mathutils import Matrix, Quaternion, Vector

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
CLIPS = {'walk': 'Standard Walk', 'female': 'Female walking', 'sad': 'Sad Walk', 'start': 'Start Walking', 'stop': 'Stop Walking'}
LOOPS = ('walk', 'female', 'sad')      # (walks that loop: the bases a figure's own walk is blended from)
# ours ← Mixamo's; and, for each, the bone its direction runs to (the next joint), in theirs
MAP = {'hips': 'Hips', 'spine': 'Spine', 'chest': 'Spine2', 'neck': 'Neck', 'head': 'Head'}
for s, S in (('L', 'Left'), ('R', 'Right')):
    MAP.update({'clav' + s: S + 'Shoulder', 'upperArm' + s: S + 'Arm', 'foreArm' + s: S + 'ForeArm', 'hand' + s: S + 'Hand',
                'thigh' + s: S + 'UpLeg', 'shin' + s: S + 'Leg', 'foot' + s: S + 'Foot', 'toe' + s: S + 'ToeBase'})
TO = {'Hips': 'Spine', 'Spine': 'Spine2', 'Spine2': 'Neck', 'Neck': 'Head', 'Head': 'HeadTop_End'}
for S in ('Left', 'Right'):
    TO.update({S + 'Shoulder': S + 'Arm', S + 'Arm': S + 'ForeArm', S + 'ForeArm': S + 'Hand', S + 'Hand': S + 'HandMiddle1',
               S + 'UpLeg': S + 'Leg', S + 'Leg': S + 'Foot', S + 'Foot': S + 'ToeBase', S + 'ToeBase': S + 'Toe_End'})
A = Matrix(((1, 0, 0), (0, 0, 1), (0, -1, 0)))      # Blender (z up, facing −y) → three.js (y up, facing +z)
AT = A.transposed()
def v3(v): return A @ Vector(v)
def q3(m3):      # a rotation, in three.js's frame, as [x, y, z, w]
    q = (A @ m3 @ AT).to_quaternion().normalized(); return q
def r4(x): return round(x, 4)

def load(name):
    bpy.ops.wm.read_factory_settings(use_empty=True)
    bpy.ops.import_scene.fbx(filepath=os.path.join(ROOT, 'models', name + '.fbx'))
    arm = [o for o in bpy.data.objects if o.type == 'ARMATURE'][0]
    pre = arm.data.bones[0].name.split(':')[0] + ':'
    return arm, pre

out = {'fps': 30, 'map': MAP, 'rest': {}, 'rests': {}, 'clips': {}}
for key, name in CLIPS.items():
    arm, pre = load(name); W = arm.matrix_world; sc = bpy.context.scene
    act = arm.animation_data.action; f0, f1 = int(act.frame_range[0]), int(act.frame_range[1])
    rest = {}
    for ours, theirs in MAP.items():
        b = arm.data.bones.get(pre + theirs)
        if b is None: raise SystemExit(f'{name}: no {theirs}')
        M0 = W @ b.matrix_local; head = M0.translation
        to = arm.data.bones.get(pre + TO[theirs]); tail = (W @ to.matrix_local).translation if to else W @ b.tail_local
        d = (tail - head).normalized()
        rest[ours] = {'pos': [r4(x) for x in v3(head)], 'dir': [r4(x) for x in v3(d)], 'q0': q3(M0.to_3x3().normalized())}
    # (each clip's own rest: their characters aren't the same size or shape)
    out['rests'][key] = {k: {'pos': v['pos'], 'dir': v['dir']} for k, v in rest.items()}
    if key == 'walk': out['rest'] = out['rests'][key]
    clip = {'n': f1 - f0 + 1, 'loop': key in LOOPS, 'hips': [], 'q': {k: [] for k in MAP}}
    for f in range(f0, f1 + 1):
        sc.frame_set(f)
        for ours, theirs in MAP.items():
            pb = arm.pose.bones[pre + theirs]; M = W @ pb.matrix
            D = q3(M.to_3x3().normalized()) @ rest[ours]['q0'].inverted()      # (its turn in the world, from its rest)
            if D.w < 0: D.negate()
            clip['q'][ours] += [r4(D.x), r4(D.y), r4(D.z), r4(D.w)]
            if ours == 'hips': clip['hips'] += [r4(x) for x in v3(M.translation)]
    out['clips'][key] = clip
    print(key, name, 'frames', clip['n'], 'hips from', clip['hips'][:3], 'to', clip['hips'][-3:])

# ── Where the clips join: the walk's phase that the start's last steps match, and that the stop's first steps follow on from ──
def legs(clip, f):
    return [Quaternion(clip['q'][b][f * 4 + 3:f * 4 + 4] + clip['q'][b][f * 4:f * 4 + 3]) for b in ('thighL', 'thighR', 'shinL', 'shinR', 'upperArmL', 'upperArmR')]
def far(a, b): return sum(min(x.rotation_difference(y).angle, 2 * math.pi - x.rotation_difference(y).angle) for x, y in zip(a, b))
W_ = out['clips']['walk']; cyc = W_['n'] - 1      # (the walk's last frame is its first again)
def best(pose): return min(range(cyc), key=lambda f: far(pose, legs(W_, f)))
st, sp = out['clips']['start'], out['clips']['stop']
# (the start's first step: a few frames before its hips begin to go forward)
def hz(c, f): return c['hips'][f * 3 + 2]
first = 0
for f in range(st['n']):
    if abs(hz(st, f) - hz(st, 0)) > 0.03: first = max(0, f - 6); break
out['join'] = {'cycle': cyc, 'startFirst': first, 'startToWalk': best(legs(st, st['n'] - 1)), 'walkToStop': best(legs(sp, 0))}
print('join', out['join'])
json.dump(out, open(os.path.join(ROOT, 'models', 'walk.json'), 'w'), separators=(',', ':'))
print('wrote models/walk.json', os.path.getsize(os.path.join(ROOT, 'models', 'walk.json')) // 1024, 'KB')
