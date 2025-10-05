export type BookingMenuDishDTO = {
  id: number;
  name: string;
  slug: string;
  description?: string;
  priceCents: number;
  active: boolean;
  category?: string;
  order: number;
  visibleAt: 'lunch' | 'dinner' | 'both';
};

export type BookingMenuDTO = {
  dishes: BookingMenuDishDTO[];
  coverCents: number;
  dinnerCoverCents: number;
  lunchRequirePrepay: boolean;
  dinnerRequirePrepay: boolean;
};

export type BookingTierDTO = {
  id: string;
  type: 'evento' | 'aperitivo';
  label: string;
  priceCents: number;
  active: boolean;
  order: number;
};

export type BookingTiersDTO = {
  evento: BookingTierDTO[];
  aperitivo: BookingTierDTO[];
};

export type BookingConfigDTO = {
  enableDateTimeStep: boolean;
  fixedDate?: string;
  fixedTime?: string;
  enabledTypes: string[];
  typeLabels: Record<string, string>;
  prepayTypes: string[];
  prepayAmountCents?: number;
  menu: BookingMenuDTO;
  tiers: BookingTiersDTO;
};
