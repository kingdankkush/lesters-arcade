import { writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import * as contracts from '../apps/portal/src/stacked-contracts.mjs';

const outputUrl = new URL('../docs/stacked/contracts.json', import.meta.url);

function sortedRecord(record) {
  return Object.fromEntries(Object.keys(record).sort().map((key) => [key, record[key]]));
}

export function deriveStackedContractsArtifact() {
  return Object.freeze({ schema: 'stacked-contracts/v1', contracts: Object.freeze(sortedRecord(contracts)) });
}

export function deriveStackedContractsJson() {
  return `${JSON.stringify(deriveStackedContractsArtifact(), null, 2)}\n`;
}

export function assertStackedJsBudget({ entryBytes, initialBytes }) {
  if (contracts.STACKED_ENTRY_JS_CAP === null) {
    throw new Error('STACKED_ENTRY_JS_CAP has no measured baseline yet');
  }
  if (contracts.STACKED_INITIAL_JS_CAP === null) {
    throw new Error('STACKED_INITIAL_JS_CAP has no measured baseline yet');
  }
  if (!Number.isSafeInteger(entryBytes) || entryBytes < 0) throw new TypeError('entryBytes must be a non-negative safe integer');
  if (!Number.isSafeInteger(initialBytes) || initialBytes < 0) throw new TypeError('initialBytes must be a non-negative safe integer');
  if (entryBytes > contracts.STACKED_ENTRY_JS_CAP) throw new Error(`STACKED entry JS ${entryBytes} exceeds ${contracts.STACKED_ENTRY_JS_CAP}`);
  if (initialBytes > contracts.STACKED_INITIAL_JS_CAP) throw new Error(`STACKED initial JS ${initialBytes} exceeds ${contracts.STACKED_INITIAL_JS_CAP}`);
}

export async function writeStackedContracts(path = outputUrl) {
  await writeFile(path, deriveStackedContractsJson(), 'utf8');
}

const isMain = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) await writeStackedContracts();
