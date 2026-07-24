function normalizeArray(value) {
  return Array.isArray(value) ? value : [];
}

export function sanitizeAuditUrl(urlString) {
  try {
    const url = new URL(String(urlString));
    if (url.protocol === 'data:') return 'data:[REDACTED]';
    const keys = [...new Set([...url.searchParams.keys()])].sort();
    url.search = keys.map((key) => `${encodeURIComponent(key)}=[REDACTED]`).join('&');
    url.hash = '';
    return url.toString();
  } catch {
    return '[REDACTED]';
  }
}

export function buildNetworkConsoleAuditReport({
  scenario,
  responses = [],
  requestFailures = [],
  consoleMessages = [],
  pageErrors = [],
  serviceWorkers = [],
} = {}) {
  const responseList = normalizeArray(responses);
  const requestFailureList = normalizeArray(requestFailures);
  const consoleList = normalizeArray(consoleMessages);
  const pageErrorList = normalizeArray(pageErrors);
  const workerList = normalizeArray(serviceWorkers);
  const httpErrors = responseList.filter((response) => Number(response.status) >= 400);
  const consoleErrors = consoleList.filter((message) => message.type === 'error');
  const expectedCancellations = requestFailureList.flatMap((failure) => {
    if (failure.resourceType !== 'media' || failure.errorText !== 'net::ERR_ABORTED') return [];
    const matchingResponse = responseList.find((response) => (
      response.url === failure.url
      && response.resourceType === 'media'
      && [200, 206].includes(Number(response.status))
      && /^(audio|video)\//i.test(String(response.contentType ?? ''))
    ));
    return matchingResponse
      ? [{ ...failure, matchingResponseStatus: Number(matchingResponse.status), contentType: matchingResponse.contentType }]
      : [];
  });
  const expectedCancellationKeys = new Set(expectedCancellations.map((entry) => `${entry.url}\n${entry.resourceType}\n${entry.errorText}`));
  const fatalRequestFailures = requestFailureList.filter((failure) => !expectedCancellationKeys.has(`${failure.url}\n${failure.resourceType}\n${failure.errorText}`));
  const failures = [
    ...httpErrors.map((entry) => ({ kind: 'http', ...entry })),
    ...fatalRequestFailures.map((entry) => ({ kind: 'request', ...entry })),
    ...consoleErrors.map((entry) => ({ kind: 'console', ...entry })),
    ...pageErrorList.map((entry) => ({ kind: 'page', ...entry })),
  ];

  return {
    scenario,
    ok: failures.length === 0,
    summary: {
      responses: responseList.length,
      httpErrors: httpErrors.length,
      requestFailures: fatalRequestFailures.length,
      consoleErrors: consoleErrors.length,
      pageErrors: pageErrorList.length,
      serviceWorkers: workerList.length,
    },
    httpErrors,
    failures,
    expectedCancellations,
    responses: responseList,
    requestFailures: requestFailureList,
    consoleMessages: consoleList,
    pageErrors: pageErrorList,
    serviceWorkers: workerList,
  };
}
