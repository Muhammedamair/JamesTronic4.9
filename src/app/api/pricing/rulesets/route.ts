import { createServerClient, type CookieOptions } from '@supabase/ssr';
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

    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    const role = session.user.app_metadata?.app_role;
    if (!['admin', 'super_admin', 'manager'].includes(role)) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    // Fetch rulesets
    // RLS will automatically filter:
    // - Managers: Only sees is_active=true rows
    // - Admins: Sees all rows
    const { data, error } = await supabase
        .from('pricing_rulesets')
        .select('id, version, is_active, activated_at, created_at, rules')
        .order('is_active', { ascending: false }) // Active first
        .order('created_at', { ascending: false }); // Then newest

    if (error) {
        return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ data });
}
