'use client';

import { useEffect, useMemo, useSyncExternalStore } from 'react';

import type { CartDTO } from '@/types/cart';

const CART_STORAGE_KEY = 'lasoluzione_cart_token';

type CartResponse = { ok: boolean; data?: CartDTO; error?: string };

type AddPayload = {
  productId: number;
  qty?: number;
  nameSnapshot?: string;
  priceCentsSnapshot?: number;
  imageUrlSnapshot?: string;
  meta?: Record<string, unknown> | null;
};

type CartStoreState = {
  cart: CartDTO | null;
  cartToken: string | null;
  loading: boolean;
  error: string | null;
  pending: Record<number, boolean>;
  initialized: boolean;
};

const initialState: CartStoreState = {
  cart: null,
  cartToken: null,
  loading: true,
  error: null,
  pending: {},
  initialized: false,
};

const cartStore: {
  state: CartStoreState;
  listeners: Set<() => void>;
} = {
  state: initialState,
  listeners: new Set(),
};

function setState(
  updater:
    | Partial<CartStoreState>
    | ((prev: CartStoreState) => Partial<CartStoreState>)
): void {
  const next = typeof updater === 'function' ? updater(cartStore.state) : updater;
  cartStore.state = { ...cartStore.state, ...next };
  cartStore.listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  cartStore.listeners.add(listener);
  return () => {
    cartStore.listeners.delete(listener);
  };
}

function getSnapshot(): CartStoreState {
  return cartStore.state;
}

function persistToken(token: string | null) {
  if (cartStore.state.cartToken === token) return;
  if (typeof window !== 'undefined') {
    if (token) {
      window.localStorage.setItem(CART_STORAGE_KEY, token);
    } else {
      window.localStorage.removeItem(CART_STORAGE_KEY);
    }
  }
  setState({ cartToken: token });
}

async function parseResponse(res: Response): Promise<CartResponse> {
  const body = (await res.json().catch(() => null)) as CartResponse | null;
  return body ?? { ok: false, error: 'Invalid response' };
}

async function createOrLoadCart(tokenArg?: string | null): Promise<CartDTO | null> {
  setState({ loading: true, error: null });

  const createCart = async (tokenPayload?: string | null) => {
    const res = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(tokenPayload ? { token: tokenPayload } : {}),
    });
    const body = await parseResponse(res);
    if (res.ok && body.ok && body.data) {
      setState({ cart: body.data });
      persistToken(body.data.token);
      return body.data;
    }
    throw new Error(body.error || 'Unable to create cart');
  };

  try {
    if (tokenArg) {
      const res = await fetch(`/api/cart?token=${encodeURIComponent(tokenArg)}`, { cache: 'no-store' });
      const body = await parseResponse(res);
      if (res.ok && body.ok && body.data) {
        setState({ cart: body.data });
        persistToken(body.data.token);
        return body.data;
      }
      if (res.status === 404) {
        return await createCart(null);
      }
      throw new Error(body.error || 'Unable to load cart');
    }
    return await createCart(tokenArg ?? null);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown cart error';
    setState({ error: message, cart: null });
    return null;
  } finally {
    setState({ loading: false });
  }
}

async function refreshCart(): Promise<CartDTO | null> {
  const token = cartStore.state.cartToken;
  if (token) {
    return createOrLoadCart(token);
  }
  return createOrLoadCart(null);
}

async function ensureCart(): Promise<CartDTO | null> {
  const existing = cartStore.state.cart;
  if (existing) return existing;
  await refreshCart();
  return cartStore.state.cart;
}

function flagPending(productId: number, nextValue: boolean) {
  setState((prev) => {
    const nextPending = { ...prev.pending };
    if (nextValue) {
      nextPending[productId] = true;
    } else {
      delete nextPending[productId];
    }
    return { pending: nextPending };
  });
}

async function addItemToCart(payload: AddPayload): Promise<void> {
  const cart = await ensureCart();
  if (!cart) return;

  flagPending(payload.productId, true);
  setState({ error: null });

  try {
    const res = await fetch(`/api/cart/${encodeURIComponent(cart.id)}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        productId: payload.productId,
        qty: payload.qty ?? 1,
        nameSnapshot: payload.nameSnapshot,
        priceCentsSnapshot: payload.priceCentsSnapshot,
        imageUrlSnapshot: payload.imageUrlSnapshot,
        meta: payload.meta,
      }),
    });
    const body = await parseResponse(res);
    if (!res.ok || !body?.ok) {
      throw new Error(body?.error || 'Unable to add item');
    }
    await refreshCart();
  } catch (error) {
    console.error('[useCart] addItem error', error);
    const message = error instanceof Error ? error.message : 'add_failed';
    setState({ error: message });
    throw error;
  } finally {
    flagPending(payload.productId, false);
  }
}

async function updateItemQty(productId: number, qty: number): Promise<void> {
  if (qty < 0) return;
  const cart = await ensureCart();
  if (!cart) return;

  flagPending(productId, true);
  setState({ error: null });

  try {
    const res = await fetch(`/api/cart/${encodeURIComponent(cart.id)}/items`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ productId, qty }),
    });
    const body = await parseResponse(res);
    if (!res.ok || !body?.ok) {
      throw new Error(body?.error || 'Unable to update item');
    }
    await refreshCart();
  } catch (error) {
    console.error('[useCart] updateItem error', error);
    const message = error instanceof Error ? error.message : 'update_failed';
    setState({ error: message });
    throw error;
  } finally {
    flagPending(productId, false);
  }
}

async function removeItemFromCart(productId: number): Promise<void> {
  const cart = await ensureCart();
  if (!cart) return;

  flagPending(productId, true);
  setState({ error: null });

  try {
    const res = await fetch(`/api/cart/${encodeURIComponent(cart.id)}/items?productId=${productId}`, {
      method: 'DELETE',
    });
    const body = await parseResponse(res);
    if (!res.ok || !body?.ok) {
      throw new Error(body?.error || 'Unable to remove item');
    }
    await refreshCart();
  } catch (error) {
    console.error('[useCart] removeItem error', error);
    const message = error instanceof Error ? error.message : 'remove_failed';
    setState({ error: message });
    throw error;
  } finally {
    flagPending(productId, false);
  }
}

let bootstrapPromise: Promise<CartDTO | null> | null = null;

async function bootstrapCart(): Promise<void> {
  if (typeof window === 'undefined') return;
  if (cartStore.state.initialized) return;
  if (bootstrapPromise) {
    await bootstrapPromise;
    return;
  }

  setState({ initialized: true });
  const stored = window.localStorage.getItem(CART_STORAGE_KEY);
  if (stored) {
    persistToken(stored);
  }

  bootstrapPromise = createOrLoadCart(stored ?? null);
  try {
    await bootstrapPromise;
  } finally {
    bootstrapPromise = null;
  }
}

export type UseCart = {
  cart: CartDTO | null;
  cartToken: string | null;
  loading: boolean;
  error: string | null;
  ready: boolean;
  totalQty: number;

  refresh: () => Promise<CartDTO | null>;
  setCart: (cart: CartDTO | null) => void;
  addItem: (payload: AddPayload) => Promise<void>;
  updateItem: (productId: number, qty: number) => Promise<void>;
  removeItem: (productId: number) => Promise<void>;
  pending: Record<number, boolean>;
};

export function useCart(): UseCart {
  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  useEffect(() => {
    void bootstrapCart();
  }, []);

  const totalQty = useMemo(
    () => (state.cart?.items ?? []).reduce((acc, item) => acc + item.qty, 0),
    [state.cart]
  );
  const ready = Boolean(state.cart) && !state.loading;

  return {
    cart: state.cart,
    cartToken: state.cartToken,
    loading: state.loading,
    error: state.error,
    ready,
    totalQty,
    refresh: refreshCart,
    setCart: (nextCart) => {
      setState({ cart: nextCart });
      if (!nextCart) persistToken(null);
    },
    addItem: addItemToCart,
    updateItem: updateItemQty,
    removeItem: removeItemFromCart,
    pending: state.pending,
  };
}
