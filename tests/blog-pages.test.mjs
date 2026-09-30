import test from 'node:test';
import assert from 'node:assert/strict';
import {buildBlogIndex} from '../scripts/lib/blog-content.mjs';
const api=()=>import('../scripts/lib/blog-pages.mjs');
const source=(slug,extra={})=>'---\n'+JSON.stringify({slug,title:slug+' title',summary:slug+' summary',category:'news',games:[],date:'2026-09-30',status:'published',author:'Arcade team',...extra})+'\n---\n## First steps\n\nStart here.';
const index=()=>buildBlogIndex([source('newest'),source('older',{date:'2026-09-29',category:'guides'}),source('secret-draft',{status:'draft'}),source('future',{date:'2027-01-01'})],{asOf:'2026-09-30'});

test('listing uses semantic article cards in publication order with one H1',async()=>{
 const {renderBlogListing}=await api(),html=renderBlogListing(index());
 assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.equal((html.match(/<article\b/g)||[]).length,2);
 assert.ok(html.indexOf('href="/blog/newest"')<html.indexOf('href="/blog/older"'));
 assert.match(html,/datetime="2026-09-30"/);assert.match(html,/Skip to articles/);assert.match(html,/id="main" tabindex="-1"/);
 assert.doesNotMatch(html,/<script\b|secret-draft|future/);
});
test('category page contains only selected posts and native navigation marks one current page',async()=>{
 const {renderBlogListing}=await api(),html=renderBlogListing(index(),{category:'guides'});
 assert.match(html,/<h1>Guides<\/h1>/);assert.match(html,/href="\/blog\/older"/);assert.doesNotMatch(html,/href="\/blog\/newest"/);
 assert.equal((html.match(/aria-current="page"/g)||[]).length,1);
 assert.match(html,/<a href="\/blog\/category\/guides" aria-current="page">/);
 assert.match(html,/rel="canonical" href="https:\/\/lestersarcade.io\/blog\/category\/guides"/);
});
test('empty valid categories remain useful without publishing hidden content',async()=>{
 const {renderBlogListing}=await api(),html=renderBlogListing(index(),{category:'dev-notes'});
 assert.match(html,/No articles here yet/);assert.match(html,/href="\/blog">Browse all articles/);assert.doesNotMatch(html,/<article\b|secret-draft|future/);
});
test('listing category validates type and rejects unknown or path-like values',async()=>{
 const {renderBlogListing}=await api();for(const category of ['News','../news','',0,{},'toString'])assert.throws(()=>renderBlogListing(index(),{category}),/category/i);
});
test('every public renderer rejects copied or fabricated publication indexes',async()=>{
 const {renderBlogListing,renderBlogFeed,buildBlogPages}=await api(),valid=index();
 for(const invalid of [null,{...valid},JSON.parse(JSON.stringify(valid)),{posts:[]}])for(const render of [renderBlogListing,renderBlogFeed,buildBlogPages])assert.throws(()=>render(invalid),/publication index/i);
});
test('listing escapes hostile metadata as text and attributes',async()=>{
 const {renderBlogListing}=await api(),valid=buildBlogIndex([source('safe',{title:'<script> & "hello"',summary:'<img onerror=x>',author:'<svg onload=x>'})],{asOf:'2026-09-30'}),html=renderBlogListing(valid);
 assert.match(html,/&lt;script&gt; &amp; &quot;hello&quot;/);assert.match(html,/&lt;img onerror=x&gt;/);assert.doesNotMatch(html,/<script|<svg|<img onerror/);
});
test('Atom uses stable absolute identities dates self link author and escaped summaries',async()=>{
 const {renderBlogFeed}=await api(),xml=renderBlogFeed(index());
 assert.match(xml,/^<\?xml version="1.0" encoding="utf-8"\?>/);assert.match(xml,/<feed xmlns="http:\/\/www.w3.org\/2005\/Atom">/);
 assert.match(xml,/<link rel="self" type="application\/atom\+xml" href="https:\/\/lestersarcade.io\/blog\/feed.xml"/);
 assert.equal((xml.match(/<entry>/g)||[]).length,2);assert.match(xml,/<id>https:\/\/lestersarcade.io\/blog\/newest<\/id>/);
 assert.match(xml,/<updated>2026-09-30T00:00:00Z<\/updated>/);assert.match(xml,/<author><name>Arcade team<\/name><\/author>/);
 assert.doesNotMatch(xml,/secret-draft|future|First steps|DOCTYPE/);
});
test('Atom escapes XML metacharacters and keeps articles out of executable markup',async()=>{
 const {renderBlogFeed}=await api(),valid=buildBlogIndex([source('safe',{title:'Tea & <script>',summary:'"A" < B',author:"O'Clock"})],{asOf:'2026-09-30'}),xml=renderBlogFeed(valid);
 assert.match(xml,/<title>Tea &amp; &lt;script&gt;<\/title>/);assert.match(xml,/<summary type="text">&quot;A&quot; &lt; B<\/summary>/);assert.match(xml,/O&#39;Clock/);assert.doesNotMatch(xml,/<script>/);
});
test('empty publication produces a valid empty feed and no invented article',async()=>{
 const {renderBlogFeed,buildBlogPages}=await api(),valid=buildBlogIndex([],{asOf:'2026-09-30'}),xml=renderBlogFeed(valid);
 assert.doesNotMatch(xml,/<entry>/);assert.match(xml,/<updated>2026-09-30T00:00:00Z<\/updated>/);assert.equal(buildBlogPages(valid).length,5);
});
test('bundle contains index categories feed and visible articles at unique contained paths',async()=>{
 const {buildBlogPages}=await api(),pages=buildBlogPages(index());
 assert.deepEqual(pages.map(p=>p.path),['blog/index.html','blog/category/news/index.html','blog/category/guides/index.html','blog/category/dev-notes/index.html','blog/feed.xml','blog/newest/index.html','blog/older/index.html']);
 assert.ok(pages.every(p=>!p.path.includes('..')&&!p.path.startsWith('/')&&typeof p.content==='string'));
 assert.equal(pages.find(p=>p.path==='blog/feed.xml').mediaType,'application/atom+xml; charset=utf-8');
 assert.ok(pages.filter(p=>p.path.endsWith('.html')).every(p=>p.mediaType==='text/html; charset=utf-8'));
 assert.doesNotMatch(pages.map(p=>p.content).join(''),/secret-draft/);
});
test('bundle output is immutable deterministic and independent of source input order',async()=>{
 const {buildBlogPages}=await api(),sources=[source('alpha'),source('beta'),source('older',{date:'2026-09-29'})];
 const first=buildBlogPages(buildBlogIndex(sources,{asOf:'2026-09-30'})),second=buildBlogPages(buildBlogIndex([...sources].reverse(),{asOf:'2026-09-30'}));
 assert.deepEqual(first,second);assert.throws(()=>first.push({}));assert.throws(()=>{first[0].content='bad';});
});
test('generated articles reuse the reviewed article renderer and link back to the journal',async()=>{
 const {buildBlogPages}=await api(),pages=buildBlogPages(index()),html=pages.find(p=>p.path==='blog/newest/index.html').content;
 assert.match(html,/id="section-first-steps"/);assert.match(html,/href="\/blog">Arcade journal<\/a>/);assert.match(html,/rel="alternate" type="application\/atom\+xml"/);
 assert.match(html,/content="index, follow"/);assert.doesNotMatch(html,/<script\b/);
});

test('Atom rejects forbidden XML scalars while preserving valid non-BMP text',async()=>{
 const {renderBlogFeed,buildBlogPages}=await api();
 for(const bad of ['\ufffe','\uffff','\ud800','\udfff'])for(const field of ['title','summary','author']){
  const valid=buildBlogIndex([source('xml',{[field]:'Bad '+bad})],{asOf:'2026-09-30'});
  assert.throws(()=>renderBlogFeed(valid),/XML/);assert.throws(()=>buildBlogPages(valid),/XML/);
 }
 const valid=buildBlogIndex([source('xml',{title:'A trophy 🏆'})],{asOf:'2026-09-30'});assert.match(renderBlogFeed(valid),/A trophy 🏆/);
});
