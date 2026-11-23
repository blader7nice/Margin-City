"""Animation clip libraries (the game's clip contracts), shared by the hand-built characters and by the
conform pipeline for AI-generated / artist meshes. Every function takes a charlib.Rig with the shared bone names.
"""
import math

import charlib as C

X, Y, Z = (1, 0, 0), (0, 1, 0), (0, 0, 1)


def leon_clips(rig):
    """Leon: Idle, IdleCompass, Walk, Run, CrouchIdle, CrouchWalk, Push, JumpUp, Fall, Slide, Mantle, Hide, Caught."""
    G = C.gait


    def crouch(p, k=1.0):
        p = dict(p)
        th = p.get('thigh', (0, 0))
        kn = p.get('knee', (0, 0))
        p.update(thigh=(th[0] + 1.05 * k, th[1] + 1.05 * k), knee=(kn[0] + 1.75 * k, kn[1] + 1.75 * k), ankle=(-0.5 * k, -0.5 * k))
        p['lean'] = p.get('lean', 0) + 0.45 * k
        p['hipsY'] = p.get('hipsY', 0) - 0.34 * k
        p['elbow'] = (0.8, 0.8)
        p['armOut'] = 0.18
        return p


    T = math.tau
    rig.action('Idle', 72, lambda t: {'breath': math.sin(t * T) * 0.025, 'headTurn': math.sin(t * T) * 0.1, 'shoulder': (0.04, 0.12), 'elbow': (0.25, 0.75), 'hipsY': math.sin(t * T * 2) * 0.004, 'armOut': 0.1})
    # compass held in front of the chest, elbow at the side (angles solved numerically: hand.R ≈ (-0.10, -0.21, 1.27))
    rig.action('IdleCompass', 90, lambda t: {'breath': math.sin(t * T) * 0.02, 'shoulder': (0.05, 0.2), 'elbow': (0.3, 2.0 + math.sin(t * T) * 0.04), 'armOut': (0.1, 0.2), 'armTwist': (0, 0.8), 'headTilt': 0.4 + math.sin(t * T) * 0.03, 'headTurn': -0.18})
    rig.action('Walk', 20, lambda t: {**G(t, 0.5, 0.75, 0.42, 0.06, 0.035, 0.35), 'armOut': 0.1})
    rig.action('Run', 16, lambda t: {**G(t, 0.92, 1.4, 0.85, 0.28, 0.06, 1.2), 'armOut': 0.12})
    rig.action('CrouchIdle', 60, lambda t: crouch({'breath': math.sin(t * T) * 0.02}))
    rig.action('CrouchWalk', 28, lambda t: crouch(G(t, 0.35, 0.4, 0.2, 0.0, 0.02, 0.8)))
    rig.action('Push', 30, lambda t: {**G(t, 0.3, 0.5, 0.0, 0.55, 0.02, 0.4), 'shoulder': (1.35, 1.25), 'elbow': (0.35, 0.4), 'armOut': 0.12, 'hipsY': -0.05})
    rig.action('JumpUp', 12, lambda t: {'thigh': (0.95, 0.35), 'knee': (1.45, 0.6), 'shoulder': (0.9, -0.5), 'elbow': (0.9, 0.5), 'lean': 0.15})
    rig.action('Fall', 20, lambda t: {'thigh': (0.45 + math.sin(t * T) * 0.08, -0.1), 'knee': (0.5, 0.25), 'shoulder': (1.2, 0.8), 'armOut': 0.45 + math.sin(t * T) * 0.1, 'elbow': (0.3, 0.3), 'lean': 0.15})
    rig.action('Slide', 12, lambda t: {'thigh': (1.35, 0.5), 'knee': (0.25, 1.9), 'shoulder': (-0.6, -0.9), 'elbow': (0.6, 0.4), 'armOut': 0.35, 'lean': -0.35, 'hipsY': -0.5})
    rig.action('Mantle', 14, lambda t: {'shoulder': (2.9 - 2.3 * t, 2.9 - 2.3 * t), 'elbow': (0.2 + 1.4 * t, 0.2 + 1.4 * t), 'thigh': (1.3, 0.2 + 0.9 * t), 'knee': (1.8, 0.4 + 1.2 * t), 'lean': 0.1 + 0.55 * t}, loop=False)
    rig.action('Hide', 60, lambda t: crouch({'breath': math.sin(t * T) * 0.03, 'shoulder': (-0.15, -0.15), 'headTurn': math.sin(t * T) * 0.3}, 0.4))
    rig.action('Caught', 20, lambda t: {'shoulder': (2.3, 2.1), 'elbow': (0.6, 0.5), 'lean': -0.25, 'armOut': 0.4, 'headTilt': 0.2})
    rig.rest_pose()


def mm01_clips(rig):
    """MM-01: Idle, Walk, Run, Consult, Grab (+ coat-tail bones if present)."""
    G = C.gait
    T = math.tau


    def behind_back(p):
        p = dict(p)
        # solved numerically (tools: hand.L ≈ (0.05, 0.16, 1.10) — hands meet behind the back at the belt)
        p.update(shoulder=(-0.65, -0.65), armOut=(-0.05, -0.05), armTwist=(0.8, 0.8), elbow=(0.8, 0.8), wrist=(0.2, 0.2))
        return p


    def coat_tails(thL, thR, flare=0.0, sway=0.0):
        return {'coat.L': [(X, -thL * 0.55 + flare)], 'coat.R': [(X, -thR * 0.55 + flare)], 'coat.B': [(X, flare * 1.3 + sway)]}


    def walk(t):
        p = behind_back(G(t, 0.36, 0.5, 0.0, 0.02, 0.018, 0.0))
        lag = G((t - 0.07) % 1.0, 0.36, 0.5, 0.0, 0.0, 0.0, 0.0)['thigh']
        p['extra'] = coat_tails(lag[0], lag[1], 0.04, math.sin(t * T * 2) * 0.03)
        p['torsoTwist'] = p['torsoTwist'] * 0.4
        return p


    def run(t):
        p = G(t, 0.82, 1.3, 0.85, 0.24, 0.05, 1.3)
        lag = G((t - 0.09) % 1.0, 0.82, 1.3, 0.0, 0.0, 0.0, 0.0)['thigh']
        p['extra'] = coat_tails(lag[0], lag[1], 0.38, math.sin(t * T * 2) * 0.08)
        p['armOut'] = 0.12
        return p


    def idle(t):
        p = behind_back({'breath': math.sin(t * T) * 0.018, 'hipsY': math.sin(t * T) * 0.003, 'headTilt': 0.06})
        p['extra'] = coat_tails(0, 0, 0.02, math.sin(t * T) * 0.01)
        return p


    def consult(t):
        # Hand to the temple implant: "consulting MIRROR forecast"
        p = idle(t)
        # right fingertips to the temple implant (solved numerically), left hand stays behind the back
        p.update(shoulder=(-0.65, 2.4), armOut=(-0.05, 0.6), armTwist=(0.8, 1.2), elbow=(0.8, 2.4), wrist=(0.2, 0.3), headTilt=0.1 + math.sin(t * T) * 0.02, headRoll=-0.1)
        return p


    def grab(t):
        k = min(1.0, t * 1.6)
        p = {'shoulder': (-0.65 * (1 - k) + 0.9 * k, -0.65 * (1 - k) + 1.45 * k), 'armOut': (0.1 * k - 0.05 * (1 - k), 0.05), 'armTwist': (0.8 * (1 - k), 0.8 * (1 - k)),
             'elbow': (0.8 * (1 - k) + 0.5 * k, 0.8 * (1 - k) + 0.15 * k), 'lean': 0.18 * k, 'thigh': (0.25 * k, -0.1 * k), 'knee': (0.3 * k, 0.15 * k)}
        p['extra'] = coat_tails(0.25 * k, -0.1 * k, 0.1 * k)
        return p


    rig.action('Idle', 90, idle)
    rig.action('Walk', 32, walk)
    rig.action('Run', 18, run)
    rig.action('Consult', 60, consult)
    rig.action('Grab', 14, grab, loop=False)
    rig.rest_pose()
