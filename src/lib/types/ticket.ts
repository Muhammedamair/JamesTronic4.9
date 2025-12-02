import { z } from 'zod';

// Define Zod schema for validation
export const ticketSchema = z.object({
  id: z.string().uuid(),
  customer_id: z.string().uuid(),
  assigned_technician_id: z.string().uuid().nullable(),
  assigned_transporter_id: z.string().uuid().nullable(),
  device_category: z.string(),
  brand: z.string().nullable(),  // According to database schema, this can be null
  model: z.string().nullable(),
  size_inches: z.number().nullable(),
  issue_summary: z.string().nullable(),  // According to database schema, this can be null
  issue_details: z.string().nullable(),
  quoted_price: z.number().nullable(),
  status: z.string(),
  status_reason: z.string().nullable(),
  created_by: z.string().uuid().nullable(),
  created_at: z.string(),  // ISO date string
  updated_at: z.string(),  // ISO date string
});

// Define the Ticket type based on the schema
export type Ticket = z.infer<typeof ticketSchema> & {
  customer: {
    name: string;
    phone_e164: string;
    area?: string;
  } | null;
  assigned_technician: {
    full_name: string;
  } | null;
  assigned_transporter: {
    full_name: string;
  } | null;
  completed_at?: string; // Optional field for completion time
};

// Define schema for creating new tickets
export const newTicketSchema = z.object({
  customer_id: z.string().uuid(),
  device_category: z.string(),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  size_inches: z.number().optional().nullable(),
  issue_summary: z.string().nullable(),  // This can be null for new tickets
  issue_details: z.string().optional().nullable(),
  quoted_price: z.number().optional().nullable(),
  status: z.string().default('pending'),
  status_reason: z.string().optional().nullable(),
  created_by: z.string().uuid().optional().nullable(),
  assigned_technician_id: z.string().uuid().optional().nullable(),
  assigned_transporter_id: z.string().uuid().optional().nullable(),
});

export type NewTicket = z.infer<typeof newTicketSchema>;

// Define the minimal ticket type that can be used without customer/tech relations
export const minimalTicketSchema = ticketSchema;
export type MinimalTicket = z.infer<typeof minimalTicketSchema>;

// Export the Zod schemas for use in API validation
export { z };