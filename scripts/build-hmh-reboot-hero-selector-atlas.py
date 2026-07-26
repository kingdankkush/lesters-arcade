#!/usr/bin/env python3
from __future__ import annotations

import argparse
import hashlib
import io
import json
from pathlib import Path

from PIL import Image

DIRECTIONS = ['east', 'north-east', 'north', 'north-west', 'west', 'south-west', 'south', 'south-east']
LAYERS = [('shadow', 'idle'), ('lower-body', 'idle'), ('torso-head', 'aim'), ('weapon', 'aim')]
HEROES = {
    'lit-commando': 'lit-commando',
    'lit-valkyrie': 'lit-valkyrie',
    'lester': 'lester-original',
    'lilly': 'lilly',
}
FRAME_SIZE = 160
PIPELINE_ID = 'hmh-reboot-hero-selector-atlas-v1'


def sha256_bytes(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def sha256_path(path: Path) -> str:
    return sha256_bytes(path.read_bytes())


def png_bytes(image: Image.Image) -> bytes:
    stream = io.BytesIO()
    image.save(stream, format='PNG', optimize=False, compress_level=9)
    return stream.getvalue()


def build(repo_root: Path) -> tuple[bytes, bytes, bytes]:
    source_root = repo_root / 'apps/portal/assets/generated/hmh-reboot-production-heroes'
    output_url = '/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.png'
    atlas = Image.new('RGBA', (FRAME_SIZE * len(DIRECTIONS), FRAME_SIZE * len(HEROES)), (0, 0, 0, 0))
    heroes = {}
    records = []
    sources = []

    for row, (portal_id, actor_id) in enumerate(HEROES.items()):
        actor_root = source_root / actor_id
        metadata_path = actor_root / f'{actor_id}-production-pilot-atlas.json'
        image_path = actor_root / f'{actor_id}-production-pilot-atlas.png'
        metadata = json.loads(metadata_path.read_text(encoding='utf-8'))
        if metadata.get('actorId') != actor_id or metadata.get('classification') != 'production-art':
            raise ValueError(f'{actor_id}: invalid production identity')
        if metadata.get('runtimeAuthority') != 'projection-only':
            raise ValueError(f'{actor_id}: selector art must remain projection-only')
        if metadata.get('gameplayBodyProfile') != 'human-medium-collision-v1':
            raise ValueError(f'{actor_id}: gameplay body drift')
        by_key = {
            (frame['layer'], frame['state'], frame['direction'], frame['frameIndex']): frame
            for frame in metadata['frames']
        }
        source_atlas = Image.open(image_path).convert('RGBA')
        frame_refs = []
        for column, direction in enumerate(DIRECTIONS):
            composed = Image.new('RGBA', (FRAME_SIZE, FRAME_SIZE), (0, 0, 0, 0))
            source_ids = []
            for layer, state in LAYERS:
                frame = by_key[(layer, state, direction, 0)]
                source_ids.append(frame['id'])
                rect = frame['frame']
                destination = frame['spriteSourceSize']
                crop = source_atlas.crop((rect['x'], rect['y'], rect['x'] + rect['w'], rect['y'] + rect['h']))
                composed.alpha_composite(crop, (destination['x'], destination['y']))
            alpha = composed.getchannel('A')
            opaque_pixels = sum(1 for value in alpha.get_flattened_data() if value > 0)
            if opaque_pixels <= 0 or alpha.getbbox() is None:
                raise ValueError(f'{actor_id}/{direction}: blank composite')
            x = column * FRAME_SIZE
            y = row * FRAME_SIZE
            atlas.alpha_composite(composed, (x, y))
            frame_ref = f'{output_url}#frame={x},{y},{FRAME_SIZE},{FRAME_SIZE},{atlas.width},{atlas.height}'
            frame_refs.append(frame_ref)
            records.append({
                'portalHeroId': portal_id,
                'actorId': actor_id,
                'direction': direction,
                'frame': {'x': x, 'y': y, 'w': FRAME_SIZE, 'h': FRAME_SIZE},
                'opaquePixels': opaque_pixels,
                'sourceFrames': source_ids,
                'pixelSha256': sha256_bytes(composed.tobytes()),
            })
        heroes[portal_id] = {
            'actorId': actor_id,
            'frames': frame_refs,
            'frameDurationMs': 260,
        }
        sources.append({
            'actorId': actor_id,
            'metadata': str(metadata_path.relative_to(repo_root)).replace('\\', '/'),
            'metadataSha256': sha256_path(metadata_path),
            'image': str(image_path.relative_to(repo_root)).replace('\\', '/'),
            'imageSha256': sha256_path(image_path),
        })

    image_data = png_bytes(atlas)
    manifest = {
        'schemaVersion': 1,
        'pipelineId': PIPELINE_ID,
        'classification': 'production-art',
        'runtimeAuthority': 'projection-only',
        'gameplayAuthority': 'none',
        'image': output_url,
        'imageBytes': len(image_data),
        'imageSha256': sha256_bytes(image_data),
        'atlasSize': {'width': atlas.width, 'height': atlas.height},
        'frameSize': FRAME_SIZE,
        'frameCount': len(records),
        'directions': DIRECTIONS,
        'heroes': heroes,
        'frames': records,
        'sources': sources,
    }
    json_data = (json.dumps(manifest, indent=2) + '\n').encode('utf-8')
    module_json = json.dumps({key: manifest[key] for key in ['schemaVersion', 'pipelineId', 'classification', 'runtimeAuthority', 'gameplayAuthority', 'image', 'imageBytes', 'imageSha256', 'atlasSize', 'frameSize', 'frameCount', 'directions', 'heroes']}, separators=(',', ':'))
    module_data = (
        'function freezeDeep(value) {\n'
        '  if (!value || typeof value !== \'object\' || Object.isFrozen(value)) return value;\n'
        '  for (const child of Object.values(value)) freezeDeep(child);\n'
        '  return Object.freeze(value);\n'
        '}\n\n'
        f'export const HMH_REBOOT_HERO_SELECTOR_ATLAS = freezeDeep({module_json});\n'
    ).encode('utf-8')
    return image_data, json_data, module_data


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument('--check', action='store_true')
    args = parser.parse_args()
    repo_root = Path(__file__).resolve().parents[1]
    outputs = [
        repo_root / 'apps/portal/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.png',
        repo_root / 'apps/portal/assets/generated/hmh-reboot-hero-selector/hmh-reboot-hero-selector-atlas.json',
        repo_root / 'apps/portal/src/generated/hmh-reboot-hero-selector-atlas.mjs',
    ]
    payloads = build(repo_root)
    if args.check:
        drift = [str(path.relative_to(repo_root)) for path, payload in zip(outputs, payloads) if not path.exists() or path.read_bytes() != payload]
        if drift:
            raise SystemExit('selector atlas drift: ' + ', '.join(drift))
        print(json.dumps({'status': 'PASS', 'pipelineId': PIPELINE_ID, 'files': len(outputs)}))
        return
    for path, payload in zip(outputs, payloads):
        path.parent.mkdir(parents=True, exist_ok=True)
        path.write_bytes(payload)
    print(json.dumps({'status': 'BUILT', 'pipelineId': PIPELINE_ID, 'imageBytes': len(payloads[0]), 'files': len(outputs)}))


if __name__ == '__main__':
    main()
