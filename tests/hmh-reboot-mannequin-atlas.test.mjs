import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import {
  MANNEQUIN_ATLAS_IMAGE_URL,
  MANNEQUIN_ATLAS_METADATA_URL,
  MANNEQUIN_RUNTIME_SCALE,
  createMannequinAtlasIndex,
  createMannequinDisplay,
  directionNameForIndex,
  resolveMannequinPose,
} from '../apps/hmh-reboot/src/mannequin-atlas.mjs';

const metadata = JSON.parse(readFileSync(new URL('../apps/portal/assets/generated/hmh-reboot-mannequin/hmh-reboot-mannequin-atlas.json', import.meta.url), 'utf8'));

class FakeRectangle {
  constructor(x, y, width, height) {
    Object.assign(this, { x, y, width, height });
  }
}

class FakeTexture {
  constructor(options) {
    this.source = options.source;
    this.frame = options.frame;
  }
}

class FakeSprite {
  constructor({ texture }) {
    this.texture = texture;
    this.anchor = {
      x: 0,
      y: 0,
      set: (x, y) => Object.assign(this.anchor, { x, y }),
    };
  }
}

class FakeContainer {
  constructor() {
    this.children = [];
    this.scale = { set: (value) => { this.scale.value = value; } };
  }

  addChild(...children) {
    this.children.push(...children);
  }
}

test('runtime atlas URLs are same-origin generated assets', () => {
  assert.equal(MANNEQUIN_ATLAS_IMAGE_URL, '/assets/generated/hmh-reboot-mannequin/hmh-reboot-mannequin-atlas.png');
  assert.equal(MANNEQUIN_ATLAS_METADATA_URL, '/assets/generated/hmh-reboot-mannequin/hmh-reboot-mannequin-atlas.json');
  assert.equal(MANNEQUIN_RUNTIME_SCALE, 0.72);
});

test('simulation direction indices map explicitly to screen-semantic atlas directions', () => {
  assert.deepEqual(Array.from({ length: 8 }, (_, index) => directionNameForIndex(index)), [
    'east',
    'south-east',
    'south',
    'south-west',
    'west',
    'north-west',
    'north',
    'north-east',
  ]);
  assert.equal(directionNameForIndex(8), 'east');
  assert.equal(directionNameForIndex(-1), 'north-east');
  assert.throws(() => directionNameForIndex(0.5), /integer/);
});

test('pose resolution composes independent deterministic leg and torso frames', () => {
  const index = createMannequinAtlasIndex(metadata);
  const moving = resolveMannequinPose(index, {
    simulationTick: 17,
    locomotion: 'moving',
    legDirection: 0,
    torsoDirection: 2,
  });
  assert.deepEqual(moving.map((frame) => frame.layer), ['shadow', 'lower-body', 'torso-head', 'weapon']);
  assert.equal(moving[0].direction, 'east');
  assert.deepEqual(
    [moving[1].state, moving[1].direction, moving[1].frameIndex],
    ['run', 'east', 3],
  );
  assert.deepEqual(
    [moving[2].state, moving[2].direction, moving[2].frameIndex],
    ['aim', 'south', 0],
  );
  assert.deepEqual(
    [moving[3].state, moving[3].direction, moving[3].frameIndex],
    ['aim', 'south', 0],
  );

  const idle = resolveMannequinPose(index, {
    simulationTick: 999,
    locomotion: 'idle',
    legDirection: 7,
    torsoDirection: 4,
  });
  assert.deepEqual([idle[1].state, idle[1].frameIndex, idle[1].direction], ['idle', 0, 'north-east']);
  assert.equal(idle[2].direction, 'west');
});

test('Pixi adapter creates one ordered sprite per layer and updates only display state', () => {
  const index = createMannequinAtlasIndex(metadata);
  const simulationState = Object.freeze({
    simulationTick: 11,
    locomotion: 'moving',
    legDirection: 1,
    torsoDirection: 6,
  });
  const display = createMannequinDisplay({
    index,
    atlasTexture: { source: 'atlas-source' },
    ContainerClass: FakeContainer,
    SpriteClass: FakeSprite,
    TextureClass: FakeTexture,
    RectangleClass: FakeRectangle,
    scale: 0.58,
  });
  const applied = display.applyPose(simulationState);
  assert.equal(display.container.label, 'pipeline-pilot-human-atlas');
  assert.deepEqual(display.layerOrder, ['shadow', 'lower-body', 'torso-head', 'weapon']);
  assert.equal(display.container.children.length, 4);
  assert.deepEqual(applied.map((frame) => frame.id), [
    'neutral-mannequin__shadow__idle__south-east__000',
    'neutral-mannequin__lower-body__run__south-east__002',
    'neutral-mannequin__torso-head__aim__north__000',
    'neutral-mannequin__weapon__aim__north__000',
  ]);
  assert.deepEqual(simulationState, {
    simulationTick: 11,
    locomotion: 'moving',
    legDirection: 1,
    torsoDirection: 6,
  });
  assert.equal(display.container.scale.value, 0.58);
  for (const sprite of display.container.children) {
    assert.equal(sprite.texture.source, 'atlas-source');
    assert.ok(sprite.texture.frame.width > 0 && sprite.texture.frame.height > 0);
    assert.ok(Number.isFinite(sprite.anchor.x) && Number.isFinite(sprite.anchor.y));
  }
});
