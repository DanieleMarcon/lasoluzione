export type CatalogSectionDTO = {
  key: 'eventi' | 'aperitivo' | 'pranzo' | 'cena' | 'colazione';
  title: string;
  description?: string;
  enableDateTime: boolean;
  active: boolean;
  displayOrder: number;
  products: Array<{
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
  }>;
};

export type CatalogDTO = {
  sections: CatalogSectionDTO[];
};
