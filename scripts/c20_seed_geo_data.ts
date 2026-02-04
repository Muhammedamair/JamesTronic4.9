/**
 * C20: Admin Seed Import for Cities + Pincodes
 * 
 * Admin-only import path for seeding geographic data.
 * Reads from CSV/JSON files and upserts to cities and geo_pincodes tables.
 * 
 * Usage:
 *   npx tsx scripts/c20_seed_geo_data.ts --cities data/cities.json
 *   npx tsx scripts/c20_seed_geo_data.ts --pincodes data/pincodes.json --city-id <uuid>
 */

import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'fs';

// Environment
const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

if (!SUPABASE_URL || !SERVICE_KEY) {
    console.error('❌ Missing SUPABASE env vars');
    process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

interface CityInput {
    name: string;
    state?: string;
    country?: string;
    timezone?: string;
    boundary_wkt?: string; // WKT format for MultiPolygon
    centroid_lat?: number;
    centroid_lng?: number;
}

interface PincodeInput {
    code: string;
    name?: string;
    boundary_wkt?: string;
    centroid_lat?: number;
    centroid_lng?: number;
    population_estimate?: number;
}

async function seedCities(filePath: string): Promise<void> {
    console.log(`\n📍 Importing cities from ${filePath}...`);

    if (!existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
    }

    const data: CityInput[] = JSON.parse(readFileSync(filePath, 'utf-8'));
    console.log(`  Found ${data.length} cities to import`);

    let success = 0;
    let failed = 0;

    for (const city of data) {
        const payload: Record<string, any> = {
            name: city.name,
            state: city.state,
            country: city.country || 'India',
            timezone: city.timezone || 'Asia/Kolkata',
            active: true
        };

        // Add boundary if provided (WKT format)
        if (city.boundary_wkt) {
            payload.boundary = city.boundary_wkt;
        }

        // Add centroid if provided
        if (city.centroid_lat && city.centroid_lng) {
            payload.centroid = `POINT(${city.centroid_lng} ${city.centroid_lat})`;
        }

        const { error } = await supabase
            .from('cities')
            .upsert(payload, { onConflict: 'name' });

        if (error) {
            console.error(`  ❌ Failed to import ${city.name}: ${error.message}`);
            failed++;
        } else {
            success++;
        }
    }

    console.log(`  ✅ Imported ${success} cities, ${failed} failed`);
}

async function seedPincodes(filePath: string, cityId?: string, cityName?: string): Promise<void> {
    console.log(`\n📍 Importing pincodes from ${filePath}...`);

    if (!existsSync(filePath)) {
        console.error(`❌ File not found: ${filePath}`);
        process.exit(1);
    }

    // Resolve city ID
    let resolvedCityId = cityId;
    if (!resolvedCityId && cityName) {
        const { data: cityData } = await supabase
            .from('cities')
            .select('id')
            .eq('name', cityName)
            .single();

        if (cityData) {
            resolvedCityId = cityData.id;
        } else {
            console.error(`❌ City not found: ${cityName}`);
            process.exit(1);
        }
    }

    if (!resolvedCityId) {
        console.error('❌ Must provide --city-id or --city-name');
        process.exit(1);
    }

    const data: PincodeInput[] = JSON.parse(readFileSync(filePath, 'utf-8'));
    console.log(`  Found ${data.length} pincodes to import for city ${resolvedCityId}`);

    let success = 0;
    let failed = 0;

    for (const pin of data) {
        const payload: Record<string, any> = {
            city_id: resolvedCityId,
            code: pin.code,
            name: pin.name,
            population_estimate: pin.population_estimate,
            active: true
        };

        // Add boundary if provided (WKT format)
        if (pin.boundary_wkt) {
            payload.boundary = pin.boundary_wkt;
        }

        // Add centroid if provided
        if (pin.centroid_lat && pin.centroid_lng) {
            payload.centroid = `POINT(${pin.centroid_lng} ${pin.centroid_lat})`;
        }

        const { error } = await supabase
            .from('geo_pincodes')
            .upsert(payload, { onConflict: 'city_id,code' });

        if (error) {
            console.error(`  ❌ Failed to import ${pin.code}: ${error.message}`);
            failed++;
        } else {
            success++;
        }
    }

    console.log(`  ✅ Imported ${success} pincodes, ${failed} failed`);
}

async function main(): Promise<void> {
    console.log('═══════════════════════════════════════════════════════════════');
    console.log('  C20 ExpansionOS: Geo Data Import Tool');
    console.log('═══════════════════════════════════════════════════════════════');

    const args = process.argv.slice(2);

    if (args.includes('--help') || args.length === 0) {
        console.log(`
Usage:
  npx tsx scripts/c20_seed_geo_data.ts --cities <path>
  npx tsx scripts/c20_seed_geo_data.ts --pincodes <path> --city-id <uuid>
  npx tsx scripts/c20_seed_geo_data.ts --pincodes <path> --city-name <name>

Options:
  --cities <path>      Path to cities JSON file
  --pincodes <path>    Path to pincodes JSON file
  --city-id <uuid>     City UUID for pincode import
  --city-name <name>   City name for pincode import (resolved to ID)

City JSON format:
  [{ "name": "Bangalore", "state": "Karnataka", "centroid_lat": 12.97, "centroid_lng": 77.59 }]

Pincode JSON format:
  [{ "code": "560001", "name": "MG Road", "centroid_lat": 12.97, "centroid_lng": 77.60 }]
`);
        process.exit(0);
    }

    const citiesIdx = args.indexOf('--cities');
    const pincodesIdx = args.indexOf('--pincodes');
    const cityIdIdx = args.indexOf('--city-id');
    const cityNameIdx = args.indexOf('--city-name');

    if (citiesIdx !== -1 && args[citiesIdx + 1]) {
        await seedCities(args[citiesIdx + 1]);
    }

    if (pincodesIdx !== -1 && args[pincodesIdx + 1]) {
        const cityId = cityIdIdx !== -1 ? args[cityIdIdx + 1] : undefined;
        const cityName = cityNameIdx !== -1 ? args[cityNameIdx + 1] : undefined;
        await seedPincodes(args[pincodesIdx + 1], cityId, cityName);
    }

    console.log('\n✅ Import complete');
}

main();
