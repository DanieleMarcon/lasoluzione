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
  tierLabel?: string | null;
  tierPriceCents?: number | null;
  tierType?: string | null;
  subtotalCents?: number | null;
  coverCents?: number | null;
  totalCents?: number | null;
  dinnerSubtotalCents?: number | null;
  dinnerCoverCents?: number | null;
  dinnerTotalCents?: number | null;
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
  coverCents: number;
  lunchRequirePrepay: boolean;
  dinnerCoverCents: number;
  dinnerRequirePrepay: boolean;
};
