import { createClient } from '@supabase/supabase-js';

let _pricingDb: ReturnType<typeof createClient> | null = null;

export const getPricingEngineDb = () => {
    if (_pricingDb) return _pricingDb;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseKey) {
        // We log instead of throwing at module level to allow build to proceed if this is imported but not called
        console.warn('Supabase env vars missing for Pricing Engine DB. If this is a build step, it is expected.');
        return null as any;
    }

    _pricingDb = createClient(supabaseUrl, supabaseKey, {
        auth: {
            persistSession: false,
            autoRefreshToken: false,
        },
    });
    return _pricingDb;
};
