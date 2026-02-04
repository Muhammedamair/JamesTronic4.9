
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

const MANAGER_EMAIL = 'manager@jamestronic.test';
const MANAGER_PASS = 'TestPassword123!';

async function main() {
    console.log('🔒 Verifying Create Quote Scope Refusal...');

    // 1. Get Manager Session & Details
    const { data: { session: managerSession }, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
        email: MANAGER_EMAIL,
        password: MANAGER_PASS
    });
    if (loginError) {
        console.error('Failed login manager:', loginError);
        process.exit(1);
    }

    const managerClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${managerSession?.access_token}` } }
    });

    // Get Manager's City ID from profile/metadata
    // We can trust the JWT for the test if it's there, or query profiles
    if (!managerSession) {
        console.error('No manager session created');
        process.exit(1);
    }
    const managerId = managerSession.user.id;
    const appMetadata = managerSession.user.app_metadata || {};
    const cityId = appMetadata.city_id;

    if (!cityId) {
        console.error('Manager has no city_id in app_metadata');
        process.exit(1);
    }

    const CITY_A = cityId;
    console.log(`Manager is bound to City A (from metadata): ${CITY_A}`);

    // Find a City B (Different from A)
    const { data: otherCities } = await supabaseAdmin
        .from('cities')
        .select('id')
        .neq('id', CITY_A)
        .limit(1);

    let CITY_B: string;
    if (!otherCities || otherCities.length === 0) {
        console.log('⚠️ No real City B found. Using synthetic UUID to test scope check execution.');
        CITY_B = '00000000-0000-0000-0000-000000000000';
    } else {
        CITY_B = otherCities[0].id;
    }
    console.log(`Targeting Foreign City B: ${CITY_B}`);

    // 3. Test: Manager A tries to create quote for City B (Should Fail)
    console.log('Testing Manager A -> City B (Unauthorized)...');
    const { data: badQuote, error: badError } = await managerClient.rpc('create_pricing_quote', {
        p_city_id: CITY_B,
        p_service_code: 'TV_INSTALL_WALL_24_32',
        p_parts_cost: 0
    });

    if (badError && badError.message.includes('out_of_scope_city')) {
        console.log('✅ Approved: Manager A blocked from creating quote for City B.');
    } else {
        console.error('❌ FAILED: Manager A should have been blocked!', badQuote, badError);
        process.exit(1);
    }

    // 2. Test: Manager A tries to create quote for City A (Should Pass)
    console.log('Testing Manager A -> City A (Authorized)...');
    // Ensure base rate exists for City A
    const { data: baseRate } = await supabaseAdmin.from('pricing_base_rates').select('id').eq('city_id', CITY_A).eq('service_code', 'TV_INSTALL_WALL_24_32').single();
    if (!baseRate) {
        // Seed it
        await supabaseAdmin.from('pricing_base_rates').insert({
            city_id: CITY_A, service_code: 'TV_INSTALL_WALL_24_32', labor_base: 500, transport_base: 100, effective_from: new Date().toISOString()
        });
    }

    const { data: okQuote, error: okError } = await managerClient.rpc('create_pricing_quote', {
        p_city_id: CITY_A, // Valid City
        p_service_code: 'TV_INSTALL_WALL_24_32',
        p_parts_cost: 0
    });

    if (okError) {
        console.error('❌ Failed valid creation:', okError);
        process.exit(1);
    } else {
        console.log('✅ Approved: Manager A created quote for City A.');
        // Cleanup if needed? No, transactional test environment.
    }

    // 4. Test: Customer (Should Fail)
    // Need a customer user. If not exists, skip.
    const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
    const customerUser = users.find(u => u.user_metadata?.app_role === 'customer' || u.email?.includes('customer'));

    if (customerUser && customerUser.email) {
        // Need password. Assuming same test pass or skipping if unknown.
        // Trying login...
        const { data: { session: custSession }, error: custLoginError } = await supabaseAdmin.auth.signInWithPassword({
            email: customerUser.email,
            password: 'TestPassword123!' // Assumption
        });

        if (!custLoginError && custSession) {
            const custClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
                global: { headers: { Authorization: `Bearer ${custSession.access_token}` } }
            });

            console.log(`Testing Customer (${customerUser.email}) -> City A (Unauthorized Role)...`);
            const { data: custQuote, error: custError } = await custClient.rpc('create_pricing_quote', {
                p_city_id: CITY_A,
                p_service_code: 'TV_INSTALL_WALL_24_32',
                p_parts_cost: 0
            });

            if (custError && custError.message.includes('role_cannot_create_quote')) {
                console.log('✅ Approved: Customer blocked from creating quote.');
            } else {
                console.error('❌ FAILED: Customer should be blocked!', custQuote, custError);
                process.exit(1);
            }
        } else {
            console.warn('⚠️ Skipping Customer test (login failed).');
        }
    } else {
        console.warn('⚠️ Skipping Customer test (no customer user found).');
    }

    console.log('✨ Create Scope Verification Complete');
}

main().catch(console.error);
