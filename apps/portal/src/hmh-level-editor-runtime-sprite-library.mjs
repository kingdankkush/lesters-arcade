// Lazy loader for the Hard Money Heroes level editor runtime sprite index.
// The full payload lives in assets/hmh-level-editor/runtime-sprite-library.json
// so syntax checks and JS bundles do not parse a multi-megabyte data module.

export const HMH_LEVEL_EDITOR_RUNTIME_SPRITE_LIBRARY_URL = './assets/hmh-level-editor/runtime-sprite-library.json';

let runtimeSpriteLibraryPromise = null;

function freezeRuntimeSpriteEntry(entry = {}) {
  return Object.freeze({ ...entry });
}

export function freezeHmhLevelEditorRuntimeSpriteLibrary(entries = []) {
  return Object.freeze(entries.map((entry) => freezeRuntimeSpriteEntry(entry)));
}

export async function loadHmhLevelEditorRuntimeSpriteLibrary({
  url = HMH_LEVEL_EDITOR_RUNTIME_SPRITE_LIBRARY_URL,
  fetchImpl = globalThis.fetch,
} = {}) {
  if (!runtimeSpriteLibraryPromise) {
    runtimeSpriteLibraryPromise = (async () => {
      if (typeof fetchImpl !== 'function') {
        throw new Error('HMH level editor runtime sprite library requires fetch().');
      }
      const response = await fetchImpl(url);
      if (!response?.ok) {
        throw new Error(`Failed to load HMH runtime sprite library: ${response?.status ?? 'no response'} ${url}`);
      }
      const payload = await response.json();
      if (!Array.isArray(payload)) {
        throw new Error('HMH runtime sprite library JSON must be an array.');
      }
      return freezeHmhLevelEditorRuntimeSpriteLibrary(payload);
    })();
  }
  return runtimeSpriteLibraryPromise;
}
