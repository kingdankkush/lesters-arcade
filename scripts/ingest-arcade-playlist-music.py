from __future__ import annotations

import json
import os
import re
import shutil
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE_DIR_ENV = "LESTERS_ARCADE_PLAYLIST_SOURCE_DIR"
OUTPUT_DIR = ROOT / "apps" / "portal" / "assets" / "audio" / "playlist"
JSON_MANIFEST_PATH = OUTPUT_DIR / "arcade-playlist-manifest.json"
ESM_MANIFEST_PATH = ROOT / "apps" / "portal" / "src" / "arcade-playlist-manifest.mjs"

MANIFEST_ID = "lesters-arcade-custom-mp3-playlist-v1"
HARD_MONEY_HEROES_PRIMARY_ID = "hard-money-heroes-16-bit-arcade-music"
HARD_MONEY_HEROES_ALT_ID = "hard-money-heroes-16-bit-arcade-music-alt"


PREFERRED_ORDER = [
    "Hard Money Heroes 16-BIT Arcade Music.mp3",
    "Hard Money Heroes 16-BIT Arcade Music (1).mp3",
    "Adventure 16-BIT Arcade Music.mp3",
    "CastleLitvania 16-BIT Arcade Music Track 1.mp3",
    "CastleLitvania 16-BIT Arcade Music Track 2.mp3",
    "Lit Country 16-BIT Arcade Music Track 1.mp3",
    "Lit Country 16-BIT Arcade Music Track 2.mp3",
    "Lit Fantasy 16-BIT Arcade Music Track 1.mp3",
    "Lit Fantasy 16-BIT Arcade Music Track 2.mp3",
    "Lit Man 16-BIT Arcade Music Track 1.mp3",
    "Lit Man 16-BIT Arcade Music Track 2.mp3",
    "Lit Trigger 16-BIT Arcade Music.mp3",
    "LitBound 16-BIT Arcade Music Track 1.mp3",
    "LitBound 16-BIT Arcade Music Track 2.mp3",
    "Lit-Zero 16-BIT Arcade Music Track 1.mp3",
    "Lit-Zero 16-BIT Arcade Music Track 2.mp3",
    "Speedster 16-BIT Arcade Music Track 1.mp3",
    "Speedster 16-BIT Arcade Music Track 2.mp3",
    "Super Lit 16-BIT Arcade Music Track 1.mp3",
    "Super Lit 16-BIT Arcade Music Track 2.mp3",
]


TITLE_OVERRIDES = {
    "Hard Money Heroes 16-BIT Arcade Music (1)": "Hard Money Heroes 16-BIT Arcade Music Alt",
}


SLUG_OVERRIDES = {
    "Hard Money Heroes 16-BIT Arcade Music": HARD_MONEY_HEROES_PRIMARY_ID,
    "Hard Money Heroes 16-BIT Arcade Music Alt": HARD_MONEY_HEROES_ALT_ID,
}


CONTEXT_BY_PREFIX = {
    "Adventure": ["arcade", "adventure", "menu"],
    "CastleLitvania": ["arcade", "castlelitvania", "future-cabinet"],
    "Hard Money Heroes": ["arcade", "hard-money-heroes", "combat"],
    "Lit Country": ["arcade", "lit-country", "future-cabinet"],
    "Lit Fantasy": ["arcade", "lit-fantasy", "future-cabinet"],
    "Lit Man": ["arcade", "lit-man", "future-cabinet"],
    "Lit Trigger": ["arcade", "lit-trigger", "future-cabinet"],
    "LitBound": ["arcade", "litbound", "future-cabinet"],
    "Lit-Zero": ["arcade", "lit-zero", "future-cabinet"],
    "Speedster": ["arcade", "speedster", "future-cabinet"],
    "Super Lit": ["arcade", "super-lit", "future-cabinet"],
}


def slugify(value: str) -> str:
    value = value.lower()
    value = value.replace("16-bit", "16-bit")
    value = re.sub(r"[^a-z0-9]+", "-", value)
    return value.strip("-")


def title_for(path: Path) -> str:
    stem = path.stem
    return TITLE_OVERRIDES.get(stem, stem)


def track_id_for(title: str) -> str:
    return SLUG_OVERRIDES.get(title, slugify(title))


def duration_seconds(path: Path) -> float:
    try:
        output = subprocess.check_output(
            [
                "ffprobe",
                "-v",
                "error",
                "-show_entries",
                "format=duration",
                "-of",
                "default=noprint_wrappers=1:nokey=1",
                str(path),
            ],
            text=True,
            stderr=subprocess.DEVNULL,
        ).strip()
        return round(float(output), 3)
    except Exception as exc:  # pragma: no cover - fallback is for machines without ffprobe.
        raise RuntimeError(f"Could not read duration for {path}. Install ffprobe or verify the MP3 manually.") from exc


def duration_label(seconds: float) -> str:
    rounded = int(round(seconds))
    minutes = rounded // 60
    remainder = rounded % 60
    return f"{minutes}:{remainder:02d}"


def tags_for(title: str) -> list[str]:
    for prefix, tags in CONTEXT_BY_PREFIX.items():
        if title.startswith(prefix):
            return tags
    return ["arcade"]


def ordered_sources(source_dir: Path) -> list[Path]:
    files_by_name = {path.name: path for path in source_dir.glob("*.mp3")}
    ordered: list[Path] = []
    for filename in PREFERRED_ORDER:
        path = files_by_name.pop(filename, None)
        if path:
            ordered.append(path)
    ordered.extend(sorted(files_by_name.values(), key=lambda item: item.name.casefold()))
    return ordered


def js_module_for(manifest: dict) -> str:
    manifest_json = json.dumps(manifest, indent=2, ensure_ascii=False)
    return "\n".join(
        [
            "const freezeDeep = (value) => {",
            "  if (!value || typeof value !== 'object') return value;",
            "  for (const item of Object.values(value)) freezeDeep(item);",
            "  return Object.freeze(value);",
            "};",
            "",
            f"export const LESTER_ARCADE_PLAYLIST_MANIFEST = freezeDeep({manifest_json});",
            "",
            "export default LESTER_ARCADE_PLAYLIST_MANIFEST;",
            "",
        ]
    )


def build_manifest(source_dir: Path) -> dict:
    source_paths = ordered_sources(source_dir)
    if not source_paths:
        raise RuntimeError(f"No MP3 files found in {source_dir}")

    OUTPUT_DIR.mkdir(parents=True, exist_ok=True)
    tracks = []
    for index, source_path in enumerate(source_paths):
        title = title_for(source_path)
        track_id = track_id_for(title)
        destination = OUTPUT_DIR / f"{track_id}.mp3"
        shutil.copy2(source_path, destination)
        seconds = duration_seconds(destination)
        tracks.append(
            {
                "id": track_id,
                "title": title,
                "src": f"./assets/audio/playlist/{destination.name}",
                "sourceFile": source_path.name,
                "durationSeconds": seconds,
                "durationLabel": duration_label(seconds),
                "bytes": destination.stat().st_size,
                "tags": tags_for(title),
                "order": index,
            }
        )

    track_ids = [track["id"] for track in tracks]
    hmh_queue = [HARD_MONEY_HEROES_PRIMARY_ID, HARD_MONEY_HEROES_ALT_ID]
    hmh_queue.extend(track_id for track_id in track_ids if track_id not in hmh_queue)

    return {
        "id": MANIFEST_ID,
        "title": "Lester's Arcade Custom MP3 Playlist",
        "generatedFrom": source_dir.name or "Arcade Playlist Music",
        "player": {
            "mode": "global-overlay",
            "minimalByDefault": True,
            "expandable": True,
            "controls": ["previous", "play-pause", "mute", "next", "expand"],
            "description": "Parent arcade music player shared by cabinets so individual games can opt into queues instead of owning separate background music.",
        },
        "defaultQueue": track_ids,
        "gameQueues": {
            "hardMoneyHeroes": hmh_queue,
            "hard-money-heroes": hmh_queue,
        },
        "tracks": tracks,
    }


def main() -> None:
    import argparse

    parser = argparse.ArgumentParser(description="Copy Lester's Arcade MP3 playlist into portal assets and generate manifests.")
    parser.add_argument("--source", default=os.environ.get(SOURCE_DIR_ENV), help=f"Folder containing custom MP3 playlist tracks. Defaults to ${SOURCE_DIR_ENV}.")
    args = parser.parse_args()

    if not args.source:
        raise SystemExit(f"Pass --source or set {SOURCE_DIR_ENV} to the custom MP3 playlist folder.")
    source_dir = Path(args.source)
    if not source_dir.exists():
        raise SystemExit(f"Source playlist folder not found: {source_dir}")

    manifest = build_manifest(source_dir)
    JSON_MANIFEST_PATH.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    ESM_MANIFEST_PATH.write_text(js_module_for(manifest), encoding="utf-8")
    print(
        f"Ingested {len(manifest['tracks'])} Lester's Arcade playlist MP3s; "
        f"Hard Money Heroes starts with {manifest['gameQueues']['hardMoneyHeroes'][0]} -> {manifest['gameQueues']['hardMoneyHeroes'][1]}."
    )


if __name__ == "__main__":
    main()
