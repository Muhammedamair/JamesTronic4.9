
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    console.log('Seeding Rulesets...');

    // 1. Create Active V1
    const { data: v1, error: e1 } = await supabase
        .from('pricing_rulesets')
        .insert({
            version: 'v1.0.0-INIT',
            rules: { base_rate_model: 'standard', created_by: 'seed' },
            is_active: true,
            activated_at: new Date().toISOString()
        })
        .select()
        .single();

    if (e1 && e1.code !== '23505') console.error('V1 Error:', e1);
    else console.log('V1 (Active) ensured.');

    // 2. Create Inactive V2 (Draft)
    const { data: v2, error: e2 } = await supabase
        .from('pricing_rulesets')
        .insert({
            version: 'v2.0.0-DRAFT',
            rules: { base_rate_model: 'dynamic_v2', complexity_multiplier: 1.5 },
            is_active: false
        })
        .select()
        .single();

    if (e2 && e2.code !== '23505') console.error('V2 Error:', e2);
    else console.log('V2 (Inactive) ensured.');

    console.log('Seed Complete');
}

main();
