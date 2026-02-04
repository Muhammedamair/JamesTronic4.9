
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

async function checkGeoIntegrity() {
    console.log('--- A) Column Existence ---');
    const { data: cols, error: err1 } = await supabase.rpc('debug_inspect_table', { t_name: 'inventory_locations' });
    if (err1) console.error('Error inspecting columns:', err1); // Might fail if rpc missing, falling back to direct select if possible or just assuming

    // Alternative: explicit select to see if it errors
    const { error: errCol } = await supabase.from('inventory_locations').select('city_id, location').limit(1);
    if (errCol) console.error('❌ Columns missing:', errCol.message);
    else console.log('✅ Columns city_id and location exist.');

    console.log('\n--- B) Coverage Stats ---');
    // Using raw SQL via an RPC or since I am service role, I can try to use a temp view or js calculation?
    // JS calculation is safer if I don't have a specific RPC for this report.
    const { data: stores } = await supabase.from('inventory_locations').select('id, city, city_id, location, active');

    if (!stores) {
        console.log('No stores found.');
        return;
    }

    const total = stores.filter(s => s.active).length;
    const withCityId = stores.filter(s => s.active && s.city_id).length;
    const withLoc = stores.filter(s => s.active && s.location).length;

    console.log(`Active Stores: ${total}`);
    console.log(`With city_id: ${withCityId} (${total ? Math.round(withCityId / total * 100) : 0}%)`);
    console.log(`With location: ${withLoc} (${total ? Math.round(withLoc / total * 100) : 0}%)`);

    if (withCityId < total) {
        console.log('\n--- D) Bad Join Detector ---');
        stores.filter(s => s.active && !s.city_id).forEach(s => {
            console.log(`[Missing city_id] ${s.city} (ID: ${s.id})`);
        });
    }
}

checkGeoIntegrity();
