import { TrustContext, trustContextResolver } from './trustContextResolver';
import { TrustPriorityEngine, TrustEvent } from './trustPriorityEngine';

// Define a more flexible input type for broader compatibility
interface FlexibleTrustContextInput {
  ticket: {
    id: string;
    device_category?: string;
    brand?: string | null;
    status: string;
    created_at: string;
    updated_at: string;
    assigned_technician_id?: string | null;
    [key: string]: any; // Allow additional properties for compatibility
  };
  slaSnapshot?: {
    status: 'active' | 'breached' | 'fulfilled' | string; // Allow string type to accommodate customer data
    promised_hours: number | null;
    elapsed_hours: number | null;
    [key: string]: any; // Allow additional properties for compatibility
  } | null;
  partStatus?: {
    required: boolean;
    status: 'not_needed' | 'ordered' | 'delayed' | 'available';
    estimated_wait_hours?: number;
  };
  technicianStatus?: 'assigned' | 'not_assigned' | 'delayed';
  customerFeedbackState?: 'not_requested' | 'pending' | 'completed';
}

export interface TrustOrchestrationResult {
  showTrustIndicator: boolean;
  trustComponentType: 'persistent-strip' | 'risk-injector' | 'completion-summary' | 'none';
  trustPriority: number;
  trustMessage?: string;
  trustContext: TrustContext;
}

export class TrustOrchestrator {
  private priorityEngine: TrustPriorityEngine;

  constructor(priorityConfig?: Partial<TrustPriorityEngine['config']>) {
    this.priorityEngine = new TrustPriorityEngine(priorityConfig);
  }

  /**
   * Orchestrate trust signals based on current context
   */
  public orchestrateTrust(contextInput: FlexibleTrustContextInput): TrustOrchestrationResult {
    // Call the resolver with the flexible input - trustContextResolver now handles this
    const context = trustContextResolver(contextInput);
    const events = this.generateTrustEvents(context);
    const prioritizedEvents = this.priorityEngine.prioritizeEvents(events, context);

    // Determine if we should show any trust indicator
    const shouldShowTrust = this.shouldShowTrustIndicator(context, prioritizedEvents);

    if (!shouldShowTrust || prioritizedEvents.length === 0) {
      return {
        showTrustIndicator: false,
        trustComponentType: 'none',
        trustPriority: 0,
        trustContext: context
      };
    }

    // Get the highest priority event
    const topEvent = prioritizedEvents[0];

    // Determine which component type to show based on context and event
    const componentType = this.determineComponentType(context, topEvent);

    return {
      showTrustIndicator: true,
      trustComponentType: componentType,
      trustPriority: this.priorityEngine.getPriorityForContext(context),
      trustMessage: topEvent.message,
      trustContext: context
    };
  }

  /**
   * Generate all possible trust events for the given context
   */
  private generateTrustEvents(context: TrustContext): TrustEvent[] {
    const events: TrustEvent[] = [];
    const now = new Date();

    // SLA Breach Event
    if (context.slaStatus === 'breached') {
      events.push({
        id: `sla-breach-${context.ticket.id}`,
        type: 'sla_breach',
        priority: 100,
        message: `Repair is past the expected completion time. We're working to complete your repair soon.`,
        timestamp: now,
        visible: true
      });
    }

    // SLA At Risk Event
    if (context.slaStatus === 'at_risk') {
      events.push({
        id: `sla-risk-${context.ticket.id}`,
        type: 'sla_at_risk',
        priority: 80,
        message: `Repair is approaching the expected completion time. We're working to complete your repair on schedule.`,
        timestamp: now,
        visible: true
      });
    }

    // Part Delay Event
    if (context.partDependency.status === 'delayed') {
      const waitMessage = context.partDependency.estimatedWaitHours
        ? `Est. wait: ${context.partDependency.estimatedWaitHours} hours.`
        : 'We will update you when available.';

      events.push({
        id: `part-delay-${context.ticket.id}`,
        type: 'part_delay',
        priority: 70,
        message: `Required part is delayed. ${waitMessage}`,
        timestamp: now,
        visible: true
      });
    }

    // Technician Delay Event
    if (context.technicianStatus === 'not_assigned' && context.ticket.status !== 'Completed') {
      events.push({
        id: `tech-delay-${context.ticket.id}`,
        type: 'technician_delay',
        priority: 60,
        message: `Technician assignment is delayed. We're working to assign someone soon.`,
        timestamp: now,
        visible: true
      });
    }

    // Part Ordered Event
    if (context.partDependency.status === 'ordered') {
      const waitMessage = context.partDependency.estimatedWaitHours
        ? `Est. arrival: ${context.partDependency.estimatedWaitHours} hours.`
        : 'We will update you when it arrives.';

      events.push({
        id: `part-ordered-${context.ticket.id}`,
        type: 'update',
        priority: 50,
        message: `Required part has been ordered. ${waitMessage}`,
        timestamp: now,
        visible: true
      });
    }

    // Completion Event (if feedback pending)
    if (context.ticket.status === 'Completed' && context.customerFeedbackState === 'pending') {
      events.push({
        id: `completion-${context.ticket.id}`,
        type: 'completion',
        priority: 40,
        message: 'Repair completed! Please share your feedback.',
        timestamp: now,
        visible: true
      });
    }

    // On Track Event (lower priority)
    if (context.slaStatus === 'on_track' && context.ticket.status !== 'Completed') {
      events.push({
        id: `on-track-${context.ticket.id}`,
        type: 'update',
        priority: 20,
        message: 'Repair is on track for completion as promised.',
        timestamp: now,
        visible: true
      });
    }

    return events;
  }

  /**
   * Determine if trust indicator should be shown based on context
   */
  private shouldShowTrustIndicator(context: TrustContext, events: TrustEvent[]): boolean {
    // Show trust indicator if we have high or medium priority events
    const highestPriority = Math.max(...events.map(e => e.priority));
    return highestPriority >= 40 || context.overallTrustLevel !== 'high';
  }

  /**
   * Determine which component type to show based on context and events
   */
  private determineComponentType(context: TrustContext, event: TrustEvent): TrustOrchestrationResult['trustComponentType'] {
    // For completed tickets, always use completion summary
    if (context.ticket.status === 'Completed') {
      return 'completion-summary';
    }

    // For SLA risks or part delays, use risk injector
    if (['sla_breach', 'sla_at_risk', 'part_delay', 'technician_delay'].includes(event.type)) {
      return 'risk-injector';
    }

    // For updates when ticket is active, use persistent strip
    if (event.type === 'update' && context.ticket.status !== 'Completed') {
      return 'persistent-strip';
    }

    // Default to persistent strip for active tickets
    if (context.ticket.status !== 'Completed') {
      return 'persistent-strip';
    }

    // Otherwise, no component needed
    return 'none';
  }

  /**
   * Get the appropriate trust message for the current context
   */
  public getTrustMessage(context: TrustContext): string | null {
    // This method needs to be updated to use the new flexible type
    const result = this.orchestrateTrust({
      ticket: context.ticket,
      slaSnapshot: {
        status: context.slaStatus === 'breached' ? 'breached' :
                context.slaStatus === 'completed' ? 'fulfilled' : 'active',
        promised_hours: context.ticket.device_category === 'Mobile' ? 24 :
                       context.ticket.device_category === 'Laptop' ? 48 : 72,
        elapsed_hours: 0 // This would be calculated in a real implementation
      },
      partStatus: context.partDependency,
      technicianStatus: context.technicianStatus,
      customerFeedbackState: context.customerFeedbackState
    });

    return result.trustMessage || null;
  }
}