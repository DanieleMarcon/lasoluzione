export type OrderDTO = {
  id: string;
  cartId: string;
  status: string;
  totalCents: number;
  discountCents?: number;
  paymentRef?: string;
  createdAt: string;
};

export type CheckoutInput = {
  token: string;
  email: string;
  name: string;
  phone: string;
  notes?: string;
};
