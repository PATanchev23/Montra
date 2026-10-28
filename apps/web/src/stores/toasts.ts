import { create } from 'zustand';

export type ToastTone = 'positive' | 'neutral';

export interface ToastMessage {
  id: number;
  title: string;
  body?: string;
  tone: ToastTone;
}

interface ToastState {
  toasts: ToastMessage[];
  show: (toast: Omit<ToastMessage, 'id'>) => void;
  dismiss: (id: number) => void;
}

let nextId = 1;

/** Brief confirmations that outlive the page that raised them (e.g. "Signed in"). */
export const useToastStore = create<ToastState>()((set) => ({
  toasts: [],
  show: (toast) => set((s) => ({ toasts: [...s.toasts, { ...toast, id: nextId++ }] })),
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}));

export const showToast = (toast: Omit<ToastMessage, 'id'>) => useToastStore.getState().show(toast);
