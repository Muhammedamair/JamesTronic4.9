
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

// Load .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('Missing env vars (loaded from .env.local)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const EMAIL = 'manager@jamestronic.test';
const PASS = 'TestPassword123!';

async function run() {
    // 1. Get a valid City ID
    const { data: cities, error: cityError } = await supabase
        .from('cities') // Assuming table is 'cities' or 'public.cities'
        .select('id')
        .limit(1);

    if (cityError || !cities || cities.length === 0) {
        console.error('Failed to find a city:', cityError);
        process.exit(1);
    }

    const cityId = cities[0].id;
    console.log('City ID:', cityId);

    // 2. Encrypt Password? No, verify_manual_logins used signInWithPassword, so user must exist in Auth with known password.
    // The seed_test_manager.sql uses crypt().
    // We can use Admin API to updateUserById to set password cleanly if needed, or just trust the seed.
    // Actually, strictly speaking verify_manual_logins works, so the user might already be there. 
    // Let's just update the city_id in app_metadata.

    // Find User
    const { data: { users }, error: userError } = await supabase.auth.admin.listUsers();
    const user = users.find(u => u.email === EMAIL);

    let userId = user?.id;

    if (!user) {
        console.log('Creating user...');
        const { data: newUser, error: createError } = await supabase.auth.admin.createUser({
            email: EMAIL,
            password: PASS,
            email_confirm: true,
            app_metadata: {
                app_role: 'manager',
                allowed_city_ids: [cityId],
                provider: 'email'
            },
            user_metadata: {
                role: 'manager',
                city_id: cityId
            }
        });
        if (createError) {
            console.error('Create failed:', createError);
            process.exit(1);
        }
        userId = newUser.user.id;
    } else {
        console.log('Updating user...', userId);
        const { error: updateError } = await supabase.auth.admin.updateUserById(userId!, {
            password: PASS, // Ensure password is set
            app_metadata: {
                app_role: 'manager',
                allowed_city_ids: [cityId],
                provider: 'email'
            },
            user_metadata: {
                role: 'manager',
                city_id: cityId
            }
        });
        if (updateError) {
            console.error('Update failed:', updateError);
            process.exit(1);
        }
    }

    // 3. Login to get Session (as the user, using Anon key client)
    // We need a separate client with ANON key for signInWithPassword
    const authClient = createClient(SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!);

    const { data: loginData, error: loginError } = await authClient.auth.signInWithPassword({
        email: EMAIL,
        password: PASS
    });

    if (loginError) {
        console.error('Login failed:', loginError);
        process.exit(1);
    }

    console.log('SESSION_JSON:', JSON.stringify(loginData.session));
}

run();
