import { chikunCoinOriginToFrame, sampleChikunCoinFlight } from './coin-feedback.mjs';
export { createChikunCoinFeedback } from './coin-feedback.mjs';

// Runs on the existing frame clock: no extra timers, listeners, animation objects or randomness.
export function createChikunCoinOverlay({ frame, canvas, counter, documentRef = document }) {
  const flights = []; let disposed = false, arrivals = 0, pulse = 0;
  const oldColor = counter.style.color ?? '';
  const arrive = () => { arrivals++; pulse = .18; counter.dataset.coinFeedbackArrivals = String(arrivals); };
  const clear = () => { for (const flight of flights) flight.node.remove(); flights.length = 0; };
  const bounds = () => {
    const rect = frame.getBoundingClientRect();
    return { left: rect.left + (frame.clientLeft || 0), top: rect.top + (frame.clientTop || 0) };
  };
  return Object.freeze({
    get activeCount() { return flights.length; }, get arrivals() { return arrivals; },
    collect(plan, view, { reduceMotion = false } = {}) {
      if (disposed) return;
      if (reduceMotion) { clear(); arrive(); return; }
      // Several coins in one simulation step still produce one small visual cue.
      if (flights.length === 4) flights.shift().node.remove();
      const node = documentRef.createElement('span'); node.setAttribute('aria-hidden', 'true'); node.dataset.coinFlight = 'positive-v1'; node.textContent = 'Ł';
      Object.assign(node.style, { position: 'absolute', zIndex: '3', pointerEvents: 'none', left: '0', top: '0', width: '20px', height: '20px',
        border: '1px solid #fff2c7', borderRadius: '50%', background: 'linear-gradient(135deg,#fff5d7,#e7c786 55%,#ad793d)',
        color: '#79542f', font: 'bold 13px Georgia', lineHeight: '18px', textAlign: 'center', willChange: 'transform', contain: 'layout style paint' });
      const from = chikunCoinOriginToFrame(plan, view, canvas.getBoundingClientRect(), bounds());
      node.style.transform = `translate(${from.x - 10}px,${from.y - 10}px)`;
      frame.appendChild(node); flights.push({ node, from, age: 0 });
    },
    render(dt, view, { reduceMotion = false } = {}) {
      if (disposed) return;
      const delta = Number.isFinite(dt) ? Math.max(0, Math.min(.1, dt)) : 0;
      if (reduceMotion && flights.length) { clear(); arrive(); }
      if (flights.length) {
        const parent = bounds(), target = counter.getBoundingClientRect();
        const to = { x: target.left - parent.left + target.width / 2, y: target.top - parent.top + target.height / 2 };
        for (let index = flights.length - 1; index >= 0; index--) {
          const flight = flights[index]; flight.age += delta;
          const pose = sampleChikunCoinFlight(flight.from, to, flight.age / .5);
          if (!pose.visible) { flight.node.remove(); flights.splice(index, 1); arrive(); }
          else flight.node.style.transform = `translate(${pose.x - 10}px,${pose.y - 10}px) scale(${pose.size / 20})`;
        }
      }
      pulse = Math.max(0, pulse - delta); counter.style.color = pulse ? '#fff2c7' : oldColor;
    },
    reset() { clear(); pulse = 0; counter.style.color = oldColor; },
    dispose() { if (disposed) return; disposed = true; clear(); pulse = 0; counter.style.color = oldColor; delete counter.dataset.coinFeedbackArrivals; },
  });
}
