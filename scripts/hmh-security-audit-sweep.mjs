import { mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SECURITY_PATTERNS = Object.freeze([
  Object.freeze({ id: 'dom-xss-innerhtml', severity: 'high', regex: /\.innerHTML\s*=/g, allow: /vendor\// }),
  Object.freeze({ id: 'dom-xss-outerhtml', severity: 'high', regex: /\.outerHTML\s*=/g, allow: /vendor\// }),
  Object.freeze({ id: 'dynamic-code-eval', severity: 'critical', regex: /\beval\s*\(|new\s+Function\s*\(/g, allow: /vendor\// }),
  Object.freeze({ id: 'inline-secret-assignment', severity: 'critical', regex: /(api[_-]?key|secret|password|private[_-]?key|bearer)\s*[:=]\s*['"][^'"]{8,}['"]/gi, allow: /(safetyNotes|vendor\/)/ }),
]);

function repoRootFromHere() {
  return path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
}

function walk(dir) {
  const out = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    const normalized = full.split(path.sep).join('/');
    if (entry.isDirectory()) {
      if (/(^|\/)(dist|vendor|node_modules)(\/|$)/.test(`${normalized}/`)) continue;
      out.push(...walk(full));
    } else if (/\.(mjs|js|html|json|css)$/.test(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function lineForOffset(text, offset) {
  return text.slice(0, offset).split(/\r?\n/).length;
}

export function buildSecurityAuditSweep({ repoRoot = repoRootFromHere() } = {}) {
  const scopeDirs = [path.join(repoRoot, 'apps', 'portal'), path.join(repoRoot, 'scripts'), path.join(repoRoot, 'tests')];
  const files = scopeDirs.flatMap((dir) => walk(dir));
  const findings = [];
  for (const file of files) {
    const rel = path.relative(repoRoot, file).split(path.sep).join('/');
    if (rel === 'scripts/hmh-security-audit-sweep.mjs') continue;
    const text = readFileSync(file, 'utf8');
    for (const pattern of SECURITY_PATTERNS) {
      if (pattern.allow?.test(rel)) continue;
      pattern.regex.lastIndex = 0;
      let match;
      while ((match = pattern.regex.exec(text))) {
        const snippet = text.slice(Math.max(0, match.index - 40), Math.min(text.length, match.index + 100)).replace(/\s+/g, ' ').trim();
        if (pattern.id.startsWith('dom-xss') && /\.innerHTML\s*=\s*['"]{2}/.test(snippet)) continue;
        if (pattern.allow?.test(snippet)) continue;
        findings.push(Object.freeze({ id: pattern.id, severity: pattern.severity, file: rel, line: lineForOffset(text, match.index), snippet }));
      }
    }
  }
  const indexHtml = readFileSync(path.join(repoRoot, 'apps', 'portal', 'index.html'), 'utf8');
  const main = readFileSync(path.join(repoRoot, 'apps', 'portal', 'main.js'), 'utf8');
  const sw = readFileSync(path.join(repoRoot, 'apps', 'portal', 'sw.js'), 'utf8');
  const hardeningChecks = Object.freeze([
    Object.freeze({ id: 'no-app-innerhtml', pass: !main.includes('.innerHTML ='), detail: 'runtime modal/content creation uses DOM/textContent APIs' }),
    Object.freeze({ id: 'target-blank-rel-noopener', pass: !/target="_blank"(?![^>]*rel="[^"]*noopener)/.test(indexHtml), detail: 'external blank targets include noopener' }),
    Object.freeze({ id: 'service-worker-network-first-scripts', pass: sw.includes("request.destination === 'script'") && sw.includes('networkFirst(request)'), detail: 'JS/CSS deploys are network-first to avoid stale code' }),
    Object.freeze({ id: 'wallet-provider-readiness', pass: main.includes('detectEthereumProvider') && main.includes('checkRankedReadiness') && main.includes('requestLiteForgeNetwork'), detail: 'wallet path has provider detection, chain request, and readiness preflight' }),
    Object.freeze({ id: 'avatar-sanitization', pass: main.includes('sanitizeAvatarImage') && main.includes('canvas.toDataURL') && main.includes('validateAvatarFile'), detail: 'avatar uploads are type/size checked and re-encoded through canvas' }),
  ]);
  return Object.freeze({
    version: 'wo-39-security-audit-v1',
    scope: Object.freeze({ filesScanned: files.length, directories: Object.freeze(scopeDirs.map((dir) => path.relative(repoRoot, dir).replaceAll('\\\\', '/'))) }),
    findings: Object.freeze(findings),
    hardeningChecks,
    summary: Object.freeze({
      status: findings.length === 0 && hardeningChecks.every((check) => check.pass) ? 'PASS' : 'FAIL',
      findingCount: findings.length,
      hardeningPassCount: hardeningChecks.filter((check) => check.pass).length,
      hardeningCheckCount: hardeningChecks.length,
    }),
  });
}

export function renderSecurityAuditMarkdown(audit = buildSecurityAuditSweep()) {
  const checks = audit.hardeningChecks.map((check) => `| ${check.id} | ${check.pass ? 'PASS' : 'FAIL'} | ${check.detail.replaceAll('|', '\\|')} |`).join('\n');
  const findings = audit.findings.length
    ? audit.findings.map((finding) => `| ${finding.severity} | ${finding.id} | ${finding.file}:${finding.line} | ${finding.snippet.replaceAll('|', '\\|')} |`).join('\n')
    : '| none | none | none | none |';
  return `# Hard Money Heroes Security Audit Sweep\n\nGenerated by \`scripts/hmh-security-audit-sweep.mjs\`. Passive/static review only; no live target scanning.\n\n## Summary\n\n- Version: ${audit.version}\n- Status: ${audit.summary.status}\n- Files scanned: ${audit.scope.filesScanned}\n- Findings: ${audit.summary.findingCount}\n\n## Hardening checks\n\n| Check | Status | Detail |\n| --- | --- | --- |\n${checks}\n\n## Static findings\n\n| Severity | Rule | Evidence | Snippet |\n| --- | --- | --- | --- |\n${findings}\n`;
}

export function writeSecurityAuditSweep({ repoRoot = repoRootFromHere() } = {}) {
  const audit = buildSecurityAuditSweep({ repoRoot });
  const outDir = path.join(repoRoot, 'docs', 'security');
  mkdirSync(outDir, { recursive: true });
  const jsonPath = path.join(outDir, 'hard-money-heroes-security-audit.json');
  const mdPath = path.join(outDir, 'hard-money-heroes-security-audit.md');
  writeFileSync(jsonPath, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
  writeFileSync(mdPath, renderSecurityAuditMarkdown(audit), 'utf8');
  return Object.freeze({ audit, jsonPath, mdPath });
}

const isMain = process.argv[1]
  && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isMain) {
  const { audit, jsonPath, mdPath } = writeSecurityAuditSweep();
  console.log(`HMH security audit written: ${jsonPath}`);
  console.log(`HMH security audit markdown written: ${mdPath}`);
  console.log(`Status: ${audit.summary.status}; findings ${audit.summary.findingCount}; checks ${audit.summary.hardeningPassCount}/${audit.summary.hardeningCheckCount}`);
  if (audit.summary.status !== 'PASS') process.exitCode = 1;
}
