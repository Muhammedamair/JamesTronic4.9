
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function debug() {
    const { data, error } = await supabase.rpc('debug_auth');
    console.log('Results:', JSON.stringify(data, null, 2));
    if (error) console.error('Error:', error);
}

debug();
