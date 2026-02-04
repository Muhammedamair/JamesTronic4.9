#!/usr/bin/env npx tsx
/**
 * C19 Phase 5: Performance Budgets Test
 * Measures p50/p95 latencies for all target endpoints
 * 
 * Hard Gates (p95):
 * - Dashboard summary: ≤500ms
 * - Reorder queue (50 rows): ≤700ms
 * - Part deep dive: ≤900ms
 * - Location deep dive: ≤900ms
 * - Compute demand: ≤10,000ms
 * - Compute forecast: ≤10,000ms
 * - Generate reorders: ≤10,000ms
 */

import { createClient } from '@supabase/supabase-js';
import { writeArtifacts, PERF_BUDGETS_MS, percentile } from './_c19_phase5_utils';

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

// Performance budgets (p95 in ms)
const BUDGETS = {
    dashboard_summary: 500,
    reorder_queue: 700,
    part_deep_dive: 900,
    location_deep_dive: 900,
    compute_demand: 10000,
    compute_forecast: 10000,
    generate_reorders: 10000,
};

const RUNS_PER_TEST = 30;
const WARMUP_RUNS = 3;

interface PerfResult {
    name: string;
    runs: number;
    p50: number;
    p95: number;
    budget: number;
    passed: boolean;
}

const results: PerfResult[] = [];

function calculatePercentile(values: number[], percentile: number): number {
    const sorted = [...values].sort((a, b) => a - b);
    const index = Math.ceil((percentile / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
}

async function runTest(
    name: string,
    testFn: () => Promise<void>,
    budget: number
): Promise<PerfResult> {
    console.log(`\n  🔄 Testing: ${name}`);

    const timings: number[] = [];

    // Warmup runs (not counted)
    for (let i = 0; i < WARMUP_RUNS; i++) {
        await testFn();
    }

    // Actual runs
    for (let i = 0; i < RUNS_PER_TEST; i++) {
        const start = Date.now();
        await testFn();
        const duration = Date.now() - start;
        timings.push(duration);

        // Progress indicator every 10 runs
        if ((i + 1) % 10 === 0) {
            process.stdout.write(`     Run ${i + 1}/${RUNS_PER_TEST}\r`);
        }
    }

    const p50 = calculatePercentile(timings, 50);
    const p95 = calculatePercentile(timings, 95);
    const passed = p95 <= budget;

    const result: PerfResult = {
        name,
        runs: RUNS_PER_TEST,
        p50: Math.round(p50),
        p95: Math.round(p95),
        budget,
        passed,
    };

    results.push(result);

    const icon = passed ? '✅' : '❌';
    console.log(`     ${icon} p50=${p50}ms, p95=${p95}ms (budget: ${budget}ms)`);

    return result;
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  C19 Phase 5: Performance Budgets Test');
    console.log(`  Mode: ${MODE.toUpperCase()}`);
    console.log(`  Runs per test: ${RUNS_PER_TEST} (+ ${WARMUP_RUNS} warmup)`);
    console.log('═══════════════════════════════════════════════════════════════');

    try {
        // Test 1: Dashboard Summary
        await runTest(
            'dashboard_summary',
            async () => {
                await supabase.rpc('rpc_inventory_dashboard_summary');
            },
            BUDGETS.dashboard_summary
        );

        // Test 2: Reorder Queue (50 rows)
        await runTest(
            'reorder_queue',
            async () => {
                await supabase
                    .from('reorder_recommendations')
                    .select('*')
                    .order('created_at', { ascending: false })
                    .limit(50);
            },
            BUDGETS.reorder_queue
        );

        // Test 3: Part Deep Dive (forecast + stock + alerts + ledger)
        // Get a sample part first
        const { data: samplePart } = await supabase
            .from('inventory_parts')
            .select('id')
            .eq('active', true)
            .limit(1)
            .single();

        const testPartId = samplePart?.id ?? '00000000-0000-0000-0000-000000000000';

        await runTest(
            'part_deep_dive',
            async () => {
                await Promise.all([
                    supabase
                        .from('inventory_forecast_snapshots')
                        .select('*')
                        .eq('part_id', testPartId),
                    supabase
                        .from('inventory_stock_current')
                        .select('*')
                        .eq('part_id', testPartId),
                    supabase
                        .from('inventory_alerts')
                        .select('*')
                        .eq('part_id', testPartId),
                    supabase
                        .from('inventory_stock_ledger')
                        .select('*')
                        .eq('part_id', testPartId)
                        .order('occurred_at', { ascending: false })
                        .limit(50),
                ]);
            },
            BUDGETS.part_deep_dive
        );

        // Test 4: Location Deep Dive (stock + alerts + reorders)
        const { data: sampleLocation } = await supabase
            .from('inventory_locations')
            .select('id')
            .eq('active', true)
            .limit(1)
            .single();

        const testLocationId = sampleLocation?.id ?? '00000000-0000-0000-0000-000000000000';

        await runTest(
            'location_deep_dive',
            async () => {
                await Promise.all([
                    supabase
                        .from('inventory_stock_current')
                        .select('*')
                        .eq('location_id', testLocationId),
                    supabase
                        .from('inventory_alerts')
                        .select('*')
                        .eq('location_id', testLocationId),
                    supabase
                        .from('reorder_recommendations')
                        .select('*')
                        .eq('location_id', testLocationId)
                        .order('created_at', { ascending: false })
                        .limit(50),
                ]);
            },
            BUDGETS.location_deep_dive
        );

        // Test 5: Compute Demand (single run due to heavy operation)
        console.log('\n  🔄 Testing: compute_demand (reduced runs for heavy operation)');
        const demandTimings: number[] = [];
        for (let i = 0; i < 5; i++) {
            const start = Date.now();
            await supabase.rpc('rpc_compute_part_demand');
            demandTimings.push(Date.now() - start);
        }
        const demandP95 = calculatePercentile(demandTimings, 95);
        results.push({
            name: 'compute_demand',
            runs: 5,
            p50: calculatePercentile(demandTimings, 50),
            p95: demandP95,
            budget: BUDGETS.compute_demand,
            passed: demandP95 <= BUDGETS.compute_demand,
        });
        console.log(`     ${demandP95 <= BUDGETS.compute_demand ? '✅' : '❌'} p95=${demandP95}ms (budget: ${BUDGETS.compute_demand}ms)`);

        // Test 6: Compute Forecast (single run due to heavy operation)
        console.log('\n  🔄 Testing: compute_forecast (reduced runs for heavy operation)');
        const forecastTimings: number[] = [];
        for (let i = 0; i < 5; i++) {
            const start = Date.now();
            await supabase.rpc('rpc_compute_inventory_forecast');
            forecastTimings.push(Date.now() - start);
        }
        const forecastP95 = calculatePercentile(forecastTimings, 95);
        results.push({
            name: 'compute_forecast',
            runs: 5,
            p50: calculatePercentile(forecastTimings, 50),
            p95: forecastP95,
            budget: BUDGETS.compute_forecast,
            passed: forecastP95 <= BUDGETS.compute_forecast,
        });
        console.log(`     ${forecastP95 <= BUDGETS.compute_forecast ? '✅' : '❌'} p95=${forecastP95}ms (budget: ${BUDGETS.compute_forecast}ms)`);

        // Test 7: Generate Reorders (single run due to heavy operation)
        console.log('\n  🔄 Testing: generate_reorders (reduced runs for heavy operation)');
        const reorderTimings: number[] = [];
        for (let i = 0; i < 5; i++) {
            const start = Date.now();
            await supabase.rpc('rpc_generate_reorder_recommendations');
            reorderTimings.push(Date.now() - start);
        }
        const reorderP95 = calculatePercentile(reorderTimings, 95);
        results.push({
            name: 'generate_reorders',
            runs: 5,
            p50: calculatePercentile(reorderTimings, 50),
            p95: reorderP95,
            budget: BUDGETS.generate_reorders,
            passed: reorderP95 <= BUDGETS.generate_reorders,
        });
        console.log(`     ${reorderP95 <= BUDGETS.generate_reorders ? '✅' : '❌'} p95=${reorderP95}ms (budget: ${BUDGETS.generate_reorders}ms)`);

        // Print results table
        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log('  PERFORMANCE RESULTS');
        console.log('═══════════════════════════════════════════════════════════════');
        console.log('\n  Endpoint             | Runs | p50    | p95    | Budget  | Result');
        console.log('  ---------------------|------|--------|--------|---------|--------');

        for (const result of results) {
            const icon = result.passed ? '✅' : '❌';
            console.log(
                `  ${result.name.padEnd(20)} | ${result.runs.toString().padEnd(4)} | ${(result.p50 + 'ms').padEnd(6)} | ${(result.p95 + 'ms').padEnd(6)} | ${(result.budget + 'ms').padEnd(7)} | ${icon}`
            );
        }

        // Summary
        const failed = results.filter(r => !r.passed);
        const success = failed.length === 0;

        console.log('\n═══════════════════════════════════════════════════════════════');
        console.log(`  Result: ${success ? '✅ ALL PERFORMANCE BUDGETS MET' : '❌ PERFORMANCE BUDGETS EXCEEDED'}`);

        if (failed.length > 0) {
            console.log('\n  Failed Budgets:');
            failed.forEach(f => {
                console.log(`    - ${f.name}: p95=${f.p95}ms > budget=${f.budget}ms`);
            });
        }

        // Write artifacts
        const FROZEN_NOW = process.env.C19_FROZEN_NOW || new Date().toISOString();

        const artifactJson = {
            ok: success,
            startedAt: FROZEN_NOW,
            iters: RUNS_PER_TEST,
            warmup: WARMUP_RUNS,
            rows: results,
            errors: failed.map(f => `P95 FAIL: ${f.name} p95=${f.p95}ms > ${f.budget}ms`),
        };

        const artifactMd = [
            `# C19 Phase 5 — Performance Budgets`,
            `- **Started:** ${FROZEN_NOW}`,
            `- **Result:** ${success ? '✅ PASS' : '❌ FAIL'}`,
            ``,
            `| Target | p50 (ms) | p95 (ms) | Budget (ms) | n | Status |`,
            `|--------|----------|----------|-------------|---|--------|`,
            ...results.map(r => `| ${r.name} | ${r.p50} | ${r.p95} | ${r.budget} | ${r.runs} | ${r.passed ? '✅' : '❌'} |`),
            ``,
            `## Errors`,
            ...(failed.length ? failed.map(f => `- P95 FAIL: ${f.name} p95=${f.p95}ms > ${f.budget}ms`) : [`- None`]),
        ].join('\n');

        writeArtifacts('artifacts/c19_phase5', 'test_c19_performance_budgets', artifactJson, artifactMd);

        console.log('═══════════════════════════════════════════════════════════════\n');

        process.exit(success ? 0 : 1);

    } catch (error) {
        console.error('\n❌ FATAL ERROR:', error);
        process.exit(1);
    }
}

main();
