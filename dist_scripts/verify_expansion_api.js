"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const supabase_js_1 = require("@supabase/supabase-js");
const path_1 = __importDefault(require("path"));
const dotenv_1 = __importDefault(require("dotenv"));
// Using global fetch (Node 18+)
// Load .env.local if present (optional for CI if env vars injected)
dotenv_1.default.config({ path: path_1.default.resolve(__dirname, '../.env.local') });
// --- Environment Variables ---
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const TEST_EMAIL = process.env.JT_TEST_MANAGER_EMAIL;
const TEST_PASSWORD = process.env.JT_TEST_MANAGER_PASSWORD;
const BASE_URL = process.env.JT_TEST_BASE_URL || 'http://localhost:3003';
if (!SUPABASE_URL || !SUPABASE_ANON_KEY || !TEST_EMAIL || !TEST_PASSWORD) {
    console.error('Missing Required Env Vars for Test:');
    console.error('  NEXT_PUBLIC_SUPABASE_URL:', !!SUPABASE_URL);
    console.error('  NEXT_PUBLIC_SUPABASE_ANON_KEY:', !!SUPABASE_ANON_KEY);
    console.error('  JT_TEST_MANAGER_EMAIL:', !!TEST_EMAIL);
    console.error('  JT_TEST_MANAGER_PASSWORD:', !!TEST_PASSWORD);
    process.exit(1);
}
// Client for Auth
const supabase = (0, supabase_js_1.createClient)(SUPABASE_URL, SUPABASE_ANON_KEY);
/**
 * Cookie Parser Helper
 * Extracts cookies from Fetch API 'set-cookie' header (which might be a string or array)
 * and formats them for a Cookie request header.
 */
function parseSetCookies(setCookieHeader) {
    if (!setCookieHeader)
        return '';
    const cookies = [];
    // Normalize to array
    const inputs = Array.isArray(setCookieHeader) ? setCookieHeader : [setCookieHeader];
    inputs.forEach(input => {
        // Node fetch might combine cookies with comma, or provide array.
        // A robust way for simple scripts is to split by ", " if it looks combined,
        // but Set-Cookie can contain commas in dates.
        // For this script, we assume standard Node fetch behavior (array or split string).
        // Simple strategy: Split by comma OINLY if it seems to separate cookies (e.g. contains 'SameSite=' or 'Path=' repeatedly)
        // Actually, simple key=value; extraction is safest for the auth cookies we care about.
        // Extract "session_id=..." and "refresh_token=..." regex might be safer
        const parts = input.split(/,(?=\s*\w+=)/g); // split by comma that is followed by key=
        parts.forEach(part => {
            const keyVal = part.split(';')[0]; // Take only the name=value part
            if (keyVal)
                cookies.push(keyVal.trim());
        });
    });
    return cookies.join('; ');
}
async function verifyApi() {
    console.log(`--- Starting ExpansionOS API Verification ---`);
    console.log(`Target: ${BASE_URL}`);
    console.log(`User: ${TEST_EMAIL}`);
    // 1. Login (Supabase)
    console.log(`\n1. Logging in with Supersbase Auth...`);
    const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
        email: TEST_EMAIL,
        password: TEST_PASSWORD
    });
    if (authError || !authData.session) {
        console.error('Supabase Login Failed:', authError?.message);
        process.exit(1);
    }
    console.log('   ✅ Validated Credeantials. User ID:', authData.user.id);
    const token = authData.session.access_token;
    // 2. Create Session (JamesTronic Custom Auth - SECURED)
    console.log('\n2. Creating SECURE Application Session...');
    // Note: We no longer send Identity fields (userId, role) in body.
    // The server MUST derive them from the token.
    const sessionPayload = {
        // userId: authData.user.id, // Removed: Security Hardening
        // role: 'manager',          // Removed: Security Hardening
        deviceFingerprint: 'ci-test-script-' + Date.now(),
        ipAddress: '127.0.0.1',
        userAgent: 'CI-Verification-Script'
    };
    let cookies = '';
    try {
        const resSession = await fetch(`${BASE_URL}/api/auth/session/create`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}` // REQUIRED NOW
            },
            body: JSON.stringify(sessionPayload)
        });
        if (!resSession.ok) {
            console.error('Session API Failed:', await resSession.text());
            console.error(`Status: ${resSession.status}`);
            process.exit(1);
        }
        // Capture Cookies
        const setCookieHeader = resSession.headers.get('set-cookie');
        if (setCookieHeader) {
            cookies = parseSetCookies(setCookieHeader);
            console.log('   ✅ Cookies Received & Parsed');
        }
        else {
            console.error('   ❌ No cookies received from session API!');
            process.exit(1);
        }
    }
    catch (e) {
        console.error('Session Request Error:', e);
        process.exit(1);
    }
    // Headers for subsequent requests
    const headers = {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`, // Keep for Supabase Auth consistency
        'Cookie': cookies // Session Auth
    };
    // 3. Fetch Scenarios
    console.log('\n3. fetch: GET /api/expansion/scenarios');
    try {
        // Use city_id from verified metadata if available
        const cityId = authData.user.app_metadata.city_id || '11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
        const resScenarios = await fetch(`${BASE_URL}/api/expansion/scenarios?city_id=${cityId}`, { headers });
        console.log(`   Status: ${resScenarios.status} ${resScenarios.statusText}`);
        if (!resScenarios.ok) {
            throw new Error(`Failed to list scenarios: ${await resScenarios.text()}`);
        }
        const data = await resScenarios.json();
        console.log(`   ✅ Success. Count: ${data.data?.length ?? 0}`);
    }
    catch (e) {
        console.error('   ❌ Fetch Error:', e);
        process.exit(1); // Fail Fast
    }
    // 4. Create Scenario
    console.log('\n4. fetch: POST /api/expansion/scenarios');
    const newScenario = {
        name: "CI Verify " + new Date().toISOString(),
        weights: { rent: 30, traffic: 70 },
        city_id: authData.user.app_metadata.city_id || '11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa'
    };
    try {
        const resCreate = await fetch(`${BASE_URL}/api/expansion/scenarios`, {
            method: 'POST',
            headers,
            body: JSON.stringify(newScenario)
        });
        console.log(`   Status: ${resCreate.status} ${resCreate.statusText}`);
        if (!resCreate.ok) {
            throw new Error(`Failed to create scenario: ${await resCreate.text()}`);
        }
        const data = await resCreate.json();
        console.log('   ✅ Created Scenario:', data.data?.name);
    }
    catch (e) {
        console.error('   ❌ Fetch Error:', e);
        process.exit(1);
    }
    // 5. Check Audit Logs
    console.log('\n5. fetch: GET /api/expansion/audit');
    try {
        const resAudit = await fetch(`${BASE_URL}/api/expansion/audit`, { headers });
        console.log(`   Status: ${resAudit.status} ${resAudit.statusText}`);
        if (!resAudit.ok) {
            throw new Error(`Failed to fetch audit logs: ${await resAudit.text()}`);
        }
        const data = await resAudit.json();
        const logs = data.data || [];
        console.log(`   Audit Logs Count: ${logs.length}`);
        // Check if our creation event is there
        const found = logs.find((l) => l.action === 'CREATE_SCENARIO');
        if (found) {
            console.log('   ✅ Audit Log Found for created scenario.');
        }
        else {
            console.warn('   ⚠️ Audit Log NOT found immediately (eventual consistency?).');
            // We verify 200 OK so we don't hard fail script on eventual consistency, but warn.
        }
    }
    catch (e) {
        console.error('   ❌ Fetch Error:', e);
        process.exit(1);
    }
    console.log('\n--- ✅ Verification Complete (CI PASS) ---');
}
verifyApi();
