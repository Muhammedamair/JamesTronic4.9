
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const CITY_A_ID = '11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa'; // Test City A
const CITY_B_ID = '22222222-bbbb-4bbb-bbbb-bbbbbbbbbbbb'; // Test City B (if exists)

async function manualBackfill() {
    console.log('--- Manual Backfill ---');

    // 1. Map "Mumbai" -> City A
    const { error: e1 } = await supabase
        .from('inventory_locations')
        .update({ city_id: CITY_A_ID, location: 'SRID=4326;POINT(72.87 19.07)' }) // Mumbai coords
        .eq('city', 'Mumbai');

    if (e1) console.error('Error updating Mumbai:', e1);
    else console.log('✅ Updated Mumbai stores to City A');

    // 2. Map "Delhi" -> City B (or A if B doesn't exist, but test suite creates B)
    const { error: e2 } = await supabase
        .from('inventory_locations')
        .update({ city_id: CITY_B_ID, location: 'SRID=4326;POINT(77.10 28.70)' }) // Delhi coords
        .eq('city', 'Delhi');

    if (e2) console.error('Error updating Delhi:', e2);
    else console.log('✅ Updated Delhi stores to City B');
}

manualBackfill();
