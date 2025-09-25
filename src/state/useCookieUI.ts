'use client';
import { create } from 'zustand';

type CookieUI = {
  isModalOpen: boolean;
  open: () => void;
  close: () => void;
};
export const useCookieUI = create<CookieUI>((set) => ({
  isModalOpen: false,
  open: () => set({ isModalOpen: true }),
  close: () => set({ isModalOpen: false })
}));