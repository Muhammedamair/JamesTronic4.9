import { create } from 'zustand';
import { Ticket } from '@/lib/types/ticket';

// Define the technician store state
interface TechnicianState {
  tickets: Ticket[];
  activeTab: string;
  loading: boolean;
  error: string | null;
  selectedTicket: Ticket | null;
}

// Define the technician store actions
interface TechnicianActions {
  setTickets: (tickets: Ticket[]) => void;
  setActiveTab: (tab: string) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
  setSelectedTicket: (ticket: Ticket | null) => void;
  initializeStore: (initialTickets: Ticket[], initialTab?: string) => void;
}

// Define the store type as a combination of state and actions
type TechnicianStore = TechnicianState & TechnicianActions;

// Create and export the store
export const useTechnicianStore = create<TechnicianStore>((set) => ({
  tickets: [],
  activeTab: 'upcoming',
  loading: false,
  error: null,
  selectedTicket: null,
  setTickets: (tickets) => set({ tickets }),
  setActiveTab: (activeTab) => set({ activeTab }),
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
  setSelectedTicket: (ticket) => set({ selectedTicket: ticket }),
  initializeStore: (initialTickets, initialTab = 'upcoming') => set({ tickets: initialTickets, activeTab: initialTab }),
}));