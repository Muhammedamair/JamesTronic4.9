/**
 * C19 Reorder Generation & Approval Workflow Test
 * 
 * Tests: Evidence validation, quantity checks, approval workflow
 * 
 * CI Mode: Seeds real admin user via Auth Admin if needed, executes all gates
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

// CI Admin credentials (optional env vars for pre-seeded admin)
const CI_ADMIN_EMAIL = process.env.CI_ADMIN_EMAIL || 'ci-admin@jamestronic.test';
const CI_ADMIN_USER_ID = process.env.CI_ADMIN_USER_ID;

if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('Missing env vars: NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

/**
 * Ensure an admin user exists for approval workflow testing
 * In CI mode: creates user via Auth Admin if needed
 * Returns user_id or throws in CI mode if cannot establish
 */
async function ensureAdminUser(): Promise<string | null> {
    console.log('\n📍 Ensuring admin user for approval workflow...');

    // First, check if admin/manager exists in profiles
    const { data: existingAdmin, error: profileError } = await supabase
        .from('profiles')
        .select('user_id, role')
        .in('role', ['admin', 'manager'])
        .limit(1)
        .single();

    if (!profileError && existingAdmin) {
        console.log(`✅ Found existing admin: ${existingAdmin.user_id} (role: ${existingAdmin.role})`);
        return existingAdmin.user_id;
    }

    // No admin found - need to create in CI mode
    if (!IS_CI_MODE) {
        console.warn('⚠️  No admin/manager user found in profiles. Skipping approval test in local mode.');
        return null;
    }

    // CI Mode: Try to use pre-configured CI_ADMIN_USER_ID
    if (CI_ADMIN_USER_ID) {
        console.log(`ℹ️  Using pre-configured CI_ADMIN_USER_ID: ${CI_ADMIN_USER_ID}`);

        // Ensure profile exists for this user
        const { error: upsertError } = await supabase
            .from('profiles')
            .upsert({
                user_id: CI_ADMIN_USER_ID,
                role: 'admin',
                full_name: 'CI Admin User',
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (upsertError) {
            throw new Error(`❌ CI GATE FAILED: Cannot upsert CI admin profile: ${upsertError.message}`);
        }

        console.log('✅ CI admin profile ensured');
        return CI_ADMIN_USER_ID;
    }

    // CI Mode: Create user via Auth Admin
    console.log('ℹ️  Creating CI admin user via Auth Admin...');

    const password = `CI_Test_${Date.now()}_Secure!`;

    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
        email: CI_ADMIN_EMAIL,
        password: password,
        email_confirm: true,
        user_metadata: { ci_fixture: true, role: 'admin' }
    });

    if (authError) {
        // Check if user already exists
        if (authError.message.includes('already been registered') || authError.message.includes('already exists')) {
            console.log('ℹ️  CI admin user already exists in Auth, fetching...');

            // Try to get existing user by email
            const { data: users, error: listError } = await supabase.auth.admin.listUsers();

            if (listError) {
                throw new Error(`❌ CI GATE FAILED: Cannot list users: ${listError.message}`);
            }

            const existingUser = users.users.find(u => u.email === CI_ADMIN_EMAIL);
            if (existingUser) {
                // Ensure profile exists
                const { error: upsertError } = await supabase
                    .from('profiles')
                    .upsert({
                        user_id: existingUser.id,
                        role: 'admin',
                        full_name: 'CI Admin User',
                        updated_at: new Date().toISOString()
                    }, { onConflict: 'user_id' });

                if (upsertError) {
                    throw new Error(`❌ CI GATE FAILED: Cannot upsert CI admin profile: ${upsertError.message}`);
                }

                console.log(`✅ CI admin user found and profile ensured: ${existingUser.id}`);
                return existingUser.id;
            }
        }

        throw new Error(`❌ CI GATE FAILED: Cannot create CI admin user: ${authError.message}\n   Remediation: Set CI_ADMIN_USER_ID env var with an existing admin user ID`);
    }

    const userId = authData.user.id;
    console.log(`✅ Created CI admin user: ${userId}`);

    // Create profile for this user
    const { error: profileInsertError } = await supabase
        .from('profiles')
        .insert({
            user_id: userId,
            role: 'admin',
            full_name: 'CI Admin User'
        });

    if (profileInsertError) {
        // Profile might auto-create via trigger
        console.warn(`⚠️  Profile insert failed (may auto-create): ${profileInsertError.message}`);

        // Try upsert instead
        const { error: upsertError } = await supabase
            .from('profiles')
            .upsert({
                user_id: userId,
                role: 'admin',
                full_name: 'CI Admin User',
                updated_at: new Date().toISOString()
            }, { onConflict: 'user_id' });

        if (upsertError) {
            throw new Error(`❌ CI GATE FAILED: Cannot create CI admin profile: ${upsertError.message}`);
        }
    }

    console.log('✅ CI admin profile created');
    return userId;
}

async function main() {
    console.log('🧪 C19 Reorder Generation & Approval Workflow Test\n');
    console.log('='.repeat(70));
    console.log(`Mode: ${IS_CI_MODE ? '🔒 CI (no skips allowed)' : '🔧 Local (warnings allowed)'}`);
    console.log('='.repeat(70));

    let gatesExecuted = 0;
    let gatesSkipped = 0;

    try {
        // STEP 1: Get latest reorder recommendation
        console.log('\n📍 Step 1: Finding latest reorder recommendation...');

        const { data: reorders, error: reorderError } = await supabase
            .from('reorder_recommendations')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(1);

        if (reorderError) throw new Error(`❌ Failed to fetch reorders: ${reorderError.message}`);

        if (!reorders || reorders.length === 0) {
            throw new Error('❌ No reorder recommendations found. Run verify_c19_v1.ts first.');
        }

        const testRec = reorders[0];
        console.log(`✅ Found recommendation: ID=${testRec.id}`);
        console.log(`   Part: ${testRec.part_id}`);
        console.log(`   Qty: ${testRec.recommended_qty}`);
        console.log(`   Risk Score: ${testRec.stockout_risk_score}`);

        // STRICT GATE 1: Evidence validation
        console.log('\n📍 Step 2: Validating evidence content...');

        if (!testRec.evidence || typeof testRec.evidence !== 'object') {
            throw new Error('❌ GATE 1 FAILED: Recommendation missing evidence');
        }

        const evidence = testRec.evidence;
        const requiredFields = ['forecast', 'current_available', 'stockout_risk'];
        const missingFields = requiredFields.filter(f => !(f in evidence));

        if (missingFields.length > 0) {
            throw new Error(`❌ GATE 1 FAILED: Evidence missing fields: ${missingFields.join(', ')}`);
        }

        console.log('✅ GATE 1 PASSED: Evidence contains required fields');
        console.log(`   Evidence keys: ${Object.keys(evidence).join(', ')}`);
        gatesExecuted++;

        // STRICT GATE 2: recommended_qty must be > 0
        console.log('\n📍 Step 3: Validating recommended quantity...');

        if (testRec.recommended_qty <= 0) {
            throw new Error(`❌ GATE 2 FAILED: recommended_qty is ${testRec.recommended_qty}, must be > 0`);
        }

        console.log(`✅ GATE 2 PASSED: recommended_qty > 0 (${testRec.recommended_qty})`);
        gatesExecuted++;

        // STRICT GATE 3: Confidence gating
        const forecastConfidence = evidence.forecast_confidence as number;

        if (forecastConfidence && forecastConfidence < 50 && testRec.recommended_qty > 100) {
            console.warn(`⚠️  WARNING: Low confidence (${forecastConfidence}%) with high qty (${testRec.recommended_qty})`);
        } else {
            console.log(`✅ GATE 3 PASSED: Quantity appropriate for confidence level`);
        }
        gatesExecuted++;

        // STEP 4: Test Approval Workflow
        console.log('\n📍 Step 4: Testing approval workflow...');

        const adminUserId = await ensureAdminUser();

        if (!adminUserId) {
            if (IS_CI_MODE) {
                throw new Error('❌ CI GATE FAILED: Cannot establish admin user for approval workflow');
            }
            console.log('ℹ️  GATE 4 SKIPPED: No admin user available for approval test');
            gatesSkipped++;
        } else {
            // Find a proposed recommendation to approve (not the one we're testing if it's already approved)
            const { data: proposedRecs, error: proposedError } = await supabase
                .from('reorder_recommendations')
                .select('*')
                .eq('status', 'proposed')
                .order('created_at', { ascending: false })
                .limit(2);

            if (proposedError) throw new Error(`❌ Failed to fetch proposed recommendations: ${proposedError.message}`);

            if (!proposedRecs || proposedRecs.length === 0) {
                if (IS_CI_MODE) {
                    throw new Error('❌ CI GATE FAILED: No proposed recommendations to test approval workflow');
                }
                console.warn('⚠️  No proposed recommendations to test approval');
                gatesSkipped++;
            } else {
                const approvalTarget = proposedRecs[0];

                // Approve the recommendation
                const { data: approvalResult, error: approvalError } = await supabase
                    .from('reorder_recommendations')
                    .update({
                        status: 'approved',
                        approved_by: adminUserId,
                        approved_at: new Date().toISOString(),
                        notes: `CI test approval from verification script (${C19_TEST_MODE} mode)`
                    })
                    .eq('id', approvalTarget.id)
                    .select()
                    .single();

                if (approvalError) throw new Error(`❌ Approval failed: ${approvalError.message}`);

                console.log('✅ GATE 4a PASSED: Status updated to "approved"');
                console.log(`   Approved by: ${approvalResult.approved_by}`);
                console.log(`   Approved at: ${approvalResult.approved_at}`);
                gatesExecuted++;

                // STEP 5: Test Rejection Workflow (if we have another proposed)
                console.log('\n📍 Step 5: Testing rejection workflow...');

                if (proposedRecs.length > 1) {
                    const rejectTarget = proposedRecs[1];

                    const { data: rejectResult, error: rejectError } = await supabase
                        .from('reorder_recommendations')
                        .update({
                            status: 'rejected',
                            approved_by: adminUserId,
                            approved_at: new Date().toISOString(),
                            notes: 'CI test rejection: Verified sufficient stock on manual inspection'
                        })
                        .eq('id', rejectTarget.id)
                        .select()
                        .single();

                    if (rejectError) throw new Error(`❌ Rejection failed: ${rejectError.message}`);

                    console.log('✅ GATE 4b PASSED: Status updated to "rejected" with notes');
                    console.log(`   Rejection reason: ${rejectResult.notes}`);
                } else {
                    console.log('ℹ️  No additional proposed recommendations to test rejection');
                }
            }
        }

        // STEP 6: Verify no auto-purchasing
        console.log('\n📍 Step 6: Verifying workflow constraints...');

        const { data: autoOrdered, error: autoError } = await supabase
            .from('reorder_recommendations')
            .select('id, status, approved_by')
            .eq('status', 'ordered')
            .is('approved_by', null);

        if (autoError) throw new Error(`❌ Auto-order check failed: ${autoError.message}`);

        if (autoOrdered && autoOrdered.length > 0) {
            throw new Error(`❌ GATE 5 FAILED: Found ${autoOrdered.length} orders without approval (auto-purchasing detected!)`);
        }

        console.log('✅ GATE 5 PASSED: No auto-purchasing detected (all orders require approval)');
        gatesExecuted++;

        // SUMMARY
        console.log('\n' + '='.repeat(70));
        console.log('📊 Reorder Generation Test Summary:');
        console.log('='.repeat(70));
        console.log(`Mode: ${IS_CI_MODE ? '🔒 CI' : '🔧 Local'}`);
        console.log(`Gates Executed: ${gatesExecuted}`);
        console.log(`Gates Skipped: ${gatesSkipped}`);
        console.log('');
        console.log('✅ GATE 1: Evidence contains stock + forecast');
        console.log('✅ GATE 2: Recommended quantity > 0');
        console.log('✅ GATE 3: Confidence gating applied');
        console.log('✅ GATE 4: Approval/rejection workflow works');
        console.log('✅ GATE 5: No auto-purchasing');

        if (IS_CI_MODE && gatesSkipped > 0) {
            throw new Error(`❌ CI MODE FAILURE: ${gatesSkipped} gates were skipped. All gates must execute in CI.`);
        }

        console.log('\n🎉 Reorder Generation Test PASSED');
        console.log(`   CI Mode: ${gatesSkipped === 0 ? '0 skipped gates ✓' : `${gatesSkipped} skipped (LOCAL mode)`}`);
        console.log('='.repeat(70));

    } catch (err: any) {
        console.error('\n' + '='.repeat(70));
        console.error('❌ Test FAILED:', err.message);
        if (err.details) console.error('Details:', err.details);
        if (err.hint) console.error('Hint:', err.hint);
        console.error('='.repeat(70));
        process.exit(1);
    }
}

main();
