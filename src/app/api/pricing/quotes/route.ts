import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function GET(request: Request) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    // Debug 500 error
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
        console.error('Missing Supabase Keys in API Route');
        return NextResponse.json({ error: 'Server Misconfiguration' }, { status: 500 });
    }

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // RLS handles city scoping automatically
    const { searchParams } = new URL(request.url);
    const cityId = searchParams.get('city_id');

    let query = supabase
        .from('pricing_quotes')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(100);

    if (cityId) {
        query = query.eq('city_id', cityId);
    }

    const { data, error } = await query;

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}

export async function POST(request: Request) {
    const cookieStore = await cookies();
    const supabase = createServerClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
        {
            cookies: {
                get(name: string) {
                    return cookieStore.get(name)?.value;
                },
            },
        }
    );

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const body = await request.json();
    const { city_id, service_code, customer_id, ticket_id, urgency, complexity, parts_cost } = body;

    if (!city_id || !service_code) {
        return NextResponse.json({ error: 'Missing required fields: city_id, service_code' }, { status: 400 });
    }

    // Call RPC using authenticated session (city auth enforced in RPC)
    const { data, error } = await supabase.rpc('create_pricing_quote', {
        p_city_id: city_id,
        p_service_code: service_code,
        p_customer_id: customer_id || null,
        p_ticket_id: ticket_id || null,
        p_urgency: urgency || 'standard',
        p_complexity: complexity || 'standard',
        p_parts_cost: parts_cost || 0
    });

    if (error) {
        console.error('RPC Error:', error);
        const msg = error.message || 'Quote creation failed';
        const code =
            msg.includes('forbidden') ? 403 :
                msg.includes('unauthorized') ? 401 :
                    msg.includes('no_active_ruleset') ? 503 :
                        msg.includes('base_rate_not_found') ? 404 : 500;

        return NextResponse.json({ error: msg }, { status: code });
    }

    return NextResponse.json(data);
}
