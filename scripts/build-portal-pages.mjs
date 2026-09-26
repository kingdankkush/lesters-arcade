import { readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { join,resolve } from 'node:path';
import { JACKPOT_RULES_SECTIONS, PORTAL_GAMES, PORTAL_FLAGS, escapeHtml, jackpotRulesCopy, portalCopyFor, portalPageMeta, portalSchema, renderCatalog, renderGameDetails } from '../apps/portal/src/portal-content.mjs';
import { JACKPOT_RULES_PATH } from '../apps/portal/src/jackpot-config.mjs';
import { RANKED_FACTS } from '../apps/portal/src/ranked-facts.mjs';
import { RANKED_GUIDE_FILE, RANKED_GUIDE_PATH, rankedGuideCopy, rankedGuideSchema, rankedSurfaceCopy, renderGuideHeader, renderGuideInline, renderGuideMain, renderHomeRanked } from '../apps/portal/src/ranked-guide-content.mjs';

const portal=fileURLToPath(new URL('../apps/portal/',import.meta.url));

// Contract A33: the public copy follows SETTLEMENT_LIVE and HOSTED_PROFILE_SYNC in
// apps/portal/src/settlement.mjs. The override exists only for tests and the
// rehearsal's step-7 dry run; committed pages are always built from the real flags. `jackpot` is the
// Weekly Jackpot flip dry run (design §E E10): live settlement plus JACKPOT_LIVE (chikunJackpotLive).
export const PORTAL_FLAG_OVERRIDES=Object.freeze({
  live:Object.freeze({settlementLive:true,hostedProfileSync:true}),
  preview:Object.freeze({settlementLive:false,hostedProfileSync:false}),
  jackpot:Object.freeze({settlementLive:true,hostedProfileSync:true,chikunJackpotLive:true}),
});
export function resolvePortalFlags(flags){
  if(flags===undefined||flags===null)return PORTAL_FLAGS;
  if(typeof flags==='string'){
    if(!Object.hasOwn(PORTAL_FLAG_OVERRIDES,flags))throw new RangeError('--flags must be live or preview, got '+JSON.stringify(flags));
    return PORTAL_FLAG_OVERRIDES[flags];
  }
  // chikunJackpotLive is an optional third boolean (default false).
  if(typeof flags==='object'&&typeof flags.settlementLive==='boolean'&&typeof flags.hostedProfileSync==='boolean'&&(flags.chikunJackpotLive===undefined||typeof flags.chikunJackpotLive==='boolean')){
    return Object.freeze({settlementLive:flags.settlementLive,hostedProfileSync:flags.hostedProfileSync,...(flags.chikunJackpotLive===undefined?{}:{chikunJackpotLive:flags.chikunJackpotLive})});
  }
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
// The Ranked entry modal's split row and "What happens next" (index.html). The Entry, Publishing and
// Total rows are plain static fallbacks that main.js replaces with the entry contract's quote;
// tests/ranked-fee-source-of-truth.test.mjs ties them to the arcade-core.mjs fee constants.
function renderEntryModal(html,surface){
  html=renderCopyBlock(html,'entry-split',escapeHtml(RANKED_FACTS.developerPercent+"% to the game's developer · "+RANKED_FACTS.arcadePercent+'% to the arcade'),'index.html');
  return renderCopyBlock(html,'entry-next','<ol class="ranked-entry-next-list">'+surface.entryNext.map(text=>'<li>'+escapeHtml(text)+'</li>').join('')+'</ol>','index.html');
}
function renderHome(html,copy,surface){
  const faq=copy.faq.map(([question,answer])=>'<details><summary>'+escapeHtml(question)+'</summary><p>'+escapeHtml(answer)+'</p></details>').join('\n');
  html=html.replace(/<div id="portalFaqList">[\s\S]*?<\/div>/,'<div id="portalFaqList">'+faq+'</div>');
  for(const [key,text] of [
    ['how-intro',copy.howIntro],['how-connect-title',copy.howConnectTitle],['how-connect',copy.howConnect],['how-connect-action',copy.howConnectAction],['how-profile',copy.howProfile],
    ['scores-lead',copy.scoresLead],['scores-note',copy.scoresNote],['scores-wallet',copy.scoresWallet],
    // The landing page's static mode-select view is the Hard Money Heroes one.
    ['mode-copy',copy.modeSelect['lester-blaster'].copy],['mode-ranked',copy.modeSelect['lester-blaster'].ranked],
    // The Ranked entry modal (hidden until opened; main.js sets the same live text at runtime).
    ['entry-copy',copy.rankedEntryCopy],['entry-footnote',copy.rankedEntryFootnote],
    ['mode-free',copy.modeSelect['lester-blaster'].free],
  ]) html=renderCopyBlock(html,key,escapeHtml(text),'index.html');
  html=renderCopyBlock(html,'home-ranked',renderHomeRanked(surface),'index.html');
  return withMeta(renderEntryModal(html,surface),'/',copy);
}
function renderTrust(html,copy,surface){
  html=renderCopyBlock(html,'ranked-howto','\n      '+surface.trustHowTo.map(text=>'<p>'+renderGuideInline(text)+'</p>').join('\n      ')+'\n      ','trust.html');
  html=renderCopyBlock(html,'ranked-storage','\n      '+paragraphs(copy.trustStorage)+'\n      ','trust.html');
  return renderCopyBlock(html,'ranked-status','\n      '+paragraphs(copy.trustStatus)+'\n      ','trust.html');
}
// The Weekly Jackpot rules page (design §D.4): the 16 marked sections, the §F.1 legal block, and noindex
// with the soft-launch banner until the jackpot is live. A live build refuses a page that still carries
// the LEGAL-REVIEW-PENDING comment beside the legal block or lacks a section marker.
export const JACKPOT_RULES_FILE='jackpot/chikun.html';
export const JACKPOT_LEGAL_PENDING='LEGAL-REVIEW-PENDING';
const rulesBlocks=blocks=>blocks.map(block=>typeof block==='string'?'<p>'+escapeHtml(block)+'</p>'
  :block.lead?'<p><strong>'+escapeHtml(block.lead)+'</strong></p>'
  :'<ul>'+block.list.map(item=>'<li>'+(Array.isArray(item)?'<strong>'+escapeHtml(item[0])+'</strong> '+escapeHtml(item[1]):escapeHtml(item))+'</li>').join('')+'</ul>').join('\n      ');
export function renderJackpotRules(html,rules,file=JACKPOT_RULES_FILE){
  html=html.replace(/<meta name="robots" content="[^"]*" \/>/,'<meta name="robots" content="'+(rules.live?'index, follow':'noindex')+'" />')
    .replace(/<meta name="description" content="[^"]*" \/>/,'<meta name="description" content="'+escapeHtml(rules.description)+'" />')
    .replace(/<title>[\s\S]*?<\/title>/,'<title>'+escapeHtml(rules.title+" | Lester's Arcade")+'</title>');
  html=renderCopyBlock(html,'jackpot-rules-title',escapeHtml(rules.title),file);
  html=renderCopyBlock(html,'jackpot-rules-banner',escapeHtml(rules.banner),file);
  for(const id of JACKPOT_RULES_SECTIONS){
    const section=rules.sections[id];
    html=renderCopyBlock(html,'jackpot-rules-'+id,'\n      <h2 id="rules-'+id+'-title">'+escapeHtml(section.title)+'</h2>'+(section.blocks.length?'\n      '+rulesBlocks(section.blocks):'')+'\n      ',file);
  }
  html=renderCopyBlock(html,'jackpot-legal','\n      '+rulesBlocks(rules.legalBlocks)+'\n      ',file);
  if(rules.live){
    if(html.includes(JACKPOT_LEGAL_PENDING))throw new Error(file+' still carries '+JACKPOT_LEGAL_PENDING+': the owner confirms the legal text (design §E E10) and the flip commit removes the comment before the jackpot goes live');
    const missing=JACKPOT_RULES_SECTIONS.filter(id=>!html.includes('<!-- copy:jackpot-rules-'+id+':start -->'));
    if(missing.length)throw new Error(file+' lacks the rules sections '+missing.join(', ')+' (design §D.4)');
  }
  return html;
}

// The "How Ranked works" guide (apps/portal/how-ranked-works.html, served at /how-ranked-works): head
// metadata, FAQPage and HowTo JSON-LD, and the header and main blocks, all from ranked-guide-content.mjs.
// Indexable in every flag state (the sitemap does not depend on the flags); without live settlement it
// says Ranked is in preview.
export function renderRankedGuide(html,guide,file=RANKED_GUIDE_FILE){
  const title=guide.title+" | Lester's Arcade";
  html=html.replace(/<title>[\s\S]*?<\/title>/,'<title>'+escapeHtml(title)+'</title>');
  for(const [attribute,key,value] of [
    ['name','description',guide.description],['property','og:title',title],['property','og:description',guide.description],
    ['name','twitter:title',title],['name','twitter:description',guide.description],
  ]) {
    const pattern=new RegExp('<meta '+attribute+'="'+key+'" content="[^"]*" />');
    if(!pattern.test(html))throw new Error(file+' needs <meta '+attribute+'="'+key+'" content="…" />');
    html=html.replace(pattern,'<meta '+attribute+'="'+key+'" content="'+escapeHtml(value)+'" />');
  }
  const schema=/(<script id="guideStructuredData" type="application\/ld\+json">)[\s\S]*?(<\/script>)/;
  if(!schema.test(html))throw new Error(file+' needs its guideStructuredData script');
  html=html.replace(schema,(_,open,close)=>open+rankedGuideSchema(guide)+close);
  html=renderCopyBlock(html,'guide-header',renderGuideHeader(guide),file);
  return renderCopyBlock(html,'guide-main',renderGuideMain(guide),file);
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
// rewrite would briefly expose a truncated file to them. `sources` replaces a source file's text by its
// path (tests only: a fixture rules template with reviewed legal text shows the live path).
// Every page renders in memory first and is written only once all of them rendered, so a guard that
// throws (the live rules page's legal and section checks) leaves no page half-flipped.
export function buildPortalPages({flags,outDir=portal,sources={}}={}){
  const resolved=resolvePortalFlags(flags);
  const copy=portalCopyFor(resolved);
  const rules=jackpotRulesCopy(resolved);
  const surface=rankedSurfaceCopy(resolved);
  const pages=new Map();
  const write=(name,text)=>pages.set(name,text);
  const home=renderHome(readFileSync(resolve(portal,'index.html'),'utf8'),copy,surface);
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
    html=renderCopyBlock(html,'mode-ranked',escapeHtml(copy.modeSelect[game.id]?.ranked ?? copy.modeRanked),'discover/'+game.slug+'.html');
    html=renderCopyBlock(html,'mode-free',escapeHtml(copy.modeSelect[game.id]?.free ?? copy.modeSelect['lester-blaster'].free),'discover/'+game.slug+'.html');
    write('discover/'+game.slug+'.html',withMeta(html,'/games/'+game.slug,copy));
  }
  write('trust.html',renderTrust(readFileSync(resolve(portal,'trust.html'),'utf8'),copy,surface));
  write(RANKED_GUIDE_FILE,renderRankedGuide(sources[RANKED_GUIDE_FILE]??readFileSync(resolve(portal,RANKED_GUIDE_FILE),'utf8'),rankedGuideCopy(resolved)));
  write('manifest.webmanifest',renderManifest(readFileSync(resolve(portal,'manifest.webmanifest'),'utf8'),copy));
  write(JACKPOT_RULES_FILE,renderJackpotRules(sources[JACKPOT_RULES_FILE]??readFileSync(resolve(portal,JACKPOT_RULES_FILE),'utf8'),rules));
  // The rules page joins the sitemap and llms.txt only once the jackpot is live (design §D.4).
  // The Ranked guide is listed in every flag state: without live settlement it says Ranked is in preview.
  const urls=['/','/games',...PORTAL_GAMES.map(game=>'/games/'+game.slug),RANKED_GUIDE_PATH,'/trust.html',...(rules.live?[JACKPOT_RULES_PATH]:[])];
  write('sitemap.xml','<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'+urls.map(path=>'<url><loc>https://lestersarcade.io'+path+'</loc></url>').join('\n')+'\n</urlset>\n');
  // The previous site had no robots file. An empty rule set preserves its access
  // policy; this adds only sitemap discovery, no training/search bot directives.
  write('robots.txt','Sitemap: https://lestersarcade.io/sitemap.xml\n');
  write('llms.txt',"# Lester's Arcade\n\n"+copy.description+"\n\n## Games\n"+PORTAL_GAMES.map(game=>'- ['+game.title+'](https://lestersarcade.io/games/'+game.slug+'): '+game.description).join('\n')+"\n\n## Platform\n- [How it works](https://lestersarcade.io/#how-it-works): "+copy.llmsHowItWorks+"\n- [How Ranked works](https://lestersarcade.io"+RANKED_GUIDE_PATH+"): "+surface.llmsGuideLine+"\n- [Browse games](https://lestersarcade.io/games)\n- [Support and policies](https://lestersarcade.io/trust.html)"+(rules.live?"\n- [Weekly Jackpot rules](https://lestersarcade.io"+JACKPOT_RULES_PATH+"): "+rules.description:'')+"\n\n## Current scope\n"+copy.llmsScope+"\n"+(surface.llmsSection?"\n## How Ranked works\n"+surface.llmsSection.join('\n')+"\n":''));
  mkdirSync(resolve(outDir,'discover'),{recursive:true});
  mkdirSync(resolve(outDir,'jackpot'),{recursive:true});
  for(const [name,text] of pages){
    const target=resolve(outDir,name);
    let current=null;
    try{current=readFileSync(target,'utf8');}catch{}
    if(current!==text)writeFileSync(target,text);
  }
  return urls;
}

// Files written by buildPortalPages, relative to its outDir.
export const PORTAL_GENERATED_FILES=Object.freeze(['index.html',...['games',...PORTAL_GAMES.map(game=>game.slug)].map(name=>'discover/'+name+'.html'),'trust.html','manifest.webmanifest','sitemap.xml','robots.txt','llms.txt',JACKPOT_RULES_FILE,RANKED_GUIDE_FILE]);

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
  const overridden=flags.settlementLive!==PORTAL_FLAGS.settlementLive||flags.hostedProfileSync!==PORTAL_FLAGS.hostedProfileSync||Boolean(flags.chikunJackpotLive)!==Boolean(PORTAL_FLAGS.chikunJackpotLive);
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
  output.log('Generated homepage metadata, four discovery pages, trust copy, the Weekly Jackpot rules page, the How Ranked works guide, sitemap, and text reference ('+state+' copy'+(options.outDir?', in '+options.outDir:'')+').');
  return 0;
}

if(process.argv[1] && resolve(process.argv[1])===fileURLToPath(import.meta.url)) process.exitCode=runPortalPagesCli(process.argv.slice(2));
