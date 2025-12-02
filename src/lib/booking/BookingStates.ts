/**
 * BookingStates.ts
 * 
 * Defines the complete booking state machine for JamesTronic's
 * Booking Control & Conversion Layer (Phase C8.7)
 * 
 * The booking state machine governs the customer journey from
 * initial booking attempt to completed service confirmation
 */

export enum BookingState {
  INITIATED = 'initiated',           // Customer begins booking flow
  VALIDATING = 'validating',         // System validates inputs, checks availability
  TECHNICIAN_MATCH = 'technician-match', // Finding suitable technician
  ASSIGNED = 'assigned',             // Technician assigned but not confirmed
  ACCEPTED = 'accepted',             // Technician accepted the booking
  CONFIRMED = 'confirmed',           // Booking confirmed by both parties
  ESCROW_PENDING = 'escrow-pending', // Payment held in escrow
  COMPLETED = 'completed',           // Service completed and payment released
  CANCELLED = 'cancelled',           // Booking cancelled (terminal state)
  FAILED = 'failed',                 // Booking failed (terminal state)
}

export interface BookingStateTransition {
  from: BookingState;
  to: BookingState;
  reason?: string;  // Reason for the transition (for telemetry)
  timestamp: Date;
}

export interface BookingStateMachine {
  currentState: BookingState;
  previousState?: BookingState;
  stateHistory: BookingStateTransition[];
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Defines valid state transitions for the booking process
 * This ensures state transitions follow the intended flow
 */
export const VALID_TRANSITIONS: Record<BookingState, BookingState[]> = {
  [BookingState.INITIATED]: [
    BookingState.VALIDATING,
    BookingState.CANCELLED,
    BookingState.FAILED
  ],
  [BookingState.VALIDATING]: [
    BookingState.TECHNICIAN_MATCH,
    BookingState.CANCELLED,
    BookingState.FAILED
  ],
  [BookingState.TECHNICIAN_MATCH]: [
    BookingState.ASSIGNED,
    BookingState.CANCELLED,
    BookingState.FAILED
  ],
  [BookingState.ASSIGNED]: [
    BookingState.ACCEPTED,
    BookingState.TECHNICIAN_MATCH,  // If current technician unavailable
    BookingState.CANCELLED,
    BookingState.FAILED
  ],
  [BookingState.ACCEPTED]: [
    BookingState.CONFIRMED,
    BookingState.CANCELLED,
    BookingState.FAILED
  ],
  [BookingState.CONFIRMED]: [
    BookingState.ESCROW_PENDING,
    BookingState.CANCELLED,
    BookingState.FAILED
  ],
  [BookingState.ESCROW_PENDING]: [
    BookingState.COMPLETED,
    BookingState.CANCELLED,
    BookingState.FAILED
  ],
  [BookingState.COMPLETED]: [],
  [BookingState.CANCELLED]: [],
  [BookingState.FAILED]: [],
};

/**
 * State groups for business logic categorization
 */
export const STATE_GROUPS = {
  ACTIVE: [
    BookingState.INITIATED,
    BookingState.VALIDATING,
    BookingState.TECHNICIAN_MATCH,
    BookingState.ASSIGNED,
    BookingState.ACCEPTED,
    BookingState.CONFIRMED,
    BookingState.ESCROW_PENDING,
  ],
  TERMINAL: [
    BookingState.COMPLETED,
    BookingState.CANCELLED,
    BookingState.FAILED,
  ],
  RISK: [
    BookingState.TECHNICIAN_MATCH,
    BookingState.ASSIGNED,
    BookingState.VALIDATING,
  ],
  CONFIRMED: [
    BookingState.ACCEPTED,
    BookingState.CONFIRMED,
    BookingState.ESCROW_PENDING,
    BookingState.COMPLETED,
  ],
};

/**
 * Determines if a transition from one state to another is valid
 */
export function isValidTransition(
  fromState: BookingState,
  toState: BookingState
): boolean {
  return VALID_TRANSITIONS[fromState].includes(toState);
}

/**
 * Creates an initial booking state machine
 */
export function createInitialBookingStateMachine(): BookingStateMachine {
  return {
    currentState: BookingState.INITIATED,
    stateHistory: [],
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

/**
 * Updates the booking state machine with a new state
 * Returns null if the transition is invalid
 */
export function updateBookingState(
  machine: BookingStateMachine,
  newState: BookingState,
  reason?: string
): BookingStateMachine | null {
  if (!isValidTransition(machine.currentState, newState)) {
    console.warn(
      `Invalid booking state transition from ${machine.currentState} to ${newState}`,
      { context: machine }
    );
    return null;
  }

  const transition: BookingStateTransition = {
    from: machine.currentState,
    to: newState,
    reason,
    timestamp: new Date(),
  };

  return {
    ...machine,
    previousState: machine.currentState,
    currentState: newState,
    stateHistory: [...machine.stateHistory, transition],
    updatedAt: new Date(),
  };
}

/**
 * Gets the current risk level based on booking state
 */
export function getBookingRiskLevel(state: BookingState): 'high' | 'medium' | 'low' {
  switch (state) {
    case BookingState.TECHNICIAN_MATCH:
    case BookingState.VALIDATING:
      return 'high';
    case BookingState.ASSIGNED:
    case BookingState.ACCEPTED:
      return 'medium';
    default:
      return 'low';
  }
}

/**
 * Checks if the booking is in a completed state
 */
export function isBookingCompleted(state: BookingState): boolean {
  return state === BookingState.COMPLETED;
}

/**
 * Checks if the booking is in a terminal state (completed, cancelled, or failed)
 */
export function isBookingTerminal(state: BookingState): boolean {
  return STATE_GROUPS.TERMINAL.includes(state);
}