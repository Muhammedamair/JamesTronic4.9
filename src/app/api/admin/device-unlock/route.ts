import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { SessionManager } from '@/lib/auth-system/sessionManager';

// Environment variables
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

export async function POST(req: NextRequest) {
  try {
    // Validate admin session
    const sessionValidation = await SessionManager.validateSession();
    if (!sessionValidation.valid || !sessionValidation.session || sessionValidation.session.role !== 'admin') {
      return new Response(
        JSON.stringify({ success: false, error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Parse request body
    const body = await req.json();
    const { user_id, action } = body;

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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

    // Check if user exists and is technician or transporter
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role')
      .eq('id', user_id)
      .single();

    if (profileError || !profile) {
      return new Response(
        JSON.stringify({ success: false, error: 'User not found' }),
        { status: 404, headers: { 'Content-Type': 'application/json' } }
      );
    }

    if (profile.role !== 'technician' && profile.role !== 'transporter') {
      return new Response(
        JSON.stringify({ success: false, error: 'Device lock only applies to technicians and transporters' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Perform the requested action
    if (action === 'unlock') {
      // Remove the device lock entry
      const { error: deleteError } = await supabase
        .from('device_lock')
        .delete()
        .eq('user_id', user_id);

      if (deleteError) {
        console.error('Error unlocking device:', deleteError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to unlock device' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      // Log the admin action
      const { error: logError } = await supabase
        .from('device_lock_conflicts') // Using the conflicts table to log admin actions too
        .insert({
          user_id: user_id,
          old_device: null,
          new_device: null,
          ip_address: req.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
          user_agent: req.headers.get('user-agent') || 'unknown',
          detected_at: new Date().toISOString()
        });

      if (logError) {
        console.error('Error logging device unlock action:', logError);
        // Don't fail the request just because logging failed
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Device unlocked successfully. User can now login from a new device.'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else if (action === 'force_override') {
      // Mark that override is allowed for this user
      const { error: updateError } = await supabase
        .from('device_lock')
        .update({ override_allowed: true })
        .eq('user_id', user_id);

      if (updateError) {
        console.error('Error setting override flag:', updateError);
        return new Response(
          JSON.stringify({ success: false, error: 'Failed to set override flag' }),
          { status: 500, headers: { 'Content-Type': 'application/json' } }
        );
      }

      return new Response(
        JSON.stringify({
          success: true,
          message: 'Override flag set successfully.'
        }),
        { status: 200, headers: { 'Content-Type': 'application/json' } }
      );
    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action. Use "unlock" or "force_override".' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
      );
    }
  } catch (error) {
    console.error('Error in device unlock API:', error);

    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

// GET endpoint to retrieve device lock information
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

    // Get user_id from query parameters
    const { searchParams } = new URL(req.url);
    const user_id = searchParams.get('user_id');

    if (!user_id) {
      return new Response(
        JSON.stringify({ success: false, error: 'user_id is required' }),
        { status: 400, headers: { 'Content-Type': 'application/json' } }
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

    // Get device lock information
    const { data: deviceLock, error: lockError } = await supabase
      .from('device_lock')
      .select('*')
      .eq('user_id', user_id)
      .single();

    if (lockError && lockError.code !== 'PGRST116') { // PGRST116 means "row not found"
      console.error('Error fetching device lock:', lockError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch device lock information' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get user profile information
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('full_name, phone, role')
      .eq('id', user_id)
      .single();

    if (profileError) {
      console.error('Error fetching user profile:', profileError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch user profile' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    // Get recent device conflicts
    const { data: conflicts, error: conflictsError } = await supabase
      .from('device_lock_conflicts')
      .select('*')
      .eq('user_id', user_id)
      .order('detected_at', { ascending: false })
      .limit(10);

    if (conflictsError) {
      console.error('Error fetching device conflicts:', conflictsError);
      return new Response(
        JSON.stringify({ success: false, error: 'Failed to fetch device conflict information' }),
        { status: 500, headers: { 'Content-Type': 'application/json' } }
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        data: {
          user: profile,
          device_lock: deviceLock || null,
          conflicts: conflicts || []
        }
      }),
      { status: 200, headers: { 'Content-Type': 'application/json' } }
    );
  } catch (error) {
    console.error('Error in device unlock GET API:', error);

    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}