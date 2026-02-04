
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

const supabase = createClient(SUPABASE_URL, ANON_KEY);

const TOKEN = "eyJhbGciOiJIUzI1NiIsImtpZCI6ImtZTFNDUkdjOHRVbDFKSmQiLCJ0eXAiOiJKV1QifQ.eyJpc3MiOiJodHRwczovL3dpc2RiYmZpbW9zdnlrcmZ1Z3JvLnN1cGFiYXNlLmNvL2F1dGgvdjEiLCJzdWIiOiI4ODZmNDU2YS1mZmU4LTQxMTEtOTFlMy04ZWFkMmIzYzkzZTUiLCJhdWQiOiJhdXRoZW50aWNhdGVkIiwiZXhwIjoxNzY5ODE0OTE1LCJpYXQiOjE3Njk4MTEzMTUsImVtYWlsIjoibWFuYWdlckBqYW1lc3Ryb25pYy50ZXN0IiwicGhvbmUiOiI5MTk5OTk5OTk5OTEiLCJhcHBfbWV0YWRhdGEiOnsiYWxsb3dlZF9jaXR5X2lkcyI6WyIyMjIyMjIyMi1iYmJiLTRiYmItYmJiYi1iYmJiYmJiYmJiYmIiXSwiYXBwX3JvbGUiOiJtYW5hZ2VyIiwiY2l0eV9pZCI6IjIyMjIyMjIyLWJiYmItNGJiYi1iYmJiLWJiYmJiYmJiYmJiYiIsInByb3ZpZGVyIjoiZW1haWwiLCJwcm92aWRlcnMiOlsiZW1haWwiLCJwaG9uZSJdfSwidXNlcl9tZXRhZGF0YSI6eyJjaXR5X2lkIjoiMjIyMjIyMjItYmJiYi00YmJiLWJiYmItYmJiYmJiYmJiYmJiIiwiZW1haWxfdmVyaWZpZWQiOnRydWUsImZ1bGxfbmFtZSI6Ik1hbmFnZXIgKENpdHkgQSkiLCJyb2xlIjoibWFuYWdlciJ9LCJyb2xlIjoiYXV0aGVudGljYXRlZCIsImFhbCI6ImFhbDEiLCJhbXIiOlt7Im1ldGhvZCI6InBhc3N3b3JkIiwidGltZXN0YW1wIjoxNzY5ODExMzE1fV0sInNlc3Npb25faWQiOiI4MTdiZWEyNi1hMjc4LTQ0Y2QtYWY1Yi1iYjkwMTlkNTlmNWYiLCJpc19hbm9ueW1vdXMiOmZhbHNlfQ.j4Csswrt7yCuH__bbeaY2QKZCk6fdvnwZTthmUbKJBk";
const REFRESH = "7cj3xagpi3ub";

async function run() {
    // Set session
    const { error: sessionError } = await supabase.auth.setSession({
        access_token: TOKEN,
        refresh_token: REFRESH
    });

    if (sessionError) {
        console.error('Session Error:', sessionError);
        process.exit(1);
    }

    console.log('Session set. Calling RPC...');

    const { data, error } = await supabase.rpc('create_pricing_quote', {
        p_city_id: '22222222-bbbb-4bbb-bbbb-bbbbbbbbbbbb',
        p_service_code: 'TV_INSTALL_WALL_24_32',
        p_customer_id: null,
        p_ticket_id: null,
        p_urgency: 'standard',
        p_complexity: 'simple',
        p_parts_cost: 100
    });

    if (error) {
        console.error('RPC Error:', error);
    } else {
        console.log('Success:', data);
    }
}

run();
