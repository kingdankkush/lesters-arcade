"""Adopt the complete, independently rendered native enemy family locally."""
import hashlib,json,shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ACTORS=['forkrunner','liquidator-agent','whale-enforcer','gas-bomber','validator-cultist','the-liquidator']
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    plans=[]; sources=[]; reports=[]
    exporter=sha(ROOT/'scripts/hmh-blender/export-hmh-native-roster.py')
    for actor in ACTORS:
        source_dir=ROOT/'.tmp/native-roster-final'/actor
        candidate=ROOT/('.tmp/native-roster-atlas-stable' if actor=='forkrunner' else '.tmp/native-roster-atlas-final')/actor
        actor_exporter=sha(ROOT/'scripts/hmh-blender/export-hmh-native-roster-stable.py') if actor=='forkrunner' else exporter
        source=json.loads((source_dir/'source-receipt.json').read_text())
        report=json.loads((candidate/'measurement.json').read_text())
        image=candidate/'packed'/f'{actor}-native-roster.webp'
        metadata=candidate/'packed'/f'{actor}-native-roster.json'
        if not source['sourceUnchanged'] or not source['reviewedCandidateUnchanged'] or not report['sourceUnchanged']:
            raise ValueError('Native source preservation failed: '+actor)
        if sha(source_dir/source['source'])!=source['sourceSha256'] or report['sourceSha256']!=source['sourceSha256'] or sha(ROOT/source['baseSource'])!=source['baseSha256']:
            raise ValueError('Native source lineage changed: '+actor)
        if report['exporterSha256']!=actor_exporter or sha(image)!=report['imageSha256'] or sha(metadata)!=report['metadataSha256']:
            raise ValueError('Native render proof changed: '+actor)
        if report['frames']!=(840 if actor=='the-liquidator' else 280) or report['imageBytes']>4194304 or report['pixelReconstructionChanged']!=0:
            raise ValueError('Native coverage or transfer budget failed: '+actor)
        for key,limit in {'maxChangedVisiblePixels':8,'maxChannelDelta':2,'maxTotalChannelDelta':32}.items():
            if report['repeatability'][key]>limit: raise ValueError('Native repeatability failed: '+actor)
        if set(source['clipActions'])!={'idle','run','tell','attack','hit','death'} or source['nativeBodyVertices']<50000 or source['bones']<19:
            raise ValueError('Native mesh, rig or action coverage missing: '+actor)
        canonical=Path('apps/hmh-reboot/assets/source/models/native-enemies')/actor
        sources.append({**source,'path':(canonical/source['source']).as_posix()})
        reports.append({**report,'canonicalAdoption':True,'browserReview':'pending'})
        plans.append((actor,source_dir,candidate,image,metadata,canonical))
    for actor,source_dir,candidate,image,metadata,canonical in plans:
        destination=ROOT/canonical;destination.mkdir(parents=True,exist_ok=True)
        for filename in [f'{actor}.blend','source-receipt.json']: shutil.copyfile(source_dir/filename,destination/filename)
        output=ROOT/'apps/portal/assets/generated/hmh-native-roster'/actor;output.mkdir(parents=True,exist_ok=True)
        for file in [image,metadata]: shutil.copyfile(file,output/file.name)
        evidence=ROOT/'docs/testing/hmh-native-roster'/actor;evidence.mkdir(parents=True,exist_ok=True)
        for run in ['a','b']: shutil.copyfile(candidate/f'run-{run}/render-receipt.json',evidence/f'run-{run}-receipt.json')
    (ROOT/'apps/hmh-reboot/assets/source/blender/hmh-native-roster.json').write_text(json.dumps({'schemaVersion':1,'runtimeAuthority':'projection-only','sources':sources},indent=2)+'\n')
    report_path=ROOT/'docs/testing/hmh-native-roster/measurement.json'
    report_path.write_text(json.dumps({'schemaVersion':1,'status':'local-browser-review-pending','actors':reports,'totalImageBytes':sum(r['imageBytes'] for r in reports),'totalDecodedBytes':sum(r['decodedBytes'] for r in reports)},indent=2)+'\n')
    print(report_path)
if __name__=='__main__': main()
