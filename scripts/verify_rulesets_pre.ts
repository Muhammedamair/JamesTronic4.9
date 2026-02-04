
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    console.log('--- Rulesets Pre-Flight Check ---');

    // 1. Check Active Count
    const { count, error: countError } = await supabase
        .from('pricing_rulesets')
        .select('*', { count: 'exact', head: true })
        .eq('is_active', true);

    if (countError) console.error('Count Error:', countError);
    else console.log(`Active Rulesets Count: ${count} (Expected: 1)`);

    // 2. Check Latest Audit Log
    const { data: audit, error: auditError } = await supabase
        .from('pricing_audit_log')
        .select('created_at, event_type, city_id, payload')
        .eq('event_type', 'RULESET_ACTIVATED')
        .order('created_at', { ascending: false })
        .limit(1);

    if (auditError) console.error('Audit Error:', auditError);
    else {
        if (audit && audit.length > 0) {
            console.log('Latest Audit Entry:', JSON.stringify(audit[0], null, 2));
            console.log('Audit City ID:', audit[0].city_id); // Check if this is the "fake" one
        } else {
            console.log('No RULESET_ACTIVATED audit events found.');
        }
    }

    // 3. Check Schema columns for pricing_audit_log to see if we already have scope (unlikely)
    // We can't easily check schema via JS client without inspection, but we'll assume user is right.
}

main();
