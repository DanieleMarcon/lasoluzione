declare module '@revolut/checkout' {
  export type RevolutCheckoutMode = 'sandbox' | 'prod';

  export type RevolutCheckoutPopupHandlers = {
    onSuccess(): void;
    onError(): void;
    onCancel(): void;
  };

  export type RevolutCheckoutInstance = {
    payWithPopup(handlers: RevolutCheckoutPopupHandlers): void;
  };

  export default function RevolutCheckout(
    token: string,
    mode?: RevolutCheckoutMode
  ): Promise<RevolutCheckoutInstance>;
}
