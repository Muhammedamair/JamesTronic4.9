import { createClient } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase/supabase';

// Use the existing supabase client from the application

// Service for handling customer updates and timeline events
export const customerUpdatesService = {
  /**
   * Creates a timeline event for a customer's ticket
   */
  createTimelineEvent: async (
    ticketId: string,
    eventType: string,
    title: string,
    description?: string
  ) => {
    try {
      const { error } = await supabase
        .from('customer_timeline')
        .insert([{
          ticket_id: ticketId,
          event_type: eventType,
          title,
          description: description || null,
        }]);

      if (error) {
        console.error('Error creating timeline event:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in createTimelineEvent:', error);
      throw error;
    }
  },

  /**
   * Updates the SLA snapshot for a customer's ticket
   */
  updateSLASnapshot: async (
    ticketId: string,
    promisedHours: number | null,
    elapsedHours: number | null,
    status: 'active' | 'breached' | 'fulfilled'
  ) => {
    try {
      const { error } = await supabase
        .from('customer_sla_snapshot')
        .upsert([{
          ticket_id: ticketId,
          promised_hours: promisedHours,
          elapsed_hours: elapsedHours,
          status,
        }]);

      if (error) {
        console.error('Error updating SLA snapshot:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in updateSLASnapshot:', error);
      throw error;
    }
  },

  /**
   * Creates a customer notification log entry
   */
  createNotificationLog: async (
    ticketId: string,
    userId: string, // customer's profile.id
    channel: 'push' | 'sms' | 'email',
    message: string
  ) => {
    try {
      const { error } = await supabase
        .from('customer_notifications_log')
        .insert([{
          ticket_id: ticketId,
          user_id: userId,
          channel,
          message,
        }]);

      if (error) {
        console.error('Error creating notification log:', error);
        throw error;
      }

      return true;
    } catch (error) {
      console.error('Error in createNotificationLog:', error);
      throw error;
    }
  },
};