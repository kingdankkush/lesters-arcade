"""Save a losslessly compressed, self-contained copy of a reviewed enemy source."""
import argparse,hashlib,json,sys
from pathlib import Path
import bpy
ROOT=Path(__file__).resolve().parents[2]
parser=argparse.ArgumentParser(description=__doc__); parser.add_argument('--source-directory',required=True); parser.add_argument('--output',required=True)
args=parser.parse_args(sys.argv[sys.argv.index('--')+1:]); source_dir=Path(args.source_directory).resolve(); output=Path(args.output).resolve()
receipt=json.loads((source_dir/'source-receipt.json').read_text()); source=source_dir/receipt['source']
sha=lambda path:hashlib.sha256(path.read_bytes()).hexdigest()
if sha(source)!=receipt['sourceSha256']: raise ValueError('Reviewed native source changed')
if not output.is_relative_to(ROOT/'.tmp') or output.exists(): raise ValueError('Use a fresh private compact source output')
output.mkdir(parents=True); bpy.ops.wm.open_mainfile(filepath=str(source),load_ui=False,use_scripts=False)
# Blender's compression changes storage only; the following independent A/B
# bakes and browser review operate on this exact saved source.
target=output/receipt['source']; bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(target),compress=True)
receipt['reviewedCandidateSha256']=receipt['sourceSha256']; receipt['sourceSha256']=sha(target); receipt['sourceBytes']=target.stat().st_size
receipt['storageCompactorSha256']=sha(Path(__file__)); receipt['reviewedCandidateUnchanged']=sha(source)==receipt['reviewedCandidateSha256']
(output/'source-receipt.json').write_text(json.dumps(receipt,indent=2)+'\n'); print(json.dumps(receipt))
