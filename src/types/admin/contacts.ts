export type ContactDTO = {
  name?: string | null;
  email: string;
  phone?: string | null;

  lastContactAt?: string | null;
  createdAt?: string | null;

  privacy?: boolean | null;
  newsletter?: boolean | null;

  bookingsCount?: number;
  totalBookings?: number;
};
