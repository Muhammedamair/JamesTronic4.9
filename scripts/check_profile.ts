
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const userId = '886f456a-ffe8-4111-91e3-8ead2b3c93e5';
    console.log('Checking profile for user ' + userId);

    const { data: profile, error } = await supabase
        .from('profiles')
        .select('*')
        .eq('user_id', userId)
        .single();

    if (error) {
        console.error('Error fetching profile:', error);
    } else {
        console.log('Profile found:', JSON.stringify(profile, null, 2));
    }
}

main();
