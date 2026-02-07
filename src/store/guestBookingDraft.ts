import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface GuestBookingDraft {
  category: string | null;
  serviceId: string | null;
  serviceSlug: string | null;
  issues: string[];
  address: {
    street: string;
    city: string;
    state: string;
    pincode: string;
  } | null;
  timeSlot: {
    date: string;
    time: string;
  } | null;
  pricing: {
    basePrice: number;
    tax: number;
    total: number;
  } | null;
  createdAt: string;
}

interface GuestBookingDraftState {
  draft: GuestBookingDraft | null;
  setDraft: (draft: GuestBookingDraft) => void;
  updateDraft: (updates: Partial<GuestBookingDraft>) => void;
  clearDraft: () => void;
  hydrateDraft: () => GuestBookingDraft | null;
  expireDraftIfNeeded: () => void;
}

export const useGuestBookingDraft = create<GuestBookingDraftState>()(
  persist(
    (set, get) => ({
      draft: null,
      setDraft: (draft) => set({ draft }),
      updateDraft: (updates) => {
        const currentDraft = get().draft;
        if (!currentDraft) {
          set({ draft: { ...initialDraft, ...updates } });
          return;
        }
        set({ draft: { ...currentDraft, ...updates } });
      },
      clearDraft: () => set({ draft: null }),
      hydrateDraft: () => get().draft,
      expireDraftIfNeeded: () => {
        const draft = get().draft;
        if (!draft) return;
        
        const createdAt = new Date(draft.createdAt).getTime();
        const now = new Date().getTime();
        const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
        
        if (now - createdAt > oneDay) {
          set({ draft: null });
        }
      },
    }),
    {
      name: 'guest-booking-draft-storage',
      storage: createJSONStorage(() => localStorage),
      onRehydrateStorage: () => {
        return (state) => {
          if (state) {
            // Expire draft if needed when rehydrating
            setTimeout(() => {
              if (state) {
                const createdAt = new Date(state.draft?.createdAt || '').getTime();
                const now = new Date().getTime();
                const oneDay = 24 * 60 * 60 * 1000; // 24 hours in milliseconds
                
                if (state.draft && (now - createdAt > oneDay)) {
                  state.clearDraft();
                }
              }
            }, 0);
          }
        };
      },
    }
  )
);

const initialDraft: GuestBookingDraft = {
  category: null,
  serviceId: null,
  serviceSlug: null,
  issues: [],
  address: null,
  timeSlot: null,
  pricing: null,
  createdAt: new Date().toISOString(),
};