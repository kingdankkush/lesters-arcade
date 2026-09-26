// The "How Ranked works" player guide (apps/portal/how-ranked-works.html, served
// at /how-ranked-works). Owner request 2026-09-26: convert visitors into players
// and give them every piece of help they need, in plain words.
//
// Builder-only: scripts/build-portal-pages.mjs renders these sections into the
// page's copy blocks and its FAQPage and HowTo structured data, and the tests
// read them. The SPA never imports this module, so none of it reaches dist/main.js.
// Every number comes from RANKED_FACTS (ranked-facts.mjs).
//
// Contract A33: public Ranked statements follow the flags. With live settlement
// the guide explains the whole path; without it (a rollback), it says Ranked is
// in preview (nothing charged or published) and points to Free play.
//
// A text is plain; the renderer escapes it. `[label](href)` inside a text
// becomes a link (an http link opens in a new tab); nothing else is markup.
import { RANKED_FACTS as F, RANKED_WORDING as W } from './ranked-facts.mjs';

export const RANKED_GUIDE_FILE = 'how-ranked-works.html';
export const RANKED_GUIDE_PATH = F.guidePath;

const GAMES = Object.freeze({ hmh: 'Hard Money Heroes', chikun: "Chikun's Escape", stacked: 'STACKED' });
// The canonical faucet sentence with the faucet's name as its link.
const faucetSentence = W.faucet.replace(F.faucetName, `[${F.faucetName}](${F.faucetUrl})`);
const boardsLine = `${F.boards.slice(0, -1).join(', ')} and ${F.boards[F.boards.length - 1]}`;

export function rankedGuideCopy({ settlementLive = false } = {}) {
  const live = settlementLive === true;
  const title = 'How Ranked works';
  const description = live
    ? `How to play Ranked on Lester's Arcade: connect a wallet, get free testnet zkLTC from the faucet, and play for ${F.totalZkLtc} zkLTC per run. Steps, price, checks, boards, FAQ and fixes.`
    : "Ranked on Lester's Arcade is in preview right now: nothing is charged and no run is published on chain. Free play needs no wallet and never touches the chain.";
  if (!live) {
    return Object.freeze({
      live, title, description,
      intro: Object.freeze([
        'Ranked is in preview right now: nothing is charged and no Ranked run is published on LitVM.',
        `${W.free} Every game is open to play Free in your browser.`,
      ]),
      nav: Object.freeze([]),
      sections: Object.freeze([
        Object.freeze({ id: 'play-free', title: 'Play Free now', blocks: Object.freeze([
          'Pick a game and play. No wallet, no sign-up, no download.',
          Object.freeze({ cta: Object.freeze([['Browse games', '/games']]) }),
        ]) }),
      ]),
      steps: Object.freeze([]),
      questions: Object.freeze([]),
    });
  }

  const steps = [
    ['Play Free now', `Pick a game and play right in your browser. ${W.free} It is the best way to learn the controls.`, ['Browse games', '/games']],
    ['Connect a wallet', 'Choose Sign in and pick your wallet: MetaMask, Rabby, OKX Wallet or another browser wallet, or WalletConnect on a phone.', null],
    ['Let the site add LitVM', `Your wallet asks once to add or switch to the ${F.networkName} (chain ${F.chainId}). Approve it. The site fills in the network details for you.`, null],
    ['Get free zkLTC from the faucet', `${W.faucet} Paste the address of the wallet you play with.`, [`Open the ${F.faucetName}`, F.faucetUrl]],
    ['Sign in with a free signature', 'Your wallet shows a message to sign. Signing in costs nothing and sends no transaction. You stay signed in for 24 hours.', null],
    [`Choose Ranked and pay ${F.totalZkLtc}`, `Open a game, choose Play Ranked, and confirm ${F.totalZkLtc} testnet zkLTC in your wallet: ${F.entryZkLtc} entry + ${F.publishZkLtc} to publish your score. One confirmation per run.`, null],
    ['Play. Your run is checked', "Your run starts as soon as the payment is sent. When it ends, the arcade's server checks it.", null],
    ['It is published', `The arcade's relayer publishes your verified score on LitVM, usually within about a minute. It then shows on the leaderboards, your profile and your achievements, with a share card for your run.`, null],
  ].map(([name, text, action], index) => Object.freeze({ id: `step-${index + 1}`, name, text, action: action ? Object.freeze(action) : null }));

  const questions = [
    ['Is it real money?', `No. Ranked runs on the ${F.networkName}, and you pay in testnet zkLTC that you get free from the ${F.faucetName}. ${W.value}`],
    ['Why do I need a wallet?', 'Your wallet is your player identity. It pays the Ranked entry and signs you in, so your scores, profile and achievements belong to your address on any device. Free play needs no wallet.'],
    ['Why are there two numbers in the price?', `The ${F.entryZkLtc} entry is the game's price. The ${F.publishZkLtc} pays the arcade's relayer to publish your score on LitVM. Your wallet confirms the total, ${F.totalZkLtc} zkLTC, once.`],
    ['How long does publishing take?', `Usually about a minute after your run ends. If publishing fails, it retries automatically every minute, and you can also retry it from your profile.`],
    ['What if a payment or a run fails?', "If the payment does not go through, the arcade tells you, and that run is practice: it is not published or ranked. If a paid run does not pass the server's checks, it is not ranked. A run that is waiting to publish is saved and retried. Testnet entries are not refunded."],
    ['Can I play on a phone?', "Yes. All three games have touch controls. On a phone, sign in with WalletConnect, or open the arcade inside your wallet app's browser, such as MetaMask or Trust Wallet."],
    ['Which wallets work?', `Any wallet that supports EVM networks: browser wallets such as MetaMask, Rabby and OKX Wallet, and phone wallets through WalletConnect. The site adds the ${F.networkName} to your wallet for you.`],
    ['What happens to my fee?', `The ${F.entryZkLtc} entry is split when you pay: ${F.developerPercent}% to the game's developer and ${F.arcadePercent}% to the arcade. The ${F.publishZkLtc} goes to the arcade's relayer, which pays the network fee to publish your score.`],
    ['When do the leaderboards reset?', `Weekly boards reset every ${F.weeklyReset}. Monthly boards reset on ${F.monthlyReset}. All-time boards never reset. Each board ranks the best verified score of each wallet.`],
    ['How do achievements work?', `There are ${F.achievementTotal} achievements: ${F.achievements['lester-blaster']} in ${GAMES.hmh}, ${F.achievements.chikun} in ${GAMES.chikun} and ${F.achievements.stacked} in ${GAMES.stacked}. The arcade's server records them from your verified Ranked runs, and they show on your profile. Free play does not earn them.`],
    ['What is the game version next to a score?', "Each score shows the game version it was played on, such as HMH v0.5 or Chikun v7. Games get updates, and the version tells you which rules a run was played under. The boards do not reset when a game updates."],
  ].map(([question, answer]) => Object.freeze([question, answer]));

  return Object.freeze({
    live, title, description,
    intro: Object.freeze([
      `Every game on Lester's Arcade has two modes. ${W.free} Ranked puts your runs on the leaderboards: each run is checked by the arcade's server and published on the ${F.networkName}.`,
      `${W.price} ${W.value} Here is everything you need, step by step.`,
    ]),
    nav: Object.freeze([['Steps', '#steps'], ['Price', '#price'], ['Free zkLTC', '#faucet'], ['Free vs Ranked', '#free-vs-ranked'], ['Checks', '#checks'], ['Your score', '#where'], ['FAQ', '#faq'], ['Fixes', '#fixes']]),
    steps: Object.freeze(steps),
    questions: Object.freeze(questions),
    sections: Object.freeze([
      Object.freeze({ id: 'steps', title: 'Play Ranked in 8 steps', blocks: Object.freeze([Object.freeze({ steps: true })]) }),
      Object.freeze({ id: 'price', title: 'What a Ranked run costs', blocks: Object.freeze([
        Object.freeze({ price: Object.freeze({
          total: `${F.totalZkLtc} testnet zkLTC per run`,
          rows: Object.freeze([
            Object.freeze(['Entry', `${F.entryZkLtc} zkLTC`, `The game's price, split ${F.developerPercent}% to the game's developer and ${F.arcadePercent}% to the arcade.`]),
            Object.freeze(['Publishing', `${F.publishZkLtc} zkLTC`, "Pays the arcade's relayer to publish your score on LitVM."]),
            Object.freeze(['Total', `${F.totalZkLtc} zkLTC`, 'Confirmed once in your wallet, for each run.']),
          ]),
        }) }),
        `Your wallet also shows a small network fee for sending the payment. ${W.value} Testnet entries are not refunded.`,
        'The Ranked window shows the exact amount from the entry contract before you confirm. Free play stays free.',
      ]) }),
      Object.freeze({ id: 'faucet', title: 'Get free testnet zkLTC', blocks: Object.freeze([
        W.faucet,
        'Open the faucet, paste the address of the wallet you play with, and request zkLTC. It arrives on the LitVM LiteForge testnet, ready for Ranked.',
        Object.freeze({ cta: Object.freeze([[`Open the ${F.faucetName}`, F.faucetUrl], ['Browse games', '/games']]) }),
      ]) }),
      Object.freeze({ id: 'free-vs-ranked', title: 'Free vs Ranked', blocks: Object.freeze([
        Object.freeze({ table: Object.freeze({
          caption: 'What changes between Free play and Ranked',
          head: Object.freeze(['', 'Free', 'Ranked']),
          rows: Object.freeze([
            Object.freeze(['Cost', 'Nothing', `${F.totalZkLtc} testnet zkLTC per run`]),
            Object.freeze(['Wallet', 'Not needed', 'Needed, with one free sign-in signature']),
            Object.freeze(['Chain', 'Never touches the chain', 'Published on LitVM']),
            Object.freeze(['Checks', 'None', "Checked by the arcade's server"]),
            Object.freeze(['Leaderboards', 'Not ranked', `${boardsLine} boards`]),
            Object.freeze(['Achievements', 'Not earned', 'Earned from verified runs']),
            Object.freeze(['Rules', "Practice options, like STACKED's starting level", 'Standard rules, like STACKED from level 1 with no undo']),
          ]),
        }) }),
      ]) }),
      Object.freeze({ id: 'checks', title: 'What the server checks', blocks: Object.freeze([
        "Each Ranked run gets its random seed from the server, so nobody can choose an easy run in advance. When the run ends, your browser sends it to the arcade's server, which checks it before anything is published.",
        Object.freeze({ list: Object.freeze([
          Object.freeze([GAMES.chikun, 'Your recorded inputs are replayed on the server. The replay must reach your score.']),
          Object.freeze([GAMES.stacked, 'Your recorded inputs are replayed on the server. The replay must reach your score.']),
          Object.freeze([GAMES.hmh, "Your run summary is plausibility-checked against the game's limits. It is not replayed, so the check rejects impossible results but cannot prove how a run was played."]),
        ]) }),
        "A replay proves that a run follows the game's rules, not who played it.",
      ]) }),
      Object.freeze({ id: 'where', title: 'Where your score shows up', blocks: Object.freeze([
        Object.freeze({ list: Object.freeze([
          Object.freeze(['Results screen', `Follows your run to Published, with a link to the transaction on the [LiteForge explorer](${F.explorerUrl}).`]),
          Object.freeze(['Leaderboards', `${boardsLine} boards for each game rank the best verified score of each wallet. Weekly boards reset every ${F.weeklyReset} and Monthly boards on ${F.monthlyReset}. Each score shows the game version it was played on. [See the scores](/scores)`]),
          Object.freeze(['Your profile', 'Every wallet has a public profile with its best scores, verified runs and achievements. [Open your profile](/profile)']),
          Object.freeze(['Achievements', `${F.achievementTotal} in all: ${F.achievements['lester-blaster']} in ${GAMES.hmh}, ${F.achievements.chikun} in ${GAMES.chikun} and ${F.achievements.stacked} in ${GAMES.stacked}, recorded from your verified Ranked runs.`]),
          Object.freeze(['Share card', 'Each published run gets a public page with a score card you can post.']),
        ]) }),
      ]) }),
      Object.freeze({ id: 'faq', title: 'Questions', blocks: Object.freeze([Object.freeze({ questions: true })]) }),
      Object.freeze({ id: 'fixes', title: 'If something goes wrong', blocks: Object.freeze([
        Object.freeze({ list: Object.freeze([
          Object.freeze(['Wrong network', `Your wallet is on another network. Choose Switch to LiteForge in the Ranked window, or pick ${F.networkName} (chain ${F.chainId}) in your wallet, then try again.`]),
          Object.freeze(['Not enough zkLTC', `You need ${F.totalZkLtc} zkLTC plus a small network fee. ${faucetSentence} Then choose Re-check in the Ranked window.`]),
          Object.freeze(['The wallet asks for a high fee or refuses', `Do not confirm a fee that looks wrong. Check that the wallet is on the ${F.networkName} (chain ${F.chainId}) and that the amount is ${F.totalZkLtc} zkLTC plus a small network fee. If it still asks too much or refuses to send, cancel, close the Ranked window and try again. Nothing is charged when you cancel.`]),
          Object.freeze(['Payment done, result pending', 'Publishing usually takes about a minute and retries automatically every minute. Keep the results screen open, or check your profile later and retry from there.']),
          Object.freeze(['Run not accepted', "The server could not verify the run, so it is not ranked. This happens when a run breaks the game's rules or its data is incomplete. Testnet entries are not refunded. If you think it is a mistake, [contact support](/trust.html#support) with the time of the run and your wallet address."]),
          Object.freeze(['Browser closed during a run', 'A run that did not finish is not ranked. A finished run that was waiting to publish is saved on your device: open the arcade again in the same browser and publishing picks up where it stopped.']),
        ]) }),
        'Never share your seed phrase or private key. Support will never ask for them.',
      ]) }),
    ]),
  });
}

// Plain text of a guide string: `[label](href)` becomes `label`. Structured data
// carries this form, so it matches the visible text word for word.
export const guidePlainText = text => String(text).replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1');

// --- HTML (builder only) ------------------------------------------------------
const ENTITIES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
const esc = value => String(value).replace(/[&<>"']/g, character => ENTITIES[character]);
const NEW_TAB = '<span class="visually-hidden"> (opens in a new tab)</span>';
const LINK = /\[([^\]]+)\]\(([^)\s]+)\)/g;

// One link. An http(s) link opens in a new tab and says so to screen readers
// (every page that renders one defines .visually-hidden).
export function guideLink(label, href, className = '') {
  const external = /^https?:\/\//.test(href);
  return `<a${className ? ` class="${className}"` : ''} href="${esc(href)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${esc(label)}${external ? NEW_TAB : ''}</a>`;
}

// Escapes a guide string and turns its `[label](href)` parts into links.
export function renderGuideInline(text) {
  const source = String(text);
  let html = '';
  let last = 0;
  for (const match of source.matchAll(LINK)) {
    html += esc(source.slice(last, match.index)) + guideLink(match[1], match[2]);
    last = match.index + match[0].length;
  }
  return html + esc(source.slice(last));
}

const ctaRow = links => '<p class="guide-actions">' + links.map(([label, href], index) => guideLink(label, href, index === 0 ? 'guide-button' : 'guide-button guide-button-outline')).join(' ') + '</p>';

function renderBlock(block, guide) {
  if (typeof block === 'string') return '<p>' + renderGuideInline(block) + '</p>';
  if (block.cta) return ctaRow(block.cta);
  if (block.steps) {
    return '<ol class="guide-steps">' + guide.steps.map((step, index) => `<li id="${step.id}"><span class="guide-step-number" aria-hidden="true">${String(index + 1).padStart(2, '0')}</span><div><h3><span class="visually-hidden">Step ${index + 1}: </span>${esc(step.name)}</h3><p>${renderGuideInline(step.text)}</p>${step.action ? guideLink(step.action[0], step.action[1], 'guide-step-action') : ''}</div></li>`).join('') + '</ol>';
  }
  if (block.price) {
    return `<div class="guide-price"><p class="guide-price-total">${esc(block.price.total)}</p><dl>` + block.price.rows.map(([label, amount, note]) => `<div><dt>${esc(label)}</dt><dd class="guide-price-amount">${esc(amount)}</dd><dd>${renderGuideInline(note)}</dd></div>`).join('') + '</dl></div>';
  }
  if (block.table) {
    const { caption, head, rows } = block.table;
    return `<div class="guide-table-wrap"><table class="guide-table"><caption>${esc(caption)}</caption><thead><tr>` + head.map((cell, index) => index === 0 ? '<td></td>' : `<th scope="col">${esc(cell)}</th>`).join('') + '</tr></thead><tbody>'
      + rows.map(([label, ...cells]) => `<tr><th scope="row">${esc(label)}</th>` + cells.map(cell => `<td>${renderGuideInline(cell)}</td>`).join('') + '</tr>').join('') + '</tbody></table></div>';
  }
  if (block.list) return '<ul class="guide-cards">' + block.list.map(([lead, text]) => `<li><h3>${esc(lead)}</h3><p>${renderGuideInline(text)}</p></li>`).join('') + '</ul>';
  if (block.questions) return '<div class="guide-faq">' + guide.questions.map(([question, answer]) => `<details><summary>${esc(question)}</summary><p>${renderGuideInline(answer)}</p></details>`).join('') + '</div>';
  throw new Error('unknown guide block ' + JSON.stringify(block));
}

// The <header> block: kicker, title, intro and, when live, the calls to action and the section index.
export function renderGuideHeader(guide) {
  const parts = [
    '<p class="guide-kicker">Lester\'s Arcade · Player guide</p>',
    `<h1>${esc(guide.title)}</h1>`,
    ...guide.intro.map(text => `<p class="guide-lead">${renderGuideInline(text)}</p>`),
  ];
  if (guide.live) {
    parts.push(ctaRow([['Play Free now', '/games'], [`Get free zkLTC (${F.faucetZkLtc} per request)`, F.faucetUrl]]));
    parts.push('<nav class="guide-toc" aria-labelledby="guideTocTitle"><h2 id="guideTocTitle">On this page</h2><ul>' + guide.nav.map(([label, href]) => `<li><a href="${href}">${esc(label)}</a></li>`).join('') + '</ul></nav>');
  } else {
    parts.push(ctaRow([['Play Free now', '/games']]));
  }
  return '\n    ' + parts.join('\n    ') + '\n    ';
}

// The <main> block: one <section> per guide section.
export function renderGuideMain(guide) {
  return '\n    ' + guide.sections.map(section => `<section id="${section.id}" class="guide-section${section.id === 'faucet' ? ' guide-faucet' : ''}" aria-labelledby="${section.id}-title">\n      <h2 id="${section.id}-title">${esc(section.title)}</h2>\n      `
    + section.blocks.map(block => renderBlock(block, guide)).join('\n      ') + '\n    </section>').join('\n    ') + '\n    ';
}

// JSON-LD for the page: the WebPage and its breadcrumb and, when live, the
// HowTo (the 8 steps) and the FAQPage. Every text is the visible text.
export function rankedGuideSchema(guide, origin = 'https://lestersarcade.io') {
  const url = origin + RANKED_GUIDE_PATH;
  const graph = [
    { '@type': 'WebPage', '@id': url + '#webpage', url, name: guide.title + " | Lester's Arcade", description: guide.description, isPartOf: { '@id': origin + '/#website' }, inLanguage: 'en',
      breadcrumb: { '@type': 'BreadcrumbList', itemListElement: [["Lester's Arcade", origin + '/'], [guide.title, url]].map(([name, item], index) => ({ '@type': 'ListItem', position: index + 1, name, item })) } },
  ];
  if (guide.live) {
    graph.push({ '@type': 'HowTo', '@id': url + '#howto', name: 'How to play Ranked on Lester\'s Arcade', description: guidePlainText(guide.intro.join(' ')),
      step: guide.steps.map((step, index) => ({ '@type': 'HowToStep', position: index + 1, name: step.name, text: guidePlainText(step.text), url: `${url}#${step.id}` })) });
    graph.push({ '@type': 'FAQPage', '@id': url + '#faq', mainEntity: guide.questions.map(([question, answer]) => ({ '@type': 'Question', name: question, acceptedAnswer: { '@type': 'Answer', text: guidePlainText(answer) } })) });
  }
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }).replace(/</g, '\\u003c');
}

// --- The other static surfaces (builder only) ---------------------------------
// The homepage "Play Ranked" strip, the Ranked modal's "What happens next", the
// trust page's how-to paragraphs and the llms.txt lines. Like the guide, they
// follow the flags (contract A33) and read every number from RANKED_FACTS.
export function rankedSurfaceCopy({ settlementLive = false } = {}) {
  const live = settlementLive === true;
  const guideLine = `The [player guide](${F.guidePath}) explains every step, the price, the checks and what to do if something goes wrong.`;
  return Object.freeze({
    live,
    // [label, action]: 'connect' opens the site's wallet sign-in; anything else is a link.
    homeRanked: live
      ? Object.freeze({ title: 'Play Ranked', lead: 'Put your runs on the leaderboards in three steps.',
        steps: Object.freeze([Object.freeze(['Connect a wallet', 'connect']), Object.freeze(['Get free zkLTC', F.faucetUrl]), Object.freeze([`Play Ranked, ${F.totalZkLtc} zkLTC`, '/games'])]) })
      : Object.freeze({ title: 'Ranked', lead: `Ranked is in preview right now: nothing is charged and no run is published on chain. ${W.free}`, steps: Object.freeze([]) }),
    entryNext: Object.freeze(live ? [
      'Your wallet asks you to confirm the total once. Your run starts as soon as it is sent.',
      "When the run ends, the arcade's server checks it and publishes your score on LitVM, usually within about a minute.",
      'Your score then shows on the leaderboards, your profile and your achievements.',
    ] : [
      'Nothing is charged and no transaction is sent.',
      'Ranked runs are not published on LitVM yet.',
      W.free,
    ]),
    trustHowTo: Object.freeze(live ? [
      faucetSentence,
      guideLine,
    ] : [
      `Ranked is in preview right now: nothing is charged and no run is published on chain. ${W.free} The [player guide](${F.guidePath}) says what changes when Ranked opens.`,
    ]),
    llmsGuideLine: live
      ? `How to play Ranked: the steps, the ${F.totalZkLtc} zkLTC price, free testnet zkLTC from the faucet, the server checks, the boards and fixes for common problems.`
      : 'Ranked is in preview right now: nothing is charged and no run is published on chain. Free play needs no wallet and never touches the chain.',
    llmsSection: live ? Object.freeze([
      W.price,
      W.faucet,
      W.free,
      W.proof,
      `Steps: play Free; connect a wallet; the site adds the ${F.networkName} (chain ${F.chainId}); get free zkLTC from the ${F.faucetName}; sign in with one free signature; choose Ranked and confirm ${F.totalZkLtc} zkLTC; play while the server checks the run; the relayer publishes it on LitVM, usually within about a minute.`,
      `The ${F.entryZkLtc} entry is split ${F.developerPercent}% to the game's developer and ${F.arcadePercent}% to the arcade; the ${F.publishZkLtc} pays the relayer that publishes the score.`,
      `Weekly boards reset every ${F.weeklyReset}; Monthly boards on ${F.monthlyReset}. ${F.achievementTotal} achievements (${GAMES.hmh} ${F.achievements['lester-blaster']}, ${GAMES.chikun} ${F.achievements.chikun}, ${GAMES.stacked} ${F.achievements.stacked}) are earned from verified Ranked runs.`,
      W.value,
    ]) : null,
  });
}

// The homepage strip's inner HTML (index.html copy:home-ranked).
export function renderHomeRanked(surface) {
  const { title, lead, steps } = surface.homeRanked;
  const items = steps.map(([label, action], index) => {
    const number = `<span class="portal-ranked-step-number" aria-hidden="true">${index + 1}</span>`;
    if (action === 'connect') return `<li><button type="button" class="portal-ranked-step" data-portal-connect>${number}${esc(label)}</button></li>`;
    const external = /^https?:\/\//.test(action);
    return `<li><a class="portal-ranked-step" href="${esc(action)}"${external ? ' target="_blank" rel="noopener noreferrer"' : ''}>${number}${esc(label)}${external ? NEW_TAB : ''}</a></li>`;
  });
  return `<p class="portal-kicker" id="homeRankedTitle">${esc(title)}</p><p class="portal-ranked-lead">${esc(lead)}</p>`
    + (items.length ? `<ol class="portal-ranked-steps">${items.join('')}</ol>` : '')
    + `<a class="portal-text-link" href="${F.guidePath}">How Ranked works →</a>`;
}
