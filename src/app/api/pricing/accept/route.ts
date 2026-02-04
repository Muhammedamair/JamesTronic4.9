import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
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

        const body = await request.json();
        const { quote_id, ticket_id } = body;

        const { data, error } = await supabase.rpc('rpc_c21_accept_quote', {
            p_quote_id: quote_id,
            p_ticket_id: ticket_id || null
        });

        if (error) {
            return NextResponse.json({ error: error.message }, { status: 500 });
        }

        if (data && data.success === false) {
            return NextResponse.json(data, { status: 400 });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('API Error (Accept):', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
