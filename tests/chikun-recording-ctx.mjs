// Test helper (not a test file): a Canvas 2D context that records every call.
// It tracks the transform, alpha, composite mode and fill style through
// save()/restore() so tests can assert what was drawn, where and how.
const STATE_KEYS = ['globalAlpha', 'globalCompositeOperation', 'fillStyle', 'strokeStyle', 'lineWidth', 'font', 'textAlign', 'textBaseline', 'filter', 'shadowBlur', 'shadowColor', 'imageSmoothingEnabled', 'imageSmoothingQuality', 'lineCap'];

export function createRecordingCanvas(width = 1280, height = 720, options = {}) {
  const canvas = { width, height, style: {} };
  const ctx = createRecordingContext(canvas, options);
  canvas.getContext = () => ctx;
  return canvas;
}

export function createRecordingContext(canvas = { width: 1280, height: 720 }, { transform = [1, 0, 0, 1, 0, 0], log = [] } = {}) {
  let matrix = [...transform];
  const stack = [];
  const state = { globalAlpha: 1, globalCompositeOperation: 'source-over', fillStyle: '#000', strokeStyle: '#000', lineWidth: 1, font: '10px sans-serif', textAlign: 'start', textBaseline: 'alphabetic', filter: 'none', shadowBlur: 0, shadowColor: 'rgba(0,0,0,0)', imageSmoothingEnabled: true, imageSmoothingQuality: 'low', lineCap: 'butt' };
  const created = { gradients: 0, patterns: 0 };
  const record = (op, args) => { log.push({ op, args, alpha: state.globalAlpha, composite: state.globalCompositeOperation, fill: state.fillStyle, transform: [...matrix], filter: state.filter, shadowBlur: state.shadowBlur }); };
  const multiply = (m, [a, b, c, d, e, f]) => [m[0] * a + m[2] * b, m[1] * a + m[3] * b, m[0] * c + m[2] * d, m[1] * c + m[3] * d, m[0] * e + m[2] * f + m[4], m[1] * e + m[3] * f + m[5]];
  const gradient = kind => { created.gradients++; const stops = []; return { kind, stops, addColorStop(offset, color) { stops.push([offset, color]); } }; };
  const ctx = {
    canvas, log, created,
    save() { stack.push({ matrix: [...matrix], ...Object.fromEntries(STATE_KEYS.map(k => [k, state[k]])) }); record('save', []); },
    restore() { const s = stack.pop(); if (s) { matrix = s.matrix; for (const k of STATE_KEYS) state[k] = s[k]; } record('restore', []); },
    getTransform() { const [a, b, c, d, e, f] = matrix; return { a, b, c, d, e, f, is2D: true, isIdentity: a === 1 && b === 0 && c === 0 && d === 1 && e === 0 && f === 0 }; },
    setTransform(a = 1, b = 0, c = 0, d = 1, e = 0, f = 0) { if (typeof a === 'object') ({ a, b, c, d, e, f } = a); matrix = [a, b, c, d, e, f]; record('setTransform', [a, b, c, d, e, f]); },
    resetTransform() { matrix = [1, 0, 0, 1, 0, 0]; record('resetTransform', []); },
    transform(a, b, c, d, e, f) { matrix = multiply(matrix, [a, b, c, d, e, f]); record('transform', [a, b, c, d, e, f]); },
    translate(x, y) { matrix = multiply(matrix, [1, 0, 0, 1, x, y]); record('translate', [x, y]); },
    scale(x, y) { matrix = multiply(matrix, [x, 0, 0, y, 0, 0]); record('scale', [x, y]); },
    rotate(r) { const c = Math.cos(r), s = Math.sin(r); matrix = multiply(matrix, [c, s, -s, c, 0, 0]); record('rotate', [r]); },
    createLinearGradient(...args) { record('createLinearGradient', args); return gradient('linear'); },
    createRadialGradient(...args) { record('createRadialGradient', args); return gradient('radial'); },
    createPattern(image, repetition) { created.patterns++; record('createPattern', [image, repetition]); return { kind: 'pattern', image, repetition, setTransform() {} }; },
    measureText(text) { return { width: String(text).length * 6 }; },
  };
  for (const key of STATE_KEYS) Object.defineProperty(ctx, key, { get: () => state[key], set: value => { state[key] = value; }, enumerable: true });
  for (const op of ['fillRect', 'clearRect', 'strokeRect', 'drawImage', 'fillText', 'strokeText', 'beginPath', 'closePath', 'moveTo', 'lineTo', 'arc', 'ellipse', 'rect', 'quadraticCurveTo', 'bezierCurveTo', 'fill', 'stroke', 'clip', 'putImageData'])
    ctx[op] = (...args) => record(op, args);
  return ctx;
}

// Every drawImage call as {image, sx, sy, sw, sh, dx, dy, dw, dh} (3/5/9 argument forms).
export function drawImageCalls(log) {
  return log.filter(entry => entry.op === 'drawImage').map(({ args, transform, alpha, composite }) => {
    const [image] = args, iw = image?.width ?? 0, ih = image?.height ?? 0;
    if (args.length === 3) return { image, sx: 0, sy: 0, sw: iw, sh: ih, dx: args[1], dy: args[2], dw: iw, dh: ih, transform, alpha, composite };
    if (args.length === 5) return { image, sx: 0, sy: 0, sw: iw, sh: ih, dx: args[1], dy: args[2], dw: args[3], dh: args[4], transform, alpha, composite };
    const [, sx, sy, sw, sh, dx, dy, dw, dh] = args;
    return { image, sx, sy, sw, sh, dx, dy, dw, dh, transform, alpha, composite };
  });
}

// A stable, comparable summary of a call log (images by label or size, numbers rounded).
export function summariseLog(log) {
  const value = v => v && typeof v === 'object' ? (v.label ?? v.kind ?? `${v.width}x${v.height}`) : typeof v === 'number' ? Math.round(v * 1000) / 1000 : v;
  return log.map(({ op, args, alpha, composite }) => `${op}(${args.map(value).join(',')})@${value(alpha)}/${composite}`);
}
