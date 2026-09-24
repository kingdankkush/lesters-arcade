// The live-shaped local target (rehearsal slice; contract A30, §4.5, §13 step 9).
//
// startLocalHttp() serves the local stack's handlers over node:http, mounted exactly as the
// in-process client mounts them (createHandler(() => buildDeps(env, { db, provider, deployment,
// nowMs })) for each api/*.mjs module) behind the rewrites read from vercel.json, so the SAME
// rehearsal driver that runs in-process can run over real HTTP and JSON-RPC, as it will against
// https://lestersarcade.io at runbook step 9. It can also serve a static directory as the web root
// (the browser-e2e slice serves a throwaway live-flag portal build that way), optionally with the
// vercel.json response headers, CSP included.
//
// startRpcProxy() exposes the stack's in-process chain over HTTP JSON-RPC (single and batch
// requests), through the stack's clock-tracking EIP-1193 provider: evm_increaseTime / evm_mine sent
// by a remote driver move the server clock exactly as they move the chain's.
//
// Both listen on 127.0.0.1 only. Nothing here reads a key or a secret.

import { createReadStream } from 'node:fs';
import { createServer } from 'node:http';
import { extname } from 'node:path';

import { serveJsonRpc } from './local-chain.mjs';
import { createHandlerMounts, createVercelRouter, REPO_ROOT } from './local-stack.mjs';

export const LOCAL_HTTP_HOST = '127.0.0.1';

const CONTENT_TYPES = Object.freeze({
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.webp': 'image/webp',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.mp3': 'audio/mpeg',
  '.ogg': 'audio/ogg',
  '.wav': 'audio/wav',
  '.m4a': 'audio/mp4',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm',
  '.wasm': 'application/wasm',
  '.webmanifest': 'application/manifest+json',
  '.glb': 'model/gltf-binary',
  '.gltf': 'model/gltf+json',
});

export function contentTypeFor(file) {
  return CONTENT_TYPES[extname(file).toLowerCase()] ?? 'application/octet-stream';
}

// Adds origins to the connect-src directive of a CSP value (the browser-e2e live-flag run points
// the portal copy at the local JSON-RPC proxy).
export function withConnectSrc(csp, origins = []) {
  if (!origins.length) return csp;
  return String(csp).split(';').map((part) => part.trim()).filter(Boolean)
    .map((directive) => (directive.startsWith('connect-src ') ? `${directive} ${origins.join(' ')}` : directive))
    .join('; ');
}

function sendPlain(res, status, text, headers = {}) {
  res.statusCode = status;
  for (const [key, value] of Object.entries({ 'Content-Type': 'text/plain; charset=utf-8', ...headers })) res.setHeader(key, value);
  res.end(text);
}

// Serves the stack over HTTP. Options:
//   port (0 = any free port), host (loopback only), staticRoot (a web root served like Vercel's
//   outputDirectory, or null for API only), applyVercelHeaders (send the vercel.json headers that
//   match each path, CSP included), extraConnectSrc (origins appended to every CSP connect-src),
//   allowSignInHost (add this server's host to the stack's SESSION_ALLOWED_DOMAINS).
// Returns { origin, port, host, router, close() }.
export async function startLocalHttp(stack, {
  port = 0,
  host = LOCAL_HTTP_HOST,
  root = REPO_ROOT,
  staticRoot = null,
  applyVercelHeaders = false,
  extraConnectSrc = [],
  allowSignInHost = true,
} = {}) {
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('startLocalHttp listens on the loopback interface only');
  const router = createVercelRouter({ root, staticRoot });
  const handlerFor = stack.handlerFor ?? createHandlerMounts({ root, env: stack.env, overrides: () => ({ db: stack.db, provider: stack.chain.provider, deployment: stack.deployment, nowMs: stack.nowMs }) });
  const connections = new Set();

  const server = createServer(async (req, res) => {
    try {
      const url = String(req.url ?? '/');
      const pathname = url.split('?')[0];
      if (applyVercelHeaders) {
        for (const [key, value] of Object.entries(router.headersFor(pathname))) {
          res.setHeader(key, key.toLowerCase() === 'content-security-policy' ? withConnectSrc(value, extraConnectSrc) : value);
        }
      }
      const route = router.route(url);
      if (route.kind === 'api') {
        await stack.syncClock();
        const handler = await handlerFor(route.module);
        // The function sees the rewritten URL, exactly as a Vercel function behind the rewrite.
        req.url = route.url;
        if (!req.headers['x-forwarded-for']) req.headers['x-forwarded-for'] = req.socket.remoteAddress ?? '127.0.0.1';
        await handler(req, res);
        return;
      }
      if (route.kind === 'static') {
        if (!['GET', 'HEAD'].includes(String(req.method).toUpperCase())) {
          sendPlain(res, 405, 'method not allowed', { Allow: 'GET, HEAD' });
          return;
        }
        res.statusCode = 200;
        res.setHeader('Content-Type', contentTypeFor(route.file));
        if (!res.hasHeader('Cache-Control')) res.setHeader('Cache-Control', 'no-store');
        if (String(req.method).toUpperCase() === 'HEAD') {
          res.end();
          return;
        }
        createReadStream(route.file).on('error', () => res.destroy()).pipe(res);
        return;
      }
      if (pathname.startsWith('/api/')) {
        res.statusCode = 404;
        res.setHeader('Content-Type', 'application/json; charset=utf-8');
        res.end(JSON.stringify({ ok: false, error: 'not-found' }));
        return;
      }
      sendPlain(res, 404, 'not found');
    } catch (error) {
      // Error name and code only (§4.1): never a message that could carry a URL or a secret.
      console.error('[local-http] internal-error', error?.name ?? 'Error', error?.code ?? 'none');
      if (!res.headersSent) sendPlain(res, 500, 'internal error');
      else res.destroy();
    }
  });
  server.on('connection', (socket) => {
    connections.add(socket);
    socket.on('close', () => connections.delete(socket));
  });
  await new Promise((resolveListen, rejectListen) => {
    server.once('error', rejectListen);
    server.listen(port, host, () => {
      server.off('error', rejectListen);
      resolveListen();
    });
  });
  const address = server.address();
  const hostPart = host.includes(':') ? `[${host}]` : host;
  const origin = `http://${hostPart}:${address.port}`;
  if (allowSignInHost && typeof stack.allowDomain === 'function') stack.allowDomain(`${hostPart}:${address.port}`);
  return {
    origin,
    port: address.port,
    host,
    router,
    close: () => new Promise((resolveClose) => {
      for (const socket of connections) socket.destroy();
      server.close(() => resolveClose());
    }),
  };
}

// The stack's chain over HTTP JSON-RPC, with time travel tracked by the stack's clock.
export async function startRpcProxy(stack, { port = 0, host = LOCAL_HTTP_HOST } = {}) {
  if (!['127.0.0.1', 'localhost', '::1'].includes(host)) throw new Error('startRpcProxy listens on the loopback interface only');
  return serveJsonRpc(stack.eip1193, { port, host });
}
