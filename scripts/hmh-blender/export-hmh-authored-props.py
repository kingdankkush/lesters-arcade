from __future__ import annotations

import argparse
import json
import sys
from pathlib import Path

import bpy


def blender_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument('--manifest', required=True)
    parser.add_argument('--raw-output', required=True)
    parser.add_argument('--report-output', required=True)
    return parser.parse_args(argv)


def main() -> None:
    args = blender_args()
    manifest = json.loads(Path(args.manifest).resolve().read_text(encoding='utf-8'))
    raw_output = Path(args.raw_output).resolve()
    raw_output.mkdir(parents=True, exist_ok=True)
    for stale in raw_output.glob('*.png'):
        stale.unlink()

    scene = bpy.context.scene
    scene.render.resolution_x = manifest['render']['frameSize'][0]
    scene.render.resolution_y = manifest['render']['frameSize'][1]
    scene.render.resolution_percentage = 100
    scene.render.film_transparent = True
    scene.render.image_settings.file_format = 'PNG'
    scene.render.image_settings.color_mode = 'RGBA'
    scene.render.image_settings.color_depth = '8'
    scene.render.image_settings.compression = 20

    objects = [obj for obj in bpy.data.objects if obj.get('hmh_asset_id')]
    rendered = []
    for asset in manifest['assets']:
        asset_id = asset['assetId']
        selected = [obj for obj in objects if obj.get('hmh_asset_id') == asset_id]
        if not selected:
            raise RuntimeError(f'No authored objects for {asset_id}')
        for obj in objects:
            obj.hide_render = obj.get('hmh_asset_id') != asset_id
        # Detail-heavy world props render at a higher per-asset resolution; the
        # camera is orthographic, so this only raises pixel density.
        frame_size = asset.get('frameSize', manifest['render']['frameSize'])
        scene.render.resolution_x = frame_size[0]
        scene.render.resolution_y = frame_size[1]
        filename = f'{asset_id}.png'
        scene.render.filepath = str(raw_output / filename)
        bpy.context.view_layer.update()
        bpy.ops.render.render(write_still=True)
        rendered.append(filename)

    for obj in objects:
        obj.hide_render = True
    report = {'status':'pass','pipelineId':manifest['pipelineId'],'frameCount':len(rendered),'frames':rendered}
    output = Path(args.report_output).resolve()
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(json.dumps(report,indent=2)+'\n',encoding='utf-8',newline='\n')
    print(json.dumps({'status':'pass','frameCount':len(rendered)},sort_keys=True))


if __name__=='__main__': main()
