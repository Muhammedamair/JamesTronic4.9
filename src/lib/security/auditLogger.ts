import { createClient } from '@supabase/supabase-js';
import { createHash } from 'crypto';

export interface AuditEventParams {
  eventType: string;
  actorUserId?: string;
  actorRole?: string;
  sessionId?: string;
  entityType: string;
  entityId?: string;
  severity?: 'info' | 'warning' | 'high' | 'critical';
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, any>;
}

export class AuditLogger {
  private supabase;

  constructor() {
    // Use service role key for writing audit logs
    this.supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    );
  }

  /**
   * Log an audit event to the append-only audit log
   */
  async logAuditEvent(params: AuditEventParams): Promise<void> {
    try {
      // Normalize inputs and fill defaults
      const {
        eventType,
        actorUserId,
        actorRole,
        sessionId,
        entityType,
        entityId,
        severity = 'info',
        ipAddress,
        userAgent,
        metadata = {}
      } = params;

      // Prepare the audit log entry
      // Note: We don't set hash or prev_hash here as they will be computed by the database trigger
      const auditEntry = {
        actor_user_id: actorUserId,
        actor_role: actorRole,
        session_id: sessionId,
        ip_address: ipAddress,
        user_agent: userAgent,
        event_type: eventType,
        entity_type: entityType,
        entity_id: entityId,
        severity,
        metadata
      };

      // Insert the audit log entry using service role (which bypasses RLS for insertion)
      const { error } = await this.supabase
        .from('audit_log_entries')
        .insert([auditEntry]);

      if (error) {
        console.error('Error inserting audit log entry:', error);
        // Note: We don't throw here to avoid blocking the primary flow for minor logging failures
      } else {
        console.log(`Audit log created: ${eventType} for ${entityType} ${entityId || 'N/A'}`);
      }
    } catch (error) {
      console.error('Unexpected error in audit logger:', error);
      // Don't throw to avoid blocking primary application flow
    }
  }

  /**
   * Log admin login success
   */
  async logAdminLoginSuccess(actorUserId: string, sessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logAuditEvent({
      eventType: 'ADMIN_LOGIN_SUCCESS',
      actorUserId,
      actorRole: 'admin',
      sessionId,
      entityType: 'session',
      entityId: sessionId,
      severity: 'info',
      ipAddress,
      userAgent,
      metadata: {
        login_time: new Date().toISOString()
      }
    });
  }

  /**
   * Log admin login failure
   */
  async logAdminLoginFailed(actorUserId: string | null, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logAuditEvent({
      eventType: 'ADMIN_LOGIN_FAILED',
      actorUserId: actorUserId || undefined,
      actorRole: 'admin',
      entityType: 'user',
      entityId: actorUserId || undefined,
      severity: 'warning',
      ipAddress,
      userAgent,
      metadata: {
        login_time: new Date().toISOString(),
        reason: 'authentication_failed'
      }
    });
  }

  /**
   * Log admin MFA passed
   */
  async logAdminMfaPassed(actorUserId: string, sessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logAuditEvent({
      eventType: 'ADMIN_MFA_PASSED',
      actorUserId,
      actorRole: 'admin',
      sessionId,
      entityType: 'mfa_session',
      entityId: sessionId, // Could be the MFA challenge ID in a real implementation
      severity: 'info',
      ipAddress,
      userAgent,
      metadata: {
        verification_time: new Date().toISOString(),
        method: 'totp'
      }
    });
  }

  /**
   * Log admin MFA failed
   */
  async logAdminMfaFailed(actorUserId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logAuditEvent({
      eventType: 'ADMIN_MFA_FAILED',
      actorUserId,
      actorRole: 'admin',
      entityType: 'mfa_session',
      severity: 'warning',
      ipAddress,
      userAgent,
      metadata: {
        verification_time: new Date().toISOString(),
        method: 'totp',
        reason: 'invalid_token'
      }
    });
  }

  /**
   * Log device unlock performed by admin
   */
  async logDeviceUnlockPerformed(actorUserId: string, targetUserId: string, sessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logAuditEvent({
      eventType: 'DEVICE_UNLOCK_PERFORMED',
      actorUserId,
      actorRole: 'admin',
      sessionId,
      entityType: 'device_lock',
      entityId: targetUserId,
      severity: 'high',
      ipAddress,
      userAgent,
      metadata: {
        target_user_id: targetUserId,
        action_time: new Date().toISOString(),
        action_type: 'admin_unlock'
      }
    });
  }

  /**
   * Log device lock override allowed
   */
  async logDeviceLockOverride(actorUserId: string, targetUserId: string, sessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logAuditEvent({
      eventType: 'DEVICE_LOCK_OVERRIDE',
      actorUserId,
      actorRole: 'admin',
      sessionId,
      entityType: 'device_lock',
      entityId: targetUserId,
      severity: 'warning',
      ipAddress,
      userAgent,
      metadata: {
        target_user_id: targetUserId,
        action_time: new Date().toISOString(),
        action_type: 'force_override'
      }
    });
  }

  /**
   * Log alert resolution
   */
  async logAlertResolved(actorUserId: string, alertId: string, sessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logAuditEvent({
      eventType: 'ALERT_RESOLVED',
      actorUserId,
      actorRole: 'admin',
      sessionId,
      entityType: 'security_alert',
      entityId: alertId,
      severity: 'info',
      ipAddress,
      userAgent,
      metadata: {
        resolved_time: new Date().toISOString(),
        previous_status: 'open'
      }
    });
  }

  /**
   * Log role change
   */
  async logRoleChanged(actorUserId: string, targetUserId: string, oldRole: string, newRole: string, sessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logAuditEvent({
      eventType: 'ROLE_CHANGED',
      actorUserId,
      actorRole: 'admin',
      sessionId,
      entityType: 'user',
      entityId: targetUserId,
      severity: 'critical',
      ipAddress,
      userAgent,
      metadata: {
        old_role: oldRole,
        new_role: newRole,
        changed_time: new Date().toISOString()
      }
    });
  }

  /**
   * Log audit log export
   */
  async logAuditLogExport(actorUserId: string, sessionId: string, filterParams: Record<string, any>, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logAuditEvent({
      eventType: 'AUDIT_LOG_EXPORTED',
      actorUserId,
      actorRole: 'admin',
      sessionId,
      entityType: 'audit_log',
      entityId: new Date().toISOString(), // Use timestamp as entity ID for exports
      severity: 'info',
      ipAddress,
      userAgent,
      metadata: {
        export_time: new Date().toISOString(),
        filters: filterParams
      }
    });
  }

  /**
   * Log security incident confirmed
   */
  async logSecurityIncidentConfirmed(actorUserId: string, incidentDetails: string, sessionId: string, ipAddress?: string, userAgent?: string): Promise<void> {
    await this.logAuditEvent({
      eventType: 'INCIDENT_CONFIRMED',
      actorUserId,
      actorRole: 'admin',
      sessionId,
      entityType: 'security_incident',
      entityId: new Date().toISOString(), // Use timestamp as entity ID
      severity: 'critical',
      ipAddress,
      userAgent,
      metadata: {
        confirmed_time: new Date().toISOString(),
        incident_details: incidentDetails
      }
    });
  }
}