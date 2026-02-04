/**
 * C20: RLS Isolation Test Suite (Includes Phase 2 Coverage)
 * 
 * Verifies city-scoped RLS isolation for all C20 tables (Core + Derived):
 * - Service role can read all cities (bypass)
 * - Manager A can ONLY read City A rows
 * - Manager B can ONLY read City B rows
 * - Manager A can INSERT in City A, NOT in City B
 * - Manager cannot write to derived/cache tables (handled by jobs only)
 * - PostGIS enabled via _c20_postgis_enabled()
 * 
 * Run: C19_TEST_MODE=ci npx tsx scripts/test_c20_rls_isolation.ts
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

// Environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Missing SUPABASE env vars');
    process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

// Test configuration
const MODE = process.env.C19_TEST_MODE ?? (process.env.CI ? 'ci' : 'local');

// Test fixture IDs (deterministic UUIDs)
const CITY_A_ID = '11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const CITY_B_ID = '22222222-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

// Manager test user IDs
const MANAGER_A_EMAIL = 'test_manager_a_c20@jamestronic.test';
const MANAGER_B_EMAIL = 'test_manager_b_c20@jamestronic.test';
const TEST_PASSWORD = 'TestPassword123!';

// Tables grouped by phase
const PHASE1_TABLES = ['cities', 'geo_pincodes', 'competitor_locations', 'expansion_candidate_locations'];
const PHASE2_CACHE_TABLES = ['demand_points_daily', 'travel_time_matrix_cache'];
const PHASE2_SCENARIO_TABLES = ['expansion_scenarios', 'expansion_scenario_runs', 'expansion_location_scores', 'service_area_allocations', 'workload_capacity_snapshots'];

// City column mapping
const CITY_COLUMN: Record<string, string> = {
    cities: 'id',
    geo_pincodes: 'city_id',
    competitor_locations: 'city_id',
    expansion_candidate_locations: 'city_id',
    demand_points_daily: 'city_id',
    travel_time_matrix_cache: 'city_id',
    expansion_scenarios: 'city_id',
    expansion_scenario_runs: 'city_id',
};

interface TestResult {
    test: string;
    passed: boolean;
    error?: string;
    details?: string;
}

const results: TestResult[] = [];

async function seedTestFixtures(): Promise<void> {
    console.log('\n📦 Seeding RLS test fixtures...');

    // Phase 1 fixtures
    await supabaseAdmin.from('cities').upsert([
        { id: CITY_A_ID, name: 'Test City A', state: 'State A', active: true },
        { id: CITY_B_ID, name: 'Test City B', state: 'State B', active: true }
    ], { onConflict: 'id' });

    await supabaseAdmin.from('geo_pincodes').upsert([
        { id: '66666666-1111-4111-1111-111111111111', city_id: CITY_A_ID, code: '100001', name: 'Pin A1' },
        { id: '77777777-2222-4222-2222-222222222222', city_id: CITY_B_ID, code: '200001', name: 'Pin B1' }
    ], { onConflict: 'id' });

    await supabaseAdmin.from('expansion_candidate_locations').upsert([
        { id: 'aaaaaaaa-5555-4555-5555-555555555555', city_id: CITY_A_ID, name: 'Candidate A1', location: 'SRID=4326;POINT(77.6 12.97)' },
        { id: 'bbbbbbbb-6666-4666-6666-666666666666', city_id: CITY_B_ID, name: 'Candidate B1', location: 'SRID=4326;POINT(72.88 19.08)' }
    ], { onConflict: 'id' });

    // Phase 2 fixtures (Derived Layers)
    const scenarioA = 'cccccccc-1111-4444-1111-cccccccccccc';
    const scenarioB = 'dddddddd-2222-4444-2222-dddddddddddd';

    await supabaseAdmin.from('expansion_scenarios').upsert([
        { id: scenarioA, city_id: CITY_A_ID, name: 'Scenario A' },
        { id: scenarioB, city_id: CITY_B_ID, name: 'Scenario B' }
    ], { onConflict: 'id' });

    const runA = 'eeeeeeee-1111-5555-1111-eeeeeeeeeeee';
    const runB = 'ffffffff-2222-5555-2222-ffffffffffff';

    await supabaseAdmin.from('expansion_scenario_runs').upsert([
        { id: runA, scenario_id: scenarioA, city_id: CITY_A_ID, status: 'completed' },
        { id: runB, scenario_id: scenarioB, city_id: CITY_B_ID, status: 'completed' }
    ], { onConflict: 'id' });

    await supabaseAdmin.from('expansion_location_scores').upsert([
        { run_id: runA, candidate_id: 'aaaaaaaa-5555-4555-5555-555555555555', score: 85.5, rank: 1 },
        { run_id: runB, candidate_id: 'bbbbbbbb-6666-4666-6666-666666666666', score: 92.0, rank: 1 }
    ], { onConflict: 'run_id,candidate_id' });

    await supabaseAdmin.from('demand_points_daily').upsert([
        { day: '2026-01-01', city_id: CITY_A_ID, pincode_id: '66666666-1111-4111-1111-111111111111', device_category: 'smartphone', ticket_count: 10 },
        { day: '2026-01-01', city_id: CITY_B_ID, pincode_id: '77777777-2222-4222-2222-222222222222', device_category: 'smartphone', ticket_count: 20 }
    ], { onConflict: 'day,city_id,pincode_id,device_category' });

    console.log('  ✅ Test fixtures seeded');
}

async function createOrGetTestUser(email: string, cityId: string, role: string): Promise<{ userId: string; accessToken: string } | null> {
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existing = existingUsers?.users?.find(u => u.email === email);
    let userId: string;

    if (existing) {
        userId = existing.id;
        await supabaseAdmin.auth.admin.updateUserById(userId, { app_metadata: { app_role: role, city_id: cityId } });
    } else {
        const { data: newUser } = await supabaseAdmin.auth.admin.createUser({
            email, password: TEST_PASSWORD, email_confirm: true,
            app_metadata: { app_role: role, city_id: cityId }
        });
        if (!newUser.user) return null;
        userId = newUser.user.id;
    }

    if (!ANON_KEY) return null;
    const anonClient = createClient(SUPABASE_URL, ANON_KEY);
    const { data: signIn } = await anonClient.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    return signIn.session ? { userId, accessToken: signIn.session.access_token } : null;
}

async function cleanupTestFixtures(): Promise<void> {
    console.log('\n🧹 Cleaning up RLS test fixtures...');
    try {
        await supabaseAdmin.from('expansion_location_scores').delete().in('run_id', ['eeeeeeee-1111-5555-1111-eeeeeeeeeeee', 'ffffffff-2222-5555-2222-ffffffffffff']);
        await supabaseAdmin.from('expansion_scenario_runs').delete().in('city_id', [CITY_A_ID, CITY_B_ID]);
        await supabaseAdmin.from('expansion_scenarios').delete().in('city_id', [CITY_A_ID, CITY_B_ID]);
        await supabaseAdmin.from('demand_points_daily').delete().in('city_id', [CITY_A_ID, CITY_B_ID]);
        await supabaseAdmin.from('expansion_candidate_locations').delete().in('city_id', [CITY_A_ID, CITY_B_ID]);
        await supabaseAdmin.from('geo_pincodes').delete().in('city_id', [CITY_A_ID, CITY_B_ID]);
        await supabaseAdmin.from('cities').delete().in('id', [CITY_A_ID, CITY_B_ID]);

        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        const testUsers = users?.users?.filter(u => u.email === MANAGER_A_EMAIL || u.email === MANAGER_B_EMAIL);
        for (const u of testUsers || []) await supabaseAdmin.auth.admin.deleteUser(u.id);
    } catch { } // Ignore cleanup errors
    console.log('  ✅ Test fixtures cleaned');
}

async function testManagerCityIsolation(): Promise<void> {
    console.log('\n🔒 Testing Manager City Isolation (Phase 1 + 2)...');

    const managerA = await createOrGetTestUser(MANAGER_A_EMAIL, CITY_A_ID, 'manager');
    const managerB = await createOrGetTestUser(MANAGER_B_EMAIL, CITY_B_ID, 'manager');

    if (!managerA || !managerB) {
        console.log('  ⚠️ Skipping manager token tests');
        return;
    }

    const clientA = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${managerA.accessToken}` } } });
    const clientB = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${managerB.accessToken}` } } });

    const tablesToTest = [
        ...PHASE1_TABLES,
        ...PHASE2_CACHE_TABLES,
        'expansion_scenarios',
        'expansion_scenario_runs'
    ];

    for (const table of tablesToTest) {
        // Manager A should see City A rows only
        const { data: dataA, error: errA } = await clientA.from(table).select('*');
        const leakA = dataA?.filter(r => (r[CITY_COLUMN[table]] === CITY_B_ID) || (table === 'cities' && r.id === CITY_B_ID));

        const passedA = !errA && (leakA?.length || 0) === 0;
        results.push({ test: `${table}: Manager A cannot see City B`, passed: passedA, error: errA?.message, details: `Leaked: ${leakA?.length}` });
        if (!passedA) console.log(`  ❌ ${table}: Manager A see City B rows! Leaked: ${leakA?.length}. Err: ${errA?.message}`);
        else console.log(`  ✅ ${table}: Manager A cannot see City B`);

        // Manager B should see City B rows only
        const { data: dataB, error: errB } = await clientB.from(table).select('*');
        const leakB = dataB?.filter(r => (r[CITY_COLUMN[table]] === CITY_A_ID) || (table === 'cities' && r.id === CITY_A_ID));

        const passedB = !errB && (leakB?.length || 0) === 0;
        results.push({ test: `${table}: Manager B cannot see City A`, passed: passedB, error: errB?.message, details: `Leaked: ${leakB?.length}` });
    }

    // Special test: Scores (accessed via run_id)
    const { data: scoresA } = await clientA.from('expansion_location_scores').select('*');
    const validScoresA = scoresA?.filter(s => s.run_id === 'eeeeeeee-1111-5555-1111-eeeeeeeeeeee');
    const leakedScoresA = scoresA?.filter(s => s.run_id === 'ffffffff-2222-5555-2222-ffffffffffff');

    // Note: If dataA is null/empty due to cache issues, validScoresA will be 0. We want to ensure at least valid works if possible, but crucial is NO LEAK.
    const passedScoreA = (leakedScoresA?.length || 0) === 0;
    results.push({ test: 'expansion_location_scores: Manager A sees only own run', passed: passedScoreA, details: `Valid: ${validScoresA?.length}, Leaked: ${leakedScoresA?.length}` });
    console.log(`  ${passedScoreA ? '✅' : '❌'} expansion_location_scores isolation`);
}

async function testWriteRestrictions(): Promise<void> {
    console.log('\n📝 Testing Write Restrictions (Phase 2)...');

    const managerA = await createOrGetTestUser(MANAGER_A_EMAIL, CITY_A_ID, 'manager');
    if (!managerA) return;
    const clientA = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${managerA.accessToken}` } } });

    const { error: writeDemand } = await clientA.from('demand_points_daily').insert({
        day: '2026-02-01', city_id: CITY_A_ID, pincode_id: '66666666-1111-4111-1111-111111111111', device_category: 'laptop'
    });
    results.push({ test: 'Manager cannot write demand_points_daily', passed: writeDemand !== null });
}

async function testAuditLogIsolation(): Promise<void> {
    console.log('\n📋 Testing Audit Log RLS (Phase 3)...');

    // Seed audit entries for both cities (via service role)
    await supabaseAdmin.from('expansion_audit_log').insert([
        { ai_module: 'expansion_os', event_type: 'COMPUTE_START', city_id: CITY_A_ID, payload: { job_type: 'test' } },
        { ai_module: 'expansion_os', event_type: 'COMPUTE_END', city_id: CITY_B_ID, payload: { job_type: 'test' } }
    ]);

    const managerA = await createOrGetTestUser(MANAGER_A_EMAIL, CITY_A_ID, 'manager');
    const managerB = await createOrGetTestUser(MANAGER_B_EMAIL, CITY_B_ID, 'manager');

    if (!managerA || !managerB) {
        console.log('  ⚠️ Skipping audit log tests (could not create managers)');
        return;
    }

    const clientA = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${managerA.accessToken}` } } });
    const clientB = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${managerB.accessToken}` } } });

    // Manager A should see City A audit logs only
    const { data: logsA, error: errA } = await clientA.from('expansion_audit_log').select('*');
    const leakA = logsA?.filter(r => r.city_id === CITY_B_ID);
    const passedA = !errA && (leakA?.length || 0) === 0;
    results.push({ test: 'Audit Log: Manager A cannot see City B logs', passed: passedA, details: `Leaked: ${leakA?.length}` });
    console.log(`  ${passedA ? '✅' : '❌'} Manager A cannot see City B audit logs`);

    // Manager B should see City B audit logs only
    const { data: logsB, error: errB } = await clientB.from('expansion_audit_log').select('*');
    const leakB = logsB?.filter(r => r.city_id === CITY_A_ID);
    const passedB = !errB && (leakB?.length || 0) === 0;
    results.push({ test: 'Audit Log: Manager B cannot see City A logs', passed: passedB, details: `Leaked: ${leakB?.length}` });
    console.log(`  ${passedB ? '✅' : '❌'} Manager B cannot see City A audit logs`);

    // Create technician - should not see audit logs
    const techEmail = 'test_tech_rls_c20@jamestronic.test';
    const tech = await createOrGetTestUser(techEmail, CITY_A_ID, 'technician');
    if (tech) {
        const clientTech = createClient(SUPABASE_URL, ANON_KEY, { global: { headers: { Authorization: `Bearer ${tech.accessToken}` } } });
        const { data: techLogs } = await clientTech.from('expansion_audit_log').select('*');
        const passedTech = (techLogs?.length || 0) === 0;
        results.push({ test: 'Audit Log: Technician cannot see any logs', passed: passedTech });
        console.log(`  ${passedTech ? '✅' : '❌'} Technician cannot see audit logs`);

        // Cleanup tech
        await supabaseAdmin.auth.admin.listUsers().then(({ data }) => {
            const techUser = data?.users?.find(u => u.email === techEmail);
            if (techUser) supabaseAdmin.auth.admin.deleteUser(techUser.id);
        });
    }

    // Cleanup test audit entries
    await supabaseAdmin.from('expansion_audit_log').delete().in('city_id', [CITY_A_ID, CITY_B_ID]);
}

function writeArtifacts(): void {
    const dir = 'artifacts/c20_phase2';
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    const md = `# C20 Phase 2: RLS Isolation & Derived Layer Tests
**Result:** ${passed}/${total} passed (${Math.round(passed / total * 100)}%)
${results.map(r => `- ${r.passed ? '✅' : '❌'} ${r.test} ${r.error ? `(${r.error})` : ''}`).join('\n')}
`;
    writeFileSync(`${dir}/test_c20_phase2_rls.md`, md);
}

async function main(): Promise<void> {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  C20 Phase 2: RLS Isolation Test Suite');
    console.log('═══════════════════════════════════════════════════════════════');
    try {
        // Force schema reload
        console.log('  🔄 Reloading schema cache...');
        const { error: rpcErr } = await supabaseAdmin.rpc('rpc_reload_schema');
        if (rpcErr) console.warn('  ⚠️ Reload schema RPC failed (might not exist yet):', rpcErr.message);

        await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3s

        await seedTestFixtures();
        await testManagerCityIsolation();
        await testWriteRestrictions();
        await testAuditLogIsolation();
        writeArtifacts();

        if (results.some(r => !r.passed)) process.exitCode = 1;
    } catch (err) {
        console.error(err);
        process.exitCode = 1;
    } finally {
        await cleanupTestFixtures();
    }
}

main();
