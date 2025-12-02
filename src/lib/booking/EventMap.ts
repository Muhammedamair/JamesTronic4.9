/**
 * EventMap.ts
 *
 * Conversion Telemetry Events for JamesTronic's
 * Booking Control & Conversion Layer (Phase C8.7)
 *
 * Defines all events emitted during the booking conversion pipeline
 */

export enum BookingEvent {
  // Booking flow events
  BOOKING_STARTED = 'booking_started',
  BOOKING_VALIDATED = 'booking_validated',
  TECHNICIAN_MATCHED = 'technician_matched',
  TECHNICIAN_ASSIGNED = 'technician_assigned',
  TECHNICIAN_ACCEPTED = 'technician_accepted',
  BOOKING_CONFIRMED = 'booking_confirmed',
  PAYMENT_PENDING = 'payment_pending',
  BOOKING_COMPLETED = 'booking_completed',
  BOOKING_CANCELLED = 'booking_cancelled',
  BOOKING_FAILED = 'booking_failed',

  // Trust and conversion events
  TRUST_INJECTION = 'trust_injection',
  HESITATION_DETECTED = 'hesitation_detected',
  SLA_WARNING = 'sla_warning',
  PRICE_ACCEPTED = 'price_accepted',
  CONFIDENCE_DROP = 'confidence_drop',
  CONFIDENCE_RECOVERY = 'confidence_recovery',

  // Risk and detection events
  RISK_TRIGGERS_DETECTED = 'risk_triggers_detected',
  DROP_OFF_DETECTED = 'drop_off_detected',
  SESSION_TIMEOUT = 'session_timeout',
  USER_ABANDON = 'user_abandon',
  BOUNCED_BOOKING = 'bounced_booking',

  // Customer interaction events
  CUSTOMER_CONTACT_INITIATED = 'customer_contact_initiated',
  CUSTOMER_CONTACT_COMPLETED = 'customer_contact_completed',
  CUSTOMER_FEEDBACK_SUBMITTED = 'customer_feedback_submitted',
  CUSTOMER_REASSURANCE_REQUESTED = 'customer_reassurance_requested',

  // System events
  SYSTEM_NOTIFICATION_SENT = 'system_notification_sent',
  PUSH_NOTIFICATION_SENT = 'push_notification_sent',
  SMS_NOTIFICATION_SENT = 'sms_notification_sent',
  EMAIL_NOTIFICATION_SENT = 'email_notification_sent',

  // Conversion optimization events
  CONVERSION_OPTIMIZATION_TRIGGERED = 'conversion_optimization_triggered',
  A_B_TEST_IMPRESSION = 'a_b_test_impression',
  A_B_TEST_CONVERSION = 'a_b_test_conversion',
  CONVERSION_OPTIMIZATION_FAILED = 'conversion_optimization_failed',
}

export interface BookingEventPayload {
  // Base properties for all events
  timestamp: Date;
  bookingId?: string;
  customerId?: string;
  userId?: string;
  sessionId?: string;
  pageUrl?: string;
  userAgent?: string;

  // Event-specific properties
  [key: string]: any;
}

export interface BookingTelemetryEvent {
  type: BookingEvent;
  payload: BookingEventPayload;
  metadata: {
    eventId: string;
    timestamp: Date;
    source: 'customer' | 'system' | 'technician' | 'admin';
    importance: 'low' | 'medium' | 'high' | 'critical';
    context: string; // Additional context for debugging
  };
}

// Event mapping for different importance levels
export const EVENT_IMPORTANCE: Record<BookingEvent, 'low' | 'medium' | 'high' | 'critical'> = {
  [BookingEvent.BOOKING_STARTED]: 'medium',
  [BookingEvent.BOOKING_VALIDATED]: 'low',
  [BookingEvent.TECHNICIAN_MATCHED]: 'medium',
  [BookingEvent.TECHNICIAN_ASSIGNED]: 'high',
  [BookingEvent.TECHNICIAN_ACCEPTED]: 'high',
  [BookingEvent.BOOKING_CONFIRMED]: 'critical',
  [BookingEvent.PAYMENT_PENDING]: 'high',
  [BookingEvent.BOOKING_COMPLETED]: 'critical',
  [BookingEvent.BOOKING_CANCELLED]: 'high',
  [BookingEvent.BOOKING_FAILED]: 'critical',

  [BookingEvent.TRUST_INJECTION]: 'medium',
  [BookingEvent.HESITATION_DETECTED]: 'high',
  [BookingEvent.SLA_WARNING]: 'high',
  [BookingEvent.PRICE_ACCEPTED]: 'medium',
  [BookingEvent.CONFIDENCE_DROP]: 'high',
  [BookingEvent.CONFIDENCE_RECOVERY]: 'medium',

  [BookingEvent.RISK_TRIGGERS_DETECTED]: 'high',
  [BookingEvent.DROP_OFF_DETECTED]: 'high',
  [BookingEvent.SESSION_TIMEOUT]: 'medium',
  [BookingEvent.USER_ABANDON]: 'high',
  [BookingEvent.BOUNCED_BOOKING]: 'high',

  [BookingEvent.CUSTOMER_CONTACT_INITIATED]: 'medium',
  [BookingEvent.CUSTOMER_CONTACT_COMPLETED]: 'low',
  [BookingEvent.CUSTOMER_FEEDBACK_SUBMITTED]: 'medium',
  [BookingEvent.CUSTOMER_REASSURANCE_REQUESTED]: 'high',

  [BookingEvent.SYSTEM_NOTIFICATION_SENT]: 'low',
  [BookingEvent.PUSH_NOTIFICATION_SENT]: 'low',
  [BookingEvent.SMS_NOTIFICATION_SENT]: 'medium',
  [BookingEvent.EMAIL_NOTIFICATION_SENT]: 'low',

  [BookingEvent.CONVERSION_OPTIMIZATION_TRIGGERED]: 'medium',
  [BookingEvent.A_B_TEST_IMPRESSION]: 'low',
  [BookingEvent.A_B_TEST_CONVERSION]: 'medium',
  [BookingEvent.CONVERSION_OPTIMIZATION_FAILED]: 'high',
};

// Event categories for easier filtering and analysis
export const EVENT_CATEGORIES = {
  BOOKING_FLOW: [
    BookingEvent.BOOKING_STARTED,
    BookingEvent.BOOKING_VALIDATED,
    BookingEvent.TECHNICIAN_MATCHED,
    BookingEvent.TECHNICIAN_ASSIGNED,
    BookingEvent.TECHNICIAN_ACCEPTED,
    BookingEvent.BOOKING_CONFIRMED,
    BookingEvent.PAYMENT_PENDING,
    BookingEvent.BOOKING_COMPLETED,
    BookingEvent.BOOKING_CANCELLED,
    BookingEvent.BOOKING_FAILED,
  ],
  CONVERSION_OPTIMIZATION: [
    BookingEvent.HESITATION_DETECTED,
    BookingEvent.TRUST_INJECTION,
    BookingEvent.CONFIDENCE_DROP,
    BookingEvent.CONFIDENCE_RECOVERY,
    BookingEvent.SLA_WARNING,
    BookingEvent.PRICE_ACCEPTED,
    BookingEvent.RISK_TRIGGERS_DETECTED,
    BookingEvent.DROP_OFF_DETECTED,
    BookingEvent.BOUNCED_BOOKING,
    BookingEvent.USER_ABANDON,
    BookingEvent.SESSION_TIMEOUT,
    BookingEvent.CUSTOMER_REASSURANCE_REQUESTED,
    BookingEvent.CONVERSION_OPTIMIZATION_TRIGGERED,
    BookingEvent.A_B_TEST_IMPRESSION,
    BookingEvent.A_B_TEST_CONVERSION,
    BookingEvent.CONVERSION_OPTIMIZATION_FAILED,
  ],
  COMMUNICATION: [
    BookingEvent.CUSTOMER_CONTACT_INITIATED,
    BookingEvent.CUSTOMER_CONTACT_COMPLETED,
    BookingEvent.CUSTOMER_FEEDBACK_SUBMITTED,
    BookingEvent.SYSTEM_NOTIFICATION_SENT,
    BookingEvent.PUSH_NOTIFICATION_SENT,
    BookingEvent.SMS_NOTIFICATION_SENT,
    BookingEvent.EMAIL_NOTIFICATION_SENT,
  ],
};

// Event context descriptions for documentation
export const EVENT_DESCRIPTIONS: Record<BookingEvent, string> = {
  [BookingEvent.BOOKING_STARTED]: 'Customer initiates a booking',
  [BookingEvent.BOOKING_VALIDATED]: 'System validates booking inputs',
  [BookingEvent.TECHNICIAN_MATCHED]: 'Suitable technician found',
  [BookingEvent.TECHNICIAN_ASSIGNED]: 'Technician assigned to booking',
  [BookingEvent.TECHNICIAN_ACCEPTED]: 'Technician accepts the booking',
  [BookingEvent.BOOKING_CONFIRMED]: 'Booking confirmed by both parties',
  [BookingEvent.PAYMENT_PENDING]: 'Payment held in escrow',
  [BookingEvent.BOOKING_COMPLETED]: 'Service completed successfully',
  [BookingEvent.BOOKING_CANCELLED]: 'Booking cancelled by customer',
  [BookingEvent.BOOKING_FAILED]: 'Booking failed due to system issues',

  [BookingEvent.TRUST_INJECTION]: 'Trust message injected during booking',
  [BookingEvent.HESITATION_DETECTED]: 'Customer hesitation detected',
  [BookingEvent.SLA_WARNING]: 'SLA risk detected and warned',
  [BookingEvent.PRICE_ACCEPTED]: 'Customer accepts pricing',
  [BookingEvent.CONFIDENCE_DROP]: 'Customer confidence level drops',
  [BookingEvent.CONFIDENCE_RECOVERY]: 'Customer confidence level recovers',

  [BookingEvent.RISK_TRIGGERS_DETECTED]: 'Multiple risk triggers detected',
  [BookingEvent.DROP_OFF_DETECTED]: 'Customer abandons booking flow',
  [BookingEvent.SESSION_TIMEOUT]: 'Customer session times out',
  [BookingEvent.USER_ABANDON]: 'User abandons the booking process',
  [BookingEvent.BOUNCED_BOOKING]: 'Customer bounces from pricing pages',

  [BookingEvent.CUSTOMER_CONTACT_INITIATED]: 'Customer initiates contact',
  [BookingEvent.CUSTOMER_CONTACT_COMPLETED]: 'Customer contact completed',
  [BookingEvent.CUSTOMER_FEEDBACK_SUBMITTED]: 'Customer submits feedback',
  [BookingEvent.CUSTOMER_REASSURANCE_REQUESTED]: 'Customer requests reassurance',

  [BookingEvent.SYSTEM_NOTIFICATION_SENT]: 'System notification sent',
  [BookingEvent.PUSH_NOTIFICATION_SENT]: 'Push notification sent',
  [BookingEvent.SMS_NOTIFICATION_SENT]: 'SMS notification sent',
  [BookingEvent.EMAIL_NOTIFICATION_SENT]: 'Email notification sent',

  [BookingEvent.CONVERSION_OPTIMIZATION_TRIGGERED]: 'Conversion optimization triggered',
  [BookingEvent.A_B_TEST_IMPRESSION]: 'A/B test impression recorded',
  [BookingEvent.A_B_TEST_CONVERSION]: 'A/B test conversion recorded',
  [BookingEvent.CONVERSION_OPTIMIZATION_FAILED]: 'Conversion optimization failed',
};

/**
 * Creates a telemetry event with proper structure
 */
export function createBookingTelemetryEvent(
  type: BookingEvent,
  payload: BookingEventPayload,
  source: 'customer' | 'system' | 'technician' | 'admin' = 'customer'
): BookingTelemetryEvent {
  return {
    type,
    payload,
    metadata: {
      eventId: `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
      timestamp: new Date(),
      source,
      importance: EVENT_IMPORTANCE[type],
      context: `${type}_${Date.now()}`,
    },
  };
}

/**
 * Emits a booking event to all registered listeners
 */
export interface BookingEventEmitter {
  emit: (event: BookingTelemetryEvent) => void;
  subscribe: (callback: (event: BookingTelemetryEvent) => void) => () => void;
  getEventsForBooking: (bookingId: string) => BookingTelemetryEvent[];
}

/**
 * Default event emitter implementation
 */
export class BookingEventEmitterImpl implements BookingEventEmitter {
  private listeners: ((event: BookingTelemetryEvent) => void)[] = [];
  private eventLog: BookingTelemetryEvent[] = [];

  emit(event: BookingTelemetryEvent): void {
    // Store the event in the log
    this.eventLog.push(event);

    // Notify all listeners
    this.listeners.forEach(listener => listener(event));
  }

  subscribe(callback: (event: BookingTelemetryEvent) => void): () => void {
    this.listeners.push(callback);

    // Return unsubscribe function
    return () => {
      const index = this.listeners.indexOf(callback);
      if (index !== -1) {
        this.listeners.splice(index, 1);
      }
    };
  }

  getEventsForBooking(bookingId: string): BookingTelemetryEvent[] {
    return this.eventLog.filter(event => event.payload.bookingId === bookingId);
  }
}