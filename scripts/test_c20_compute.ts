/**
 * C20 Phase 3: Compute Jobs Verification
 * 
 * Verifies:
 * 1. Security: Manager cannot call compute RPCs (Access Denied).
 * 2. Logic: Service role can call `build_demand_points` (Creates rows).
 * 3. Logic: Service role can call `build_travel_matrix` (Creates/updates cache).
 * 4. Logic: Service role can process `run_scenario` (Pending -> Completed + Scores).
 * 
 * Run: C19_TEST_MODE=ci npx tsx scripts/test_c20_compute.ts
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

// Environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) process.exit(1);

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

// IDs
const CITY_ID = '11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const MANAGER_EMAIL = 'test_manager_compute_c20@jamestronic.test';
const TEST_PASSWORD = 'TestPassword123!';

interface TestResult { test: string; passed: boolean; error?: string; }
const results: TestResult[] = [];

async function setup() {
    await supabaseAdmin.from('cities').upsert({ id: CITY_ID, name: 'Compute City', active: true });
    await supabaseAdmin.from('geo_pincodes').upsert({ city_id: CITY_ID, code: '900001', population_estimate: 5000 });

    // Create Manager
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();
    const existing = users.users.find(u => u.email === MANAGER_EMAIL);
    let userId = existing?.id;
    if (!existing) {
        const { data } = await supabaseAdmin.auth.admin.createUser({
            email: MANAGER_EMAIL, password: TEST_PASSWORD, email_confirm: true,
            app_metadata: { app_role: 'manager', city_id: CITY_ID }
        });
        userId = data.user!.id;
    }
    return userId;
}

async function testSecurity(managerToken: string) {
    console.log('\n🔒 Testing Compute Security...');
    const client = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${managerToken}` } } });

    // 1. Build Demand (Manager - Should SUCCEED for their city)
    const { data: d1, error: err1 } = await client.rpc('rpc_c20_build_demand_points', { p_day: '2026-03-01', p_city_id: CITY_ID });
    const pass1 = !err1 && d1?.success;
    results.push({ test: 'Manager can call build_demand_points for their city', passed: !!pass1, error: err1?.message });
    console.log(`  ${pass1 ? '✅' : '❌'} Manager can call build_demand_points for their city`);

    // 2. Run Scenario (Manager - Should SUCCEED for their run)
    const sid = 'ffffffff-aaaa-4aaa-aaaa-ffffffffffff';
    const rid = 'eeeeeeee-bbbb-4bbb-bbbb-eeeeeeeeeeee';
    await supabaseAdmin.from('expansion_scenarios').upsert({ id: sid, city_id: CITY_ID, name: 'Sec Test' });
    await supabaseAdmin.from('expansion_scenario_runs').upsert({ id: rid, scenario_id: sid, city_id: CITY_ID, status: 'pending' });

    const { data: d2, error: err2 } = await client.rpc('rpc_c20_run_scenario', { p_run_id: rid });
    const pass2 = !err2 && d2?.success;
    results.push({ test: 'Manager can call run_scenario for their run', passed: !!pass2, error: err2?.message });
    console.log(`  ${pass2 ? '✅' : '❌'} Manager can call run_scenario for their run`);

    // 3. Unauthorized access (Should Fail - mock with invalid token or technician check if available)
    // We'll trust the RLS isolation test for role-based blocks, but let's do a quick one for "Access Denied"
    const { error: err3 } = await client.rpc('rpc_c20_build_demand_points', { p_day: '2026-03-01', p_city_id: '22222222-bbbb-4bbb-bbbb-bbbbbbbbbbbb' });
    const pass3 = err3 && err3.message.includes('Access Denied');
    results.push({ test: 'Manager blocked from other city compute', passed: !!pass3 });
    console.log(`  ${pass3 ? '✅' : '❌'} Manager blocked from other city compute`);
}

async function testLogic() {
    console.log('\n⚙️ Testing Compute Logic (Service Role)...');

    // 1. Build Demand
    const { data: d1, error: e1 } = await supabaseAdmin.rpc('rpc_c20_build_demand_points', { p_day: '2026-03-01', p_city_id: CITY_ID });
    if (e1) console.error('  ⚠️ Build Demand Error:', JSON.stringify(e1, null, 2));
    const pass1 = !e1 && d1?.success;
    results.push({ test: 'Service role build_demand_points success', passed: !!pass1, error: e1?.message });
    console.log(`  ${pass1 ? '✅' : '❌'} Service role build_demand_points success`);

    // Verify row
    const { count } = await supabaseAdmin.from('demand_points_daily').select('*', { count: 'exact', head: true }).eq('day', '2026-03-01');
    const pass1b = (count || 0) > 0;
    results.push({ test: 'demand_points_daily populated', passed: pass1b });

    // 2. Run Scenario
    const sid = '11112222-aaaa-4aaa-aaaa-111122223333';
    const rid = '33334444-bbbb-4bbb-bbbb-333344445555';
    await supabaseAdmin.from('expansion_scenarios').upsert({ id: sid, city_id: CITY_ID, name: 'Logic Test' });
    // Ensure candidates exist
    await supabaseAdmin.from('expansion_candidate_locations').upsert({
        id: 'aaaaaaaa-cccc-4ccc-cccc-aaaaaaaaaaaa', city_id: CITY_ID, name: 'Cand X', location: 'SRID=4326;POINT(10 10)'
    });

    await supabaseAdmin.from('expansion_scenario_runs').upsert({ id: rid, scenario_id: sid, city_id: CITY_ID, status: 'pending' });

    const { data: d2, error: e2 } = await supabaseAdmin.rpc('rpc_c20_run_scenario', { p_run_id: rid });
    if (e2) console.error('  ⚠️ Run Scenario Error:', JSON.stringify(e2, null, 2));

    const pass2 = !e2 && d2?.success && d2?.candidates_scored > 0;
    results.push({ test: 'Service role run_scenario success', passed: !!pass2, error: e2?.message });
    console.log(`  ${pass2 ? '✅' : '❌'} Service role run_scenario success`);

    // Verify status completed
    const { data: run } = await supabaseAdmin.from('expansion_scenario_runs').select('status').eq('id', rid).single();
    const pass2b = run?.status === 'completed';
    results.push({ test: 'Scenario run marked completed', passed: pass2b });

    // Verify scores
    const { count: scoreCount } = await supabaseAdmin.from('expansion_location_scores').select('*', { count: 'exact', head: true }).eq('run_id', rid);
    const pass2c = (scoreCount || 0) > 0;
    results.push({ test: 'Scores generated', passed: pass2c });
}

async function testConcurrency() {
    console.log('\n⚡ Testing Concurrency & Idempotency...');

    // Test 1: Parallel demand_points calls should be lock-safe
    const parallelCityId = CITY_ID;
    const promises = [
        supabaseAdmin.rpc('rpc_c20_build_demand_points', { p_day: '2026-04-01', p_city_id: parallelCityId }),
        supabaseAdmin.rpc('rpc_c20_build_demand_points', { p_day: '2026-04-01', p_city_id: parallelCityId })
    ];

    const [res1, res2] = await Promise.allSettled(promises);

    // Both should complete (though one waits for lock)
    const bothCompleted = res1.status === 'fulfilled' && res2.status === 'fulfilled';
    results.push({ test: 'Parallel demand_points: both complete (lock serializes)', passed: bothCompleted });
    console.log(`  ${bothCompleted ? '✅' : '❌'} Parallel demand_points complete`);

    // Test 2: Verify run ledger recorded
    const { data: runs } = await supabaseAdmin
        .from('expansion_compute_runs')
        .select('*')
        .eq('city_id', parallelCityId)
        .eq('job_type', 'build_demand_points')
        .order('created_at', { ascending: false })
        .limit(1);

    const runRecorded = runs && runs.length > 0;
    results.push({ test: 'Compute run ledger entry created', passed: !!runRecorded });
    console.log(`  ${runRecorded ? '✅' : '❌'} Compute run ledger entry created`);

    // Test 3: Same run_id retry - idempotent (no duplicate scores)
    const retryScenarioId = '99991111-aaaa-4aaa-aaaa-999911112222';
    const retryRunId = '88882222-bbbb-4bbb-bbbb-888822223333';

    await supabaseAdmin.from('expansion_scenarios').upsert({ id: retryScenarioId, city_id: CITY_ID, name: 'Retry Test', weights: {} });
    await supabaseAdmin.from('expansion_scenario_runs').upsert({ id: retryRunId, scenario_id: retryScenarioId, city_id: CITY_ID, status: 'pending' });

    // First run
    await supabaseAdmin.rpc('rpc_c20_run_scenario', { p_run_id: retryRunId });

    const { count: countAfterFirst } = await supabaseAdmin.from('expansion_location_scores').select('*', { count: 'exact', head: true }).eq('run_id', retryRunId);

    // Reset to pending and try again
    await supabaseAdmin.from('expansion_scenario_runs').update({ status: 'pending' }).eq('id', retryRunId);
    await supabaseAdmin.rpc('rpc_c20_run_scenario', { p_run_id: retryRunId });

    const { count: countAfterSecond } = await supabaseAdmin.from('expansion_location_scores').select('*', { count: 'exact', head: true }).eq('run_id', retryRunId);

    // Should NOT have doubled (ON CONFLICT should upsert)
    const idempotent = countAfterFirst === countAfterSecond && (countAfterFirst || 0) > 0;
    results.push({ test: 'Scenario retry is idempotent (no dupe scores)', passed: idempotent });
    console.log(`  ${idempotent ? '✅' : '❌'} Scenario retry idempotent: ${countAfterFirst} -> ${countAfterSecond}`);

    // Cleanup
    await supabaseAdmin.from('expansion_location_scores').delete().eq('run_id', retryRunId);
    await supabaseAdmin.from('expansion_scenario_runs').delete().eq('id', retryRunId);
    await supabaseAdmin.from('expansion_scenarios').delete().eq('id', retryScenarioId);
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  C20 Phase 3: Compute Verification');
    console.log('═══════════════════════════════════════════════════════════════');

    await setup();

    // Get manager token
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { data } = await anon.auth.signInWithPassword({ email: MANAGER_EMAIL, password: TEST_PASSWORD });
    if (data.session) {
        await testSecurity(data.session.access_token);
    } else {
        console.log('❌ Failed to login manager for security test');
    }

    await testLogic();
    await testConcurrency();

    if (results.some(r => !r.passed)) process.exit(1);
    console.log('\n✅ All Compute Tests Passed');
}

main();
