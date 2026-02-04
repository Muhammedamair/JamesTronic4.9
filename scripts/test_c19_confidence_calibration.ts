#!/usr/bin/env npx tsx
/**
 * C19 Phase 5: Confidence Calibration Test (v1 Compliance)
 * Validates that higher confidence correlates with lower error
 * 
 * Hard Gates:
 * - Monotonic: MAPE decreases as confidence increases (5 quintiles)
 * - Spearman correlation: corr(confidence, -APE) >= 0.30
 * 
 * v1 Compliance:
 * - Uses seeded PRNG for reproducibility
 * - Uses frozen timestamp
 * - Uses shared utils for Spearman and quintile building
 * - CI requires real DB-derived samples (no in-memory fallback)
 * - CI fails with artifacts if insufficient samples
 * - Local mode allows in-memory seeding for dev convenience
 */

import { createClient } from '@supabase/supabase-js';
import {
    writeArtifacts,
    spearman,
    buildCalibrationQuintiles,
    checkMonotonicCalibration,
    normalizeConfidence,
    calculateApe,
    seededRandom,
    getFrozenNow,
    isCI,
    MIN_SPEARMAN_CORRELATION,
    MIN_SAMPLES_PER_BUCKET,
    failWithArtifacts,
    getDeterministicUUID,
    type CalibrationBin
} from './_c19_phase5_utils';

// Mode detection
const MODE = process.env.C19_TEST_MODE ?? (process.env.CI ? 'ci' : 'local');
const IS_CI = MODE === 'ci';

// Supabase setup
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE env vars');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

// Thresholds
const MIN_SAMPLES_TOTAL = MIN_SAMPLES_PER_BUCKET * 5; // Need enough for 5 quintiles

// CI Fixture IDs
const CI_FIXTURE_PREFIX = 'ci_p5_cal_';
const TEST_LOCATION_ID = getDeterministicUUID(`${CI_FIXTURE_PREFIX}loc_001`);
const TEST_PART_ID = `${CI_FIXTURE_PREFIX}part_001`;

interface CalibrationSample {
    confidence: number; // normalized 0-1
    actual: number;
    predicted: number;
}

const samples: CalibrationSample[] = [];

const FROZEN_NOW = getFrozenNow();

// Use multiple parts to get enough samples for quintiles
const TEST_PART_IDS = Array.from({ length: 25 }, (_, i) => getDeterministicUUID(`${CI_FIXTURE_PREFIX}part_${String(i + 1).padStart(3, '0')}`));

async function seedCIFixtures(): Promise<void> {
    console.log('\n📦 Seeding CI fixtures for calibration test...');

    // Seed location
    const { error: locErr } = await supabase
        .from('inventory_locations')
        .upsert({
            id: TEST_LOCATION_ID,
            name: 'CI Calibration Test Location',
            city: 'CI Test City',
            type: 'dark_store',
            address: { text: 'CI Test Address' },
            active: true,
        }, { onConflict: 'id' });
    if (locErr) console.error('  ❌ Location Seed Error:', locErr);

    // Seed parts with varying target reliability to create spread in forecast error/confidence
    for (const partId of TEST_PART_IDS) {
        // Randomize target confidence proxy (0-100) to get diverse confidence scores
        const targetConf = 20 + Math.floor(seededRandom() * 75);

        await supabase.from('inventory_parts').upsert({
            id: partId,
            sku: `CI-CAL-${partId.slice(-4)}`,
            name: `CI Calibration Part ${partId}`,
            category: 'calibration',
            cost_price: 100,
        }, { onConflict: 'id' });

        // Seed demand history
        // Higher variance = lower confidence = higher error
        const variance = targetConf > 80 ? 0.5 : targetConf > 50 ? 2 : 5;
        const baseDemand = 10;

        // Seed 90 days history
        const now = getFrozenNow();

        // Initial stock
        const initDate = new Date(now);
        initDate.setDate(initDate.getDate() - 91);
        await supabase.rpc('rpc_inventory_ingest_movement', {
            p_location_id: TEST_LOCATION_ID,
            p_part_id: partId,
            p_movement_type: 'receive',
            p_qty: 2000,
            p_source_type: 'dealer',
            p_occurred_at: initDate.toISOString(),
            p_idempotency_key: `ci_p5_cal_init_${partId}`,
            p_payload: { ci_fixture: true }
        });

        for (let daysAgo = 90; daysAgo >= 0; daysAgo--) {
            const eventDate = new Date(now);
            eventDate.setDate(eventDate.getDate() - daysAgo);

            // Random demand
            const demand = Math.max(0, Math.round(baseDemand + (seededRandom() - 0.5) * 2 * variance));
            if (demand > 0) {
                await supabase.rpc('rpc_inventory_ingest_movement', {
                    p_location_id: TEST_LOCATION_ID,
                    p_part_id: partId,
                    p_movement_type: 'consume',
                    p_qty: -demand,
                    p_source_type: 'ticket',
                    p_source_id: getDeterministicUUID(`ci_p5_cal_ref_${partId}_${daysAgo}`),
                    p_occurred_at: eventDate.toISOString(),
                    p_idempotency_key: `ci_p5_cal_mv_${partId}_${daysAgo}`,
                    p_payload: { ci_fixture: true }
                });
            }
        }
    }

    // Run pipeline
    const EVAL_NOW = getFrozenNow();
    const AS_OF = new Date(EVAL_NOW);
    AS_OF.setDate(AS_OF.getDate() - 40); // Backdate for evaluable samples

    console.log(`  🔄 Computing demand (as_of: ${EVAL_NOW.toISOString()})...`);
    await supabase.rpc('rpc_compute_part_demand', {
        p_days_back: 90,
        p_as_of: EVAL_NOW.toISOString()
    });

    console.log(`  🔄 Computing forecasts (as_of: ${AS_OF.toISOString()})...`);
    await supabase.rpc('rpc_compute_inventory_forecast', {
        p_as_of: AS_OF.toISOString()
    });

    console.log(`  ✅ Created ${TEST_PART_IDS.length} calibration parts & ran pipeline`);
}

async function collectCalibrationSamples(): Promise<void> {
    console.log('\n📊 Collecting calibration samples from forecasts...');

    // Get forecasts with actuals
    const { data: forecasts, error } = IS_CI
        ? await supabase
            .from('inventory_forecast_snapshots')
            .select('*')
            .not('confidence_score', 'is', null)
            .eq('location_id', TEST_LOCATION_ID)
            .in('part_id', TEST_PART_IDS)
            .order('computed_at', { ascending: false })
        : await supabase
            .from('inventory_forecast_snapshots')
            .select('*')
            .not('confidence_score', 'is', null)
            .order('computed_at', { ascending: false })
            .limit(100);

    if (error || !forecasts || forecasts.length === 0) {
        return;
    }

    for (const forecast of forecasts) {
        const computedAt = new Date(forecast.computed_at);
        const windowEnd = new Date(computedAt);
        windowEnd.setDate(windowEnd.getDate() + forecast.window_days);

        // Only use forecasts where the window has ended (so we have actuals)
        if (windowEnd > FROZEN_NOW) continue;

        // Get actual demand
        const { data: demandData } = await supabase
            .from('part_demand_rollups_daily')
            .select('demand_count')
            .eq('part_id', forecast.part_id)
            .gte('day', computedAt.toISOString().split('T')[0])
            .lte('day', windowEnd.toISOString().split('T')[0]);

        const actual = demandData?.reduce((sum, d) => sum + (d.demand_count || 0), 0) ?? 0;
        const predicted = forecast.forecast_qty ?? 0;

        samples.push({
            confidence: normalizeConfidence(forecast.confidence_score ?? 50),
            actual,
            predicted,
        });
    }

    console.log(`  ✅ Collected ${samples.length} samples`);
}

async function cleanupCIFixtures(): Promise<void> {
    console.log('\n🧹 Cleaning up CI fixtures...');

    await supabase
        .from('inventory_forecast_snapshots')
        .delete()
        .eq('location_id', TEST_LOCATION_ID);

    await supabase
        .from('part_demand_rollups_daily')
        .delete()
        .in('part_id', TEST_PART_IDS);

    await supabase
        .from('inventory_stock_ledger')
        .delete()
        .eq('location_id', TEST_LOCATION_ID);

    await supabase
        .from('inventory_parts')
        .delete()
        .in('id', TEST_PART_IDS);

    await supabase
        .from('inventory_locations')
        .delete()
        .eq('id', TEST_LOCATION_ID);

    console.log('  ✅ CI fixtures cleaned');
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  C19 Phase 5: Confidence Calibration Test (v1)');
    console.log(`  Mode: ${MODE.toUpperCase()}`);
    console.log('═══════════════════════════════════════════════════════════════');

    try {
        // v1 spec: In CI, seed fixtures FIRST to ensure evaluable samples exist
        if (IS_CI) {
            await seedCIFixtures();
        }

        // Collect samples (DB-backed)
        await collectCalibrationSamples();

        // v1 spec: After seeding + collection, if insufficient samples, FAIL
        if (samples.length < MIN_SAMPLES_TOTAL) {
            if (IS_CI) {
                failWithArtifacts(
                    'artifacts/c19_phase5',
                    'test_c19_confidence_calibration',
                    [
                        `Insufficient DB-derived samples: ${samples.length} < ${MIN_SAMPLES_TOTAL}`,
                        'CI seeding + RPC pipeline did not produce enough evaluable snapshots',
                        'Check: rpc_compute_part_demand (p_as_of), rpc_compute_inventory_forecast'
                    ],
                    { samplesFound: samples.length, required: MIN_SAMPLES_TOTAL }
                );
            } else {
                console.log(`\n⚠️ Only ${samples.length} samples (need ${MIN_SAMPLES_TOTAL}) - skipping gate in local mode`);
            }
        }

        // Build 5 quintiles using shared util
        const quintiles = buildCalibrationQuintiles(samples);

        // Calculate Spearman correlation using shared util
        const confidences = samples.map(s => s.confidence);
        const negativeAPEs = samples.map(s => -calculateApe(s.actual, s.predicted)); // Negative because we expect inverse relationship
        const rho = spearman(confidences, negativeAPEs);

        // Check monotonicity using shared util
        const { ok: isMonotonic, violations } = checkMonotonicCalibration(quintiles);
        const spearmanPasses = rho >= MIN_SPEARMAN_CORRELATION;

        // Print results
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('  CALIBRATION RESULTS (5 Quintiles)');
        console.log('═══════════════════════════════════════════════════════════════');

        console.log(`\n  Total Samples: ${samples.length}`);
        console.log('\n  MAPE by Confidence Quintile:');
        console.log('  ──────────────────────────────────────');

        for (const bin of quintiles) {
            console.log(`    Bin ${bin.bin}: avgConf=${bin.avgConf.toFixed(3)}, MAPE=${bin.mape.toFixed(2)}% (n=${bin.n})`);
        }

        console.log('\n  ──────────────────────────────────────');
        console.log(`  Monotonicity (MAPE decreasing with confidence): ${isMonotonic ? '✅ PASSED' : '❌ FAILED'}`);
        if (violations.length > 0) {
            violations.forEach(v => console.log(`    - ${v}`));
        }

        console.log(`\n  Spearman Correlation: ${rho.toFixed(3)}`);
        console.log(`    Threshold: ≥ ${MIN_SPEARMAN_CORRELATION}`);
        console.log(`    Result: ${spearmanPasses ? '✅ PASSED' : '❌ FAILED'}`);

        // Cleanup
        if (IS_CI) {
            await cleanupCIFixtures();
        }

        // Final result
        const success = isMonotonic && spearmanPasses;

        // Write artifacts
        const errors: string[] = [];
        if (!isMonotonic) errors.push(`Monotonic FAIL: ${violations.join(' | ')}`);
        if (!spearmanPasses) errors.push(`Spearman FAIL: rho=${rho.toFixed(3)} < ${MIN_SPEARMAN_CORRELATION}`);

        const artifactJson = {
            ok: success,
            startedAt: FROZEN_NOW.toISOString(),
            rho,
            bins: quintiles,
            violations,
            errors,
        };

        const artifactMd = [
            `# C19 Phase 5 — Confidence Calibration (v1)`,
            `- **Started:** ${FROZEN_NOW.toISOString()}`,
            `- **Result:** ${success ? '✅ PASS' : '❌ FAIL'}`,
            ``,
            `## Spearman`,
            `- rho(confidence, -APE) = **${rho.toFixed(3)}** (gate: ≥ ${MIN_SPEARMAN_CORRELATION})`,
            ``,
            `## Monotonic Quintile Test`,
            ...quintiles.map(b => `- Bin ${b.bin}: avgConf=${b.avgConf.toFixed(3)}, MAPE=${b.mape.toFixed(2)}% (n=${b.n})`),
            ``,
            `## Violations`,
            ...(violations.length ? violations.map(v => `- ${v}`) : [`- None`]),
            ``,
            `## Errors`,
            ...(errors.length ? errors.map(e => `- ${e}`) : [`- None`]),
        ].join('\n');

        writeArtifacts('artifacts/c19_phase5', 'test_c19_confidence_calibration', artifactJson, artifactMd);

        console.log('═══════════════════════════════════════════════════════════════\n');

        process.exit(success ? 0 : 1);

    } catch (error) {
        console.error('\n❌ FATAL ERROR:', error);
        if (IS_CI) await cleanupCIFixtures();
        process.exit(1);
    }
}

main();
