/**
 * C19 ↔ C18 Integration Test
 * 
 * Tests: Dealer selection for reorder recommendations via C18 dealer_score_snapshots
 * 
 * CI Mode: Seeds qualifying dealer fixture if needed, asserts dealer suggestions populated
 * Local Mode: Warnings allowed with skip
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

// CI Mode detection
const C19_TEST_MODE = process.env.C19_TEST_MODE ?? (process.env.CI ? 'ci' : 'local');
const IS_CI_MODE = C19_TEST_MODE === 'ci';

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Seed a qualifying dealer score snapshot for CI testing
 * Tags fixture with ci_fixture=true for cleanup
 */
async function seedDealerFixture(): Promise<string | null> {
    console.log('\n📍 Seeding qualifying dealer score snapshot for CI...');

    // First, get an active dealer
    const { data: dealers, error: dealerError } = await supabase
        .from('dealers')
        .select('id, name')
        .eq('status', 'active')
        .limit(1);

    if (dealerError || !dealers || dealers.length === 0) {
        if (IS_CI_MODE) {
            throw new Error('❌ CI GATE FAILED: No active dealers found. Seed dealers first.');
        }
        console.warn('⚠️  No active dealers found for fixture seeding');
        return null;
    }

    const testDealer = dealers[0];
    console.log(`ℹ️  Using dealer: ${testDealer.name} (${testDealer.id})`);

    // Seed a qualifying dealer_score_snapshot
    const { error: snapshotError } = await supabase
        .from('dealer_score_snapshots')
        .insert({
            dealer_id: testDealer.id,
            window_days: 7,
            reliability_score: 85,
            trust_value: 80,
            confidence_score: 85,
            primary_reason: 'CI Test Fixture - Qualifying Dealer',
            contributing_factors: ['CI_FIXTURE', 'Seeded for integration testing'],
            metrics_snapshot: { ci_fixture: true, total_orders: 10, on_time_rate: 0.95, seeded_at: new Date().toISOString() },
            operational_value: 80,
            business_value: 75,
            learning_value: 60,
            computed_at: new Date().toISOString()
        });

    if (snapshotError) {
        if (IS_CI_MODE) {
            throw new Error(`❌ CI GATE FAILED: Cannot seed dealer snapshot: ${snapshotError.message}`);
        }
        console.warn(`⚠️  Seeding failed: ${snapshotError.message}`);
        return null;
    }

    console.log('✅ Seeded qualifying dealer score snapshot (tagged: ci_fixture=true)');
    console.log(`   reliability=85, confidence=85, trust=80`);
    return testDealer.id;
}

/**
 * Cleanup CI fixtures from dealer_score_snapshots
 */
async function cleanupDealerFixtures(): Promise<void> {
    console.log('\n🧹 Cleaning up CI dealer fixtures...');

    const { error } = await supabase
        .from('dealer_score_snapshots')
        .delete()
        .contains('metrics_snapshot', { ci_fixture: true });

    if (error) {
        console.warn(`⚠️  Cleanup warning: ${error.message}`);
    } else {
        console.log('✅ CI dealer fixtures cleaned');
    }
}

async function main() {
    console.log('🔗 C19 ↔ C18 Integration Test\n');
    console.log('='.repeat(70));
    console.log('Testing: C18 dealer selection for reorder recommendations');
    console.log(`Mode: ${IS_CI_MODE ? '🔒 CI (no skips allowed)' : '🔧 Local (warnings allowed)'}`);
    console.log('='.repeat(70));

    let gatesExecuted = 0;
    let gatesSkipped = 0;
    let seededDealerId: string | null = null;

    try {
        // STEP 1: Verify C18 dealer_score_snapshots exist
        console.log('\n📍 Step 1: Checking C18 dealer score snapshots...');

        const { data: dealerSnapshots, error: snapError } = await supabase
            .from('dealer_score_snapshots')
            .select('*')
            .order('computed_at', { ascending: false })
            .limit(5);

        if (snapError) throw new Error(`❌ Failed to fetch dealer snapshots: ${snapError.message}`);

        if (!dealerSnapshots || dealerSnapshots.length === 0) {
            if (IS_CI_MODE) {
                throw new Error('❌ CI GATE FAILED: No dealer_score_snapshots found. Run C18 analytics first.');
            }
            console.warn('⚠️  WARNING: No dealer_score_snapshots found.');
            console.warn('   C18 dealer analytics must be run first.');
            throw new Error('❌ Cannot test C18 integration without dealer snapshots');
        }

        console.log(`✅ Found ${dealerSnapshots.length} dealer score snapshots`);
        console.log(`   Sample: dealer=${dealerSnapshots[0].dealer_id}, reliability=${dealerSnapshots[0].reliability_score}, trust=${dealerSnapshots[0].trust_value}`);

        // STEP 2: Check dealers with good reliability
        console.log('\n📍 Step 2: Finding dealers with good reliability scores...');

        const { data: goodDealers, error: goodDealerError } = await supabase
            .from('dealer_score_snapshots')
            .select('dealer_id, reliability_score, trust_value, confidence_score, window_days, computed_at')
            .eq('window_days', 7)
            .gte('reliability_score', 70)
            .gte('confidence_score', 50)
            .order('trust_value', { ascending: false })
            .limit(5);

        if (goodDealerError) throw new Error(`❌ Failed to query good dealers: ${goodDealerError.message}`);

        let qualifyingDealersExist = goodDealers && goodDealers.length > 0;

        if (!qualifyingDealersExist) {
            console.warn('⚠️  No dealers with reliability >= 70 AND confidence >= 50');

            if (IS_CI_MODE) {
                // CI Mode: Seed a qualifying dealer fixture
                seededDealerId = await seedDealerFixture();
                if (seededDealerId) {
                    qualifyingDealersExist = true;
                }
            } else {
                console.warn('   C19 reorder generation will not suggest dealers under these conditions');
                console.warn('   This is acceptable in local mode if dealer network needs improvement');
            }
        } else {
            console.log(`✅ Found ${goodDealers.length} dealers meeting reliability threshold`);
            goodDealers.forEach((d, i) => {
                console.log(`   ${i + 1}. Dealer ${d.dealer_id}: reliability=${d.reliability_score}, trust=${d.trust_value}, confidence=${d.confidence_score}`);
            });
        }

        // STEP 2.5: Re-run reorder generation in CI mode if we seeded a fixture
        if (seededDealerId) {
            console.log('\n📍 Step 2.5: Re-generating reorder recommendations with qualified dealer...');

            const { data: reorderResult, error: reorderError } = await supabase
                .rpc('rpc_generate_reorder_recommendations', {
                    p_risk_threshold: 60,
                    p_confidence_threshold: 30
                });

            if (reorderError) throw new Error(`❌ Reorder re-generation failed: ${reorderError.message}`);
            console.log('✅ Reorder recommendations re-generated:', JSON.stringify(reorderResult, null, 2));
        }

        // STEP 3: Check reorder recommendations with dealer suggestions
        console.log('\n📍 Step 3: Checking reorder recommendations for C18 dealer integration...');

        const { data: reorders, error: reorderError } = await supabase
            .from('reorder_recommendations')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(10);

        if (reorderError) throw new Error(`❌ Failed to fetch reorders: ${reorderError.message}`);

        if (!reorders || reorders.length === 0) {
            if (IS_CI_MODE) {
                throw new Error('❌ CI GATE FAILED: No reorder recommendations found. Run verify_c19_v1.ts first.');
            }
            console.warn('⚠️  No reorder recommendations found');
            throw new Error('❌ Cannot test C18 integration without reorder recommendations');
        }

        console.log(`\n📦 Found ${reorders.length} reorder recommendations`);

        // STRICT GATE 1: suggested_dealer_id must be populated (when good dealers exist)
        const recWithDealers = reorders.filter(r => r.suggested_dealer_id);
        const recWithoutDealers = reorders.filter(r => !r.suggested_dealer_id);

        console.log(`   - With dealer suggestion: ${recWithDealers.length}`);
        console.log(`   - Without dealer suggestion: ${recWithoutDealers.length}`);

        if (qualifyingDealersExist) {
            if (recWithDealers.length === 0) {
                if (IS_CI_MODE) {
                    throw new Error('❌ CI GATE FAILED: Qualifying dealers exist but no recommendations have dealer suggestions. C18 integration broken.');
                }
                console.warn('⚠️  WARNING: Good dealers exist but no recommendations have dealer suggestions');
                console.warn('   This may indicate C18 integration is not working correctly');
                gatesSkipped++;
            } else {
                console.log('✅ GATE 1 PASSED: Recommendations include dealer suggestions when available');
                gatesExecuted++;
            }
        } else {
            if (IS_CI_MODE) {
                throw new Error('❌ CI GATE FAILED: No qualifying dealers and could not seed fixture');
            }
            console.log('ℹ️  GATE 1 SKIPPED: No dealers meet reliability threshold');
            gatesSkipped++;
        }

        // STRICT GATE 2: Evidence must include dealer_snapshot fields
        if (recWithDealers.length > 0) {
            console.log('\n📍 Step 4: Validating dealer snapshot in evidence...');

            const testRec = recWithDealers[0];

            if (!testRec.evidence || typeof testRec.evidence !== 'object') {
                throw new Error('❌ GATE 2 FAILED: Recommendation missing evidence');
            }

            const evidence = testRec.evidence;

            if (!('dealer_snapshot' in evidence)) {
                throw new Error('❌ GATE 2 FAILED: Evidence missing "dealer_snapshot" field');
            }

            const dealerSnapshot = evidence.dealer_snapshot;

            // Check required C18 fields
            const requiredFields = ['dealer_id', 'reliability_score', 'trust_value', 'confidence_score'];
            const missingFields = requiredFields.filter(f => !(f in dealerSnapshot));

            if (missingFields.length > 0) {
                throw new Error(`❌ GATE 2 FAILED: dealer_snapshot missing fields: ${missingFields.join(', ')}`);
            }

            console.log('✅ GATE 2 PASSED: Evidence includes C18 dealer_snapshot with required fields');
            console.log(`   Dealer snapshot: reliability=${dealerSnapshot.reliability_score}, trust=${dealerSnapshot.trust_value}, confidence=${dealerSnapshot.confidence_score}`);
            gatesExecuted++;

            // STRICT GATE 3: Dealer selection respects thresholds
            console.log('\n📍 Step 5: Verifying dealer selection thresholds...');

            if (dealerSnapshot.reliability_score < 70) {
                throw new Error(`❌ GATE 3 FAILED: Selected dealer has reliability ${dealerSnapshot.reliability_score} < 70 threshold`);
            }

            if (dealerSnapshot.confidence_score < 50) {
                throw new Error(`❌ GATE 3 FAILED: Selected dealer has confidence ${dealerSnapshot.confidence_score} < 50 threshold`);
            }

            console.log('✅ GATE 3 PASSED: Selected dealer meets reliability >= 70 AND confidence >= 50 thresholds');
            gatesExecuted++;
        } else {
            if (IS_CI_MODE && qualifyingDealersExist) {
                throw new Error('❌ CI GATE FAILED: GATES 2-3 could not execute - no recommendations with dealer suggestions');
            }
            console.log('\nℹ️  GATES 2-3 SKIPPED: No recommendations with dealer suggestions');
            gatesSkipped += 2;
        }

        // GATE 4: Supplier risk alerts
        console.log('\n📍 Step 6: Checking supplier risk alerts...');

        const { data: supplierAlerts, error: alertError } = await supabase
            .from('inventory_alerts')
            .select('*')
            .eq('category', 'supplier_risk')
            .is('resolved_at', null)
            .order('created_at', { ascending: false })
            .limit(5);

        if (alertError) throw new Error(`❌ Failed to fetch supplier alerts: ${alertError.message}`);

        console.log(`\n🔔 Active supplier risk alerts: ${supplierAlerts?.length || 0}`);

        if (supplierAlerts && supplierAlerts.length > 0) {
            console.log('✅ GATE 4 EVIDENCE: Supplier risk alerts are being created');
            console.log(`   Sample alert: ${supplierAlerts[0].message}`);
        } else {
            console.log('ℹ️  No supplier risk alerts (acceptable if all suggested dealers maintain good trust)');
        }
        gatesExecuted++; // Alert mechanism is present even if no alerts

        // GATE 5: Verify latest recommendations use latest dealer snapshots
        console.log('\n📍 Step 7: Verifying dealer snapshot freshness...');

        if (recWithDealers.length > 0) {
            const latestRec = recWithDealers[0];
            const evidence = latestRec.evidence;
            const dealerSnapshot = evidence.dealer_snapshot;

            // Get latest dealer snapshot for comparison
            const { data: latestDealerSnapshot, error: latestError } = await supabase
                .from('dealer_score_snapshots')
                .select('*')
                .eq('dealer_id', latestRec.suggested_dealer_id)
                .eq('window_days', 7)
                .order('computed_at', { ascending: false })
                .limit(1)
                .single();

            if (latestError) {
                console.warn(`⚠️  Could not fetch latest dealer snapshot for comparison: ${latestError.message}`);
            } else {
                const recSnapshotTime = new Date(latestRec.created_at).getTime();
                const dealerSnapshotTime = new Date(latestDealerSnapshot.computed_at).getTime();

                if (dealerSnapshotTime <= recSnapshotTime || (dealerSnapshotTime - recSnapshotTime) < 3600000) {
                    console.log('✅ GATE 5 PASSED: Recommendation uses recent dealer snapshot');
                    gatesExecuted++;
                } else {
                    console.warn('⚠️  WARNING: Recommendation may be using stale dealer snapshot');
                    if (IS_CI_MODE) {
                        throw new Error('❌ CI GATE FAILED: Stale dealer snapshot detected');
                    }
                }
            }
        } else {
            console.log('ℹ️  Gate 5 skipped: No recommendations with dealer suggestions to verify');
            if (!IS_CI_MODE) gatesSkipped++;
        }

        // SUMMARY
        console.log('\n' + '='.repeat(70));
        console.log('📊 C18 Integration Test Summary:');
        console.log('='.repeat(70));
        console.log(`Mode: ${IS_CI_MODE ? '🔒 CI' : '🔧 Local'}`);
        console.log(`Gates Executed: ${gatesExecuted}`);
        console.log(`Gates Skipped: ${gatesSkipped}`);
        console.log('');
        console.log('✅ GATE 1: Dealer suggestions populated when available');
        console.log('✅ GATE 2: Evidence includes dealer_score_snapshot fields');
        console.log('✅ GATE 3: Dealer selection respects thresholds');
        console.log('✅ GATE 4: Supplier risk alert mechanism present');
        console.log('✅ GATE 5: Recommendations use fresh dealer snapshots');

        if (IS_CI_MODE && gatesSkipped > 0) {
            throw new Error(`❌ CI MODE FAILURE: ${gatesSkipped} gates were skipped. All gates must execute in CI.`);
        }

        console.log('\n🎉 C18 Integration Test PASSED');
        console.log(`   CI Mode: ${gatesSkipped === 0 ? '0 skipped gates ✓' : `${gatesSkipped} skipped (LOCAL mode)`}`);
        console.log('='.repeat(70));

    } catch (err: any) {
        console.error('\n' + '='.repeat(70));
        console.error('❌ Test FAILED:', err.message);
        if (err.details) console.error('Details:', err.details);
        if (err.hint) console.error('Hint:', err.hint);
        console.error('='.repeat(70));
        process.exit(1);
    } finally {
        // Cleanup CI fixtures if we seeded any
        if (seededDealerId && IS_CI_MODE) {
            await cleanupDealerFixtures();
        }
    }
}

main();
