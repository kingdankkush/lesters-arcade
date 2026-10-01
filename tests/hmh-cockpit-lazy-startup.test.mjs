import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { runInNewContext } from 'node:vm';
import { parse } from 'acorn';

const source = await readFile(new URL('../apps/hmh-reboot/src/main.mjs', import.meta.url), 'utf8');
const ast = parse(source, { ecmaVersion: 'latest', sourceType: 'module' });
const loader = ast.body.find(node => node.type === 'FunctionDeclaration' && node.id.name === 'loadLazyRuntimeModules');

// Execute the actual existing startup loader. Replace only its module requests
// with controlled promises; the memoization, joining and binding statements
// are the unchanged source under test. No game, Git, renderer or clock runs.
function fixture(loadModule) {
  const requests = [], names = new Set(['lazyRuntimeModulesLoad','summaryV7','createCockpitUi']);
  const visit = node => {
    if (!node || typeof node !== 'object') return;
    if (node.type === 'ImportExpression') requests.push(node);
    if (node.type === 'AssignmentExpression' && node.left.type === 'ObjectPattern') {
      for (const property of node.left.properties) { assert.equal(property.value.type, 'Identifier'); names.add(property.value.name); }
    }
    for (const value of Object.values(node)) if (Array.isArray(value)) value.forEach(visit); else if (value && typeof value === 'object') visit(value);
  };
  visit(loader);
  let body = source.slice(loader.start, loader.end);
  for (const node of requests.sort((a,b) => b.start-a.start)) {
    assert.equal(node.source.type, 'Literal');
    const left=node.start-loader.start,right=node.end-loader.start;
    body=body.slice(0,left)+`loadModule(${JSON.stringify(node.source.value)})`+body.slice(right);
  }
  return runInNewContext(`let ${[...names].join(',')};${body};({load:loadLazyRuntimeModules,read:()=>createCockpitUi})`, { loadModule, Promise, HMH_WORLD_CONTEXT: { legacy: true, official: true } });
}

test('the real startup loader requests cockpit lazily, joins it once and waits for the original factory', async () => {
  let release;
  const delayed = new Promise(resolve => { release=resolve; });
  const requests=[];
  const actual = fixture(specifier => { requests.push(specifier); return specifier==='./cockpit-ui.mjs' ? delayed : Promise.resolve({}); });
  const first=actual.load(),second=actual.load();
  assert.equal(first,second,'startup callers must share the existing single join');
  assert.equal(requests.filter(path=>path==='./cockpit-ui.mjs').length,1,'cockpit code must enter the lazy startup graph once');
  let finished=false;first.then(()=>{finished=true;});
  await Promise.resolve();await Promise.resolve();
  assert.equal(finished,false);assert.equal(actual.read(),undefined);
  const originalFactory=()=>({source:'unchanged-cockpit'});
  release({createCockpitUi:originalFactory});await first;
  assert.equal(actual.read(),originalFactory,'no wrapper or replacement of existing callbacks');
  assert.equal(actual.load(),first,'subsequent runs reuse the resident code');
});

test('a failed cockpit module rejects the startup join before an undefined factory can activate', async () => {
  const failure = new Error('controlled cockpit module unavailable');
  let reject;
  const delayed=new Promise((_resolve,rejectPromise)=>{reject=rejectPromise;});
  const requests=[];
  const actual=fixture(specifier=>{requests.push(specifier);return specifier==='./cockpit-ui.mjs'?delayed:Promise.resolve({});});
  const join=actual.load();
  assert.equal(requests.includes('./cockpit-ui.mjs'),true);
  const rejected=assert.rejects(join,error=>error===failure);reject(failure);await rejected;
  assert.equal(actual.read(),undefined);
});

test('cockpit no longer has a static entry import and its constructor remains after the awaited startup join', () => {
  assert.equal(ast.body.some(node=>node.type==='ImportDeclaration'&&node.source.value==='./cockpit-ui.mjs'),false);
  const boot=ast.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='boot');
  const barrier=startupBarrier();
  const ctor=source.indexOf('cockpit = createCockpitUi(',boot.start);
  assert.ok(barrier&&ctor>barrier.end,'the loaded unchanged UI must exist before bridge activation');
});

function startupBarrier() {
  const boot=ast.body.find(node=>node.type==='FunctionDeclaration'&&node.id.name==='boot');
  const containsJoin=node=>{
    if (!node || typeof node!=='object') return false;
    if (node.type==='AwaitExpression'&&node.argument.type==='Identifier'&&node.argument.name==='lazyRuntimeModules') return true;
    return Object.values(node).some(value=>Array.isArray(value)?value.some(containsJoin):containsJoin(value));
  };
  const statement=boot.body.body.find(containsJoin);
  assert.ok(statement,'the real boot must await the joined modules');
  return statement;
}

// Exercise the actual owned boot barrier with controlled resource methods.
// The source remains responsible for cleanup; this fixture does not add it.
function runBarrier({join, bridge, destroy, errors, calls}) {
  const statement=startupBarrier();
  return runInNewContext(`(async()=>{${source.slice(statement.start,statement.end)};calls.push('continued');})()`, {
    lazyRuntimeModules:join,bridge,app:{destroy},calls,
    console:{error:(...args)=>errors.push(args)},
  });
}

test('a rejected lazy startup releases the initialized renderer and bridge without continuing', async()=>{
  const failure=new Error('controlled download rejection'),calls=[],errors=[];
  await assert.rejects(runBarrier({join:Promise.reject(failure),bridge:{stop:()=>calls.push('bridge-stop')},
    destroy:removeCanvas=>{assert.equal(removeCanvas,true);calls.push('app-destroy');},errors,calls}),error=>error===failure);
  assert.deepEqual(calls,['bridge-stop','app-destroy']);assert.deepEqual(errors,[]);
});

test('failed standalone startup releases its renderer and a successful join retains its resources', async()=>{
  const failure=new Error('standalone module unavailable'),calls=[],errors=[];
  await assert.rejects(runBarrier({join:Promise.reject(failure),bridge:null,destroy:()=>calls.push('app-destroy'),errors,calls}),error=>error===failure);
  assert.deepEqual(calls,['app-destroy']);
  calls.length=0;
  await runBarrier({join:Promise.resolve(),bridge:{stop:()=>calls.push('bridge-stop')},destroy:()=>calls.push('app-destroy'),errors,calls});
  assert.deepEqual(calls,['continued']);assert.deepEqual(errors,[]);
});

test('cleanup attempts both owned resources and keeps the original startup error if cleanup throws', async()=>{
  for (const method of ['bridge','renderer']) {
    const failure=new Error('original module rejection'),cleanupError=new Error('controlled cleanup failure'),calls=[],errors=[];
    await assert.rejects(runBarrier({join:Promise.reject(failure),bridge:{stop:()=>{calls.push('bridge-stop');if(method==='bridge')throw cleanupError;}},
      destroy:()=>{calls.push('app-destroy');if(method==='renderer')throw cleanupError;},errors,calls}),error=>error===failure);
    assert.deepEqual(calls,['bridge-stop','app-destroy']);assert.equal(errors.length,1);assert.equal(errors[0][1],cleanupError);
  }
});
