"""Original HMH action SFX: pressure, crack, metal, impact and reward.

No external samples, encoder or packages. Randomness is local xorshift32;
this offline tool has no connection to gameplay RNG. Mono PCM WAV is byte
reproducible. The manifest records every layer recipe and actual PCM metrics.
Run: python scripts/build-hmh-weapon-sfx.py --verify-reproducible
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / 'apps/portal/assets/audio/sfx'
MANIFEST_PATH = OUT_DIR / 'hmh-weapon-sfx-manifest.json'
PIPELINE_ID = 'hmh-weapon-sfx-v2'
SAMPLE_RATE = 44_100
PEAK_CEILING = 0.78


class Rng:
    def __init__(self, seed):
        self.state = seed & 0xFFFFFFFF or 0x1A2B3C4D

    def next_unit(self):
        x = self.state
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        self.state = x & 0xFFFFFFFF
        return self.state / 0xFFFFFFFF * 2 - 1


def lowpass(samples, hz):
    alpha = 1 - math.exp(-2 * math.pi * hz / SAMPLE_RATE)
    previous = 0.0
    result = []
    for value in samples:
        previous += alpha * (value - previous)
        result.append(previous)
    return result


def layer(kind, gain, decay, *, at=0, attack=.35, hz=180, sweep=1,
          low=9500, high=0, length=None):
    return dict(kind=kind, gain=gain, decayMs=decay, startMs=at, attackMs=attack,
                hz=hz, sweep=sweep, lowpassHz=low, highpassHz=high, lengthMs=length or decay * 5)


def metal(gain, at, hz=1500, decay=12):
    # Inharmonic modes provide mechanical clacks instead of pitched beeps.
    return [layer('metal', gain, decay, at=at, hz=hz),
            layer('noise', gain * .7, 3, at=at, high=1500)]


def shot(seed, duration, hz, decay, *, crack=1.8, low=8800):
    return dict(seed=seed, durationMs=duration, drive=1.7, peak=.76, layers=[
        layer('noise', crack, 9, low=low, high=1400),
        layer('noise', 1.8, decay, low=1700),
        layer('tone', 1.35, decay * 1.15, hz=hz, sweep=.74, low=1100),
        layer('noise', .35, decay * .8, at=42, low=3600),
        *metal(.22, 26, hz=1900, decay=10),
    ])


def cue(seed, duration, layers, *, peak=.68, drive=1.25, runtime=None):
    result = dict(seed=seed, durationMs=duration, drive=drive, peak=peak, layers=layers)
    if runtime:
        result['runtimeCue'] = runtime
    return result


def reward(seed, notes, runtime, *, duration=460):
    layers = []
    for index, hz in enumerate(notes):
        layers.extend([layer('tone', .48, 60, at=index * 72, hz=hz, attack=2),
                       layer('tone', .12, 35, at=index * 72, hz=hz * 2.01, attack=1)])
    return cue(seed, duration, layers, peak=.60, runtime=runtime)


CUES = {
    # Immediate crack, low-mid pressure that survives laptop speakers, then
    # a brief reflected tail. The fired event never starts with a charge-up.
    'hmh-fire-coin-blaster': shot(0x0C01B1A5, 240, 145, 54),
    'hmh-fire-scatter-shotgun': shot(0x5C471234, 480, 88, 102, crack=2.3, low=7200),
    'hmh-fire-auto-miner': shot(0x0A471111, 170, 158, 43, crack=1.65),
    'hmh-fire-launcher-rig': shot(0x1A0C4E12, 520, 66, 125, crack=.8, low=3200),
    'hmh-fire-hash-rail': cue(0x8A571A11, 440, [
        layer('noise', 2, 12, high=1000), layer('tone', 1.1, 75, hz=94, sweep=.7),
        layer('metal', .65, 95, hz=530, sweep=.82), layer('noise', .4, 110, at=20, low=4700),
    ], peak=.76, drive=1.8),
    'hmh-fire-lightning-ledger': cue(0x11E6E220, 190, [
        layer('noise', 1.4, 8, high=1800), layer('metal', .8, 27, hz=670, sweep=1.14),
        layer('tone', .65, 40, hz=185, sweep=.6), layer('noise', .6, 13, at=35, high=1000),
    ], peak=.70, drive=1.6),
    'hmh-fire-bear-market-burner': cue(0xBEA4F11E, 220, [
        layer('noise', 1.8, 64, low=2400, attack=2), layer('noise', .45, 40, low=8200, high=2500),
        layer('tone', .7, 62, hz=72, sweep=1.3, attack=2),
    ], peak=.67, drive=1.8),
    'hmh-fire-forked-standard': cue(0xF04C3D11, 310, [
        layer('noise', 1.4, 20, low=6500), layer('tone', .75, 65, hz=235, sweep=.7),
        layer('metal', .75, 55, hz=860, sweep=.65), layer('noise', .4, 12, at=65, high=2500),
    ], peak=.71, drive=1.6),
    'hmh-lightning-interrupt': cue(0x11E6E221, 190, [
        layer('metal', .6, 30, hz=830, sweep=.3), layer('noise', .55, 20, low=4200),
    ], peak=.58),
    'hmh-lightning-overheat': cue(0x11E6E222, 520, [
        *metal(.8, 0, hz=720, decay=27),
        layer('noise', 1, 110, at=45, attack=20, high=1100, low=4700),
        layer('tone', .4, 105, hz=160, sweep=.55),
    ], peak=.65),
    'hmh-lightning-empty': cue(0x11E6E223, 190, [
        *metal(.65, 0, hz=1300), *metal(.35, 75, hz=740),
    ], peak=.57),
    'hmh-hash-rail-charge': cue(0xC4A26311, 920, [
        layer('tone', .4, 450, hz=66, sweep=8, attack=150, length=900),
        layer('metal', .2, 260, at=160, hz=240, sweep=2.7, attack=100),
        layer('noise', .22, 270, at=210, attack=110, high=2400),
    ], peak=.53),
    # Start unlatches/withdraws the magazine; completion has its own real
    # runtime event so it cannot announce readiness before ammo returns.
    'hmh-weapon-reload': cue(0x2E10AD77, 400, [
        *metal(.75, 0, hz=1850),
        layer('noise', .38, 43, at=45, low=5500, high=550, attack=8),
        *metal(.5, 148, hz=970, decay=18), layer('tone', .4, 22, at=148, hz=165),
    ], peak=.70, drive=1.4),
    'hmh-reload-complete': cue(0x2E10AD78, 240, [
        layer('tone', .8, 27, hz=175, sweep=.84), *metal(1, 0, hz=1100, decay=18),
        layer('noise', .5, 13, at=52, high=500), *metal(.75, 86, hz=2050),
    ], peak=.72, drive=1.7, runtime='reload-complete'),
    'hmh-weapon-empty': cue(0x3D2C0000, 100, [
        *metal(.7, 0, hz=1650, decay=7), layer('tone', .25, 10, hz=265),
    ], peak=.61),
    'hmh-enemy-hit': cue(0xE1E11117, 180, [
        layer('noise', 1, 13, low=6000), layer('noise', .75, 28, low=800),
        layer('tone', .8, 25, hz=128, sweep=.74),
    ], peak=.70, drive=1.8, runtime='enemy-hit'),
    'hmh-player-hit': cue(0xDA1A6E, 320, [
        layer('noise', .9, 26, low=3700), layer('tone', 1.1, 67, hz=90, sweep=.78),
        layer('noise', .4, 40, at=32, low=800), *metal(.25, 0, hz=650, decay=22),
    ], peak=.76, drive=1.8, runtime='player-hit'),
    'hmh-melee': cue(0xB1ADE, 250, [
        layer('noise', .9, 48, attack=16, high=1700, low=8400),
        layer('noise', .35, 18, at=65, low=1700), layer('metal', .18, 24, at=60, hz=2100, sweep=.7),
    ], peak=.63, runtime='melee'),
    'hmh-grenade-throw': cue(0x6A3A01, 320, [
        *metal(.6, 0, hz=1850, decay=13), layer('noise', .6, 60, at=48, attack=24, low=4500, high=500),
    ], peak=.64, runtime='grenade'),
    'hmh-grenade-boom': cue(0x6A3A02, 1000, [
        layer('noise', 2, 26, low=6500), layer('noise', 2, 145, low=1200),
        layer('tone', 1.5, 160, hz=66, sweep=.62), layer('noise', .6, 135, at=100, low=2800),
        *metal(.22, 180, hz=2350, decay=55),
    ], peak=.78, drive=2, runtime='grenade-boom'),
    'hmh-pickup': reward(0xB1C001, [880, 1320], 'pickup', duration=300),
    'hmh-health-pickup': reward(0xB1C002, [523.25, 659.25, 1046.5], 'health-pickup'),
    'hmh-ammo-pickup': cue(0xB1C003, 280, [
        *metal(.7, 0, hz=930), *metal(.6, 64, hz=1320), layer('tone', .25, 37, at=90, hz=440),
    ], peak=.63, runtime='ammo-pickup'),
    'hmh-time-dilation': cue(0xB1C004, 620, [
        layer('metal', .38, 125, hz=1700, sweep=.25, attack=5),
        layer('tone', .5, 130, hz=660, sweep=.33, attack=8),
        layer('noise', .32, 95, at=70, high=2000, attack=30),
    ], peak=.65, runtime='time-dilation-activate'),
    'hmh-berserk': cue(0xB1C005, 600, [
        layer('tone', .8, 140, hz=80, sweep=2.4, attack=6), layer('noise', .7, 110, low=2800),
        layer('metal', .35, 65, at=90, hz=660, sweep=1.3),
    ], peak=.72, drive=1.6, runtime='berserk-activate'),
    'hmh-upgrade-offer': reward(0xB1C006, [392, 587.33, 783.99], 'upgrade-offer', duration=560),
    'hmh-upgrade-pick': reward(0xB1C007, [587.33, 880, 1174.66], 'upgrade-pick', duration=540),
    'hmh-level-up': reward(0xB1C008, [523.25, 659.25, 783.99, 1046.5], 'level-up', duration=650),
    # Original throat-like oscillators, air and impact layers. No sampled voices.
    'hmh-enemy-death': cue(0xDEAD01, 650, [
        layer('growl', 1.2, 145, hz=105, sweep=.48, attack=5),
        layer('noise', .8, 22, low=1700), layer('noise', .28, 95, at=140, low=1100),
        layer('tone', .6, 48, hz=94, sweep=.65),
    ], peak=.73, drive=1.9, runtime='enemy-death'),
    'hmh-enemy-melee-tell': cue(0xDEAD02, 500, [
        layer('growl', 1.1, 110, hz=115, sweep=1.55, attack=14),
        layer('noise', .35, 85, low=2100, attack=24),
    ], peak=.67, drive=1.6, runtime='enemy-melee-tell'),
    'hmh-enemy-ranged-tell': cue(0xDEAD03, 260, [
        *metal(.8, 0, hz=1020, decay=25), *metal(.6, 105, hz=1740, decay=18),
        layer('noise', .5, 36, at=40, high=700, low=4200, attack=6),
    ], peak=.65, runtime='enemy-ranged-tell'),
    'hmh-boss-phase': cue(0xDEAD04, 900, [
        layer('growl', 1.3, 250, hz=64, sweep=.8, attack=28),
        layer('growl', .38, 185, at=45, hz=96, sweep=.7, attack=45),
        layer('noise', .45, 190, low=1600, attack=40), layer('tone', .6, 130, hz=56, sweep=.8),
    ], peak=.76, drive=2, runtime='boss-phase'),
    'hmh-boss-hit': cue(0xDEAD05, 230, [
        layer('growl', .8, 55, hz=82, sweep=.6, attack=2),
        *metal(.8, 0, hz=440, decay=26), layer('noise', .8, 17, low=2900),
    ], peak=.7, drive=1.8, runtime='boss-hit'),
    'hmh-boss-death': cue(0xDEAD06, 1450, [
        layer('growl', 1.2, 310, hz=77, sweep=.48, attack=8),
        layer('noise', .7, 160, at=260, low=1600),
        layer('tone', 1.2, 125, at=500, hz=58, sweep=.7),
        *metal(.5, 500, hz=340, decay=80), layer('noise', .5, 105, at=510, low=800),
    ], peak=.78, drive=2, runtime='boss-death'),
    'hmh-dash': cue(0xDA501, 280, [
        layer('noise', 1, 54, high=650, low=4300, attack=10),
        layer('tone', .24, 38, hz=125, sweep=.7),
    ], peak=.6, runtime='dash'),
    'hmh-footstep-dirt': cue(0xDA502, 140, [
        layer('noise', 1, 22, low=2100), layer('tone', .5, 20, hz=110, sweep=.75),
        layer('noise', .3, 18, at=35, high=1000, low=3500),
    ], peak=.58, runtime='footstep-dirt'),
    'hmh-footstep-road': cue(0xDA503, 130, [
        layer('tone', .8, 22, hz=158, sweep=.8), layer('noise', .8, 9, low=4800),
        *metal(.15, 25, hz=1200, decay=8),
    ], peak=.58, runtime='footstep-road'),
}


def render_cue(spec):
    total = round(SAMPLE_RATE * spec['durationMs'] / 1000)
    out = [0.0] * total
    rng = Rng(spec['seed'])
    for recipe in spec['layers']:
        start = round(recipe['startMs'] * SAMPLE_RATE / 1000)
        count = min(total - start, round(recipe['lengthMs'] * SAMPLE_RATE / 1000))
        phase = 0.0
        values = []
        for index in range(max(0, count)):
            ms = index * 1000 / SAMPLE_RATE
            progress = index / max(1, count - 1)
            hz = recipe['hz'] * recipe['sweep'] ** progress
            phase += 2 * math.pi * hz / SAMPLE_RATE
            if recipe['kind'] == 'noise':
                value = rng.next_unit()
            elif recipe['kind'] == 'tone':
                value = math.sin(phase)
            elif recipe['kind'] == 'metal':
                modes = [(1, 1), (1.47, .58), (2.11, .39), (2.89, .22), (4.17, .12)]
                value = sum(math.sin(phase * ratio) * gain for ratio, gain in modes
                            if hz * ratio < SAMPLE_RATE * .45) / 2.31
            elif recipe['kind'] == 'growl':
                # Harmonic throat excitation with two broad formants and a
                # rough subharmonic. Frequency changes preserve the vowel body.
                value = sum(math.sin(phase * harmonic) * (
                    .12 / harmonic + .22 * math.exp(-((hz * harmonic - 460) / 260) ** 2)
                    + .12 * math.exp(-((hz * harmonic - 1150) / 370) ** 2))
                    for harmonic in range(1, 21))
                value = value * (.76 + .24 * math.sin(phase * .37)) + .16 * math.sin(phase * .5)
            else:
                raise ValueError(f"unknown kind {recipe['kind']}")
            attack = min(1, ms / max(.01, recipe['attackMs']))
            decay = math.exp(-max(0, ms - recipe['attackMs']) / recipe['decayMs'])
            # Fade interior layers as well as the file boundary.
            release = min(1, (count - 1 - index) / max(1, SAMPLE_RATE * .004))
            values.append(value * attack * decay * release)
        values = lowpass(values, recipe['lowpassHz'])
        if recipe['highpassHz']:
            bass = lowpass(values, recipe['highpassHz'])
            values = [value - low for value, low in zip(values, bass)]
        for index, value in enumerate(values):
            out[start + index] += value * recipe['gain']
    out = [math.tanh(value * spec['drive']) for value in out]
    # Saturation creates upper harmonics after the layer filters. Restrict
    # those before normalization to retain intersample reconstruction margin.
    out = lowpass(lowpass(out, 9000), 9000)
    # Reject DC before peak normalization; overlapping pressure bursts stay
    # centered on zero. Keep margin for browser reconstruction overshoot.
    dc = lowpass(out, 25)
    out = [value - low for value, low in zip(out, dc)]
    peak = max(map(abs, out), default=0)
    scale = min(spec['peak'], PEAK_CEILING) / peak if peak else 1
    for index in range(total):
        fade = min(1, index / max(1, SAMPLE_RATE * .0002),
                   (total - 1 - index) / max(1, SAMPLE_RATE * .008))
        out[index] *= scale * fade
    return out


def wav_bytes(samples):
    # Explicit little endian also works on a big-endian authoring host.
    data = struct.pack(f'<{len(samples)}h', *(int(max(-1, min(1, x)) * 32767) for x in samples))
    return (b'RIFF' + struct.pack('<I', 36 + len(data)) + b'WAVEfmt '
            + struct.pack('<IHHIIHH', 16, 1, 1, SAMPLE_RATE, SAMPLE_RATE * 2, 2, 16)
            + b'data' + struct.pack('<I', len(data)) + data)


def pcm_metrics(payload):
    values = [value / 32768 for (value,) in struct.iter_unpack('<h', payload[44:])]
    rms = math.sqrt(sum(x*x for x in values) / len(values))
    peak = max(map(abs, values))
    return dict(peak=round(peak, 6), rms=round(rms, 6), dcMean=round(sum(values) / len(values), 6),
                crestDb=round(20 * math.log10(peak / rms), 3),
                clippedSamples=sum(abs(x) >= .999 for x in values))


def build(verify):
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    cues = {}
    for cue_id, spec in sorted(CUES.items()):
        payload = wav_bytes(render_cue(spec))
        if verify and payload != wav_bytes(render_cue(spec)):
            raise SystemExit(f'{cue_id}: repeated renders differ')
        (OUT_DIR / f'{cue_id}.wav').write_bytes(payload)
        cues[cue_id] = dict(src=f'./assets/audio/sfx/{cue_id}.wav', bytes=len(payload),
                            format='wav', durationMs=spec['durationMs'], sha256=hashlib.sha256(payload).hexdigest(),
                            runtimeCue=spec.get('runtimeCue', cue_id), synth=spec, pcm=pcm_metrics(payload))
    manifest = dict(pipelineId=PIPELINE_ID, license='synthesised-in-repo', runtimeAuthority='projection-only',
                    sampleRate=SAMPLE_RATE, channels=1, bitDepth=16, peakCeiling=PEAK_CEILING,
                    notes='Original layered action sounds. No external recordings. Regenerate with npm run assets:hmh:weapon-sfx.',
                    cues=cues, reproducibleVerified=verify)
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8', newline='\n')
    return manifest


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify-reproducible', action='store_true')
    args = parser.parse_args()
    manifest = build(args.verify_reproducible)
    print(json.dumps(dict(status='pass', pipelineId=PIPELINE_ID, cueCount=len(manifest['cues']),
                          totalBytes=sum(cue['bytes'] for cue in manifest['cues'].values()),
                          reproducibleVerified=args.verify_reproducible), sort_keys=True))


if __name__ == '__main__':
    main()
