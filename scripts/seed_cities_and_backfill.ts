
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;
const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

const CITY_A_ID = '11111111-aaaa-4aaa-aaaa-aaaaaaaaaaaa';
const CITY_B_ID = '22222222-bbbb-4bbb-bbbb-bbbbbbbbbbbb';

async function seedCitiesAndBackfill() {
    // 0. Force schema reload to ensure 'polygon' column is seen
    await supabase.rpc('_c20_reload_pgrst_schema');
    await new Promise(r => setTimeout(r, 2000));

    console.log('--- Ensuring Cities Exist ---');

    // Ensure City A (Mumbai)
    await supabase.from('cities').upsert({
        id: CITY_A_ID,
        name: 'Mumbai',
        active: true,
        // Mock polygon (tiny box)
        polygon: 'SRID=4326;POLYGON((72.8 19.0, 72.9 19.0, 72.9 19.1, 72.8 19.1, 72.8 19.0))',
        centroid: 'SRID=4326;POINT(72.85 19.05)'
    });

    // Ensure City B (Delhi)
    const { error: eB } = await supabase.from('cities').upsert({
        id: CITY_B_ID,
        name: 'Delhi',
        active: true,
        polygon: 'SRID=4326;POLYGON((77.0 28.6, 77.2 28.6, 77.2 28.8, 77.0 28.8, 77.0 28.6))',
        centroid: 'SRID=4326;POINT(77.1 28.7)'
    });
    if (eB) console.error('Error seeding City B:', eB);

    console.log('✅ Cities seeded.');

    console.log('--- Retrying Backfill ---');

    // 2. Map "Delhi" -> City B
    const { error: e2 } = await supabase
        .from('inventory_locations')
        .update({ city_id: CITY_B_ID, location: 'SRID=4326;POINT(77.10 28.70)' })
        .eq('city', 'Delhi');

    if (e2) console.error('Error updating Delhi:', e2);
    else console.log('✅ Updated Delhi stores to City B');
}

seedCitiesAndBackfill();
