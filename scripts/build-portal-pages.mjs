import { readFileSync,writeFileSync,mkdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';
import { PORTAL_GAMES, PORTAL_FAQ, PORTAL_DESCRIPTION, escapeHtml, portalPageMeta, portalSchema, renderCatalog, renderGameDetails } from '../apps/portal/src/portal-content.mjs';

const portal=fileURLToPath(new URL('../apps/portal/',import.meta.url));
function withMeta(html,path){
  const meta=portalPageMeta(path);
  html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>'+escapeHtml(meta.title)+'</title>');
  for(const [attribute,key,value] of [
    ['name','description',meta.description],['name','robots',meta.robots],
    ['property','og:title',meta.title],['property','og:description',meta.description],['property','og:url',meta.canonical],['property','og:image',meta.image],
    ['name','twitter:title',meta.title],['name','twitter:description',meta.description],['name','twitter:url',meta.canonical],['name','twitter:image',meta.image],
  ]) html=html.replace(new RegExp('<meta '+attribute+'="'+key+'"[^>]*>'),'<meta '+attribute+'="'+key+'" content="'+escapeHtml(value)+'" />');
  html=html.replace(/<link rel="canonical"[^>]*>/,'<link rel="canonical" href="'+meta.canonical+'" />');
  html=html.replace(/\s*<script id="portalStructuredData"[\s\S]*?<\/script>/,'');
  return html.replace('  </head>','    <script id="portalStructuredData" type="application/ld+json">'+portalSchema(path)+'</script>\n  </head>');
}
export function buildPortalPages(){
  let home=readFileSync(resolve(portal,'index.html'),'utf8');
  const faq=PORTAL_FAQ.map(([question,answer])=>'<details><summary>'+escapeHtml(question)+'</summary><p>'+escapeHtml(answer)+'</p></details>').join('\n');
  home=home.replace(/<div id="portalFaqList">[\s\S]*?<\/div>/,'<div id="portalFaqList">'+faq+'</div>');
  home=withMeta(home,'/');
  writeFileSync(resolve(portal,'index.html'),home);
  mkdirSync(resolve(portal,'discover'),{recursive:true});
  let catalog=home.replace('data-step="wallet-splash"','data-step="cabinet-select"')
    .replace('class="official-view wallet-splash-view portal-home"','class="official-view wallet-splash-view portal-home" hidden')
    .replace('class="official-view arcade-floor-view" hidden','class="official-view arcade-floor-view"')
    .replace('Loading cabinet access, local practice history, and testnet mode options.','A survival shooter, a run through Ground &amp; Sky, and a puzzle with its own rhythm. Choose a game and play Free.')
    .replace('aria-label="Arcade cabinet selection"></div>','aria-label="Arcade cabinet selection">'+renderCatalog()+'</div>');
  writeFileSync(resolve(portal,'discover/games.html'),withMeta(catalog,'/games'));
  for(const game of PORTAL_GAMES){
    let html=home.replace('data-step="wallet-splash"','data-step="mode-select"')
      .replace('class="official-view wallet-splash-view portal-home"','class="official-view wallet-splash-view portal-home" hidden')
      .replace('class="official-view mode-select-view" hidden','class="official-view mode-select-view"')
      .replace(/(<h1 id="officialModeTitle">)[\s\S]*?(<\/h1>)/,'$1'+escapeHtml(game.title)+'$2')
      .replace(/(<p id="officialModeCopy"[^>]*>)[\s\S]*?(<\/p>)/,'$1'+escapeHtml(game.description)+'$2')
      .replace(/(<img id="officialFreeModeBanner"[^>]*src=")[^"]*/,'$1'+game.art)
      .replace(/(<img id="officialRankedModeBanner"[^>]*src=")[^"]*/,'$1'+game.art)
      .replace(/alt="Hard Money Heroes (Free Mode|Ranked) key art"/g,'alt="'+escapeHtml(game.title)+' key art"')
      .replace('<div id="portalGameDetails"></div>','<div id="portalGameDetails">'+renderGameDetails(game.slug)+'</div>');
    writeFileSync(resolve(portal,'discover/'+game.slug+'.html'),withMeta(html,'/games/'+game.slug));
  }
  const urls=['/','/games',...PORTAL_GAMES.map(game=>'/games/'+game.slug),'/trust.html'];
  writeFileSync(resolve(portal,'sitemap.xml'),'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(path=>'<url><loc>https://lestersarcade.io'+path+'</loc></url>').join('\n')+'\n</urlset>\n');
  // The previous site had no robots file. An empty rule set preserves its access
  // policy; this adds only sitemap discovery, no training/search bot directives.
  writeFileSync(resolve(portal,'robots.txt'),'Sitemap: https://lestersarcade.io/sitemap.xml\n');
  writeFileSync(resolve(portal,'llms.txt'),"# Lester's Arcade\n\n"+PORTAL_DESCRIPTION+"\n\n## Games\n"+PORTAL_GAMES.map(game=>'- ['+game.title+'](https://lestersarcade.io/games/'+game.slug+'): '+game.description).join('\n')+"\n\n## Platform\n- [How it works](https://lestersarcade.io/#how-it-works): Free play, wallet profiles, and local Ranked previews.\n- [Browse games](https://lestersarcade.io/games)\n- [Support and policies](https://lestersarcade.io/trust.html)\n\n## Current scope\nProfiles and Ranked preview results stay in this browser. No entry fees, prizes, global rankings, cross-device history, or on-chain score publishing are available. LitVM LiteForge is a testnet.\n");
  return urls;
}
if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) {buildPortalPages();console.log('Generated homepage metadata, four discovery pages, sitemap, and text reference.');}
