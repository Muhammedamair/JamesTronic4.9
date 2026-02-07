import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth/withAuth';
import { AuditLogger } from '@/lib/security/auditLogger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// POST route to export audit logs
export const POST = withAuth(async (user, request) => {
  try {
    const body = await request.json();

    // Get filters from request body
    const {
      date_from,
      date_to,
      actor_user_id,
      event_type,
      entity_type,
      severity
    } = body;

    // Build query with filters
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
      `)
      .order('created_at', { ascending: false });

    // Apply filters
    if (date_from) {
      query = query.gte('created_at', date_from);
    }

    if (date_to) {
      query = query.lte('created_at', date_to);
    }

    if (actor_user_id) {
      query = query.eq('actor_user_id', actor_user_id);
    }

    if (event_type) {
      query = query.eq('event_type', event_type);
    }

    if (entity_type) {
      query = query.eq('entity_type', entity_type);
    }

    if (severity) {
      query = query.eq('severity', severity);
    }

    const { data, error } = await query;

    if (error) {
      throw new Error(error.message);
    }

    // Create CSV content
    const csvContent = convertToCSV(data || []);

    // Log the export action
    const auditLogger = new AuditLogger();
    await auditLogger.logAuditLogExport(user.id, user.sessionId || 'unknown', body,
      request.headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown',
      request.headers.get('user-agent') || 'unknown');

    // Return CSV as downloadable response
    return new Response(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="audit-logs-export.csv"',
      }
    });
  } catch (error) {
    console.error('Error exporting audit logs:', error);
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

// Helper function to convert audit log data to CSV format
function convertToCSV(data: any[]): string {
  if (!data || data.length === 0) {
    return '';
  }

  // Define CSV headers
  const headers = [
    'ID',
    'Timestamp',
    'Actor User ID',
    'Actor Role',
    'Session ID',
    'IP Address',
    'User Agent',
    'Event Type',
    'Entity Type',
    'Entity ID',
    'Severity',
    'Metadata',
    'Previous Hash',
    'Hash'
  ];

  // Create CSV header row
  let csv = headers.join(',') + '\n';

  // Add data rows
  for (const row of data) {
    const csvRow = [
      `"${row.id}"`,
      `"${row.created_at}"`,
      `"${row.actor_user_id || ''}"`,
      `"${row.actor_role || ''}"`,
      `"${row.session_id || ''}"`,
      `"${row.ip_address || ''}"`,
      `"${row.user_agent || ''}"`,
      `"${row.event_type}"`,
      `"${row.entity_type}"`,
      `"${row.entity_id || ''}"`,
      `"${row.severity}"`,
      `"${JSON.stringify(row.metadata).replace(/"/g, '""')}"`, // Escape quotes in JSON
      `"${row.prev_hash || ''}"`,
      `"${row.hash}"`
    ].join(',');

    csv += csvRow + '\n';
  }

  return csv;
}