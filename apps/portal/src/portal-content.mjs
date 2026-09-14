// Public, non-personal discovery facts shared by prerendered HTML and SPA views.
export const PORTAL_ORIGIN = 'https://lestersarcade.io';
export const PORTAL_DESCRIPTION = "Lester's Arcade is a browser arcade inspired by Litecoin culture. Play Hard Money Heroes, Chikun's Escape, and STACKED Free, with optional wallet profiles and device-local Ranked previews.";
export const PORTAL_GAMES = Object.freeze([
  Object.freeze({
    id: 'lester-blaster', slug: 'hard-money-heroes', title: 'Hard Money Heroes', genre: 'Survival shooter',
    tag: 'Build your survivor', status: 'Playable now',
    description: 'Fight through the Crypto Wasteland in a top-down roguelite. Choose a hero, collect weapons, complete field objectives, and hold out against the horde.',
    controls: 'Keyboard and mouse or on-screen touch controls. Move with WASD or arrows; aim with the mouse. On mobile, use MOVE and AIM.',
    goal: 'Survive longer, find stronger weapons, and try a different build on the next run.',
    art: '/assets/generated/hmh-banners/hard-money-heroes-free-mode-banner.jpg',
    cabinet: '/assets/hard-money-heroes/cabinet/rotation/hmh-cabinet-rotation-00-front.png',
    sprite: 'hard-money-heroes-arcade-cabinet-rotation',
  }),
  Object.freeze({
    id: 'chikun', slug: 'chikun', title: "Chikun's Escape", genre: 'Run & fly',
    tag: 'Take the ground. Take the sky.', status: 'Playable now',
    description: 'Run, jump, and fly through the Ground & Sky course. Time your taps, collect coins, and find a way through hazards as the pace picks up.',
    controls: 'Tap, click, or press Space to jump and flap. Release to descend and land; running resumes on the ground.',
    goal: 'Travel farther, collect coins, and compare your daily best on this device.',
    art: '/assets/generated/chikun-mode-select/chikuns-escape-free-mode.webp',
    cabinet: '/assets/generated/chikun-cabinet/chikun-cabinet-front.png?v=transparent-v2',
    sprite: 'chikun-cabinet',
  }),
  Object.freeze({
    id: 'stacked', slug: 'stacked', title: 'STACKED', genre: 'Falling-block puzzle',
    tag: 'Find your rhythm', status: 'Public beta',
    description: 'Stack, spin, and seal falling ledger blocks to the arcade soundtrack. Chase cleaner clears while music-driven worlds react around the board.',
    controls: 'Use keyboard or touch controls to move, rotate, hold, and drop blocks. Review the control guide before your first run.',
    goal: 'Build clean rows, keep the board under control, and improve your score.',
    art: '/assets/stacked-mode-select/stacked-free-v1.png',
    cabinet: '/assets/stacked-cabinet/stacked-cabinet-turnaround-v1.png',
    sprite: 'stacked-cabinet',
  }),
]);
export const PORTAL_FAQ = Object.freeze([
  ["Do I need a wallet to play?", "No. Every active game on Lester's Arcade has Free Mode. Browse the cabinets, choose a game, and start playing in your browser."],
  ["What does connecting a wallet do?", "A connected wallet identifies your Lester's Arcade profile and local Ranked preview runs. You can set a display name and avatar and review supported achievements and run history."],
  ["Are profiles and leaderboards online?", "Profiles and Ranked preview results are currently device-local: they stay in this browser. Scoreboards offer time-period views of those records. Cross-device history and verified global leaderboards are not available yet."],
  ["Does Ranked cost money or pay prizes?", "The current Ranked preview requires no entry fee and pays no prizes. No score transaction is sent. Lester's Arcade is developing its wallet features for LitVM LiteForge testnet."],
  ["Can I play on my phone?", "The three active games support on-screen touch controls as well as desktop input. A current browser is required. Performance varies by device; the games include settings for controls, audio, and visual effects."],
]);
export const escapeHtml = value => String(value).replace(/[&<>"']/g, character => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[character]));
export const gameFor = slug => PORTAL_GAMES.find(game => game.slug === slug || game.id === slug);

export function portalPageMeta(path = '/') {
  const clean = path.split(/[?#]/)[0].replace(/\/$/, '') || '/';
  const parts = clean.split('/').filter(Boolean);
  const game = ['games','play'].includes(parts[0]) ? gameFor(parts[1]) : null;
  const privateView = ['profile','settings','scores','leaderboards'].includes(parts[0]) || parts.length > 2;
  const canonicalPath = game ? '/games/'+game.slug : clean === '/play' ? '/games' : clean;
  const title = game ? game.title+" — Play Free | Lester's Arcade" : canonicalPath === '/games' ? "Browse Games — Lester's Arcade" : privateView ? (parts[0][0].toUpperCase()+parts[0].slice(1))+" — Lester's Arcade" : "Lester's Arcade — Free Browser Games";
  return { title, description: game ? game.description+' Play Free in your browser on Lester’s Arcade.' : PORTAL_DESCRIPTION,
    canonical: PORTAL_ORIGIN+canonicalPath, image: PORTAL_ORIGIN+(game?.art ?? '/assets/video/arcade-splash-poster.jpg'),
    robots: privateView ? 'noindex, follow' : 'index, follow' };
}

export function portalSchema(path = '/') {
  const meta = portalPageMeta(path);
  const game = gameFor(path.split('/')[2]);
  const organization = PORTAL_ORIGIN+'/#organization';
  const website = PORTAL_ORIGIN+'/#website';
  const graph = [
    { '@type':'Organization', '@id':organization, name:"Lester's Arcade", url:PORTAL_ORIGIN+'/', logo:PORTAL_ORIGIN+'/assets/brand/lesters-arcade-logo-horizontal.png' },
    { '@type':'WebSite', '@id':website, name:"Lester's Arcade", url:PORTAL_ORIGIN+'/', description:PORTAL_DESCRIPTION, publisher:{'@id':organization}, inLanguage:'en' },
    { '@type':path === '/games' ? 'CollectionPage' : 'WebPage', '@id':meta.canonical+'#webpage', url:meta.canonical, name:meta.title, description:meta.description, isPartOf:{'@id':website}, ...(game ? {about:{'@id':PORTAL_ORIGIN+'/games/'+game.slug+'#game'}} : {}) },
    ...(game ? [game] : PORTAL_GAMES).map(item => ({
      '@type':'VideoGame', '@id':PORTAL_ORIGIN+'/games/'+item.slug+'#game', name:item.title,
      url:PORTAL_ORIGIN+'/games/'+item.slug, description:item.description, genre:item.genre,
      image:PORTAL_ORIGIN+item.art, gamePlatform:'Web browser', applicationCategory:'Game',
      operatingSystem:'Web browser', playMode:'SinglePlayer', isAccessibleForFree:true, publisher:{'@id':organization},
    })),
  ];
  if (path === '/games') graph.push({'@type':'ItemList', itemListElement:PORTAL_GAMES.map((item,index)=>({'@type':'ListItem',position:index+1,url:PORTAL_ORIGIN+'/games/'+item.slug,name:item.title}))});
  if (game) graph.push({'@type':'BreadcrumbList',itemListElement:[["Lester's Arcade",'/'],['Games','/games'],[game.title,'/games/'+game.slug]].map(([name,url],index)=>({'@type':'ListItem',position:index+1,name,item:PORTAL_ORIGIN+url}))});
  return JSON.stringify({'@context':'https://schema.org','@graph':graph}).replace(/</g,'\\u003c');
}

export function renderGameDetails(slug) {
  const game=gameFor(slug);
  if(!game)return '';
  return `<section class="game-detail-story" aria-label="About ${escapeHtml(game.title)}">
    <div><p class="portal-kicker">${escapeHtml(game.genre)}</p><h2>${escapeHtml(game.tag)}</h2><p>${escapeHtml(game.description)}</p></div>
    <dl><div><dt>Your goal</dt><dd>${escapeHtml(game.goal)}</dd></div><div><dt>How to play</dt><dd>${escapeHtml(game.controls)}</dd></div><div><dt>Free or Ranked?</dt><dd>Free Mode is open to guests. Wallet-connected Ranked is a device-local preview with no fees or prizes.</dd></div></dl>
    <a href="/games" class="portal-text-link">Explore all games →</a></section>`;
}

export function renderCatalog() {
  return PORTAL_GAMES.map((game,index)=>`<a class="official-cabinet-card playable featured-cabinet-card" data-game-slug="${game.slug}" href="/play/${game.slug}">
    <div class="cabinet-card-media"><span class="cabinet-number" aria-hidden="true">0${index+1}</span><span class="catalog-static-cabinet ${game.slug}" role="img" aria-label="${escapeHtml(game.title)} arcade cabinet"></span></div>
    <div class="cabinet-card-copy"><span class="cabinet-status-label">${game.status}</span><h2>${escapeHtml(game.title)}</h2><span class="cabinet-genre">${escapeHtml(game.genre)}</span><p>${escapeHtml(game.description)}</p><span class="cabinet-entry">Choose game <span aria-hidden="true">↗</span></span></div></a>`).join('');
}
