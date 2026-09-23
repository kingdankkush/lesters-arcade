import { readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join,resolve } from 'node:path';
import { PORTAL_GAMES, PORTAL_FLAGS, escapeHtml, portalCopyFor, portalPageMeta, portalSchema, renderCatalog, renderGameDetails } from '../apps/portal/src/portal-content.mjs';

const portal=fileURLToPath(new URL('../apps/portal/',import.meta.url));

// Contract A33: the public copy follows SETTLEMENT_LIVE and HOSTED_PROFILE_SYNC in
// apps/portal/src/settlement.mjs. The override exists only for tests and the
// rehearsal's step-7 dry run; committed pages are always built from the real flags.
export const PORTAL_FLAG_OVERRIDES=Object.freeze({
  live:Object.freeze({settlementLive:true,hostedProfileSync:true}),
  preview:Object.freeze({settlementLive:false,hostedProfileSync:false}),
});
export function resolvePortalFlags(flags){
  if(flags===undefined||flags===null)return PORTAL_FLAGS;
  if(typeof flags==='string'){
    if(!Object.hasOwn(PORTAL_FLAG_OVERRIDES,flags))throw new RangeError('--flags must be live or preview, got '+JSON.stringify(flags));
    return PORTAL_FLAG_OVERRIDES[flags];
  }
  if(typeof flags==='object'&&typeof flags.settlementLive==='boolean'&&typeof flags.hostedProfileSync==='boolean')return Object.freeze({settlementLive:flags.settlementLive,hostedProfileSync:flags.hostedProfileSync});
  throw new TypeError('flags must be live, preview or {settlementLive, hostedProfileSync} booleans');
}

// Fills the text between <!-- copy:<key>:start --> and <!-- copy:<key>:end -->.
// Every block must exist exactly once, so a moved or deleted marker fails the build
// instead of silently leaving stale copy behind.
export function renderCopyBlock(html,key,content,file='page'){
  const start='<!-- copy:'+key+':start -->',end='<!-- copy:'+key+':end -->';
  const from=html.indexOf(start),to=html.indexOf(end);
  if(from<0||to<from||html.indexOf(start,from+1)>=0||html.indexOf(end,to+1)>=0)throw new Error(file+' needs exactly one '+start+' … '+end+' block');
  return html.slice(0,from+start.length)+content+html.slice(to);
}
// Trust-page paragraphs are plain text; `backticked` spans become <code>.
const paragraphs=list=>list.map(text=>'<p>'+escapeHtml(text).replace(/`([^`]+)`/g,'<code>$1</code>')+'</p>').join('\n      ');

function withMeta(html,path,copy){
  const meta=portalPageMeta(path,copy);
  html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>'+escapeHtml(meta.title)+'</title>');
  for(const [attribute,key,value] of [
    ['name','description',meta.description],['name','robots',meta.robots],
    ['property','og:title',meta.title],['property','og:description',meta.description],['property','og:url',meta.canonical],['property','og:image',meta.image],
    ['name','twitter:title',meta.title],['name','twitter:description',meta.description],['name','twitter:url',meta.canonical],['name','twitter:image',meta.image],
  ]) html=html.replace(new RegExp('<meta '+attribute+'="'+key+'"[^>]*>'),'<meta '+attribute+'="'+key+'" content="'+escapeHtml(value)+'" />');
  html=html.replace(/<link rel="canonical"[^>]*>/,'<link rel="canonical" href="'+meta.canonical+'" />');
  html=html.replace(/\s*<script id="portalStructuredData"[\s\S]*?<\/script>/,'');
  return html.replace('  </head>','    <script id="portalStructuredData" type="application/ld+json">'+portalSchema(path,copy)+'</script>\n  </head>');
}
function renderHome(html,copy){
  const faq=copy.faq.map(([question,answer])=>'<details><summary>'+escapeHtml(question)+'</summary><p>'+escapeHtml(answer)+'</p></details>').join('\n');
  html=html.replace(/<div id="portalFaqList">[\s\S]*?<\/div>/,'<div id="portalFaqList">'+faq+'</div>');
  for(const [key,text] of [
    ['how-intro',copy.howIntro],['how-connect-title',copy.howConnectTitle],['how-connect',copy.howConnect],['how-connect-action',copy.howConnectAction],['how-profile',copy.howProfile],
    ['scores-lead',copy.scoresLead],['scores-note',copy.scoresNote],['scores-wallet',copy.scoresWallet],
    ['mode-copy',copy.modeCopy],['mode-ranked',copy.modeRanked],
  ]) html=renderCopyBlock(html,key,escapeHtml(text),'index.html');
  return withMeta(html,'/',copy);
}
function renderTrust(html,copy){
  html=renderCopyBlock(html,'ranked-storage','\n      '+paragraphs(copy.trustStorage)+'\n      ','trust.html');
  return renderCopyBlock(html,'ranked-status','\n      '+paragraphs(copy.trustStatus)+'\n      ','trust.html');
}
function renderManifest(text,copy){
  const next=text.replace(/("description":\s*)"(?:[^"\\]|\\.)*"/,(_,prefix)=>prefix+JSON.stringify(copy.manifestDescription));
  if(JSON.parse(next).description!==copy.manifestDescription)throw new Error('manifest.webmanifest needs a "description" field');
  return next;
}

// Renders every generated public page. Sources are read from apps/portal; outputs
// go to outDir (apps/portal by default, so the committed pages are rewritten in place).
// A file whose content is already current is not rewritten: build.mjs runs this
// during npm test while other test files read the same pages, and an in-place
// rewrite would briefly expose a truncated file to them.
export function buildPortalPages({flags,outDir=portal}={}){
  const copy=portalCopyFor(resolvePortalFlags(flags));
  const write=(name,text)=>{
    const target=resolve(outDir,name);
    let current=null;
    try{current=readFileSync(target,'utf8');}catch{}
    if(current!==text)writeFileSync(target,text);
  };
  mkdirSync(resolve(outDir,'discover'),{recursive:true});
  const home=renderHome(readFileSync(resolve(portal,'index.html'),'utf8'),copy);
  write('index.html',home);
  let catalog=home.replace('data-step="wallet-splash"','data-step="cabinet-select"')
    .replace('class="official-view wallet-splash-view portal-home"','class="official-view wallet-splash-view portal-home" hidden')
    .replace('class="official-view arcade-floor-view" hidden','class="official-view arcade-floor-view"')
    .replace('Loading cabinet access, local practice history, and testnet mode options.','A survival shooter, a run through Ground &amp; Sky, and a puzzle with its own rhythm. Choose a game and play Free.')
    .replace('aria-label="Arcade cabinet selection"></div>','aria-label="Arcade cabinet selection">'+renderCatalog()+'</div>');
  write('discover/games.html',withMeta(catalog,'/games',copy));
  for(const game of PORTAL_GAMES){
    let html=home.replace('data-step="wallet-splash"','data-step="mode-select"')
      .replace('class="official-view wallet-splash-view portal-home"','class="official-view wallet-splash-view portal-home" hidden')
      .replace('class="official-view mode-select-view" hidden','class="official-view mode-select-view"')
      .replace(/(<h1 id="officialModeTitle">)[\s\S]*?(<\/h1>)/,'$1'+escapeHtml(game.title)+'$2')
      .replace(/(<p id="officialModeCopy"[^>]*>)[\s\S]*?(<\/p>)/,'$1'+escapeHtml(game.description)+'$2')
      .replace(/(<img id="officialFreeModeBanner"[^>]*src=")[^"]*/,'$1'+game.art)
      .replace(/(<img id="officialRankedModeBanner"[^>]*src=")[^"]*/,'$1'+game.art)
      .replace(/alt="Hard Money Heroes (Free Mode|Ranked) key art"/g,'alt="'+escapeHtml(game.title)+' key art"')
      .replace('<div id="portalGameDetails"></div>','<div id="portalGameDetails">'+renderGameDetails(game.slug,copy)+'</div>');
    write('discover/'+game.slug+'.html',withMeta(html,'/games/'+game.slug,copy));
  }
  write('trust.html',renderTrust(readFileSync(resolve(portal,'trust.html'),'utf8'),copy));
  write('manifest.webmanifest',renderManifest(readFileSync(resolve(portal,'manifest.webmanifest'),'utf8'),copy));
  const urls=['/','/games',...PORTAL_GAMES.map(game=>'/games/'+game.slug),'/trust.html'];
  write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(path=>'<url><loc>https://lestersarcade.io'+path+'</loc></url>').join('\n')+'\n</urlset>\n');
  // The previous site had no robots file. An empty rule set preserves its access
  // policy; this adds only sitemap discovery, no training/search bot directives.
  write('robots.txt','Sitemap: https://lestersarcade.io/sitemap.xml\n');
  write('llms.txt',"# Lester's Arcade\n\n"+copy.description+"\n\n## Games\n"+PORTAL_GAMES.map(game=>'- ['+game.title+'](https://lestersarcade.io/games/'+game.slug+'): '+game.description).join('\n')+"\n\n## Platform\n- [How it works](https://lestersarcade.io/#how-it-works): "+copy.llmsHowItWorks+"\n- [Browse games](https://lestersarcade.io/games)\n- [Support and policies](https://lestersarcade.io/trust.html)\n\n## Current scope\n"+copy.llmsScope+"\n");
  return urls;
}

// Files written by buildPortalPages, relative to its outDir.
export const PORTAL_GENERATED_FILES=Object.freeze(['index.html',...['games',...PORTAL_GAMES.map(game=>game.slug)].map(name=>'discover/'+name+'.html'),'trust.html','manifest.webmanifest','sitemap.xml','robots.txt','llms.txt']);

// Renders into a scratch directory and returns the generated files under outDir
// that differ from that render. Nothing under outDir is written.
export function stalePortalPages({flags,outDir=portal}={}){
  const scratch=mkdtempSync(join(tmpdir(),'portal-pages-check-'));
  try{
    buildPortalPages({flags,outDir:scratch});
    return PORTAL_GENERATED_FILES.filter(name=>{
      let current=null;
      try{current=readFileSync(resolve(outDir,name),'utf8');}catch{}
      return current!==readFileSync(resolve(scratch,name),'utf8');
    });
  }finally{rmSync(scratch,{recursive:true,force:true});}
}

// CLI: node scripts/build-portal-pages.mjs [--flags live|preview] [--out <dir>] [--check]
export function parsePortalPagesArgs(argv){
  const options={};
  for(let index=0;index<argv.length;index++){
    if(argv[index]==='--check'){options.check=true;continue;}
    const [name,inline]=argv[index].split(/=(.*)/s);
    if(name!=='--flags'&&name!=='--out')throw new RangeError('unknown argument '+argv[index]+' (use --flags live|preview, --out <dir> and --check)');
    const value=inline ?? argv[++index];
    if(!value)throw new RangeError(name+' needs a value');
    if(name==='--flags'){resolvePortalFlags(value);options.flags=value;}
    else options.outDir=resolve(value);
  }
  return options;
}

// Runs the CLI and returns its exit code; messages go to the given console.
export function runPortalPagesCli(argv,output=console){
  const options=parsePortalPagesArgs(argv);
  const flags=resolvePortalFlags(options.flags);
  const state=portalCopyFor(flags).state;
  const overridden=flags.settlementLive!==PORTAL_FLAGS.settlementLive||flags.hostedProfileSync!==PORTAL_FLAGS.hostedProfileSync;
  const render=state+' copy'+(options.flags?' from --flags '+options.flags:' from settlement.mjs');
  if(options.check){
    const stale=stalePortalPages(options);
    if(!stale.length){output.log('Generated pages match the '+render+'.');return 0;}
    output.error('Generated pages differ from the '+render+': '+stale.join(', ')+'. '+(overridden
      ? 'That is expected until settlement.mjs carries these flags; step 7 flips them and then runs node scripts/build-portal-pages.mjs.'
      : 'Run node scripts/build-portal-pages.mjs and commit the output.'));
    return 1;
  }
  // Contract §11 rule 9: flipped pages are never written over the committed tree.
  if(overridden&&!options.outDir){
    output.error('--flags '+options.flags+' differs from settlement.mjs, so it needs --out <dir>; the committed apps/portal pages always follow settlement.mjs.');
    return 1;
  }
  buildPortalPages(options);
  output.log('Generated homepage metadata, four discovery pages, trust copy, sitemap, and text reference ('+state+' copy'+(options.outDir?', in '+options.outDir:'')+').');
  return 0;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) process.exitCode=runPortalPagesCli(process.argv.slice(2));
