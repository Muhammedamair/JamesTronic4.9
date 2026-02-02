import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SessionManager } from '@/lib/auth-system/sessionManager';
import { getSessionId } from '@/lib/auth-system/sessionUtils';

export async function GET(req: NextRequest) {
  try {
    // Get session ID from cookies
    const sessionId = await getSessionId();

    if (!sessionId) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized - no session'
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the current session
    const sessionResponse = await SessionManager.validateSession();

    if (!sessionResponse.valid || !sessionResponse.session) {
      return new Response(
        JSON.stringify({
          error: 'Unauthorized'
        }),
        {
          status: 401,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Only allow admin role to access security events
    if (sessionResponse.session.role !== 'admin') {
      return new Response(
        JSON.stringify({
          error: 'Forbidden'
        }),
        {
          status: 403,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Create Supabase client
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    const supabase = createClient(supabaseUrl, supabaseAnonKey);

    // Parse query parameters for filtering
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') || '50');
    const eventType = searchParams.get('event_type') || '';
    const severity = searchParams.get('severity') || '';
    const days = parseInt(searchParams.get('days') || '7');

    // Calculate the date 'days' ago
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    // Build the query
    let query = supabase
      .from('admin_security_events')
      .select('*')
      .eq('admin_user_id', sessionResponse.session.userId)
      .gte('event_timestamp', cutoffDate.toISOString())
      .order('event_timestamp', { ascending: false })
      .limit(limit);

    // Apply filters if provided
    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query;

    if (error) {
      console.error('Error fetching security events:', error);
      return new Response(
        JSON.stringify({
          error: 'Failed to fetch security events'
        }),
        {
          status: 500,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        events: data
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error in security events API:', error);

    return new Response(
      JSON.stringify({
        error: 'Internal server error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}