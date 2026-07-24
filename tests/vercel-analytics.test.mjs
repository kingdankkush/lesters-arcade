import assert from 'node:assert/strict';
import test from 'node:test';
import {
  injectVercelWebAnalytics,
  shouldInjectVercelWebAnalytics,
} from '../apps/portal/src/vercel-analytics.mjs';

class FakeDocument {
  constructor() {
    this.nodes = [];
    this.head = { appendChild: (node) => this.nodes.push(node) };
  }

  querySelector(selector) {
    if (selector !== 'script[data-vercel-analytics]') return null;
    return this.nodes.find((node) => node.dataset?.vercelAnalytics === 'true') ?? null;
  }

  createElement(tagName) {
    return { tagName, dataset: {} };
  }
}

test('Vercel analytics is disabled on localhost and loopback origins', () => {
  for (const hostname of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(shouldInjectVercelWebAnalytics({ hostname }), false, hostname);
    const documentRef = new FakeDocument();
    assert.equal(injectVercelWebAnalytics({ documentRef, locationRef: { hostname } }), false);
    assert.equal(documentRef.nodes.length, 0);
  }
});

test('Vercel analytics remains enabled on the production domain and Vercel previews', () => {
  for (const hostname of ['lestersarcade.io', 'www.lestersarcade.io', 'hmh-preview-abc.vercel.app']) {
    assert.equal(shouldInjectVercelWebAnalytics({ hostname }), true, hostname);
    const documentRef = new FakeDocument();
    assert.equal(injectVercelWebAnalytics({ documentRef, locationRef: { hostname } }), true);
    assert.equal(documentRef.nodes.length, 1);
    assert.equal(documentRef.nodes[0].src, '/_vercel/insights/script.js');
    assert.equal(documentRef.nodes[0].defer, true);
    assert.equal(documentRef.nodes[0].dataset.vercelAnalytics, 'true');
    assert.equal(injectVercelWebAnalytics({ documentRef, locationRef: { hostname } }), false);
    assert.equal(documentRef.nodes.length, 1);
  }
});
