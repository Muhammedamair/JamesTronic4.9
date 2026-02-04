
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabaseAdmin = createClient(supabaseUrl, serviceKey);

// Test Credentials (from TEST_ROLES_GUIDE.md)
const MANAGER_PHONE = '+919999999991';
const CUSTOMER_PHONE = '+919999999994';
const TEST_PASSWORD = 'TestPassword123!';

async function main() {
    console.log('🔒 Verifying Wave 3 Share Customer View Flow...');

    // 1. Setup: Get Manager (City A) - Login via password
    const { data: { session: managerSession }, error: loginError } = await supabaseAdmin.auth.signInWithPassword({
        phone: MANAGER_PHONE,
        password: TEST_PASSWORD
    });
    if (!managerSession) throw new Error(`Manager login failed: ${loginError?.message}`);

    const managerClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${managerSession.access_token}` } }
    });

    const cityId = managerSession.user.app_metadata?.city_id;

    // Get customer user by phone
    const custUser = await supabaseAdmin.auth.admin.listUsers();
    // We expect the user to exist now (seeded/fixed)
    let customer = custUser.data.users.find(u => u.phone === CUSTOMER_PHONE);

    if (!customer) {
        // Fallback just in case, but should not be needed if seed ran correctly
        // Try finding by normalized phone (strip +)
        customer = custUser.data.users.find(u => u.phone?.replace('+', '') === CUSTOMER_PHONE.replace('+', ''));
    }

    if (!customer) throw new Error(`No customer user found with phone ${CUSTOMER_PHONE}`);
    console.log(`Using Customer: ${customer.email || customer.phone} (${customer.id})`);

    // 2. Create Quote
    const { data: quoteRes, error: quoteErr } = await managerClient.rpc('create_pricing_quote', {
        p_city_id: cityId,
        p_service_code: 'TV_INSTALL_WALL_24_32',
        p_parts_cost: 0
    });
    if (quoteErr) throw new Error(`Create Quote Failed: ${quoteErr.message}`);
    const quoteId = quoteRes.quote_id;

    // 3. Manager Helper: Create Token via API equivalent (RPC directly for speed/robustness in script)
    // Use the phone as stored in the customer record for identity binding
    const customerPhoneE164 = customer.phone?.startsWith('+') ? customer.phone : `+${customer.phone}`;
    const { data: tokenRes, error: tokenErr } = await managerClient.rpc('create_quote_share_token', {
        p_quote_id: quoteId,
        p_ttl_minutes: 60,
        p_max_uses: 2,
        p_intended_phone_e164: customerPhoneE164
    });
    if (tokenErr) throw new Error(`Token Gen Failed: ${tokenErr.message}`);
    const TOKEN = tokenRes.token;
    console.log(`✅ Token Generated: ${TOKEN.substring(0, 6)}...`);

    // 4. Customer Login via password
    const { data: { session: custSession }, error: custLoginErr } = await supabaseAdmin.auth.signInWithPassword({
        phone: CUSTOMER_PHONE,
        password: TEST_PASSWORD
    });
    if (!custSession) throw new Error(`Customer login failed: ${custLoginErr?.message}`);

    const custClient = createClient(supabaseUrl, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, {
        global: { headers: { Authorization: `Bearer ${custSession.access_token}` } }
    });

    // 5. Customer Redeems (View)
    const { data: viewRes, error: viewErr } = await custClient.rpc('redeem_quote_share_token', { p_token: TOKEN });
    if (viewErr) throw new Error(`Redeem Failed: ${viewErr.message}`);
    console.log(`✅ Redeem Success. Quote: ${viewRes.quote.id}, Status: ${viewRes.quote.status}`);

    // 6. Customer Accepts
    // Assuming 'accept_pricing_quote' RPC access
    // Wait, does customer have permission to call 'accept_pricing_quote' directly? 
    // Let's check 'accept_pricing_quote' permissions. Usually customers can call it if they own the quote.
    // Redeem auto-claimed it, so they own it.
    const { error: acceptErr } = await custClient.rpc('accept_pricing_quote', {
        p_quote_id: quoteId,
        p_reason: 'Looks good via share link'
    });
    if (acceptErr) throw new Error(`Accept Failed: ${acceptErr.message}`);
    console.log(`✅ Quote Accepted`);

    // 7. Verify Status Update
    const { data: finalQuote } = await supabaseAdmin.from('pricing_quotes').select('status, customer_id').eq('id', quoteId).single();
    if (finalQuote?.status !== 'accepted') throw new Error('Quote status not accepted');
    if (finalQuote?.customer_id !== customer.id) throw new Error('Quote ownership mismatch');
    console.log(`✅ Verified Final State: Accepted by Customer`);

    console.log('✨ Customer View & Accept Flow Verified');
}

main().catch((e) => {
    console.error(e);
    process.exit(1);
});
