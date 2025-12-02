import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';

// Initialize Supabase client
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(request: NextRequest, { params }: { params: Promise<{ technician_id: string }> }) {
  try {
    // Get Supabase session from cookies
    const authCookies = await cookies();
    const authCookie = authCookies.get('sb-access-token');
    if (!authCookie) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(authCookie.value);

    if (userError || !user) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { technician_id: technicianId } = await params;

    // Verify that the user is authorized to access this data
    // First, get the user's role
    const { data: profile, error: profileError } = await supabase
      .from('profiles')
      .select('role, id')
      .eq('id', user.id)
      .single();

    if (profileError || !profile) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (profile.role !== 'admin' && profile.role !== 'manager' && profile.role !== 'technician') {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Technicians can only access their own data
    if (profile.role === 'technician' && profile.id !== technicianId) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get query parameters for date range filtering
    const { searchParams } = new URL(request.url);
    const startDate = searchParams.get('start_date') || '';
    const endDate = searchParams.get('end_date') || '';

    // Fetch all SLA records for this technician with optional date filters
    let allSlaQuery = supabase
      .from('technician_sla_history')
      .select('*')
      .eq('technician_id', technicianId);

    // Apply date filters if provided
    if (startDate) {
      allSlaQuery = allSlaQuery.gte('created_at', startDate);
    }
    if (endDate) {
      allSlaQuery = allSlaQuery.lte('created_at', endDate);
    }

    const { data: allSlaData, error: allSlaError } = await allSlaQuery;

    if (allSlaError) {
      console.error('Error fetching SLA data:', allSlaError);
      return Response.json({ error: 'Failed to fetch SLA data' }, { status: 500 });
    }

    // Calculate statistics from the returned data
    const totalRecords = allSlaData.length;
    const slaMetCount = allSlaData.filter(item => item.sla_met).length;
    const slaBreachedCount = allSlaData.filter(item => !item.sla_met).length;

    const slaPercentage = totalRecords > 0 ? (slaMetCount / totalRecords) * 100 : 0;

    // Get recent SLA records for detailed view
    let recentQuery = supabase
      .from('technician_sla_history')
      .select(`
        *,
        tickets!technician_sla_history_ticket_id_fkey (id, issue_summary, created_at, status)
      `)
      .eq('technician_id', technicianId)
      .order('created_at', { ascending: false })
      .limit(10); // Get last 10 records

    // Apply date filters if provided
    if (startDate) {
      recentQuery = recentQuery.gte('created_at', startDate);
    }
    if (endDate) {
      recentQuery = recentQuery.lte('created_at', endDate);
    }

    const { data: recentData, error: recentError } = await recentQuery;

    if (recentError) {
      console.error('Error fetching recent SLA data:', recentError);
      return Response.json({ error: 'Failed to fetch recent SLA data' }, { status: 500 });
    }

    // Format recent data
    const formattedRecentData = recentData.map(item => ({
      id: item.id,
      ticket_id: item.ticket_id,
      ticket_summary: item.tickets?.issue_summary || 'N/A',
      ticket_status: item.tickets?.status || 'N/A',
      ticket_created_at: item.tickets?.created_at,
      sla_target_minutes: item.sla_target_minutes,
      completion_minutes: item.completion_minutes,
      sla_met: item.sla_met,
      created_at: item.created_at,
    }));

    return Response.json({
      technician_id: technicianId,
      sla_percentage: slaPercentage,
      total_records: totalRecords,
      sla_met_count: slaMetCount,
      sla_breached_count: slaBreachedCount,
      recent_records: formattedRecentData,
    });
  } catch (error) {
    console.error('Error in GET /api/performance/sla/[technician_id]:', error);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}