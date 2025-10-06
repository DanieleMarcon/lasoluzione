"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import type { CartDTO } from '@/types/cart';

type CartContextValue = {
  token: string | null;
  cart: CartDTO | null;
  loading: boolean;
  addItem: (productId: number, qty: number) => Promise<void>;
  updateItem: (itemId: number, qty: number) => Promise<void>;
  removeItem: (itemId: number) => Promise<void>;
  refresh: () => Promise<void>;
};

type CartApiResponse = {
  ok: boolean;
  data?: CartDTO;
  error?: string;
};

const CART_TOKEN_STORAGE_KEY = 'lasoluzione.cart.token';

const CartContext = createContext<CartContextValue | undefined>(undefined);

function CartProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(null);
  const [cart, setCart] = useState<CartDTO | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const isMountedRef = useRef(true);

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const setLoadingSafe = useCallback((value: boolean) => {
    if (!isMountedRef.current) return;
    setLoading(value);
  }, []);

  const applyCart = useCallback((next: CartDTO) => {
    if (!isMountedRef.current) return;
    setCart(next);
    setToken(next.token);
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(CART_TOKEN_STORAGE_KEY, next.token);
    }
  }, []);

  const readStoredToken = useCallback(() => {
    if (typeof window === 'undefined') return null;
    const stored = window.localStorage.getItem(CART_TOKEN_STORAGE_KEY);
    return stored && stored.length > 0 ? stored : null;
  }, []);

  const requestCreateCart = useCallback(async (existingToken?: string | null) => {
    const response = await fetch('/api/cart', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(existingToken ? { token: existingToken } : {}),
    });

    const payload = (await response.json().catch(() => ({}))) as CartApiResponse;

    if (!response.ok || !payload.ok || !payload.data) {
      throw new Error(payload.error ?? 'Unable to create cart');
    }

    return payload.data;
  }, []);

  const requestFetchCart = useCallback(async (cartToken: string) => {
    const response = await fetch(`/api/cart?token=${encodeURIComponent(cartToken)}`, {
      method: 'GET',
      cache: 'no-store',
    });

    const payload = (await response.json().catch(() => ({}))) as CartApiResponse;

    if (!response.ok || !payload.ok || !payload.data) {
      throw new Error(payload.error ?? 'Unable to fetch cart');
    }

    return payload.data;
  }, []);

  const initializeCart = useCallback(async () => {
    const stored = readStoredToken();

    setLoadingSafe(true);
    try {
      if (stored) {
        try {
          const existing = await requestFetchCart(stored);
          applyCart(existing);
          return existing;
        } catch (error) {
          console.warn('[CartProvider] failed to load stored cart, creating new', error);
        }
      }

      const created = await requestCreateCart(stored);
      applyCart(created);
      return created;
    } catch (error) {
      console.error('[CartProvider] unable to initialize cart', error);
      if (typeof window !== 'undefined') {
        window.localStorage.removeItem(CART_TOKEN_STORAGE_KEY);
      }
      return null;
    } finally {
      setLoadingSafe(false);
    }
  }, [applyCart, readStoredToken, requestCreateCart, requestFetchCart, setLoadingSafe]);

  useEffect(() => {
    initializeCart().catch((error) => {
      console.error('[CartProvider] initialization error', error);
    });
  }, [initializeCart]);

  const ensureCart = useCallback(async () => {
    if (cart) {
      return cart;
    }

    const storedToken = token ?? readStoredToken();
    if (storedToken) {
      try {
        const existing = await requestFetchCart(storedToken);
        applyCart(existing);
        return existing;
      } catch (error) {
        console.warn('[CartProvider] failed to fetch ensured cart, creating new', error);
      }
    }

    const created = await requestCreateCart(storedToken);
    applyCart(created);
    return created;
  }, [applyCart, cart, readStoredToken, requestCreateCart, requestFetchCart, token]);

  const refresh = useCallback(async () => {
    const activeToken = token ?? readStoredToken();
    if (!activeToken) {
      await initializeCart();
      return;
    }

    setLoadingSafe(true);
    try {
      const refreshed = await requestFetchCart(activeToken);
      applyCart(refreshed);
    } catch (error) {
      console.error('[CartProvider] refresh failed, reinitializing', error);
      await initializeCart();
    } finally {
      setLoadingSafe(false);
    }
  }, [applyCart, initializeCart, readStoredToken, requestFetchCart, setLoadingSafe, token]);

  const addItem = useCallback(
    async (productId: number, qty: number) => {
      const currentCart = await ensureCart();
      if (!currentCart) {
        console.error('[CartProvider] unable to ensure cart before addItem');
        return;
      }

      setLoadingSafe(true);
      try {
        const response = await fetch(`/api/cart/${currentCart.id}/items`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ productId, qty }),
        });

        const payload = (await response.json().catch(() => ({}))) as CartApiResponse;

        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error ?? 'Unable to add item');
        }

        applyCart(payload.data);
      } catch (error) {
        console.error('[CartProvider] addItem failed', error);
      } finally {
        setLoadingSafe(false);
      }
    },
    [applyCart, ensureCart, setLoadingSafe],
  );

  const updateItem = useCallback(
    async (itemId: number, qty: number) => {
      const currentCart = await ensureCart();
      if (!currentCart) {
        console.error('[CartProvider] unable to ensure cart before updateItem');
        return;
      }

      setLoadingSafe(true);
      try {
        const response = await fetch(`/api/cart/${currentCart.id}/items`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ itemId, qty }),
        });

        const payload = (await response.json().catch(() => ({}))) as CartApiResponse;

        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error ?? 'Unable to update item');
        }

        applyCart(payload.data);
      } catch (error) {
        console.error('[CartProvider] updateItem failed', error);
      } finally {
        setLoadingSafe(false);
      }
    },
    [applyCart, ensureCart, setLoadingSafe],
  );

  const removeItem = useCallback(
    async (itemId: number) => {
      const currentCart = await ensureCart();
      if (!currentCart) {
        console.error('[CartProvider] unable to ensure cart before removeItem');
        return;
      }

      setLoadingSafe(true);
      try {
        const response = await fetch(`/api/cart/${currentCart.id}/items?itemId=${itemId}`, {
          method: 'DELETE',
        });

        const payload = (await response.json().catch(() => ({}))) as CartApiResponse;

        if (!response.ok || !payload.ok || !payload.data) {
          throw new Error(payload.error ?? 'Unable to remove item');
        }

        applyCart(payload.data);
      } catch (error) {
        console.error('[CartProvider] removeItem failed', error);
      } finally {
        setLoadingSafe(false);
      }
    },
    [applyCart, ensureCart, setLoadingSafe],
  );

  const value = useMemo<CartContextValue>(
    () => ({ token, cart, loading, addItem, updateItem, removeItem, refresh }),
    [addItem, cart, loading, refresh, removeItem, token, updateItem],
  );

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>;
}

export function useCart() {
  const context = useContext(CartContext);
  if (!context) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
}

export default CartProvider;
