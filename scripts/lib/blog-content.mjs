// Build-time content selection only. Raw Markdown is never trusted HTML.
const CATEGORIES = Object.freeze([
  Object.freeze({id:'news',label:'News'}),
  Object.freeze({id:'guides',label:'Guides'}),
  Object.freeze({id:'dev-notes',label:'Behind the scenes'}),
]);
const GAMES = new Set(['lester-blaster','chikun','stacked']);
const FIELDS = ['slug','title','summary','category','games','date','status','author'];
const RESERVED = new Set(['index','category','feed']);
const fail = message => { throw new TypeError('Blog content: '+message); };
const order = (a,b) => a<b?-1:a>b?1:0;
const newest = (a,b) => order(b.date,a.date)||order(a.slug,b.slug);

function text(value,name,max) {
  if(typeof value!=='string'||!value.trim()||value!==value.trim()||value.length>max||/[\u0000-\u001f\u007f]/u.test(value))fail('invalid '+name);
  return value;
}
function calendarDate(value) {
  if(typeof value!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(value))fail('date must be YYYY-MM-DD');
  const [year,month,day]=value.split('-').map(Number);
  const leap=year%4===0&&(year%100!==0||year%400===0);
  const days=[31,leap?29:28,31,30,31,30,31,31,30,31,30,31];
  if(year<1||month<1||month>12||day<1||day>days[month-1])fail('invalid calendar date');
  return value;
}

// JSON between Markdown front-matter delimiters avoids implicit YAML dates,
// aliases and uninstalled parsers. Unknown keys fail rather than being ignored.
export function parseBlogPost(markdown) {
  if(typeof markdown!=='string'||new TextEncoder().encode(markdown).byteLength>131072)fail('expected Markdown up to 128 KiB');
  const normalized=markdown.replaceAll('\r\n','\n');
  if(!normalized.startsWith('---\n'))fail('missing JSON front matter');
  const end=normalized.indexOf('\n---\n',4);
  if(end<0)fail('missing front matter delimiter');
  let metadata;
  try { metadata=JSON.parse(normalized.slice(4,end)); }
  catch { fail('invalid JSON front matter'); }
  if(!metadata||typeof metadata!=='object'||Array.isArray(metadata))fail('metadata must be an object');
  if(Object.keys(metadata).length!==FIELDS.length||FIELDS.some(key=>!Object.hasOwn(metadata,key)))fail('unknown or missing metadata key');
  const slug=text(metadata.slug,'slug',80);
  if(!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug)||RESERVED.has(slug))fail('invalid or reserved slug');
  const title=text(metadata.title,'title',120),summary=text(metadata.summary,'summary',280),author=text(metadata.author,'author',80);
  if(!CATEGORIES.some(item=>item.id===metadata.category))fail('unknown category');
  if(!Array.isArray(metadata.games)||metadata.games.some(game=>!GAMES.has(game))||new Set(metadata.games).size!==metadata.games.length)fail('invalid game tags');
  if(!['draft','published'].includes(metadata.status))fail('unknown publication status');
  const date=calendarDate(metadata.date),body=normalized.slice(end+5);
  if(!body.trim()||body.includes('\0'))fail('missing or invalid Markdown body');
  return Object.freeze({slug,title,summary,category:metadata.category,games:Object.freeze([...metadata.games]),date,status:metadata.status,author,body});
}

// asOf is supplied by the eventual builder, never inferred from host time.
// Duplicate slugs fail even when one source would be hidden from publication.
export function buildBlogIndex(sources,{asOf}={}) {
  calendarDate(asOf);
  if(!Array.isArray(sources))fail('source list required');
  const posts=sources.map(parseBlogPost),slugs=new Set();
  for(const post of posts) {
    if(slugs.has(post.slug))fail('duplicate slug: '+post.slug);
    slugs.add(post.slug);
  }
  const visible=posts.filter(post=>post.status==='published'&&post.date<=asOf).sort(newest);
  const relatedScore=(post,candidate)=>(post.games.some(game=>candidate.games.includes(game))?2:0)+(post.category===candidate.category?1:0);
  const result=visible.map(post=>Object.freeze({...post,related:Object.freeze(visible
    .filter(candidate=>candidate.slug!==post.slug&&relatedScore(post,candidate)>0)
    .sort((a,b)=>relatedScore(post,b)-relatedScore(post,a)||newest(a,b))
    .slice(0,3).map(candidate=>candidate.slug))}));
  return Object.freeze({asOf,posts:Object.freeze(result),categories:Object.freeze(CATEGORIES.map(category=>Object.freeze({
    ...category,count:visible.filter(post=>post.category===category.id).length,
  })))});
}
