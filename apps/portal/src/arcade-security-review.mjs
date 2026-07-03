import { validateSandboxedCabinetManifest } from './arcade-sandbox.mjs';

export const THIRD_PARTY_SECURITY_REVIEW_RULES = Object.freeze([
  Object.freeze({ id: 'no-wallet-provider-access', severity: 'blocker', description: 'Cabinet code must not access wallet providers directly.' }),
  Object.freeze({ id: 'no-dynamic-code-execution', severity: 'blocker', description: 'Cabinet code must not execute dynamic strings.' }),
  Object.freeze({ id: 'no-remote-code-imports', severity: 'blocker', description: 'Cabinet code must not load remote executable code.' }),
  Object.freeze({ id: 'declared-network-endpoints-only', severity: 'major', description: 'Network URLs must be declared in manifest.endpoints.' }),
  Object.freeze({ id: 'sandbox-least-privilege', severity: 'blocker', description: 'Sandbox allows scripts only, no same-origin and no wallet access.' }),
  Object.freeze({ id: 'no-drainer-patterns', severity: 'blocker', description: 'Cabinet code must not request transaction/signature/approval primitives.' }),
]);

function allContent(files = []) {
  return (Array.isArray(files) ? files : [])
    .map((file) => `${file.path ?? '<inline>'}\n${file.content ?? ''}`)
    .join('\n---FILE---\n');
}

function urlsIn(text) {
  return [...String(text).matchAll(/https:\/\/[^\s'"`)]+/gi)].map((match) => match[0]);
}

function addFinding(findings, ruleId, evidence) {
  const rule = THIRD_PARTY_SECURITY_REVIEW_RULES.find((item) => item.id === ruleId);
  if (!rule || findings.some((finding) => finding.ruleId === ruleId)) return;
  findings.push(Object.freeze({
    ruleId,
    severity: rule.severity,
    evidence,
    fix: rule.description,
  }));
}

export function runThirdPartyCabinetSecurityReview({ manifest = null, files = [] } = {}) {
  const findings = [];
  const manifestReview = validateSandboxedCabinetManifest(manifest);
  const text = allContent(files);

  if (/\b(?:window\.)?ethereum\b|\bwalletProvider\b|\bsigner\b/i.test(text)) {
    addFinding(findings, 'no-wallet-provider-access', 'source references ethereum/provider/signer primitives');
  }
  // Defensive literal pattern only: flags dynamic-code primitives in candidate cabinet source; it does not execute dynamic code.
  if (/\beval\s*\(|\bnew\s+Function\s*\(/.test(text)) {
    addFinding(findings, 'no-dynamic-code-execution', 'source references dynamic-code execution primitives');
  }
  if (/\bimport\s*\(\s*['"]https?:\/\//i.test(text) || /<script[^>]+src=['"]https?:\/\//i.test(text)) {
    addFinding(findings, 'no-remote-code-imports', 'source loads executable code from an absolute URL');
  }

  const declaredEndpoints = new Set(Array.isArray(manifest?.endpoints) ? manifest.endpoints : []);
  const undeclared = urlsIn(text).filter((url) => ![...declaredEndpoints].some((endpoint) => url.startsWith(endpoint)));
  if (undeclared.length) {
    addFinding(findings, 'declared-network-endpoints-only', `undeclared endpoint: ${undeclared[0]}`);
  }

  if (!manifestReview.valid) {
    addFinding(findings, 'sandbox-least-privilege', manifestReview.errors.join('; '));
  }

  if (/eth_sendTransaction|personal_sign|eth_signTypedData|\bapprove\s*\(|setApprovalForAll|transferFrom|permit\s*\(/i.test(text)) {
    addFinding(findings, 'no-drainer-patterns', 'source references transaction/signature/approval primitives');
  }

  const orderedFindings = THIRD_PARTY_SECURITY_REVIEW_RULES
    .map((rule) => findings.find((finding) => finding.ruleId === rule.id))
    .filter(Boolean);
  return Object.freeze({
    ok: orderedFindings.length === 0,
    findings: Object.freeze(orderedFindings),
    reviewedRuleCount: THIRD_PARTY_SECURITY_REVIEW_RULES.length,
  });
}
