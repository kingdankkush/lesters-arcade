import {isBlogPublicationIndex} from './blog-content.mjs';
import {renderBlogArticle} from './blog-render.mjs';

const ORIGIN='https://lestersarcade.io';
const escape=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));
function checked(index){if(!isBlogPublicationIndex(index))throw new TypeError('A genuine publication index is required');return index;}
const route=category=>category===null?'/blog':'/blog/category/'+category;

// All discovery pages are static and use the same explicit publication snapshot.
export function renderBlogListing(index,{category=null}={}){
 checked(index);
 const selected=category===null?null:index.categories.find(item=>item.id===category);
 if(category!==null&&!selected)throw new TypeError('Unknown blog category');
 const title=selected?selected.label:'Arcade journal',url=ORIGIN+route(category);
 const summary=selected?{news:'The latest from Lester’s Arcade.',guides:'Find your next cabinet. Make your next run count.','dev-notes':'Art, design and the work behind the games.'}[category]:'Guides, updates and stories from the arcade.';
 const posts=selected?index.posts.filter(post=>post.category===category):index.posts;
 const tabs=[{id:null,label:'All articles',count:index.posts.length},...index.categories].map(item=>`<a href="${route(item.id)}"${item.id===category?' aria-current="page"':''}>${escape(item.label)} <span class="blog-count">${item.count}</span></a>`).join('');
 const cards=posts.map(post=>`<li><article><p class="blog-card-meta">${escape(index.categories.find(item=>item.id===post.category).label)} <span aria-hidden="true">·</span> <time datetime="${post.date}">${post.date}</time></p><h2><a href="/blog/${post.slug}">${escape(post.title)}</a></h2><p>${escape(post.summary)}</p><p class="blog-card-author">${escape(post.author)}</p></article></li>`).join('\n');
 return `<!doctype html>
<html lang="en"><head><meta charset="utf-8" /><meta name="viewport" content="width=device-width, initial-scale=1" />
<meta name="theme-color" content="#05070f" /><title>${escape(title)} | Lester’s Arcade</title><meta name="description" content="${escape(summary)}" />
<link rel="canonical" href="${url}" /><meta name="robots" content="index, follow" /><meta property="og:type" content="website" /><meta property="og:url" content="${url}" /><meta property="og:title" content="${escape(title)} | Lester’s Arcade" /><meta property="og:description" content="${escape(summary)}" />
<link rel="alternate" type="application/atom+xml" title="Lester’s Arcade journal" href="/blog/feed.xml" />
<link rel="icon" type="image/svg+xml" href="/assets/favicon.svg" /><link rel="stylesheet" href="/src/design-tokens.css" /><link rel="stylesheet" href="/how-ranked-works.css" /><link rel="stylesheet" href="/blog/article.css" />
</head><body><a class="skip-link" href="#main">Skip to articles</a>
<header class="guide-header"><nav class="guide-topbar" aria-label="Main navigation"><a class="guide-brand" href="/"><img src="/assets/brand/lesters-arcade-logo-horizontal.png" alt="Lester’s Arcade home" width="600" height="223" /></a><a href="/games">Play the games</a><a href="/how-ranked-works">How Ranked works</a></nav>
<p class="guide-kicker">${selected?'Arcade journal':'One more story'}</p><h1>${escape(title)}</h1><p class="guide-lead">${escape(summary)}</p>
<nav class="blog-categories" aria-label="Article categories">${tabs}</nav></header>
<main id="main" tabindex="-1">${posts.length?'<ul class="blog-grid">'+cards+'</ul>':'<section class="blog-empty"><h2>No articles here yet</h2><p>There’s more to explore around the arcade.</p><a href="/blog">Browse all articles</a></section>'}</main>
<footer class="guide-footer"><p>One more run?</p><nav aria-label="Footer"><a href="/games">Choose a cabinet</a><a href="/blog/feed.xml">Subscribe via Atom</a><a href="/trust.html">Support and policies</a></nav></footer>
</body></html>\n`;
}

// Summaries are Atom text, never HTML or raw article Markdown. The explicit
// cutoff is a stable feed revision; no build timestamp or host timezone leaks in.
function xmlText(value){
 // XML 1.0 Char production excludes unpaired surrogates and U+FFFE/U+FFFF.
 if(/[^\u0009\u000A\u000D\u0020-\uD7FF\uE000-\uFFFD\u{10000}-\u{10FFFF}]/u.test(value))throw new TypeError('Invalid XML text in blog metadata');
 return escape(value);
}
export function renderBlogFeed(index){
 checked(index);
 return '<?xml version="1.0" encoding="utf-8"?>\n<feed xmlns="http://www.w3.org/2005/Atom">\n'
 +'<id>'+ORIGIN+'/blog</id><title>Lester’s Arcade journal</title><subtitle>Guides, updates and stories from the arcade.</subtitle>\n'
 +'<link rel="self" type="application/atom+xml" href="'+ORIGIN+'/blog/feed.xml" /><link rel="alternate" href="'+ORIGIN+'/blog" />\n'
 +'<updated>'+index.asOf+'T00:00:00Z</updated><author><name>Lester’s Arcade</name></author>\n'
 +index.posts.map(post=>'<entry><id>'+ORIGIN+'/blog/'+post.slug+'</id><title>'+xmlText(post.title)+'</title><link rel="alternate" href="'+ORIGIN+'/blog/'+post.slug+'" /><published>'+post.date+'T00:00:00Z</published><updated>'+post.date+'T00:00:00Z</updated><author><name>'+xmlText(post.author)+'</name></author><category term="'+post.category+'" /><summary type="text">'+xmlText(post.summary)+'</summary></entry>').join('\n')+'\n</feed>\n';
}

// Pure output manifest. Filesystem/routing activation belongs to the next slice;
// callers cannot provide arbitrary paths or bypass the publication boundary.
export function buildBlogPages(index){
 checked(index);
 const page=(path,content,mediaType='text/html; charset=utf-8')=>Object.freeze({path,content,mediaType});
 return Object.freeze([
  page('blog/index.html',renderBlogListing(index)),
  ...index.categories.map(category=>page('blog/category/'+category.id+'/index.html',renderBlogListing(index,{category:category.id}))),
  page('blog/feed.xml',renderBlogFeed(index),'application/atom+xml; charset=utf-8'),
  ...index.posts.map(post=>page('blog/'+post.slug+'/index.html',renderBlogArticle(post,{index}))),
 ]);
}
