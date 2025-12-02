/**
 * ConversionHooks.ts
 * 
 * Booking Decision Engine for JamesTronic's
 * Booking Control & Conversion Layer (Phase C8.7)
 * 
 * Handles customer hesitation points and surfaces reassurance
 */

import { BookingState } from './BookingStates';
import { TrustInjectionResult, TrustInjectionContext, generateContextualTrustMessage } from './TrustTriggerMap';
import { DropOffEvent, DropOffDetector } from './DropOffDetector';

export interface ConversionDecisionContext {
  customerId: string;
  sessionId: string;
  bookingState: BookingState;
  customerConfidence: number; // Scale 0-100
  priceSensitivity: number; // Scale 0-100
  timeInCurrentState: number; // Milliseconds
  previousStates: BookingState[];
  hesitationPoints: string[];
  detectedRiskFactors: string[];
  deviceType?: string;
  deviceBrand?: string;
  estimatedCost?: number;
  slaHours?: number;
  technicianCertainty?: number; // Scale 0-100
  partAvailability?: boolean;
  location?: string;
  serviceType?: string;
}

export interface ConversionHook {
  id: string;
  name: string;
  description: string;
  condition: (context: ConversionDecisionContext) => boolean;
  action: (context: ConversionDecisionContext) => Promise<ConversionHookResult>;
  priority: number; // Lower number = higher priority
  enabled: boolean;
}

export interface ConversionHookResult {
  shouldTrigger: boolean;
  message?: string;
  actionType: 'reassurance' | 'discount' | 'urgency' | 'transparency' | 'none';
  value?: any; // Additional data based on action type
  confidence: number; // Confidence in the decision (0-100)
  trackingId: string;
}

// Define the main conversion hooks
export const CONVERSION_HOOKS: ConversionHook[] = [
  {
    id: 'ch001',
    name: 'PriceHesitationReassurance',
    description: 'Detects and addresses price-related hesitation',
    condition: (ctx) => ctx.hesitationPoints.includes('price') && ctx.customerConfidence < 60,
    action: async (ctx) => {
      return {
        shouldTrigger: true,
        message: "We offer competitive pricing with no hidden fees. Our prices include a satisfaction guarantee.",
        actionType: 'reassurance',
        confidence: 90,
        trackingId: `ch001_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      };
    },
    priority: 1,
    enabled: true,
  },
  {
    id: 'ch002',
    name: 'SLAAmbiguityClarifier',
    description: 'Provides clarity when SLA information is ambiguous',
    condition: (ctx) => ctx.hesitationPoints.includes('sla') && ctx.slaHours === undefined,
    action: async (ctx) => {
      return {
        shouldTrigger: true,
        message: "We'll provide a specific timeline within 2 hours of technician assignment. You'll be notified immediately.",
        actionType: 'transparency',
        confidence: 85,
        trackingId: `ch002_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      };
    },
    priority: 2,
    enabled: true,
  },
  {
    id: 'ch003',
    name: 'TechnicianUncertaintyResolver',
    description: 'Addresses concerns about technician availability/certainty',
    condition: (ctx) => ctx.hesitationPoints.includes('technician') && ctx.technicianCertainty !== undefined && ctx.technicianCertainty < 70,
    action: async (ctx) => {
      return {
        shouldTrigger: true,
        message: "We're securing our best technician for your device type. If unavailable, we'll get the next best match.",
        actionType: 'reassurance',
        confidence: 80,
        trackingId: `ch003_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      };
    },
    priority: 2,
    enabled: true,
  },
  {
    id: 'ch004',
    name: 'DelayFearMitigator',
    description: 'Mitigates concerns about repair delays',
    condition: (ctx) => ctx.hesitationPoints.includes('delay') && ctx.customerConfidence < 55,
    action: async (ctx) => {
      return {
        shouldTrigger: true,
        message: "Delays are rare (under 5% of cases), but we'll notify you immediately if anything changes with your timeline.",
        actionType: 'reassurance',
        confidence: 88,
        trackingId: `ch004_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      };
    },
    priority: 1,
    enabled: true,
  },
  {
    id: 'ch005',
    name: 'PaymentUncertaintyResolver',
    description: 'Addresses payment-related concerns',
    condition: (ctx) => ctx.hesitationPoints.includes('payment') && ctx.customerConfidence < 65,
    action: async (ctx) => {
      return {
        shouldTrigger: true,
        message: "Your payment is held securely until completion. You're protected by our satisfaction guarantee.",
        actionType: 'transparency',
        confidence: 92,
        trackingId: `ch005_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      };
    },
    priority: 1,
    enabled: true,
  },
  {
    id: 'ch006',
    name: 'PartAvailabilityReassurance',
    description: 'Provides reassurance when parts are unavailable',
    condition: (ctx) => ctx.hesitationPoints.includes('parts') && ctx.partAvailability === false,
    action: async (ctx) => {
      return {
        shouldTrigger: true,
        message: "We're sourcing this part from our partner network. We'll update you within 2 hours on availability.",
        actionType: 'transparency',
        confidence: 85,
        trackingId: `ch006_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      };
    },
    priority: 1,
    enabled: true,
  },
  {
    id: 'ch007',
    name: 'LowConfidenceBooster',
    description: 'Provides reassurance when customer confidence is very low',
    condition: (ctx) => ctx.customerConfidence < 40,
    action: async (ctx) => {
      return {
        shouldTrigger: true,
        message: "We understand your concerns. Our team is here to answer any questions and ensure your satisfaction.",
        actionType: 'reassurance',
        confidence: 95,
        trackingId: `ch007_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      };
    },
    priority: 0, // Highest priority
    enabled: true,
  },
  {
    id: 'ch008',
    name: 'LongHesitationIntervention',
    description: 'Intervenes when customer hesitates for too long',
    condition: (ctx) => ctx.timeInCurrentState > 30000 && ctx.customerConfidence < 60, // 30+ seconds
    action: async (ctx) => {
      return {
        shouldTrigger: true,
        message: "Need help? Our support team is ready to answer questions and ensure your comfort with the process.",
        actionType: 'reassurance',
        confidence: 75,
        trackingId: `ch008_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      };
    },
    priority: 3,
    enabled: true,
  },
  {
    id: 'ch009',
    name: 'LoyaltyDiscountTrigger',
    description: 'Offers discount to high-value customers showing price hesitation',
    condition: (ctx) => ctx.hesitationPoints.includes('price') && ctx.customerConfidence < 50 && ctx.priceSensitivity > 70,
    action: async (ctx) => {
      // In a real system, this would check customer value and apply discounts
      const discountValue = 0.05; // 5% discount
      return {
        shouldTrigger: true,
        message: `Special offer: ${discountValue * 100}% discount for valued customers like you. Use code LOYALTY at checkout.`,
        actionType: 'discount',
        value: discountValue,
        confidence: 70,
        trackingId: `ch009_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      };
    },
    priority: 2,
    enabled: true,
  },
  {
    id: 'ch010',
    name: 'UrgencyDetector',
    description: 'Creates appropriate urgency based on device and timing',
    condition: (ctx) => ctx.hesitationPoints.includes('urgency') && ctx.deviceType === 'mobile' && ctx.customerConfidence < 50,
    action: async (ctx) => {
      return {
        shouldTrigger: true,
        message: "Mobile devices are essential for daily life. We recommend securing your repair slot now before scheduling fills up.",
        actionType: 'urgency',
        confidence: 78,
        trackingId: `ch010_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
      };
    },
    priority: 2,
    enabled: true,
  },
];

export class ConversionDecisionEngine {
  private hooks: ConversionHook[];
  private dropOffDetector: DropOffDetector;
  
  constructor(dropOffDetector: DropOffDetector, hooks?: ConversionHook[]) {
    this.hooks = hooks || [...CONVERSION_HOOKS];
    this.dropOffDetector = dropOffDetector;
  }
  
  /**
   * Evaluates customer hesitation and determines appropriate interventions
   */
  async evaluateConversionOpportunities(context: ConversionDecisionContext): Promise<ConversionHookResult[]> {
    // Filter enabled hooks
    const enabledHooks = this.hooks.filter(hook => hook.enabled);
    
    // Sort hooks by priority (lower number = higher priority)
    const sortedHooks = enabledHooks.sort((a, b) => a.priority - b.priority);
    
    const results: ConversionHookResult[] = [];
    
    // Execute hooks that match the current context
    for (const hook of sortedHooks) {
      if (hook.condition(context)) {
        try {
          const result = await hook.action(context);
          if (result.shouldTrigger) {
            results.push(result);
          }
        } catch (error) {
          console.error(`Error executing conversion hook ${hook.id}:`, error);
        }
      }
    }
    
    return results;
  }
  
  /**
   * Generates trust messages based on the current context and detected hesitation points
   */
  async generateTrustInterventions(context: ConversionDecisionContext): Promise<TrustInjectionResult[]> {
    const trustContext: TrustInjectionContext = {
      bookingState: context.bookingState,
      customerConfidence: context.customerConfidence,
      hesitationTriggers: [...context.hesitationPoints],
      currentView: this.getBookingStateView(context.bookingState),
      timeInState: context.timeInCurrentState,
      bookingId: context.customerId, // Using customer ID as booking ID in this context
      customerId: context.customerId,
      riskFactors: [...context.detectedRiskFactors],
      slaStatus: context.slaHours ? 'active' : 'pending',
      pricePerceived: context.priceSensitivity > 80 ? 'high' : context.priceSensitivity < 30 ? 'low' : 'fair',
      technicianCertainty: context.technicianCertainty,
      partAvailability: context.partAvailability,
    };
    
    const results: TrustInjectionResult[] = [];
    
    // Generate context-aware trust message
    const message = generateContextualTrustMessage(trustContext);
    if (message) {
      results.push({
        shouldInject: true,
        message,
        priority: 'medium',
        type: 'reassurance',
        injectedAt: new Date(),
      });
    }
    
    return results;
  }
  
  /**
   * Processes customer hesitation and determines interventions
   */
  async processCustomerHesitation(
    context: ConversionDecisionContext
  ): Promise<{
    conversionHooks: ConversionHookResult[];
    trustInterventions: TrustInjectionResult[];
    detectedDropOff?: DropOffEvent;
  }> {
    // First, evaluate conversion opportunities
    const conversionHooks = await this.evaluateConversionOpportunities(context);
    
    // Generate trust interventions
    const trustInterventions = await this.generateTrustInterventions(context);
    
    // Check for drop-off in the associated session
    const dropOffResult = this.dropOffDetector.checkDropOff(context.sessionId);
    
    return {
      conversionHooks,
      trustInterventions,
      detectedDropOff: dropOffResult.isDropOffDetected ? {
        type: dropOffResult.type as 'abandoned' | 'bounced' | 'hesitated' | 'bounce_attempt',
        sessionId: context.sessionId,
        timestamp: new Date(),
        bookingState: context.bookingState,
        context: `Hesitation processed: ${JSON.stringify(context.hesitationPoints)}`,
        riskFactors: context.detectedRiskFactors,
      } : undefined,
    };
  }
  
  /**
   * Adds a new conversion hook to the engine
   */
  addHook(hook: ConversionHook): void {
    this.hooks.push(hook);
  }
  
  /**
   * Removes a conversion hook by ID
   */
  removeHookById(id: string): boolean {
    const initialLength = this.hooks.length;
    this.hooks = this.hooks.filter(hook => hook.id !== id);
    return initialLength !== this.hooks.length;
  }
  
  /**
   * Enables or disables a conversion hook
   */
  setHookEnabled(id: string, enabled: boolean): boolean {
    const hook = this.hooks.find(h => h.id === id);
    if (hook) {
      hook.enabled = enabled;
      return true;
    }
    return false;
  }
  
  /**
   * Gets the current view name based on booking state
   */
  private getBookingStateView(state: BookingState): string {
    switch (state) {
      case BookingState.INITIATED:
        return 'booking-start';
      case BookingState.VALIDATING:
        return 'booking-validation';
      case BookingState.TECHNICIAN_MATCH:
        return 'technician-selection';
      case BookingState.ASSIGNED:
        return 'technician-assigned';
      case BookingState.ACCEPTED:
        return 'booking-acceptance';
      case BookingState.CONFIRMED:
        return 'booking-confirmation';
      case BookingState.ESCROW_PENDING:
        return 'payment-escrow';
      case BookingState.COMPLETED:
        return 'booking-completed';
      default:
        return 'unknown';
    }
  }
  
  /**
   * Creates a decision context from booking state and customer data
   */
  static createDecisionContext(
    bookingState: BookingState,
    customerId: string,
    sessionId: string,
    additionalData?: Partial<ConversionDecisionContext>
  ): ConversionDecisionContext {
    return {
      customerId,
      sessionId,
      bookingState,
      customerConfidence: 70, // Default confidence level
      priceSensitivity: 50, // Default price sensitivity
      timeInCurrentState: 0, // Will be calculated at runtime
      previousStates: [], // Will be populated at runtime
      hesitationPoints: [], // Will be detected at runtime
      detectedRiskFactors: [], // Will be detected at runtime
      ...additionalData,
    };
  }
}

/**
 * Convenience function to create a decision engine with default settings
 */
export function createDefaultConversionEngine(dropOffDetector: DropOffDetector): ConversionDecisionEngine {
  return new ConversionDecisionEngine(dropOffDetector);
}