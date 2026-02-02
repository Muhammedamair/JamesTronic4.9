import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

export async function POST(
    request: Request,
    { params }: { params: Promise<{ id: string }> }
) {
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

    const { id: quoteId } = await params;
    const body = await request.json().catch(() => ({}));
    const reason = body.reason || null;

    // Call accept RPC
    const { data, error } = await supabase.rpc('accept_pricing_quote', {
        p_quote_id: quoteId,
        p_reason: reason
    });

    if (error) {
        console.error('Accept RPC Error:', error);
        const msg = error.message || 'Quote acceptance failed';
        const code =
            msg.includes('forbidden') ? 403 :
                msg.includes('unauthorized') ? 401 :
                    msg.includes('quote_not_found') ? 404 :
                        msg.includes('quote_expired') ? 410 :
                            msg.includes('invalid_status') ? 409 : 500;

        return NextResponse.json({ error: msg }, { status: code });
    }

    return NextResponse.json(data);
}
