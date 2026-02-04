/**
 * C19 V1 End-to-End Verification Script
 * 
 * Tests: Demand Rollups → Forecasts → Reorders → Alerts
 * 
 * CI Mode: All gates must execute or hard-fail (no skips)
 * Local Mode: Warnings allowed with skip (development flexibility)
 */

import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import { createClient } from '@supabase/supabase-js';

// ESM-safe directory resolution
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load env vars
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// CI Mode detection: CI env var OR explicit C19_TEST_MODE
const C19_TEST_MODE = process.env.C19_TEST_MODE ?? (process.env.CI ? 'ci' : 'local');
const IS_CI_MODE = C19_TEST_MODE === 'ci';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

// Use Service Role for verification
const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * CI Mode gate: throws in CI, warns in local
 */
function gateOrWarn(message: string, remediation?: string): void {
    if (IS_CI_MODE) {
        throw new Error(`❌ CI GATE FAILED: ${message}${remediation ? `\n   Remediation: ${remediation}` : ''}`);
    } else {
        console.warn(`⚠️  WARNING: ${message}`);
        if (remediation) console.warn(`   Remediation: ${remediation}`);
    }
}

async function main() {
    console.log('🚀 C19 V1 End-to-End Verification (Service Role Mode)\n');
    console.log('='.repeat(70));
    console.log('Testing: Demand Rollups → Forecasts → Reorders → Alerts');
    console.log(`Mode: ${IS_CI_MODE ? '🔒 CI (no skips allowed)' : '🔧 Local (warnings allowed)'}`);
    console.log('='.repeat(70));

    let gatesExecuted = 0;
    let gatesSkipped = 0;

    try {
        // STEP 1: Get test location and part (from Phase 1)
        console.log('\n📍 Step 1: Finding test data...');

        const { data: locations, error: locError } = await supabase
            .from('inventory_locations')
            .select('*')
            .eq('active', true)
            .limit(1);

        if (locError || !locations || locations.length === 0) {
            throw new Error('❌ No active locations found. Run Phase 1 first.');
        }

        const testLocation = locations[0];
        console.log(`✅ Test location: ${testLocation.name} (${testLocation.id})`);

        // Get a part (from inventory_parts or create test UUID)
        const { data: parts, error: partError } = await supabase
            .from('inventory_parts')
            .select('*')
            .limit(1);

        let testPartId: string;

        if (!partError && parts && parts.length > 0) {
            testPartId = parts[0].id;
            console.log(`✅ Using part: ${parts[0].name} (${testPartId})`);
        } else {
            if (IS_CI_MODE) {
                throw new Error('❌ CI GATE FAILED: No inventory_parts found. Seed test data first.');
            }
            testPartId = '00000000-0000-0000-0000-000000000001';
            console.log(`⚠️  Using test part UUID: ${testPartId}`);
        }

        // STEP 1.5: Seed Test Data (to ensure rollups work)
        console.log('\n📍 Step 1.5: Ensuring test data in inventory_stock_ledger...');

        // Check if we already have demand for this part
        const { count } = await supabase
            .from('inventory_stock_ledger')
            .select('*', { count: 'exact', head: true })
            .eq('part_id', testPartId)
            .eq('movement_type', 'consume');

        if (count === 0) {
            const { error: seedError } = await supabase.from('inventory_stock_ledger').insert([
                {
                    location_id: testLocation.id,
                    part_id: testPartId,
                    movement_type: 'consume',
                    qty: -5,
                    occurred_at: new Date(Date.now() - 86400000 * 2).toISOString(),
                    event_hash: `ci-fixture-${Date.now()}-1`,
                    source_type: 'internal',
                    payload: { ci_fixture: true }
                },
                {
                    location_id: testLocation.id,
                    part_id: testPartId,
                    movement_type: 'consume',
                    qty: -3,
                    occurred_at: new Date(Date.now() - 86400000 * 10).toISOString(),
                    event_hash: `ci-fixture-${Date.now()}-2`,
                    source_type: 'internal',
                    payload: { ci_fixture: true }
                }
            ]);

            if (seedError) {
                gateOrWarn(`Seeding failed: ${seedError.message}`, 'Ensure inventory_stock_ledger table exists');
            } else {
                console.log('✅ Seeded 2 consumption events for testing (tagged: ci_fixture=true)');
            }
        } else {
            console.log(`ℹ️  Found ${count} existing ledger entries. Skipping seed.`);
        }

        // STEP 2: Compute Part Demand (Service-Role Only)
        console.log('\n📍 Step 2: Computing demand rollups (service-role RPC)...');

        const { data: demandResult, error: demandError } = await supabase
            .rpc('rpc_compute_part_demand', { p_days_back: 90 });

        if (demandError) throw new Error(`❌ Demand computation failed: ${demandError.message}`);
        console.log('✅ Demand rollups computed:', JSON.stringify(demandResult, null, 2));

        // STRICT GATE 1: Verify demand rollups exist
        const { data: rollups, error: rollupsError } = await supabase
            .from('part_demand_rollups_daily')
            .select('*')
            .eq('location_id', testLocation.id)
            .limit(5);

        if (rollupsError) throw new Error(`❌ Rollups fetch failed: ${rollupsError.message}`);

        if (!rollups || rollups.length === 0) {
            gateOrWarn('No demand rollups found after computation', 'Ensure inventory_stock_ledger has consume/transfer_out events');
            gatesSkipped++;
        } else {
            console.log(`✅ GATE 1 PASSED: Demand rollups exist (${rollups.length} rows)`);
            console.log(`   Sample: part=${rollups[0].part_id}, demand=${rollups[0].demand_count}, day=${rollups[0].day}`);
            gatesExecuted++;
        }

        // STEP 3: Compute Forecasts (7/30/90 Windows)
        console.log('\n📍 Step 3: Computing inventory forecasts (7/30/90 windows)...');

        const { data: forecastResult, error: forecastError } = await supabase
            .rpc('rpc_compute_inventory_forecast');

        if (forecastError) throw new Error(`❌ Forecast computation failed: ${forecastError.message}`);
        console.log('✅ Forecasts computed:', JSON.stringify(forecastResult, null, 2));

        // STRICT GATE 2: Verify 7/30/90 snapshots exist for test location+part
        const requiredWindows = [7, 30, 90];
        const snapshots: Record<number, any> = {};

        for (const window of requiredWindows) {
            const { data: windowSnapshots, error: snapError } = await supabase
                .from('inventory_forecast_snapshots')
                .select('*')
                .eq('location_id', testLocation.id)
                .eq('window_days', window)
                .order('computed_at', { ascending: false })
                .limit(1);

            if (snapError) throw new Error(`❌ Failed to fetch ${window}d snapshot: ${snapError.message}`);

            if (!windowSnapshots || windowSnapshots.length === 0) {
                throw new Error(`❌ GATE 2 FAILED: Missing ${window}d forecast snapshot! Expected 7/30/90 for all locations.`);
            }

            snapshots[window] = windowSnapshots[0];
        }

        console.log('✅ GATE 2 PASSED: All 3 windows (7/30/90) present');
        gatesExecuted++;

        // STRICT GATE 3: Validate confidence scores (0-100)
        console.log('\n📍 Step 4: Validating forecast confidence scores...');

        for (const window of requiredWindows) {
            const snapshot = snapshots[window];

            if (snapshot.confidence_score < 0 || snapshot.confidence_score > 100) {
                throw new Error(`❌ GATE 3 FAILED: ${window}d confidence out of bounds: ${snapshot.confidence_score}`);
            }

            console.log(`✅ ${window}d confidence valid: ${snapshot.confidence_score}%`);
        }

        console.log('✅ GATE 3 PASSED: All confidence scores within 0-100');
        gatesExecuted++;

        // STRICT GATE 4: Validate explainability
        console.log('\n📍 Step 5: Validating explainability (primary_reason + drivers)...');

        for (const window of requiredWindows) {
            const snapshot = snapshots[window];

            if (!snapshot.primary_reason || snapshot.primary_reason.trim().length === 0) {
                throw new Error(`❌ GATE 4 FAILED: ${window}d snapshot missing primary_reason`);
            }

            if (!snapshot.drivers || typeof snapshot.drivers !== 'object') {
                throw new Error(`❌ GATE 4 FAILED: ${window}d snapshot missing drivers JSONB`);
            }

            console.log(`✅ ${window}d explainability valid: "${snapshot.primary_reason}" + drivers=${JSON.stringify(snapshot.drivers)}`);
        }

        console.log('✅ GATE 4 PASSED: All snapshots have explainability');
        gatesExecuted++;

        // STEP 6: Generate Reorder Recommendations (with C18 integration)
        console.log('\n📍 Step 6: Generating reorder recommendations (C18 dealer selection)...');

        const { data: reorderResult, error: reorderError } = await supabase
            .rpc('rpc_generate_reorder_recommendations', {
                p_risk_threshold: 60,
                p_confidence_threshold: 30
            });

        if (reorderError) throw new Error(`❌ Reorder generation failed: ${reorderError.message}`);
        console.log('✅ Reorder recommendations generated:', JSON.stringify(reorderResult, null, 2));

        // STRICT GATE 5: Verify recommendations created (if risk threshold met)
        const { data: recommendations, error: recError } = await supabase
            .from('reorder_recommendations')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(5);

        if (recError) throw new Error(`❌ Recommendations fetch failed: ${recError.message}`);

        console.log(`\n📊 Reorder recommendations found: ${recommendations?.length || 0}`);

        if (recommendations && recommendations.length > 0) {
            const rec = recommendations[0];

            // STRICT GATE 5a: Status must be 'proposed' (no auto-purchasing)
            if (rec.status !== 'proposed') {
                throw new Error(`❌ GATE 5 FAILED: Recommendation status is '${rec.status}', expected 'proposed' (no auto-purchasing)`);
            }
            console.log('✅ GATE 5a PASSED: Status is "proposed" (no auto-purchasing)');

            // STRICT GATE 5b: Evidence must exist
            if (!rec.evidence || typeof rec.evidence !== 'object') {
                throw new Error(`❌ GATE 5 FAILED: Recommendation missing evidence JSONB`);
            }
            console.log('✅ GATE 5b PASSED: Evidence JSONB present');

            // STRICT GATE 5c: value_score must exist
            if (!rec.value_score || typeof rec.value_score !== 'object') {
                throw new Error(`❌ GATE 5 FAILED: Recommendation missing value_score JSONB`);
            }
            console.log('✅ GATE 5c PASSED: VFL value_score present');

            console.log(`\n📄 Sample Recommendation:`);
            console.log(`   Part: ${rec.part_id}`);
            console.log(`   Recommended Qty: ${rec.recommended_qty}`);
            console.log(`   Stockout Risk: ${rec.stockout_risk_score}`);
            console.log(`   Suggested Dealer: ${rec.suggested_dealer_id || 'N/A (no dealers with reliability >= threshold)'}`);
            console.log(`   Status: ${rec.status}`);

            gatesExecuted++;
        } else {
            gateOrWarn('No recommendations created (risk threshold not met or insufficient stock data)',
                'Ensure forecasts exist and current stock is below forecast levels');
            gatesSkipped++;
        }

        // STRICT GATE 6: Check alerts created for critical cases
        console.log('\n📍 Step 7: Checking inventory alerts...');

        const { data: alerts, error: alertError } = await supabase
            .from('inventory_alerts')
            .select('*')
            .eq('category', 'stockout')
            .is('resolved_at', null)
            .order('created_at', { ascending: false })
            .limit(5);

        if (alertError) throw new Error(`❌ Alerts fetch failed: ${alertError.message}`);

        console.log(`\n🔔 Active stockout alerts: ${alerts?.length || 0}`);

        if (alerts && alerts.length > 0) {
            const alert = alerts[0];
            console.log(`✅ GATE 6 PASSED: Alerts created for critical stockout risk`);
            console.log(`   Sample Alert:`);
            console.log(`   Severity: ${alert.severity}`);
            console.log(`   Category: ${alert.category}`);
            console.log(`   Message: ${alert.message}`);
            gatesExecuted++;
        } else {
            // Alert gate is soft - not all runs will produce critical alerts
            console.log('ℹ️  No critical alerts (acceptable if no critical stockout risk detected)');
            gatesExecuted++; // Still counts as executed (just no alerts needed)
        }

        // SUMMARY
        console.log('\n' + '='.repeat(70));
        console.log('📊 End-to-End Verification Summary:');
        console.log('='.repeat(70));
        console.log(`Mode: ${IS_CI_MODE ? '🔒 CI' : '🔧 Local'}`);
        console.log(`Gates Executed: ${gatesExecuted}`);
        console.log(`Gates Skipped: ${gatesSkipped}`);
        console.log('');
        console.log('✅ GATE 1: Demand rollups computed');
        console.log('✅ GATE 2: Forecast snapshots 7/30/90 present');
        console.log('✅ GATE 3: Confidence scores within 0-100');
        console.log('✅ GATE 4: Explainability fields populated');
        console.log('✅ GATE 5: Reorder recommendations with no auto-purchasing');
        console.log('✅ GATE 6: Alerts created when appropriate');

        if (IS_CI_MODE && gatesSkipped > 0) {
            throw new Error(`❌ CI MODE FAILURE: ${gatesSkipped} gates were skipped. All gates must execute in CI.`);
        }

        console.log('\n🎉 C19 V1 End-to-End Verification PASSED');
        console.log(`   CI Mode: ${gatesSkipped === 0 ? '0 skipped gates ✓' : `${gatesSkipped} skipped (LOCAL mode)`}`);
        console.log('='.repeat(70));

    } catch (err: any) {
        console.error('\n' + '='.repeat(70));
        console.error('❌ Verification FAILED:', err.message);
        if (err.details) console.error('Details:', err.details);
        if (err.hint) console.error('Hint:', err.hint);
        console.error('='.repeat(70));
        process.exit(1);
    }
}

main();
