// Helper functions for customer authentication and authorization
import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { createClient as createServerSupabaseClient } from '@/lib/supabase/server';

/**
 * Get a standard Supabase client (Server-side)
 * This uses the service role for internal operations if needed, 
 * but by default returns an anon client.
 */
export function getSupabaseClient() {
  const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    throw new Error('Missing Supabase environment variables');
  }

  return createSupabaseClient(SUPABASE_URL, SUPABASE_ANON_KEY);
}

/**
 * Centralized helper to get customer context from an authenticated request.
 * Supports BOTH Authorization header (token) and Cookies (session).
 */
export async function getCustomerIdFromAuth(token?: string | null) {
  let supabase;
  let user;

  if (token) {
    // If token is provided, use standard client with header
    supabase = createSupabaseClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        global: {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        },
      }
    );
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser(token);
    if (authError) return null;
    user = authUser;
  } else {
    // If no token, attempt cookie-based auth via server client
    supabase = await createServerSupabaseClient();
    const { data: { user: authUser }, error: authError } = await supabase.auth.getUser();
    if (authError) return null;
    user = authUser;
  }

  if (!user) return null;

  // 1. Verify this is a customer role in profiles
  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('user_id', user.id)
    .single();

  if (profileError || !profile || profile.role !== 'customer') {
    return null;
  }

  // 2. Get the customer ID linked to this user
  const { data: customer, error: customerError } = await supabase
    .from('customers')
    .select('id')
    .eq('user_id', user.id)
    .single();

  if (customerError || !customer) {
    return null;
  }

  return {
    customerId: customer.id,
    user,
    supabase
  };
}

/**
 * Verify if a customer has access to a specific ticket
 */
export async function verifyCustomerTicketAccess(customerId: string, ticketId: string) {
  const supabase = getSupabaseClient();

  const { data: ticket, error } = await supabase
    .from('tickets')
    .select('id')
    .eq('id', ticketId)
    .eq('customer_id', customerId)
    .single();

  return { ticket, error };
}