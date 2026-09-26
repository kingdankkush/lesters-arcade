"""Adopt one independently rendered native enemy derivative locally (art wave 1).

Single-actor form of adopt-hmh-native-roster.py: the six-actor script expects
every derivative under .tmp at once, which a one-actor art wave never has.
The checks are the same: preserved source lineage, both cold render receipts
equal, frame coverage, transfer budget, repeatability, mesh/rig/action
coverage. It then copies the source, the packed atlas, the receipts, and
rewrites this actor's rows in hmh-native-roster.json and
docs/testing/hmh-native-roster/measurement.json, leaving the others alone.

  python scripts/adopt-hmh-native-actor.py --actor the-liquidator \
      --source-directory .tmp/native-roster-final/the-liquidator \
      --candidate .tmp/native-roster-atlas-final/the-liquidator
"""
import argparse, hashlib, json, shutil
from pathlib import Path
ROOT = Path(__file__).resolve().parents[1]
BUDGET = {'maxChangedVisiblePixels': 8, 'maxChannelDelta': 2, 'maxTotalChannelDelta': 32}


def sha(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def write_json(path, payload):
    path.write_text(json.dumps(payload, indent=2) + '\n', encoding='utf-8', newline='\n')


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--actor', required=True)
    parser.add_argument('--source-directory', required=True)
    parser.add_argument('--candidate', required=True)
    args = parser.parse_args()
    actor = args.actor
    source_dir = (ROOT / args.source_directory).resolve()
    candidate = (ROOT / args.candidate).resolve()
    exporter = sha(ROOT / 'scripts/hmh-blender/export-hmh-native-roster.py')
    source = json.loads((source_dir / 'source-receipt.json').read_text())
    report = json.loads((candidate / 'measurement.json').read_text())
    image = candidate / 'packed' / f'{actor}-native-roster.webp'
    metadata = candidate / 'packed' / f'{actor}-native-roster.json'
    if source['actorId'] != actor or report['actorId'] != actor:
        raise ValueError('Native candidate actor mismatch')
    if not source['sourceUnchanged'] or not report['sourceUnchanged']:
        raise ValueError('Native source preservation failed: ' + actor)
    if sha(source_dir / source['source']) != source['sourceSha256'] or report['sourceSha256'] != source['sourceSha256'] or sha(ROOT / source['baseSource']) != source['baseSha256']:
        raise ValueError('Native source lineage changed: ' + actor)
    if report['exporterSha256'] != exporter or sha(image) != report['imageSha256'] or sha(metadata) != report['metadataSha256']:
        raise ValueError('Native render proof changed: ' + actor)
    phases = len(source.get('phaseVisuals') or {}) or 1
    if report['frames'] != 280 * phases or report['imageBytes'] > 4194304 or report['pixelReconstructionChanged'] != 0:
        raise ValueError('Native coverage or transfer budget failed: ' + actor)
    for key, limit in BUDGET.items():
        if report['repeatability'][key] > limit:
            raise ValueError('Native repeatability failed: ' + actor)
    if set(source['clipActions']) != {'idle', 'run', 'tell', 'attack', 'hit', 'death'} or source['nativeBodyVertices'] < 50000 or source['bones'] < 19:
        raise ValueError('Native mesh, rig or action coverage missing: ' + actor)
    a = json.loads((candidate / 'run-a/render-receipt.json').read_text())
    b = json.loads((candidate / 'run-b/render-receipt.json').read_text())
    if a != b:
        raise ValueError('Independent native receipts disagree: ' + actor)
    canonical = Path('apps/hmh-reboot/assets/source/models/native-enemies') / actor
    destination = ROOT / canonical
    destination.mkdir(parents=True, exist_ok=True)
    for filename in [f'{actor}.blend', 'source-receipt.json']:
        shutil.copyfile(source_dir / filename, destination / filename)
    output = ROOT / 'apps/portal/assets/generated/hmh-native-roster' / actor
    output.mkdir(parents=True, exist_ok=True)
    for file in [image, metadata]:
        shutil.copyfile(file, output / file.name)
    evidence = ROOT / 'docs/testing/hmh-native-roster' / actor
    evidence.mkdir(parents=True, exist_ok=True)
    for run in ['a', 'b']:
        shutil.copyfile(candidate / f'run-{run}/render-receipt.json', evidence / f'run-{run}-receipt.json')
    manifest_path = ROOT / 'apps/hmh-reboot/assets/source/blender/hmh-native-roster.json'
    manifest = json.loads(manifest_path.read_text())
    row = {**source, 'path': (canonical / source['source']).as_posix()}
    manifest['sources'] = [row if item['actorId'] == actor else item for item in manifest['sources']]
    if all(item['actorId'] != actor for item in manifest['sources']):
        manifest['sources'].append(row)
    write_json(manifest_path, manifest)
    report_path = ROOT / 'docs/testing/hmh-native-roster/measurement.json'
    measurement = json.loads(report_path.read_text())
    adopted = {**report, 'canonicalAdoption': True, 'browserReview': 'pending'}
    measurement['actors'] = [adopted if item['actorId'] == actor else item for item in measurement['actors']]
    if all(item['actorId'] != actor for item in measurement['actors']):
        measurement['actors'].append(adopted)
    measurement['totalImageBytes'] = sum(r['imageBytes'] for r in measurement['actors'])
    measurement['totalDecodedBytes'] = sum(r['decodedBytes'] for r in measurement['actors'])
    measurement['status'] = 'local-browser-review-pending'
    write_json(report_path, measurement)
    print(json.dumps({'adopted': actor, 'imageBytes': report['imageBytes'], 'totalImageBytes': measurement['totalImageBytes'], 'source': row['path']}))


if __name__ == '__main__':
    main()
