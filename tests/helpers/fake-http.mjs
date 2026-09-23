// Minimal fake Vercel req/res for mounting a real api/*.mjs handler
// (createHandler(() => buildDeps(env, overrides)), contract A30) in tests.

export function fakeRequest({ method = 'GET', url = '/', headers = {}, body } = {}) {
  const req = { method, url, headers: Object.fromEntries(Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value])) };
  if (body !== undefined) req.body = body;
  return req;
}

export function fakeResponse() {
  const headers = {};
  let text = null;
  return {
    statusCode: 0,
    headers,
    setHeader(key, value) { headers[String(key).toLowerCase()] = String(value); },
    getHeader(key) { return headers[String(key).toLowerCase()]; },
    end(chunk) { text = chunk === undefined ? null : String(chunk); },
    get text() { return text; },
    get json() { return text === null ? null : JSON.parse(text); },
  };
}

// Invokes a handler and returns { status, body, headers }.
export async function invoke(handler, request = {}) {
  const res = fakeResponse();
  await handler(fakeRequest(request), res);
  return { status: res.statusCode, body: res.json, headers: res.headers };
}
