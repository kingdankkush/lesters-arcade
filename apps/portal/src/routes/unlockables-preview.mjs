// Lazy static Locker inspection. No loop, game session, rewards or persistence.
import { CHIKUN_CHARACTERS, drawChikunStill, chikunTrailParticles } from '../../../chikun/src/character.mjs';
import { planChikunVfx } from '../../../chikun/src/vfx.mjs';
import { piecePaletteFor } from '../../../stacked/src/render/cosmetic-palettes.mjs';
import { PIECE_COLORS } from '../../../stacked/src/render/board-view.mjs';
import { PIECE_CELLS } from '../stacked-sim.mjs';

export function stackedPreviewPieces(pieceSkin) {
  const colors = piecePaletteFor({ cosmetics: { pieceSkin } }) ?? PIECE_COLORS;
  return Object.entries(PIECE_CELLS).map(([kind, rotations]) => ({ kind, cells: rotations[0], color: '#' + colors[kind].toString(16).padStart(6, '0') }));
}

let sheet;
function chikunSheet(ImageClass) {
  if (!sheet) sheet = (async () => {
    const image = new ImageClass(); image.src = CHIKUN_CHARACTERS['chikun-original'].base + 'cruise.webp';
    let timer;
    try { await Promise.race([image.decode(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Preview image timeout')), 8000); })]); return image; }
    catch (error) { image.src = ''; sheet = null; throw error; }
    finally { clearTimeout(timer); }
  })();
  return sheet;
}

function piecesCanvas(ctx, id) {
  const pieces = stackedPreviewPieces(id), unit = 25;
  for (const [index, piece] of pieces.entries()) {
    const row = index < 4 ? 0 : 1, column = row ? index - 4 : index;
    const center = (row ? 165 : 95) + column * 150, top = row ? 235 : 75;
    const xs = piece.cells.map(cell => cell[0]), ys = piece.cells.map(cell => cell[1]);
    const middle = (Math.min(...xs) + Math.max(...xs) + 1) / 2;
    for (const [x, y] of piece.cells) {
      const px = center + (x - middle) * unit, py = top + (Math.max(...ys) - y) * unit;
      ctx.fillStyle = piece.color; ctx.beginPath(); ctx.roundRect(px, py, unit - 2, unit - 2, 4); ctx.fill();
      ctx.strokeStyle = '#ffffff52'; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#ffffff33'; ctx.fillRect(px + 3, py + 3, unit - 8, 2);
    }
    ctx.fillStyle = '#d6e9f3'; ctx.font = '600 20px system-ui'; ctx.textAlign = 'center'; ctx.fillText(piece.kind, center, top + 90);
  }
}

export async function mountUnlockablePreview(figure, { gameId, slot, id, title, canvasFilter = true, current = () => figure.isConnected }) {
  const documentRef = figure.ownerDocument, canvas = documentRef.createElement('canvas'), ctx = canvas.getContext?.('2d');
  if (!ctx) return false;
  canvas.width = 640; canvas.height = 400; canvas.className = 'unlockables-cosmetic-canvas';
  canvas.setAttribute('role', 'img'); canvas.setAttribute('aria-label', title + ' cosmetic preview');
  let caption;
  if (gameId === 'chikun' && ['coat', 'trail', 'hat'].includes(slot)) {
    const image = await chikunSheet(documentRef.defaultView.Image);
    if (!current()) return false;
    const cosmetics = { [slot]: id }, filterWorks = canvasFilter && 'filter' in ctx;
    if (!filterWorks) delete cosmetics.coat;
    if (slot === 'trail') {
      // Three frozen flap bursts show the shipped particle colour; no time loop.
      const particles = chikunTrailParticles(planChikunVfx({ event: 'flap', tick: 36 }).particles, 'flap', cosmetics);
      for (let burst = 0; burst < 3; burst++) for (const p of particles) {
        const age = 8 + burst * 4, x = 165 - burst * 45 + p.vx * age, y = 225 + p.vy * age;
        ctx.globalAlpha = 1 - age / p.lifeTicks; ctx.strokeStyle = p.color; ctx.lineWidth = Math.max(2, p.size * .8);
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x - p.size * 3, y + p.vy); ctx.stroke();
      }
      ctx.globalAlpha = 1;
    }
    drawChikunStill(ctx, image, { x: 365, y: 205, size: 480, cosmetics, probe: documentRef.createElement('canvas') });
    caption = slot === 'coat' && id && !filterWorks ? 'Classic coat shown · colour filters unavailable in this browser' : slot === 'trail' ? 'In-game flap colours · still preview' : 'In-game sprite and cosmetic · still preview';
  } else if (gameId === 'stacked' && slot === 'piece-skin') {
    piecesCanvas(ctx, id); caption = 'All seven pieces · in-game palette';
  } else return false;
  if (!current()) return false;
  const label = documentRef.createElement('figcaption'); label.textContent = caption;
  figure.replaceChildren(canvas, label); figure.dataset.preview = 'ready';
  return true;
}
