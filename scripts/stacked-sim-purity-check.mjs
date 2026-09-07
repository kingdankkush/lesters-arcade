import { readFile, realpath } from 'node:fs/promises';
import { join, relative, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parse } from 'acorn';
import { resolveStaticModuleSpecifier } from './stacked-contract-audit.mjs';

const defaultRoot = fileURLToPath(new URL('..', import.meta.url));
const moduleNames = ['stacked-sim.mjs', 'seeded-rng.mjs', 'stacked-contracts.mjs'];
const allowedEdges = new Map([
  ['stacked-sim.mjs', new Set(['./seeded-rng.mjs', './stacked-contracts.mjs'])],
  ['seeded-rng.mjs', new Set()],
  ['stacked-contracts.mjs', new Set()],
]);
const ambientNames = new Set([
  'Date', 'performance', 'window', 'document', 'navigator', 'globalThis', 'global',
  'process', 'crypto', 'Intl', 'console', 'fetch', 'XMLHttpRequest', 'WebSocket',
  'WebAssembly', 'Worker', 'SharedWorker', 'SharedArrayBuffer', 'Atomics',
  'eval', 'Function', 'AsyncFunction', 'require', 'importScripts',
  'setTimeout', 'setInterval', 'setImmediate', 'clearTimeout', 'clearInterval',
  'requestAnimationFrame', 'cancelAnimationFrame', 'queueMicrotask',
]);
const forbiddenProperties = new Set([
  'toFixed', 'toPrecision', 'toExponential', 'toLocaleString', 'localeCompare',
  'toLocaleLowerCase', 'toLocaleUpperCase', 'sort', 'toSorted', 'constructor', '__proto__',
]);
const forbiddenDestructuredProperties = new Set([...forbiddenProperties, 'prototype']);
const integerMath = new Set(['floor', 'ceil', 'round', 'trunc', 'min', 'max', 'abs', 'imul', 'clz32', 'sign']);
const builtins = new Set([
  'Math', 'Reflect', 'Object', 'Array', 'Number', 'String', 'Boolean', 'BigInt', 'JSON',
  'ArrayBuffer', 'DataView', 'Uint8Array', 'Uint16Array', 'Uint32Array',
  'Int8Array', 'Int16Array', 'Int32Array', 'Map', 'Set', 'WeakMap', 'WeakSet',
]);
const constructableBuiltins = new Set([
  'Object', 'Array', 'Number', 'String', 'Boolean', 'BigInt', 'ArrayBuffer', 'DataView',
  'Uint8Array', 'Uint16Array', 'Uint32Array', 'Int8Array', 'Int16Array', 'Int32Array',
  'Map', 'Set', 'WeakMap', 'WeakSet',
]);
const callableBuiltins = new Set(constructableBuiltins);
const objectMutators = new Set(['defineProperty', 'defineProperties', 'assign', 'setPrototypeOf', 'freeze', 'seal', 'preventExtensions']);
const builtinStaticMethods = new Map([
  ['Object', new Set([
    'assign', 'create', 'defineProperties', 'defineProperty', 'entries', 'freeze',
    'fromEntries', 'getOwnPropertyDescriptor', 'getOwnPropertyDescriptors',
    'getOwnPropertyNames', 'getOwnPropertySymbols', 'hasOwn', 'is', 'isExtensible',
    'isFrozen', 'isSealed', 'keys', 'preventExtensions', 'seal', 'setPrototypeOf', 'values',
  ])],
  ['Array', new Set(['from', 'isArray', 'of'])],
  ['Number', new Set(['isFinite', 'isInteger', 'isNaN', 'isSafeInteger', 'parseFloat', 'parseInt'])],
  ['String', new Set(['fromCharCode', 'fromCodePoint', 'raw'])],
  ['BigInt', new Set(['asIntN', 'asUintN'])],
  ['JSON', new Set(['parse', 'stringify'])],
  ['ArrayBuffer', new Set(['isView'])],
  ['Uint8Array', new Set(['from', 'of'])],
  ['Uint16Array', new Set(['from', 'of'])],
  ['Uint32Array', new Set(['from', 'of'])],
  ['Int8Array', new Set(['from', 'of'])],
  ['Int16Array', new Set(['from', 'of'])],
  ['Int32Array', new Set(['from', 'of'])],
]);
const builtinStaticConstants = new Map([
  ['Number', new Set([
    'EPSILON', 'MAX_SAFE_INTEGER', 'MIN_SAFE_INTEGER', 'MAX_VALUE', 'MIN_VALUE',
    'NaN', 'POSITIVE_INFINITY', 'NEGATIVE_INFINITY',
  ])],
  ['ArrayBuffer', new Set(['BYTES_PER_ELEMENT'])],
  ['Uint8Array', new Set(['BYTES_PER_ELEMENT'])],
  ['Uint16Array', new Set(['BYTES_PER_ELEMENT'])],
  ['Uint32Array', new Set(['BYTES_PER_ELEMENT'])],
  ['Int8Array', new Set(['BYTES_PER_ELEMENT'])],
  ['Int16Array', new Set(['BYTES_PER_ELEMENT'])],
  ['Int32Array', new Set(['BYTES_PER_ELEMENT'])],
]);
const equalityOperators = new Set(['===', '!==', '==', '!=']);

function visit(node, parent, inspect) {
  if (!node || typeof node !== 'object') return;
  if (typeof node.type === 'string') inspect(node, parent);
  for (const value of Object.values(node)) {
    if (Array.isArray(value)) value.forEach(child => visit(child, node, inspect));
    else if (value && typeof value === 'object') visit(value, node, inspect);
  }
}
function propertyName(node) {
  return node.computed ? resolveStaticModuleSpecifier(node.property) : node.property?.name ?? null;
}
function patternPropertyName(node) {
  if (node.computed) return resolveStaticModuleSpecifier(node.key);
  if (node.key?.type === 'Identifier') return node.key.name;
  return typeof node.key?.value === 'string' ? node.key.value : null;
}
function rootName(node) {
  while (node?.type === 'MemberExpression' || node?.type === 'ChainExpression') node = node.object ?? node.expression;
  return node?.type === 'Identifier' ? node.name : null;
}
function isNonReference(node, parent) {
  if (!parent) return false;
  if (parent.type === 'MemberExpression' && parent.property === node && !parent.computed) return true;
  if (['Property', 'MethodDefinition', 'PropertyDefinition'].includes(parent.type) && parent.key === node && !parent.computed && !parent.shorthand) return true;
  return ['LabeledStatement', 'BreakStatement', 'ContinueStatement'].includes(parent.type) && parent.label === node;
}
function isDirectBuiltinUse(node, parent) {
  if (parent?.type === 'CallExpression' && parent.callee === node) return callableBuiltins.has(node.name);
  if (parent?.type === 'NewExpression' && parent.callee === node) return constructableBuiltins.has(node.name);
  return parent?.type === 'BinaryExpression' && parent.operator === 'instanceof' && parent.right === node && constructableBuiltins.has(node.name);
}
function isStructuralPrototypeComparison(node, parent) {
  return propertyName(node) === 'prototype' && parent?.type === 'BinaryExpression' &&
    equalityOperators.has(parent.operator) && (parent.left === node || parent.right === node);
}
function isStructuralGetPrototypeOfUse(node, parent, parents) {
  if (node.object.type !== 'Identifier' || node.object.name !== 'Object' || propertyName(node) !== 'getPrototypeOf') return false;
  if (parent?.type !== 'CallExpression' || parent.callee !== node) return false;
  const comparison = parents.get(parent);
  return comparison?.type === 'BinaryExpression' && equalityOperators.has(comparison.operator) &&
    (comparison.left === parent || comparison.right === parent);
}
function builtinMemberAllowed(node, parent, parents) {
  const namespace = node.object.type === 'Identifier' ? node.object.name : null;
  if (!builtins.has(namespace)) return true;
  const property = propertyName(node);
  if (property === null) return false;
  if (namespace === 'Math') return integerMath.has(property) && parent?.type === 'CallExpression' && parent.callee === node;
  if (namespace === 'Reflect') return property === 'ownKeys' && parent?.type === 'CallExpression' && parent.callee === node;
  if (isStructuralPrototypeComparison(node, parent)) return constructableBuiltins.has(namespace);
  if (isStructuralGetPrototypeOfUse(node, parent, parents)) return true;
  if (builtinStaticConstants.get(namespace)?.has(property)) return true;
  return builtinStaticMethods.get(namespace)?.has(property) === true && parent?.type === 'CallExpression' && parent.callee === node;
}

// A conservative, falsifiable source/import audit, not a JavaScript sandbox or formal proof.
// The two imported modules are audited too; expanding the graph requires explicit review.
export async function auditStackedPurity(rootDirectory = defaultRoot) {
  const files = [], errors = [], seenErrors = new Set();
  const report = (file, node, message) => {
    const key = `${file}:${node?.loc?.start.line ?? 0}:${message}`;
    if (!seenErrors.has(key)) {
      seenErrors.add(key);
      errors.push({ file, line: node?.loc?.start.line ?? 0, message });
    }
  };
  let root;
  try { root = await realpath(resolve(rootDirectory)); }
  catch (cause) { report('<root>', null, `Cannot resolve audit root: ${cause.code ?? cause.name}`); return { ok: false, files, errors }; }
  for (const name of moduleNames) {
    const file = `apps/portal/src/${name}`;
    let tree;
    try {
      const path = await realpath(join(root, file));
      if (relative(root, path).replaceAll('\\', '/') !== file) {
        report(file, null, 'Canonical module resolves to a different path');
        continue;
      }
      tree = parse(await readFile(path, 'utf8'), { ecmaVersion: 'latest', sourceType: 'module', locations: true });
      files.push(file);
    } catch (cause) {
      report(file, null, cause instanceof SyntaxError ? `Parse failure: ${cause.message}` : `Cannot read module: ${cause.code ?? cause.name}`);
      continue;
    }
    const parents = new WeakMap();
    visit(tree, null, (node, parent) => {
      if (parent) parents.set(node, parent);
      if (node.type === 'ImportDeclaration' || ((node.type === 'ExportNamedDeclaration' || node.type === 'ExportAllDeclaration') && node.source)) {
        const specifier = resolveStaticModuleSpecifier(node.source);
        if (!allowedEdges.get(name).has(specifier)) report(file, node, `Unapproved module edge: ${String(specifier)}`);
      }
      if (node.type === 'ImportExpression') report(file, node, 'Dynamic imports are not allowed');
      if (node.type === 'MetaProperty' && node.meta?.name === 'import') report(file, node, 'import.meta is not allowed');
      if (node.type === 'Property' && parent?.type === 'ObjectPattern') {
        const property = patternPropertyName(node);
        if (property === null && node.computed) report(file, node, 'Unresolved computed destructuring is not allowed');
        else if (forbiddenDestructuredProperties.has(property) || ambientNames.has(property)) {
          report(file, node, `Prohibited destructured property: ${String(property)}`);
        }
      }
      if (node.type === 'Identifier' && !isNonReference(node, parent)) {
        if (ambientNames.has(node.name)) report(file, node, `Prohibited ambient reference: ${node.name}`);
        if (builtins.has(node.name) && !(parent?.type === 'MemberExpression' && parent.object === node) && !isDirectBuiltinUse(node, parent)) {
          report(file, node, `Builtin reference alias/escape is not allowed: ${node.name}`);
        }
      }
      if (node.type === 'MemberExpression') {
        const property = propertyName(node);
        if (forbiddenProperties.has(property) || ambientNames.has(property)) report(file, node, `Prohibited property: ${property}`);
        if (!builtinMemberAllowed(node, parent, parents)) {
          report(file, node, `Builtin member alias/escape or unresolved member is not allowed: ${String(rootName(node))}.${String(property)}`);
        }
      }
      if ((node.type === 'BinaryExpression' || node.type === 'AssignmentExpression') && ['**', '**='].includes(node.operator)) {
        report(file, node, 'Exponentiation is outside the integer simulation policy');
      }
      const target = node.type === 'AssignmentExpression' ? node.left :
        node.type === 'UpdateExpression' || (node.type === 'UnaryExpression' && node.operator === 'delete') ? node.argument : null;
      if (target && builtins.has(rootName(target))) report(file, node, 'Mutation of a builtin is not allowed');
      if (node.type === 'CallExpression' && node.callee.type === 'MemberExpression' && node.callee.object.type === 'Identifier' &&
          node.callee.object.name === 'Object' && objectMutators.has(propertyName(node.callee)) && builtins.has(rootName(node.arguments[0]))) {
        report(file, node, 'Mutation of a builtin through Object is not allowed');
      }
    });
  }
  return { ok: errors.length === 0 && files.length === moduleNames.length, files, errors };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const result = await auditStackedPurity();
  if (!result.ok) {
    console.error(JSON.stringify(result, null, 2));
    process.exitCode = 1;
  } else console.log(`STACKED sim purity passed: AST audit of ${result.files.length} canonical modules; closed import graph.`);
}
