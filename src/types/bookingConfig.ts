export type BookingConfigDTO = {
  enableDateTimeStep: boolean;
  fixedDate?: string;
  fixedTime?: string;
  enabledTypes: string[];
  typeLabels: Record<string, string>;
  prepayTypes: string[];
  prepayAmountCents?: number;
};
