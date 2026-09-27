"""Summarise docs/chikun/review/obstacles.json (the obstacle contrast receipts).

    python scripts/chikun-obstacle-contrast-summary.py [--json]

Per light key: the median `body` ratio over every obstacle of every region,
the lowest obstacle, and per kind the lowest and median ratio across regions.
Targets (obstacle-contrast slice): noon median >= 3:1 and no kind below 2.2:1
at noon; night median >= 2.5:1.
"""
import json, statistics, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TARGETS = dict(noonMedian=3.0, noonKindMin=2.2, nightMedian=2.5)


def summary(receipts):
    out = {}
    for key in ('noon', 'golden', 'night', 'dawn'):
        vals, kinds = [], {}
        for region, d in receipts.items():
            for kind, v in d.get(key, {}).items():
                if not v: continue
                vals.append(v['body']); kinds.setdefault(kind, []).append(v['body'])
        out[key] = dict(median=round(statistics.median(vals), 2), n=len(vals), min=min(vals),
                        kinds={k: dict(min=min(v), median=round(statistics.median(v), 2)) for k, v in sorted(kinds.items())})
    out['targets'] = dict(TARGETS, met=dict(
        noonMedian=out['noon']['median'] >= TARGETS['noonMedian'],
        noonKindMin=all(k['min'] >= TARGETS['noonKindMin'] for k in out['noon']['kinds'].values()),
        nightMedian=out['night']['median'] >= TARGETS['nightMedian']))
    return out


def main():
    s = summary(json.loads((ROOT / 'docs/chikun/review/obstacles.json').read_text(encoding='utf8')))
    if '--json' in sys.argv:
        print(json.dumps(s, indent=1)); return
    for key in ('noon', 'golden', 'night', 'dawn'):
        k = s[key]
        low = sorted(k['kinds'].items(), key=lambda kv: kv[1]['min'])[:6]
        print(f"{key:7s} median {k['median']:.2f}  min {k['min']:.2f}  lowest kinds: " + ', '.join(f"{n} {v['min']:.2f}" for n, v in low))
    print('targets met:', s['targets']['met'])


if __name__ == '__main__':
    main()
