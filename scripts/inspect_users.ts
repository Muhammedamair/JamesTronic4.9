
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    console.log('Inspecting auth.users...');
    const { data: users, error } = await supabase.auth.admin.listUsers();

    if (error) {
        console.error('Error fetching users:', error);
        return;
    }

    console.log(`Found ${users.users.length} users.`);
    users.users.forEach(u => {
        console.log('------------------------------------------------');
        console.log(`ID: ${u.id}`);
        console.log(`Email: ${u.email}`);
        console.log(`Role: ${u.app_metadata.app_role || 'null'}`);
        console.log(`City ID: ${u.app_metadata.city_id || 'null'}`);
        console.log(`Raw Meta:`, JSON.stringify(u.app_metadata, null, 2));
    });

    // Also verify cities exist
    const { data: cities } = await supabase.from('cities').select('id, name').limit(5);
    console.log('\nAvailable Cities (Top 5):');
    cities?.forEach(c => console.log(`${c.name}: ${c.id}`));
}

main();
