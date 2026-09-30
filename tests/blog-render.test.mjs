import test from 'node:test';
import assert from 'node:assert/strict';
import {parseBlogPost} from '../scripts/lib/blog-content.mjs';
const api=()=>import('../scripts/lib/blog-render.mjs');
const meta={slug:'three-games-one-arcade',title:'Three games. One arcade.',summary:'Find your next favourite cabinet.',category:'guides',games:[],date:'2026-09-30',status:'draft',author:"Lester’s Arcade"};
const post=(body='## Pick a cabinet\n\nStart with Free Mode.',extra={})=>parseBlogPost(`---\n${JSON.stringify({...meta,...extra})}\n---\n${body}`);

test('paragraphs headings lists quotes and inline emphasis form semantic static HTML',async()=>{
 const {renderBlogMarkdown}=await api();const result=renderBlogMarkdown('## Play\n\nTry **Free Mode** and `WASD`.\n\n- HMH\n- STACKED\n\n> One more run.');
 assert.match(result.html,/<h2 id="section-play">Play<\/h2>/);assert.match(result.html,/<p>Try <strong>Free Mode<\/strong> and <code>WASD<\/code>\.<\/p>/);
 assert.match(result.html,/<ul><li>HMH<\/li><li>STACKED<\/li><\/ul>/);assert.match(result.html,/<blockquote><p>One more run\.<\/p><\/blockquote>/);
 assert.deepEqual(result.toc,[{id:'section-play',title:'Play',level:2}]);
});
test('raw HTML and code markup are escaped without executable elements',async()=>{
 const {renderBlogMarkdown}=await api();const result=renderBlogMarkdown('<img src=x onerror=alert(1)>\n\n`<script>`\n\n**<svg onload=x>**');
 assert.doesNotMatch(result.html,/<(?:img|script|svg)\b/);assert.match(result.html,/&lt;img/);assert.match(result.html,/<code>&lt;script&gt;<\/code>/);
});
test('root-relative HTTPS and section links survive escaping and have no new-window behavior',async()=>{
 const {renderBlogMarkdown}=await api();const {html}=renderBlogMarkdown('[Games](/games?a=1&b=2) [Read](https://example.com/page) [Here](#section-play)');
 assert.match(html,/href="\/games\?a=1&amp;b=2"/);assert.match(html,/href="https:\/\/example.com\/page"/);assert.match(html,/href="#section-play"/);assert.doesNotMatch(html,/target=/);
});
test('unsafe URL schemes protocol-relative links credentials and backslashes fail',async()=>{
 const {renderBlogMarkdown}=await api();
 for(const url of ['javascript:alert','data:text/html,bad','http://example.com','//example.com','https://u:p@example.com','/\\example.com','java\u0000script:bad'])assert.throws(()=>renderBlogMarkdown(`[bad](${url})`));
});
test('unclosed fences fail and fenced content does not create headings links or executable HTML',async()=>{
 const {renderBlogMarkdown}=await api();assert.throws(()=>renderBlogMarkdown('```\nnever closes'));
 const result=renderBlogMarkdown('```text\n## Not a section\n<script>x</script>\n[bad](javascript:x)\n```');
 assert.equal(result.toc.length,0);assert.doesNotMatch(result.html,/<h2|<a |<script>/);assert.match(result.html,/<pre><code>## Not a section/);
});
test('heading anchors stay unique even when authored suffixes collide',async()=>{
 const {renderBlogMarkdown}=await api();const result=renderBlogMarkdown('## Play\n## Play\n### Play 2\n### !!!');
 assert.deepEqual(result.toc.map(x=>x.id),['section-play','section-play-2','section-play-2-2','section-section']);
 assert.throws(()=>result.toc.push({}));assert.throws(()=>{result.toc[0].id='changed';});
});
test('article uses one H1 skip link TOC and escaped metadata with preview noindex',async()=>{
 const {renderBlogArticle}=await api();const html=renderBlogArticle(post('## Play\n\nGo.',{title:'<img src=x>',summary:'"quoted" & useful'}),{preview:true});
 assert.equal((html.match(/<h1\b/g)||[]).length,1);assert.match(html,/href="#main"/);assert.match(html,/id="main"[^>]*tabindex="-1"/);assert.match(html,/aria-label="On this page"/);
 assert.match(html,/content="noindex, nofollow"/);assert.match(html,/Editorial preview/);assert.match(html,/&lt;img src=x&gt;/);assert.doesNotMatch(html,/<img src=x/);assert.doesNotMatch(html,/<script\b/);
});
test('drafts cannot render as public articles and publication requires a visible index member',async()=>{
 const {renderBlogArticle}=await api();assert.throws(()=>renderBlogArticle(post()));
 assert.throws(()=>renderBlogArticle(post('',{status:'published'})));
 const published=post('## Play\n\nGo.',{status:'published'});assert.throws(()=>renderBlogArticle(published));
});
test('public article canonical and related links derive only from a validated publication index',async()=>{
 const {renderBlogArticle}=await api();const {buildBlogIndex}=await import('../scripts/lib/blog-content.mjs');
 const source=(slug)=>`---\n${JSON.stringify({...meta,slug,status:'published'})}\n---\n## Play\n\nGo.`;
 const index=buildBlogIndex([source('first'),source('second')],{asOf:'2026-09-30'});
 const html=renderBlogArticle(index.posts[0],{index});assert.match(html,/rel="canonical" href="https:\/\/lestersarcade.io\/blog\/first"/);
 assert.match(html,/href="\/blog\/second"/);assert.match(html,/content="index, follow"/);assert.doesNotMatch(html,/Editorial preview/);
});
test('Markdown inputs are bounded text and unsupported H1 remains escaped body text',async()=>{
 const {renderBlogMarkdown}=await api();for(const input of [null,'x'.repeat(131073),'bad\0text'])assert.throws(()=>renderBlogMarkdown(input));
 const result=renderBlogMarkdown('# Not another page title');assert.doesNotMatch(result.html,/<h1/);assert.match(result.html,/<p># Not another page title<\/p>/);
});
test('published identity cannot be forged or replaced by a draft or future body at the same slug',async()=>{
 const {renderBlogArticle}=await api();const {buildBlogIndex}=await import('../scripts/lib/blog-content.mjs');
 const source=`---\n${JSON.stringify({...meta,status:'published'})}\n---\n## Ready\n\nReviewed body.`;
 const index=buildBlogIndex([source],{asOf:meta.date}),member=index.posts[0];
 for(const impostor of [post(),post('Future body.',{status:'published',date:'2026-10-01'}),{...member,body:'Unreviewed replacement.'}])assert.throws(()=>renderBlogArticle(impostor,{index}));
 assert.throws(()=>renderBlogArticle(member,{index:{asOf:meta.date,posts:[member]}}),/publication index/);
});
test('blank headings cannot create empty section links',async()=>{
 const {renderBlogMarkdown}=await api();assert.throws(()=>renderBlogMarkdown('##   \n\nBody.'),/heading/i);
});
