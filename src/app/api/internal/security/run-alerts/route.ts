import { NextRequest } from 'next/server';
import { AlertRuleEngine } from '@/lib/security/alertRuleEngine';
import { AlertNotifier } from '@/lib/security/alertNotifier';

// This endpoint can be called internally to run security alert processing
// Should be protected with a secret token or service role authentication
export async function POST(request: NextRequest) {
  try {
    // Verify internal request - for now using a basic secret check
    const authHeader = request.headers.get('authorization');
    const secretToken = process.env.INTERNAL_API_SECRET;
    
    if (!secretToken || authHeader !== `Bearer ${secretToken}`) {
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('[Security Alerts API] Starting security alert processing...');

    // Initialize the rule engine and process all rules
    const ruleEngine = new AlertRuleEngine();
    await ruleEngine.processRules();

    // Initialize the notifier and send notifications
    const notifier = new AlertNotifier();
    const notificationResults = await notifier.sendNotifications();

    console.log(`[Security Alerts API] Processing completed. Sent ${notificationResults.length} notifications.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Security alert processing completed',
        notification_count: notificationResults.length,
        notification_results: notificationResults
      }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[Security Alerts API] Error processing security alerts:', error);
    
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
}

// GET endpoint for testing/triggering manually
export async function GET(request: NextRequest) {
  try {
    // For development/testing purposes, we might want to allow GET requests
    // In production, this should be disabled or require additional authentication
    const isDevelopment = process.env.NODE_ENV === 'development';
    const authHeader = request.headers.get('authorization');
    const secretToken = process.env.INTERNAL_API_SECRET;
    
    if (!isDevelopment && (!secretToken || authHeader !== `Bearer ${secretToken}`)) {
      return new Response('Unauthorized', { status: 401 });
    }

    console.log('[Security Alerts API] Starting security alert processing (GET request)...');

    // Initialize the rule engine and process all rules
    const ruleEngine = new AlertRuleEngine();
    await ruleEngine.processRules();

    // Initialize the notifier and send notifications
    const notifier = new AlertNotifier();
    const notificationResults = await notifier.sendNotifications();

    console.log(`[Security Alerts API] Processing completed. Sent ${notificationResults.length} notifications.`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        message: 'Security alert processing completed (triggered via GET)',
        notification_count: notificationResults.length,
        notification_results: notificationResults
      }), 
      { 
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      }
    );
  } catch (error) {
    console.error('[Security Alerts API] Error processing security alerts:', error);
    
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
}