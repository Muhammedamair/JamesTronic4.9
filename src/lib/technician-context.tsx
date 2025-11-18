import { createContext, useContext, useReducer, ReactNode } from 'react';
import { Ticket } from '@/lib/supabase';

// Define the state type
interface TechnicianState {
  tickets: Ticket[];
  selectedTicket: Ticket | null;
  activeTab: 'upcoming' | 'in-progress' | 'completed' | 'cancelled' | 'paused';
  loading: boolean;
  error: string | null;
}

// Define the actions type
type TechnicianAction =
  | { type: 'SET_TICKETS'; payload: Ticket[] }
  | { type: 'SET_SELECTED_TICKET'; payload: Ticket | null }
  | { type: 'SET_ACTIVE_TAB'; payload: 'upcoming' | 'in-progress' | 'completed' | 'cancelled' | 'paused' }
  | { type: 'SET_LOADING'; payload: boolean }
  | { type: 'SET_ERROR'; payload: string | null }
  | { type: 'UPDATE_TICKET_STATUS'; payload: { id: string; status: string } }
  | { type: 'ADD_TICKET'; payload: Ticket }
  | { type: 'REMOVE_TICKET'; payload: string };

// Initial state
const initialState: TechnicianState = {
  tickets: [],
  selectedTicket: null,
  activeTab: 'upcoming',
  loading: false,
  error: null,
};

// Reducer function
const technicianReducer = (state: TechnicianState, action: TechnicianAction): TechnicianState => {
  switch (action.type) {
    case 'SET_TICKETS':
      return { ...state, tickets: action.payload };
    case 'SET_SELECTED_TICKET':
      return { ...state, selectedTicket: action.payload };
    case 'SET_ACTIVE_TAB':
      return { ...state, activeTab: action.payload };
    case 'SET_LOADING':
      return { ...state, loading: action.payload };
    case 'SET_ERROR':
      return { ...state, error: action.payload };
    case 'UPDATE_TICKET_STATUS':
      return {
        ...state,
        tickets: state.tickets.map(ticket =>
          ticket.id === action.payload.id ? { ...ticket, status: action.payload.status } : ticket
        ),
      };
    case 'ADD_TICKET':
      return { ...state, tickets: [...state.tickets, action.payload] };
    case 'REMOVE_TICKET':
      return { ...state, tickets: state.tickets.filter(ticket => ticket.id !== action.payload) };
    default:
      return state;
  }
};

// Create the context
const TechnicianContext = createContext<{
  state: TechnicianState;
  dispatch: React.Dispatch<TechnicianAction>;
}>({
  state: initialState,
  dispatch: () => {},
});

// Provider component
export const TechnicianProvider = ({ children }: { children: ReactNode }) => {
  const [state, dispatch] = useReducer(technicianReducer, initialState);

  return (
    <TechnicianContext.Provider value={{ state, dispatch }}>
      {children}
    </TechnicianContext.Provider>
  );
};

// Custom hook to use the technician context
export const useTechnicianStore = () => {
  const context = useContext(TechnicianContext);
  if (!context) {
    throw new Error('useTechnicianStore must be used within a TechnicianProvider');
  }
  return context;
};