'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
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
  removeItem: (productId: number) => Promise<void>;
  pending: Record<number, boolean>;
};

async function parseResponse(res: Response): Promise<CartResponse> {
  const body = (await res.json().catch(() => null)) as CartResponse | null;
  return body ?? { ok: false, error: 'Invalid response' };
}

export function useCart(): UseCart {
  const [cart, setCartState] = useState<CartDTO | null>(null);
  const [cartToken, setCartToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState<Record<number, boolean>>({});

  const persistToken = useCallback((token: string | null) => {
    if (typeof window === 'undefined') return;
    if (token) {
      window.localStorage.setItem(CART_STORAGE_KEY, token);
      setCartToken((current) => (current === token ? current : token));
    } else {
      window.localStorage.removeItem(CART_STORAGE_KEY);
      setCartToken(null);
    }
  }, []);

  const createOrLoad = useCallback(
    async (tokenArg?: string | null): Promise<CartDTO | null> => {
      setLoading(true);
      setError(null);

      const createCart = async (tokenPayload?: string | null) => {
        const res = await fetch('/api/cart', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(tokenPayload ? { token: tokenPayload } : {}),
        });
        const body = await parseResponse(res);
        if (res.ok && body.ok && body.data) {
          setCartState(body.data);
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
            setCartState(body.data);
            persistToken(body.data.token);
            return body.data;
          }
          if (res.status === 404) return await createCart(null);
          throw new Error(body.error || 'Unable to load cart');
        }
        return await createCart(tokenArg ?? null);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Unknown cart error';
        setError(message);
        setCartState(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [persistToken]
  );

  // Bootstrap: leggi il token locale e carica/crea il carrello
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      setCartToken(stored);
      void createOrLoad(stored);
    } else {
      void createOrLoad(null);
    }
  }, [createOrLoad]);

  const refresh = useCallback(async () => createOrLoad(cartToken), [cartToken, createOrLoad]);

  const addItem = useCallback(
    async (payload: AddPayload) => {
      if (!cart) return;
      setPending((p) => ({ ...p, [payload.productId]: true }));
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
        if (!res.ok || !body?.ok) throw new Error(body?.error || 'add_failed');
        await refresh();
      } finally {
        setPending((p) => {
          const { [payload.productId]: _drop, ...rest } = p;
          return rest;
        });
      }
    },
    [cart, refresh]
  );

  const removeItem = useCallback(
    async (productId: number) => {
      if (!cart) return;
      setPending((p) => ({ ...p, [productId]: true }));
      try {
        const res = await fetch(
          `/api/cart/${encodeURIComponent(cart.id)}/items?productId=${productId}`,
          { method: 'DELETE' }
        );
        const body = await parseResponse(res);
        if (!res.ok || !body?.ok) throw new Error(body?.error || 'remove_failed');
        await refresh();
      } finally {
        setPending((p) => {
          const { [productId]: _drop, ...rest } = p;
          return rest;
        });
      }
    },
    [cart, refresh]
  );

  const totalQty = useMemo(() => (cart?.items ?? []).reduce((acc, it) => acc + it.qty, 0), [cart]);
  const ready = !!cart && !loading;

  return {
    cart,
    cartToken,
    loading,
    error,
    ready,
    totalQty,
    refresh,
    setCart: setCartState,
    addItem,
    removeItem,
    pending,
  };
}
