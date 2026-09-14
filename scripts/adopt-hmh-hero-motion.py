"""Stage verified native motion pages locally for browser review; never deploys."""
import argparse, hashlib, json, shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parents[1]
ACTORS=['lit-commando','lit-valkyrie','lester-original','lilly']
def sha(path): return hashlib.sha256(path.read_bytes()).hexdigest()
def main():
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate-version',default='v3')
    args=parser.parse_args()
    sources=json.loads((ROOT/'apps/hmh-reboot/assets/source/blender/hmh-production-heroes.json').read_text())
    reports=[]; copies=[]
    for actor in ACTORS:
        directory=ROOT/'.tmp'/f'hero-motion-{actor}-{args.candidate_version}'
        report=json.loads((directory/'measurement.json').read_text())
        pilot=next(p for p in sources['pilots'] if p['actorId']==actor)
        packed=directory/'packed'; image=packed/f'{actor}-motion.webp'; metadata=packed/f'{actor}-motion.json'
        if report['sourceSha256']!=pilot['sourceModel']['sourceSha256'] or sha(ROOT/pilot['sourceModel']['path'])!=report['sourceSha256']:
            raise ValueError('Native hero source changed')
        if sha(image)!=report['imageSha256'] or sha(metadata)!=report['metadataSha256']:
            raise ValueError('Verified hero outputs changed')
        if report['frames']!=496 or report['imageBytes']>4*1024*1024 or report['selectedHeroBytes']>8*1024*1024:
            raise ValueError('Native hero motion coverage or budget failed')
        if any(report['repeatability'][key]>limit for key,limit in sources['reproducibilityBudget'].items()):
            raise ValueError('Native hero repeatability failed')
        if report['exporterSha256']!=sha(ROOT/'scripts/hmh-blender/export-hmh-hero-motion.py'):
            raise ValueError('Hero exporter changed after verification')
        copies.append((actor,image,metadata,directory))
        reports.append({**report,'canonicalAdoption':True,'browserReview':'pending'})
    # Validate the complete family before copying any member.
    for actor,image,metadata,directory in copies:
        destination=ROOT/'apps/portal/assets/generated/hmh-hero-motion'/actor
        destination.mkdir(parents=True,exist_ok=True)
        shutil.copyfile(image,destination/image.name); shutil.copyfile(metadata,destination/metadata.name)
        evidence=ROOT/'docs/testing/hmh-hero-motion'/actor; evidence.mkdir(parents=True,exist_ok=True)
        for run in ['a','b']: shutil.copyfile(directory/f'run-{run}-receipt.json',evidence/f'run-{run}-receipt.json')
    report_path=ROOT/'docs/testing/hmh-hero-motion/measurement.json'
    report_path.write_text(json.dumps({'schema':1,'status':'local-browser-review-pending','heroes':reports,
        'totalMotionImageBytes':sum(r['imageBytes'] for r in reports),'selectedHeroOnly':True,
        'additionalDecodedBytesPerHero':2048*2048*4},indent=2)+'\n')
    print(report_path)
if __name__=='__main__': main()
