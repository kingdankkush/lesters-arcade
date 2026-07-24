export function shouldInjectVercelWebAnalytics({ hostname }) {
  if (!hostname) return false;
  const hostnameLower = hostname.toLowerCase();
  if (hostnameLower === 'localhost' || hostnameLower === '127.0.0.1' || hostnameLower === '::1') {
    return false;
  }
  // Allow vercel.app subdomains and the production domain
  return hostnameLower.endsWith('.vercel.app') || hostnameLower === 'lestersarcade.io' || hostnameLower === 'www.lestersarcade.io';
}

export function injectVercelWebAnalytics({ documentRef, locationRef }) {
  if (!documentRef || !shouldInjectVercelWebAnalytics({ hostname: locationRef.hostname })) {
    return false;
  }
  if (documentRef.querySelector('script[data-vercel-analytics]')) {
    return false;
  }
  const script = documentRef.createElement('script');
  script.defer = true;
  script.dataset.vercelAnalytics = 'true';
  script.src = '/_vercel/insights/script.js';
  documentRef.head.appendChild(script);
  return true;
}