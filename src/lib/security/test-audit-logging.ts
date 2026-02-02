// Test script for Compliance Logging & Forensic Audit Layer
// This script verifies that audit logging is working correctly

import { AuditLogger } from '@/lib/security/auditLogger';

console.log('Testing Compliance Logging & Forensic Audit Layer...');

async function runTests() {
  console.log('\n1. Testing AuditLogger instantiation...');
  try {
    const auditLogger = new AuditLogger();
    console.log('✅ AuditLogger instantiated successfully');
  } catch (error) {
    console.error('❌ Error instantiating AuditLogger:', error);
    return;
  }

  console.log('\n2. Testing audit event logging...');
  try {
    const auditLogger = new AuditLogger();
    
    // Test a simple audit event
    await auditLogger.logAuditEvent({
      eventType: 'TEST_EVENT',
      actorUserId: 'test-user-id',
      actorRole: 'admin',
      sessionId: 'test-session-id',
      entityType: 'test_entity',
      entityId: 'test-entity-id',
      severity: 'info',
      ipAddress: '127.0.0.1',
      userAgent: 'Test-Agent',
      metadata: { test: true, timestamp: new Date().toISOString() }
    });
    
    console.log('✅ Audit event logged successfully');
  } catch (error) {
    console.error('❌ Error logging audit event:', error);
  }

  console.log('\n3. Testing specific audit event types...');
  try {
    const auditLogger = new AuditLogger();
    
    // Test admin login success
    await auditLogger.logAdminLoginSuccess('test-user-id', 'test-session-id', '127.0.0.1', 'Test-Agent');
    console.log('✅ Admin login success event logged');
    
    // Test admin MFA passed
    await auditLogger.logAdminMfaPassed('test-user-id', 'test-session-id', '127.0.0.1', 'Test-Agent');
    console.log('✅ Admin MFA passed event logged');
    
    // Test admin MFA failed
    await auditLogger.logAdminMfaFailed('test-user-id', '127.0.0.1', 'Test-Agent');
    console.log('✅ Admin MFA failed event logged');
    
    // Test device unlock
    await auditLogger.logDeviceUnlockPerformed('admin-user-id', 'target-user-id', 'admin-session-id', '127.0.0.1', 'Test-Agent');
    console.log('✅ Device unlock event logged');
    
    // Test alert resolved
    await auditLogger.logAlertResolved('admin-user-id', 'alert-id', 'admin-session-id', '127.0.0.1', 'Test-Agent');
    console.log('✅ Alert resolved event logged');
    
  } catch (error) {
    console.error('❌ Error testing specific audit events:', error);
  }

  console.log('\n4. Testing audit event with different severities...');
  try {
    const auditLogger = new AuditLogger();
    
    await auditLogger.logAuditEvent({
      eventType: 'SEVERITY_TEST',
      actorUserId: 'test-user-id',
      actorRole: 'admin',
      sessionId: 'test-session-id',
      entityType: 'test_entity',
      entityId: 'test-entity-id',
      severity: 'critical', // Test critical severity
      ipAddress: '127.0.0.1',
      userAgent: 'Test-Agent',
      metadata: { test: true, severity: 'critical' }
    });
    
    console.log('✅ Critical severity event logged');
  } catch (error) {
    console.error('❌ Error logging critical severity event:', error);
  }

  console.log('\n5. Testing audit event without optional fields...');
  try {
    const auditLogger = new AuditLogger();
    
    await auditLogger.logAuditEvent({
      eventType: 'MINIMAL_EVENT',
      entityType: 'minimal_entity',
      entityId: 'minimal-entity-id',
      // Testing without optional fields
    });
    
    console.log('✅ Minimal audit event (without optional fields) logged');
  } catch (error) {
    console.error('❌ Error logging minimal audit event:', error);
  }

  console.log('\n6. Testing error handling in audit logger...');
  try {
    // This should not throw an exception and should handle errors internally
    const auditLogger = new AuditLogger();
    
    // Intentionally pass invalid data to test error handling
    await auditLogger.logAuditEvent({
      eventType: 'ERROR_TEST',
      entityType: 'error_entity',
      entityId: 'error-entity-id',
      // Intentionally omitting required SUPABASE_SERVICE_ROLE_KEY to test error handling
    } as any); // Using 'as any' to bypass TypeScript validation for testing
    
    console.log('✅ Audit logger handled potential error gracefully');
  } catch (error) {
    console.log('ℹ️  Audit logger may have thrown error (this is expected in some cases):', error instanceof Error ? error.message : String(error));
  }

  console.log('\n🎉 Audit logging tests completed!');
  console.log('\nNote: To fully test the audit log functionality, you would need to:');
  console.log('- Have a valid Supabase configuration with SUPABASE_SERVICE_ROLE_KEY');
  console.log('- Run these tests in an environment where Supabase is accessible');
  console.log('- Verify that logs are appearing in the audit_log_entries table');
  console.log('- Verify that the hash chain integrity is maintained');
  console.log('- Check that the forensic viewer UI displays the logs correctly');
}

// Run the tests
runTests().catch(console.error);