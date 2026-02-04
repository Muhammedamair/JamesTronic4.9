import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';
import { withAuth } from '@/lib/auth/withAuth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// GET route to check the integrity of audit log entries
export const GET = withAuth(async (user, request) => {
  try {
    const { searchParams } = new URL(request.url);

    // Get date range parameters
    const dateFrom = searchParams.get('date_from');
    const dateTo = searchParams.get('date_to');

    if (!dateFrom) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'date_from parameter is required'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Build query with date range
    let query = supabase
      .from('audit_log_entries')
      .select('id, created_at, actor_user_id, actor_role, session_id, ip_address, user_agent, event_type, entity_type, entity_id, severity, metadata, prev_hash, hash')
      .order('created_at', { ascending: true }); // Ascending order to check hash chain properly

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    if (!data || data.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          ok: true,
          message: 'No logs found in the specified range'
        }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Check the hash chain integrity
    let prevHash = null;
    let firstInvalidId = null;

    for (const log of data) {
      // Verify the current log's prev_hash matches the previous log's hash
      if (log.prev_hash !== prevHash) {
        firstInvalidId = log.id;
        break;
      }

      // Compute expected hash for this log entry and compare with stored hash
      const expectedHash = computeHashForLog(log);
      if (expectedHash !== log.hash) {
        firstInvalidId = log.id;
        break;
      }

      // Update prevHash for the next iteration
      prevHash = log.hash;
    }

    // Return integrity check result
    return new Response(
      JSON.stringify({
        success: true,
        ok: !firstInvalidId,
        first_invalid_id: firstInvalidId,
        message: firstInvalidId
          ? `Integrity check failed. First invalid entry: ${firstInvalidId}`
          : 'Integrity check passed. All entries are valid.'
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error checking audit log integrity:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error'
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  }
}, ['admin']);

// Helper function to compute hash for a log entry (should match the database trigger)
function computeHashForLog(log: any): string {
  // Create input string for hashing - must match the trigger in the database
  const inputString =
    (log.created_at || '') +
    (log.actor_user_id || '') +
    (log.actor_role || '') +
    (log.session_id || '') +
    (log.ip_address || '') +
    (log.user_agent || '') +
    (log.event_type || '') +
    (log.entity_type || '') +
    (log.entity_id || '') +
    (log.severity || '') +
    (JSON.stringify(log.metadata || {})) +
    (log.prev_hash || '');

  // Compute SHA-256 hash
  const hash = createHash('sha256');
  hash.update(inputString);
  return hash.digest('hex');
}