export async function readHeroSelectorEvidence(page, { timeout = 15_000 } = {}) {
  await page.waitForFunction(() => {
    const cards = [...document.querySelectorAll('#officialCharacterRoster .hero-card')];
    const rotators = cards.map((card) => card.querySelector('.hmh-cabinet-rotator'));
    return cards.length === 4
      && rotators.every(Boolean)
      && rotators.every((rotator) => {
        const frames = [...rotator.querySelectorAll('canvas.cabinet-rotation-frame')];
        return frames.length === 8 && frames.every((frame) => frame.dataset.ready === 'true');
      });
  }, undefined, { timeout });

  const evidence = await page.evaluate(() => {
    const cards = [...document.querySelectorAll('#officialCharacterRoster .hero-card')];
    return {
      scrollY: window.scrollY,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      documentHeight: document.documentElement.scrollHeight,
      selector: document.querySelector('#officialCharacterSelect')?.getBoundingClientRect().toJSON() ?? null,
      roster: (() => {
        const roster = document.querySelector('#officialCharacterRoster');
        return roster ? {
          ...roster.getBoundingClientRect().toJSON(),
          clientWidth: roster.clientWidth,
          scrollWidth: roster.scrollWidth,
          overflowX: getComputedStyle(roster).overflowX,
          gridAutoFlow: getComputedStyle(roster).gridAutoFlow,
        } : null;
      })(),
      cards: cards.map((card) => {
        const frames = [...card.querySelectorAll('canvas.cabinet-rotation-frame')];
        return {
          id: card.dataset.characterId ?? null,
          active: card.classList.contains('active'),
          locked: card.classList.contains('locked'),
          layoutTop: card.offsetTop,
          rect: card.getBoundingClientRect().toJSON(),
          alphaPixels: frames.map((frame) => {
            const data = frame.getContext('2d', { willReadFrequently: true }).getImageData(0, 0, frame.width, frame.height).data;
            let count = 0;
            for (let index = 3; index < data.length; index += 4) if (data[index] > 0) count += 1;
            return count;
          }),
        };
      }),
    };
  });

  if ((evidence.cards[0]?.rect?.top ?? -1) < 0) {
    throw new Error(`hero selector first card clipped: ${JSON.stringify({ scrollY: evidence.scrollY, selector: evidence.selector, roster: evidence.roster, first: evidence.cards[0]?.rect })}`);
  }
  if (evidence.cards.length !== 4) throw new Error(`hero selector card count=${evidence.cards.length}`);
  for (const card of evidence.cards) {
    if (card.alphaPixels.length !== 8 || card.alphaPixels.some((count) => count <= 0)) {
      throw new Error(`hero selector ${card.id ?? 'unknown'} has blank rotation frames: ${card.alphaPixels.join(',')}`);
    }
  }
  return evidence;
}
