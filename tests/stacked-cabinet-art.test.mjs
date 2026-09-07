import test from 'node:test';
import assert from 'node:assert/strict';
import { access, readFile, stat } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';

import {
  ARCADE_GAMES,
  CABINET_MODE_SELECT_PRESENTATIONS,
  LESTERS_ARCADE_V2_APP_SHELL,
} from '../apps/portal/src/arcade-core.mjs';

const portalRoot = new URL('../apps/portal/', import.meta.url);
const byteCaps = new Map([
  ['./assets/cabinet-stacked.svg', 4 * 1024],
  ['./assets/cartridge-stacked.svg', 2 * 1024],
  ['./assets/stacked-mode-select/stacked-mode-bg.svg', 6 * 1024],
  ['./assets/stacked-mode-select/stacked-free-banner.svg', 6 * 1024],
  ['./assets/stacked-mode-select/stacked-ranked-banner.svg', 6 * 1024],
]);

test('STACKED placeholder art is safe, bounded hand-authored SVG', async () => {
  const game = ARCADE_GAMES.find((candidate) => candidate.id === 'stacked');
  const cabinet = LESTERS_ARCADE_V2_APP_SHELL.cabinets.find((candidate) => candidate.id === 'stacked');
  const mode = CABINET_MODE_SELECT_PRESENTATIONS.stacked;
  const referenced = new Set([
    game.presentation.cabinetAsset,
    game.presentation.cartridgeAsset,
    cabinet.bannerArt,
    mode.backgroundAsset,
    mode.free.bannerAsset,
    mode.ranked.bannerAsset,
  ]);

  assert.equal(game.desktopCabinetSprite, undefined);
  assert.equal(cabinet.desktopCabinetSprite, undefined);
  assert.equal(referenced.size, 5);
  for (const asset of referenced) {
    assert.match(asset, /^\.\/assets\/.*\.svg$/);
    const relativePath = asset.replace(/^\.\//, '');
    const url = new URL(relativePath, portalRoot);
    const [source, info] = await Promise.all([readFile(url, 'utf8'), stat(url)]);
    assert.ok(info.size <= byteCaps.get(asset), `${asset} exceeds its byte cap`);
    assert.match(source, /^\s*<svg\b[^>]*>[\s\S]*<\/svg>\s*$/i, `${asset} must have an svg root`);
    assert.doesNotMatch(source, /<script\b|<foreignObject\b|xlink:href|data:image|#frame=/i);
  }
});

test('STACKED manifest entry shim exists and points only at the intended S-02 module', async () => {
  const shim = new URL('../apps/portal/games/stacked/main.mjs', import.meta.url);
  await access(shim);
  const source = await readFile(shim, 'utf8');
  const exportPath = source.match(/^export \* from '([^']+)';\s*$/)?.[1];
  assert.equal(exportPath, '../../src/stacked-sim.mjs');
  assert.equal(
    new URL(exportPath, shim).href,
    new URL('../apps/portal/src/stacked-sim.mjs', import.meta.url).href,
    'the manifest shim must resolve to the canonical S-02 portal source',
  );
  assert.equal(fileURLToPath(shim).endsWith('games\\stacked\\main.mjs'), true);
});
