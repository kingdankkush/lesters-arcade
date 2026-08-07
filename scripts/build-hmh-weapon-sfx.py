"""Synthesise per-weapon combat SFX deterministically.

Every weapon shared one hand-sourced weapon-fire.ogg, so a pistol, a shotgun,
a minigun and a grenade launcher were audibly the same gun. The existing SFX
are CC0 packs, which cannot be regenerated from repo-owned source and so sit
outside the determinism rule the Blender pipelines follow. These are
synthesised instead: pure-Python DSP with a fixed integer PRNG rendered
straight to WAV, verified by rendering twice and comparing hashes.

Output is WAV rather than OGG on purpose. libvorbis is not byte-reproducible
here -- re-encoding the SAME input file twice produces different bytes, because
an Ogg stream carries a serial number that `-fflags +bitexact` did not pin in
this ffmpeg build. Hashing decoded PCM instead would leave the shipped files
churning on every regeneration and break the byte-ledger discipline the asset
pipelines rely on. These cues are short and mono, so WAV costs little, removes
the external encoder dependency, and is byte-exact.

No numpy, no scipy, no soundfile -- none are available in this environment and
adding them would put the render behind an install step.

    python scripts/build-hmh-weapon-sfx.py [--verify-reproducible]
"""
from __future__ import annotations

import argparse
import hashlib
import json
import math
import struct
from array import array
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
OUT_DIR = ROOT / 'apps/portal/assets/audio/sfx'
MANIFEST_PATH = OUT_DIR / 'hmh-weapon-sfx-manifest.json'
PIPELINE_ID = 'hmh-weapon-sfx-v1'
# 22.05 kHz: every cue is lowpassed at or below 7.6 kHz, so the extra
# bandwidth of 44.1 would double the bytes for nothing audible.
SAMPLE_RATE = 22_050
# Hard ceiling on authored peak; see the note in render_cue about resampling
# overshoot in the browser.
PEAK_CEILING = 0.78


class Rng:
    """xorshift32. Deterministic across platforms and Python versions -- the
    stdlib `random` module makes no such guarantee across releases."""

    __slots__ = ('state',)

    def __init__(self, seed: int) -> None:
        self.state = seed & 0xFFFFFFFF or 0x1A2B3C4D

    def next_unit(self) -> float:
        x = self.state
        x ^= (x << 13) & 0xFFFFFFFF
        x ^= x >> 17
        x ^= (x << 5) & 0xFFFFFFFF
        self.state = x & 0xFFFFFFFF
        return (self.state / 0xFFFFFFFF) * 2.0 - 1.0


def envelope(index: int, total: int, attack: float, decay: float, curve: float) -> float:
    """Percussive AD envelope. attack/decay are fractions of the total length."""
    position = index / max(1, total - 1)
    if position < attack:
        return (position / attack) if attack > 0 else 1.0
    tail = (position - attack) / max(1e-6, decay)
    if tail >= 1.0:
        return 0.0
    return (1.0 - tail) ** curve


def one_pole_lowpass(samples: list[float], cutoff_hz: float) -> list[float]:
    """Single-pole IIR. Cheap, and enough to separate a dull thump from a
    bright crack, which is the distinction that matters here."""
    dt = 1.0 / SAMPLE_RATE
    rc = 1.0 / (2.0 * math.pi * max(1.0, cutoff_hz))
    alpha = dt / (rc + dt)
    out = []
    previous = 0.0
    for value in samples:
        previous += alpha * (value - previous)
        out.append(previous)
    return out


def render_cue(spec: dict) -> list[float]:
    total = int(SAMPLE_RATE * spec['durationMs'] / 1000.0)
    rng = Rng(spec['seed'])
    out = [0.0] * total

    for layer in spec['layers']:
        kind = layer['kind']
        gain = layer['gain']
        start = int(total * layer.get('start', 0.0))
        length = max(1, int(total * layer.get('length', 1.0)))
        phase = 0.0
        for step in range(length):
            index = start + step
            if index >= total:
                break
            env = envelope(step, length, layer.get('attack', 0.004), layer.get('decay', 0.9), layer.get('curve', 2.2))
            if env <= 0.0:
                continue
            if kind == 'noise':
                value = rng.next_unit()
            elif kind == 'tone':
                progress = step / max(1, length - 1)
                freq = layer['freq'] * (layer.get('sweep', 1.0) ** progress)
                phase += 2.0 * math.pi * freq / SAMPLE_RATE
                value = math.sin(phase)
            elif kind == 'square':
                progress = step / max(1, length - 1)
                freq = layer['freq'] * (layer.get('sweep', 1.0) ** progress)
                phase += 2.0 * math.pi * freq / SAMPLE_RATE
                value = 1.0 if math.sin(phase) >= 0 else -1.0
            else:
                raise SystemExit(f'unknown layer kind {kind}')
            out[index] += value * env * gain

    if spec.get('lowpassHz'):
        out = one_pole_lowpass(out, spec['lowpassHz'])

    # Soft clip, then normalise to a fixed peak so cue loudness is authored by
    # the mix rather than by whatever the synth happened to produce.
    #
    # Peaks stay well under 1.0 on purpose. A browser resamples 22.05 kHz to
    # its device rate (48 kHz here), and reconstruction overshoots between
    # samples: a cue normalised to 0.92 decoded at 1.082 and clipped. The
    # ceiling below leaves room for that overshoot.
    out = [math.tanh(value * spec.get('drive', 1.0)) for value in out]
    peak = max((abs(value) for value in out), default=0.0)
    if peak > 0:
        target = min(spec.get('peak', 0.78), PEAK_CEILING)
        out = [value * (target / peak) for value in out]

    # Short fade-out so no cue ends on a discontinuity (an audible click).
    fade = min(len(out), int(SAMPLE_RATE * 0.006))
    for step in range(fade):
        out[len(out) - 1 - step] *= step / max(1, fade)
    return out


def write_wav(path: Path, samples: list[float]) -> None:
    pcm = array('h', (int(max(-1.0, min(1.0, value)) * 32_767) for value in samples))
    if pcm.itemsize != 2:
        raise SystemExit('unexpected array item size')
    payload = pcm.tobytes()
    header = b'RIFF' + struct.pack('<I', 36 + len(payload)) + b'WAVEfmt '
    header += struct.pack('<IHHIIHH', 16, 1, 1, SAMPLE_RATE, SAMPLE_RATE * 2, 2, 16)
    header += b'data' + struct.pack('<I', len(payload))
    path.write_bytes(header + payload)


def encode_ogg(wav_path: Path, ogg_path: Path) -> None:
    # -map_metadata -1 and the bitexact flags strip the encoder/version tags
    # ffmpeg would otherwise embed, which is what makes the output stable
    # enough to hash.
    command = [
        'ffmpeg', '-y', '-loglevel', 'error',
        '-fflags', '+bitexact', '-flags:a', '+bitexact',
        '-i', str(wav_path),
        '-map_metadata', '-1',
        '-c:a', 'libvorbis', '-qscale:a', '4',
        str(ogg_path),
    ]
    completed = subprocess.run(command, capture_output=True, text=True)
    if completed.returncode != 0:
        raise SystemExit(f'ffmpeg failed for {ogg_path.name}:\n{completed.stderr}')


# --- cue definitions ------------------------------------------------------
# Each gun gets a distinct spectral identity rather than a volume tweak:
#   coin-blaster   bright, short, tight  -- a light sidearm crack
#   scatter-shotgun broadband, long tail -- a heavy boom plus shell rattle
#   auto-miner      buzzy, mechanical    -- a fast industrial chatter
#   launcher-rig    low, swept, hollow   -- a thump with a departing whoosh
CUES = {
    'hmh-fire-coin-blaster': {
        'seed': 0x0C01B1A5, 'durationMs': 150, 'lowpassHz': 7_600, 'drive': 1.5, 'peak': 0.70,
        'layers': [
            {'kind': 'noise', 'gain': 0.85, 'attack': 0.002, 'decay': 0.30, 'curve': 3.0},
            {'kind': 'tone', 'gain': 0.55, 'freq': 880, 'sweep': 0.34, 'attack': 0.001, 'decay': 0.22, 'curve': 3.4},
            {'kind': 'tone', 'gain': 0.20, 'freq': 2_100, 'sweep': 0.5, 'attack': 0.001, 'decay': 0.10, 'curve': 4.0},
        ],
    },
    'hmh-fire-scatter-shotgun': {
        'seed': 0x5C471234, 'durationMs': 420, 'lowpassHz': 4_200, 'drive': 2.1, 'peak': 0.76,
        'layers': [
            {'kind': 'noise', 'gain': 1.0, 'attack': 0.003, 'decay': 0.85, 'curve': 1.7},
            {'kind': 'tone', 'gain': 0.70, 'freq': 190, 'sweep': 0.42, 'attack': 0.002, 'decay': 0.55, 'curve': 2.0},
            # Shell rattle: a late, quiet, bright burst.
            {'kind': 'noise', 'gain': 0.22, 'start': 0.55, 'length': 0.45, 'attack': 0.05, 'decay': 0.9, 'curve': 2.6},
        ],
    },
    'hmh-fire-auto-miner': {
        'seed': 0x0A471111, 'durationMs': 110, 'lowpassHz': 6_200, 'drive': 2.6, 'peak': 0.66,
        'layers': [
            {'kind': 'square', 'gain': 0.55, 'freq': 320, 'sweep': 0.7, 'attack': 0.002, 'decay': 0.42, 'curve': 2.4},
            {'kind': 'noise', 'gain': 0.60, 'attack': 0.001, 'decay': 0.35, 'curve': 3.2},
            {'kind': 'tone', 'gain': 0.30, 'freq': 1_450, 'sweep': 0.6, 'attack': 0.001, 'decay': 0.18, 'curve': 3.6},
        ],
    },
    'hmh-fire-launcher-rig': {
        'seed': 0x1A0C4E12, 'durationMs': 520, 'lowpassHz': 2_400, 'drive': 1.8, 'peak': 0.78,
        'layers': [
            {'kind': 'tone', 'gain': 1.0, 'freq': 132, 'sweep': 0.36, 'attack': 0.004, 'decay': 0.70, 'curve': 1.8},
            {'kind': 'noise', 'gain': 0.55, 'attack': 0.004, 'decay': 0.55, 'curve': 2.0},
            # Departing whoosh.
            {'kind': 'noise', 'gain': 0.30, 'start': 0.30, 'length': 0.70, 'attack': 0.22, 'decay': 0.95, 'curve': 1.5},
        ],
    },
    'hmh-fire-hash-rail': {
        'seed': 0x8A571A11, 'durationMs': 460, 'lowpassHz': 7_200, 'drive': 1.7, 'peak': 0.72,
        'layers': [
            {'kind': 'tone', 'gain': 0.38, 'freq': 110, 'sweep': 5.8, 'length': 0.42, 'attack': 0.08, 'decay': 0.94, 'curve': 1.2},
            {'kind': 'square', 'gain': 0.44, 'freq': 440, 'sweep': 3.0, 'start': 0.28, 'length': 0.38, 'attack': 0.02, 'decay': 0.80, 'curve': 2.0},
            {'kind': 'noise', 'gain': 0.78, 'start': 0.38, 'length': 0.34, 'attack': 0.002, 'decay': 0.72, 'curve': 3.0},
        ],
    },
    'hmh-fire-lightning-ledger': {
        'seed': 0x11E6E220, 'durationMs': 130, 'lowpassHz': 7_600, 'drive': 1.55, 'peak': 0.58,
        'layers': [
            {'kind': 'square', 'gain': 0.36, 'freq': 760, 'sweep': 2.8, 'length': 0.72, 'attack': 0.002, 'decay': 0.82, 'curve': 2.0},
            {'kind': 'tone', 'gain': 0.48, 'freq': 2_200, 'sweep': 0.42, 'length': 0.54, 'attack': 0.001, 'decay': 0.72, 'curve': 2.7},
            {'kind': 'noise', 'gain': 0.42, 'start': 0.08, 'length': 0.66, 'attack': 0.002, 'decay': 0.78, 'curve': 3.0},
        ],
    },
    'hmh-fire-bear-market-burner': {
        'seed': 0xBEA4F11E, 'durationMs': 170, 'lowpassHz': 3_800, 'drive': 1.72, 'peak': 0.62,
        'layers': [
            {'kind': 'noise', 'gain': 0.72, 'length': 0.98, 'attack': 0.025, 'decay': 0.92, 'curve': 1.25},
            {'kind': 'tone', 'gain': 0.34, 'freq': 96, 'sweep': 1.8, 'length': 0.94, 'attack': 0.018, 'decay': 0.90, 'curve': 1.1},
            {'kind': 'square', 'gain': 0.18, 'freq': 220, 'sweep': 0.62, 'start': 0.08, 'length': 0.72, 'attack': 0.012, 'decay': 0.84, 'curve': 1.5},
        ],
    },
    'hmh-lightning-interrupt': {
        'seed': 0x11E6E221, 'durationMs': 180, 'lowpassHz': 5_800, 'drive': 1.35, 'peak': 0.52,
        'layers': [
            {'kind': 'square', 'gain': 0.34, 'freq': 980, 'sweep': 0.22, 'attack': 0.001, 'decay': 0.62, 'curve': 2.4},
            {'kind': 'noise', 'gain': 0.38, 'attack': 0.001, 'decay': 0.45, 'curve': 3.2},
        ],
    },
    'hmh-lightning-overheat': {
        'seed': 0x11E6E222, 'durationMs': 480, 'lowpassHz': 4_800, 'drive': 1.65, 'peak': 0.66,
        'layers': [
            {'kind': 'square', 'gain': 0.46, 'freq': 1_520, 'sweep': 0.14, 'attack': 0.002, 'decay': 0.78, 'curve': 1.8},
            {'kind': 'tone', 'gain': 0.52, 'freq': 380, 'sweep': 0.28, 'start': 0.20, 'length': 0.80, 'attack': 0.01, 'decay': 0.90, 'curve': 1.5},
            {'kind': 'noise', 'gain': 0.44, 'start': 0.12, 'length': 0.70, 'attack': 0.002, 'decay': 0.72, 'curve': 2.1},
        ],
    },
    'hmh-lightning-empty': {
        'seed': 0x11E6E223, 'durationMs': 210, 'lowpassHz': 6_400, 'drive': 1.3, 'peak': 0.50,
        'layers': [
            {'kind': 'tone', 'gain': 0.46, 'freq': 1_180, 'sweep': 0.30, 'attack': 0.001, 'decay': 0.55, 'curve': 3.0},
            {'kind': 'noise', 'gain': 0.28, 'start': 0.34, 'length': 0.42, 'attack': 0.003, 'decay': 0.80, 'curve': 3.6},
        ],
    },
    'hmh-hash-rail-charge': {
        'seed': 0xC4A26311, 'durationMs': 920, 'lowpassHz': 6_800, 'drive': 1.25, 'peak': 0.46,
        'layers': [
            {'kind': 'tone', 'gain': 0.34, 'freq': 82, 'sweep': 8.0, 'length': 0.98, 'attack': 0.18, 'decay': 0.9, 'curve': 0.8},
            {'kind': 'square', 'gain': 0.18, 'freq': 330, 'sweep': 2.7, 'start': 0.36, 'length': 0.6, 'attack': 0.08, 'decay': 0.82, 'curve': 1.4},
        ],
    },
    'hmh-weapon-reload': {
        'seed': 0x2E10AD77, 'durationMs': 320, 'lowpassHz': 5_400, 'drive': 1.4, 'peak': 0.58,
        'layers': [
            {'kind': 'noise', 'gain': 0.55, 'length': 0.16, 'attack': 0.004, 'decay': 0.9, 'curve': 3.0},
            {'kind': 'tone', 'gain': 0.40, 'freq': 420, 'sweep': 0.8, 'length': 0.16, 'attack': 0.002, 'decay': 0.8, 'curve': 3.2},
            # Magazine seating: the second, firmer clack.
            {'kind': 'noise', 'gain': 0.65, 'start': 0.52, 'length': 0.30, 'attack': 0.004, 'decay': 0.85, 'curve': 2.6},
            {'kind': 'tone', 'gain': 0.45, 'freq': 260, 'sweep': 0.7, 'start': 0.52, 'length': 0.30, 'attack': 0.003, 'decay': 0.8, 'curve': 2.8},
        ],
    },
    'hmh-weapon-empty': {
        'seed': 0x3D2C0000, 'durationMs': 90, 'lowpassHz': 6_800, 'drive': 1.2, 'peak': 0.46,
        'layers': [
            {'kind': 'noise', 'gain': 0.60, 'attack': 0.001, 'decay': 0.22, 'curve': 4.2},
            {'kind': 'tone', 'gain': 0.35, 'freq': 1_100, 'sweep': 0.55, 'attack': 0.001, 'decay': 0.14, 'curve': 4.5},
        ],
    },
}


def build(verify: bool) -> dict:
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    tmp_dir = ROOT / '.tmp/hmh-weapon-sfx'
    tmp_dir.mkdir(parents=True, exist_ok=True)
    cues = {}
    for cue_id, spec in sorted(CUES.items()):
        samples = render_cue(spec)
        wav_path = OUT_DIR / f'{cue_id}.wav'
        write_wav(wav_path, samples)
        payload = wav_path.read_bytes()
        cues[cue_id] = {
            'src': f'./assets/audio/sfx/{cue_id}.wav',
            'bytes': len(payload),
            'format': 'wav',
            'durationMs': spec['durationMs'],
            'sha256': hashlib.sha256(payload).hexdigest(),
            'synth': {
                'seed': spec['seed'],
                'lowpassHz': spec.get('lowpassHz'),
                'drive': spec.get('drive', 1.0),
                'peak': spec.get('peak', 0.86),
                'layers': len(spec['layers']),
            },
        }

    manifest = {
        'pipelineId': PIPELINE_ID,
        'license': 'synthesised-in-repo',
        'runtimeAuthority': 'projection-only',
        'sampleRate': SAMPLE_RATE,
        'channels': 1,
        'bitDepth': 16,
        'notes': (
            'Rendered by scripts/build-hmh-weapon-sfx.py from pure-Python DSP with a '
            'fixed xorshift32 PRNG. Regenerate with npm run assets:hmh:weapon-sfx.'
        ),
        'cues': cues,
    }
    MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8', newline='\n')

    if verify:
        for cue_id, spec in sorted(CUES.items()):
            samples = render_cue(spec)
            wav_path = tmp_dir / f'{cue_id}.verify.wav'
            write_wav(wav_path, samples)
            again = hashlib.sha256(wav_path.read_bytes()).hexdigest()
            if again != cues[cue_id]['sha256']:
                raise SystemExit(f'{cue_id} is not reproducible: {cues[cue_id]["sha256"]} != {again}')
        manifest['reproducibleVerified'] = True
        MANIFEST_PATH.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8', newline='\n')

    return manifest


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--verify-reproducible', action='store_true')
    args = parser.parse_args()
    manifest = build(args.verify_reproducible)
    print(json.dumps({
        'status': 'pass',
        'pipelineId': PIPELINE_ID,
        'cueCount': len(manifest['cues']),
        'totalBytes': sum(cue['bytes'] for cue in manifest['cues'].values()),
        'reproducibleVerified': manifest.get('reproducibleVerified', False),
    }, sort_keys=True))


if __name__ == '__main__':
    main()
