import { createClient } from '@supabase/supabase-js';
import path from 'path';
import dotenv from 'dotenv';

// Load .env.local
dotenv.config({ path: path.resolve(__dirname, '../.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('Missing env vars (NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY)');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const TEST_PASSWORD = 'TestPassword123!';
const CITY_A_ID = '11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa'; // From tests

const USERS = [
    {
        email: 'admin@jamestronic.test',
        phone: '+919999999990',
        role: 'admin',
        label: 'Admin / Founder'
    },
    {
        email: 'manager@jamestronic.test',
        phone: '+919999999991',
        role: 'manager',
        label: 'Manager (City A)',
        metadata: { city_id: CITY_A_ID }
    },
    {
        email: 'technician@jamestronic.test',
        phone: '+919999999992',
        role: 'technician',
        label: 'Technician'
    },
    {
        email: 'transporter@jamestronic.test',
        phone: '+919999999993',
        role: 'transporter',
        label: 'Transporter'
    },
    {
        email: 'customer@jamestronic.test',
        phone: '+919999999994',
        role: 'customer',
        label: 'Customer'
    }
];

async function seedUsers() {
    console.log('Seeding Manual Test Users...');
    console.log(`Default Password: ${TEST_PASSWORD}`);

    for (const u of USERS) {
        // 1. Check exist by email
        const { data: list } = await supabase.auth.admin.listUsers();
        let user = list.users.find(x => x.email === u.email);

        const app_metadata = {
            role: u.role, // Standard Supabase role
            app_role: u.role, // App specific role
            ...u.metadata
        };

        const user_metadata = {
            role: u.role, // For frontend useSupabase hook
            full_name: u.label
        };

        if (user) {
            console.log(`Updating ${u.label} (${u.email})...`);
            await supabase.auth.admin.updateUserById(user.id, {
                password: TEST_PASSWORD,
                phone: u.phone,
                phone_confirm: true,
                app_metadata,
                user_metadata
            });
        } else {
            console.log(`Creating ${u.label} (${u.email})...`);
            const { data: created, error } = await supabase.auth.admin.createUser({
                email: u.email,
                password: TEST_PASSWORD,
                email_confirm: true,
                phone: u.phone,
                phone_confirm: true,
                app_metadata,
                user_metadata
            });
            if (error) console.error(`  Error creating ${u.email}:`, error.message);
        }
    }
    console.log('Done.');
}

seedUsers();
