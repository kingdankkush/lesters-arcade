import {parseBlogPost,isBlogPublicationIndex} from './blog-content.mjs';

const ORIGIN='https://lestersarcade.io';
const ART=Object.freeze({
  'lester-blaster':{src:'/assets/hmh-art/banners/hmh-extra4-1600.webp',alt:'Hard Money Heroes key art'},
  chikun:{src:'/assets/generated/chikun-mode-select/chikuns-escape-free-mode.webp',alt:'Chikun’s Escape key art'},
  stacked:{src:'/assets/stacked-mode-select/stacked-free-v1.png',alt:'STACKED key art'},
});
// Article-specific share images (1200x630, gore-free, built by scripts/build-blog-og-card.py).
const ART_BY_SLUG=Object.freeze({
  'lesters-arcade-2-0-first-drop':{src:'/assets/share-cards/blog/lesters-arcade-2-0-first-drop.jpg',alt:'Lester’s Arcade 2.0, the visual overhaul first drop: Hard Money Heroes, Chikun’s Escape and STACKED',width:1200,height:630},
});
export const blogArtwork=post=>ART_BY_SLUG[post?.slug]??ART[post?.games?.[0]]??{src:'/assets/brand/lesters-arcade-logo-horizontal.png',alt:'Lester’s Arcade'};

const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function linkTarget(value){
  if(/[\s\u0000-\u001f\u007f\\]/u.test(value))throw new TypeError('Invalid blog link');
  if(value.startsWith('#'))return value;
  if(!value.startsWith('https://')&&(!value.startsWith('/')||value.startsWith('//')))throw new TypeError('Blog links require HTTPS or a local path');
  const url=new URL(value,ORIGIN);
  if(url.username||url.password||url.protocol!=='https:')throw new TypeError('Invalid blog link');
  return value.startsWith('/')?url.pathname+url.search+url.hash:url.href;
}
function inline(text){
  const tokens=/`([^`\n]+)`|\*\*([^*\n]+)\*\*|\[([^\]\n]+)\]\(([^)\n]*)\)/g;
  let result='',end=0;
  for(const match of text.matchAll(tokens)){
    result+=escape(text.slice(end,match.index));
    if(match[1]!==undefined)result+='<code>'+escape(match[1])+'</code>';
    else if(match[2]!==undefined)result+='<strong>'+escape(match[2])+'</strong>';
    else result+='<a href="'+escape(linkTarget(match[4]))+'">'+escape(match[3])+'</a>';
    end=match.index+match[0].length;
  }
  return result+escape(text.slice(end));
}

// An intentionally small authoring subset: paragraphs, H2/H3/H4, flat bullet
// lists, block quotes, fenced code, links, strong and code spans. Raw HTML is text.
export function renderBlogMarkdown(markdown){
  if(typeof markdown!=='string'||new TextEncoder().encode(markdown).byteLength>131072||markdown.includes('\0'))throw new TypeError('Bounded Markdown text required');
  const lines=markdown.replaceAll('\r\n','\n').split('\n'),html=[],toc=[],used=new Set();
  let paragraph=[],list=[],quote=[],code=null;
  function flush(){
    if(paragraph.length){html.push('<p>'+inline(paragraph.join(' '))+'</p>');paragraph=[];}
    if(list.length){html.push('<ul>'+list.map(text=>'<li>'+inline(text)+'</li>').join('')+'</ul>');list=[];}
    if(quote.length){html.push('<blockquote><p>'+inline(quote.join(' '))+'</p></blockquote>');quote=[];}
  }
  for(const line of lines){
    if(code!==null){if(line==='```'){html.push('<pre><code>'+escape(code.join('\n'))+'</code></pre>');code=null;}else code.push(line);continue;}
    if(/^```[a-z0-9-]*$/i.test(line)){flush();code=[];continue;}
    if(!line.trim()){flush();continue;}
    const heading=/^(#{2,4}) (.+)$/.exec(line);
    if(heading){
      flush();const title=heading[2].trim(),level=heading[1].length;
      if(!title)throw new TypeError('Blank Markdown heading');
      const name=title.normalize('NFKD').toLowerCase().replace(/[\u0300-\u036f]/g,'').replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'section';
      const base='section-'+name;let id=base,n=2;while(used.has(id))id=base+'-'+n++;used.add(id);
      toc.push(Object.freeze({id,title,level}));html.push(`<h${level} id="${id}">${escape(title)}</h${level}>`);continue;
    }
    if(line.startsWith('- ')){if(paragraph.length||quote.length)flush();list.push(line.slice(2));continue;}
    if(line.startsWith('> ')){if(paragraph.length||list.length)flush();quote.push(line.slice(2));continue;}
    if(list.length||quote.length)flush();paragraph.push(line.trim());
  }
  if(code!==null)throw new TypeError('Unclosed Markdown code fence');
  flush();return Object.freeze({html:html.join('\n'),toc:Object.freeze(toc)});
}
function validated(post){
  const fields=['slug','title','summary','category','games','date','status','author'];
  return parseBlogPost('---\n'+JSON.stringify(Object.fromEntries(fields.map(key=>[key,post?.[key]])))+'\n---\n'+(post?.body??''));
}

// index is the caller's buildBlogIndex result. Membership and cutoff are checked
// again before public rendering; preview is explicit and carries no canonical URL.
export function renderBlogArticle(post,{preview=false,index}={}){
  const checked=validated(post);
  if(!preview&&(!isBlogPublicationIndex(index)||!index.posts.includes(post)))throw new TypeError('Public article must belong to the publication index');
  const rendered=renderBlogMarkdown(checked.body),title=checked.title+" | Lester’s Arcade",canonical=ORIGIN+'/blog/'+checked.slug;
  const toc=rendered.toc.length?'<nav class="guide-toc" aria-label="On this page"><h2>On this page</h2><ul>'+rendered.toc.map(item=>`<li><a href="#${item.id}">${escape(item.title)}</a></li>`).join('')+'</ul></nav>':'';
  const related=preview?[]:(post.related??[]).map(slug=>index.posts.find(candidate=>candidate.slug===slug)).filter(Boolean).map(validated);
  const art=blogArtwork(checked);
  const category={news:'News',guides:'Guides','dev-notes':'Behind the scenes'}[checked.category];
  return `<!doctype html>
<html lang="en"><head>
<meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#05070f" /><title>${escape(title)}</title>
<meta name="description" content="${escape(checked.summary)}" /><meta name="robots" content="${preview?'noindex, nofollow':'index, follow'}" />
${preview?'':`<link rel="canonical" href="${canonical}" /><link rel="alternate" type="application/atom+xml" title="Lester’s Arcade journal" href="/blog/feed.xml" /><meta property="og:type" content="article" /><meta property="og:url" content="${canonical}" /><meta property="og:title" content="${escape(title)}" /><meta property="og:description" content="${escape(checked.summary)}" />`}
<meta property="og:image" content="${ORIGIN+art.src}" /><meta property="og:image:alt" content="${escape(art.alt)}" />${art.width?`<meta property="og:image:width" content="${art.width}" /><meta property="og:image:height" content="${art.height}" />`:''}<meta name="twitter:card" content="summary_large_image" /><meta name="twitter:image" content="${ORIGIN+art.src}" />
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" /><link rel="icon" type="image/png" sizes="32x32" href="/assets/icons/favicon-32.png" /><link rel="icon" type="image/png" sizes="16x16" href="/assets/icons/favicon-16.png" /><link rel="apple-touch-icon" sizes="180x180" href="/assets/icons/apple-touch-icon.png" />
<link rel="stylesheet" href="/src/design-tokens.css" /><link rel="stylesheet" href="/how-ranked-works.css" /><link rel="stylesheet" href="/blog/article.css" />
</head><body>
<a class="skip-link" href="#main">Skip to article</a>
<header class="guide-header"><nav class="guide-topbar" aria-label="Main navigation"><a class="guide-brand" href="/"><img src="/assets/brand/lesters-arcade-logo-horizontal.png" alt="Lester’s Arcade home" width="600" height="223" /></a><a href="/blog">Arcade journal</a><a href="/games">Play the games</a><a href="/how-ranked-works">How Ranked works</a></nav>
${preview?'<p class="blog-preview">Editorial preview · Not published</p>':''}
<p class="guide-kicker">Arcade journal / ${category}</p><h1>${escape(checked.title)}</h1><p class="guide-lead">${escape(checked.summary)}</p>
<p class="blog-byline">${escape(checked.author)} <span aria-hidden="true">·</span> <time datetime="${checked.date}">${checked.date}</time></p>${toc}</header>
<main id="main" tabindex="-1"><img class="blog-hero" src="${art.src}" alt="${escape(art.alt)}" decoding="async" /><article class="blog-prose" aria-label="${escape(checked.title)}">${rendered.html}</article>
${related.length?'<aside class="blog-related" aria-label="Related reading"><h2>Keep reading</h2><ul>'+related.map(item=>`<li><a href="/blog/${item.slug}">${escape(item.title)}</a><p>${escape(item.summary)}</p></li>`).join('')+'</ul></aside>':''}</main>
<footer class="guide-footer"><p>One more run?</p><nav aria-label="Footer"><a href="/games">Choose a cabinet</a><a href="/trust.html">Support and policies</a></nav></footer>
</body></html>\n`;
}
