// Population counts come from the server. This projection never grants an unlock.
export const ACHIEVEMENT_RARITY_MIN_PLAYERS = 20;
const MAX_COUNT = 2147483647; // count(*)::int in the index driver contract.
const TIERS = Object.freeze([
 Object.freeze({percent:50,rarity:'common',label:'Common'}),
 Object.freeze({percent:20,rarity:'uncommon',label:'Uncommon'}),
 Object.freeze({percent:5,rarity:'rare',label:'Rare'}),
 Object.freeze({percent:1,rarity:'epic',label:'Epic'}),
]);
const count = value => {
 if(!Number.isInteger(value)||value<0||value>MAX_COUNT)throw new TypeError('rarity counts must be non-negative int4 values');
 return value;
};
export function achievementRarity({unlockedPlayers,rankedPlayers}={}) {
 const unlocked=count(unlockedPlayers),ranked=count(rankedPlayers);
 if(unlocked>ranked)throw new TypeError('unlocked players must belong to the eligible Ranked cohort');
 if(ranked<ACHIEVEMENT_RARITY_MIN_PLAYERS)return{rarity:'early',label:'Early',percentage:null};
 // Integer cross-products preserve threshold boundaries without rounding the rate.
 const tier=TIERS.find(value=>unlocked*100>=ranked*value.percent)??{rarity:'legendary',label:'Legendary'};
 return{rarity:tier.rarity,label:tier.label,percentage:unlocked*100/ranked};
}
