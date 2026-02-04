
import dotenv from 'dotenv';
import path from 'path';
import { createClient } from '@supabase/supabase-js';

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// Use Service Role to bypass RLS for verification
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

async function main() {
    console.log('🚀 C18 V1.1 Verification (Service Role Mode) - STRICT GATES\n');
    console.log('='.repeat(60));

    try {
        // 1. Get a dealer
        console.log('\n📍 Step 1: Finding test dealer...');
        const { data: dealers, error: dError } = await supabase.from('dealers').select('id, name').limit(1);
        if (dError) throw new Error(`Failed to fetch dealer: ${dError.message}`);
        if (!dealers || dealers.length === 0) {
            throw new Error('❌ CRITICAL: No dealers found. Cannot verify without test data.');
        }
        const dealer = dealers[0];
        console.log(`✅ Dealer: ${dealer.name} (${dealer.id})`);

        // 2. Ingest a test event
        console.log('\n📍 Step 2: Ingesting test event (order_fulfilled)...');

        const { data: eventId, error: ingestError } = await supabase.rpc('rpc_dealer_event_ingest', {
            p_dealer_id: dealer.id,
            p_event_type: 'order_fulfilled',
            p_context_type: 'verification_script',
            p_context_id: crypto.randomUUID(), // Unique event each run
            p_occurred_at: new Date().toISOString(),
            p_payload: { authorized_by: 'C18_V1_1_VERIFICATION_SCRIPT', value: 500 },
            p_idempotency_key: `verify-c18-v1-1-${dealer.id}-${Date.now()}` // V1.1: idempotency_key
        });

        if (ingestError) throw new Error(`❌ Ingest failed: ${ingestError.message}`);
        console.log(`✅ Event ingested! ID: ${eventId}`);

        // 3. Trigger Scoring (VFL Engine)
        console.log('\n📍 Step 3: Computing scores (service-role mode)...');

        const { data: resultJson, error: scoreError } = await supabase.rpc('rpc_dealer_compute_scores', {
            p_dealer_id: dealer.id
        });

        if (scoreError) throw new Error(`❌ Scoring RPC failed: ${scoreError.message}`);
        console.log('✅ Scoring RPC executed successfully');

        // 4. STRICT GATE: Verify ALL 3 windows (7/30/90) exist
        console.log('\n📍 Step 4: Verifying snapshots (STRICT GATE: All windows required)...');

        const requiredWindows = [7, 30, 90];
        const snapshots: Record<number, any> = {};

        for (const window of requiredWindows) {
            const { data: windowSnapshots, error: fetchError } = await supabase
                .from('dealer_score_snapshots')
                .select('*')
                .eq('dealer_id', dealer.id)
                .eq('window_days', window)
                .order('computed_at', { ascending: false })
                .limit(1);

            if (fetchError) throw new Error(`❌ Failed to fetch ${window}d snapshot: ${fetchError.message}`);

            if (!windowSnapshots || windowSnapshots.length === 0) {
                throw new Error(`❌ CRITICAL FAILURE: Missing ${window}d snapshot! Compute MUST create all windows (7/30/90).`);
            }

            snapshots[window] = windowSnapshots[0];
            console.log(`✅ ${window}d snapshot found (reliability: ${snapshots[window].reliability_score})`);
        }

        // 5. STRICT GATE: Validate Explainability
        console.log('\n📍 Step 5: Validating explainability fields (STRICT GATE)...');

        for (const window of requiredWindows) {
            const snapshot = snapshots[window];

            // Check primary_reason
            if (!snapshot.primary_reason || snapshot.primary_reason.trim().length === 0) {
                throw new Error(`❌ CRITICAL: ${window}d snapshot missing primary_reason!`);
            }

            // Check contributing_factors
            if (!snapshot.contributing_factors || !Array.isArray(snapshot.contributing_factors) || snapshot.contributing_factors.length === 0) {
                throw new Error(`❌ CRITICAL: ${window}d snapshot missing contributing_factors!`);
            }

            console.log(`✅ ${window}d explainability valid: "${snapshot.primary_reason}" + ${snapshot.contributing_factors.length} factors`);
        }

        // 6. STRICT GATE: Validate Confidence Bounds
        console.log('\n📍 Step 6: Validating confidence scores (STRICT GATE: 0-100)...');

        for (const window of requiredWindows) {
            const confidence = snapshots[window].confidence_score;

            if (confidence === null || confidence === undefined) {
                throw new Error(`❌ CRITICAL: ${window}d snapshot has null confidence_score!`);
            }

            if (confidence < 0 || confidence > 100) {
                throw new Error(`❌ CRITICAL: ${window}d confidence out of bounds: ${confidence} (must be 0-100)!`);
            }

            console.log(`✅ ${window}d confidence valid: ${confidence}%`);
        }

        // 7. Display Summary
        console.log('\n' + '='.repeat(60));
        console.log('📊 Verification Summary:\n');

        for (const window of requiredWindows) {
            const s = snapshots[window];
            console.log(`${window}d Window:`);
            console.log(`   - Reliability: ${s.reliability_score}`);
            console.log(`   - Confidence:  ${s.confidence_score}%`);
            console.log(`   - Trust Value: ${s.trust_value ?? 'N/A'}`);
            console.log(`   - Reason:      ${s.primary_reason}`);
            console.log(`   - Factors:     [${s.contributing_factors.join(', ')}]`);
            console.log('');
        }

        console.log('='.repeat(60));
        console.log('✅ C18 V1.1 Verification PASSED (All Strict Gates)');
        console.log('='.repeat(60));

    } catch (err: any) {
        console.error('\n' + '='.repeat(60));
        console.error('❌ Verification FAILED:', err.message);
        if (err.details) console.error('Details:', err.details);
        if (err.hint) console.error('Hint:', err.hint);
        console.error('='.repeat(60));
        process.exit(1);
    }
}

main();
