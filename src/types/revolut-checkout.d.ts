declare module '@revolut/checkout' {
  export type RevolutCheckoutMode = 'sandbox' | 'prod';

  export type RevolutCheckoutOptions = {
    mode?: RevolutCheckoutMode;
    locale?: string;
    publicToken: string;
  };

  export type RevolutCheckoutInstance = {
    pay(): Promise<void>;
  };

  export default function RevolutCheckout(
    publicId: string,
    options: RevolutCheckoutOptions
  ): Promise<RevolutCheckoutInstance>;
}
