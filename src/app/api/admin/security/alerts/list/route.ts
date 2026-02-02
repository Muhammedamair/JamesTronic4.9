import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth/withAuth'; // Assuming we have an auth middleware

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// GET route to list security alerts with filters
export const GET = withAuth(async (user, request) => {
  try {
    const { searchParams } = new URL(request.url);

    // Get filters from query parameters
    const severity = searchParams.get('severity') || '';
    const status = searchParams.get('status') || '';
    const dateFrom = searchParams.get('date_from') || '';
    const dateTo = searchParams.get('date_to') || '';
    const limit = parseInt(searchParams.get('limit') || '50');
    const offset = parseInt(searchParams.get('offset') || '0');

    let query = supabase
      .from('security_alerts')
      .select(`
        id,
        rule_id,
        source_type,
        severity,
        message,
        metadata,
        status,
        created_at,
        resolved_at
      `)
      .order('created_at', { ascending: false })
      .range(offset, offset + limit - 1);

    // Apply filters
    if (severity && severity !== 'all') {
      query = query.eq('severity', severity);
    }

    if (status && status !== 'all') {
      query = query.eq('status', status);
    }

    if (dateFrom) {
      query = query.gte('created_at', dateFrom);
    }

    if (dateTo) {
      query = query.lte('created_at', dateTo);
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
        offset,
        limit
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error fetching security alerts:', error);
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
}, ['admin', 'staff']);