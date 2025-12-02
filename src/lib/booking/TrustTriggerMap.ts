/**
 * TrustTriggerMap.ts
 * 
 * Trust Injection Points for JamesTronic's
 * Booking Control & Conversion Layer (Phase C8.7)
 * 
 * Defines where and when trust messages are injected during booking
 */

import { BookingState } from './BookingStates';

export enum TrustInjectionPoint {
  // Booking flow injection points
  CHECKOUT = 'checkout',
  TECHNICIAN_ASSIGNMENT = 'technician_assignment',
  PART_UNAVAILABILITY = 'part_unavailability',
  PRICE_CONFIRMATION = 'price_confirmation',
  SLA_VIEW = 'sla_view',
  
  // Risk moment injection points
  PRICE_HESITATION = 'price_hesitation',
  SLA_AMBIGUITY = 'sla_ambiguity',
  TECHNICIAN_UNCERTAINTY = 'technician_uncertainty',
  DELAY_FEARS = 'delay_fears',
  PAYMENT_UNCERTAINTY = 'payment_uncertainty',
  
  // General injection points
  BOOKING_STARTED = 'booking_started',
  BOOKING_VALIDATION = 'booking_validation',
  CONFIDENCE_DROP = 'confidence_drop',
  SESSION_RESTART = 'session_restart',
  CONTACT_INITIATION = 'contact_initiation',
}

export interface TrustTrigger {
  point: TrustInjectionPoint;
  condition: (context: TrustInjectionContext) => boolean;
  message: string;
  priority: 'low' | 'medium' | 'high';
  type: 'reassurance' | 'transparency' | 'confidence' | 'urgency';
}

export interface TrustInjectionContext {
  bookingState: BookingState;
  customerConfidence: number; // 0-100 scale
  hesitationTriggers: string[];
  currentView: string; // Current page or component
  timeInState: number; // Time spent in current state (ms)
  bookingId?: string;
  customerId?: string;
  riskFactors: string[];
  slaStatus?: string;
  pricePerceived?: 'high' | 'fair' | 'low';
  technicianCertainty?: number; // 0-100 scale
  partAvailability?: boolean;
}

export interface TrustInjectionResult {
  shouldInject: boolean;
  message: string;
  priority: 'low' | 'medium' | 'high';
  type: 'reassurance' | 'transparency' | 'confidence' | 'urgency';
  injectedAt: Date;
}

// Define trust triggers for different injection points
export const TRUST_TRIGGERS: TrustTrigger[] = [
  // Checkout-specific triggers
  {
    point: TrustInjectionPoint.CHECKOUT,
    condition: (ctx) => ctx.customerConfidence < 60,
    message: "Your repair is important to us. We'll provide updates every step of the way.",
    priority: 'high',
    type: 'reassurance'
  },
  {
    point: TrustInjectionPoint.CHECKOUT,
    condition: (ctx) => ctx.hesitationTriggers.includes('price'),
    message: "Transparent pricing with no hidden fees. Your cost is fixed once confirmed.",
    priority: 'high',
    type: 'transparency'
  },
  
  // Technician assignment triggers
  {
    point: TrustInjectionPoint.TECHNICIAN_ASSIGNMENT,
    condition: (ctx) => ctx.technicianCertainty !== undefined && ctx.technicianCertainty < 70,
    message: "We're assigning your preferred technician. If they're unavailable, we'll get the next best match.",
    priority: 'medium',
    type: 'reassurance'
  },
  {
    point: TrustInjectionPoint.TECHNICIAN_ASSIGNMENT,
    condition: (ctx) => ctx.customerConfidence < 50,
    message: "Your technician is verified and experienced. We'll handle any issues that arise.",
    priority: 'high',
    type: 'confidence'
  },
  
  // Part unavailability triggers
  {
    point: TrustInjectionPoint.PART_UNAVAILABILITY,
    condition: (ctx) => ctx.partAvailability === false,
    message: "We're checking for this part at our partners. We'll notify you within 2 hours.",
    priority: 'high',
    type: 'transparency'
  },
  {
    point: TrustInjectionPoint.PART_UNAVAILABILITY,
    condition: (ctx) => ctx.customerConfidence < 40,
    message: "If we can't source the part, you'll get a full refund. No risk to you.",
    priority: 'high',
    type: 'reassurance'
  },
  
  // Price confirmation triggers
  {
    point: TrustInjectionPoint.PRICE_CONFIRMATION,
    condition: (ctx) => ctx.pricePerceived === 'high',
    message: "Our prices are competitive and include a guarantee. You're paying for quality and assurance.",
    priority: 'medium',
    type: 'confidence'
  },
  {
    point: TrustInjectionPoint.PRICE_CONFIRMATION,
    condition: (ctx) => ctx.customerConfidence < 55,
    message: "Price is fixed once confirmed. You'll only pay what you see here.",
    priority: 'high',
    type: 'transparency'
  },
  
  // SLA view triggers
  {
    point: TrustInjectionPoint.SLA_VIEW,
    condition: (ctx) => ctx.slaStatus === 'breached',
    message: "We're working quickly to resolve this. We'll update you regularly on progress.",
    priority: 'high',
    type: 'reassurance'
  },
  {
    point: TrustInjectionPoint.SLA_VIEW,
    condition: (ctx) => ctx.customerConfidence < 50,
    message: "Our SLA is backed by our reputation. We'll make it right if we're late.",
    priority: 'medium',
    type: 'confidence'
  },
  
  // Risk moment triggers
  {
    point: TrustInjectionPoint.PRICE_HESITATION,
    condition: (ctx) => ctx.hesitationTriggers.includes('price'),
    message: "We value your trust. Our pricing is transparent with no surprise charges.",
    priority: 'high',
    type: 'transparency'
  },
  {
    point: TrustInjectionPoint.SLA_AMBIGUITY,
    condition: (ctx) => !ctx.slaStatus,
    message: "We'll provide clear updates on your timeline. No uncertainty about your repair date.",
    priority: 'medium',
    type: 'transparency'
  },
  {
    point: TrustInjectionPoint.TECHNICIAN_UNCERTAINTY,
    condition: (ctx) => ctx.technicianCertainty !== undefined && ctx.technicianCertainty < 60,
    message: "We're securing the best technician for your device. You'll be the first to know.",
    priority: 'high',
    type: 'reassurance'
  },
  {
    point: TrustInjectionPoint.DELAY_FEARS,
    condition: (ctx) => ctx.hesitationTriggers.includes('delay'),
    message: "Delays are rare, but we'll contact you immediately if anything changes.",
    priority: 'high',
    type: 'reassurance'
  },
  {
    point: TrustInjectionPoint.PAYMENT_UNCERTAINTY,
    condition: (ctx) => ctx.hesitationTriggers.includes('payment'),
    message: "Your payment is held securely until completion. Cancel anytime before work starts.",
    priority: 'high',
    type: 'transparency'
  },
  
  // General triggers
  {
    point: TrustInjectionPoint.BOOKING_STARTED,
    condition: (ctx) => ctx.customerConfidence < 45,
    message: "We're committed to your satisfaction. Your repair is our top priority.",
    priority: 'medium',
    type: 'confidence'
  },
  {
    point: TrustInjectionPoint.BOOKING_VALIDATION,
    condition: (ctx) => ctx.riskFactors.length > 0,
    message: "We're verifying everything to ensure a smooth process. You'll be updated immediately.",
    priority: 'medium',
    type: 'transparency'
  },
  {
    point: TrustInjectionPoint.CONFIDENCE_DROP,
    condition: (ctx) => ctx.customerConfidence < 40,
    message: "We understand your concerns. We're here to address any questions throughout.",
    priority: 'high',
    type: 'reassurance'
  },
  {
    point: TrustInjectionPoint.SESSION_RESTART,
    condition: (ctx) => ctx.customerConfidence < 50,
    message: "Welcome back! Your booking progress is saved. Continue where you left off.",
    priority: 'medium',
    type: 'reassurance'
  },
  {
    point: TrustInjectionPoint.CONTACT_INITIATION,
    condition: (ctx) => ctx.customerConfidence < 55,
    message: "We're here to help. Ask us anything about your repair or our process.",
    priority: 'medium',
    type: 'reassurance'
  },
];

// Mapping of booking states to relevant trust injection points
export const STATE_TRUST_MAPPINGS: Record<BookingState, TrustInjectionPoint[]> = {
  [BookingState.INITIATED]: [
    TrustInjectionPoint.BOOKING_STARTED,
    TrustInjectionPoint.BOOKING_VALIDATION,
    TrustInjectionPoint.CONTACT_INITIATION
  ],
  [BookingState.VALIDATING]: [
    TrustInjectionPoint.BOOKING_VALIDATION,
    TrustInjectionPoint.SLA_AMBIGUITY,
    TrustInjectionPoint.PAYMENT_UNCERTAINTY
  ],
  [BookingState.TECHNICIAN_MATCH]: [
    TrustInjectionPoint.TECHNICIAN_UNCERTAINTY,
    TrustInjectionPoint.TECHNICIAN_ASSIGNMENT,
    TrustInjectionPoint.DELAY_FEARS
  ],
  [BookingState.ASSIGNED]: [
    TrustInjectionPoint.TECHNICIAN_ASSIGNMENT,
    TrustInjectionPoint.CONFIDENCE_DROP
  ],
  [BookingState.ACCEPTED]: [
    TrustInjectionPoint.CONFIDENCE_DROP,
    TrustInjectionPoint.SLA_VIEW
  ],
  [BookingState.CONFIRMED]: [
    TrustInjectionPoint.PRICE_CONFIRMATION,
    TrustInjectionPoint.SLA_VIEW,
    TrustInjectionPoint.CONTACT_INITIATION
  ],
  [BookingState.ESCROW_PENDING]: [
    TrustInjectionPoint.PAYMENT_UNCERTAINTY,
    TrustInjectionPoint.CONFIDENCE_DROP
  ],
  [BookingState.COMPLETED]: [
    TrustInjectionPoint.CONTACT_INITIATION,
    TrustInjectionPoint.CONFIDENCE_DROP
  ],
  [BookingState.CANCELLED]: [
    TrustInjectionPoint.CONFIDENCE_DROP,
    TrustInjectionPoint.CONTACT_INITIATION
  ],
  [BookingState.FAILED]: [
    TrustInjectionPoint.CONFIDENCE_DROP,
    TrustInjectionPoint.CONTACT_INITIATION
  ],
};

/**
 * Checks if trust injection is needed based on context
 */
export function shouldInjectTrust(context: TrustInjectionContext): TrustInjectionResult | null {
  // Find all applicable triggers for the current context
  const applicableTriggers = TRUST_TRIGGERS.filter(trigger => {
    // Check if the trigger matches the current injection point
    const matchesPoint = trigger.point === context.currentView as TrustInjectionPoint;
    
    // Check if the trigger condition is met
    const meetsCondition = trigger.condition(context);
    
    return matchesPoint && meetsCondition;
  });

  if (applicableTriggers.length === 0) {
    return null;
  }

  // Sort by priority to get the most important trigger
  const sortedTriggers = applicableTriggers.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });

  // Return the highest priority trigger
  const selectedTrigger = sortedTriggers[0];
  
  return {
    shouldInject: true,
    message: selectedTrigger.message,
    priority: selectedTrigger.priority,
    type: selectedTrigger.type,
    injectedAt: new Date(),
  };
}

/**
 * Gets relevant trust injection points for a booking state
 */
export function getTrustInjectionPointsForState(state: BookingState): TrustInjectionPoint[] {
  return STATE_TRUST_MAPPINGS[state] || [];
}

/**
 * Generates context-aware trust messages
 */
export function generateContextualTrustMessage(
  context: TrustInjectionContext,
  customParams?: Record<string, any>
): string | null {
  // Get applicable triggers for the current state
  const stateTriggers = getTrustInjectionPointsForState(context.bookingState);
  
  // Find triggers relevant to the current state and context
  const relevantTriggers = TRUST_TRIGGERS.filter(trigger => 
    stateTriggers.includes(trigger.point) && trigger.condition(context)
  );
  
  if (relevantTriggers.length === 0) {
    return null;
  }
  
  // Sort by priority
  const sortedTriggers = relevantTriggers.sort((a, b) => {
    const priorityOrder = { high: 3, medium: 2, low: 1 };
    return priorityOrder[b.priority] - priorityOrder[a.priority];
  });
  
  // Return the message from the highest priority trigger
  return sortedTriggers[0].message;
}