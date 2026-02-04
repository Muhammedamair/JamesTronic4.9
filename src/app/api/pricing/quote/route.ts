import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from 'next/server';

export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
    try {
        // 1. Auth Check (Minimal)
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing Bearer Token' }, { status: 401 });
        }
        const token = authHeader.split(' ')[1];

        // 2. Init Supabase
        const supabase = createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                global: { headers: { Authorization: `Bearer ${token}` } }
            }
        );

        // 3. Validate Token
        const { data: { user }, error: authError } = await supabase.auth.getUser();
        if (authError || !user) {
            return NextResponse.json({ error: 'Unauthorized: Invalid Token' }, { status: 401 });
        }

        // 4. Parse Body
        const body = await request.json();
        const { city_id, service_code, customer_id, parts_cost, urgency, complexity, promo_code } = body;

        // 5. Call RPC
        const { data, error } = await supabase.rpc('rpc_c21_quote_price', {
            p_city_id: city_id,
            p_service_code: service_code,
            p_customer_id: customer_id || null, // Optional
            p_parts_cost: parts_cost || 0,
            p_urgency: urgency || 'standard',
            p_complexity: complexity || 'standard',
            p_promo_code: promo_code || null
        });

        if (error) {
            console.error('RPC Error (Quote):', error);
            return NextResponse.json({ error: error.message }, { status: 500 }); // RPC errors might be 400s if guardrails hit?
        }

        // Handle explicit failure returns from RPC (which returns structured JSON)
        if (data && data.success === false) {
            // e.g. Guardrail blocked
            return NextResponse.json(data, { status: 400 });
        }

        return NextResponse.json(data);

    } catch (error: any) {
        console.error('API Error (Quote):', error);
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 });
    }
}
