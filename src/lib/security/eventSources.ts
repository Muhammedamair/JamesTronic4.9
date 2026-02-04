import { createClient } from '@supabase/supabase-js';

export class SecurityEventSource {
  private supabase;

  constructor() {
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }

  /**
   * Get admin security events within a time window, optionally filtered by event type
   */
  async getAdminSecurityEvents(
    eventType: string | null = null, 
    windowMinutes: number,
    groupByField: string
  ): Promise<any[]> {
    try {
      const sinceTime = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
      
      let query = this.supabase
        .from('admin_security_events')
        .select('*')
        .gte('event_timestamp', sinceTime);

      if (eventType) {
        query = query.eq('event_type', eventType);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching admin security events:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getAdminSecurityEvents:', error);
      return [];
    }
  }

  /**
   * Get device lock conflicts within a time window
   */
  async getDeviceConflicts(
    windowMinutes: number,
    groupByField: string
  ): Promise<any[]> {
    try {
      const sinceTime = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
      
      const { data, error } = await this.supabase
        .from('device_lock_conflicts')
        .select('*')
        .gte('detected_at', sinceTime);

      if (error) {
        console.error('Error fetching device conflicts:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getDeviceConflicts:', error);
      return [];
    }
  }

  /**
   * Get OTP requests within a time window
   */
  async getOtpRequests(
    windowMinutes: number,
    groupByField: string
  ): Promise<any[]> {
    try {
      const sinceTime = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
      
      const { data, error } = await this.supabase
        .from('login_otp_requests')
        .select('*')
        .gte('created_at', sinceTime);

      if (error) {
        console.error('Error fetching OTP requests:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Error in getOtpRequests:', error);
      return [];
    }
  }
}