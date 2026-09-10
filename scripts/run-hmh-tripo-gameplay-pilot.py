"""Reproduce one packed textured hero into a new isolated .tmp directory."""
from __future__ import annotations
import argparse
import importlib.util
import json
from pathlib import Path
import sys

ROOT = Path(__file__).resolve().parents[1]

def validate_output_isolation(output_root: Path) -> Path:
    path, base = output_root.resolve(), (ROOT / '.tmp').resolve()
    if not path.is_relative_to(base) or path == base:
        raise RuntimeError(f'output-root must be a strict child of {base}: {path}')
    return path

def load_production():
    sys.path.insert(0, str(ROOT / 'scripts'))
    spec = importlib.util.spec_from_file_location('hmh_production_pipeline', ROOT / 'scripts/run-hmh-production-hero-pilot.py')
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--manifest', default=str(ROOT / 'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json'))
    parser.add_argument('--actor-id', default='lit-commando')
    parser.add_argument('--output-root', required=True)
    args = parser.parse_args()
    output = validate_output_isolation(Path(args.output_root))
    if output.exists():
        raise RuntimeError(f'Use a new output-root; preserving existing output: {output}')
    manifest = json.loads(Path(args.manifest).resolve().read_text(encoding='utf-8'))
    pilot = next((entry for entry in manifest['pilots'] if entry['actorId'] == args.actor_id), None)
    if not pilot or pilot.get('sourceModel', {}).get('format') != 'blend':
        raise RuntimeError(f'{args.actor_id} is not a packed Blend pilot')
    source = (ROOT / pilot['sourceModel']['path']).resolve()
    if not source.is_file():
        raise RuntimeError(f'Packed source missing: {source}')
    output.mkdir(parents=True)
    isolated = {**manifest, 'pilots': [pilot], 'scene': {**manifest['scene'], 'sourceBlend': pilot['sourceModel']['path'], 'armature': pilot['armature']}, 'atlas': {**manifest['atlas'], 'trimTransparentPadding': True}}
    isolated_manifest = output / 'reproduction-manifest.json'
    isolated_manifest.write_text(json.dumps(isolated, indent=2) + '\n', encoding='utf-8', newline='\n')
    production = load_production()
    version = production.blender_version()
    if version != isolated['scene']['blenderVersion']:
        raise RuntimeError(f'Blender version mismatch: {version}')
    inspection_path = output / 'source-inspection.json'
    helper = ROOT / 'scripts/hmh-blender/inspect-hmh-packed-hero-source.py'
    production.run_checked([str(production.BLENDER), '--background', '--factory-startup', '--python-exit-code', '1', '--python', str(helper), '--', '--source-blend', str(source), '--manifest', str(isolated_manifest), '--output', str(inspection_path)], 'real-source-inspection')
    inspection = production.read_json(inspection_path)
    if set(inspection['actors']) != {args.actor_id} or inspection['externalDependencyCount'] or not inspection['weaponSocket']:
        raise RuntimeError('Packed source inspection failed')
    result = production.process_pilot(isolated, pilot, source, output / 'raw', inspection, version, isolated_manifest, output / 'generated')
    print(json.dumps({'status': 'pass', 'actor': result}, indent=2))

if __name__ == '__main__':
    main()
