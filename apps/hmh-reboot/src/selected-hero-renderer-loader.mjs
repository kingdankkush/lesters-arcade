// Selection is the loading boundary. The startup art gate still waits for the
// selected base atlas; only optional motion pages may arrive during play.
export function createSelectedHeroRendererLoader(load = () => import('./production-hero-atlas.mjs')) {
  let pending;
  return () => pending ??= Promise.resolve().then(load).catch(error => {
    pending = null;
    throw error;
  });
}
