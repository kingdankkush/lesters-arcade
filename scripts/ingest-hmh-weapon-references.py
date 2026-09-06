"""Preserve the eleven owner weapon/grenade sheets; no runtime IDs or model approval."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import shutil
import struct

REFERENCES = {
    'sci-fi-grenade': 'Sci-Fi Grenade Turnaround Sheet.png',
    'spiked-steampunk-grenade': 'Spiked Steampunk Grenade Turntable Sheet.png',
    'weathered-military-grenade': 'Weathered Military Grenade Turnaround Views.png',
    'rugged-rifle': 'Rugged Rifle Concept Showcase.png',
    'sci-fi-grenade-launcher': 'Sci-Fi Grenade Launcher Model Sheet.png',
    'rugged-survival-knife': 'Rugged Survival Knife Reference Sheet.png',
    'steampunk-raygun': 'Steampunk Raygun Six-View Asset Sheet.png',
    'rugged-shotgun': 'Rugged Post-Apocalyptic Shotgun Showcase.png',
    'worn-heavy-machine-gun': 'Worn Heavy Machine Gun Reference Sheet.png',
    'weathered-smg': 'Weathered Post-Apocalyptic SMG Concept Sheet.png',
    'rugged-handgun': 'Rugged Futuristic Handgun Turnaround Sheet.png',
}

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--input-directory', required=True)
    args = parser.parse_args()
    source = Path(args.input_directory).resolve()
    root = Path(__file__).resolve().parents[1]
    base = Path('apps/hmh-reboot/assets/source/reference/weapons')
    assets, copies = [], []
    for asset_id, filename in REFERENCES.items():
        src = source / filename
        data = src.read_bytes()
        if len(data) < 24 or data[:8] != b'\x89PNG\r\n\x1a\n':
            raise ValueError(f'Not a PNG: {filename}')
        dimensions = list(struct.unpack('>II', data[16:24]))
        if not all(0 < edge <= 2048 for edge in dimensions):
            raise ValueError(f'Reference exceeds 2048px: {filename}')
        relative = base / asset_id / 'sheet.png'
        target = root / relative
        if target.exists() and target.read_bytes() != data:
            raise ValueError(f'Refusing to overwrite a different reference: {target}')
        copies.append((src, target))
        assets.append({'assetId': asset_id, 'runtimeId': None, 'modelStatus': 'not-generated',
                       'image': {'path': relative.as_posix(), 'originalFilename': filename,
                                 'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data),
                                 'dimensions': dimensions}})
    for src, target in copies:
        target.parent.mkdir(parents=True, exist_ok=True)
        shutil.copyfile(src, target)
        if hashlib.sha256(src.read_bytes()).digest() != hashlib.sha256(target.read_bytes()).digest():
            raise ValueError(f'Copy verification failed: {target}')
    ledger = {'schema': 'hmh-weapon-reference-intake-v1',
              'authority': 'owner-supplied-design-reference', 'runtimeAuthority': 'none',
              'provenance': 'Eleven original owner attachments. Source-only design references. Model jobs and runtime bindings are separate records; this intake does not upload files.',
              'assets': assets}
    output = root / base / 'references.json'
    output.write_text(json.dumps(ledger, indent=2) + '\n', encoding='utf-8', newline='\n')
    print(json.dumps({'status': 'verified', 'images': len(copies), 'manifest': str(output)}))

if __name__ == '__main__':
    main()
