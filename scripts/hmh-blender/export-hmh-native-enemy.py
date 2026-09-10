"""Native enemy cold-open adapter; --inspect-only exercises CPU source/pose checks.

Never saves source files. Uses the existing roster exporter and exact native
sample cadence. GPU ownership is checked by the owning pipeline before launch.
"""
import sys
sys.dont_write_bytecode = True
from pathlib import Path
import importlib.util
import json
import math
import bpy
ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
sys.path.insert(0, str(Path(__file__).resolve().parent))
import hmh_native_enemy as native
import hmh_native_enemy_projection as projection
import hmh_native_enemy_semantics as semantics


def main():
    inspect_only = '--inspect-only' in sys.argv
    if inspect_only:
        sys.argv.remove('--inspect-only')
    spec = importlib.util.spec_from_file_location('canonical_enemy_export', ROOT / 'scripts/hmh-blender/export-hmh-enemy-roster.py')
    exporter = importlib.util.module_from_spec(spec); spec.loader.exec_module(exporter)
    args = exporter.blender_args()
    base = json.loads(Path(args.manifest).read_text())
    actor = next(a for a in base['actors'] if a['actorId'] == args.actor_id)
    manifest = native.actor_manifest(base, actor)
    source = ROOT / actor['sourceModel']['path']
    proof = actor['sourceModel']['preservation']
    if native.sha(ROOT / proof['path']) != proof['sha256']:
        raise ValueError('native preservation proof hash mismatch')
    reference = json.loads((ROOT / proof['path']).read_text())
    native.validate_semantic_proof(reference)
    bpy.ops.wm.open_mainfile(filepath=str(source), load_ui=False, use_scripts=False)
    current = semantics.resnapshot(reference['source'])
    delta = semantics.differences(reference['source'], projection.without_projection_parent(current))
    if delta:
        raise ValueError(f'native semantic source drift: {delta}')
    if bpy.data.libraries or any(not (i.packed_file or len(i.packed_files)) for i in bpy.data.images if i.type not in {'RENDER_RESULT', 'COMPOSITING'}):
        raise ValueError('native source contains external dependencies')
    # The native master deliberately retains its three original 4096px maps.
    # Exact image dimensions and packed hashes were checked by the semantic
    # proof above. The unchanged 2048px limit applies to the runtime atlas,
    # not a destructive downsample of this source-only packed master.
    # This flag guards the generic exporter against accidental direct native use.
    exporter.NATIVE_SOURCE_VERIFIED = True
    records = projection.install(exporter, manifest)
    if inspect_only:
        rig = exporter.resolve_rig(manifest, actor)
        for state, clip in manifest['clips'].items():
            action = exporter.set_clip_action(rig, actor['clipActions'][state])
            for direction in manifest['directions']:
                rig.rotation_euler.z = math.radians(manifest['directionAngles'][direction])
                for index in range(clip['frames']):
                    exporter.sample_clip_frame(action, index, clip['frames'], clip['loop'])
        report = {'status': 'pass', 'rendered': False, 'sourceSemanticMatch': True, 'nativeSamples': len(records),
                  'nativeActionsUnmodified': all(semantics.action_record(bpy.data.actions[n]) == v for n, v in reference['source']['actions'].items()),
                  'maximumGroundResidual': max(abs(r['afterMinimumZ']) for r in records)}
    else:
        # Manifest passed by render_actor is the selected native contract already.
        if base != manifest:
            raise ValueError('native render requires the exact actor-selected manifest')
        exporter.main()
        report = json.loads(Path(args.report_output).read_text())
        report.update(rendered=True, sourceSemanticMatch=True)
    if len(records) != 152 or native.sha(source) != actor['sourceModel']['sourceSha256']:
        raise ValueError('native frame coverage or immutable source changed')
    report.update(sourceUnchanged=True, sourceRebuilt=False, sourceBlendSha256=native.sha(source),
                  sourceSemanticsSha256=reference['sourceSemanticsSha256'],
                  manifestSha256=native.sha(Path(args.manifest)),
                  adapterSha256=native.sha(Path(__file__)), blenderVersion=bpy.app.version_string,
                  actionBindings=actor['clipActions'], frames=records)
    exporter.write_lf_json(Path(args.report_output), report)
    print(json.dumps({k: v for k, v in report.items() if k != 'frames'}, sort_keys=True))


if __name__ == '__main__':
    main()
