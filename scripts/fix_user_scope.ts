
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function main() {
    const userId = '886f456a-ffe8-4111-91e3-8ead2b3c93e5';
    const cityId = '22222222-bbbb-4bbb-bbbb-bbbbbbbbbbbb';
    const email = 'manager@jamestronic.test';

    console.log(`Updating user ${email} (${userId})...`);
    console.log(`Setting city_id to ${cityId} and app_role to manager...`);

    const { data, error } = await supabase.auth.admin.updateUserById(
        userId,
        {
            app_metadata: {
                city_id: cityId,
                app_role: 'manager'
            }
        }
    );

    if (error) {
        console.error('Error updating user:', error);
        process.exit(1);
    }

    console.log('Success! Updated user metadata:');
    console.log(JSON.stringify(data.user.app_metadata, null, 2));
}

main();
