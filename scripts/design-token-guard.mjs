import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const tokenPath = path.join(repoRoot, 'apps/portal/src/design-tokens.css');
const cssPaths = [
  path.join(repoRoot, 'apps/portal/styles.css'),
  path.join(repoRoot, 'apps/portal/styles-arcade-polish.css'),
];
const htmlPath = path.join(repoRoot, 'apps/portal/index.html');
const tokenSource = readFileSync(tokenPath, 'utf8');
const errors = [];

for (const required of [
  '--litecoin-blue:', '--surface:', '--text-primary:', '--accent:', '--danger:', '--success:',
  '--font-display:', '--font-ui:', '--space-4:', '--radius-md:', '--shadow-panel:',
]) {
  if (!tokenSource.includes(required)) errors.push(`Missing required token ${required}`);
}

for (const cssPath of cssPaths) {
  const source = readFileSync(cssPath, 'utf8');
  if (/(^|\n)\s*:root\s*\{/.test(source)) errors.push(`${path.relative(repoRoot, cssPath)} declares :root outside design-tokens.css`);
  for (const literal of ['#345dcc', '#0d182a', '#c9a34e']) {
    if (source.toLowerCase().includes(literal)) errors.push(`${path.relative(repoRoot, cssPath)} hard-codes protected brand color ${literal}`);
  }
}

const html = readFileSync(htmlPath, 'utf8');
const tokenLink = html.indexOf('src/design-tokens.css');
const mainStyles = html.indexOf('styles.css');
if (tokenLink < 0 || mainStyles < 0 || tokenLink > mainStyles) errors.push('index.html must load design-tokens.css before styles.css');

if (errors.length) {
  console.error(`Design token guard failed:\n- ${errors.join('\n- ')}`);
  process.exit(1);
}
console.log('Design token guard passed: centralized brand palette, typography, spacing, radius, and shadows are wired before portal styles.');
