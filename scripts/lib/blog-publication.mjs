import {readdirSync,readFileSync} from 'node:fs';
import {buildBlogIndex} from './blog-content.mjs';

// Deliberate publication cutoff, changed with reviewed content; never host time.
export const BLOG_PUBLICATION_DATE='2026-09-30';
const directory=new URL('../../content/blog/',import.meta.url);
export function loadBlogPublication(){
  const sources=readdirSync(directory).filter(name=>name.endsWith('.md')).sort()
    .map(name=>readFileSync(new URL(name,directory),'utf8'));
  return buildBlogIndex(sources,{asOf:BLOG_PUBLICATION_DATE});
}
