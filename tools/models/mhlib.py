# MakeHuman-Grundkörper (CC0) laden, Geschlecht/Alter/Statur einstellen, in T-Pose bringen,
# Gelenke und Gewichte auf das Spielskelett (UE-Namen) abbilden.
import json, numpy as np, os
MH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'mh')

def load_obj():
    V, VT, F, FT, G = [], [], [], [], []
    g = None
    for l in open(os.path.join(MH, 'base.obj')):
        if l.startswith('v '): V.append([float(x) for x in l.split()[1:4]])
        elif l.startswith('vt '): VT.append([float(x) for x in l.split()[1:3]])
        elif l.startswith('g '): g = l.split()[1]
        elif l.startswith('f '):
            p = [x.split('/') for x in l.split()[1:]]
            F.append([int(a[0]) - 1 for a in p]); FT.append([int(a[1]) - 1 for a in p]); G.append(g)
    return np.array(V), np.array(VT), F, FT, G

_tcache = {}
def target(name):
    if name in _tcache: return _tcache[name]
    p = os.path.join(MH, 'targets', name + '.target')
    T = {}
    for l in open(p):
        if l[:1].isdigit():
            a = l.split(); T[int(a[0])] = [float(x) for x in a[1:4]]
    idx = np.array(list(T.keys()), int); d = np.array(list(T.values()))
    _tcache[name] = (idx, d)
    return _tcache[name]

def morph(V, mix):
    V = V.copy()
    for name, w in mix:
        if w == 0: continue
        idx, d = target(name)
        V[idx] += d * w
    return V

SK = json.load(open(os.path.join(MH, 'default.mhskel')))
WT = json.load(open(os.path.join(MH, 'default_weights.mhw')))['weights']

def joints(V):
    return {k: V[v].mean(0) for k, v in SK['joints'].items()}

# MakeHuman-Knochen -> Spielknochen
def game_bone(b):
    s = 'l' if b.endswith('.L') else 'r' if b.endswith('.R') else ''
    n = b.split('.')[0]
    if n in ('root', 'spine05', 'pelvis'): return 'pelvis'
    if n in ('spine04', 'spine03'): return 'spine_01'
    if n == 'spine02': return 'spine_02'
    if n in ('spine01', 'breast'): return 'spine_03'
    if n in ('neck01', 'neck02', 'neck03'): return 'neck_01'
    if n in ('clavicle', 'shoulder01'): return 'clavicle_' + s
    if n.startswith('upperarm'): return 'upperarm_' + s
    if n.startswith('lowerarm'): return 'lowerarm_' + s
    if n in ('wrist',) or n.startswith('metacarpal') or n.startswith('finger1'): return 'hand_' + s
    if n.startswith('finger'):
        return 'middle_01_' + s
    if n.startswith('upperleg'): return 'thigh_' + s
    if n.startswith('lowerleg'): return 'calf_' + s
    if n == 'foot': return 'foot_' + s
    if n.startswith('toe'): return 'ball_' + s
    return 'Head'

def weights(nv):
    W = {}
    for b, lst in WT.items():
        gb = game_bone(b)
        a = W.setdefault(gb, np.zeros(nv))
        for vi, w in lst: a[vi] += w
    tot = sum(W.values()); tot[tot == 0] = 1
    for k in W: W[k] /= tot
    return W

def mhw(nv, bones):
    a = np.zeros(nv)
    for b in bones:
        for vi, w in WT.get(b, []): a[vi] += w
    return a

def rotmat(axis, ang):
    axis = axis / np.linalg.norm(axis); x, y, z = axis; c, s = np.cos(ang), np.sin(ang); C = 1 - c
    return np.array([[c + x*x*C, x*y*C - z*s, x*z*C + y*s], [y*x*C + z*s, c + y*y*C, y*z*C - x*s], [z*x*C - y*s, z*y*C + x*s, c + z*z*C]])

def rot_between(a, b):
    a = a / np.linalg.norm(a); b = b / np.linalg.norm(b)
    ax = np.cross(a, b); s = np.linalg.norm(ax)
    if s < 1e-8: return np.zeros(3), 0.0
    return ax / s, np.arctan2(s, np.dot(a, b))

def blend_rot(V, Jd, pivot, axis, ang, wts):
    """lineares Skinning: Punkt um Gelenk drehen, mit Gewicht je Punkt (Teil-Drehung)"""
    out = V.copy()
    for frac_w, frac in wts:
        pass
    return out

def apply_rot(P, pivot, axis, ang, w):
    """P: Nx3, w: N Gewichte 0..1 -> gewichtete volle Drehung (lineare Mischung)"""
    if ang == 0: return P
    R = rotmat(axis, ang)
    Q = (P - pivot) @ R.T + pivot
    return P + (Q - P) * w[:, None]

ARM = lambda s: ['upperarm01', 'upperarm02', 'lowerarm01', 'lowerarm02', 'wrist'] + [f'metacarpal{i}' for i in range(1, 5)] + [f'finger{i}-{k}' for i in range(1, 6) for k in range(1, 4)]
LEG = lambda s: ['upperleg01', 'upperleg02', 'lowerleg01', 'lowerleg02', 'foot'] + [f'toe{i}-{k}' for i in range(1, 6) for k in range(1, 4) if not (i == 1 and k == 3)]

def tpose(V):
    """Arme waagrecht zur Seite (Handflächen nach unten), Beine senkrecht unter die Hüfte"""
    V = V.copy()
    nv = len(V)
    J = joints(V)
    jl = {k: V[v].mean(0) for k, v in SK['joints'].items()}
    def jpos(Vc, name): return Vc[SK['joints'][name]].mean(0)
    # Gelenk-Helfer bewegen sich mit (sie sind Teil von V)
    for S, sx in (('L', 1), ('R', -1)):
        sfx = '.' + S
        arm = [b + sfx for b in ARM(S)]
        w_arm = np.clip(mhw(nv, arm), 0, 1)
        w_sh = np.clip(mhw(nv, ['shoulder01' + sfx]), 0, 1)
        # 1) Oberarm waagrecht
        sh = jpos(V, 'upperarm01' + sfx + '____head'); el = jpos(V, 'lowerarm01' + sfx + '____head')
        ax, an = rot_between(el - sh, np.array([sx, 0, 0]))
        # Gelenk-Würfel (Helfer) voll mitnehmen, wenn ihr Mittelpunkt im Arm liegt
        V = apply_rot(V, sh, ax, an, np.clip(w_arm + w_sh * 0.45, 0, 1))
        # 2) Unterarm in Linie
        el = jpos(V, 'lowerarm01' + sfx + '____head'); wr = jpos(V, 'wrist' + sfx + '____head')
        fore = [b + sfx for b in ARM(S)[2:]]
        w_fore = np.clip(mhw(nv, fore), 0, 1)
        ax, an = rot_between(wr - el, np.array([sx, 0, 0]))
        V = apply_rot(V, el, ax, an, w_fore)
        # 3) Hand: Handfläche nach unten (um die Unterarmachse drehen)
        wr = jpos(V, 'wrist' + sfx + '____head')
        f2 = jpos(V, 'finger2-1' + sfx + '____head'); f5 = jpos(V, 'finger5-1' + sfx + '____head')
        across = f2 - f5; across[0] = 0
        # Daumenseite (Zeigefinger) soll nach vorn zeigen (-z in MH = hinten; vorn ist +z)
        cur = np.arctan2(across[1], across[2])
        want = 0.0  # Zeigefinger nach vorn (+z)
        hand = [b + sfx for b in ['lowerarm02', 'wrist'] + [f'metacarpal{i}' for i in range(1, 5)] + [f'finger{i}-{k}' for i in range(1, 6) for k in range(1, 4)]]
        w_h = np.clip(mhw(nv, hand), 0, 1) + np.clip(mhw(nv, ['lowerarm01' + sfx]), 0, 1) * 0.5
        V = apply_rot(V, wr, np.array([1.0, 0, 0]), -(cur - want), np.clip(w_h, 0, 1))
        # 4) Bein senkrecht
        hip = jpos(V, 'upperleg01' + sfx + '____head'); an_ = jpos(V, 'foot' + sfx + '____head')
        leg = [b + sfx for b in LEG(S)]
        w_leg = np.clip(mhw(nv, leg) + mhw(nv, ['pelvis' + sfx]) * 0.3, 0, 1)
        d = an_ - hip; tgt = np.array([0, d[1], d[2]])
        ax, an = rot_between(d, tgt)
        V = apply_rot(V, hip, ax, an * 0.85, w_leg)
    return V

def to_blender(P, scale=0.1, yoff=8.4488):
    """MakeHuman (y oben, Blick +z, Dezimeter) -> Blender (z oben, Blick -y, Meter)"""
    return np.stack([P[:, 0] * scale, -P[:, 2] * scale, (P[:, 1] + yoff) * scale], 1)

def game_joints(V):
    """Gelenkpositionen des Spielskeletts aus den MakeHuman-Gelenken (Blender-Koordinaten)"""
    J = {k: v for k, v in joints(V).items()}
    B = lambda n: to_blender(J[n][None])[0]
    g = {}
    g['root'] = np.array([0, 0, 0.0])
    g['pelvis'] = B('spine05____head')
    g['spine_01'] = B('spine04____head'); g['spine_02'] = B('spine03____head') * 0.5 + B('spine02____head') * 0.5
    g['spine_03'] = B('spine02____tail') * 0.6 + B('spine01____head') * 0.4
    g['neck_01'] = B('neck01____head'); g['Head'] = B('head____head'); g['Head_tail'] = B('head____tail')
    for S, s in (('L', 'l'), ('R', 'r')):
        f = '.' + S
        g['clavicle_' + s] = B('clavicle' + f + '____head')
        g['upperarm_' + s] = B('upperarm01' + f + '____head')
        g['lowerarm_' + s] = B('lowerarm01' + f + '____head')
        g['hand_' + s] = B('wrist' + f + '____head')
        g['middle_01_' + s] = B('finger3-1' + f + '____head'); g['middle_01_' + s + '_tail'] = B('finger3-3' + f + '____tail')
        g['thigh_' + s] = B('upperleg01' + f + '____head')
        g['calf_' + s] = B('lowerleg01' + f + '____head')
        g['foot_' + s] = B('foot' + f + '____head')
        g['ball_' + s] = B('toe3-1' + f + '____head'); g['ball_' + s + '_tail'] = B('toe3-3' + f + '____tail') if ('toe3-3' + f + '____tail') in J else B('toe3-2' + f + '____tail')
    return g
