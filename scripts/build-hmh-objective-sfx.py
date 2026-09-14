"""Original additive reward cues. No external samples or random input."""
from pathlib import Path
import hashlib
import json
import math
import struct
import wave

ROOT = Path(__file__).resolve().parents[1]
OUT = ROOT / 'apps/portal/assets/audio/sfx'
RATE = 22050
SPECS = {
    'silver-collect': (0.19, [(0.0, 1568, 1.0), (0.0, 2592, 0.23), (0.035, 2093, 0.32)]),
    'objective-complete': (0.66, [(0.0, 392, 0.65), (0.12, 587, 0.75), (0.24, 784, 1.0)]),
    'supply-ready': (0.34, [(0.0, 659, 0.8), (0.10, 988, 1.0)]),
}

def render(duration, notes):
    count = round(RATE * duration)
    samples = []
    for i in range(count):
        t = i / RATE
        value = 0.0
        for delay, frequency, gain in notes:
            age = t - delay
            if age < 0:
                continue
            envelope = min(1.0, age / .004) * math.exp(-age * 14)
            value += gain * envelope * (math.sin(math.tau * frequency * age) + .15 * math.sin(math.tau * frequency * 2 * age))
        value *= min(1.0, (count - 1 - i) / (RATE * .035))
        samples.append(value)
    peak = max(map(abs, samples))
    pcm = [round(v / peak * .38 * 32767) for v in samples]
    pcm[0] = pcm[-1] = 0
    return pcm

def main():
    OUT.mkdir(parents=True, exist_ok=True)
    rows = []
    for cue, (duration, notes) in SPECS.items():
        pcm = render(duration, notes)
        name = f'hmh-{cue}.wav'
        with wave.open(str(OUT / name), 'wb') as audio:
            audio.setparams((1, 2, RATE, 0, 'NONE', 'not compressed'))
            audio.writeframes(struct.pack('<' + 'h' * len(pcm), *pcm))
        rows.append({'cue': cue, 'file': name, 'durationSeconds': len(pcm)/RATE,
                     'peak': max(map(abs, pcm))/32767,
                     'sha256': hashlib.sha256((OUT/name).read_bytes()).hexdigest()})
    manifest = {'schema': 'hmh-original-objective-audio-v1', 'provenance': 'Original additive synthesis; no external samples',
                'recipe': Path(__file__).relative_to(ROOT).as_posix(),
                'recipeSha256': hashlib.sha256(Path(__file__).read_bytes()).hexdigest(), 'cues': rows}
    (OUT / 'hmh-objective-cues.json').write_text(json.dumps(manifest, indent=2)+'\n', encoding='utf-8')

if __name__ == '__main__':
    main()
