"""Copy the owner's eight hero design references without altering image bytes."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct

REFERENCES = {
    'lit-commando': ('LitCommando-HMH-CharacterReference-01.png', 'LitCommando-HMH-CharacterReference-02.png'),
    'lit-valkyrie': ('LitValkyrie-HMH-CharacterReference-01.png', 'LitValkyrie-HMH-CharacterReference-02.png'),
    'lester-original': ('Lester-HMH-CharacterReference.png', 'Lester-HMH-CharacterReference-02.png'),
    'lilly': ('Lilly-HMH-CharacterReference.png', 'Lilly-HMH-CharacterReference-02.png'),
}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-directory', required=True)
    args = parser.parse_args()
    source = Path(args.input_directory).resolve()
    root = Path(__file__).resolve().parents[1]
    base = Path('apps/hmh-reboot/assets/source/reference/heroes')
    heroes = []
    copies = []
    for actor_id, filenames in REFERENCES.items():
        hero = {'actorId': actor_id, 'images': {}}
        for role, filename in zip(('front', 'turnaround'), filenames):
            data = (source / filename).read_bytes()
            if data[:8] != b'\x89PNG\r\n\x1a\n':
                raise ValueError(f'Not a PNG: {filename}')
            dimensions = list(struct.unpack('>II', data[16:24]))
            if not all(0 < edge <= 2048 for edge in dimensions):
                raise ValueError(f'Reference image exceeds 2048px: {filename}')
            relative = base / actor_id / f'{role}.png'
            target = root / relative
            if target.exists() and target.read_bytes() != data:
                raise ValueError(f'Refusing to overwrite a different design reference: {target}')
            copies.append((source / filename, target))
            hero['images'][role] = {'path': relative.as_posix(), 'originalFilename': filename,
                                    'sha256': hashlib.sha256(data).hexdigest(),
                                    'bytes': len(data), 'dimensions': dimensions}
        heroes.append(hero)
    for src, target in copies:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, target)
        if hashlib.sha256(src.read_bytes()).digest() != hashlib.sha256(target.read_bytes()).digest():
            raise ValueError(f'Copy verification failed: {target}')
    manifest = {'schema': 'hmh-hero-reference-intake-v1',
                'authority': 'owner-supplied-design-reference', 'runtimeAuthority': 'none',
                'provenance': 'Eight original PNG attachments supplied by Justin Pinter for the September 2026 visual upgrade. Source-only design references, not runtime art. No external service upload.',
                'heroes': heroes}
    target = root / base / 'references.json'
    target.write_text(json.dumps(manifest, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'verified', 'heroes': len(heroes), 'images': len(copies), 'manifest': str(target)}))

if __name__ == '__main__':
    main()
