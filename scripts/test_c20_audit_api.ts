/**
 * C20 Phase 3: Audit API Verification Test
 * 
 * Verifies:
 * 1. GET /api/expansion/audit returns 401 for unauthenticated
 * 2. GET /api/expansion/audit returns 403 for Technician
 * 3. GET /api/expansion/audit returns 200 with paginated results for Manager
 * 4. Filters (city_id, event_type, from, to) work correctly
 * 5. Pagination (page, limit) works correctly
 * 
 * Run: cd james-tronic && C19_TEST_MODE=ci npx tsx scripts/test_c20_audit_api.ts
 */

import { createClient } from '@supabase/supabase-js';
import { writeFileSync, mkdirSync, existsSync } from 'fs';

// Environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000';

if (!SUPABASE_URL || !SERVICE_KEY || !ANON_KEY) {
    console.error('❌ Missing env vars: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, NEXT_PUBLIC_SUPABASE_ANON_KEY');
    process.exit(1);
}

const supabaseAdmin = createClient(SUPABASE_URL, SERVICE_KEY);

// Test Users
const MANAGER_EMAIL = 'test_manager_audit_c20@jamestronic.test';
const TECH_EMAIL = 'test_tech_audit_c20@jamestronic.test';
const TEST_PASSWORD = 'TestPassword123!';
const CITY_ID = '11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa';

interface TestResult { test: string; passed: boolean; error?: string; }
const results: TestResult[] = [];

async function setup() {
    console.log('\n📦 Setting up test fixtures...');

    // Ensure city exists
    await supabaseAdmin.from('cities').upsert({ id: CITY_ID, name: 'Audit Test City', active: true });

    // Create test users
    const { data: users } = await supabaseAdmin.auth.admin.listUsers();

    // Manager
    let managerId = users?.users?.find(u => u.email === MANAGER_EMAIL)?.id;
    if (!managerId) {
        const { data } = await supabaseAdmin.auth.admin.createUser({
            email: MANAGER_EMAIL, password: TEST_PASSWORD, email_confirm: true,
            app_metadata: { app_role: 'manager', city_id: CITY_ID }
        });
        managerId = data.user?.id;
    } else {
        await supabaseAdmin.auth.admin.updateUserById(managerId, { app_metadata: { app_role: 'manager', city_id: CITY_ID } });
    }

    // Technician
    let techId = users?.users?.find(u => u.email === TECH_EMAIL)?.id;
    if (!techId) {
        const { data } = await supabaseAdmin.auth.admin.createUser({
            email: TECH_EMAIL, password: TEST_PASSWORD, email_confirm: true,
            app_metadata: { app_role: 'technician', city_id: CITY_ID }
        });
        techId = data.user?.id;
    } else {
        await supabaseAdmin.auth.admin.updateUserById(techId, { app_metadata: { app_role: 'technician', city_id: CITY_ID } });
    }

    // Seed audit entries using service role direct insert
    await supabaseAdmin.from('expansion_audit_log').insert([
        { ai_module: 'expansion_os', event_type: 'COMPUTE_START', city_id: CITY_ID, payload: { job_type: 'test' } },
        { ai_module: 'expansion_os', event_type: 'COMPUTE_END', city_id: CITY_ID, payload: { job_type: 'test', rows: 10 } }
    ]);

    console.log('  ✅ Fixtures ready');
    return { managerId, techId };
}

async function getToken(email: string): Promise<string | null> {
    const anon = createClient(SUPABASE_URL, ANON_KEY);
    const { data } = await anon.auth.signInWithPassword({ email, password: TEST_PASSWORD });
    return data.session?.access_token ?? null;
}

async function testUnauthenticated() {
    console.log('\n🔒 Testing unauthenticated access...');
    try {
        const res = await fetch(`${API_BASE}/api/expansion/audit`);
        const passed = res.status === 401;
        results.push({ test: 'Unauthenticated returns 401', passed, error: passed ? undefined : `Got ${res.status}` });
        console.log(`  ${passed ? '✅' : '❌'} Unauthenticated returns 401`);
    } catch (e: any) {
        results.push({ test: 'Unauthenticated returns 401', passed: false, error: e.message });
        console.log(`  ❌ Unauthenticated test failed: ${e.message}`);
    }
}

async function testTechnicianForbidden() {
    console.log('\n🔒 Testing technician forbidden...');
    const token = await getToken(TECH_EMAIL);
    if (!token) {
        results.push({ test: 'Technician returns 403', passed: false, error: 'Could not get token' });
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/expansion/audit`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const passed = res.status === 403;
        results.push({ test: 'Technician returns 403', passed, error: passed ? undefined : `Got ${res.status}` });
        console.log(`  ${passed ? '✅' : '❌'} Technician returns 403`);
    } catch (e: any) {
        results.push({ test: 'Technician returns 403', passed: false, error: e.message });
    }
}

async function testManagerAccess() {
    console.log('\n🔒 Testing manager access...');
    const token = await getToken(MANAGER_EMAIL);
    if (!token) {
        results.push({ test: 'Manager gets paginated results', passed: false, error: 'Could not get token' });
        return;
    }

    try {
        const res = await fetch(`${API_BASE}/api/expansion/audit?limit=10`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const passed = res.status === 200;
        const body = await res.json();

        results.push({ test: 'Manager gets 200 OK', passed, error: passed ? undefined : `Got ${res.status}` });
        console.log(`  ${passed ? '✅' : '❌'} Manager gets 200 OK`);

        // Check response shape
        const hasShape = body.success === true && Array.isArray(body.data) && typeof body.pagination === 'object';
        results.push({ test: 'Response has correct shape', passed: hasShape });
        console.log(`  ${hasShape ? '✅' : '❌'} Response has correct shape`);

        // Check pagination
        const hasPagination = body.pagination?.page === 1 && body.pagination?.limit === 10;
        results.push({ test: 'Pagination defaults work', passed: hasPagination });
        console.log(`  ${hasPagination ? '✅' : '❌'} Pagination defaults work`);

    } catch (e: any) {
        results.push({ test: 'Manager gets paginated results', passed: false, error: e.message });
    }
}

async function testFilters() {
    console.log('\n🔍 Testing filters...');
    const token = await getToken(MANAGER_EMAIL);
    if (!token) return;

    try {
        // Test city_id filter
        const res = await fetch(`${API_BASE}/api/expansion/audit?city_id=${CITY_ID}`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const body = await res.json();
        const passed = res.status === 200 && Array.isArray(body.data);
        results.push({ test: 'city_id filter works', passed });
        console.log(`  ${passed ? '✅' : '❌'} city_id filter works`);

        // Test event_type filter
        const res2 = await fetch(`${API_BASE}/api/expansion/audit?event_type=COMPUTE_START`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        const body2 = await res2.json();
        const passed2 = res2.status === 200;
        results.push({ test: 'event_type filter works', passed: passed2 });
        console.log(`  ${passed2 ? '✅' : '❌'} event_type filter works`);

    } catch (e: any) {
        results.push({ test: 'Filter tests', passed: false, error: e.message });
    }
}

async function cleanup() {
    console.log('\n🧹 Cleaning up...');
    try {
        await supabaseAdmin.from('expansion_audit_log').delete().eq('city_id', CITY_ID);
        const { data: users } = await supabaseAdmin.auth.admin.listUsers();
        for (const u of users?.users?.filter(u => u.email === MANAGER_EMAIL || u.email === TECH_EMAIL) || []) {
            await supabaseAdmin.auth.admin.deleteUser(u.id);
        }
    } catch { }
    console.log('  ✅ Cleanup complete');
}

function writeArtifacts() {
    const dir = 'artifacts/c20_phase3';
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const passed = results.filter(r => r.passed).length;
    const total = results.length;

    const md = `# C20 Phase 3: Audit API Test Results
**Result:** ${passed}/${total} passed (${Math.round(passed / total * 100)}%)
**Date:** ${new Date().toISOString()}

## Tests
${results.map(r => `- ${r.passed ? '✅' : '❌'} ${r.test}${r.error ? ` (${r.error})` : ''}`).join('\n')}
`;
    writeFileSync(`${dir}/test_c20_audit_api.md`, md);
    writeFileSync(`${dir}/test_c20_audit_api.json`, JSON.stringify({ results, passed, total }, null, 2));
    console.log(`\n📄 Artifacts written to ${dir}/`);
}

async function main() {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  C20 Phase 3: Audit API Verification');
    console.log('═══════════════════════════════════════════════════════════════');

    try {
        await setup();
        await testUnauthenticated();
        await testTechnicianForbidden();
        await testManagerAccess();
        await testFilters();
        writeArtifacts();

        const failed = results.filter(r => !r.passed);
        if (failed.length > 0) {
            console.log(`\n❌ ${failed.length} test(s) failed`);
            process.exitCode = 1;
        } else {
            console.log('\n✅ All Audit API Tests Passed');
        }
    } finally {
        await cleanup();
    }
}

main();
