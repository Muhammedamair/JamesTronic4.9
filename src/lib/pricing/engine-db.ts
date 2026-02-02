import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY!; // Must use service role for transaction isolation if RLS prevents update of other's rows (though here we need it for rigorous timestamps)

// Use a segregated client for pricing engine operations to ensure consistent timeouts/config
export const pricingEngineDb = createClient(supabaseUrl, supabaseKey, {
    auth: {
        persistSession: false,
        autoRefreshToken: false,
    },
});
