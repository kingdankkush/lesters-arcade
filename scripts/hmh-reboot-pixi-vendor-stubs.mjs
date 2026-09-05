// Cycle 074 (N-4): resolve-time stubs for the Pixi 8.19.0 subsystems the HMH
// child never reaches.
//
// WHY THIS EXISTS
// pixi.js/lib/index.mjs side-effect-imports every subsystem, browserExt.load()
// pulls accessibility/dom/events/spritesheet/rendering/filters inits, and
// autoDetectRenderer dynamic-imports the WebGPU, WebGL and canvas renderers.
// The vendor build is deliberately `splitting: false` (one preloaded file, no
// hidden static chunks), so all of that is inlined and tree-shaking cannot
// remove code that a side-effect import registers. The child pins
// `preference: 'webgl'`, drives input from the DOM (no Pixi pointer events),
// never assigns `.filters`, and never uses the Pixi accessibility overlay.
// Each entry below is replaced at esbuild resolve time with a stub; the
// renderer stubs throw a readable error so a WebGL-less browser fails loudly
// in the status card instead of drawing nothing. Stencil masks (terrain ramps,
// road surface) live in rendering/init.mjs, which is NOT stubbed.
//
// Measured on the Cycle 073 vendor (575,891 B): -57,342 for the two renderers,
// -112,890 with the three inits. Anchor screenshots were sha256-identical.
import { realpathSync } from 'node:fs';
import path from 'node:path';

export const HMH_PIXI_STUB_NAMESPACE = 'hmh-pixi-stub';

const WEBGL_ONLY_MESSAGE = 'Hard Money Heroes needs WebGL:';

export const HMH_PIXI_VENDOR_STUBS = Object.freeze({
  'rendering/renderers/gpu/WebGPURenderer.mjs': [
    'export class WebGPURenderer {',
    '  constructor() {',
    `    throw new Error('${WEBGL_ONLY_MESSAGE} the WebGPU renderer is not shipped in this build');`,
    '  }',
    '}',
    '',
  ].join('\n'),
  'rendering/renderers/canvas/CanvasRenderer.mjs': [
    'export class CanvasRenderer {',
    '  constructor() {',
    `    throw new Error('${WEBGL_ONLY_MESSAGE} the canvas renderer is not shipped in this build');`,
    '  }',
    '}',
    '',
  ].join('\n'),
  'accessibility/init.mjs': 'export {};\n',
  'events/init.mjs': 'export {};\n',
  'filters/init.mjs': 'export {};\n',
});

function toPosix(value) {
  return String(value ?? '').replaceAll('\\', '/');
}

/**
 * Build an esbuild `onResolve` callback that answers only for relative imports
 * issued from inside `pixiLibDir` whose target is one of the stubbed files.
 * Everything else returns null so esbuild's normal resolution continues.
 */
export function createHmhPixiStubResolver({ pixiLibDir } = {}) {
  if (typeof pixiLibDir !== 'string' || pixiLibDir.length === 0) throw new TypeError('pixiLibDir is required');
  // esbuild reports importers by real path (preserveSymlinks is off), so a
  // node_modules junction or symlink makes the importer prefix differ from the
  // configured directory. Accept both spellings; a directory that does not
  // exist (unit tests) simply has no real path.
  const roots = new Set([`${toPosix(pixiLibDir).replace(/\/+$/, '')}/`]);
  try {
    roots.add(`${toPosix(realpathSync.native(pixiLibDir)).replace(/\/+$/, '')}/`);
  } catch {
    // not on disk: keep the configured spelling only
  }
  const libDirs = [...roots].map((root) => ({ root, lower: root.toLowerCase() }));
  return function resolveHmhPixiStub(args) {
    const importer = toPosix(args?.importer);
    if (!importer) return null;
    const importerLower = importer.toLowerCase();
    const libDir = libDirs.find(({ lower }) => importerLower.startsWith(lower));
    if (!libDir) return null;
    const specifier = toPosix(args?.path);
    if (!specifier.startsWith('.')) return null;
    const target = path.posix.normalize(path.posix.join(path.posix.dirname(importer), specifier));
    if (!target.toLowerCase().startsWith(libDir.lower)) return null;
    const relative = target.slice(libDir.root.length);
    if (!Object.hasOwn(HMH_PIXI_VENDOR_STUBS, relative)) return null;
    return { path: relative, namespace: HMH_PIXI_STUB_NAMESPACE };
  };
}

/** esbuild `onLoad` callback for the stub namespace. */
export function loadHmhPixiStub(args) {
  const contents = HMH_PIXI_VENDOR_STUBS[args?.path];
  if (typeof contents !== 'string') throw new Error(`no HMH Pixi stub for ${args?.path}`);
  return { contents, loader: 'js' };
}
