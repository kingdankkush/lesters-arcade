import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const read = (relative) => readFileSync(`${root}/${relative}`, 'utf8');

test('portal chrome uses one accessible SVG icon sprite instead of platform emoji glyphs', () => {
  const index = read('apps/portal/index.html');
  const main = read('apps/portal/main.js');
  const styles = read('apps/portal/styles.css');
  const spritePath = `${root}/apps/portal/assets/icons/arcade-ui.svg`;

  assert.equal(existsSync(spritePath), true, 'shared arcade UI sprite must exist');
  const sprite = read('apps/portal/assets/icons/arcade-ui.svg');
  for (const id of ['play', 'pause', 'previous', 'next', 'volume', 'mute', 'shuffle', 'chevron-up', 'chevron-down', 'back', 'infinity', 'star', 'menu', 'arcade', 'profile', 'trophy', 'settings', 'lock']) {
    assert.match(sprite, new RegExp(`<symbol\\s+id="${id}"`), `missing #${id}`);
  }

  assert.match(main, /function renderArcadeIcon\(iconId/);
  assert.match(main, /ARCADE_ICON_SPRITE = '\.\/assets\/icons\/arcade-ui\.svg'/);
  assert.match(main, /`\$\{ARCADE_ICON_SPRITE\}#\$\{semanticId\}`/);
  assert.match(styles, /\.arcade-svg-icon/);
  assert.doesNotMatch(index, /[⏮⏭🔊▶⇄▾]/u);
  assert.doesNotMatch(main, /textContent\s*=\s*[^;]*[🔊🔇⏸▶☰]/u);
  assert.doesNotMatch(main, /const iconById = \{[^}]*[🕹👤🏆⚙]/u);

  for (const id of ['arcadeMusicPreviousButton', 'arcadeMusicPlayButton', 'arcadeMusicMuteButton', 'arcadeMusicNextButton', 'arcadeMusicShuffleButton', 'arcadeMusicExpandButton']) {
    assert.match(index, new RegExp(`id="${id}"[^>]+aria-label="[^"]+"`), `${id} needs an accessible name`);
  }
});
