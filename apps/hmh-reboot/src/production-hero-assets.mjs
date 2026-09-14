export const PRODUCTION_HERO_ASSETS = Object.freeze({
  'lit-commando': Object.freeze({
    actorId: 'lit-commando',
    variantId: 'reserve-vanguard',
    imageUrl: '/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.webp',
    metadataUrl: '/assets/generated/hmh-reboot-production-heroes/lit-commando/lit-commando-production-pilot-atlas.json',
    artSource: 'packed-textured-blend',
  }),
  'lit-valkyrie': Object.freeze({
    actorId: 'lit-valkyrie',
    variantId: 'plasma-striker',
    imageUrl: '/assets/generated/hmh-reboot-production-heroes/lit-valkyrie/lit-valkyrie-production-pilot-atlas.webp',
    metadataUrl: '/assets/generated/hmh-reboot-production-heroes/lit-valkyrie/lit-valkyrie-production-pilot-atlas.json',
    artSource: 'packed-textured-blend',
  }),
  'lester-original': Object.freeze({
    actorId: 'lester-original',
    variantId: 'blue-mask-original',
    imageUrl: '/assets/generated/hmh-reboot-production-heroes/lester-original/lester-original-production-pilot-atlas.webp',
    metadataUrl: '/assets/generated/hmh-reboot-production-heroes/lester-original/lester-original-production-pilot-atlas.json',
    artSource: 'packed-textured-blend',
  }),
  lilly: Object.freeze({
    actorId: 'lilly',
    variantId: 'gold-teal-veteran',
    imageUrl: '/assets/generated/hmh-reboot-production-heroes/lilly/lilly-production-pilot-atlas.webp',
    metadataUrl: '/assets/generated/hmh-reboot-production-heroes/lilly/lilly-production-pilot-atlas.json',
    artSource: 'packed-textured-blend',
  }),
});
export const PRODUCTION_HERO_ATLAS_IMAGE_URL = PRODUCTION_HERO_ASSETS['lit-commando'].imageUrl;
export const PRODUCTION_HERO_ATLAS_METADATA_URL = PRODUCTION_HERO_ASSETS['lit-commando'].metadataUrl;
export const PRODUCTION_HERO_RUNTIME_SCALE = 0.58;

export function productionHeroAsset(actorId) {
  const asset = PRODUCTION_HERO_ASSETS[actorId];
  if (!asset) throw new TypeError(`unknown approved production hero ${actorId}`);
  return asset;
}
