"""Build the Hard Money Heroes banner, loading and share art (2026-09-26 refresh).

The owner's 23 source PNGs (1672x941, no text in the art) live outside the
repository: the Desktop folder the owner exported them to, and the untouched
vault copy C:/Users/just_/lesters-arcade-vault/hmh-art/banners-2026-09-26/
(the future blog uses the vault copies). Sources are never committed (AGENTS.md
asset hygiene); this script writes only derivatives:

  apps/portal/assets/hmh-art/banners/<id>-{1600,960,640}.webp   homepage, backdrop, Free and Ranked banners
  apps/portal/assets/hmh-art/share/<id>-1600.webp               Free and Ranked share covers (sources of the
                                                                 og image and the E11/E12 card backgrounds)
  apps/portal/assets/hmh-art/loading/<id>-{1280,800,480}.webp   Level 1 intro and loading rotation pool (17)
  apps/portal/assets/hmh-art/og/hmh-free-share-1200x630.jpg     og:image and twitter:image of /games/hard-money-heroes
  apps/portal/assets/hmh-art/manifest.json                      per output: size, bytes, SHA-256; per source: SHA-256
  apps/portal/src/generated/hmh-banner-art.mjs                  the small banner table the portal bundle imports
  apps/portal/src/generated/hmh-loading-art.mjs                 the rotation pool (lazy modules only)

Output is deterministic for a given Pillow/libwebp build: no timestamps, no
metadata, fixed encoder settings. The manifest records the versions used.

Usage:
  python scripts/build-hmh-banner-art.py [--source DIR]   # write everything from the sources
  python scripts/build-hmh-banner-art.py --check          # verify committed outputs; needs no sources
  python scripts/build-hmh-banner-art.py --preview        # also write a crop contact sheet to .tmp/
After a rebuild, run python scripts/build-share-card-backgrounds.py --only lester-blaster,lester-blaster-free
so the share-card backgrounds follow the new share covers.
"""

from __future__ import annotations

import argparse
import hashlib
import io
import json
import sys
from pathlib import Path

from PIL import Image, ImageDraw, ImageFont, features

ROOT = Path(__file__).resolve().parents[1]
DEFAULT_SOURCE = Path("C:/Users/just_/lesters-arcade-vault/hmh-art/banners-2026-09-26")
OUT_DIR = ROOT / "apps" / "portal" / "assets" / "hmh-art"
PUBLIC_BASE = "/assets/hmh-art"
MANIFEST = OUT_DIR / "manifest.json"
BANNER_MODULE = ROOT / "apps" / "portal" / "src" / "generated" / "hmh-banner-art.mjs"
LOADING_MODULE = ROOT / "apps" / "portal" / "src" / "generated" / "hmh-loading-art.mjs"
FONT = ROOT / "node_modules" / "@vercel" / "og" / "dist" / "Geist-Regular.ttf"
PREVIEW = ROOT / ".tmp" / "hmh-banner-art-preview.jpg"

SOURCE_SIZE = (1672, 941)
WEBP_QUALITY = 80
WEBP_METHOD = 6
OG_SIZE = (1200, 630)
OG_QUALITY = 85

# Byte caps per output width (section 7 of docs/art/HMH-BANNERS-20260926.md).
BYTE_CAPS = {1600: 340_000, 1280: 260_000, 960: 200_000, 800: 130_000, 640: 90_000, 480: 60_000}
OG_MAX_BYTES = 300_000
TOTAL_MAX_BYTES = 9_000_000

HEROES = ("lit-commando", "lit-valkyrie", "lester-original", "lilly")
HERO_NAMES = {"lit-commando": "Lit Commando", "lit-valkyrie": "Lit Valkyrie", "lester-original": "Lester", "lilly": "Lilly"}
ALL = HEROES

# role -> output widths (16:9 each)
ROLE_WIDTHS = {"banner": (1600, 960, 640), "share": (1600,), "loading": (1280, 800, 480)}
ROLE_DIRS = {"banner": "banners", "share": "share", "loading": "loading"}

# (source file, id, role, heroes, focal x, focal y, alt text)
IMAGES = (
    ("HMH-Extra4.png", "hmh-extra4", "banner", ALL, 0.72, 0.35,
     "Lit Commando, Lit Valkyrie, Lester and Lilly hold a moonlit forest against the horde"),
    ("HMH-FreeMode2.png", "hmh-freemode2", "banner", ("lit-commando", "lit-valkyrie"), 0.71, 0.22,
     "Lit Commando and Lit Valkyrie advance along a moonlit forest trail with zombies behind them"),
    ("HMH-RankedMode.png", "hmh-rankedmode", "banner", ("lester-original", "lilly"), 0.68, 0.30,
     "Lester and Lilly fire on the horde in front of a burning fortress"),
    ("HMH-FreeMode-Share.png", "hmh-freemode-share", "share", ALL, 0.73, 0.30,
     "The four Hard Money Heroes crouch by a dark forest stream"),
    ("HMH-RankedMode-Share.png", "hmh-rankedmode-share", "share", ALL, 0.74, 0.30,
     "The four Hard Money Heroes fight the horde in a burning city"),
    ("Level-Load-Lester.png", "level-load-lester", "loading", ("lester-original",), 0.32, 0.30,
     "Lester at a rainy harbour below a lighthouse"),
    ("Level-Load-Lilly.png", "level-load-lilly", "loading", ("lilly",), 0.28, 0.25,
     "Lilly on the container docks under the cranes"),
    ("Level-Load-LitCommando.png", "level-load-litcommando", "loading", ("lit-commando",), 0.64, 0.25,
     "Lit Commando on a burning town street beside a pickup truck"),
    ("Level-Load-LitValkyrie.png", "level-load-litvalkyrie", "loading", ("lit-valkyrie",), 0.60, 0.25,
     "Lit Valkyrie on an industrial catwalk lit by lanterns"),
    ("Level-Load-Extra-02.png", "level-load-extra-02", "loading", ("lilly",), 0.30, 0.25,
     "Lilly in a sunlit forest ravine as zombies close in"),
    ("Level-Load-Extra-03.png", "level-load-extra-03", "loading", ("lit-commando",), 0.62, 0.25,
     "Lit Commando on a stormy boardwalk by a ferris wheel"),
    ("Level-Load-Extra-04.png", "level-load-extra-04", "loading", ("lit-valkyrie",), 0.32, 0.25,
     "Lit Valkyrie on a snowy convoy road"),
    ("Level-Load-Extra-05.png", "level-load-extra-05", "loading", ("lester-original",), 0.30, 0.30,
     "Lester in a rail yard under a burning skyline"),
    ("Level-Load-Extra-07.png", "level-load-extra-07", "loading", ("lester-original",), 0.32, 0.25,
     "Lester at a logging camp at sunset"),
    ("Level-Load-Extra-08.png", "level-load-extra-08", "loading", ("lilly",), 0.25, 0.25,
     "Lilly on a flooded subway platform"),
    ("Level-Load-Extra-09.png", "level-load-extra-09", "loading", ("lit-commando",), 0.30, 0.20,
     "Lit Commando at a rainy forest checkpoint"),
    ("Level-Load-Extra-10.png", "level-load-extra-10", "loading", ALL, 0.68, 0.35,
     "All four heroes charge through city ruins"),
    ("Level-Load-Extra-11.png", "level-load-extra-11", "loading", ("lilly",), 0.30, 0.20,
     "Lilly on overgrown rooftops above the skyline"),
    ("Level-Load-Extra-12.png", "level-load-extra-12", "loading", ("lit-valkyrie",), 0.65, 0.30,
     "Lit Valkyrie on an overpass among wrecked cars"),
    ("HMH-Extra.png", "hmh-extra", "loading", ("lilly", "lester-original"), 0.70, 0.25,
     "Lilly and Lester in a moonlit forest"),
    ("HMH-Extra2.png", "hmh-extra2", "loading", ("lit-commando", "lit-valkyrie"), 0.71, 0.22,
     "Lit Commando and Lit Valkyrie in a moonlit forest with the horde behind them"),
    ("HMH-Extra3.png", "hmh-extra3", "loading", ("lester-original", "lilly"), 0.71, 0.28,
     "Lester and Lilly in a forest hung with Litecoin banners"),
)

# Owner decision 2026-09-27: no image that shows a Bitcoin logo joins the Level 1 rotation.
# These sources stay in the vault (and the blog may use them) but ship no derivative.
EXCLUDED = {
    "Level-Load-Extra-01.png": "zombies wear glowing Bitcoin logos (owner rule: no Bitcoin logo in the rotation)",
}

# The selected hero's own loading image opens every rotation.
HERO_LOADING = {
    "lit-commando": "level-load-litcommando",
    "lit-valkyrie": "level-load-litvalkyrie",
    "lester-original": "level-load-lester",
    "lilly": "level-load-lilly",
}

# Surface -> banner id (the banner table the portal bundle imports).
BANNER_SURFACES = {
    "home": "hmh-extra4",
    "free": "hmh-freemode2",
    "ranked": "hmh-rankedmode",
}

OG = {
    "id": "hmh-free-share-og",
    "source": "hmh-freemode-share",
    "path": "og/hmh-free-share-1200x630.jpg",
    "alt": "Hard Money Heroes: the four heroes in a dark forest. Play free at Lester's Arcade.",
}


def sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def caption(heroes: tuple[str, ...]) -> str:
    if len(heroes) == len(HEROES):
        return "All four heroes"
    return " & ".join(HERO_NAMES[hero] for hero in heroes)


def to_16_9(image: Image.Image) -> Image.Image:
    """Trim the 1672x941 source to an exact 16:9 frame (1672x940.5 -> 1672x940)."""
    width, height = image.size
    target_h = round(width * 9 / 16)
    if target_h <= height:
        top = (height - target_h) // 2
        return image.crop((0, top, width, top + target_h))
    target_w = round(height * 16 / 9)
    left = (width - target_w) // 2
    return image.crop((left, 0, left + target_w, height))


def encode_webp(image: Image.Image) -> bytes:
    buffer = io.BytesIO()
    image.save(buffer, format="WEBP", quality=WEBP_QUALITY, method=WEBP_METHOD, exact=False)
    return buffer.getvalue()


def cover_crop(image: Image.Image, size: tuple[int, int], focus_x: float, focus_y: float) -> Image.Image:
    width, height = size
    scale = max(width / image.width, height / image.height)
    resized = image.resize((round(image.width * scale), round(image.height * scale)), Image.Resampling.LANCZOS)
    left = round((resized.width - width) * focus_x)
    top = round((resized.height - height) * focus_y)
    return resized.crop((left, top, left + width, top + height))


def build_og(share_art: Image.Image, focus: tuple[float, float]) -> bytes:
    """The Free share cover: the art, a left scrim and a text lockup in the dark left area."""
    width, height = OG_SIZE
    art = cover_crop(share_art, OG_SIZE, *focus)
    mask = Image.new("L", OG_SIZE, 0)
    pixels = mask.load()
    for x in range(width):
        left = max(0.0, 1.0 - x / (width * 0.62))
        for y in range(height):
            bottom = max(0.0, (y / height - 0.7) / 0.3)
            pixels[x, y] = round(255 * min(0.94, 0.94 * left ** 1.25 + 0.35 * bottom * bottom))
    navy = Image.new("RGB", OG_SIZE, (5, 7, 15))
    card = Image.composite(navy, art, mask)
    draw = ImageDraw.Draw(card)

    def font(size: int) -> ImageFont.FreeTypeFont:
        return ImageFont.truetype(str(FONT), size)

    x = 64
    # Sizes keep every line left of x = 520, where Lilly's rifle enters the frame.
    draw.text((x, 70), "LESTER'S ARCADE · FREE MODE", font=font(26), fill=(25, 247, 255))
    draw.text((x, 120), "Hard Money", font=font(78), fill=(255, 255, 255), stroke_width=2, stroke_fill=(255, 255, 255))
    draw.text((x, 206), "Heroes", font=font(78), fill=(255, 255, 255), stroke_width=2, stroke_fill=(255, 255, 255))
    draw.rectangle((x, 322, x + 96, 327), fill=(25, 247, 255))
    draw.text((x, 356), "Top-down roguelike run-and-gun.", font=font(29), fill=(228, 228, 231))
    draw.text((x, 398), "Pick a hero. Hold off the horde.", font=font(29), fill=(228, 228, 231))
    draw.text((x, 440), "Play free in your browser.", font=font(29), fill=(228, 228, 231))
    draw.text((x, 548), "lestersarcade.io", font=font(26), fill=(161, 161, 170))
    buffer = io.BytesIO()
    card.save(buffer, format="JPEG", quality=OG_QUALITY, optimize=True, progressive=True, subsampling="4:2:0")
    return buffer.getvalue()


def output_entry(relative: str, data: bytes, size: tuple[int, int]) -> dict:
    return {"path": relative, "width": size[0], "height": size[1], "bytes": len(data), "sha256": sha256(data)}


def recorded_source_hashes() -> dict[str, str]:
    if not MANIFEST.exists():
        return {}
    return {image["id"]: image["sourceSha256"] for image in json.loads(MANIFEST.read_text(encoding="utf-8"))["images"]}


def build(source_dir: Path, accept_new_sources: bool = False) -> dict:
    recorded = recorded_source_hashes()
    manifest_images = []
    files: dict[str, bytes] = {}
    share_sources: dict[str, Image.Image] = {}
    for filename, image_id, role, heroes, fx, fy, alt in IMAGES:
        raw = (source_dir / filename).read_bytes()
        if not accept_new_sources and image_id in recorded and recorded[image_id] != sha256(raw):
            raise ValueError(f"{filename} differs from the source recorded in the manifest; pass --accept-new-sources for new owner art")
        with Image.open(io.BytesIO(raw)) as opened:
            if opened.size != SOURCE_SIZE:
                raise ValueError(f"{filename} is {opened.size}, expected {SOURCE_SIZE}")
            frame = to_16_9(opened.convert("RGB"))
        outputs = []
        for width in ROLE_WIDTHS[role]:
            size = (width, width * 9 // 16)
            resized = frame.resize(size, Image.Resampling.LANCZOS)
            data = encode_webp(resized)
            relative = f"{ROLE_DIRS[role]}/{image_id}-{width}.webp"
            files[relative] = data
            outputs.append(output_entry(relative, data, size))
        if role == "share":
            share_sources[image_id] = frame
        manifest_images.append({
            "id": image_id, "source": filename, "sourceSha256": sha256(raw), "role": role,
            "heroes": list(heroes), "caption": caption(heroes), "focal": [fx, fy], "alt": alt,
            "outputs": outputs,
        })
    og_source = next(image for image in manifest_images if image["id"] == OG["source"])
    og_data = build_og(share_sources[OG["source"]], tuple(og_source["focal"]))
    files[OG["path"]] = og_data
    manifest = {
        "schema": 1,
        "generator": "scripts/build-hmh-banner-art.py",
        "plan": "docs/art/HMH-BANNERS-20260926.md",
        "vault": "C:/Users/just_/lesters-arcade-vault/hmh-art/banners-2026-09-26/",
        "encoder": {"pillow": Image.__version__, "libwebp": features.version("webp"), "webpQuality": WEBP_QUALITY,
                    "webpMethod": WEBP_METHOD, "ogQuality": OG_QUALITY, "font": "@vercel/og Geist-Regular.ttf",
                    "fontSha256": sha256(FONT.read_bytes())},
        "publicBase": PUBLIC_BASE,
        "heroLoading": HERO_LOADING,
        "bannerSurfaces": BANNER_SURFACES,
        "images": manifest_images,
        "excluded": [{"source": name, "reason": reason} for name, reason in EXCLUDED.items()],
        "og": {**OG, **output_entry(OG["path"], og_data, OG_SIZE)},
    }
    return {"manifest": manifest, "files": files}


def js(value) -> str:
    return json.dumps(value, ensure_ascii=False, separators=(",", ":"))


def srcset(image: dict) -> str:
    return ", ".join(f"{PUBLIC_BASE}/{output['path']} {output['width']}w" for output in image["outputs"])


def banner_module(manifest: dict) -> str:
    """Kept small: it sits in the portal's initial bundle (about 7 KB of headroom)."""
    by_id = {image["id"]: image for image in manifest["images"]}
    widths = list(ROLE_WIDTHS["banner"])
    lines = [
        "// Generated by scripts/build-hmh-banner-art.py from apps/portal/assets/hmh-art/manifest.json. Do not edit.",
        "// Hard Money Heroes banner art (2026-09-26 refresh): the small table the portal bundle imports.",
        "// The Level 1 rotation pool lives in ./hmh-loading-art.mjs, which only lazy modules import.",
        f"const B={js(PUBLIC_BASE + '/banners/')},W={js(widths)};",
        "export const hmhBannerSrc=(id,width=W[0])=>B+id+'-'+width+'.webp';",
        "export const hmhBannerSrcset=id=>W.map(width=>hmhBannerSrc(id,width)+' '+width+'w').join(', ');",
        "export const HMH_BANNER_ART=Object.freeze({",
    ]
    for surface, image_id in BANNER_SURFACES.items():
        image = by_id[image_id]
        fx, fy = image["focal"]
        lines.append(f"  {surface}:Object.freeze({{id:{js(image_id)},position:{js(f'{round(fx * 100)}% {round(fy * 100)}%')},alt:{js(image['alt'])}}}),")
    lines.append("});")
    og = manifest["og"]
    lines.append(f"export const HMH_FREE_SHARE_OG=Object.freeze({{src:{js(PUBLIC_BASE + '/' + og['path'])},width:{og['width']},height:{og['height']},alt:{js(og['alt'])}}});")
    return "\n".join(lines) + "\n"


def loading_module(manifest: dict) -> str:
    lines = [
        "// Generated by scripts/build-hmh-banner-art.py from apps/portal/assets/hmh-art/manifest.json. Do not edit.",
        "// The Level 1 intro and loading rotation pool (docs/art/HMH-BANNERS-20260926.md section 5.6).",
        "// Imported only by lazily loaded presentation modules; never by apps/hmh-reboot/src.",
        f"export const HMH_ART_BASE={js(PUBLIC_BASE)};",
        f"export const HMH_HERO_LOADING=Object.freeze({js(HERO_LOADING)});",
        "export const HMH_LOADING_POOL=Object.freeze([",
    ]
    for image in manifest["images"]:
        if image["role"] != "loading":
            continue
        widths = {output["width"]: PUBLIC_BASE + "/" + output["path"] for output in image["outputs"]}
        fx, fy = image["focal"]
        lines.append(f"  Object.freeze({{id:{js(image['id'])},heroes:Object.freeze({js(image['heroes'])}),caption:{js(image['caption'])},"
                     f"alt:{js(image['alt'])},focal:{js(f'{round(fx * 100)}% {round(fy * 100)}%')},"
                     f"src:{js(widths[800])},thumb:{js(widths[480])},srcset:{js(srcset(image))}}}),")
    lines.append("]);")
    return "\n".join(lines) + "\n"


def manifest_text(manifest: dict) -> str:
    return json.dumps(manifest, indent=2, ensure_ascii=False) + "\n"


def webp_size(data: bytes) -> tuple[int, int] | None:
    with Image.open(io.BytesIO(data)) as image:
        return image.size if image.format in ("WEBP", "JPEG") else None


def check() -> list[str]:
    problems: list[str] = []
    if not MANIFEST.exists():
        return [f"{MANIFEST.relative_to(ROOT).as_posix()} is missing"]
    manifest = json.loads(MANIFEST.read_text(encoding="utf-8"))
    outputs = [output for image in manifest["images"] for output in image["outputs"]] + [manifest["og"]]
    expected = set()
    total = 0
    for output in outputs:
        path = OUT_DIR / output["path"]
        expected.add(output["path"])
        if not path.exists():
            problems.append(f"{output['path']} is missing")
            continue
        data = path.read_bytes()
        total += len(data)
        if len(data) != output["bytes"] or sha256(data) != output["sha256"]:
            problems.append(f"{output['path']} differs from the manifest")
        size = webp_size(data)
        if size != (output["width"], output["height"]):
            problems.append(f"{output['path']} is {size}, manifest says {output['width']}x{output['height']}")
        cap = OG_MAX_BYTES if output is manifest["og"] else BYTE_CAPS.get(output["width"])
        if cap and len(data) > cap:
            problems.append(f"{output['path']} is {len(data)} bytes (cap {cap})")
    if manifest["og"]["width"] != OG_SIZE[0] or manifest["og"]["height"] != OG_SIZE[1]:
        problems.append("the og image must be 1200x630")
    present = {path.relative_to(OUT_DIR).as_posix() for path in OUT_DIR.rglob("*") if path.is_file() and path != MANIFEST}
    for stray in sorted(present - expected):
        problems.append(f"{stray} is not in the manifest")
    if total > TOTAL_MAX_BYTES:
        problems.append(f"derivatives total {total} bytes (cap {TOTAL_MAX_BYTES})")
    for module, text in ((BANNER_MODULE, banner_module(manifest)), (LOADING_MODULE, loading_module(manifest))):
        if not module.exists() or module.read_text(encoding="utf-8") != text:
            problems.append(f"{module.relative_to(ROOT).as_posix()} does not match the manifest; rerun the builder")
    loading_ids = {image["id"] for image in manifest["images"] if image["role"] == "loading"}
    excluded = {entry["source"] for entry in manifest.get("excluded", [])}
    if excluded != set(EXCLUDED):
        problems.append("the manifest's excluded sources differ from EXCLUDED; rerun the builder")
    for image in manifest["images"]:
        if image["source"] in EXCLUDED:
            problems.append(f"{image['source']} is excluded from the rotation but has derivatives")
    for hero in HEROES:
        if manifest["heroLoading"].get(hero) not in loading_ids:
            problems.append(f"hero {hero} has no loading image")
    print(f"apps/portal/assets/hmh-art: {len(outputs)} files, {total} bytes")
    return problems


def preview(files: dict[str, bytes], manifest: dict) -> None:
    """Contact sheet of every crop the pages use: 16:7 desktop banner, 16:9, phone 4:5 and the og card."""
    tiles = []
    for image in manifest["images"]:
        largest = image["outputs"][0]
        with Image.open(io.BytesIO(files[largest["path"]])) as art:
            art = art.convert("RGB")
            fx, fy = image["focal"]
            row = [art.resize((320, 180))]
            if image["role"] == "banner":
                row.append(cover_crop(art, (320, 140), fx, fy))
                row.append(cover_crop(art, (144, 180), fx, fy))
            tiles.append((image["id"], row))
    with Image.open(io.BytesIO(files[OG["path"]])) as og:
        tiles.append(("og", [og.convert("RGB").resize((343, 180))]))
    sheet = Image.new("RGB", (900, 200 * len(tiles)), (20, 20, 28))
    draw = ImageDraw.Draw(sheet)
    for index, (label, row) in enumerate(tiles):
        x = 10
        for tile in row:
            sheet.paste(tile, (x, index * 200 + 16))
            x += tile.width + 10
        draw.text((x + 4, index * 200 + 16), label, fill=(230, 230, 230))
    PREVIEW.parent.mkdir(parents=True, exist_ok=True)
    sheet.save(PREVIEW, quality=88)
    print(f"preview: {PREVIEW}")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="folder with the 23 owner PNGs")
    parser.add_argument("--check", action="store_true", help="verify the committed outputs; needs no sources")
    parser.add_argument("--accept-new-sources", action="store_true", help="allow sources whose SHA-256 differs from the manifest")
    parser.add_argument("--preview", action="store_true", help="write a crop contact sheet to .tmp/")
    args = parser.parse_args()
    if not args.check:
        result = build(args.source, args.accept_new_sources)
        manifest, files = result["manifest"], result["files"]
        for relative, data in files.items():
            target = OUT_DIR / relative
            target.parent.mkdir(parents=True, exist_ok=True)
            if not target.exists() or target.read_bytes() != data:
                target.write_bytes(data)
        MANIFEST.write_text(manifest_text(manifest), encoding="utf-8", newline="\n")
        BANNER_MODULE.write_text(banner_module(manifest), encoding="utf-8", newline="\n")
        LOADING_MODULE.write_text(loading_module(manifest), encoding="utf-8", newline="\n")
        if args.preview:
            preview(files, manifest)
    problems = check()
    if problems:
        print("\n".join(problems), file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    sys.exit(main())
