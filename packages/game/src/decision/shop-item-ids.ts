// Upstream shop IDs are stable in the saved catalogue. Keep protocol slugs here so
// purchase policy and callers cannot silently disagree about the same item.
export const SHOP_ITEM_IDS = {
  healingPotion: 'hpot',
  bookOfTricks: 'tricks',
  bookOfMegatricks: 'mtrix',
  clawSharpening: 'cs',
  clawHoning: 'ch',
  copperPlating: 'wax',
  ironPlating: 'iron',
  strongerWings: 'wingpot',
  awesomeWings: 'wingpotmax',
  gasoline: 'gas',
  rocketFuel: 'rf',
} as const;
