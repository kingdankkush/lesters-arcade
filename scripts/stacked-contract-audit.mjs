import { readFile, readdir } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { parse } from 'acorn';

function visit(node, fn) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') fn(node);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => visit(child, fn));
    else if (value && typeof value === 'object') visit(value, fn);
  }
}

function bindings(pattern, accept) {
  if (!pattern) return;
  switch (pattern.type) {
    case 'Identifier': accept(pattern.name); break;
    case 'RestElement': bindings(pattern.argument, accept); break;
    case 'AssignmentPattern': bindings(pattern.left, accept); break;
    case 'ArrayPattern': pattern.elements.forEach(item => bindings(item, accept)); break;
    case 'ObjectPattern':
      pattern.properties.forEach(property => bindings(
        property.type === 'RestElement' ? property.argument : property.value, accept));
      break;
  }
}

function syntaxTree(source) {
  return parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
}

export function findDuplicateDeclarations(source, names) {
  const governed = new Set(names);
  const found = new Set();
  const accept = name => { if (governed.has(name)) found.add(name); };
  visit(syntaxTree(source), node => {
    switch (node.type) {
      case 'VariableDeclarator': bindings(node.id, accept); break;
      case 'FunctionDeclaration':
      case 'FunctionExpression':
      case 'ArrowFunctionExpression':
        bindings(node.id, accept);
        node.params.forEach(pattern => bindings(pattern, accept));
        break;
      case 'ClassDeclaration':
      case 'ClassExpression': bindings(node.id, accept); break;
      case 'CatchClause': bindings(node.param, accept); break;
    }
  });
  return [...found].sort();
}

export function findModuleReferences(source) {
  const references = [];
  visit(syntaxTree(source), node => {
    if (node.type === 'ImportDeclaration' || node.type === 'ImportExpression' ||
        ((node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source)) {
      references.push({ kind: node.type, source: node.source.value ?? null });
    } else if (node.type === 'CallExpression' && node.callee.type === 'Identifier' && node.callee.name === 'require') {
      references.push({ kind: 'require', source: node.arguments[0]?.value ?? null });
    }
  });
  return references;
}

export async function scanContractDeclarations(root, names, canonicalPath) {
  const allowed = resolve(canonicalPath);
  const hits = [];
  async function scan(directory) {
    const entries = await readdir(directory, { withFileTypes: true });
    entries.sort((a, b) => a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    for (const entry of entries) {
      if (['node_modules', 'vendor', 'generated', 'dist'].includes(entry.name)) continue;
      const path = join(directory, entry.name);
      if (entry.isDirectory()) { await scan(path); continue; }
      if (!/\.(?:[cm]?js)$/.test(entry.name) || resolve(path) === allowed) continue;
      let found;
      try { found = findDuplicateDeclarations(await readFile(path, 'utf8'), names); }
      catch (cause) { throw new Error(`Cannot audit ${relative(root, path)}: ${cause.message}`, { cause }); }
      for (const name of found) hits.push({ path: relative(root, path).replaceAll('\\', '/'), name });
    }
  }
  for (const directory of ['apps', 'sdk', 'scripts', 'tests']) await scan(join(root, directory));
  return hits;
}
