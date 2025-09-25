export const CATEGORIES = ['essential','functional','analytics','marketing'] as const;
export type Category = typeof CATEGORIES[number];
