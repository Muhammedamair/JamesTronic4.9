import { TrustContext } from './trustContextResolver';

export interface TrustEvent {
  id: string;
  type: 'sla_breach' | 'sla_at_risk' | 'part_delay' | 'technician_delay' | 'update' | 'completion';
  priority: number; // Higher number = higher priority
  message: string;
  timestamp: Date;
  visible: boolean;
}

export interface TrustPriorityConfig {
  suppressDuplicates: boolean;
  throttleIntervalMs: number;
  maxVisibleEvents: number;
  priorityThreshold: number;
}

const DEFAULT_CONFIG: TrustPriorityConfig = {
  suppressDuplicates: true,
  throttleIntervalMs: 30000, // 30 seconds
  maxVisibleEvents: 1,
  priorityThreshold: 1
};

export class TrustPriorityEngine {
  private config: TrustPriorityConfig;
  private recentEvents: Map<string, Date> = new Map();
  private lastEventTime: Date | null = null;

  constructor(config?: Partial<TrustPriorityConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Process trust events and prioritize them according to business rules
   */
  public prioritizeEvents(
    events: TrustEvent[],
    context: TrustContext
  ): TrustEvent[] {
    // Filter events based on context
    const filteredEvents = this.filterEventsByContext(events, context);
    
    // Sort by priority (highest first)
    const sortedEvents = filteredEvents.sort((a, b) => b.priority - a.priority);
    
    // Apply throttling
    const throttledEvents = this.applyThrottling(sortedEvents);
    
    // Apply duplicate suppression
    const deduplicatedEvents = this.suppressDuplicates(throttledEvents);
    
    // Limit to max visible events
    return deduplicatedEvents.slice(0, this.config.maxVisibleEvents);
  }

  private filterEventsByContext(events: TrustEvent[], context: TrustContext): TrustEvent[] {
    return events.filter(event => {
      // Hide completion events if ticket is not completed
      if (event.type === 'completion' && context.ticket.status !== 'Completed') {
        return false;
      }
      
      // Hide SLA events if ticket is completed
      if ((event.type === 'sla_breach' || event.type === 'sla_at_risk') && 
          context.ticket.status === 'Completed') {
        return false;
      }
      
      // Hide part delay events if no parts are required
      if (event.type === 'part_delay' && 
          context.partDependency.status === 'not_needed') {
        return false;
      }
      
      // Hide technician delay if technician is assigned
      if (event.type === 'technician_delay' && 
          context.technicianStatus === 'assigned') {
        return false;
      }
      
      return true;
    });
  }

  private applyThrottling(events: TrustEvent[]): TrustEvent[] {
    if (!this.lastEventTime) {
      this.lastEventTime = new Date();
      return events;
    }
    
    const now = new Date();
    const timeSinceLast = now.getTime() - this.lastEventTime.getTime();
    
    // If too soon since last event, limit to only the highest priority
    if (timeSinceLast < this.config.throttleIntervalMs) {
      if (events.length > 0) {
        // Return only the highest priority event
        return [events[0]];
      }
    }
    
    this.lastEventTime = now;
    return events;
  }

  private suppressDuplicates(events: TrustEvent[]): TrustEvent[] {
    if (!this.config.suppressDuplicates) {
      return events;
    }
    
    const uniqueEvents: TrustEvent[] = [];
    const seenMessages = new Set<string>();
    
    for (const event of events) {
      if (!seenMessages.has(event.message)) {
        seenMessages.add(event.message);
        uniqueEvents.push({ ...event, visible: true });
      } else {
        // Add the duplicate event but mark it as not visible
        uniqueEvents.push({ ...event, visible: false });
      }
    }
    
    return uniqueEvents;
  }

  /**
   * Rate limit trust events to prevent spam
   */
  public shouldShowEvent(event: TrustEvent): boolean {
    const now = new Date();
    const lastShown = this.recentEvents.get(event.id);
    
    if (!lastShown) {
      // First time we've seen this event
      this.recentEvents.set(event.id, now);
      return true;
    }
    
    // Check if enough time has passed since last display
    const timeSinceLast = now.getTime() - lastShown.getTime();
    if (timeSinceLast >= this.config.throttleIntervalMs) {
      this.recentEvents.set(event.id, now);
      return true;
    }
    
    return false;
  }
  
  /**
   * Get priority level for a specific context
   */
  public getPriorityForContext(context: TrustContext): number {
    // Prioritize based on the most critical trust issues
    if (context.slaStatus === 'breached') return 100;
    if (context.slaStatus === 'at_risk') return 80;
    if (context.partDependency.status === 'delayed') return 70;
    if (context.technicianStatus === 'not_assigned' && context.ticket.status !== 'Completed') return 60;
    if (context.partDependency.status === 'ordered') return 50;
    if (context.customerFeedbackState === 'pending' && context.ticket.status === 'Completed') return 40;
    if (context.slaStatus === 'on_track') return 20;
    
    return 10; // Default low priority
  }
}