import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
    try {
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing Bearer Token' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];

        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: { headers: { Authorization: `Bearer ${token}` } }
            }
        );

        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized: Invalid Token' }, { status: 401 });
        }

        // Extract query params
        const searchParams = request.nextUrl.searchParams;
        const city_id = searchParams.get('city_id');
        const quote_id = searchParams.get('quote_id');

        let query = supabase
            .from('pricing_audit_log')
            .select('*')
            .order('created_at', { ascending: false })
            .limit(50);

        if (city_id) query = query.eq('city_id', city_id);
        if (quote_id) query = query.eq('quote_id', quote_id);

        const { data, error } = await query;

        if (error) {
            // RLS error often comes as 401/403 or empty array depending on exact config
            // But from API wrapper POV, just return error
            return NextResponse.json({ error: error.message }, { status: 403 });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('API Error (Audit):', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
