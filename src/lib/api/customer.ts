import { z } from 'zod';

// Zod schemas for validation
const ticketSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  assigned_technician_id: z.string().uuid().nullable(),
  device_category: z.string(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  size_inches: z.number().nullable(),
  issue_summary: z.string().nullable(),
  issue_details: z.string().nullable(),
  quoted_price: z.number().nullable(),
  status: z.string(),
  status_reason: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  assigned_technician: z
    .object({
      id: z.string().uuid(),
      full_name: z.string(),
    })
    .nullable()
    .optional(),
  customer: z.object({
    name: z.string(),
    phone_e164: z.string(),
  }).optional(),
  status_history: z.array(
    z.object({
      id: z.string().uuid(),
      ticket_id: z.string().uuid(),
      status: z.string(),
      note: z.string().nullable(),
      changed_by: z.string().uuid().nullable(),
      changed_at: z.string(),
    })
  ).optional(),
  sla_snapshot: z
    .object({
      ticket_id: z.string().uuid(),
      promised_hours: z.number().nullable(),
      elapsed_hours: z.number().nullable(),
      status: z.string(), // 'active', 'breached', 'fulfilled', 'at_risk'
      last_updated: z.string(),
    })
    .nullable()
    .optional(),
});

const timelineEventSchema = z.object({
  id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  event_type: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  created_at: z.string(),
});

const slaSnapshotSchema = z.object({
  ticket_id: z.string().uuid(),
  promised_hours: z.number().nullable(),
  elapsed_hours: z.number().nullable(),
  status: z.string(), // 'active', 'breached', 'fulfilled'
  last_updated: z.string(),
});

const feedbackSchema = z.object({
  ticket_id: z.string().uuid(),
  rating: z.number().int().min(1).max(5),
  review: z.string().max(1000).nullable(),
  created_at: z.string(),
});

const notificationSchema = z.object({
  id: z.string().uuid(),
  ticket_id: z.string().uuid(),
  user_id: z.string().uuid(),
  channel: z.string(), // 'push', 'sms', 'email'
  message: z.string(),
  sent_at: z.string(),
  ticket: z.object({
    id: z.string().uuid(),
    device_category: z.string(),
    brand: z.string().nullable(),
    model: z.string().nullable(),
    status: z.string(),
  }).optional(),
});

// Type definitions
export type Ticket = z.infer<typeof ticketSchema>;
export type TimelineEvent = z.infer<typeof timelineEventSchema>;
export type SLASnapshot = z.infer<typeof slaSnapshotSchema>;
export type Feedback = z.infer<typeof feedbackSchema>;
export type Notification = z.infer<typeof notificationSchema>;

// API wrapper functions
export const customerAPI = {
  // Get customer's tickets
  getMyTickets: async (): Promise<Ticket[]> => {
    try {
      const response = await fetch('/api/customer/tickets');

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in to access your tickets');
        }
        throw new Error(`Failed to fetch tickets: ${response.statusText}`);
      }

      const data = await response.json();
      return data.map((item: any) => ticketSchema.parse(item));
    } catch (error) {
      console.error('Error fetching customer tickets:', error);
      throw error;
    }
  },

  // Get specific ticket details
  getTicketDetails: async (ticketId: string): Promise<Ticket> => {
    try {
      const response = await fetch(`/api/customer/tickets/${ticketId}`);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in to access ticket details');
        }
        if (response.status === 404) {
          throw new Error('Ticket not found');
        }
        throw new Error(`Failed to fetch ticket: ${response.statusText}`);
      }

      const data = await response.json();
      return ticketSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in get ticket details:', error.issues);
        throw new Error('Data validation failed');
      }
      console.error('Error fetching customer ticket details:', error);
      throw error;
    }
  },

  // Get timeline for a ticket
  getTimeline: async (ticketId: string): Promise<TimelineEvent[]> => {
    try {
      const response = await fetch(`/api/customer/timeline/${ticketId}`);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in to access timeline');
        }
        if (response.status === 404) {
          throw new Error('Ticket not found');
        }
        throw new Error(`Failed to fetch timeline: ${response.statusText}`);
      }

      const data = await response.json();
      return data.map((item: any) => timelineEventSchema.parse(item));
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in get timeline:', error.issues);
        throw new Error('Data validation failed');
      }
      console.error('Error fetching customer timeline:', error);
      throw error;
    }
  },

  // Get SLA status for a ticket
  getSLA: async (ticketId: string): Promise<SLASnapshot> => {
    try {
      const response = await fetch(`/api/customer/sla/${ticketId}`);

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in to access SLA status');
        }
        if (response.status === 404) {
          throw new Error('Ticket not found');
        }
        throw new Error(`Failed to fetch SLA: ${response.statusText}`);
      }

      const data = await response.json();

      // Handle the case where no SLA snapshot exists (returns default response)
      if (data.status === 'not_available') {
        return slaSnapshotSchema.parse(data);
      }

      return slaSnapshotSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in get SLA:', error.issues);
        throw new Error('Data validation failed');
      }
      console.error('Error fetching customer SLA:', error);
      throw error;
    }
  },

  // Submit feedback for a ticket
  submitFeedback: async (ticketId: string, rating: number, review?: string | null): Promise<Feedback> => {
    try {
      const response = await fetch('/api/customer/feedback', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          ticket_id: ticketId,
          rating,
          review: review || null,
        }),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in to submit feedback');
        }
        if (response.status === 400) {
          const errorData = await response.json();
          throw new Error(`Validation error: ${JSON.stringify(errorData.details || errorData)}`);
        }
        throw new Error(`Failed to submit feedback: ${response.statusText}`);
      }

      const data = await response.json();
      return feedbackSchema.parse(data);
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in submit feedback:', error.issues);
        throw new Error('Input validation failed');
      }
      console.error('Error submitting customer feedback:', error);
      throw error;
    }
  },

  // Get notification history
  getNotifications: async (): Promise<Notification[]> => {
    try {
      const response = await fetch('/api/customer/notifications');

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Unauthorized: Please log in to access notifications');
        }
        throw new Error(`Failed to fetch notifications: ${response.statusText}`);
      }

      const data = await response.json();
      return data.map((item: any) => notificationSchema.parse(item));
    } catch (error) {
      if (error instanceof z.ZodError) {
        console.error('Zod validation error in get notifications:', error.issues);
        throw new Error('Data validation failed');
      }
      console.error('Error fetching customer notifications:', error);
      throw error;
    }
  },
};