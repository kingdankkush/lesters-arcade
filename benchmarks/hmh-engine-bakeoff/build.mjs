import { build } from 'esbuild';
import { cp, mkdir, stat } from 'node:fs/promises';
import { resolve } from 'node:path';

await mkdir('dist', { recursive: true });
const alias = {
  'pixi.js': resolve('node_modules/pixi.js/dist/pixi.mjs'),
  phaser: resolve('node_modules/phaser/dist/phaser.esm.js'),
};
for (const [entry, outfile] of [['pixi-entry.mjs', 'dist/pixi.js'], ['phaser-entry.mjs', 'dist/phaser.js']]) {
  await build({ entryPoints: [entry], outfile, alias, absWorkingDir: process.cwd(), bundle: true, format: 'esm', platform: 'browser', target: ['es2022'], minify: true, sourcemap: false, legalComments: 'none' });
}
await Promise.all([
  cp('pixi.html', 'dist/pixi.html'),
  cp('phaser.html', 'dist/phaser.html'),
  cp('shared/style.css', 'dist/style.css'),
]);
for (const file of ['dist/pixi.js', 'dist/phaser.js']) {
  console.log(file, (await stat(file)).size);
}
