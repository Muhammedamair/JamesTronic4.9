
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import path from 'path';

// Load environment variables from .env.local
dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_ROLE_KEY) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
    auth: {
        autoRefreshToken: false,
        persistSession: false,
    },
});

const TEST_ACCOUNTS = [
    { role: 'admin', phone: '+919999999990', name: 'James Admin' },
    { role: 'staff', phone: '+919999999991', name: 'Mike Manager' }, // Manager = Staff
    { role: 'technician', phone: '+919999999992', name: 'Tom Tech' },
    { role: 'transporter', phone: '+919999999993', name: 'Tony Transport' },
    { role: 'customer', phone: '+919999999994', name: 'Charlie Customer' },
];

async function main() {
    console.log('🚀 Starting Fresh Start Protocol (Seed Roles v6)...');

    // 1. Map Existing Users
    console.log('🔍 Scanning existing users...');
    const { data: { users }, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 });

    if (listError) {
        console.error('Error listing users:', listError);
        return;
    }

    const phoneMap = new Map<string, string>(); // phone -> id  
    const emailMap = new Map<string, string>(); // email -> id

    if (users) {
        users.forEach(u => {
            // Normalize phone for map if needed, but usually exact match is best
            if (u.phone) phoneMap.set(u.phone, u.id);
            if (u.email) emailMap.set(u.email.toLowerCase(), u.id);
        });
    }
    console.log(`   Found ${users?.length || 0} total users in Auth.`);

    console.log('------------------------------------------------');

    // 2. CREATE or UPDATE TEST ACCOUNTS
    console.log('🌱 Seeding Test Accounts...');

    for (const acc of TEST_ACCOUNTS) {
        const email = `${acc.role}@jamestronic.test`.toLowerCase();

        // Check if user exists by Phone OR Email
        let userId = phoneMap.get(acc.phone) || emailMap.get(email);
        let action = '';

        if (!userId) {
            // Create new
            const { data: user, error: createError } = await supabase.auth.admin.createUser({
                phone: acc.phone,
                email: email,
                email_confirm: true,
                phone_confirm: true,
                user_metadata: {
                    role: acc.role,
                    full_name: acc.name
                }
            });

            if (createError) {
                if (createError.message.includes('registered')) {
                    // Fallback: If map missed it but DB says it exists, try to find it in the list manually by partial match?
                    // or just by phone (maybe map key issue).
                    console.log(`   ⚠️ Conflict for ${acc.phone}. Attempting manual resolution...`);
                    const found = users?.find(u => u.phone === acc.phone || u.email === email);
                    if (found) {
                        userId = found.id;
                        action = 'Resolved';
                    } else {
                        console.error(`❌ Impossible State: DB says registered, but listUsers didn't return it. Metadata:`, createError.message);
                        continue;
                    }
                } else {
                    console.error(`❌ Failed to create ${acc.role}:`, createError.message);
                    continue;
                }
            } else {
                userId = user.user?.id;
                action = 'Created';
            }
        } else {
            action = 'Matched';
        }

        if (userId) {
            console.log(`✅ ${action} ${acc.role.toUpperCase()}: \t${acc.phone} \t(ID: ${userId.slice(0, 8)}...)`);

            // Upsert profile
            const { error: profileError } = await supabase
                .from('profiles')
                .upsert({
                    user_id: userId,
                    role: acc.role,
                    full_name: acc.name,
                    updated_at: new Date().toISOString()
                }, { onConflict: 'user_id' });

            if (profileError) {
                console.error(`   ❌ Profile Sync Failed for ${acc.role}:`, profileError.message);
            } else {
                console.log(`      ↳ Profile synced (Role: ${acc.role}).`);
            }
        }
    }

    console.log('------------------------------------------------');
    console.log('🎉 Seed Complete!');
    console.log('⚠️  ACTION REQUIRED: Go to Supabase Dashboard > Auth > Providers > Phone > "Phone numbers for testing"');
    console.log('   Add these numbers with a fixed code (e.g., 123456) to login.');
}

main().catch(console.error);
