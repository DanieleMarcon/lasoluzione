export type CartItemDTO = {
  id: number;
  productId: number;
  nameSnapshot: string;
  priceCentsSnapshot: number;
  qty: number;
  imageUrlSnapshot?: string;
  meta?: unknown;
};

export type CartDTO = {
  id: string;
  token: string;
  status: 'open' | 'locked' | 'expired';
  totalCents: number;
  items: CartItemDTO[];
};

export type AddItemInput = {
  productId: number;
  qty: number;
  meta?: unknown;
};

export type UpdateItemInput = {
  itemId: number;
  qty: number;
};
