import { describe, expect, it } from 'vitest';
import {
  bestOfferPrice,
  normalizeWishlistItem,
  wishlistLineTotal,
  wishlistPriceCompare,
} from './wishlist';

describe('wishlist offers', () => {
  it('migrates legacy url/price to offers', () => {
    const w = normalizeWishlistItem({
      name: 'Test',
      url: 'onliner.by/item/1',
      price: 50,
      store: '',
    });
    expect(w.offers.length).toBe(1);
    expect(w.url).toContain('https://');
    expect(w.price).toBe(50);
  });

  it('picks best price among offers', () => {
    const w = normalizeWishlistItem({
      name: 'X',
      offers: [
        {
          id: '1',
          url: 'https://a.test',
          store: 'a',
          unitPrice: 90,
          note: '',
        },
        {
          id: '2',
          url: 'https://b.test',
          store: 'b',
          unitPrice: 70,
          note: '',
        },
      ],
      quantity: 2,
    });
    expect(bestOfferPrice(w.offers)).toBe(70);
    expect(wishlistLineTotal(w)).toBe(140);
    const cmp = wishlistPriceCompare(w);
    expect(cmp?.savings).toBe(40);
  });
});
