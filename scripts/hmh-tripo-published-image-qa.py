"""Read-only portable pixel QA for adopted Tripo props; never invokes Blender."""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
from PIL import Image


def audit_images(asset_root: Path) -> dict:
    root = asset_root.resolve(strict=True)
    checked: dict[str, int] = {}

    def checked_file(relative: str, expected_hash: str | None = None) -> Path:
        path = root / relative
        try:
            resolved = path.resolve(strict=True)
        except FileNotFoundError as exc:
            raise ValueError(f"native asset missing: {relative}") from exc
        if not resolved.is_relative_to(root) or not resolved.is_file():
            raise ValueError(f"native asset path escapes package: {relative}")
        raw = resolved.read_bytes()
        if expected_hash is not None and hashlib.sha256(raw).hexdigest() != expected_hash:
            raise ValueError(f"native asset bytes/hash mismatch: {relative}")
        checked[relative] = len(raw)
        return resolved

    manifest_path = checked_file('hmh-tripo-props.json')
    metadata = json.loads(manifest_path.read_text(encoding='utf-8'))
    if metadata.get('assetCount') != 56 or len(metadata.get('frames', [])) != 56:
        raise ValueError('complete native 56-frame roster required')
    if not 1 <= len(metadata.get('pages', [])) <= 2:
        raise ValueError('native page budget exceeded')
    pages = []
    runtime_bytes = 0
    for page in metadata['pages']:
        path = checked_file(page['image'], page['sha256'])
        with Image.open(path) as source:
            rgba = source.convert('RGBA')
        if rgba.size != (page['width'], page['height']):
            raise ValueError('native page decoded dimensions mismatch')
        if max(rgba.size) > 2048 or hashlib.sha256(rgba.tobytes()).hexdigest() != page['decodedRgbaSha256']:
            raise ValueError('native page decoded pixels or size budget mismatch')
        runtime_bytes += path.stat().st_size
        pages.append(rgba)
    ids = set()
    for frame in metadata['frames']:
        if frame['sourceId'] in ids:
            raise ValueError('duplicate native source frame')
        ids.add(frame['sourceId'])
        box = frame['frame']
        crop = pages[frame['page']].crop((box['x'], box['y'], box['x']+box['w'], box['y']+box['h']))
        if hashlib.sha256(crop.tobytes()).hexdigest() != frame['sourcePixelSha256']:
            raise ValueError(f"native source frame reconstruction failed: {frame['sourceId']}")
        item = checked_file('items/' + frame['itemImage'], frame['itemSha256'])
        with Image.open(item) as source:
            rgba = source.convert('RGBA')
        if rgba.size != crop.size or hashlib.sha256(rgba.tobytes()).hexdigest() != frame['sourcePixelSha256']:
            raise ValueError(f"native item decoded source pixels mismatch: {frame['sourceId']}")
    if ids != {f'{value:02d}' for value in range(1, 57)}:
        raise ValueError('native source roster mismatch')
    sheet = metadata['contactSheet']
    checked_file(sheet['image'], sheet['sha256'])
    return {'status': 'pass', 'assetCount': len(ids), 'framesVerified': len(ids),
            'itemImagesVerified': len(ids), 'pageCount': len(pages), 'filesVerified': len(checked),
            'runtimeAtlasBytes': runtime_bytes, 'totalPackageBytes': sum(checked.values()),
            'decodedTextureBytes': sum(page.width*page.height*4 for page in pages),
            'releaseCertified': False}


if __name__ == '__main__':
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--asset-root', required=True, type=Path)
    args = parser.parse_args()
    print(json.dumps(audit_images(args.asset_root)))
