import type { NormalizedShopItem } from '../upstream/types.js';

export interface ShopOffer extends NormalizedShopItem {
  readonly affordable: boolean;
}

export function getShopOffers(
  items: readonly NormalizedShopItem[],
  gold: number,
): readonly ShopOffer[] {
  return items.map((item) => ({ ...item, affordable: gold >= item.cost }));
}
