import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth/withAuth';
import { AuditLogger } from '@/lib/security/auditLogger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// GET route to list audit logs with filters
export const GET = withAuth(async (user, request) => {
  try {
    const { searchParams } = new URL(request.url);

    // Get filters from query parameters
    const page = parseInt(searchParams.get('page') || '0');
    const pageSize = Math.min(parseInt(searchParams.get('page_size') || '50'), 100); // Max 100 per page
    const dateFrom = searchParams.get('date_from') || '';
    const dateTo = searchParams.get('date_to') || '';
    const actorUserId = searchParams.get('actor_user_id') || '';
    const eventType = searchParams.get('event_type') || '';
    const entityType = searchParams.get('entity_type') || '';
    const severity = searchParams.get('severity') || '';

    // Validate pagination parameters
    if (isNaN(page) || page < 0 || isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Invalid pagination parameters'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Calculate offset
    const offset = page * pageSize;

    let query = supabase
      .from('audit_log_entries')
      .select(`
        id,
        created_at,
        actor_user_id,
        actor_role,
        session_id,
        ip_address,
        user_agent,
        event_type,
        entity_type,
        entity_id,
        severity,
        metadata,
        prev_hash,
        hash
      `, { count: 'exact' })
      .order('created_at', { ascending: false })
      .range(offset, offset + pageSize - 1);

    // Apply filters
    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
    }

    if (actorUserId) {
      query = query.eq('actor_user_id', actorUserId);
    }

    if (eventType) {
      query = query.eq('event_type', eventType);
    }

    if (entityType) {
      query = query.eq('entity_type', entityType);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(error.message);
    }

    // Return data with count for pagination
    return new Response(
      JSON.stringify({
        success: true,
        data: data || [],
        count: count || 0,
        page,
        page_size: pageSize,
        total_pages: Math.ceil((count || 0) / pageSize)
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error fetching audit logs:', error);
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