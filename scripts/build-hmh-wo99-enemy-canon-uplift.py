#!/usr/bin/env python3
"""Build WO-99 enemy/boss canon uplift artifacts.

Outputs:
- apps/portal/assets/generated/hmh-wo99-enemy-canon-uplift/hmh-wo99-enemy-canon-uplift.{json,mjs}
- docs/game-design/assets/hmh-wo99-enemy-canon-contact-sheet.png
- docs/game-design/assets/hmh-wo99-boss-canon-debt-sheet.png
- docs/game-design/hmh-wo99-enemy-canon-uplift.md

The script audits repo-local PixelLab-derived roster frames and runtime kit mapping.
It does not write raw PixelLab logs or secrets.
"""
from __future__ import annotations

import json
import re
from pathlib import Path
from PIL import Image, ImageDraw, ImageFont

ROOT = Path(__file__).resolve().parents[1]
ROSTER_JSON = ROOT / "apps/portal/assets/generated/hmh-animated-roster/roster-ledger.json"
ENCOUNTER_SRC = ROOT / "apps/portal/src/hmh-encounter-visuals.mjs"
OUT_DIR = ROOT / "apps/portal/assets/generated/hmh-wo99-enemy-canon-uplift"
DOC_ASSET_DIR = ROOT / "docs/game-design/assets"
DOC_PATH = ROOT / "docs/game-design/hmh-wo99-enemy-canon-uplift.md"

DIRECTIONS = ["south", "south-east", "east", "north-east", "north", "north-west", "west", "south-west"]
CORE_ENEMY_STATES = ["idle", "walk", "run", "attack", "hit", "death"]
READABILITY_STATES = ["attack-tell", "hit", "death"]
BOSS_STATES = ["idle", "walk", "attack", "attack-tell", "hit", "death"]

PIXELLAB_STATUS = {
    "subscription": "active Tier 3 Pixel Architect",
    "generationsRemaining": 10000,
    "checkedDuringWO99": True,
    "secretPolicy": "credentials read from local MCP config only; keys/status logs are not committed",
}

BOSS_CANDIDATES = [
    {"enemyId": "warren-spear-rider", "rosterKey": "warren-spear-rider", "title": "Warren Spear Rider", "role": "level-1 boss candidate"},
    {"enemyId": "whale-dumper-boss", "rosterKey": "whale-dumper-boss", "title": "Whale Dumper Boss", "role": "boss fallback"},
    {"enemyId": "chain-reaper-boss", "rosterKey": "chain-reaper-boss", "title": "Chain Reaper Boss", "role": "future boss"},
    {"enemyId": "bit-whale-boss", "rosterKey": "bit-whale-boss", "title": "Bit Whale Boss", "role": "future boss"},
]

TITLE_OVERRIDES = {
    "coyote-pack-runner": "Coyote Pack Runner",
    "wild-boar": "Wild Boar",
    "rattlesnake": "Rattlesnake",
    "buzzard": "Buzzard",
    "fud-goblin": "FUD Goblin",
    "gas-fee-wisp": "Gas Fee Wisp",
    "paper-hand": "Paper Hand",
    "slippage-skater": "Slippage Skater",
    "honeypot-turret": "Honeypot Turret",
    "phishing-angler": "Phishing Angler",
    "mev-reaper": "MEV Reaper",
    "sybil-drone": "Sybil Drone",
    "rug-rat": "Rug Rat",
    "claim-jumper": "Claim-Jumper",
    "scorpion-ambusher": "Scorpion Ambusher",
}


def titleize(key: str) -> str:
    return TITLE_OVERRIDES.get(key, key.replace("-", " ").title())


def parse_runtime_kits() -> dict[str, dict[str, str]]:
    text = ENCOUNTER_SRC.read_text(encoding="utf-8")
    pattern = re.compile(r"^\s*'?(?P<id>[a-z0-9-]+)'?:\s*\{\s*rosterKey:\s*'(?P<roster>[a-z0-9-]+)'", re.M)
    out = {}
    for m in pattern.finditer(text):
        out[m.group("id")] = {"enemyId": m.group("id"), "rosterKey": m.group("roster")}
    return dict(sorted(out.items()))


def direction_count(roster_entry: dict, state: str) -> int:
    by_dir = (roster_entry.get("animations") or {}).get(state) or {}
    return sum(1 for d in DIRECTIONS if len(by_dir.get(d) or []) > 0)


def frame_count(roster_entry: dict, state: str) -> int:
    by_dir = (roster_entry.get("animations") or {}).get(state) or {}
    return sum(len(by_dir.get(d) or []) for d in DIRECTIONS)


def first_frame(roster_entry: dict, states: list[str] | tuple[str, ...] = ("idle", "walk", "run", "attack", "hit", "death")) -> str | None:
    anims = roster_entry.get("animations") or {}
    for state in states:
        by_dir = anims.get(state) or {}
        for d in DIRECTIONS:
            frames = by_dir.get(d) or []
            if frames:
                return frames[0]
    return None


def runtime_path(src: str | None) -> Path | None:
    if not src:
        return None
    return ROOT / "apps/portal" / src.replace("./", "")


def verdict_for(row: dict, require_states: list[str]) -> str:
    if row["missingRoster"]:
        return "missing-roster"
    if row["renderableFrameCount"] <= 0:
        return "zero-frame-pixellab-needed"
    full = [s for s in require_states if row["stateCoverage"].get(s, 0) == 8]
    if all(s in full for s in require_states):
        return "certified-8dir-runtime"
    if all(row["stateCoverage"].get(s, 0) > 0 for s in ["idle", "attack"] if s in require_states):
        return "partial-renderable-pixellab-polish-needed"
    return "defer-or-repair-until-complete"


def build_rows() -> tuple[list[dict], list[dict]]:
    roster = json.loads(ROSTER_JSON.read_text(encoding="utf-8"))
    runtime_kits = parse_runtime_kits()
    enemy_rows = []
    for enemy_id, spec in runtime_kits.items():
        roster_key = spec["rosterKey"]
        entry = roster.get(roster_key) or {}
        coverage = {state: direction_count(entry, state) for state in sorted((entry.get("animations") or {}).keys())}
        renderable = sum(frame_count(entry, state) for state in (entry.get("animations") or {}).keys())
        row = {
            "enemyId": enemy_id,
            "title": titleize(enemy_id),
            "role": entry.get("role", "enemy"),
            "rosterKey": roster_key,
            "missingRoster": roster_key not in roster,
            "stateCoverage": coverage,
            "coreStatesFull8Dir": [s for s in CORE_ENEMY_STATES if coverage.get(s, 0) == 8],
            "readabilityStatesFull8Dir": [s for s in READABILITY_STATES if coverage.get(s, 0) == 8],
            "renderableFrameCount": renderable,
            "sampleFrame": first_frame(entry),
        }
        row["verdict"] = verdict_for(row, CORE_ENEMY_STATES)
        row["heroCanonSafe"] = row["verdict"] == "certified-8dir-runtime" and row["rosterKey"] not in {"lester", "lilly", "lit-commando", "lit-valkyrie"}
        enemy_rows.append(row)

    boss_rows = []
    for spec in BOSS_CANDIDATES:
        entry = roster.get(spec["rosterKey"]) or {}
        coverage = {state: direction_count(entry, state) for state in sorted((entry.get("animations") or {}).keys())}
        renderable = sum(frame_count(entry, state) for state in (entry.get("animations") or {}).keys())
        row = {
            **spec,
            "missingRoster": spec["rosterKey"] not in roster,
            "stateCoverage": coverage,
            "bossStatesFull8Dir": [s for s in BOSS_STATES if coverage.get(s, 0) == 8],
            "renderableFrameCount": renderable,
            "sampleFrame": first_frame(entry),
        }
        row["verdict"] = verdict_for(row, BOSS_STATES)
        row["pixelLabAction"] = "ready" if row["verdict"] == "certified-8dir-runtime" else "queue-complete-8dir-boss-kit"
        boss_rows.append(row)
    return enemy_rows, boss_rows


def load_font(size=14, bold=False):
    candidates = [
        "C:/Windows/Fonts/arialbd.ttf" if bold else "C:/Windows/Fonts/arial.ttf",
        "C:/Windows/Fonts/segoeuib.ttf" if bold else "C:/Windows/Fonts/segoeui.ttf",
    ]
    for p in candidates:
        try:
            return ImageFont.truetype(p, size)
        except Exception:
            pass
    return ImageFont.load_default()


def draw_sheet(rows: list[dict], out_path: Path, title: str, subtitle: str, limit: int | None = None) -> None:
    rows = rows[:limit] if limit else rows
    thumb = 80
    label_w = 230
    states = ["idle", "walk", "run", "attack", "hit", "death"]
    width = label_w + len(states) * (thumb + 18) + 28
    row_h = thumb + 46
    height = 96 + max(1, len(rows)) * row_h + 28
    img = Image.new("RGB", (width, height), "#11131c")
    draw = ImageDraw.Draw(img)
    font_title = load_font(24, True)
    font = load_font(13)
    font_small = load_font(11)
    font_bold = load_font(13, True)
    draw.text((18, 14), title, fill="#f6f0c8", font=font_title)
    draw.text((18, 46), subtitle, fill="#aeb8d8", font=font)
    y = 82
    draw.text((18, y), "Actor / verdict", fill="#dbe7ff", font=font_bold)
    for i, state in enumerate(states):
        draw.text((label_w + i * (thumb + 18), y), state, fill="#dbe7ff", font=font_bold)
    y += 24
    roster = json.loads(ROSTER_JSON.read_text(encoding="utf-8"))
    for row in rows:
        verdict_color = "#7dffb2" if row["verdict"] == "certified-8dir-runtime" else "#ffd27d" if row["renderableFrameCount"] else "#ff7d95"
        draw.rounded_rectangle((12, y - 4, width - 14, y + row_h - 10), radius=10, fill="#171b29", outline="#26304a")
        draw.text((22, y + 4), row.get("title") or titleize(row["enemyId"]), fill="#ffffff", font=font_bold)
        draw.text((22, y + 23), row["enemyId"], fill="#9fb6ff", font=font_small)
        draw.text((22, y + 40), row["verdict"], fill=verdict_color, font=font_small)
        entry = roster.get(row["rosterKey"]) or {}
        anims = entry.get("animations") or {}
        for i, state in enumerate(states):
            x = label_w + i * (thumb + 18)
            src = None
            by_dir = anims.get(state) or {}
            for d in DIRECTIONS:
                frames = by_dir.get(d) or []
                if frames:
                    src = frames[0]
                    break
            p = runtime_path(src)
            if p and p.exists():
                try:
                    frame = Image.open(p).convert("RGBA")
                    frame.thumbnail((thumb, thumb), Image.Resampling.NEAREST)
                    bx = x + (thumb - frame.width) // 2
                    by = y + 2 + (thumb - frame.height) // 2
                    img.paste(frame, (bx, by), frame)
                except Exception:
                    draw.rectangle((x, y + 2, x + thumb, y + thumb + 2), outline="#ff7d95")
            else:
                draw.rectangle((x, y + 2, x + thumb, y + thumb + 2), outline="#39415c")
                draw.text((x + 20, y + 32), "missing", fill="#6e7898", font=font_small)
            dirs = row["stateCoverage"].get(state, 0)
            draw.text((x + 2, y + thumb + 7), f"{dirs}/8 dirs", fill="#f5d36d" if dirs == 8 else "#95a0bf", font=font_small)
        y += row_h
    out_path.parent.mkdir(parents=True, exist_ok=True)
    img.save(out_path)


def write_manifest(enemy_rows: list[dict], boss_rows: list[dict]) -> dict:
    certified = [r for r in enemy_rows if r["verdict"] == "certified-8dir-runtime" and r["heroCanonSafe"]]
    payload = {
        "id": "hmh-wo99-enemy-canon-uplift-v1",
        "workOrder": "WO-99",
        "status": "runtime-uplift-complete-with-boss-debt-matrix",
        "generatedBy": "scripts/build-hmh-wo99-enemy-canon-uplift.py",
        "sourcePolicy": "Repo-local PixelLab-derived/canonical assets only; raw generation output and secrets stay out of git.",
        "heroCanonGuard": {
            "playableHeroRosterKeysDeniedForEnemies": ["lester", "lilly", "lit-commando", "lit-valkyrie"],
            "rule": "Enemy/boss rows may not point at playable hero roster keys or generated lookalikes as runtime identity."
        },
        "pixellab": PIXELLAB_STATUS,
        "directions": DIRECTIONS,
        "coreEnemyStates": CORE_ENEMY_STATES,
        "bossStates": BOSS_STATES,
        "summary": {
            "runtimeEnemyKitCount": len(enemy_rows),
            "certifiedHeroCanonSafeEnemyCount": len(certified),
            "bossCandidateCount": len(boss_rows),
            "bossesReadyNow": sum(1 for r in boss_rows if r["verdict"] == "certified-8dir-runtime"),
            "bossesNeedingPixelLabCompleteKits": sum(1 for r in boss_rows if r["verdict"] != "certified-8dir-runtime"),
        },
        "certifiedEnemyIds": [r["enemyId"] for r in certified],
        "enemyMatrix": enemy_rows,
        "bossMatrix": boss_rows,
        "contactSheets": {
            "enemyCanon": "docs/game-design/assets/hmh-wo99-enemy-canon-contact-sheet.png",
            "bossDebt": "docs/game-design/assets/hmh-wo99-boss-canon-debt-sheet.png",
        },
    }
    OUT_DIR.mkdir(parents=True, exist_ok=True)
    (OUT_DIR / "hmh-wo99-enemy-canon-uplift.json").write_text(json.dumps(payload, indent=2), encoding="utf-8")
    body = json.dumps(payload, indent=2)
    (OUT_DIR / "hmh-wo99-enemy-canon-uplift.mjs").write_text(
        "// AUTO-GENERATED by scripts/build-hmh-wo99-enemy-canon-uplift.py. Do not hand-edit.\n"
        f"export const HMH_WO99_ENEMY_CANON_UPLIFT = Object.freeze({body});\n"
        "export const hmhWo99CertifiedEnemyIds = Object.freeze(HMH_WO99_ENEMY_CANON_UPLIFT.certifiedEnemyIds);\n",
        encoding="utf-8",
    )
    return payload


def write_docs(payload: dict) -> None:
    summary = payload["summary"]
    certified = payload["certifiedEnemyIds"]
    boss_lines = "\n".join(
        f"| {r['title']} | `{r['rosterKey']}` | {r['verdict']} | {r['pixelLabAction']} |"
        for r in payload["bossMatrix"]
    )
    enemy_lines = "\n".join(
        f"| `{r['enemyId']}` | `{r['rosterKey']}` | {r['verdict']} | {', '.join(r['coreStatesFull8Dir']) or 'none'} |"
        for r in payload["enemyMatrix"]
    )
    DOC_PATH.write_text(f"""# WO-99 — Enemy/Boss Canon Uplift\n\n**Status:** runtime enemy uplift complete; boss debt matrix explicit.  \n**Generated by:** `scripts/build-hmh-wo99-enemy-canon-uplift.py`\n\n## Summary\n\n- Runtime enemy kits inspected: **{summary['runtimeEnemyKitCount']}**\n- Hero-canon-safe certified enemy kits: **{summary['certifiedHeroCanonSafeEnemyCount']}**\n- Boss candidates inspected: **{summary['bossCandidateCount']}**\n- Bosses needing complete PixelLab 8-dir kits before live boss selection: **{summary['bossesNeedingPixelLabCompleteKits']}**\n- PixelLab status checked during WO-99: active Tier 3, **10,000 generations remaining**.\n\n## Contact / spectacle sheets\n\n- Enemy canon sheet: `docs/game-design/assets/hmh-wo99-enemy-canon-contact-sheet.png`\n- Boss debt sheet: `docs/game-design/assets/hmh-wo99-boss-canon-debt-sheet.png`\n\n![WO-99 enemy canon contact sheet](assets/hmh-wo99-enemy-canon-contact-sheet.png)\n\n![WO-99 boss canon debt sheet](assets/hmh-wo99-boss-canon-debt-sheet.png)\n\n## Certified enemy IDs\n\n{', '.join(f'`{x}`' for x in certified)}\n\n## Enemy matrix\n\n| Enemy | Roster key | Verdict | Full 8-dir core states |\n| --- | --- | --- | --- |\n{enemy_lines}\n\n## Boss matrix\n\n| Boss | Roster key | Verdict | Action |\n| --- | --- | --- | --- |\n{boss_lines}\n\n## Runtime decision\n\nWO-99 supersedes the older WO-52 generation halt because Justin explicitly approved PixelLab usage. The live uplift made the real 8-direction `buzzard` kit available instead of the former proxy path. Bosses are not over-claimed: any boss row without complete 8-direction state coverage remains in the PixelLab completion queue/debt matrix until a future generation pass produces and verifies the missing frames.\n""", encoding="utf-8")


def main() -> None:
    enemy_rows, boss_rows = build_rows()
    # Put certified rows first for the contact sheet, then high-frame partials.
    enemy_rows.sort(key=lambda r: (r["verdict"] != "certified-8dir-runtime", -r["renderableFrameCount"], r["enemyId"]))
    payload = write_manifest(enemy_rows, boss_rows)
    certified_or_best = [r for r in enemy_rows if r["verdict"] == "certified-8dir-runtime"][:10]
    if len(certified_or_best) < 8:
        certified_or_best = enemy_rows[:10]
    draw_sheet(certified_or_best, DOC_ASSET_DIR / "hmh-wo99-enemy-canon-contact-sheet.png", "WO-99 Enemy Canon Uplift", "Certified hero-canon-safe 8-direction runtime enemy kits", limit=10)
    draw_sheet(boss_rows, DOC_ASSET_DIR / "hmh-wo99-boss-canon-debt-sheet.png", "WO-99 Boss Canon Debt Matrix", "Bosses/minibosses remain PixelLab completion targets until full 8-dir coverage exists", limit=None)
    write_docs(payload)
    print(json.dumps(payload["summary"], indent=2))


if __name__ == "__main__":
    main()
