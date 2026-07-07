import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  buildAnchorCandidateAudit,
  renderAnchorCandidateAuditMarkdown,
} from '../apps/portal/src/hmh-anchor-set.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'docs', 'art');
const JSON_OUT = path.join(OUT_DIR, 'WO76_ANCHOR_CANDIDATE_AUDIT.json');
const MD_OUT = path.join(OUT_DIR, 'WO76_ANCHOR_CANDIDATE_AUDIT.md');

function repoRel(filePath) {
  return path.relative(ROOT, filePath).split(path.sep).join('/');
}

const audit = buildAnchorCandidateAudit();
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(JSON_OUT, `${JSON.stringify(audit, null, 2)}\n`, 'utf8');
writeFileSync(MD_OUT, renderAnchorCandidateAuditMarkdown(audit), 'utf8');

console.log(JSON.stringify({
  workOrder: audit.workOrder,
  status: audit.status,
  slotCount: audit.slots.length,
  candidateSourceCount: audit.candidateSources.length,
  placeholderDebtCount: audit.placeholderDebt.length,
  output: [
    repoRel(JSON_OUT),
    repoRel(MD_OUT),
  ],
}, null, 2));
