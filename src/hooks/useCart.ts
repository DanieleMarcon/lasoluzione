'use client';

import { useCallback, useEffect, useState } from 'react';

import type { CartDTO } from '@/types/cart';

const CART_STORAGE_KEY = 'lasoluzione_cart_token';

type UseCartResult = {
  cart: CartDTO | null;
  cartToken: string | null;
  loading: boolean;
  error: string | null;
  refresh: () => Promise<CartDTO | null>;
  setCart: (cart: CartDTO | null) => void;
};

type CartResponse = {
  ok: boolean;
  data?: CartDTO;
  error?: string;
};

async function parseResponse(res: Response): Promise<CartResponse> {
  const body = (await res.json().catch(() => null)) as CartResponse | null;
  return body ?? { ok: false, error: 'Invalid response' };
}

export function useCart(): UseCartResult {
  const [cart, setCartState] = useState<CartDTO | null>(null);
  const [cartToken, setCartToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

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

  const fetchCart = useCallback(
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
          const res = await fetch(`/api/cart?token=${encodeURIComponent(tokenArg)}`, {
            cache: 'no-store',
          });
          const body = await parseResponse(res);
          if (res.ok && body.ok && body.data) {
            setCartState(body.data);
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
        setError(message);
        setCartState(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [persistToken]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    if (stored) {
      setCartToken(stored);
      void fetchCart(stored);
    } else {
      void fetchCart(null);
    }
  }, [fetchCart]);

  const refresh = useCallback(async () => fetchCart(cartToken), [cartToken, fetchCart]);

  return {
    cart,
    cartToken,
    loading,
    error,
    refresh,
    setCart: setCartState,
  };
}
