import { NextRequest } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { withAuth } from '@/lib/auth/withAuth';
import { AuditLogger } from '@/lib/security/auditLogger';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// POST route to mark an alert as resolved
export const POST = withAuth(async (user, request) => {
  try {
    const body = await request.json();
    const { alert_id } = body;

    // Validate request
    if (!alert_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Missing alert_id in request body'
        }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json' }
        }
      );
    }

    // Get the session ID for audit logging (if available)
    const headers = request.headers;
    const userAgent = headers.get('user-agent') || 'unknown';
    const ipAddress = headers.get('x-forwarded-for')?.split(',')[0].trim() || 'unknown';

    // Update the alert to resolved status
    const { data: alert, error: updateError } = await supabase
      .from('security_alerts')
      .update({
        status: 'resolved',
        resolved_at: new Date().toISOString()
      })
      .eq('id', alert_id)
      .select()
      .single();

    if (updateError) {
      throw new Error(updateError.message);
    }

    // Log the action in admin_security_events
    const logError = await logSecurityAction(user.id, 'ALERT_RESOLVED', {
      alert_id: alert_id,
      resolved_by: user.id,
      previous_status: alert?.status
    });

    if (logError) {
      console.error('Error logging security action:', logError);
    }

    // Also log to audit trail
    const auditLogger = new AuditLogger();
    await auditLogger.logAlertResolved(user.id, alert_id, user.sessionId || 'unknown', ipAddress, userAgent);

    return new Response(
      JSON.stringify({
        success: true,
        message: 'Alert marked as resolved successfully',
        alert: alert
      }),
      {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('Error resolving security alert:', error);
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

// Helper function to log security action
async function logSecurityAction(userId: string, eventType: string, metadata: any) {
  try {
    const { error } = await supabase
      .from('admin_security_events')
      .insert({
        admin_user_id: userId,
        event_type: eventType,
        metadata: metadata,
        severity: 'info'
      });

    return error;
  } catch (error) {
    console.error('Error in logSecurityAction helper:', error);
    return error;
  }
}