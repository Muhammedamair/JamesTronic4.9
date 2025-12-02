/**
 * booking-control-integration.test.ts
 * 
 * Integration tests for the Booking Control & Conversion Layer (Phase C8.7)
 * Testing the integration between all booking control components
 */

import { BookingFlowEngine } from '@/lib/booking/BookingFlowEngine';
import { DropOffDetector } from '@/lib/booking/DropOffDetector';
import { BookingState } from '@/lib/booking/BookingStates';
import { BookingEvent } from '@/lib/booking/EventMap';
import { TrustInjectionResult } from '@/lib/booking/TrustTriggerMap';
import { ConversionHookResult } from '@/lib/booking/ConversionHooks';

describe('Booking Control & Conversion Layer Integration Tests', () => {
  let bookingFlowEngine: BookingFlowEngine;
  let dropOffDetector: DropOffDetector;

  beforeEach(() => {
    dropOffDetector = new DropOffDetector();
    bookingFlowEngine = new BookingFlowEngine({}, undefined, dropOffDetector);
  });

  afterEach(() => {
    // Cleanup if needed
  });

  test('should initialize booking flow and track state transitions', async () => {
    const bookingId = 'test-booking-1';
    const customerId = 'test-customer-1';
    const sessionId = 'test-session-1';

    // Initialize booking flow
    const initResult = await bookingFlowEngine.initializeBookingFlow(
      bookingId,
      customerId,
      sessionId,
      'mobile',
      'apple'
    );

    expect(initResult.success).toBe(true);
    expect(initResult.newState).toBe(BookingState.INITIATED);

    // Verify context was created
    const context = bookingFlowEngine.getBookingContext(bookingId);
    expect(context).toBeDefined();
    expect(context?.stateMachine.currentState).toBe(BookingState.INITIATED);

    // Transition to validating state
    const validateResult = await bookingFlowEngine.transitionBookingState(
      bookingId,
      BookingState.VALIDATING
    );

    expect(validateResult.success).toBe(true);
    expect(validateResult.newState).toBe(BookingState.VALIDATING);

    // Transition to technician match state
    const matchResult = await bookingFlowEngine.transitionBookingState(
      bookingId,
      BookingState.TECHNICIAN_MATCH
    );

    expect(matchResult.success).toBe(true);
    expect(matchResult.newState).toBe(BookingState.TECHNICIAN_MATCH);

    // Verify state progression in context
    const updatedContext = bookingFlowEngine.getBookingContext(bookingId);
    expect(updatedContext?.stateMachine.currentState).toBe(BookingState.TECHNICIAN_MATCH);
  });

  test('should detect and process customer hesitation with trust injection', async () => {
    const bookingId = 'test-booking-2';
    const customerId = 'test-customer-2';
    const sessionId = 'test-session-2';

    // Initialize booking flow
    await bookingFlowEngine.initializeBookingFlow(
      bookingId,
      customerId,
      sessionId,
      'laptop',
      'dell'
    );

    // Update customer confidence to low level to trigger trust injection
    const result = await bookingFlowEngine.updateCustomerConfidence(
      bookingId,
      35, // Low confidence
      ['price', 'sla'], // Hesitation points
      ['price_sensitivity'] // Risk factors
    );

    expect(result.success).toBe(true);
    expect(result.trustIntervention).toBeDefined();
    expect(result.trustIntervention?.shouldInject).toBe(true);
    expect(result.trustIntervention?.priority).toBe('high');

    // Check that trust intervention was recorded in context
    const context = bookingFlowEngine.getBookingContext(bookingId);
    expect(context?.trustHistory.length).toBeGreaterThan(0);
    expect(context?.detectedHesitationPoints).toContain('price');
    expect(context?.detectedHesitationPoints).toContain('sla');
  });

  test('should process conversion hooks for price hesitation', async () => {
    const bookingId = 'test-booking-3';
    const customerId = 'test-customer-3';
    const sessionId = 'test-session-3';

    // Initialize booking flow
    await bookingFlowEngine.initializeBookingFlow(
      bookingId,
      customerId,
      sessionId,
      'television',
      'lg'
    );

    // Update customer confidence with price hesitation
    const result = await bookingFlowEngine.updateCustomerConfidence(
      bookingId,
      45, // Medium-low confidence
      ['price'], // Price hesitation
      ['high_price_sensitivity'] // Risk factors
    );

    expect(result.success).toBe(true);
    expect(result.conversionHooks).toBeDefined();
    expect(result.conversionHooks?.length).toBeGreaterThan(0);

    // Check that at least one conversion hook addressed price hesitation
    const priceHooks = result.conversionHooks?.filter(hook => 
      hook.actionType === 'reassurance' && 
      hook.message?.toLowerCase().includes('price')
    );
    expect(priceHooks?.length).toBeGreaterThan(0);
  });

  test('should record page views and trigger trust based on view context', async () => {
    const bookingId = 'test-booking-4';
    const customerId = 'test-customer-4';
    const sessionId = 'test-session-4';

    // Initialize booking flow
    await bookingFlowEngine.initializeBookingFlow(
      bookingId,
      customerId,
      sessionId,
      'mobile',
      'samsung'
    );

    // Record a page view in the technician assignment view
    const result = await bookingFlowEngine.recordPageView(
      bookingId,
      '/app/technician-assignment',
      'technician-assignment'
    );

    expect(result.success).toBe(true);
    
    // Verify that trust injection could happen based on the view
    expect(result.trustIntervention).toBeDefined();
  });

  test('should detect and record drop-off events', async () => {
    const bookingId = 'test-booking-5';
    const customerId = 'test-customer-5';
    const sessionId = 'test-session-5';

    // Initialize session in drop-off detector
    dropOffDetector.startSession(sessionId, BookingState.INITIATED);

    // Record several pricing page visits to trigger bounce detection
    dropOffDetector.recordPageVisit(
      sessionId,
      '/app/create/checkout',
      BookingState.INITIATED,
      75
    );
    dropOffDetector.recordPageVisit(
      sessionId,
      '/app/create/checkout',
      BookingState.INITIATED,
      65
    );
    dropOffDetector.recordPageVisit(
      sessionId,
      '/app/create/checkout',
      BookingState.INITIATED,
      55
    );

    // Check for bounce detection
    const detectionResult = dropOffDetector.checkDropOff(sessionId);
    
    expect(detectionResult.isDropOffDetected).toBe(true);
    expect(detectionResult.type).toBe('bounce_attempt');
    expect(detectionResult.riskLevel).toBe('medium');
  });

  test('should complete booking flow successfully', async () => {
    const bookingId = 'test-booking-6';
    const customerId = 'test-customer-6';
    const sessionId = 'test-session-6';

    // Initialize booking flow
    await bookingFlowEngine.initializeBookingFlow(
      bookingId,
      customerId,
      sessionId,
      'laptop',
      'hp'
    );

    // Progress through states
    await bookingFlowEngine.transitionBookingState(bookingId, BookingState.VALIDATING);
    await bookingFlowEngine.transitionBookingState(bookingId, BookingState.TECHNICIAN_MATCH);
    await bookingFlowEngine.transitionBookingState(bookingId, BookingState.ASSIGNED);
    await bookingFlowEngine.transitionBookingState(bookingId, BookingState.ACCEPTED);
    await bookingFlowEngine.transitionBookingState(bookingId, BookingState.CONFIRMED);
    await bookingFlowEngine.transitionBookingState(bookingId, BookingState.ESCROW_PENDING);
    
    // Complete the booking
    const result = await bookingFlowEngine.completeBookingFlow(bookingId);

    expect(result.success).toBe(true);

    // Verify final state
    const context = bookingFlowEngine.getBookingContext(bookingId);
    expect(context?.stateMachine.currentState).toBe(BookingState.COMPLETED);
    
    // Verify completion events were recorded
    const events = bookingFlowEngine.getBookingTelemetryEvents(bookingId);
    const completionEvents = events.filter(event => 
      event.type === BookingEvent.BOOKING_COMPLETED
    );
    expect(completionEvents.length).toBe(1);
  });

  test('should track risk level changes throughout booking flow', async () => {
    const bookingId = 'test-booking-7';
    const customerId = 'test-customer-7';
    const sessionId = 'test-session-7';

    // Initialize booking flow
    await bookingFlowEngine.initializeBookingFlow(
      bookingId,
      customerId,
      sessionId,
      'mobile',
      'apple'
    );

    // Get initial risk level
    let riskLevel = bookingFlowEngine.getBookingRiskLevel(bookingId);
    expect(riskLevel).toBe('low'); // INITIATED state has low risk

    // Transition to technician match state (should be high risk)
    await bookingFlowEngine.transitionBookingState(bookingId, BookingState.TECHNICIAN_MATCH);
    riskLevel = bookingFlowEngine.getBookingRiskLevel(bookingId);
    expect(riskLevel).toBe('high'); // TECHNICIAN_MATCH is high risk

    // Transition to assigned state (should be medium risk)
    await bookingFlowEngine.transitionBookingState(bookingId, BookingState.ASSIGNED);
    riskLevel = bookingFlowEngine.getBookingRiskLevel(bookingId);
    expect(riskLevel).toBe('medium'); // ASSIGNED is medium risk

    // Transition to confirmed state (should be low risk)
    await bookingFlowEngine.transitionBookingState(bookingId, BookingState.CONFIRMED);
    riskLevel = bookingFlowEngine.getBookingRiskLevel(bookingId);
    expect(riskLevel).toBe('low'); // CONFIRMED is low risk
  });

  test('should handle multiple concurrent bookings', async () => {
    const bookingsData = [
      { id: 'booking-101', customer: 'customer-101', session: 'session-101' },
      { id: 'booking-102', customer: 'customer-102', session: 'session-102' },
      { id: 'booking-103', customer: 'customer-103', session: 'session-103' },
    ];

    // Initialize multiple bookings concurrently
    const initPromises = bookingsData.map(data => 
      bookingFlowEngine.initializeBookingFlow(
        data.id,
        data.customer,
        data.session,
        'mobile',
        'apple'
      )
    );

    const initResults = await Promise.all(initPromises);
    expect(initResults.every(result => result.success)).toBe(true);

    // Update confidence for each booking with different hesitation points
    const confidencePromises = bookingsData.map((data, index) => 
      bookingFlowEngine.updateCustomerConfidence(
        data.id,
        60 - (index * 10), // 60, 50, 40
        index % 2 === 0 ? ['price'] : ['sla'], // Alternate hesitation points
        ['test-risk']
      )
    );

    const confidenceResults = await Promise.all(confidencePromises);
    expect(confidenceResults.every(result => result.success)).toBe(true);

    // Verify each booking has its own context and data
    for (const data of bookingsData) {
      const context = bookingFlowEngine.getBookingContext(data.id);
      expect(context).toBeDefined();
      expect(context?.bookingId).toBe(data.id);
      expect(context?.customerId).toBe(data.customer);
    }
  });
});