import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * GET /api/admin/workforce/incidents
 * Fetches workforce incidents for admin review.
 */
export async function GET(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify admin/staff role
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single();

        if (!profile || !['admin', 'staff'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Parse query params
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('user_id');
        const resolved = searchParams.get('resolved'); // 'true', 'false', or null for all
        const severity = searchParams.get('severity');

        // Build query
        let query = supabase
            .from('workforce_incidents')
            .select(`
        *,
        profiles:user_id (
          full_name,
          role
        ),
        reporter:reported_by (
          full_name
        )
      `)
            .order('created_at', { ascending: false })
            .limit(100);

        if (userId) {
            query = query.eq('user_id', userId);
        }

        if (resolved === 'true') {
            query = query.not('resolved_at', 'is', null);
        } else if (resolved === 'false') {
            query = query.is('resolved_at', null);
        }

        if (severity) {
            query = query.eq('severity', severity);
        }

        const { data: incidents, error } = await query;

        if (error) {
            console.error('Error fetching workforce incidents:', error);
            return NextResponse.json({ error: 'Failed to fetch incidents' }, { status: 500 });
        }

        return NextResponse.json(incidents);
    } catch (error) {
        console.error('Unexpected error in workforce incidents API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}

/**
 * POST /api/admin/workforce/incidents
 * Logs a new workforce incident.
 */
export async function POST(request: NextRequest) {
    try {
        const supabase = await createClient();

        // Verify admin/staff role
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('user_id', user.id)
            .single();

        if (!profile || !['admin', 'staff'].includes(profile.role)) {
            return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
        }

        // Parse request body
        const body = await request.json();
        const { user_id, incident_type, severity, description, ticket_id, transport_job_id } = body;

        if (!user_id || !incident_type || !description) {
            return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
        }

        // Call RPC to log incident
        const { data: incidentId, error } = await supabase.rpc('rpc_log_workforce_incident', {
            p_user_id: user_id,
            p_incident_type: incident_type,
            p_severity: severity || 'low',
            p_description: description,
            p_ticket_id: ticket_id || null,
            p_transport_job_id: transport_job_id || null
        });

        if (error) {
            console.error('Error logging workforce incident:', error);
            return NextResponse.json({ error: 'Failed to log incident' }, { status: 500 });
        }

        return NextResponse.json({ incident_id: incidentId }, { status: 201 });
    } catch (error) {
        console.error('Unexpected error in workforce incidents API:', error);
        return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
    }
}
