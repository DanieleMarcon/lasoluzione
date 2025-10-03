// src/types/admin.ts
export type AdminBooking = {
  id: number;
  date: string;
  people: number;
  type: string;
  name: string;
  email: string;
  phone: string;
  notes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

export type BookingListResponse = {
  data: AdminBooking[];
  meta: {
    page: number;
    pageSize: number;
    total: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

export type AdminSettingsDTO = {
  enableDateTimeStep: boolean;
  fixedDate: string | null;
  fixedTime: string | null;
  enabledTypes: string[];
  typeLabels: Record<string, string>;
  prepayTypes: string[];
  prepayAmountCents: number | null;
};
