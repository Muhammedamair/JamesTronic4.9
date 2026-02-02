
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(request: Request) {
    const supabase = await createClient(); // Authenticated session (Customer)

    // 1. Auth & Input
    const { token } = await request.json();

    if (!token) {
        return NextResponse.json({ error: 'Token required' }, { status: 400 });
    }

    // 2. Call RPC (SECURITY DEFINER filters role/customer/usage)
    const { data, error } = await supabase.rpc('redeem_quote_share_token', {
        p_token: token
    });

    if (error) {
        console.error('Redeem Token Error:', error);
        // Map specific DB errors to cleaner HTTP responses if needed
        // e.g. 'token_expired' -> 410 Gone, 'forbidden' -> 403
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 3. Return Quote DTO
    return NextResponse.json(data);
}
