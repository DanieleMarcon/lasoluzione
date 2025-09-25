import type { Event } from '@/src/lib/types';
export interface CmsAdapter {
  getEvents(): Promise<Event[]>;
  getEventBySlug(slug: string): Promise<Event | null>;
}
export function getAdapter(): CmsAdapter {
  // TODO: leggere window.__CMS__ lato client o env lato server
  // e ritornare l'implementazione corretta (strapi/directus/sanity).
  return {
    async getEvents(){ return []; },
    async getEventBySlug(){ return null; }
  };
}
