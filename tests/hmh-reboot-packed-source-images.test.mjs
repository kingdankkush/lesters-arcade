import assert from 'node:assert/strict';
import test from 'node:test';
import { spawnSync } from 'node:child_process';

// Execute the production function; only bpy's datablocks are substituted.
function inspect(data) {
  const code = `
import ast, json
from pathlib import Path
from types import SimpleNamespace as NS
source = Path('scripts/hmh-blender/create-hmh-commando-concepts.py').read_text(encoding='utf-8')
fn = next(n for n in ast.parse(source).body if isinstance(n, ast.FunctionDef) and n.name == 'external_dependencies')
data = json.loads(${JSON.stringify(JSON.stringify(data))})
bpy = NS(data=NS(**{k: [NS(**x) for x in data.get(k, [])] for k in ['images','movieclips','sounds','fonts','libraries']}))
namespace = {'bpy': bpy}
exec(compile(ast.Module(body=[fn], type_ignores=[]), '<production>', 'exec'), namespace)
print(json.dumps(namespace['external_dependencies']()))
`;
  const result = spawnSync(process.env.HMH_PYTHON || 'python', ['-c', code], { cwd: new URL('..', import.meta.url), encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return JSON.parse(result.stdout);
}

test('packed_file data remains self-contained for all supported media', () => {
  assert.deepEqual(inspect(Object.fromEntries(['images','movieclips','sounds','fonts'].map(k => [k, [{filepath: '//source.png', packed_file: {size: 10}}]]))), []);
});

test('packed_files-only image collection is self-contained', () => {
  assert.deepEqual(inspect({ images: [{filepath: '//tiled.png', packed_file: null, packed_files: [{size: 10}]}] }), []);
});

test('unpacked media and empty packed collections remain external', () => {
  assert.deepEqual(inspect({ images: [{filepath: '//missing.png', packed_files: []}], movieclips: [{filepath: '//movie.mp4'}], sounds: [{filepath: '//sound.wav'}], fonts: [{filepath: '//font.ttf'}] }), ['//font.ttf','//missing.png','//movie.mp4','//sound.wav']);
});

test('linked libraries always block; builtins and empty media paths do not', () => {
  assert.deepEqual(inspect({ images: [{filepath: ''}], fonts: [{filepath: '<builtin>'}], libraries: [{filepath: '//linked.blend', packed_file: true}, {filepath: '//linked.blend'}] }), ['//linked.blend']);
});

test('an unpacked LFS reference is not equivalent to bytes packed into Blender', () => {
  assert.deepEqual(inspect({ images: [{filepath: '//source-lfs-pointer.png', packed_file: null, packed_files: []}] }), ['//source-lfs-pointer.png']);
});
