import test from 'node:test';
import assert from 'node:assert/strict';
const moduleUrl = new URL('../scripts/lib/blog-content.mjs', import.meta.url);
const api = () => import(moduleUrl);
const meta = {slug:'building-the-arcade',title:'Building the arcade',summary:'Notes from all three cabinets.',category:'dev-notes',games:['lester-blaster','chikun','stacked'],date:'2026-09-30',status:'draft',author:"Lester’s Arcade"};
const source = (changes={},body='## Three cabinets\n\nKeep playing.\n') => `---\n${JSON.stringify({...meta,...changes},null,2)}\n---\n${body}`;

test('reads JSON front matter in Markdown and preserves the body and Unicode',async()=>{
  const {parseBlogPost}=await api();const post=parseBlogPost(source().replaceAll('\n','\r\n'));
  assert.equal(post.slug,meta.slug);assert.equal(post.author,meta.author);assert.equal(post.body,'## Three cabinets\n\nKeep playing.\n');assert.deepEqual(post.games,meta.games);
});
test('rejects missing malformed non-record and unknown metadata',async()=>{
  const {parseBlogPost}=await api();
  for(const value of ['# no metadata','---\n{bad}\n---\nBody','---\n[]\n---\nBody',source({publish:true}),source({title:undefined})])assert.throws(()=>parseBlogPost(value));
});
test('slugs cannot collide with index routes or traverse paths and categories are explicit',async()=>{
  const {parseBlogPost}=await api();
  for(const slug of ['../escape','a/b','%2e%2e','https://evil.test','two words','Upper','a--b','index','category','feed','a'.repeat(81)])assert.throws(()=>parseBlogPost(source({slug})));
  assert.throws(()=>parseBlogPost(source({category:'unknown'})));
});
test('dates are real calendar dates without time-zone or Date rollover acceptance',async()=>{
  const {parseBlogPost}=await api();
  for(const date of ['2026-02-29','2026-04-31','2026-13-01','2026-00-01','2026-9-30','2026-09-30T00:00Z',null])assert.throws(()=>parseBlogPost(source({date})));
  assert.equal(parseBlogPost(source({date:'2028-02-29'})).date,'2028-02-29');
});
test('status and game tags reject misspellings duplicates and invalid shapes',async()=>{
  const {parseBlogPost}=await api();
  for(const changes of [{status:'live'},{games:['hmh']},{games:['stacked','stacked']},{games:'stacked'},{games:[null]}])assert.throws(()=>parseBlogPost(source(changes)));
  assert.deepEqual(parseBlogPost(source({games:[]})).games,[]);
});
test('empty oversized and non-text content fails before an index is built',async()=>{
  const {parseBlogPost}=await api();
  for(const value of [null,source({},'   '),source({title:' '}),source({title:'x'.repeat(121)}),source({summary:'x'.repeat(281)}),source({author:'x'.repeat(81)}),source({},'é'.repeat(70000))])assert.throws(()=>parseBlogPost(value));
});
test('publication selection requires an explicit valid date and never reads a clock',async()=>{
  const {buildBlogIndex}=await api();
  for(const options of [undefined,{}, {asOf:'today'},{asOf:'2026-02-29'}])assert.throws(()=>buildBlogIndex([],options));
  assert.deepEqual(buildBlogIndex([],{asOf:'2026-09-30'}).posts,[]);
});
test('draft and future posts cannot leak through posts categories or related links',async()=>{
  const {buildBlogIndex}=await api();const result=buildBlogIndex([
    source({slug:'visible',status:'published'}),source({slug:'secret-draft',category:'news'}),source({slug:'future-news',status:'published',category:'news',date:'2026-10-01'})
  ],{asOf:'2026-09-30'});
  assert.deepEqual(result.posts.map(p=>p.slug),['visible']);assert.deepEqual(result.posts[0].related,[]);
  assert.deepEqual(result.categories.map(c=>[c.id,c.count]),[['news',0],['guides',0],['dev-notes',1]]);
  assert.doesNotMatch(JSON.stringify(result),/secret-draft|future-news/);
});
test('ordering is newest first with stable ASCII slug ties independent of source order',async()=>{
  const {buildBlogIndex}=await api();const sources=['zeta','alpha','middle'].map(slug=>source({slug,status:'published',date:slug==='middle'?'2026-09-29':meta.date}));
  const one=buildBlogIndex(sources,{asOf:meta.date}),two=buildBlogIndex([...sources].reverse(),{asOf:meta.date});
  assert.deepEqual(one,two);assert.deepEqual(one.posts.map(p=>p.slug),['alpha','zeta','middle']);
});
test('related reading prefers a shared game then category without self links and is capped at three',async()=>{
  const {buildBlogIndex}=await api();const sources=[
    source({slug:'current',status:'published',games:['stacked'],category:'guides'}),
    source({slug:'same-game',status:'published',games:['stacked'],category:'news',date:'2026-09-20'}),
    source({slug:'same-category',status:'published',games:['chikun'],category:'guides'}),
    source({slug:'both',status:'published',games:['stacked'],category:'guides',date:'2026-09-01'}),
    source({slug:'fourth-eligible',status:'published',games:['chikun'],category:'guides',date:'2026-09-01'}),
    source({slug:'unrelated',status:'published',games:['chikun'],category:'news'})];
  const index=buildBlogIndex(sources,{asOf:meta.date});assert.deepEqual(index.posts.find(p=>p.slug==='current').related,['both','same-game','same-category']);
});
test('index and parsed records are deeply immutable and input order is untouched',async()=>{
  const {parseBlogPost,buildBlogIndex}=await api();const sources=[source({status:'published'})],before=[...sources],post=parseBlogPost(sources[0]);
  assert.throws(()=>post.games.push('chikun'));assert.throws(()=>{post.title='Changed';});
  const index=buildBlogIndex(sources,{asOf:meta.date});assert.throws(()=>index.posts[0].related.push('anything'));assert.throws(()=>{index.categories[0].count=99;});assert.throws(()=>index.posts.pop());assert.deepEqual(sources,before);
});
test('duplicate slugs fail including hidden drafts and empty inputs remain valid',async()=>{
  const {buildBlogIndex}=await api();assert.throws(()=>buildBlogIndex([source(),source({status:'published'})],{asOf:meta.date}),/duplicate/i);
  assert.throws(()=>buildBlogIndex(null,{asOf:meta.date}));const empty=buildBlogIndex([],{asOf:meta.date});assert.equal(empty.posts.length,0);assert.equal(empty.categories.reduce((sum,c)=>sum+c.count,0),0);
});
