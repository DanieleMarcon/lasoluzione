declare module '@revolut/checkout' {
  export interface RevolutCheckoutInstance {
    /**
     * Apre il popup del checkout per il publicId passato in fase di init.
     */
    payWithPopup(options?: { name?: string }): Promise<void>;

    /**
     * API legacy per il campo carta (non usata, ma la lasciamo tipizzata per compatibilità).
     */
    createCardField(config: {
      target: string | HTMLElement;
      onSuccess?: (res: unknown) => void;
      onError?: (err: unknown) => void;
    }): unknown;
  }

  /**
   * Inizializza il widget usando il token/publicId dell’ordine (es. `checkoutPublicId`).
   */
  const RevolutCheckout: (publicId: string) => Promise<RevolutCheckoutInstance>;

  export default RevolutCheckout;
}
