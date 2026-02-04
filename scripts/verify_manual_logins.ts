
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

if (!SUPABASE_URL || !ANON_KEY) {
    console.error('Missing env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const PASS = 'TestPassword123!';
const USERS = [
    { email: 'admin@jamestronic.test', role: 'admin' },
    { email: 'manager@jamestronic.test', role: 'manager', checkCity: true },
    { email: 'technician@jamestronic.test', role: 'technician' },
    { email: 'transporter@jamestronic.test', role: 'transporter' },
    { email: 'customer@jamestronic.test', role: 'customer' }
];

async function verify() {
    console.log('Verifying Logins...');
    let allPass = true;

    for (const u of USERS) {
        process.stdout.write(`Testing ${u.email}... `);

        // Sign in
        const { data, error } = await supabase.auth.signInWithPassword({
            email: u.email,
            password: PASS
        });

        if (error || !data.session) {
            console.log('❌ FAILED');
            console.error('  Error:', error?.message);
            allPass = false;
            continue;
        }

        // Check Role
        const role = data.user.app_metadata.app_role || data.user.app_metadata.role; // Legacy fallback
        if (role !== u.role) {
            console.log('❌ WRONG ROLE');
            console.error(`  Expected ${u.role}, got ${role}`);
            allPass = false;
            continue;
        }

        // Check City (Manager specific)
        if (u.checkCity) {
            const cityId = data.user.app_metadata.city_id;
            if (!cityId) {
                console.log('❌ MISSING CITY_ID');
                allPass = false;
                continue;
            }
        }

        console.log('✅ PASS');

        // Logout to be clean
        await supabase.auth.signOut();
    }

    if (allPass) {
        console.log('\n✨ All manual roles verified successfully.');
    } else {
        console.log('\n⚠️ Some logins failed.');
        process.exit(1);
    }
}

verify();
