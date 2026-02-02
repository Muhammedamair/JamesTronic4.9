
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';

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

    const user = session.user;
    const role = user.app_metadata?.app_role;

    // Keep API check (fast fail), DB also enforces.
    if (!['admin', 'super_admin'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden: Only admins can activate rulesets' }, { status: 403 });
    }

    const body = await request.json();
    const { id, version, confirm_text, reason } = body;

    if (!id || !version || !confirm_text || !reason) {
        return NextResponse.json({ error: 'Missing required fields' }, { status: 400 });
    }
    if (confirm_text.trim() !== version) {
        return NextResponse.json({ error: 'Confirmation text does not match version exactly' }, { status: 400 });
    }

    // Transactional activation via RPC (no service-role key here)
    // Using the authenticated client passes the JWT, allowing the RPC to check auth.uid() and role.
    const { data, error } = await supabase.rpc('activate_pricing_ruleset', {
        p_ruleset_id: id,
        p_reason: reason
    });

    if (error) {
        console.error('RPC Error:', error);
        // Normalize known errors
        const msg = error.message || 'Activation failed';
        const code =
            msg.includes('forbidden') ? 403 :
                msg.includes('unauthorized') ? 401 :
                    msg.includes('ruleset_not_found') ? 404 :
                        msg.includes('already_active') ? 409 :
                            msg.includes('reason_too_short') ? 400 : 500;

        return NextResponse.json({ error: msg }, { status: code });
    }

    return NextResponse.json({ success: true, data });
}
