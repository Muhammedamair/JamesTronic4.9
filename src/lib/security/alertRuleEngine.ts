import { createClient } from '@supabase/supabase-js';
import { SecurityEventSource } from './eventSources';

interface AlertRule {
  id: string;
  name: string;
  description: string;
  is_active: boolean;
  severity: string;
  source_type: string;
  condition: {
    event_type?: string;
    window_minutes: number;
    threshold: number;
    group_by: string;
  };
}

interface Alert {
  rule_id: string;
  source_type: string;
  severity: string;
  message: string;
  metadata: any;
}

export class AlertRuleEngine {
  private supabase;
  private eventSource: SecurityEventSource;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
    
    this.eventSource = new SecurityEventSource();
  }

  /**
   * Process all active alert rules and generate alerts if conditions are met
   */
  async processRules(): Promise<void> {
    console.log('[AlertRuleEngine] Starting alert rule processing...');

    try {
      // Fetch all active rules
      const { data: rules, error } = await this.supabase
        .from('security_alert_rules')
        .select('*')
        .eq('is_active', true);

      if (error) {
        console.error('Error fetching alert rules:', error);
        return;
      }

      if (!rules || rules.length === 0) {
        console.log('[AlertRuleEngine] No active rules found');
        return;
      }

      console.log(`[AlertRuleEngine] Processing ${rules.length} active rules`);

      // Process each rule
      for (const rule of rules) {
        await this.processRule(rule);
      }

      console.log('[AlertRuleEngine] Alert rule processing completed');
    } catch (error) {
      console.error('[AlertRuleEngine] Error processing rules:', error);
    }
  }

  /**
   * Process a single alert rule
   */
  private async processRule(rule: AlertRule): Promise<void> {
    console.log(`[AlertRuleEngine] Processing rule: ${rule.name} (${rule.id})`);

    try {
      // Based on the source type, call appropriate event source method
      let events: any[] = [];
      
      switch (rule.source_type) {
        case 'admin_security_events':
          events = await this.eventSource.getAdminSecurityEvents(
            rule.condition.event_type || null,
            rule.condition.window_minutes,
            rule.condition.group_by
          );
          break;
        case 'device_lock_conflicts':
          events = await this.eventSource.getDeviceConflicts(
            rule.condition.window_minutes,
            rule.condition.group_by
          );
          break;
        case 'login_otp_requests':
          events = await this.eventSource.getOtpRequests(
            rule.condition.window_minutes,
            rule.condition.group_by
          );
          break;
        default:
          console.warn(`[AlertRuleEngine] Unknown source type: ${rule.source_type}`);
          return;
      }

      // Group events by the specified field and count occurrences
      const groupedEvents = this.groupEventsByField(events, rule.condition.group_by);
      
      // Check if any group exceeds the threshold
      for (const [key, eventGroup] of Object.entries(groupedEvents)) {
        if (eventGroup.length >= rule.condition.threshold) {
          // Check if we've recently generated an alert for the same key to avoid duplicates
          const recentlyAlerted = await this.hasRecentlyAlerted(rule.id, key, rule.condition.window_minutes);
          
          if (!recentlyAlerted) {
            // Create an alert
            await this.createAlert(rule, key, eventGroup);
          }
        }
      }
    } catch (error) {
      console.error(`[AlertRuleEngine] Error processing rule ${rule.id}:`, error);
    }
  }

  /**
   * Group events by a specified field
   */
  private groupEventsByField(events: any[], groupByField: string): Record<string, any[]> {
    const grouped: Record<string, any[]> = {};
    
    for (const event of events) {
      const key = event[groupByField];
      if (key) {
        if (!grouped[key]) {
          grouped[key] = [];
        }
        grouped[key].push(event);
      }
    }
    
    return grouped;
  }

  /**
   * Check if an alert was recently generated for the same rule and key
   */
  private async hasRecentlyAlerted(ruleId: string, key: string, windowMinutes: number): Promise<boolean> {
    try {
      const sinceTime = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
      
      const { count, error } = await this.supabase
        .from('security_alerts')
        .select('*', { count: 'exact', head: true })
        .eq('rule_id', ruleId)
        .gte('created_at', sinceTime)
        .eq('metadata->>key', key)  // Assuming key is stored in metadata
        .eq('status', 'open');  // Only check open alerts to avoid re-alerting on resolved issues

      if (error) {
        console.error('Error checking recent alerts:', error);
        return false; // Default to false to ensure alerts still fire if check fails
      }

      return count !== null && count > 0;
    } catch (error) {
      console.error('Error in hasRecentlyAlerted:', error);
      return false;
    }
  }

  /**
   * Create a security alert
   */
  private async createAlert(rule: AlertRule, key: string, events: any[]): Promise<void> {
    console.log(`[AlertRuleEngine] Creating alert for rule ${rule.name}, key ${key}`);

    try {
      const message = this.generateAlertMessage(rule, key, events);
      
      const alert: Alert = {
        rule_id: rule.id,
        source_type: rule.source_type,
        severity: rule.severity,
        message: message,
        metadata: {
          key: key,
          event_count: events.length,
          triggered_at: new Date().toISOString(),
          related_events: events.slice(0, 5).map(event => ({
            id: event.id,
            timestamp: event.created_at || event.event_timestamp || event.detected_at,
            ...event
          }))
        }
      };

      const { error } = await this.supabase
        .from('security_alerts')
        .insert([alert]);

      if (error) {
        console.error('Error creating security alert:', error);
      } else {
        console.log(`[AlertRuleEngine] Created security alert for rule ${rule.name}`);
      }
    } catch (error) {
      console.error(`[AlertRuleEngine] Error creating alert for rule ${rule.id}:`, error);
    }
  }

  /**
   * Generate a human-readable alert message
   */
  private generateAlertMessage(rule: AlertRule, key: string, events: any[]): string {
    switch (rule.name) {
      case 'MULTIPLE_ADMIN_MFA_FAILURES':
        return `High number of MFA failures (${events.length}) for admin user ${key} in the last ${rule.condition.window_minutes} minutes.`;
      case 'DEVICE_CONFLICT_STORM':
        return `Multiple device conflicts detected (${events.length}) for user ${key} in the last ${rule.condition.window_minutes} minutes.`;
      case 'OTP_ABUSE_SINGLE_NUMBER':
        return `High volume of OTP requests (${events.length}) for phone number ${key} in the last ${rule.condition.window_minutes} minutes.`;
      default:
        return `Security rule "${rule.name}" triggered for ${rule.condition.group_by} "${key}" with ${events.length} events in the last ${rule.condition.window_minutes} minutes.`;
    }
  }
}