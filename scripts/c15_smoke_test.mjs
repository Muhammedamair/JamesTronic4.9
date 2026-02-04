#!/usr/bin/env node
/**
 * C15 AI Brain Cockpit - E2E Smoke Test
 * 
 * This script validates the full AI Brain workflow:
 * 1. Create a test event (with valid UUID entity_id)
 * 2. Process pending events
 * 3. Verify recommendations generated
 * 4. Review a recommendation
 * 5. Verify audit logs (EVENT_PROCESSED + RECOMMENDATION_REVIEWED)
 * 
 * Usage:
 *   ADMIN_JWT="your-access-token" node scripts/c15_smoke_test.mjs
 * 
 * Environment Variables:
 *   BASE_URL    - API base URL (default: http://localhost:3003)
 *   ADMIN_JWT   - Required admin access_token (NOT the cookie blob)
 *   BATCH_SIZE  - Events to process per batch (default: 3)
 */

import crypto from 'crypto';

const BASE_URL = process.env.BASE_URL || 'http://localhost:3003';
const ADMIN_JWT = process.env.ADMIN_JWT;
const BATCH_SIZE = parseInt(process.env.BATCH_SIZE || '3');

// Colors for terminal output
const colors = {
    reset: '\x1b[0m',
    green: '\x1b[32m',
    red: '\x1b[31m',
    yellow: '\x1b[33m',
    cyan: '\x1b[36m',
    dim: '\x1b[2m'
};

function log(msg, color = 'reset') {
    console.log(`${colors[color]}${msg}${colors.reset}`);
}

function logStep(step, msg) {
    console.log(`\n${colors.cyan}[Step ${step}]${colors.reset} ${msg}`);
}

async function fetchWithDebug(url, options, stepName) {
    const res = await fetch(url, options);
    if (!res.ok) {
        const text = await res.text();
        log(`   ❌ ${stepName} failed: ${res.status}`, 'red');
        log(`   Response: ${text.substring(0, 500)}`, 'dim');
        throw new Error(`${stepName} failed: ${res.status} - ${text.substring(0, 200)}`);
    }
    return res;
}

async function main() {
    console.log('\n' + '='.repeat(60));
    log('  C15 AI Brain Cockpit - E2E Smoke Test', 'cyan');
    console.log('='.repeat(60));

    // Validate required env
    if (!ADMIN_JWT) {
        log('\n❌ ADMIN_JWT environment variable is required.', 'red');
        log('   Get it via: supabase.auth.getSession().then(s => console.log(s.data.session.access_token))', 'dim');
        process.exit(1);
    }

    log(`\nBase URL: ${BASE_URL}`, 'dim');
    log(`Batch Size: ${BATCH_SIZE}`, 'dim');

    const results = {
        eventId: null,
        recommendationId: null,
        processedCount: 0,
        skippedCount: 0,
        errorCount: 0,
        reviewedRecommendation: false,
        auditLogsFound: { EVENT_PROCESSED: false, RECOMMENDATION_REVIEWED: false }
    };

    const authHeaders = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${ADMIN_JWT}`
    };

    try {
        // ─────────────────────────────────────────────────────────────
        // Step 1: Create a test event with valid UUID
        // ─────────────────────────────────────────────────────────────
        logStep(1, 'Creating test AI event...');

        const testEntityId = crypto.randomUUID();
        const eventPayload = {
            event_type: 'sla_breach',
            entity_type: 'ticket',
            entity_id: testEntityId,
            payload: {
                source: 'c15_smoke_test',
                timestamp: new Date().toISOString(),
                test_run_id: crypto.randomUUID()
            }
        };

        const eventRes = await fetchWithDebug(
            `${BASE_URL}/api/admin/ai-brain/events`,
            { method: 'POST', headers: authHeaders, body: JSON.stringify(eventPayload) },
            'Create Event'
        );

        const eventData = await eventRes.json();
        results.eventId = eventData.id || eventData.event_id;
        log(`   ✓ Created event: ${results.eventId}`, 'green');
        log(`   → Entity ID: ${testEntityId}`, 'dim');

        // ─────────────────────────────────────────────────────────────
        // Step 2: Process pending events
        // ─────────────────────────────────────────────────────────────
        logStep(2, `Processing pending events (batch_size=${BATCH_SIZE})...`);

        const processRes = await fetchWithDebug(
            `${BASE_URL}/api/admin/ai-brain/process`,
            { method: 'POST', headers: authHeaders, body: JSON.stringify({ batch_size: BATCH_SIZE }) },
            'Process Events'
        );

        const processData = await processRes.json();
        results.processedCount = processData.processed_count || 0;
        results.skippedCount = processData.skipped_count || 0;
        results.errorCount = processData.error_count || 0;

        log(`   ✓ Processed: ${results.processedCount} | Skipped: ${results.skippedCount} | Errors: ${results.errorCount}`, 'green');

        // ─────────────────────────────────────────────────────────────
        // Step 3: Find a PENDING recommendation to review
        // ─────────────────────────────────────────────────────────────
        logStep(3, 'Fetching PENDING recommendations...');

        const recsRes = await fetchWithDebug(
            `${BASE_URL}/api/admin/ai-brain/recommendations?status=PENDING`,
            { headers: authHeaders },
            'Fetch Recommendations'
        );

        const recsData = await recsRes.json();
        const pendingRecs = recsData.recommendations || recsData.data || recsData || [];

        if (pendingRecs.length === 0) {
            log('   ⚠️  No PENDING recommendations found. Skipping review step.', 'yellow');
        } else {
            results.recommendationId = pendingRecs[0].id;
            log(`   ✓ Found ${pendingRecs.length} pending recommendations`, 'green');
            log(`   → Will review: ${results.recommendationId}`, 'dim');
        }

        // ─────────────────────────────────────────────────────────────
        // Step 4: Review the recommendation
        // ─────────────────────────────────────────────────────────────
        if (results.recommendationId) {
            logStep(4, 'Reviewing recommendation (APPROVED)...');

            const reviewRes = await fetchWithDebug(
                `${BASE_URL}/api/admin/ai-brain/recommendations/${results.recommendationId}/review`,
                {
                    method: 'PATCH',
                    headers: authHeaders,
                    body: JSON.stringify({
                        status: 'APPROVED',
                        review_note: 'Approved via C15 smoke test script'
                    })
                },
                'Review Recommendation'
            );

            results.reviewedRecommendation = true;
            log('   ✓ Recommendation approved successfully', 'green');
        } else {
            logStep(4, 'Skipping review (no pending recommendations)');
        }

        // ─────────────────────────────────────────────────────────────
        // Step 5: Verify audit logs
        // ─────────────────────────────────────────────────────────────
        logStep(5, 'Verifying audit logs...');

        const auditRes = await fetchWithDebug(
            `${BASE_URL}/api/admin/ai-brain/audit?limit=50`,
            { headers: authHeaders },
            'Fetch Audit Logs'
        );

        const auditData = await auditRes.json();
        const logs = auditData.logs || auditData.data || auditData || [];

        for (const entry of logs.slice(0, 30)) {
            if (entry.action_taken === 'EVENT_PROCESSED') {
                results.auditLogsFound.EVENT_PROCESSED = true;
            }
            if (entry.action_taken === 'RECOMMENDATION_REVIEWED') {
                results.auditLogsFound.RECOMMENDATION_REVIEWED = true;
            }
        }

        log(`   → EVENT_PROCESSED: ${results.auditLogsFound.EVENT_PROCESSED ? '✓' : '✗'}`,
            results.auditLogsFound.EVENT_PROCESSED ? 'green' : 'red');
        log(`   → RECOMMENDATION_REVIEWED: ${results.auditLogsFound.RECOMMENDATION_REVIEWED ? '✓' : '✗'}`,
            results.auditLogsFound.RECOMMENDATION_REVIEWED ? 'green' :
                (results.reviewedRecommendation ? 'red' : 'yellow'));

        // ─────────────────────────────────────────────────────────────
        // Final Summary + PASS/FAIL Logic
        // ─────────────────────────────────────────────────────────────
        console.log('\n' + '─'.repeat(60));
        log('  SMOKE TEST SUMMARY', 'cyan');
        console.log('─'.repeat(60));

        console.log(`
  Event ID:          ${results.eventId || '(failed)'}
  Recommendation ID: ${results.recommendationId || '(none found)'}
  Processed:         ${results.processedCount}
  Skipped:           ${results.skippedCount}
  Errors:            ${results.errorCount}
`);

        // Strict PASS criteria
        const processingOk = (results.processedCount > 0 || results.skippedCount > 0) && results.errorCount === 0;
        const auditOk = results.auditLogsFound.EVENT_PROCESSED;
        const reviewAuditOk = !results.reviewedRecommendation || results.auditLogsFound.RECOMMENDATION_REVIEWED;

        const passed = processingOk && auditOk && reviewAuditOk;

        if (!processingOk) {
            log('   ✗ Processing check failed (error_count > 0 or nothing processed)', 'red');
        }
        if (!auditOk) {
            log('   ✗ EVENT_PROCESSED audit log not found', 'red');
        }
        if (!reviewAuditOk) {
            log('   ✗ RECOMMENDATION_REVIEWED audit log not found (review was performed)', 'red');
        }

        if (passed) {
            log('\n  ✅ PASS - AI Brain workflow validated successfully', 'green');
            console.log('─'.repeat(60) + '\n');
            process.exit(0);
        } else {
            log('\n  ❌ FAIL - Issues detected during smoke test', 'red');
            console.log('─'.repeat(60) + '\n');
            process.exit(1);
        }

    } catch (error) {
        console.log('\n' + '─'.repeat(60));
        log(`  ❌ CRITICAL ERROR: ${error.message}`, 'red');
        console.log('─'.repeat(60) + '\n');
        process.exit(1);
    }
}

main();
