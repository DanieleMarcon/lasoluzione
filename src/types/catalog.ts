export type CatalogProductDTO = {
  type: 'product';
  id: number;
  slug: string;
  name: string;
  priceCents: number;
  imageUrl?: string;
  category?: string;
  order: number;
  active: boolean;
  isVegan: boolean;
  isVegetarian: boolean;
  isGlutenFree: boolean;
  isLactoseFree: boolean;
  isOrganic: boolean;
};

export type CatalogEventDTO = {
  type: 'event';
  id: string;
  slug: string;
  title: string;
  priceCents: number;
  startAt: string;
  endAt: string | null;
  order: number;
  flags: {
    emailOnly: boolean;
    featured: boolean;
    showInHome: boolean;
  };
  productId?: number;
};

export type CatalogSectionDTO = {
  key: 'eventi' | 'aperitivo' | 'pranzo' | 'cena' | 'colazione';
  title: string;
  description?: string;
  enableDateTime: boolean;
  active: boolean;
  displayOrder: number;
  products: Array<CatalogProductDTO | CatalogEventDTO>;
};

export type CatalogDTO = {
  sections: CatalogSectionDTO[];
};
