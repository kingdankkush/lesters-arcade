import { parentPort } from 'node:worker_threads';
globalThis.self = { postMessage: value => parentPort.postMessage(value) };
await import('../../apps/stacked/src/verify-worker.mjs');
parentPort.on('message', data => globalThis.self.onmessage({ data }));
