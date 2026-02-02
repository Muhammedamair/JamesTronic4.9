
import { createClient } from '@/lib/supabase/server';
import { NextResponse } from 'next/server';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
    const { id } = await params;
    const supabase = await createClient(); // Authenticated session

    // 1. Auth & Input
    const { ttl_minutes, max_uses, intended_customer_id, intended_phone_e164 } = await request.json();

    if (!id) {
        return NextResponse.json({ error: 'Quote ID required' }, { status: 400 });
    }

    // 2. Call RPC (SECURITY DEFINER filters role/city)
    const { data, error } = await supabase.rpc('create_quote_share_token', {
        p_quote_id: id,
        p_ttl_minutes: ttl_minutes,
        p_max_uses: max_uses,
        p_intended_customer_id: intended_customer_id || null,
        p_intended_phone_e164: intended_phone_e164 || null
    });

    if (error) {
        console.error('Share Token Error:', error);
        return NextResponse.json({ error: error.message }, { status: 400 });
    }

    // 3. Return Token (One-time) + Helper URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
    const shareUrl = `${baseUrl}/q/${data.token}`;

    return NextResponse.json({
        success: true,
        token: data.token,
        expires_at: data.expires_at,
        max_uses: data.max_uses,
        share_url: shareUrl
    });
}
