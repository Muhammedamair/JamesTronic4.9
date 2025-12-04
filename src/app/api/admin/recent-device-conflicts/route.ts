import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SessionManager } from '@/lib/auth-system/sessionManager';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function GET(req: NextRequest) {
  try {
    // Validate admin session
    const sessionValidation = await SessionManager.validateSession();
    if (!sessionValidation.valid || !sessionValidation.session || sessionValidation.session.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Server configuration error' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // Get recent device conflicts with user information
    const { data: conflicts, error: conflictsError } = await supabase
      .from('device_lock_conflicts')
      .select(`
        *,
        profiles (full_name)
      `)
      .order('detected_at', { ascending: false })
      .limit(20); // Get the 20 most recent conflicts

    if (conflictsError) {
      console.error('Error fetching recent conflicts:', conflictsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch recent conflicts' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Map conflicts to include user names
    const result = conflicts.map(conflict => ({
      id: conflict.id,
      user_id: conflict.user_id,
      user_name: conflict.profiles?.full_name || 'Unknown User',
      detected_at: conflict.detected_at,
      old_device: conflict.old_device,
      new_device: conflict.new_device,
      ip_address: conflict.ip_address,
      user_agent: conflict.user_agent,
    }));

    return new Response(
      JSON.stringify({ 
        success: true,
        conflicts: result
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in recent conflicts API:', error);

    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}