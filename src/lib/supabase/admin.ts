import { createClient } from '@supabase/supabase-js';

let _admin: ReturnType<typeof createClient> | null = null;

/**
 * Returns a singleton instance of the Supabase Admin client.
 * Refactored to lazy initialization to prevent build-time crashes when secrets are missing.
 */
export const getAdminClient = () => {
    if (_admin) return _admin;

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey) {
        // Log warning but return null/any to allow build logic to proceed if called during build (though it shouldn't be)
        console.warn('Supabase Admin Client skipped: missing environment variables.');
        return null as any;
    }

    _admin = createClient(supabaseUrl, supabaseServiceRoleKey, {
        auth: {
            autoRefreshToken: false,
            persistSession: false,
        },
    });
    return _admin;
};

// Deprecated: For backward compatibility with existing calls. 
// Note: If called at top level during build, it will no longer throw but might return null.
export const createAdminClient = getAdminClient;
