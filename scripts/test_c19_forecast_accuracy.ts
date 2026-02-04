#!/usr/bin/env npx tsx
/**
 * C19 Phase 5: Forecast Accuracy Test
 * MAPE calculation by confidence tier using holdout method
 * 
 * Hard Gates (v1 spec):
 * - High confidence (>=0.80): 7d MAPE ≤25%, 30d MAPE ≤30%
 * - Medium confidence (0.50-0.79): 7d MAPE ≤40%, 30d MAPE ≤45%
 * - Low confidence (<0.50): No threshold, but must cap/suppress reorders
 */

import { createClient } from '@supabase/supabase-js';
import {
    writeArtifacts,
    MAPE_THRESHOLDS,
    normalizeConfidence,
    seededRandom,
    getFrozenNow,
    MIN_SAMPLES_PER_BUCKET,
    isCI,
    failWithArtifacts,
    getDeterministicUUID
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

// Thresholds (v1 spec: HIGH >= 0.80, MID >= 0.50)
const THRESHOLDS = {
    high: { window_7d: MAPE_THRESHOLDS['7d'].HIGH, window_30d: MAPE_THRESHOLDS['30d'].HIGH },
    medium: { window_7d: MAPE_THRESHOLDS['7d'].MID, window_30d: MAPE_THRESHOLDS['30d'].MID },
    low: { window_7d: Infinity, window_30d: Infinity }, // No accuracy threshold for low
};

const MIN_SAMPLES_FOR_EVALUATION = MIN_SAMPLES_PER_BUCKET;
const FROZEN_NOW = getFrozenNow().toISOString();

// CI Fixture IDs
const CI_FIXTURE_PREFIX = 'ci_p5_acc_'; // Prefix for hash keys, not the ID itself
const TEST_LOCATION_ID = getDeterministicUUID(`${CI_FIXTURE_PREFIX}loc_001`);
const TEST_PART_IDS = [
    // 10 High Confidence Parts
    ...Array.from({ length: 10 }, (_, i) => getDeterministicUUID(`${CI_FIXTURE_PREFIX}part_high_${String(i + 1).padStart(3, '0')}`)),
    // 10 Medium Confidence Parts
    ...Array.from({ length: 10 }, (_, i) => getDeterministicUUID(`${CI_FIXTURE_PREFIX}part_mid_${String(i + 1).padStart(3, '0')}`)),
    // 1 Low Confidence Part
    getDeterministicUUID(`${CI_FIXTURE_PREFIX}part_low_001`)
];

interface AccuracySample {
    location_id: string;
    part_id: string;
    window_days: number;
    confidence_score: number;
    forecast_qty: number;
    actual_qty: number;
    ape: number; // Absolute Percentage Error
}

interface TierResults {
    tier: string;
    window_days: number;
    samples: number;
    mape: number;
    threshold: number;
    passed: boolean;
}

const samples: AccuracySample[] = [];
const tierResults: TierResults[] = [];

function getConfidenceTier(score: number): 'high' | 'medium' | 'low' {
    // v1 spec: HIGH >= 0.80, MID >= 0.50 (normalized)
    const x = normalizeConfidence(score);
    if (x >= 0.8) return 'high';
    if (x >= 0.5) return 'medium';
    return 'low';
}

function calculateAPE(forecast: number, actual: number): number {
    const denominator = Math.max(actual, 1);
    return Math.abs(forecast - actual) / denominator;
}

async function seedCIFixtures(): Promise<void> {
    console.log('\n📦 Seeding CI fixtures for accuracy test...');

    // 1. Seed location
    const { error: locErr } = await supabase
        .from('inventory_locations')
        .upsert({
            id: TEST_LOCATION_ID,
            name: 'CI Accuracy Test Location',
            city: 'CI Test City',
            type: 'dark_store',
            address: { text: 'CI Test Address' },
            active: true,
        }, { onConflict: 'id' });
    if (locErr) console.error('  ❌ Location Seed Error:', locErr);

    // 2. Seed parts with different confidence profiles
    const partConfigs: { id: string; name: string; targetConf: number }[] = [];

    // High conf parts
    TEST_PART_IDS.slice(0, 10).forEach((id, i) => {
        partConfigs.push({ id, name: `High Conf Part ${i + 1}`, targetConf: 85 });
    });
    // Mid conf parts
    TEST_PART_IDS.slice(10, 20).forEach((id, i) => {
        partConfigs.push({ id, name: `Mid Conf Part ${i + 1}`, targetConf: 55 }); // >= 50 is MID
    });
    // Low conf parts
    TEST_PART_IDS.slice(20, 21).forEach((id, i) => {
        partConfigs.push({ id, name: `Low Conf Part ${i + 1}`, targetConf: 25 });
    });

    for (const config of partConfigs) {
        await supabase
            .from('inventory_parts')
            .upsert({
                id: config.id,
                sku: `CI-ACC-${config.id.slice(-4)}`,
                name: config.name,
                category: 'accuracy_test',
                cost_price: 100,
            }, { onConflict: 'id' });
    }

    // 3. Seed historical demand patterns (90 days) - use frozen time for determinism
    const now = getFrozenNow();

    // Seed initial stock first to avoid negative stock errors
    for (const partConfig of partConfigs) {
        const initDate = new Date(now);
        initDate.setDate(initDate.getDate() - 91);
        await supabase.rpc('rpc_inventory_ingest_movement', {
            p_location_id: TEST_LOCATION_ID,
            p_part_id: partConfig.id,
            p_movement_type: 'receive',
            p_qty: 1000,
            p_source_type: 'dealer',
            p_occurred_at: initDate.toISOString(),
            p_idempotency_key: `ci_p5_acc_init_${TEST_LOCATION_ID}_${partConfig.id}`,
            p_payload: { ci_fixture: true },
        });
    }

    for (const partConfig of partConfigs) {
        // Different variance based on target confidence
        // For Medium/Low, increase base consumption to reduce MAPE from small number noise
        const baseConsumption = partConfig.targetConf < 80 ? 20 : 5;
        const variance = partConfig.targetConf >= 70 ? 1 : partConfig.targetConf >= 40 ? 5 : 10;

        for (let daysAgo = 90; daysAgo >= 0; daysAgo--) {
            const eventDate = new Date(now);
            eventDate.setDate(eventDate.getDate() - daysAgo);

            // Consumption with variance - use seeded RNG for determinism
            const consumptionQty = Math.max(1, baseConsumption + Math.floor((seededRandom() - 0.5) * 2 * variance));
            const idempotencyKey = `ci_p5_acc_ledger_${partConfig.id}_${daysAgo}`;

            // Sparsity Logic for MID Tier:
            // To get Medium confidence (30-70% sample size), we must skip some days
            // 7d window: need ~4 days (50%)
            // 30d window: need ~15 days (50%)
            let shouldConsume = true;
            if (partConfig.targetConf === 55) { // Mid tier marker
                // Skip every other day to hit ~50% sample size
                shouldConsume = daysAgo % 2 === 0;

                // Ensure at least some recent activity for 7d window
                if (daysAgo >= 40 && daysAgo <= 47) {
                    shouldConsume = daysAgo % 2 === 0;
                }
            } else if (partConfig.targetConf === 25) { // Low tier
                // Very sparse: 1 in 4 days
                shouldConsume = daysAgo % 4 === 0;
            }

            if (shouldConsume) {
                const { error: seedErr } = await supabase.rpc('rpc_inventory_ingest_movement', {
                    p_location_id: TEST_LOCATION_ID,
                    p_part_id: partConfig.id,
                    p_movement_type: 'consume',
                    p_qty: -consumptionQty,
                    p_source_type: 'ticket',
                    p_source_id: getDeterministicUUID(`ci_p5_acc_ref_${partConfig.id}_${daysAgo}`), // Deterministic ID for CI reproducibility
                    p_occurred_at: eventDate.toISOString(),
                    p_idempotency_key: idempotencyKey,
                    p_payload: { ci_fixture: true },
                });
                if (seedErr) console.error(`  ❌ Seed Error (Part ${partConfig.id}, Day ${daysAgo}):`, seedErr);
            }
        }
    }

    // 4. Run demand compute and forecast compute to generate snapshots
    // Use AS_OF = EVAL_NOW - 40d so computed_at + window_days <= EVAL_NOW (evaluable samples)
    const EVAL_NOW = getFrozenNow();
    const AS_OF = new Date(EVAL_NOW);
    AS_OF.setDate(AS_OF.getDate() - 40); // Backdate by 40 days to ensure windows are evaluable

    // Compute Demand Rollups AS OF NOW (so we have actuals for the holdout period)
    console.log(`  🔄 Computing demand rollups (as_of: ${EVAL_NOW.toISOString()})...`);
    const { data: demandRes, error: demandErr } = await supabase.rpc('rpc_compute_part_demand', {
        p_days_back: 90,
        p_as_of: EVAL_NOW.toISOString()
    });
    if (demandErr) console.error('  ❌ Demand RPC Error:', demandErr);
    else console.log('  ✅ Demand RPC Result:', demandRes);

    console.log(`  🔄 Computing forecasts (as_of: ${AS_OF.toISOString()})...`);
    const { data: forecastRes, error: forecastErr } = await supabase.rpc('rpc_compute_inventory_forecast', {
        p_as_of: AS_OF.toISOString()
    });
    if (forecastErr) console.error('  ❌ Forecast RPC Error:', forecastErr);
    else console.log('  ✅ Forecast RPC Result:', forecastRes);

    console.log('  ✅ CI fixtures seeded (backdated for evaluable samples)');
}

async function collectAccuracySamples(): Promise<void> {
    console.log('\n📊 Collecting accuracy samples...');

    // Get forecasts with their computed_at timestamps
    const { data: forecasts, error } = IS_CI
        ? await supabase
            .from('inventory_forecast_snapshots')
            .select('*')
            .in('window_days', [7, 30])
            .eq('location_id', TEST_LOCATION_ID)
            .in('part_id', TEST_PART_IDS)
            .order('computed_at', { ascending: false })
        : await supabase
            .from('inventory_forecast_snapshots')
            .select('*')
            .in('window_days', [7, 30])
            .order('computed_at', { ascending: false });

    if (error || !forecasts || forecasts.length === 0) {
        console.log('  ⚠️ No forecast snapshots found');
        return;
    }

    // For each forecast, get actual demand from rollups
    for (const forecast of forecasts) {
        // Get actual demand for the window period after forecast was computed
        const computedAt = new Date(forecast.computed_at);
        const windowEnd = new Date(computedAt);
        windowEnd.setDate(windowEnd.getDate() + forecast.window_days);

        // If the window hasn't ended yet, we can't evaluate accuracy - use frozen time
        const NOW = getFrozenNow();
        if (windowEnd > NOW) {
            continue;
        }

        // Get actual demand from rollups
        const { data: demandData } = await supabase
            .from('part_demand_rollups_daily')
            .select('demand_count')
            .eq('part_id', forecast.part_id)
            .gte('day', computedAt.toISOString().split('T')[0])
            .lte('day', windowEnd.toISOString().split('T')[0]);

        const actualQty = demandData?.reduce((sum, d) => sum + (d.demand_count || 0), 0) ?? 0;
        const forecastQty = forecast.forecast_qty ?? 0;
        const ape = calculateAPE(forecastQty, actualQty);

        samples.push({
            location_id: forecast.location_id,
            part_id: forecast.part_id,
            window_days: forecast.window_days,
            confidence_score: forecast.confidence_score ?? 50,
            forecast_qty: forecastQty,
            actual_qty: actualQty,
            ape,
        });
    }

    console.log(`  ✅ Collected ${samples.length} samples`);
}

async function seedSyntheticBacktestData(): Promise<void> {
    console.log('\n📦 Seeding synthetic backtest data (Option B)...');

    // Create synthetic demand rollups with known values
    // Then forecast against them for deterministic evaluation

    const syntheticParts = [
        { partId: TEST_PART_IDS[0], avgDemand: 5, variance: 1, targetConf: 85 },
        { partId: TEST_PART_IDS[1], avgDemand: 5, variance: 1, targetConf: 75 },
        { partId: TEST_PART_IDS[2], avgDemand: 5, variance: 2, targetConf: 55 },
        { partId: TEST_PART_IDS[3], avgDemand: 5, variance: 2, targetConf: 45 },
        { partId: TEST_PART_IDS[4], avgDemand: 5, variance: 4, targetConf: 25 },
    ];

    const now = getFrozenNow();

    for (const part of syntheticParts) {
        // Seed 7-day and 30-day evaluation windows
        for (const windowDays of [7, 30]) {
            const forecastDate = new Date(now);
            forecastDate.setDate(forecastDate.getDate() - windowDays - 1);

            // Known actual demand for the window
            const actualDemand = part.avgDemand * windowDays;

            // Forecast with controlled error based on confidence tier
            const tier = getConfidenceTier(part.targetConf);
            const maxErrorPct = tier === 'high' ? 0.15 : tier === 'medium' ? 0.30 : 0.50;
            const forecastError = (seededRandom() * 2 - 1) * maxErrorPct;
            const forecastQty = Math.round(actualDemand * (1 + forecastError));

            samples.push({
                location_id: TEST_LOCATION_ID,
                part_id: part.partId,
                window_days: windowDays,
                confidence_score: part.targetConf,
                forecast_qty: forecastQty,
                actual_qty: actualDemand,
                ape: calculateAPE(forecastQty, actualDemand),
            });
        }
    }

    console.log(`  ✅ Created ${samples.length} synthetic samples`);
}

function calculateMAPE(): void {
    console.log('\n📈 Calculating MAPE by tier and window...');

    const tiers: Array<'high' | 'medium' | 'low'> = ['high', 'medium', 'low'];
    const windows = [7, 30];

    for (const tier of tiers) {
        for (const windowDays of windows) {
            const tierSamples = samples.filter(s =>
                getConfidenceTier(s.confidence_score) === tier &&
                s.window_days === windowDays
            );

            if (tierSamples.length === 0) {
                // v1 spec: In CI, gated buckets (HIGH/MID) MUST have samples
                const isGatedBucket = tier !== 'low';
                const shouldFail = isCI() && isGatedBucket;

                tierResults.push({
                    tier,
                    window_days: windowDays,
                    samples: 0,
                    mape: 0,
                    threshold: THRESHOLDS[tier][`window_${windowDays}d` as keyof typeof THRESHOLDS[typeof tier]],
                    passed: !shouldFail, // FAIL in CI if gated bucket has no samples
                });
                continue;
            }

            const mape = (tierSamples.reduce((sum, s) => sum + s.ape, 0) / tierSamples.length) * 100;
            const threshold = THRESHOLDS[tier][`window_${windowDays}d` as keyof typeof THRESHOLDS[typeof tier]];

            // v1 spec: In CI, if samples < MIN but > 0, FAIL (no threshold bypass)
            const insufficientSamples = tierSamples.length < MIN_SAMPLES_FOR_EVALUATION;
            const isGatedBucket = tier !== 'low';

            let passed: boolean;
            if (isCI() && isGatedBucket && insufficientSamples) {
                passed = false; // Hard fail: insufficient samples in CI
            } else {
                passed = mape <= threshold;
            }

            tierResults.push({
                tier,
                window_days: windowDays,
                samples: tierSamples.length,
                mape: Math.round(mape * 100) / 100,
                threshold,
                passed,
            });
        }
    }
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
    console.log('  C19 Phase 5: Forecast Accuracy Test');
    console.log(`  Mode: ${MODE.toUpperCase()}`);
    console.log('═══════════════════════════════════════════════════════════════');

    try {
        // Seed fixtures in CI mode
        if (IS_CI) {
            await seedCIFixtures();
        }

        // Attempt to collect real backtest samples (Option A)
        await collectAccuracySamples();

        // v1 spec: In CI, if insufficient samples after seeding + RPC, FAIL (no synthetic fallback)
        if (samples.length < MIN_SAMPLES_FOR_EVALUATION) {
            if (IS_CI) {
                await cleanupCIFixtures();
                failWithArtifacts(
                    'artifacts/c19_phase5',
                    'test_c19_forecast_accuracy',
                    [
                        `Insufficient samples: ${samples.length} < ${MIN_SAMPLES_FOR_EVALUATION}`,
                        'Forecasting pipeline did not produce enough evaluable snapshots',
                        'Check: rpc_compute_part_demand, rpc_compute_inventory_forecast'
                    ],
                    { samplesFound: samples.length, required: MIN_SAMPLES_FOR_EVALUATION }
                );
            } else {
                // Local mode: allow synthetic fallback for dev convenience
                console.log('\n⚠️ Insufficient real samples, using synthetic backtest (Option B) - local mode only');
                await seedSyntheticBacktestData();
            }
        }

        // Calculate MAPE
        calculateMAPE();

        // Print results table
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('  MAPE RESULTS BY TIER AND WINDOW');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('\n  Tier     | Window | Samples | MAPE    | Threshold | Result');
        console.log('  ---------|--------|---------|---------|-----------|--------');

        for (const result of tierResults) {
            const icon = result.passed ? '✅' : '❌';
            const thresholdStr = result.threshold === Infinity ? 'N/A' : `≤${result.threshold}%`;
            console.log(
                `  ${result.tier.padEnd(8)} | ${result.window_days}d`.padEnd(18) +
                `| ${result.samples.toString().padEnd(7)} | ${result.mape.toFixed(1).padEnd(7)}% | ${thresholdStr.padEnd(9)} | ${icon}`
            );
        }

        // Cleanup
        if (IS_CI) {
            await cleanupCIFixtures();
        }

        // Summary
        const failed = tierResults.filter(r => !r.passed);
        const success = failed.length === 0;

        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log(`  Result: ${success ? '✅ ALL MAPE THRESHOLDS PASSED' : '❌ MAPE THRESHOLDS EXCEEDED'}`);

        if (failed.length > 0) {
            console.log('\n  Failed Thresholds:');
            failed.forEach(f => {
                console.log(`    - ${f.tier} ${f.window_days}d: ${f.mape.toFixed(1)}% > ${f.threshold}%`);
            });
        }

        // Write artifacts
        const artifactJson = {
            ok: success,
            startedAt: FROZEN_NOW,
            thresholds: THRESHOLDS,
            windows: {
                '7d': tierResults.filter(r => r.window_days === 7),
                '30d': tierResults.filter(r => r.window_days === 30),
            },
            errors: failed.map(f => `MAPE FAIL: ${f.tier} ${f.window_days}d got ${f.mape.toFixed(2)}% > ${f.threshold}%`),
        };

        const artifactMd = [
            `# C19 Phase 5 — Forecast Accuracy (MAPE)`,
            `- **Started:** ${FROZEN_NOW}`,
            `- **Result:** ${success ? '✅ PASS' : '❌ FAIL'}`,
            ``,
            `## Thresholds`,
            `- 7d HIGH ≤ ${THRESHOLDS.high.window_7d}%, 7d MID ≤ ${THRESHOLDS.medium.window_7d}%`,
            `- 30d HIGH ≤ ${THRESHOLDS.high.window_30d}%, 30d MID ≤ ${THRESHOLDS.medium.window_30d}%`,
            ``,
            `## Results`,
            `| Tier | Window | Samples | MAPE | Threshold | Status |`,
            `|------|--------|---------|------|-----------|--------|`,
            ...tierResults.map(r => `| ${r.tier} | ${r.window_days}d | ${r.samples} | ${r.mape.toFixed(2)}% | ${r.threshold === Infinity ? 'N/A' : `≤${r.threshold}%`} | ${r.passed ? '✅' : '❌'} |`),
            ``,
            `## Errors`,
            ...(failed.length ? failed.map(f => `- MAPE FAIL: ${f.tier} ${f.window_days}d got ${f.mape.toFixed(2)}% > ${f.threshold}%`) : [`- None`]),
        ].join('\n');

        writeArtifacts('artifacts/c19_phase5', 'test_c19_forecast_accuracy', artifactJson, artifactMd);

        console.log('═══════════════════════════════════════════════════════════════\n');

        process.exit(success ? 0 : 1);

    } catch (error) {
        console.error('\n❌ FATAL ERROR:', error);
        if (IS_CI) await cleanupCIFixtures();
        process.exit(1);
    }
}

main();
