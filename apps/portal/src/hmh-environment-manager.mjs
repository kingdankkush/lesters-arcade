const RUN_TARGET_SECONDS = 20 * 60;

export const WEATHER_PRESETS = Object.freeze({
  clear: Object.freeze({
    cosmeticLabel: 'Clear',
    gameplay: Object.freeze({ sightRadiusMul: 1, projectileDriftMul: 1 }),
    ambientFxMul: 1,
    backgroundFxMul: 1,
    weatherOverlayAlpha: 0.04,
  }),
  'dust-storm': Object.freeze({
    cosmeticLabel: 'Dust Storm',
    gameplay: Object.freeze({ sightRadiusMul: 0.88, projectileDriftMul: 1.06 }),
    ambientFxMul: 0.82,
    backgroundFxMul: 0.78,
    weatherOverlayAlpha: 0.18,
  }),
  fog: Object.freeze({
    cosmeticLabel: 'Fog',
    gameplay: Object.freeze({ sightRadiusMul: 0.9, projectileDriftMul: 1 }),
    ambientFxMul: 0.86,
    backgroundFxMul: 0.8,
    weatherOverlayAlpha: 0.16,
  }),
  wind: Object.freeze({
    cosmeticLabel: 'Wind',
    gameplay: Object.freeze({ sightRadiusMul: 1, projectileDriftMul: 1.08 }),
    ambientFxMul: 0.92,
    backgroundFxMul: 0.92,
    weatherOverlayAlpha: 0.1,
  }),
});

function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}

function normalizeId(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function seededUnit(seed = 0, offset = 0) {
  const x = Math.sin((Number(seed) || 0) * 0.00091 + offset * 1.731) * 43758.5453;
  return x - Math.floor(x);
}

function weatherIdForSeed(seed = 0) {
  const ids = ['clear', 'dust-storm', 'fog', 'wind'];
  return ids[Math.floor(seededUnit(seed, 7) * ids.length) % ids.length];
}

export function buildEnvironmentState({ seed = 0, elapsedSeconds = 0, levelId = 'level-1-crypto-wasteland' } = {}) {
  const progress = clamp01((Number(elapsedSeconds) || 0) / RUN_TARGET_SECONDS);
  const weatherId = weatherIdForSeed(seed);
  const preset = WEATHER_PRESETS[weatherId] ?? WEATHER_PRESETS.clear;
  const phase = progress < 0.55 ? 'dusk' : 'night';
  const ambientDarkness = 0.14 + progress * 0.22;
  const sunAngleDeg = 22 - progress * 36;
  const windHeading = seededUnit(seed, 11) * Math.PI * 2 + progress * 0.9;
  const gust = 0.35 + seededUnit(seed, 13) * 0.45 + progress * 0.15;
  const weatherIntensity = clamp01(0.45 + progress * 0.4 + seededUnit(seed, 17) * 0.2);
  return Object.freeze({
    levelId,
    progress,
    timeOfDay: Object.freeze({
      phase,
      ambientDarkness,
      sunAngleDeg,
    }),
    wind: Object.freeze({
      headingRad: windHeading,
      x: Math.cos(windHeading) * gust,
      y: Math.sin(windHeading) * gust,
      gust,
    }),
    weather: Object.freeze({
      id: weatherId,
      label: preset.cosmeticLabel,
      intensity: weatherIntensity,
      gameplay: Object.freeze({ ...preset.gameplay }),
    }),
  });
}

export function buildCombatReadabilityProfile({ enemyCount = 0, projectileCount = 0, weatherId = 'clear' } = {}) {
  const preset = WEATHER_PRESETS[weatherId] ?? WEATHER_PRESETS.clear;
  const threat = clamp01((Number(enemyCount) + Number(projectileCount) * 1.75) / 60);
  const ambientFxMul = Math.max(0.35, preset.ambientFxMul - threat * 0.45);
  const backgroundFxMul = Math.max(0.4, preset.backgroundFxMul - threat * 0.38);
  const weatherOverlayAlpha = Math.min(0.3, preset.weatherOverlayAlpha + threat * 0.08);
  const maxAmbientProps = Math.max(4, Math.round(14 - threat * 8));
  return Object.freeze({
    threat,
    ambientFxMul,
    backgroundFxMul,
    weatherOverlayAlpha,
    maxAmbientProps,
  });
}

export function buildAmbientZoneModel({ districtFamily = null, poiId = null, weatherId = 'clear' } = {}) {
  const district = normalizeId(districtFamily);
  const poi = normalizeId(poiId);
  const poiSpecific = {
    'dry-forest-cave': Object.freeze({ ambientBed: 'forest-cave-hush', dangerCue: 'cave-mouth-drip', poiTensionCue: 'alpha-den-tension' }),
    'rugpull-gulch': Object.freeze({ ambientBed: 'ghost-town-creak', dangerCue: 'sign-chain-rattle', poiTensionCue: 'rugpull-mainstreet-tension' }),
    'oasis-lakeside': Object.freeze({ ambientBed: 'oasis-waterline', dangerCue: 'reed-brush-rustle', poiTensionCue: 'sandbar-apex-pulse' }),
    'crossroads-trading-post': Object.freeze({ ambientBed: 'crossroads-lantern-hum', dangerCue: 'wagon-wheel-creak', poiTensionCue: 'hub-crossfire-rise' }),
    'mesa-overlook': Object.freeze({ ambientBed: 'mesa-wind-howl', dangerCue: 'ridge-glint-click', poiTensionCue: 'switchback-sniper-rise' }),
  }[poi];
  if (poiSpecific) return Object.freeze({ ...poiSpecific, weatherId });
  const byDistrict = {
    'desert-approach': 'desert-wind',
    'ghost-town': 'ghost-town-creak',
    'country-road': 'country-road-cicadas',
    'residential-edge': 'lakeside-reeds',
    'inner-city': 'city-gate-hum',
    'outer-boulevard': 'city-artery-hum',
    'financial-core': 'financial-downtown-hum',
    'luxury-neighborhoods': 'luxury-halo-hum',
    'penthouse-rim': 'penthouse-wind-hum',
  };
  if (district.includes('litecoin') || district.includes('urban') || district.includes('city')) {
    return Object.freeze({
      ambientBed: poiSpecific?.ambientBed ?? 'litecoin-city-neon-hum',
      dangerCue: weatherId === 'fog' ? 'neon-fog-siren' : 'rail-groove-rumble',
      poiTensionCue: poiSpecific?.poiTensionCue ?? (poi ? 'district-pressure-rise' : 'city-pressure-rise'),
      weatherId,
    });
  }

  return Object.freeze({
    ambientBed: byDistrict[district] ?? 'wasteland-night-air',
    dangerCue: weatherId === 'dust-storm' ? 'sand-whip' : 'distant-metal-creak',
    poiTensionCue: null,
    weatherId,
  });
}
