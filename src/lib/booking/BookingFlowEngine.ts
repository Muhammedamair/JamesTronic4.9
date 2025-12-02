/**
 * BookingFlowEngine.ts
 * 
 * Main Orchestrator for JamesTronic's
 * Booking Control & Conversion Layer (Phase C8.7)
 * 
 * Coordinates all components of the booking conversion system
 */

import { 
  BookingState, 
  BookingStateMachine, 
  createInitialBookingStateMachine, 
  updateBookingState, 
  isBookingTerminal,
  getBookingRiskLevel
} from './BookingStates';
import { 
  BookingEvent, 
  BookingTelemetryEvent, 
  createBookingTelemetryEvent, 
  BookingEventEmitterImpl 
} from './EventMap';
import { 
  TrustInjectionPoint, 
  TrustInjectionContext, 
  TrustInjectionResult, 
  shouldInjectTrust, 
  generateContextualTrustMessage 
} from './TrustTriggerMap';
import { DropOffDetector } from './DropOffDetector';
import { 
  ConversionDecisionEngine, 
  ConversionDecisionContext, 
  ConversionHookResult 
} from './ConversionHooks';

export interface BookingFlowConfig {
  enableTelemetry: boolean;
  enableTrustInjection: boolean;
  enableDropOffDetection: boolean;
  enableConversionHooks: boolean;
  trustInjectionThreshold: number; // Confidence level below which trust is injected (0-100)
  dropOffTimeout: number; // Time in milliseconds before considering flow abandoned
}

export interface BookingFlowContext {
  bookingId: string;
  customerId: string;
  sessionId: string;
  stateMachine: BookingStateMachine;
  customerConfidence: number; // 0-100 scale
  currentView: string;
  telemetryEvents: BookingTelemetryEvent[];
  trustHistory: TrustInjectionResult[];
  conversionHookResults: ConversionHookResult[];
  detectedRiskFactors: string[];
  detectedHesitationPoints: string[];
  deviceType?: string;
  deviceBrand?: string;
  estimatedCost?: number;
  slaHours?: number;
  technicianCertainty?: number; // 0-100 scale
  partAvailability?: boolean;
}

export interface BookingFlowResult {
  success: boolean;
  newState?: BookingState;
  trustIntervention?: TrustInjectionResult;
  conversionHooks?: ConversionHookResult[];
  telemetryEvents?: BookingTelemetryEvent[];
  message?: string;
}

export class BookingFlowEngine {
  private config: BookingFlowConfig;
  private eventEmitter: BookingEventEmitterImpl;
  private dropOffDetector: DropOffDetector;
  private conversionEngine: ConversionDecisionEngine;
  private contexts: Map<string, BookingFlowContext>;
  
  constructor(
    config?: Partial<BookingFlowConfig>,
    eventEmitter?: BookingEventEmitterImpl,
    dropOffDetector?: DropOffDetector
  ) {
    this.config = {
      enableTelemetry: true,
      enableTrustInjection: true,
      enableDropOffDetection: true,
      enableConversionHooks: true,
      trustInjectionThreshold: 60, // Inject trust when confidence < 60
      dropOffTimeout: 5 * 60 * 1000, // 5 minutes
      ...config
    };
    
    this.eventEmitter = eventEmitter || new BookingEventEmitterImpl();
    this.dropOffDetector = dropOffDetector || new DropOffDetector();
    this.conversionEngine = new ConversionDecisionEngine(this.dropOffDetector);
    this.contexts = new Map();
  }
  
  /**
   * Initializes a new booking flow
   */
  async initializeBookingFlow(
    bookingId: string,
    customerId: string,
    sessionId: string,
    deviceType?: string,
    deviceBrand?: string
  ): Promise<BookingFlowResult> {
    // Create initial state machine
    const stateMachine = createInitialBookingStateMachine();
    
    // Create initial context
    const context: BookingFlowContext = {
      bookingId,
      customerId,
      sessionId,
      stateMachine,
      customerConfidence: 70, // Default confidence
      currentView: 'booking-start',
      telemetryEvents: [],
      trustHistory: [],
      conversionHookResults: [],
      detectedRiskFactors: [],
      detectedHesitationPoints: [],
      deviceType,
      deviceBrand,
    };
    
    // Store context
    this.contexts.set(bookingId, context);
    
    // Record event
    const event = createBookingTelemetryEvent(
      BookingEvent.BOOKING_STARTED,
      {
        timestamp: new Date(),
        bookingId,
        customerId,
        sessionId,
        deviceType,
        deviceBrand,
      },
      'customer'
    );
    
    if (this.config.enableTelemetry) {
      this.eventEmitter.emit(event);
      context.telemetryEvents.push(event);
    }
    
    // Start drop-off detection session
    if (this.config.enableDropOffDetection) {
      this.dropOffDetector.startSession(sessionId, stateMachine.currentState);
    }
    
    return {
      success: true,
      newState: stateMachine.currentState,
      telemetryEvents: [event],
      message: 'Booking flow initialized successfully'
    };
  }
  
  /**
   * Processes a booking state transition
   */
  async transitionBookingState(
    bookingId: string,
    newState: BookingState,
    reason?: string
  ): Promise<BookingFlowResult> {
    const context = this.contexts.get(bookingId);
    if (!context) {
      return {
        success: false,
        message: `Booking context not found for ID: ${bookingId}`
      };
    }
    
    // Attempt to update the state machine
    const updatedStateMachine = updateBookingState(context.stateMachine, newState, reason);
    if (!updatedStateMachine) {
      return {
        success: false,
        message: `Invalid state transition from ${context.stateMachine.currentState} to ${newState}`
      };
    }
    
    // Update context with new state
    context.stateMachine = updatedStateMachine;
    
    // Record telemetry event for state change
    const event = createBookingTelemetryEvent(
      this.getEventForState(newState),
      {
        timestamp: new Date(),
        bookingId: context.bookingId,
        customerId: context.customerId,
        sessionId: context.sessionId,
        fromState: context.stateMachine.previousState,
        toState: newState,
        reason,
      },
      'system'
    );
    
    if (this.config.enableTelemetry) {
      this.eventEmitter.emit(event);
      context.telemetryEvents.push(event);
    }
    
    // Update drop-off detector with new state
    if (this.config.enableDropOffDetection) {
      this.dropOffDetector.recordBookingStateChange(context.sessionId, newState);
    }
    
    // Process trust injection
    let trustIntervention: TrustInjectionResult | undefined;
    if (this.config.enableTrustInjection) {
      trustIntervention = await this.processTrustInjection(context);
    }
    
    // Process conversion opportunities
    let conversionHooks: ConversionHookResult[] | undefined;
    if (this.config.enableConversionHooks) {
      conversionHooks = await this.processConversionHooks(context);
    }
    
    // Update context
    this.contexts.set(bookingId, context);
    
    // Check for terminal state
    if (isBookingTerminal(newState)) {
      if (this.config.enableDropOffDetection) {
        this.dropOffDetector.markSessionComplete(context.sessionId);
      }
    }
    
    return {
      success: true,
      newState,
      trustIntervention,
      conversionHooks,
      telemetryEvents: [event],
      message: `Successfully transitioned to state: ${newState}`
    };
  }
  
  /**
   * Updates customer confidence level
   */
  async updateCustomerConfidence(
    bookingId: string,
    confidenceLevel: number,
    detectedHesitationPoints: string[] = [],
    detectedRiskFactors: string[] = []
  ): Promise<BookingFlowResult> {
    const context = this.contexts.get(bookingId);
    if (!context) {
      return {
        success: false,
        message: `Booking context not found for ID: ${bookingId}`
      };
    }
    
    // Update confidence in context
    context.customerConfidence = confidenceLevel;
    
    // Record hesitation and risk factors
    context.detectedHesitationPoints.push(...detectedHesitationPoints);
    context.detectedRiskFactors.push(...detectedRiskFactors);
    
    // Record in drop-off detector
    if (this.config.enableDropOffDetection) {
      this.dropOffDetector.recordConfidence(context.sessionId, confidenceLevel);
      
      // Record any detected risk factors
      detectedRiskFactors.forEach(risk => {
        this.dropOffDetector.recordRiskFactor(context.sessionId, risk);
      });
    }
    
    // Process trust injection if confidence is low
    let trustIntervention: TrustInjectionResult | undefined;
    if (this.config.enableTrustInjection && confidenceLevel < this.config.trustInjectionThreshold) {
      trustIntervention = await this.processTrustInjection(context);
    }
    
    // Process conversion hooks for hesitation points
    let conversionHooks: ConversionHookResult[] | undefined;
    if (this.config.enableConversionHooks && detectedHesitationPoints.length > 0) {
      conversionHooks = await this.processConversionHooks(context);
    }
    
    // Update context
    this.contexts.set(bookingId, context);
    
    return {
      success: true,
      trustIntervention,
      conversionHooks,
      message: `Customer confidence updated to: ${confidenceLevel}`
    };
  }
  
  /**
   * Records a page view in the booking flow
   */
  async recordPageView(bookingId: string, pageUrl: string, viewName: string): Promise<BookingFlowResult> {
    const context = this.contexts.get(bookingId);
    if (!context) {
      return {
        success: false,
        message: `Booking context not found for ID: ${bookingId}`
      };
    }
    
    // Update current view in context
    context.currentView = viewName;
    
    // Record in drop-off detector
    if (this.config.enableDropOffDetection) {
      this.dropOffDetector.recordPageVisit(
        context.sessionId,
        pageUrl,
        context.stateMachine.currentState,
        context.customerConfidence
      );
    }
    
    // Process trust injection based on view
    let trustIntervention: TrustInjectionResult | undefined;
    if (this.config.enableTrustInjection) {
      trustIntervention = await this.processTrustInjection(context);
    }
    
    // Process conversion hooks
    let conversionHooks: ConversionHookResult[] | undefined;
    if (this.config.enableConversionHooks) {
      conversionHooks = await this.processConversionHooks(context);
    }
    
    // Update context
    this.contexts.set(bookingId, context);
    
    return {
      success: true,
      trustIntervention,
      conversionHooks,
      message: `Page view recorded: ${viewName}`
    };
  }
  
  /**
   * Processes trust injection based on current context
   */
  private async processTrustInjection(context: BookingFlowContext): Promise<TrustInjectionResult | undefined> {
    // Create trust injection context
    const trustContext: TrustInjectionContext = {
      bookingState: context.stateMachine.currentState,
      customerConfidence: context.customerConfidence,
      hesitationTriggers: [...context.detectedHesitationPoints],
      currentView: context.currentView,
      timeInState: this.getTimeInCurrentState(context.stateMachine),
      bookingId: context.bookingId,
      customerId: context.customerId,
      riskFactors: [...context.detectedRiskFactors],
      slaStatus: context.slaHours ? 'active' : 'pending',
      pricePerceived: context.estimatedCost ? (context.estimatedCost > 10000 ? 'high' : context.estimatedCost < 3000 ? 'low' : 'fair') : undefined,
      technicianCertainty: context.technicianCertainty,
      partAvailability: context.partAvailability,
    };
    
    // Check if trust injection is needed
    const trustResult = shouldInjectTrust(trustContext);
    
    if (trustResult) {
      // Add to trust history
      context.trustHistory.push(trustResult);
      
      // Record telemetry event
      const event = createBookingTelemetryEvent(
        BookingEvent.TRUST_INJECTION,
        {
          timestamp: new Date(),
          bookingId: context.bookingId,
          customerId: context.customerId,
          sessionId: context.sessionId,
          trustMessage: trustResult.message,
          priority: trustResult.priority,
          injectionPoint: trustContext.currentView,
        },
        'system'
      );
      
      if (this.config.enableTelemetry) {
        this.eventEmitter.emit(event);
        context.telemetryEvents.push(event);
      }
      
      return trustResult;
    }
    
    // Try to generate contextual trust message even if specific trigger not found
    const contextualMessage = generateContextualTrustMessage(trustContext);
    if (contextualMessage) {
      const result: TrustInjectionResult = {
        shouldInject: true,
        message: contextualMessage,
        priority: 'medium',
        type: 'reassurance',
        injectedAt: new Date(),
      };
      
      // Add to trust history
      context.trustHistory.push(result);
      
      // Record telemetry event
      const event = createBookingTelemetryEvent(
        BookingEvent.TRUST_INJECTION,
        {
          timestamp: new Date(),
          bookingId: context.bookingId,
          customerId: context.customerId,
          sessionId: context.sessionId,
          trustMessage: result.message,
          priority: result.priority,
          injectionPoint: trustContext.currentView,
        },
        'system'
      );
      
      if (this.config.enableTelemetry) {
        this.eventEmitter.emit(event);
        context.telemetryEvents.push(event);
      }
      
      return result;
    }
    
    return undefined;
  }
  
  /**
   * Processes conversion hooks based on current context
   */
  private async processConversionHooks(context: BookingFlowContext): Promise<ConversionHookResult[]> {
    // Create conversion decision context
    const conversionContext: ConversionDecisionContext = {
      customerId: context.customerId,
      sessionId: context.sessionId,
      bookingState: context.stateMachine.currentState,
      customerConfidence: context.customerConfidence,
      priceSensitivity: this.getPriceSensitivity(context),
      timeInCurrentState: this.getTimeInCurrentState(context.stateMachine),
      previousStates: this.getPreviousStates(context.stateMachine),
      hesitationPoints: [...context.detectedHesitationPoints],
      detectedRiskFactors: [...context.detectedRiskFactors],
      deviceType: context.deviceType,
      deviceBrand: context.deviceBrand,
      estimatedCost: context.estimatedCost,
      slaHours: context.slaHours,
      technicianCertainty: context.technicianCertainty,
      partAvailability: context.partAvailability,
    };
    
    // Process customer hesitation
    const { conversionHooks, trustInterventions } = await this.conversionEngine.processCustomerHesitation(conversionContext);
    
    // Store conversion hook results
    context.conversionHookResults.push(...conversionHooks);
    
    // Add any trust interventions from conversion engine to main trust history
    context.trustHistory.push(...trustInterventions);
    
    // Record telemetry events for conversion hooks
    if (this.config.enableTelemetry) {
      for (const hook of conversionHooks) {
        const event = createBookingTelemetryEvent(
          BookingEvent.CONVERSION_OPTIMIZATION_TRIGGERED,
          {
            timestamp: new Date(),
            bookingId: context.bookingId,
            customerId: context.customerId,
            sessionId: context.sessionId,
            hookId: hook.trackingId,
            actionType: hook.actionType,
            confidence: hook.confidence,
            hesitationPoints: context.detectedHesitationPoints,
          },
          'system'
        );
        
        this.eventEmitter.emit(event);
        context.telemetryEvents.push(event);
      }
    }
    
    return conversionHooks;
  }
  
  /**
   * Gets the time spent in the current state
   */
  private getTimeInCurrentState(stateMachine: BookingStateMachine): number {
    // In a real implementation, we would track the time when state changed
    // For now, we'll return 0, but in practice this would be calculated
    return 0;
  }
  
  /**
   * Gets previous states from state history
   */
  private getPreviousStates(stateMachine: BookingStateMachine): BookingState[] {
    // Extract states from transition history
    return stateMachine.stateHistory.map(t => t.from);
  }
  
  /**
   * Gets appropriate telemetry event for a booking state
   */
  private getEventForState(state: BookingState): BookingEvent {
    switch (state) {
      case BookingState.VALIDATING:
        return BookingEvent.BOOKING_VALIDATED;
      case BookingState.TECHNICIAN_MATCH:
        return BookingEvent.TECHNICIAN_MATCHED;
      case BookingState.ASSIGNED:
        return BookingEvent.TECHNICIAN_ASSIGNED;
      case BookingState.ACCEPTED:
        return BookingEvent.TECHNICIAN_ACCEPTED;
      case BookingState.CONFIRMED:
        return BookingEvent.BOOKING_CONFIRMED;
      case BookingState.ESCROW_PENDING:
        return BookingEvent.PAYMENT_PENDING;
      case BookingState.COMPLETED:
        return BookingEvent.BOOKING_COMPLETED;
      case BookingState.CANCELLED:
        return BookingEvent.BOOKING_CANCELLED;
      case BookingState.FAILED:
        return BookingEvent.BOOKING_FAILED;
      default:
        return BookingEvent.BOOKING_STARTED; // Default fallback
    }
  }
  
  /**
   * Calculates price sensitivity based on context
   */
  private getPriceSensitivity(context: BookingFlowContext): number {
    if (context.estimatedCost === undefined) return 50; // Default medium sensitivity
    
    // For now, return a fixed value; in reality, this would be calculated based on customer history
    return context.estimatedCost > 15000 ? 80 : context.estimatedCost < 5000 ? 30 : 50;
  }
  
  /**
   * Gets the current booking context
   */
  getBookingContext(bookingId: string): BookingFlowContext | undefined {
    return this.contexts.get(bookingId);
  }
  
  /**
   * Completes a booking flow
   */
  async completeBookingFlow(bookingId: string): Promise<BookingFlowResult> {
    const context = this.contexts.get(bookingId);
    if (!context) {
      return {
        success: false,
        message: `Booking context not found for ID: ${bookingId}`
      };
    }
    
    // Transition to completed state if not already there
    if (context.stateMachine.currentState !== BookingState.COMPLETED) {
      const result = await this.transitionBookingState(bookingId, BookingState.COMPLETED);
      if (!result.success) {
        return result;
      }
    }
    
    // Mark session as complete in drop-off detector
    if (this.config.enableDropOffDetection) {
      this.dropOffDetector.markSessionComplete(context.sessionId);
    }
    
    // Record completion event
    const event = createBookingTelemetryEvent(
      BookingEvent.BOOKING_COMPLETED,
      {
        timestamp: new Date(),
        bookingId: context.bookingId,
        customerId: context.customerId,
        sessionId: context.sessionId,
        finalConfidence: context.customerConfidence,
        totalEvents: context.telemetryEvents.length,
        totalTrustInterventions: context.trustHistory.length,
      },
      'system'
    );
    
    if (this.config.enableTelemetry) {
      this.eventEmitter.emit(event);
      context.telemetryEvents.push(event);
    }
    
    return {
      success: true,
      message: 'Booking flow completed successfully'
    };
  }
  
  /**
   * Cancels a booking flow
   */
  async cancelBookingFlow(bookingId: string, reason?: string): Promise<BookingFlowResult> {
    const context = this.contexts.get(bookingId);
    if (!context) {
      return {
        success: false,
        message: `Booking context not found for ID: ${bookingId}`
      };
    }
    
    // Transition to cancelled state
    const result = await this.transitionBookingState(bookingId, BookingState.CANCELLED, reason);
    if (!result.success) {
      return result;
    }
    
    // Mark session as complete in drop-off detector
    if (this.config.enableDropOffDetection) {
      this.dropOffDetector.markSessionComplete(context.sessionId);
    }
    
    // Record cancellation event
    const event = createBookingTelemetryEvent(
      BookingEvent.BOOKING_CANCELLED,
      {
        timestamp: new Date(),
        bookingId: context.bookingId,
        customerId: context.customerId,
        sessionId: context.sessionId,
        reason,
        finalConfidence: context.customerConfidence,
      },
      'system'
    );
    
    if (this.config.enableTelemetry) {
      this.eventEmitter.emit(event);
      context.telemetryEvents.push(event);
    }
    
    return {
      success: true,
      message: 'Booking flow cancelled successfully'
    };
  }
  
  /**
   * Gets all telemetry events for a booking
   */
  getBookingTelemetryEvents(bookingId: string): BookingTelemetryEvent[] {
    const context = this.contexts.get(bookingId);
    return context ? [...context.telemetryEvents] : [];
  }
  
  /**
   * Gets all trust interventions for a booking
   */
  getBookingTrustHistory(bookingId: string): TrustInjectionResult[] {
    const context = this.contexts.get(bookingId);
    return context ? [...context.trustHistory] : [];
  }
  
  /**
   * Gets risk level for a booking
   */
  getBookingRiskLevel(bookingId: string): 'high' | 'medium' | 'low' | undefined {
    const context = this.contexts.get(bookingId);
    return context ? getBookingRiskLevel(context.stateMachine.currentState) : undefined;
  }
  
  /**
   * Gets session statistics for drop-off detection
   */
  getSessionStats() {
    return this.dropOffDetector.getDetectionStats();
  }
}